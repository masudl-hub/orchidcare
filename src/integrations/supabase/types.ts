export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      agent_operations: {
        Row: {
          correlation_id: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          operation_type: string
          profile_id: string
          record_id: string | null
          table_name: string
          tool_name: string | null
        }
        Insert: {
          correlation_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          operation_type: string
          profile_id: string
          record_id?: string | null
          table_name: string
          tool_name?: string | null
        }
        Update: {
          correlation_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          operation_type?: string
          profile_id?: string
          record_id?: string | null
          table_name?: string
          tool_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_operations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_permissions: {
        Row: {
          capability: Database["public"]["Enums"]["agent_capability"]
          created_at: string | null
          enabled: boolean | null
          id: string
          profile_id: string
          updated_at: string | null
        }
        Insert: {
          capability: Database["public"]["Enums"]["agent_capability"]
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          profile_id: string
          updated_at?: string | null
        }
        Update: {
          capability?: Database["public"]["Enums"]["agent_capability"]
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          profile_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_permissions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      api_usage_log: {
        Row: {
          api_key_id: string
          created_at: string | null
          end_user_id: string
          error_message: string | null
          id: string
          latency_ms: number | null
          profile_id: string
          status: string
        }
        Insert: {
          api_key_id: string
          created_at?: string | null
          end_user_id: string
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          profile_id: string
          status: string
        }
        Update: {
          api_key_id?: string
          created_at?: string | null
          end_user_id?: string
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          profile_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_log_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "developer_api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_usage_log_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      call_sessions: {
        Row: {
          created_at: string | null
          duration_seconds: number | null
          ended_at: string | null
          id: string
          mode: string
          profile_id: string
          started_at: string | null
          status: string
          summary: string | null
          tool_calls_count: number | null
          voice: string | null
        }
        Insert: {
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          mode?: string
          profile_id: string
          started_at?: string | null
          status?: string
          summary?: string | null
          tool_calls_count?: number | null
          voice?: string | null
        }
        Update: {
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          mode?: string
          profile_id?: string
          started_at?: string | null
          status?: string
          summary?: string | null
          tool_calls_count?: number | null
          voice?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_sessions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      care_events: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          notes: string | null
          photo_url: string | null
          plant_id: string
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          notes?: string | null
          photo_url?: string | null
          plant_id: string
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          notes?: string | null
          photo_url?: string | null
          plant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_events_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_summaries: {
        Row: {
          created_at: string | null
          end_time: string | null
          id: string
          key_topics: string[] | null
          message_count: number | null
          profile_id: string
          start_time: string | null
          summary: string
        }
        Insert: {
          created_at?: string | null
          end_time?: string | null
          id?: string
          key_topics?: string[] | null
          message_count?: number | null
          profile_id: string
          start_time?: string | null
          summary: string
        }
        Update: {
          created_at?: string | null
          end_time?: string | null
          id?: string
          key_topics?: string[] | null
          message_count?: number | null
          profile_id?: string
          start_time?: string | null
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_summaries_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          channel: string
          content: string
          created_at: string | null
          direction: string
          id: string
          media_urls: string[] | null
          message_sid: string | null
          profile_id: string
          summarized: boolean | null
        }
        Insert: {
          channel: string
          content: string
          created_at?: string | null
          direction: string
          id?: string
          media_urls?: string[] | null
          message_sid?: string | null
          profile_id: string
          summarized?: boolean | null
        }
        Update: {
          channel?: string
          content?: string
          created_at?: string | null
          direction?: string
          id?: string
          media_urls?: string[] | null
          message_sid?: string | null
          profile_id?: string
          summarized?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      developer_api_keys: {
        Row: {
          created_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          profile_id: string
          rate_limit_per_minute: number | null
          status: string
          total_calls: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name?: string
          profile_id: string
          rate_limit_per_minute?: number | null
          status?: string
          total_calls?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          profile_id?: string
          rate_limit_per_minute?: number | null
          status?: string
          total_calls?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "developer_api_keys_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_content: {
        Row: {
          content: Json
          content_type: string
          created_at: string | null
          id: string
          profile_id: string
          source_message_id: string | null
          task_description: string | null
        }
        Insert: {
          content: Json
          content_type: string
          created_at?: string | null
          id?: string
          profile_id: string
          source_message_id?: string | null
          task_description?: string | null
        }
        Update: {
          content?: Json
          content_type?: string
          created_at?: string | null
          id?: string
          profile_id?: string
          source_message_id?: string | null
          task_description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_content_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_content_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      linking_codes: {
        Row: {
          code: string
          created_at: string | null
          expires_at: string | null
          id: string
          location: string | null
          personality: string | null
          phone_number: string | null
          used_at: string | null
          user_id: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          location?: string | null
          personality?: string | null
          phone_number?: string | null
          used_at?: string | null
          user_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          location?: string | null
          personality?: string | null
          phone_number?: string | null
          used_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      plant_identifications: {
        Row: {
          care_tips: string | null
          confidence: number | null
          created_at: string | null
          diagnosis: string | null
          id: string
          photo_url: string | null
          plant_id: string | null
          profile_id: string | null
          severity: string | null
          species_guess: string | null
          treatment: string | null
        }
        Insert: {
          care_tips?: string | null
          confidence?: number | null
          created_at?: string | null
          diagnosis?: string | null
          id?: string
          photo_url?: string | null
          plant_id?: string | null
          profile_id?: string | null
          severity?: string | null
          species_guess?: string | null
          treatment?: string | null
        }
        Update: {
          care_tips?: string | null
          confidence?: number | null
          created_at?: string | null
          diagnosis?: string | null
          id?: string
          photo_url?: string | null
          plant_id?: string | null
          profile_id?: string | null
          severity?: string | null
          species_guess?: string | null
          treatment?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plant_identifications_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plant_identifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plant_snapshots: {
        Row: {
          context: string
          created_at: string
          description: string
          health_notes: string | null
          id: string
          image_path: string
          plant_id: string
          profile_id: string
          source: string
        }
        Insert: {
          context?: string
          created_at?: string
          description: string
          health_notes?: string | null
          id?: string
          image_path: string
          plant_id: string
          profile_id: string
          source?: string
        }
        Update: {
          context?: string
          created_at?: string
          description?: string
          health_notes?: string | null
          id?: string
          image_path?: string
          plant_id?: string
          profile_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "plant_snapshots_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plant_snapshots_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plants: {
        Row: {
          acquired_date: string | null
          created_at: string | null
          id: string
          location_in_home: string | null
          name: string
          nickname: string | null
          notes: string | null
          photo_url: string | null
          profile_id: string
          species: string | null
          updated_at: string | null
        }
        Insert: {
          acquired_date?: string | null
          created_at?: string | null
          id?: string
          location_in_home?: string | null
          name: string
          nickname?: string | null
          notes?: string | null
          photo_url?: string | null
          profile_id: string
          species?: string | null
          updated_at?: string | null
        }
        Update: {
          acquired_date?: string | null
          created_at?: string | null
          id?: string
          location_in_home?: string | null
          name?: string
          nickname?: string | null
          notes?: string | null
          photo_url?: string | null
          profile_id?: string
          species?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      proactive_messages: {
        Row: {
          channel: string
          created_at: string
          id: string
          message_content: string
          profile_id: string
          response_received: boolean | null
          sent_at: string
          trigger_data: Json | null
          trigger_type: string
        }
        Insert: {
          channel: string
          created_at?: string
          id?: string
          message_content: string
          profile_id: string
          response_received?: boolean | null
          sent_at?: string
          trigger_data?: Json | null
          trigger_type: string
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          message_content?: string
          profile_id?: string
          response_received?: boolean | null
          sent_at?: string
          trigger_data?: Json | null
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "proactive_messages_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      proactive_preferences: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          profile_id: string
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          topic: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          profile_id: string
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          topic: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          profile_id?: string
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proactive_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          display_name: string | null
          experience_level: string | null
          id: string
          latitude: number | null
          location: string | null
          longitude: number | null
          notification_frequency: string | null
          personality: Database["public"]["Enums"]["doctor_personality"] | null
          pets: string[] | null
          phone_number: string | null
          primary_concerns: string[] | null
          telegram_chat_id: number | null
          telegram_username: string | null
          timezone: string | null
          updated_at: string | null
          user_id: string | null
          whatsapp_number: string | null
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          experience_level?: string | null
          id?: string
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          notification_frequency?: string | null
          personality?: Database["public"]["Enums"]["doctor_personality"] | null
          pets?: string[] | null
          phone_number?: string | null
          primary_concerns?: string[] | null
          telegram_chat_id?: number | null
          telegram_username?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          experience_level?: string | null
          id?: string
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          notification_frequency?: string | null
          personality?: Database["public"]["Enums"]["doctor_personality"] | null
          pets?: string[] | null
          phone_number?: string | null
          primary_concerns?: string[] | null
          telegram_chat_id?: number | null
          telegram_username?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      reminders: {
        Row: {
          created_at: string | null
          frequency_days: number | null
          id: string
          is_active: boolean | null
          next_due: string
          notes: string | null
          plant_id: string | null
          profile_id: string
          reminder_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          frequency_days?: number | null
          id?: string
          is_active?: boolean | null
          next_due: string
          notes?: string | null
          plant_id?: string | null
          profile_id: string
          reminder_type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          frequency_days?: number | null
          id?: string
          is_active?: boolean | null
          next_due?: string
          notes?: string | null
          plant_id?: string | null
          profile_id?: string
          reminder_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminders_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_insights: {
        Row: {
          confidence: number | null
          created_at: string | null
          id: string
          insight_key: string
          insight_value: string
          profile_id: string
          source_message_id: string | null
          updated_at: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          id?: string
          insight_key: string
          insight_value: string
          profile_id: string
          source_message_id?: string | null
          updated_at?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          id?: string
          insight_key?: string
          insight_value?: string
          profile_id?: string
          source_message_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_insights_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_insights_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_profile_by_phone: {
        Args: { _phone: string }
        Returns: {
          id: string
          phone_number: string
          user_id: string
        }[]
      }
      has_agent_capability: {
        Args: {
          _capability: Database["public"]["Enums"]["agent_capability"]
          _profile_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_tool_calls_count: {
        Args: { p_session_id: string }
        Returns: undefined
      }
    }
    Enums: {
      agent_capability:
        | "read_plants"
        | "manage_plants"
        | "read_reminders"
        | "manage_reminders"
        | "read_conversations"
        | "shopping_search"
        | "research_web"
        | "generate_content"
        | "delete_plants"
        | "delete_notes"
        | "delete_insights"
        | "send_reminders"
        | "send_insights"
        | "create_reminders"
      app_role: "user" | "premium" | "admin"
      doctor_personality: "warm" | "expert" | "philosophical" | "playful"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      agent_capability: [
        "read_plants",
        "manage_plants",
        "read_reminders",
        "manage_reminders",
        "read_conversations",
        "shopping_search",
        "research_web",
        "generate_content",
        "delete_plants",
        "delete_notes",
        "delete_insights",
        "send_reminders",
        "send_insights",
        "create_reminders",
      ],
      app_role: ["user", "premium", "admin"],
      doctor_personality: ["warm", "expert", "philosophical", "playful"],
    },
  },
} as const
