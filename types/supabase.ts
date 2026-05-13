export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'admin' | 'staff'

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          role: UserRole
          settings: Json
          created_at: string
          is_active: boolean
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          role?: UserRole
          settings?: Json
          created_at?: string
          is_active?: boolean
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          role?: UserRole
          settings?: Json
          created_at?: string
          is_active?: boolean
        }
        Relationships: []
      }
      contacts: {
        Row: {
          id: string
          full_name: string | null
          email: string | null
          phone: string | null
          social_id: string | null
          channel: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          full_name?: string | null
          email?: string | null
          phone?: string | null
          social_id?: string | null
          channel?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          email?: string | null
          phone?: string | null
          social_id?: string | null
          channel?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      channel_configs: {
        Row: {
          id: string
          channel_type: string
          display_name: string
          identifier: string
          credentials: Json
          is_active: boolean
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          channel_type: string
          display_name: string
          identifier: string
          credentials?: Json
          is_active?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          channel_type?: string
          display_name?: string
          identifier?: string
          credentials?: Json
          is_active?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          id: string
          contact_id: string
          assigned_to: string | null
          channel: string
          status: string
          department: string | null
          priority: string
          subject: string | null
          is_read: boolean
          created_at: string
          updated_at: string
          closed_at: string | null
          last_message_at: string
          external_thread_id: string | null
          channel_config_id: string | null
        }
        Insert: {
          id?: string
          contact_id: string
          assigned_to?: string | null
          channel: string
          status?: string
          department?: string | null
          priority?: string
          subject?: string | null
          is_read?: boolean
          created_at?: string
          updated_at?: string
          closed_at?: string | null
          last_message_at?: string
          external_thread_id?: string | null
          channel_config_id?: string | null
        }
        Update: {
          id?: string
          contact_id?: string
          assigned_to?: string | null
          channel?: string
          status?: string
          department?: string | null
          priority?: string
          subject?: string | null
          is_read?: boolean
          created_at?: string
          updated_at?: string
          closed_at?: string | null
          last_message_at?: string
          external_thread_id?: string | null
          channel_config_id?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          sender_type: string
          sender_id: string | null
          content: string
          is_internal_note: boolean
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          sender_type: string
          sender_id?: string | null
          content: string
          is_internal_note?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          sender_type?: string
          sender_id?: string | null
          content?: string
          is_internal_note?: boolean
          created_at?: string
        }
        Relationships: []
      }
      labels: {
        Row: {
          id: string
          name: string
          colour: string
          type: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          colour: string
          type: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          colour?: string
          type?: string
          created_at?: string
        }
        Relationships: []
      }
      conversation_labels: {
        Row: {
          conversation_id: string
          label_id: string
        }
        Insert: {
          conversation_id: string
          label_id: string
        }
        Update: {
          conversation_id?: string
          label_id?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          id: string
          conversation_id: string
          rating: number
          comment: string | null
          submitted_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          rating: number
          comment?: string | null
          submitted_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          rating?: number
          comment?: string | null
          submitted_at?: string
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
      user_role: UserRole
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type AppUser = Database['public']['Tables']['users']['Row']
