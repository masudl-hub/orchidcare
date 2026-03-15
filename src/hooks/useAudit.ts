import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export function useOutboundAudit(limit = 50) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["outbound_audit", profile?.id, limit],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from("outbound_message_audit")
        .select("*")
        .eq("profile_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.id,
    refetchInterval: 30000, // Auto-refresh every 30s
  });
}

export function useProactiveRunAudit(limit = 20) {
  return useQuery({
    queryKey: ["proactive_run_audit", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proactive_run_audit")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });
}

export function useToggleProactiveEnabled() {
  const queryClient = useQueryClient();
  const { profile, updateProfile } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!profile?.id) throw new Error("No profile");
      await updateProfile({ proactive_enabled: enabled });
    },
    onSuccess: (_, enabled) => {
      queryClient.invalidateQueries({ queryKey: ["system_settings"] });
      toast({ title: enabled ? "Proactive messages enabled" : "Proactive messages paused" });
    },
    onError: (error) => {
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
    },
  });
}
