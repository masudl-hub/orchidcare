import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tables } from "@/integrations/supabase/types";

export type CareEvent = Tables<"care_events">;
export type Conversation = Tables<"conversations">;

export interface ActivityEvent {
  id: string;
  type: 'care' | 'conversation' | 'system';
  subtype?: string; // event_type for care, direction for conversation
  title: string;
  description: string;
  plantName?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export function useAllCareEvents() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["all_care_events", profile?.id],
    queryFn: async (): Promise<CareEvent[]> => {
      if (!profile?.id) return [];

      // Get all plants for this user
      const { data: plants, error: plantsError } = await supabase
        .from("plants")
        .select("id")
        .eq("profile_id", profile.id);

      if (plantsError) throw plantsError;
      if (!plants || plants.length === 0) return [];

      const plantIds = plants.map((p) => p.id);

      // Get all care events for these plants
      const { data, error } = await supabase
        .from("care_events")
        .select("*, plants(name, nickname)")
        .in("plant_id", plantIds)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.id,
  });
}

export function useConversations() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["conversations", profile?.id],
    queryFn: async (): Promise<Conversation[]> => {
      if (!profile?.id) return [];

      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("profile_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.id,
  });
}

export type AgentOperation = Tables<"agent_operations">;

export function useAgentOperations() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["agent_operations", profile?.id],
    queryFn: async (): Promise<AgentOperation[]> => {
      if (!profile?.id) return [];

      const { data, error } = await supabase
        .from("agent_operations")
        .select("*")
        .eq("profile_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.id,
  });
}

export function useActivityFeed() {
  const { data: careEvents = [], isLoading: loadingCare } = useAllCareEvents();
  const { data: conversations = [], isLoading: loadingConversations } = useConversations();
  const { data: agentOps = [], isLoading: loadingAgentOps } = useAgentOperations();

  const isLoading = loadingCare || loadingConversations || loadingAgentOps;

  // Transform and combine all activities
  const activities: ActivityEvent[] = [
    // Care events
    ...careEvents.map((event): ActivityEvent => {
      const eventWithPlants = event as CareEvent & { plants?: { name: string; nickname: string | null } };
      const plant = eventWithPlants.plants;
      const plantName = plant?.nickname || plant?.name || 'Unknown Plant';

      const typeLabels: Record<string, string> = {
        watered: 'Watered',
        fertilized: 'Fertilized',
        repotted: 'Repotted',
        pruned: 'Pruned',
        treated: 'Treated',
        photo: 'Photo Added',
      };

      return {
        id: event.id,
        type: 'care',
        subtype: event.event_type,
        title: typeLabels[event.event_type] || event.event_type,
        description: event.notes || `Care event for ${plantName}`,
        plantName,
        timestamp: event.created_at || new Date().toISOString(),
        metadata: {
          photo_url: event.photo_url,
          plant_id: event.plant_id,
        },
      };
    }),
    // Conversations
    ...conversations.map((conv): ActivityEvent => ({
      id: conv.id,
      type: 'conversation',
      subtype: conv.direction,
      title: conv.direction === 'inbound' ? 'Message Received' : 'Message Sent',
      description: conv.content || 'Media message',
      timestamp: conv.created_at || new Date().toISOString(),
      metadata: {
        channel: conv.channel,
        message_sid: conv.message_sid,
        media_urls: conv.media_urls,
      },
    })),
    // Agent Operations
    ...agentOps.map((op): ActivityEvent => {
      return {
        id: op.id,
        type: 'system',
        subtype: op.tool_name || op.operation_type,
        title: `Agent Action: ${op.tool_name || op.operation_type}`,
        description: `Orchid modified ${op.table_name} data automatically on your behalf.`,
        timestamp: op.created_at || new Date().toISOString(),
        metadata: {
          correlation_id: op.correlation_id,
          record_id: op.record_id,
          operation_type: op.operation_type,
        },
      };
    }),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return {
    activities,
    isLoading,
  };
}
