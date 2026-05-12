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
      }
      sessions: {
        Row: {
          id: string
          name: string
          created_by: string
          status: 'open' | 'voting' | 'completed'
          num_teams: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_by: string
          status?: 'open' | 'voting' | 'completed'
          num_teams?: number
          created_at?: string
        }
        Update: {
          name?: string
          status?: 'open' | 'voting' | 'completed'
          num_teams?: number
        }
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
      }
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
    }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Session = Database['public']['Tables']['sessions']['Row']
export type SessionPlayer = Database['public']['Tables']['session_players']['Row']
export type Vote = Database['public']['Tables']['votes']['Row']
