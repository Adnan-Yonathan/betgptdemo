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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      bets: {
        Row: {
          actual_return: number | null
          amount: number
          bet_type: string | null
          conversation_id: string | null
          created_at: string
          description: string
          event_id: string | null
          id: string
          odds: number
          outcome: string
          potential_return: number | null
          settled_at: string | null
          team_bet_on: string | null
          user_id: string
        }
        Insert: {
          actual_return?: number | null
          amount: number
          bet_type?: string | null
          conversation_id?: string | null
          created_at?: string
          description: string
          event_id?: string | null
          id?: string
          odds: number
          outcome?: string
          potential_return?: number | null
          settled_at?: string | null
          team_bet_on?: string | null
          user_id: string
        }
        Update: {
          actual_return?: number | null
          amount?: number
          bet_type?: string | null
          conversation_id?: string | null
          created_at?: string
          description?: string
          event_id?: string | null
          id?: string
          odds?: number
          outcome?: string
          potential_return?: number | null
          settled_at?: string | null
          team_bet_on?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bets_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      betting_odds: {
        Row: {
          away_team: string
          bookmaker: string
          commence_time: string
          created_at: string
          event_id: string
          home_team: string
          id: string
          last_updated: string
          market_key: string
          outcome_name: string
          outcome_point: number | null
          outcome_price: number
          sport_key: string
          sport_title: string
        }
        Insert: {
          away_team: string
          bookmaker: string
          commence_time: string
          created_at?: string
          event_id: string
          home_team: string
          id?: string
          last_updated?: string
          market_key: string
          outcome_name: string
          outcome_point?: number | null
          outcome_price: number
          sport_key: string
          sport_title: string
        }
        Update: {
          away_team?: string
          bookmaker?: string
          commence_time?: string
          created_at?: string
          event_id?: string
          home_team?: string
          id?: string
          last_updated?: string
          market_key?: string
          outcome_name?: string
          outcome_point?: number | null
          outcome_price?: number
          sport_key?: string
          sport_title?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bankroll: number | null
          created_at: string
          default_bet_size: number | null
          email: string | null
          id: string
          risk_tolerance: string | null
          updated_at: string
          initial_bankroll: number | null
          kelly_multiplier: number | null
          max_bet_size_percentage: number | null
          min_edge_threshold: number | null
          variance_tolerance: string | null
          auto_kelly: boolean | null
          total_bets_placed: number | null
          total_bets_won: number | null
          total_bets_lost: number | null
          total_bets_pushed: number | null
          total_amount_wagered: number | null
          total_amount_won: number | null
          total_amount_lost: number | null
          win_rate: number | null
          roi: number | null
          average_bet_size: number | null
          largest_win: number | null
          largest_loss: number | null
          current_streak: number | null
          longest_win_streak: number | null
          longest_loss_streak: number | null
          total_profit: number | null
          pending_bet_count: number | null
          pending_bet_amount: number | null
          last_bet_at: string | null
          last_win_at: string | null
          last_loss_at: string | null
          last_sync_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          bankroll?: number | null
          created_at?: string
          default_bet_size?: number | null
          email?: string | null
          id: string
          risk_tolerance?: string | null
          updated_at?: string
          initial_bankroll?: number | null
          kelly_multiplier?: number | null
          max_bet_size_percentage?: number | null
          min_edge_threshold?: number | null
          variance_tolerance?: string | null
          auto_kelly?: boolean | null
          total_bets_placed?: number | null
          total_bets_won?: number | null
          total_bets_lost?: number | null
          total_bets_pushed?: number | null
          total_amount_wagered?: number | null
          total_amount_won?: number | null
          total_amount_lost?: number | null
          win_rate?: number | null
          roi?: number | null
          average_bet_size?: number | null
          largest_win?: number | null
          largest_loss?: number | null
          current_streak?: number | null
          longest_win_streak?: number | null
          longest_loss_streak?: number | null
          total_profit?: number | null
          pending_bet_count?: number | null
          pending_bet_amount?: number | null
          last_bet_at?: string | null
          last_win_at?: string | null
          last_loss_at?: string | null
          last_sync_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          bankroll?: number | null
          created_at?: string
          default_bet_size?: number | null
          email?: string | null
          id?: string
          risk_tolerance?: string | null
          updated_at?: string
          initial_bankroll?: number | null
          kelly_multiplier?: number | null
          max_bet_size_percentage?: number | null
          min_edge_threshold?: number | null
          variance_tolerance?: string | null
          auto_kelly?: boolean | null
          total_bets_placed?: number | null
          total_bets_won?: number | null
          total_bets_lost?: number | null
          total_bets_pushed?: number | null
          total_amount_wagered?: number | null
          total_amount_won?: number | null
          total_amount_lost?: number | null
          win_rate?: number | null
          roi?: number | null
          average_bet_size?: number | null
          largest_win?: number | null
          largest_loss?: number | null
          current_streak?: number | null
          longest_win_streak?: number | null
          longest_loss_streak?: number | null
          total_profit?: number | null
          pending_bet_count?: number | null
          pending_bet_amount?: number | null
          last_bet_at?: string | null
          last_win_at?: string | null
          last_loss_at?: string | null
          last_sync_at?: string | null
        }
        Relationships: []
      }
      sports_scores: {
        Row: {
          away_score: number | null
          away_team: string
          created_at: string
          event_id: string
          game_date: string
          game_status: string
          home_score: number | null
          home_team: string
          id: string
          last_updated: string
          league: string
          sport: string
        }
        Insert: {
          away_score?: number | null
          away_team: string
          created_at?: string
          event_id: string
          game_date: string
          game_status: string
          home_score?: number | null
          home_team: string
          id?: string
          last_updated?: string
          league: string
          sport: string
        }
        Update: {
          away_score?: number | null
          away_team?: string
          created_at?: string
          event_id?: string
          game_date?: string
          game_status?: string
          home_score?: number | null
          home_team?: string
          id?: string
          last_updated?: string
          league?: string
          sport?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
