import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface UserInsight {
  id: string;
  insight_key: string;
  insight_value: string;
  confidence: number | null;
  created_at: string | null;
}

export function useUserInsights() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["user_insights", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];

      const { data, error } = await supabase
        .from("user_insights")
        .select("*")
        .eq("profile_id", profile.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as UserInsight[];
    },
    enabled: !!profile?.id,
  });
}

export function useDeleteInsight() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (insightId: string) => {
      if (!profile?.id) throw new Error("No profile found");
      const { error } = await supabase
        .from("user_insights")
        .delete()
        .eq("id", insightId)
        .eq("profile_id", profile.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_insights", profile?.id] });
      toast({
        title: "Insight deleted",
        description: "The behavioral insight has been removed.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete insight",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
