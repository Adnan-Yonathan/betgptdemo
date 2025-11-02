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
      advanced_metrics: {
        Row: {
          best_bet_types: Json | null
          closing_line_value: number
          created_at: string
          id: string
          metric_date: string
          roi_by_sport: Json | null
          sharp_ratio: number
          time_analysis: Json | null
          user_id: string
          worst_bet_types: Json | null
        }
        Insert: {
          best_bet_types?: Json | null
          closing_line_value?: number
          created_at?: string
          id?: string
          metric_date: string
          roi_by_sport?: Json | null
          sharp_ratio?: number
          time_analysis?: Json | null
          user_id: string
          worst_bet_types?: Json | null
        }
        Update: {
          best_bet_types?: Json | null
          closing_line_value?: number
          created_at?: string
          id?: string
          metric_date?: string
          roi_by_sport?: Json | null
          sharp_ratio?: number
          time_analysis?: Json | null
          user_id?: string
          worst_bet_types?: Json | null
        }
        Relationships: []
      }
      ai_insights: {
        Row: {
          confidence_level: number
          created_at: string
          description: string
          dismissed: boolean
          id: string
          insight_type: string
          is_read: boolean
          league: string | null
          metadata: Json | null
          priority: string
          sport: string | null
          title: string
          user_id: string
        }
        Insert: {
          confidence_level?: number
          created_at?: string
          description: string
          dismissed?: boolean
          id?: string
          insight_type: string
          is_read?: boolean
          league?: string | null
          metadata?: Json | null
          priority?: string
          sport?: string | null
          title: string
          user_id: string
        }
        Update: {
          confidence_level?: number
          created_at?: string
          description?: string
          dismissed?: boolean
          id?: string
          insight_type?: string
          is_read?: boolean
          league?: string | null
          metadata?: Json | null
          priority?: string
          sport?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      alert_feedback: {
        Row: {
          alert_id: string
          alert_type: string | null
          created_at: string
          false_positive: boolean | null
          id: string
          led_to_bet: boolean | null
          notification_id: string | null
          priority_level: string | null
          relevance_rating: number | null
          time_to_action_seconds: number | null
          user_action: string | null
          user_id: string
          was_accurate: boolean | null
          was_timely: boolean | null
          was_useful: boolean
        }
        Insert: {
          alert_id: string
          alert_type?: string | null
          created_at?: string
          false_positive?: boolean | null
          id?: string
          led_to_bet?: boolean | null
          notification_id?: string | null
          priority_level?: string | null
          relevance_rating?: number | null
          time_to_action_seconds?: number | null
          user_action?: string | null
          user_id: string
          was_accurate?: boolean | null
          was_timely?: boolean | null
          was_useful: boolean
        }
        Update: {
          alert_id?: string
          alert_type?: string | null
          created_at?: string
          false_positive?: boolean | null
          id?: string
          led_to_bet?: boolean | null
          notification_id?: string | null
          priority_level?: string | null
          relevance_rating?: number | null
          time_to_action_seconds?: number | null
          user_action?: string | null
          user_id?: string
          was_accurate?: boolean | null
          was_timely?: boolean | null
          was_useful?: boolean
        }
        Relationships: []
      }
      bankroll_history: {
        Row: {
          bankroll: number
          bets_lost: number
          bets_placed: number
          bets_won: number
          created_at: string
          daily_profit_loss: number
          date: string
          id: string
          user_id: string
        }
        Insert: {
          bankroll?: number
          bets_lost?: number
          bets_placed?: number
          bets_won?: number
          created_at?: string
          daily_profit_loss?: number
          date: string
          id?: string
          user_id: string
        }
        Update: {
          bankroll?: number
          bets_lost?: number
          bets_placed?: number
          bets_won?: number
          created_at?: string
          daily_profit_loss?: number
          date?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      bankroll_transactions: {
        Row: {
          amount: number
          balance_after: number
          bet_id: string | null
          created_at: string | null
          id: string
          notes: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          bet_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          bet_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bankroll_transactions_bet_id_fkey"
            columns: ["bet_id"]
            isOneToOne: false
            referencedRelation: "bets"
            referencedColumns: ["id"]
          },
        ]
      }
      bets: {
        Row: {
          actual_return: number | null
          amount: number
          bet_type: string | null
          confidence_score: number | null
          conversation_id: string | null
          created_at: string
          description: string
          event_id: string | null
          id: string
          league: string | null
          odds: number
          outcome: string
          potential_return: number | null
          settled_at: string | null
          sport: string | null
          team_bet_on: string | null
          user_id: string
        }
        Insert: {
          actual_return?: number | null
          amount: number
          bet_type?: string | null
          confidence_score?: number | null
          conversation_id?: string | null
          created_at?: string
          description: string
          event_id?: string | null
          id?: string
          league?: string | null
          odds: number
          outcome?: string
          potential_return?: number | null
          settled_at?: string | null
          sport?: string | null
          team_bet_on?: string | null
          user_id: string
        }
        Update: {
          actual_return?: number | null
          amount?: number
          bet_type?: string | null
          confidence_score?: number | null
          conversation_id?: string | null
          created_at?: string
          description?: string
          event_id?: string | null
          id?: string
          league?: string | null
          odds?: number
          outcome?: string
          potential_return?: number | null
          settled_at?: string | null
          sport?: string | null
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
      betting_odds_fetch_log: {
        Row: {
          api_requests_remaining: number | null
          created_at: string
          error_message: string | null
          events_count: number | null
          id: string
          odds_count: number | null
          sports_fetched: string[]
          success: boolean
        }
        Insert: {
          api_requests_remaining?: number | null
          created_at?: string
          error_message?: string | null
          events_count?: number | null
          id?: string
          odds_count?: number | null
          sports_fetched: string[]
          success?: boolean
        }
        Update: {
          api_requests_remaining?: number | null
          created_at?: string
          error_message?: string | null
          events_count?: number | null
          id?: string
          odds_count?: number | null
          sports_fetched?: string[]
          success?: boolean
        }
        Relationships: []
      }
      betting_patterns: {
        Row: {
          avg_odds: number
          bet_type: string | null
          created_at: string
          id: string
          league: string | null
          pattern_name: string
          sport: string | null
          total_bets: number
          total_profit: number
          updated_at: string
          user_id: string
          win_rate: number
        }
        Insert: {
          avg_odds?: number
          bet_type?: string | null
          created_at?: string
          id?: string
          league?: string | null
          pattern_name: string
          sport?: string | null
          total_bets?: number
          total_profit?: number
          updated_at?: string
          user_id: string
          win_rate?: number
        }
        Update: {
          avg_odds?: number
          bet_type?: string | null
          created_at?: string
          id?: string
          league?: string | null
          pattern_name?: string
          sport?: string | null
          total_bets?: number
          total_profit?: number
          updated_at?: string
          user_id?: string
          win_rate?: number
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
      kalshi_fills: {
        Row: {
          action: string
          count: number
          created_at: string
          id: string
          market_ticker: string
          order_id: string | null
          price: number
          side: string
          total_cost: number
          trade_id: string | null
          trade_time: string
          trade_type: string | null
          user_id: string
        }
        Insert: {
          action: string
          count: number
          created_at?: string
          id?: string
          market_ticker: string
          order_id?: string | null
          price: number
          side: string
          total_cost: number
          trade_id?: string | null
          trade_time: string
          trade_type?: string | null
          user_id: string
        }
        Update: {
          action?: string
          count?: number
          created_at?: string
          id?: string
          market_ticker?: string
          order_id?: string | null
          price?: number
          side?: string
          total_cost?: number
          trade_id?: string | null
          trade_time?: string
          trade_type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      kalshi_markets: {
        Row: {
          can_close_early: boolean | null
          cap_strike: number | null
          category: string | null
          close_time: string
          created_at: string
          event_ticker: string
          expected_expiration_time: string | null
          expiration_time: string
          floor_strike: number | null
          id: string
          last_price: number | null
          liquidity: number | null
          market_type: string
          no_ask: number | null
          no_bid: number | null
          open_interest: number | null
          previous_yes_ask: number | null
          previous_yes_bid: number | null
          rules_primary: string | null
          rules_secondary: string | null
          series_ticker: string | null
          sport_key: string | null
          status: string
          strike_type: string | null
          subtitle: string | null
          synced_at: string | null
          tags: string[] | null
          ticker: string
          title: string
          updated_at: string
          volume: number | null
          volume_24h: number | null
          yes_ask: number | null
          yes_bid: number | null
        }
        Insert: {
          can_close_early?: boolean | null
          cap_strike?: number | null
          category?: string | null
          close_time: string
          created_at?: string
          event_ticker: string
          expected_expiration_time?: string | null
          expiration_time: string
          floor_strike?: number | null
          id?: string
          last_price?: number | null
          liquidity?: number | null
          market_type?: string
          no_ask?: number | null
          no_bid?: number | null
          open_interest?: number | null
          previous_yes_ask?: number | null
          previous_yes_bid?: number | null
          rules_primary?: string | null
          rules_secondary?: string | null
          series_ticker?: string | null
          sport_key?: string | null
          status?: string
          strike_type?: string | null
          subtitle?: string | null
          synced_at?: string | null
          tags?: string[] | null
          ticker: string
          title: string
          updated_at?: string
          volume?: number | null
          volume_24h?: number | null
          yes_ask?: number | null
          yes_bid?: number | null
        }
        Update: {
          can_close_early?: boolean | null
          cap_strike?: number | null
          category?: string | null
          close_time?: string
          created_at?: string
          event_ticker?: string
          expected_expiration_time?: string | null
          expiration_time?: string
          floor_strike?: number | null
          id?: string
          last_price?: number | null
          liquidity?: number | null
          market_type?: string
          no_ask?: number | null
          no_bid?: number | null
          open_interest?: number | null
          previous_yes_ask?: number | null
          previous_yes_bid?: number | null
          rules_primary?: string | null
          rules_secondary?: string | null
          series_ticker?: string | null
          sport_key?: string | null
          status?: string
          strike_type?: string | null
          subtitle?: string | null
          synced_at?: string | null
          tags?: string[] | null
          ticker?: string
          title?: string
          updated_at?: string
          volume?: number | null
          volume_24h?: number | null
          yes_ask?: number | null
          yes_bid?: number | null
        }
        Relationships: []
      }
      kalshi_orders: {
        Row: {
          action: string
          canceled_at: string | null
          count: number
          created_at: string
          executed_at: string | null
          id: string
          market_ticker: string
          no_price: number | null
          order_id: string | null
          order_type: string
          placed_at: string
          remaining_count: number | null
          side: string
          status: string
          updated_at: string
          user_id: string
          yes_price: number | null
        }
        Insert: {
          action: string
          canceled_at?: string | null
          count: number
          created_at?: string
          executed_at?: string | null
          id?: string
          market_ticker: string
          no_price?: number | null
          order_id?: string | null
          order_type?: string
          placed_at?: string
          remaining_count?: number | null
          side: string
          status?: string
          updated_at?: string
          user_id: string
          yes_price?: number | null
        }
        Update: {
          action?: string
          canceled_at?: string | null
          count?: number
          created_at?: string
          executed_at?: string | null
          id?: string
          market_ticker?: string
          no_price?: number | null
          order_id?: string | null
          order_type?: string
          placed_at?: string
          remaining_count?: number | null
          side?: string
          status?: string
          updated_at?: string
          user_id?: string
          yes_price?: number | null
        }
        Relationships: []
      }
      kalshi_positions: {
        Row: {
          average_price: number
          closed_at: string | null
          created_at: string
          current_price: number
          current_value: number
          id: string
          market_ticker: string
          opened_at: string
          position_side: string
          quantity: number
          status: string
          total_cost: number
          unrealized_pnl: number
          updated_at: string
          user_id: string
        }
        Insert: {
          average_price: number
          closed_at?: string | null
          created_at?: string
          current_price?: number
          current_value?: number
          id?: string
          market_ticker: string
          opened_at?: string
          position_side: string
          quantity: number
          status?: string
          total_cost: number
          unrealized_pnl?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          average_price?: number
          closed_at?: string | null
          created_at?: string
          current_price?: number
          current_value?: number
          id?: string
          market_ticker?: string
          opened_at?: string
          position_side?: string
          quantity?: number
          status?: string
          total_cost?: number
          unrealized_pnl?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      line_movement_history: {
        Row: {
          bookmaker: string
          created_at: string
          event_id: string
          id: string
          market_key: string
          moneyline_away: number | null
          moneyline_home: number | null
          recorded_at: string
          sport: string
          spread: number | null
          total: number | null
        }
        Insert: {
          bookmaker: string
          created_at?: string
          event_id: string
          id?: string
          market_key?: string
          moneyline_away?: number | null
          moneyline_home?: number | null
          recorded_at?: string
          sport: string
          spread?: number | null
          total?: number | null
        }
        Update: {
          bookmaker?: string
          created_at?: string
          event_id?: string
          id?: string
          market_key?: string
          moneyline_away?: number | null
          moneyline_home?: number | null
          recorded_at?: string
          sport?: string
          spread?: number | null
          total?: number | null
        }
        Relationships: []
      }
      live_score_cache: {
        Row: {
          api_last_updated: string | null
          api_response: Json | null
          away_score: number
          away_team: string
          created_at: string
          game_date: string
          game_id: string
          game_status: string
          game_time: string | null
          home_score: number
          home_team: string
          id: string
          last_updated: string
          league: string
          period: string | null
          sport: string
          time_remaining: string | null
        }
        Insert: {
          api_last_updated?: string | null
          api_response?: Json | null
          away_score?: number
          away_team: string
          created_at?: string
          game_date: string
          game_id: string
          game_status: string
          game_time?: string | null
          home_score?: number
          home_team: string
          id?: string
          last_updated?: string
          league: string
          period?: string | null
          sport: string
          time_remaining?: string | null
        }
        Update: {
          api_last_updated?: string | null
          api_response?: Json | null
          away_score?: number
          away_team?: string
          created_at?: string
          game_date?: string
          game_id?: string
          game_status?: string
          game_time?: string | null
          home_score?: number
          home_team?: string
          id?: string
          last_updated?: string
          league?: string
          period?: string | null
          sport?: string
          time_remaining?: string | null
        }
        Relationships: []
      }
      loss_limits: {
        Row: {
          created_at: string | null
          current_daily_loss: number | null
          current_monthly_loss: number | null
          current_weekly_loss: number | null
          daily_limit: number | null
          id: string
          monthly_limit: number | null
          updated_at: string | null
          user_id: string
          weekly_limit: number | null
        }
        Insert: {
          created_at?: string | null
          current_daily_loss?: number | null
          current_monthly_loss?: number | null
          current_weekly_loss?: number | null
          daily_limit?: number | null
          id?: string
          monthly_limit?: number | null
          updated_at?: string | null
          user_id: string
          weekly_limit?: number | null
        }
        Update: {
          created_at?: string | null
          current_daily_loss?: number | null
          current_monthly_loss?: number | null
          current_weekly_loss?: number | null
          daily_limit?: number | null
          id?: string
          monthly_limit?: number | null
          updated_at?: string | null
          user_id?: string
          weekly_limit?: number | null
        }
        Relationships: []
      }
      message_feedback: {
        Row: {
          conversation_id: string | null
          created_at: string
          feedback_type: string
          id: string
          is_helpful: boolean | null
          message_content_preview: string | null
          message_id: string
          rating: number | null
          response_type: string | null
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          feedback_type: string
          id?: string
          is_helpful?: boolean | null
          message_content_preview?: string | null
          message_id: string
          rating?: number | null
          response_type?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          feedback_type?: string
          id?: string
          is_helpful?: boolean | null
          message_content_preview?: string | null
          message_id?: string
          rating?: number | null
          response_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_feedback_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
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
      model_predictions: {
        Row: {
          away_team: string
          confidence_score: number | null
          created_at: string
          edge_percentage: number | null
          event_id: string
          feature_values: Json | null
          game_date: string | null
          home_team: string
          id: string
          league: string | null
          model_version: string | null
          predicted_outcome: string | null
          predicted_value: number | null
          prediction_type: string
          sport: string
        }
        Insert: {
          away_team: string
          confidence_score?: number | null
          created_at?: string
          edge_percentage?: number | null
          event_id: string
          feature_values?: Json | null
          game_date?: string | null
          home_team: string
          id?: string
          league?: string | null
          model_version?: string | null
          predicted_outcome?: string | null
          predicted_value?: number | null
          prediction_type: string
          sport: string
        }
        Update: {
          away_team?: string
          confidence_score?: number | null
          created_at?: string
          edge_percentage?: number | null
          event_id?: string
          feature_values?: Json | null
          game_date?: string | null
          home_team?: string
          id?: string
          league?: string | null
          model_version?: string | null
          predicted_outcome?: string | null
          predicted_value?: number | null
          prediction_type?: string
          sport?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          created_at: string
          dismissed: boolean
          id: string
          message: string
          metadata: Json | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          dismissed?: boolean
          id?: string
          message: string
          metadata?: Json | null
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string
          dismissed?: boolean
          id?: string
          message?: string
          metadata?: Json | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      opening_closing_lines: {
        Row: {
          closed_at: string | null
          closing_moneyline_away: number | null
          closing_moneyline_home: number | null
          closing_spread: number | null
          closing_total: number | null
          created_at: string
          event_id: string
          id: string
          league: string | null
          opened_at: string | null
          opening_moneyline_away: number | null
          opening_moneyline_home: number | null
          opening_spread: number | null
          opening_total: number | null
          sport: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closing_moneyline_away?: number | null
          closing_moneyline_home?: number | null
          closing_spread?: number | null
          closing_total?: number | null
          created_at?: string
          event_id: string
          id?: string
          league?: string | null
          opened_at?: string | null
          opening_moneyline_away?: number | null
          opening_moneyline_home?: number | null
          opening_spread?: number | null
          opening_total?: number | null
          sport: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closing_moneyline_away?: number | null
          closing_moneyline_home?: number | null
          closing_spread?: number | null
          closing_total?: number | null
          created_at?: string
          event_id?: string
          id?: string
          league?: string | null
          opened_at?: string | null
          opening_moneyline_away?: number | null
          opening_moneyline_home?: number | null
          opening_spread?: number | null
          opening_total?: number | null
          sport?: string
          updated_at?: string
        }
        Relationships: []
      }
      parlay_legs: {
        Row: {
          bet_id: string
          created_at: string | null
          event_id: string
          id: string
          odds: number
          result: string | null
          selection: string
        }
        Insert: {
          bet_id: string
          created_at?: string | null
          event_id: string
          id?: string
          odds: number
          result?: string | null
          selection: string
        }
        Update: {
          bet_id?: string
          created_at?: string | null
          event_id?: string
          id?: string
          odds?: number
          result?: string | null
          selection?: string
        }
        Relationships: [
          {
            foreignKeyName: "parlay_legs_bet_id_fkey"
            columns: ["bet_id"]
            isOneToOne: false
            referencedRelation: "bets"
            referencedColumns: ["id"]
          },
        ]
      }
      pattern_detections: {
        Row: {
          affected_bets: Json | null
          confidence_score: number
          created_at: string
          description: string
          detected_at: string
          id: string
          league: string | null
          pattern_type: string
          sport: string | null
          user_id: string
        }
        Insert: {
          affected_bets?: Json | null
          confidence_score?: number
          created_at?: string
          description: string
          detected_at?: string
          id?: string
          league?: string | null
          pattern_type: string
          sport?: string | null
          user_id: string
        }
        Update: {
          affected_bets?: Json | null
          confidence_score?: number
          created_at?: string
          description?: string
          detected_at?: string
          id?: string
          league?: string | null
          pattern_type?: string
          sport?: string | null
          user_id?: string
        }
        Relationships: []
      }
      prediction_feedback: {
        Row: {
          confidence_rating: number | null
          created_at: string
          id: string
          prediction_id: string
          sport: string | null
          user_action: string | null
          user_id: string
          user_profit_loss: number | null
          value_rating: number | null
          was_accurate: boolean | null
          was_helpful: boolean
        }
        Insert: {
          confidence_rating?: number | null
          created_at?: string
          id?: string
          prediction_id: string
          sport?: string | null
          user_action?: string | null
          user_id: string
          user_profit_loss?: number | null
          value_rating?: number | null
          was_accurate?: boolean | null
          was_helpful: boolean
        }
        Update: {
          confidence_rating?: number | null
          created_at?: string
          id?: string
          prediction_id?: string
          sport?: string | null
          user_action?: string | null
          user_id?: string
          user_profit_loss?: number | null
          value_rating?: number | null
          was_accurate?: boolean | null
          was_helpful?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          average_bet_size: number | null
          bankroll: number | null
          baseline_bankroll: number | null
          cool_off_end: string | null
          created_at: string
          current_streak: number | null
          default_bet_size: number | null
          email: string | null
          id: string
          kelly_multiplier: number | null
          largest_loss: number | null
          largest_win: number | null
          last_sync_at: string | null
          pending_bet_amount: number | null
          pending_bet_count: number | null
          risk_tolerance: string | null
          roi: number | null
          total_bets_lost: number | null
          total_bets_placed: number | null
          total_bets_pushed: number | null
          total_bets_won: number | null
          total_profit: number | null
          updated_at: string
          win_rate: number | null
        }
        Insert: {
          avatar_url?: string | null
          average_bet_size?: number | null
          bankroll?: number | null
          baseline_bankroll?: number | null
          cool_off_end?: string | null
          created_at?: string
          current_streak?: number | null
          default_bet_size?: number | null
          email?: string | null
          id: string
          kelly_multiplier?: number | null
          largest_loss?: number | null
          largest_win?: number | null
          last_sync_at?: string | null
          pending_bet_amount?: number | null
          pending_bet_count?: number | null
          risk_tolerance?: string | null
          roi?: number | null
          total_bets_lost?: number | null
          total_bets_placed?: number | null
          total_bets_pushed?: number | null
          total_bets_won?: number | null
          total_profit?: number | null
          updated_at?: string
          win_rate?: number | null
        }
        Update: {
          avatar_url?: string | null
          average_bet_size?: number | null
          bankroll?: number | null
          baseline_bankroll?: number | null
          cool_off_end?: string | null
          created_at?: string
          current_streak?: number | null
          default_bet_size?: number | null
          email?: string | null
          id?: string
          kelly_multiplier?: number | null
          largest_loss?: number | null
          largest_win?: number | null
          last_sync_at?: string | null
          pending_bet_amount?: number | null
          pending_bet_count?: number | null
          risk_tolerance?: string | null
          roi?: number | null
          total_bets_lost?: number | null
          total_bets_placed?: number | null
          total_bets_pushed?: number | null
          total_bets_won?: number | null
          total_profit?: number | null
          updated_at?: string
          win_rate?: number | null
        }
        Relationships: []
      }
      scraped_websites: {
        Row: {
          created_at: string
          custom_prompt: string | null
          extract_type: string | null
          id: string
          scraped_data: Json | null
          url: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          custom_prompt?: string | null
          extract_type?: string | null
          id?: string
          scraped_data?: Json | null
          url: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          custom_prompt?: string | null
          extract_type?: string | null
          id?: string
          scraped_data?: Json | null
          url?: string
          user_id?: string | null
        }
        Relationships: []
      }
      sharp_money_signals: {
        Row: {
          created_at: string
          detected_at: string
          event_id: string
          id: string
          league: string | null
          line_movement_indicator: string | null
          public_percentage: number | null
          sharp_percentage: number | null
          signal_strength: string | null
          sport: string
        }
        Insert: {
          created_at?: string
          detected_at?: string
          event_id: string
          id?: string
          league?: string | null
          line_movement_indicator?: string | null
          public_percentage?: number | null
          sharp_percentage?: number | null
          signal_strength?: string | null
          sport: string
        }
        Update: {
          created_at?: string
          detected_at?: string
          event_id?: string
          id?: string
          league?: string | null
          line_movement_indicator?: string | null
          public_percentage?: number | null
          sharp_percentage?: number | null
          signal_strength?: string | null
          sport?: string
        }
        Relationships: []
      }
      smart_alerts: {
        Row: {
          action_url: string | null
          alert_type: string
          created_at: string
          dismissed: boolean
          event_id: string | null
          id: string
          is_read: boolean
          league: string | null
          market_ticker: string | null
          message: string
          metadata: Json | null
          severity: string
          sport: string | null
          title: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          alert_type: string
          created_at?: string
          dismissed?: boolean
          event_id?: string | null
          id?: string
          is_read?: boolean
          league?: string | null
          market_ticker?: string | null
          message: string
          metadata?: Json | null
          severity?: string
          sport?: string | null
          title: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          alert_type?: string
          created_at?: string
          dismissed?: boolean
          event_id?: string | null
          id?: string
          is_read?: boolean
          league?: string | null
          market_ticker?: string | null
          message?: string
          metadata?: Json | null
          severity?: string
          sport?: string | null
          title?: string
          user_id?: string
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
      user_alert_preferences: {
        Row: {
          arbitrage_alerts: boolean | null
          created_at: string
          id: string
          injury_alerts: boolean | null
          line_movement_alerts: boolean | null
          min_edge_threshold: number | null
          notification_methods: Json | null
          sharp_money_alerts: boolean | null
          updated_at: string
          user_id: string
          value_bet_alerts: boolean | null
        }
        Insert: {
          arbitrage_alerts?: boolean | null
          created_at?: string
          id?: string
          injury_alerts?: boolean | null
          line_movement_alerts?: boolean | null
          min_edge_threshold?: number | null
          notification_methods?: Json | null
          sharp_money_alerts?: boolean | null
          updated_at?: string
          user_id: string
          value_bet_alerts?: boolean | null
        }
        Update: {
          arbitrage_alerts?: boolean | null
          created_at?: string
          id?: string
          injury_alerts?: boolean | null
          line_movement_alerts?: boolean | null
          min_edge_threshold?: number | null
          notification_methods?: Json | null
          sharp_money_alerts?: boolean | null
          updated_at?: string
          user_id?: string
          value_bet_alerts?: boolean | null
        }
        Relationships: []
      }
      user_bankroll: {
        Row: {
          created_at: string | null
          current_amount: number
          id: string
          starting_amount: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_amount?: number
          id?: string
          starting_amount?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_amount?: number
          id?: string
          starting_amount?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_goals: {
        Row: {
          created_at: string
          current_value: number
          deadline: string | null
          goal_type: string
          id: string
          status: string
          target_value: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_value?: number
          deadline?: string | null
          goal_type: string
          id?: string
          status?: string
          target_value: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_value?: number
          deadline?: string | null
          goal_type?: string
          id?: string
          status?: string
          target_value?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          auto_settle_bets: boolean
          created_at: string
          default_stake_unit: number
          favorite_leagues: Json | null
          favorite_sports: Json | null
          id: string
          notification_enabled: boolean
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_settle_bets?: boolean
          created_at?: string
          default_stake_unit?: number
          favorite_leagues?: Json | null
          favorite_sports?: Json | null
          id?: string
          notification_enabled?: boolean
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_settle_bets?: boolean
          created_at?: string
          default_stake_unit?: number
          favorite_leagues?: Json | null
          favorite_sports?: Json | null
          id?: string
          notification_enabled?: boolean
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_active_goals: {
        Args: { p_user_id: string }
        Returns: {
          current_value: number
          deadline: string
          goal_type: string
          id: string
          progress_percentage: number
          status: string
          target_value: number
        }[]
      }
      get_bankroll_history: {
        Args: { p_days?: number; p_user_id: string }
        Returns: {
          bankroll: number
          daily_profit_loss: number
          date: string
        }[]
      }
      get_performance_breakdown: {
        Args: { p_user_id: string }
        Returns: {
          roi: number
          sport: string
          total_bets: number
          total_lost: number
          total_profit: number
          total_won: number
          win_rate: number
        }[]
      }
      get_user_active_bets_live: {
        Args: { p_user_id: string }
        Returns: {
          amount: number
          away_score: number
          away_team: string
          bet_id: string
          bet_type: string
          created_at: string
          description: string
          event_id: string
          game_status: string
          game_time: string
          home_score: number
          home_team: string
          league: string
          odds: number
          potential_return: number
          sport: string
          team_bet_on: string
        }[]
      }
      get_user_unread_alerts: {
        Args: { p_user_id: string }
        Returns: {
          action_url: string
          alert_type: string
          created_at: string
          dismissed: boolean
          event_id: string
          id: string
          is_read: boolean
          league: string
          market_ticker: string
          message: string
          metadata: Json
          severity: string
          sport: string
          title: string
        }[]
      }
      mark_alert_as_read: {
        Args: { p_alert_id: string; p_user_id: string }
        Returns: undefined
      }
      trigger_live_scores_update: { Args: never; Returns: string }
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
