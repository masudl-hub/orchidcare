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
      queryClient.invalidateQueries({ queryKey: ["sensorData"] });
    },
  });
}

export function useCreateDevice() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ name, plantId }: { name?: string; plantId?: string }) => {
      if (!profile?.id) throw new Error("No profile");

      // Generate a short device token client-side
      const alphabet = "abcdefghjkmnpqrstuvwxyz23456789"; // no ambiguous 0/O/l/1
      const bytes = new Uint8Array(8);
      crypto.getRandomValues(bytes);
      const token = "odev_" + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
      const prefix = token;

      // Hash the token (SHA-256)
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(token));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

      const { data, error } = await supabase
        .from("devices")
        .insert({
          profile_id: profile.id,
          plant_id: plantId || null,
          device_token_hash: hash,
          device_token_prefix: prefix,
          name: name || "New Sensor",
          status: "active",
        })
        .select()
        .single();

      if (error) throw error;
      // Return the plaintext token — this is the only time it's visible
      return { device: data as Device, token };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
  });
}

export function useSendDeviceCommand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ deviceId, command, payload }: { deviceId: string; command: string; payload?: Record<string, unknown> }) => {
      const { data, error } = await supabase
        .from("device_commands")
        .insert([{
          device_id: deviceId,
          command,
          payload: (payload || null) as any,
          status: "pending",
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      // Poll for fresh sensor data after a short delay (give ESP32 time to respond)
      if (variables.command === "read_now") {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["sensorData"] });
          queryClient.invalidateQueries({ queryKey: ["sensorStatusBatch"] });
        }, 3000);
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["sensorData"] });
          queryClient.invalidateQueries({ queryKey: ["sensorStatusBatch"] });
        }, 8000);
      }
    },
  });
}
