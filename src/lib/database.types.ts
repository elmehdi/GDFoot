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
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_by: string
          status?: 'open' | 'voting' | 'completed'
          team_size?: 5 | 6 | 8 | 11
          created_at?: string
        }
        Update: {
          name?: string
          status?: 'open' | 'voting' | 'completed'
          team_size?: 5 | 6 | 8 | 11
        }
        Relationships: [
          {
            foreignKeyName: "sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_teams: {
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
