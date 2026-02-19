import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";

export type Plant = Tables<"plants">;
export type Reminder = Tables<"reminders">;
export type CareEvent = Tables<"care_events">;
export type PlantIdentification = Tables<"plant_identifications">;

// Resolve a photo_url: if it's a storage path (no protocol), generate a signed URL.
// If it's already a full URL (https://...), return as-is.
async function resolvePhotoUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  // Storage path — generate a 1-hour signed URL
  const { data, error } = await supabase.storage
    .from("plant-photos")
    .createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export interface PlantWithReminder extends Plant {
  nextReminder?: Reminder;
}

export function usePlants() {
  const { profile } = useAuth();
  const { toast } = useToast();

  return useQuery({
    queryKey: ["plants", profile?.id],
    queryFn: async (): Promise<PlantWithReminder[]> => {
      if (!profile?.id) return [];

      // Fetch plants
      const { data: plants, error: plantsError } = await supabase
        .from("plants")
        .select("*")
        .eq("profile_id", profile.id)
        .order("created_at", { ascending: false });

      if (plantsError) throw plantsError;
      if (!plants || plants.length === 0) return [];

      // Fetch reminders for these plants
      const plantIds = plants.map((p) => p.id);
      const { data: reminders, error: remindersError } = await supabase
        .from("reminders")
        .select("*")
        .in("plant_id", plantIds)
        .eq("is_active", true)
        .gte("next_due", new Date().toISOString())
        .order("next_due", { ascending: true });

      if (remindersError) {
        console.error("Error fetching reminders:", remindersError);
      }

      // Map next reminder to each plant
      const reminderMap = new Map<string, Reminder>();
      reminders?.forEach((r) => {
        if (r.plant_id && !reminderMap.has(r.plant_id)) {
          reminderMap.set(r.plant_id, r);
        }
      });

      // Resolve storage paths to signed URLs for photos
      const plantsWithPhotos = await Promise.all(
        plants.map(async (plant) => ({
          ...plant,
          photo_url: await resolvePhotoUrl(plant.photo_url),
          nextReminder: reminderMap.get(plant.id),
        }))
      );

      return plantsWithPhotos;
    },
    enabled: !!profile?.id,
    staleTime: 45 * 60 * 1000,
    refetchInterval: 45 * 60 * 1000,
  });
}

export function usePlant(plantId: string | null) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["plant", plantId],
    queryFn: async () => {
      if (!plantId) return null;

      const { data, error } = await supabase
        .from("plants")
        .select("*")
        .eq("id", plantId)
        .eq("profile_id", profile!.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return { ...data, photo_url: await resolvePhotoUrl(data.photo_url) };
    },
    enabled: !!plantId && !!profile?.id,
    staleTime: 45 * 60 * 1000,
  });
}

export function useCareEvents(plantId: string | null) {
  return useQuery({
    queryKey: ["care_events", plantId],
    queryFn: async (): Promise<CareEvent[]> => {
      if (!plantId) return [];

      const { data, error } = await supabase
        .from("care_events")
        .select("*")
        .eq("plant_id", plantId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    },
    enabled: !!plantId,
  });
}

export function usePlantReminders(plantId: string | null) {
  return useQuery({
    queryKey: ["reminders", plantId],
    queryFn: async (): Promise<Reminder[]> => {
      if (!plantId) return [];

      const { data, error } = await supabase
        .from("reminders")
        .select("*")
        .eq("plant_id", plantId)
        .eq("is_active", true)
        .order("next_due", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!plantId,
  });
}

export function usePlantIdentifications(plantId: string | null) {
  return useQuery({
    queryKey: ["plant_identifications", plantId],
    queryFn: async (): Promise<PlantIdentification[]> => {
      if (!plantId) return [];

      const { data, error } = await supabase
        .from("plant_identifications")
        .select("*")
        .eq("plant_id", plantId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!data) return [];
      // Resolve storage paths to signed URLs
      return Promise.all(
        data.map(async (id) => ({
          ...id,
          photo_url: await resolvePhotoUrl(id.photo_url),
        }))
      );
    },
    enabled: !!plantId,
    staleTime: 45 * 60 * 1000,
  });
}

export function useCreatePlant() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (plant: Omit<TablesInsert<"plants">, "profile_id">) => {
      if (!profile?.id) throw new Error("No profile found");

      const { data, error } = await supabase
        .from("plants")
        .insert({ ...plant, profile_id: profile.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plants"] });
      toast({ title: "Plant added successfully!" });
    },
    onError: (error) => {
      toast({
        title: "Failed to add plant",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdatePlant() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: TablesUpdate<"plants"> & { id: string }) => {
      const { data, error } = await supabase
        .from("plants")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["plants"] });
      queryClient.invalidateQueries({ queryKey: ["plant", data.id] });
      toast({ title: "Plant updated successfully!" });
    },
    onError: (error) => {
      toast({
        title: "Failed to update plant",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeletePlant() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (plantId: string) => {
      const { error } = await supabase
        .from("plants")
        .delete()
        .eq("id", plantId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plants"] });
      toast({ title: "Plant deleted" });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete plant",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
