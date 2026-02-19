import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";

export type ProactivePreference = Tables<"proactive_preferences">;
export type AgentPermission = Tables<"agent_permissions">;

export interface SystemSettings {
  // From profiles table
  personality: string;
  location: string;
  timezone: string;
  notification_frequency: string;
  
  // From proactive_preferences table
  quiet_hours_start: string;
  quiet_hours_end: string;
  care_reminders_enabled: boolean;
  observations_enabled: boolean;
  seasonal_tips_enabled: boolean;
  health_followups_enabled: boolean;
  
  // From agent_permissions table
  can_delete_plants: boolean;
  can_delete_notes: boolean;
  can_delete_insights: boolean;
  can_send_reminders: boolean;
  can_send_insights: boolean;
  can_create_reminders: boolean;
}

export function useProactivePreferences() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["proactive_preferences", profile?.id],
    queryFn: async (): Promise<ProactivePreference[]> => {
      if (!profile?.id) return [];

      const { data, error } = await supabase
        .from("proactive_preferences")
        .select("*")
        .eq("profile_id", profile.id);

      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.id,
  });
}

export function useAgentPermissions() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["agent_permissions", profile?.id],
    queryFn: async (): Promise<AgentPermission[]> => {
      if (!profile?.id) return [];

      const { data, error } = await supabase
        .from("agent_permissions")
        .select("*")
        .eq("profile_id", profile.id);

      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.id,
  });
}

export function useSystemSettings() {
  const { profile } = useAuth();
  const { data: preferences = [], isLoading: prefsLoading } = useProactivePreferences();
  const { data: permissions = [], isLoading: permsLoading } = useAgentPermissions();

  // If we have no rows at all, we need to initialize them
  // This should have been done by the migration/trigger, but handle the edge case
  const needsInitialization = !prefsLoading && !permsLoading && 
    profile && 
    (preferences.length === 0 || permissions.length === 0);

  console.log('[useSystemSettings] Debug:', {
    profileId: profile?.id,
    prefsCount: preferences.length,
    permsCount: permissions.length,
    prefsLoading,
    permsLoading,
    needsInitialization,
    preferences: preferences.map(p => ({ topic: p.topic, enabled: p.enabled })),
    permissions: permissions.map(p => ({ capability: p.capability, enabled: p.enabled }))
  });

  // Don't use useQuery - just compute directly from the fetched data
  // This ensures we always use the latest data from preferences and permissions
  if (!profile || prefsLoading || permsLoading) {
    return { data: null, isLoading: prefsLoading || permsLoading, needsInitialization: false };
  }

  if (needsInitialization) {
    // Return null to indicate settings need initialization
    console.log('[useSystemSettings] Returning null - needs initialization');
    return { data: null, isLoading: false, needsInitialization: true };
  }

  // Get first preference for quiet hours (they should all have the same values)
  const firstPref = preferences[0];
  
  // Create preference map
  const prefMap = new Map(preferences.map(p => [p.topic, p.enabled]));
  
  // Create permission map
  const permMap = new Map(permissions.map(p => [p.capability, p.enabled]));

  const systemSettings: SystemSettings = {
    personality: profile.personality || 'warm',
    location: profile.location || '',
    timezone: profile.timezone || 'America/New_York',
    notification_frequency: profile.notification_frequency || 'daily',
    quiet_hours_start: firstPref?.quiet_hours_start || '22:00',
    quiet_hours_end: firstPref?.quiet_hours_end || '08:00',
    // Only use DB values - no fallbacks. If key doesn't exist in map, it's undefined
    care_reminders_enabled: prefMap.get('care_reminders') ?? true,
    observations_enabled: prefMap.get('observations') ?? true,
    seasonal_tips_enabled: prefMap.get('seasonal_tips') ?? true,
    health_followups_enabled: prefMap.get('health_followups') ?? true,
    can_delete_plants: permMap.get('delete_plants') ?? false,
    can_delete_notes: permMap.get('delete_notes') ?? false,
    can_delete_insights: permMap.get('delete_insights') ?? false,
    can_send_reminders: permMap.get('send_reminders') ?? true,
    can_send_insights: permMap.get('send_insights') ?? true,
    can_create_reminders: permMap.get('create_reminders') ?? true,
  };

  return { data: systemSettings, isLoading: false, needsInitialization: false };
}

// New function to initialize missing settings
export function useInitializeSettings() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      if (!profile?.id) throw new Error("No profile found");

      // Create default proactive preferences
      const defaultPreferences = [
        { profile_id: profile.id, topic: 'care_reminders', enabled: true, cadence: 'daily' },
        { profile_id: profile.id, topic: 'observations', enabled: true, cadence: 'daily' },
        { profile_id: profile.id, topic: 'seasonal_tips', enabled: true, cadence: 'weekly' },
        { profile_id: profile.id, topic: 'health_followups', enabled: true, cadence: 'daily' },
      ];

      const { error: prefError } = await supabase
        .from("proactive_preferences")
        .upsert(defaultPreferences, { onConflict: 'profile_id,topic', ignoreDuplicates: true });

      if (prefError) throw prefError;

      // Create default agent permissions
      const defaultPermissions = [
        { profile_id: profile.id, capability: 'delete_plants' as const, enabled: false },
        { profile_id: profile.id, capability: 'delete_notes' as const, enabled: false },
        { profile_id: profile.id, capability: 'delete_insights' as const, enabled: false },
        { profile_id: profile.id, capability: 'send_reminders' as const, enabled: true },
        { profile_id: profile.id, capability: 'send_insights' as const, enabled: true },
        { profile_id: profile.id, capability: 'create_reminders' as const, enabled: true },
      ];

      const { error: permError } = await supabase
        .from("agent_permissions")
        .upsert(defaultPermissions, { onConflict: 'profile_id,capability', ignoreDuplicates: true });

      if (permError) throw permError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proactive_preferences"] });
      queryClient.invalidateQueries({ queryKey: ["agent_permissions"] });
    },
    onError: (error) => {
      console.error('Failed to initialize settings:', error);
      toast({
        title: "Failed to initialize settings",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateQuietHours() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ start, end }: { start: string; end: string }) => {
      if (!profile?.id) throw new Error("No profile found");

      // Update all preferences with new quiet hours
      const { error } = await supabase
        .from("proactive_preferences")
        .update({
          quiet_hours_start: start,
          quiet_hours_end: end,
          updated_at: new Date().toISOString(),
        })
        .eq("profile_id", profile.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proactive_preferences"] });
      queryClient.invalidateQueries({ queryKey: ["system_settings"] });
      toast({ title: "Quiet hours updated" });
    },
    onError: (error) => {
      toast({
        title: "Failed to update quiet hours",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useTogglePreference() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ topic, enabled }: { topic: string; enabled: boolean }) => {
      if (!profile?.id) throw new Error("No profile found");

      // Try to update existing preference
      const { data: existing } = await supabase
        .from("proactive_preferences")
        .select("*")
        .eq("profile_id", profile.id)
        .eq("topic", topic)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from("proactive_preferences")
          .update({
            enabled,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from("proactive_preferences")
          .insert({
            profile_id: profile.id,
            topic,
            enabled,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proactive_preferences"] });
      queryClient.invalidateQueries({ queryKey: ["system_settings"] });
    },
    onError: (error) => {
      toast({
        title: "Failed to update preference",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useToggleAgentPermission() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ capability, enabled }: { capability: string; enabled: boolean }) => {
      if (!profile?.id) throw new Error("No profile found");

      const { error } = await supabase
        .from("agent_permissions")
        .update({
          enabled,
          updated_at: new Date().toISOString(),
        })
        .eq("profile_id", profile.id)
        .eq("capability", capability as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent_permissions"] });
      queryClient.invalidateQueries({ queryKey: ["system_settings"] });
    },
    onError: (error) => {
      toast({
        title: "Failed to update permission",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateProfileSettings() {
  const queryClient = useQueryClient();
  const { profile, updateProfile } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (updates: Partial<Pick<SystemSettings, 'personality' | 'location' | 'timezone' | 'notification_frequency'>>) => {
      if (!profile?.id) throw new Error("No profile found");

      // Cast notification_frequency to the proper type
      const profileUpdates: Record<string, unknown> = { ...updates };
      if (updates.notification_frequency) {
        profileUpdates.notification_frequency = updates.notification_frequency as 'off' | 'daily' | 'weekly' | 'realtime';
      }
      if (updates.personality) {
        profileUpdates.personality = updates.personality as 'warm' | 'expert' | 'philosophical' | 'playful';
      }

      await updateProfile(profileUpdates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system_settings"] });
      toast({ title: "Settings updated" });
    },
    onError: (error) => {
      toast({
        title: "Failed to update settings",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
