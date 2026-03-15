import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Device {
  id: string;
  profile_id: string;
  plant_id: string | null;
  device_token_prefix: string;
  name: string;
  status: "active" | "inactive" | "revoked";
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useDevices() {
  const { profile } = useAuth();

  return useQuery<Device[]>({
    queryKey: ["devices", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];

      const { data, error } = await supabase
        .from("devices")
        .select("id, profile_id, plant_id, device_token_prefix, name, status, last_seen_at, created_at, updated_at")
        .eq("profile_id", profile.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as Device[];
    },
    enabled: !!profile?.id,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

export function useUpdateDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; plant_id?: string | null; status?: string }) => {
      const { data, error } = await supabase
        .from("devices")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      queryClient.invalidateQueries({ queryKey: ["sensorStatusBatch"] });
    },
  });
}

export function useSendDeviceCommand() {
  return useMutation({
    mutationFn: async ({ deviceId, command, payload }: { deviceId: string; command: string; payload?: Record<string, unknown> }) => {
      const { data, error } = await supabase
        .from("device_commands")
        .insert({
          device_id: deviceId,
          command,
          payload: payload || null,
          status: "pending",
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
  });
}
