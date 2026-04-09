export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      appointments: {
        Row: {
          id: string
          owner_id: string
          title: string
          client_name: string | null
          client_id: string | null
          staff_member_id: string | null
          scheduled_at: string
          starts_at: string | null
          ends_at: string | null
          status: string
          source: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          title?: string
          client_name?: string | null
          client_id?: string | null
          staff_member_id?: string | null
          scheduled_at?: string
          starts_at?: string | null
          ends_at?: string | null
          status?: string
          source?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          title?: string
          client_name?: string | null
          client_id?: string | null
          staff_member_id?: string | null
          scheduled_at?: string
          starts_at?: string | null
          ends_at?: string | null
          status?: string
          source?: string | null
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      staff_members: {
        Row: {
          id: string
          owner_id: string
          full_name: string
          specialty: string
          is_active: boolean
          avatar_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          full_name: string
          specialty?: string
          is_active?: boolean
          avatar_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          full_name?: string
          specialty?: string
          is_active?: boolean
          avatar_url?: string | null
          created_at?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          id: string
          owner_id: string
          full_name: string
          phone: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          full_name: string
          phone: string
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          full_name?: string
          phone?: string
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          id: string
          owner_id: string
          name: string
          name_kk: string | null
          duration: number
          price: number
          category: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          name: string
          name_kk?: string | null
          duration?: number
          price?: number
          category?: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          name?: string
          name_kk?: string | null
          duration?: number
          price?: number
          category?: string
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      appointment_services: {
        Row: {
          id: string
          appointment_id: string
          service_id: string | null
          service_name: string
          price: number
          duration: number
          created_at: string
        }
        Insert: {
          id?: string
          appointment_id: string
          service_id?: string | null
          service_name: string
          price: number
          duration: number
          created_at?: string
        }
        Update: {
          id?: string
          appointment_id?: string
          service_id?: string | null
          service_name?: string
          price?: number
          duration?: number
          created_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          id: string
          owner_id: string
          appointment_id: string | null
          subtotal: number
          discount_amount: number
          discount_reason: string | null
          total_amount: number
          cash_amount: number
          kaspi_amount: number
          card_amount: number
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          appointment_id?: string | null
          subtotal?: number
          discount_amount?: number
          discount_reason?: string | null
          total_amount?: number
          cash_amount?: number
          kaspi_amount?: number
          card_amount?: number
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          appointment_id?: string | null
          subtotal?: number
          discount_amount?: number
          discount_reason?: string | null
          total_amount?: number
          cash_amount?: number
          kaspi_amount?: number
          card_amount?: number
          status?: string
          created_at?: string
        }
        Relationships: []
      }
      sales_transactions: {
        Row: {
          id: string
          owner_id: string
          amount_kzt: number
          occurred_at: string
          note: string | null
        }
        Insert: {
          id?: string
          owner_id: string
          amount_kzt: number
          occurred_at?: string
          note?: string | null
        }
        Update: {
          id?: string
          owner_id?: string
          amount_kzt?: number
          occurred_at?: string
          note?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          id: string
          owner_id: string
          amount_kzt: number
          category: string
          note: string | null
          occurred_at: string
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          amount_kzt: number
          category: string
          note?: string | null
          occurred_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          amount_kzt?: number
          category?: string
          note?: string | null
          occurred_at?: string
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type ExpenseCategory = 'salary' | 'rent' | 'supplies' | 'other'

export type ExpenseRow = {
  id: string
  owner_id: string
  amount_kzt: number
  category: ExpenseCategory
  note: string | null
  occurred_at: string
  created_at: string
}