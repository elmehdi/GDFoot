export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string
          avatar_url: string | null
          created_at: string
        }
        Insert: {
          id: string
          display_name: string
          avatar_url?: string | null
          created_at?: string
        }
        Update: {
          display_name?: string
          avatar_url?: string | null
        }
        Relationships: []
      }
      sessions: {
        Row: {
          id: string
          name: string
          created_by: string
          status: 'open' | 'voting' | 'completed'
          team_size: 5 | 6 | 8 | 11
          locked: boolean
          league_id: string | null
          home_squad: number | null
          away_squad: number | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_by: string
          status?: 'open' | 'voting' | 'completed'
          team_size?: 5 | 6 | 8 | 11
          locked?: boolean
          league_id?: string | null
          home_squad?: number | null
          away_squad?: number | null
          created_at?: string
        }
        Update: {
          name?: string
          status?: 'open' | 'voting' | 'completed'
          team_size?: 5 | 6 | 8 | 11
          locked?: boolean
          league_id?: string | null
          home_squad?: number | null
          away_squad?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          }
        ]
      }
      session_players: {
        Row: {
          id: string
          session_id: string
          player_id: string
          team: number | null
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          player_id: string
          team?: number | null
          created_at?: string
        }
        Update: {
          team?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "session_players_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      votes: {
        Row: {
          id: string
          session_id: string
          voter_id: string
          target_id: string
          score: number
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          voter_id: string
          target_id: string
          score: number
          created_at?: string
        }
        Update: {
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "votes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      player_ratings: {
        Row: {
          id: string
          voter_id: string
          target_id: string
          score: number
          updated_at: string
        }
        Insert: {
          id?: string
          voter_id: string
          target_id: string
          score: number
          updated_at?: string
        }
        Update: {
          score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_ratings_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_ratings_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      leagues: {
        Row: {
          id: string
          name: string
          created_by: string
          team_size: 5 | 6 | 8 | 11
          status: 'active' | 'completed'
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_by: string
          team_size?: 5 | 6 | 8 | 11
          status?: 'active' | 'completed'
          created_at?: string
        }
        Update: {
          name?: string
          team_size?: 5 | 6 | 8 | 11
          status?: 'active' | 'completed'
        }
        Relationships: [
          {
            foreignKeyName: "leagues_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      league_players: {
        Row: {
          id: string
          league_id: string
          player_id: string
          squad: number | null
          created_at: string
        }
        Insert: {
          id?: string
          league_id: string
          player_id: string
          squad?: number | null
          created_at?: string
        }
        Update: {
          squad?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "league_players_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      match_results: {
        Row: {
          id: string
          session_id: string
          team_1_goals: number
          team_2_goals: number
          recorded_by: string
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          team_1_goals: number
          team_2_goals: number
          recorded_by: string
          created_at?: string
        }
        Update: {
          team_1_goals?: number
          team_2_goals?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_results_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_results_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_teams: {
        Args: { p_session_id: string }
        Returns: { player_id: string; team: number; display_name: string }[]
      }
      generate_teams_from_ratings: {
        Args: { p_session_id: string }
        Returns: { player_id: string; team: number; display_name: string }[]
      }
      get_my_vote_status: {
        Args: { p_session_id: string; p_voter_id: string }
        Returns: { target_id: string; has_voted: boolean }[]
      }
      get_vote_progress: {
        Args: { p_session_id: string }
        Returns: number
      }
      get_league_standings: {
        Args: { p_league_id: string }
        Returns: {
          squad_number: number
          played: number
          won: number
          drawn: number
          lost: number
          goals_for: number
          goals_against: number
          goal_difference: number
          points: number
        }[]
      }
      generate_league_squads: {
        Args: { p_league_id: string }
        Returns: void
      }
      create_league_match: {
        Args: { p_league_id: string; p_match_name: string; p_home_squad: number; p_away_squad: number }
        Returns: string
      }
      update_display_name: {
        Args: { p_new_name: string }
        Returns: void
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Session = Database['public']['Tables']['sessions']['Row']
export type SessionPlayer = Database['public']['Tables']['session_players']['Row']
export type Vote = Database['public']['Tables']['votes']['Row']
export type PlayerRating = Database['public']['Tables']['player_ratings']['Row']
export type League = Database['public']['Tables']['leagues']['Row']
export type LeaguePlayer = Database['public']['Tables']['league_players']['Row']
export type MatchResult = Database['public']['Tables']['match_results']['Row']
