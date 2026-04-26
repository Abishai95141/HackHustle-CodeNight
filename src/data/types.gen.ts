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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          category: string
          device_type: string | null
          error_message: string | null
          id: string
          metadata: Json
          occurred_at: string
          resource_id: string | null
          resource_type: string | null
          session_id: string | null
          status: string
          user_agent: string | null
          user_email: string | null
          user_id: string | null
          user_name: string | null
          user_role: Database["public"]["Enums"]["app_role"] | null
        }
        Insert: {
          action: string
          category: string
          device_type?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json
          occurred_at?: string
          resource_id?: string | null
          resource_type?: string | null
          session_id?: string | null
          status?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
          user_role?: Database["public"]["Enums"]["app_role"] | null
        }
        Update: {
          action?: string
          category?: string
          device_type?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json
          occurred_at?: string
          resource_id?: string | null
          resource_type?: string | null
          session_id?: string | null
          status?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
          user_role?: Database["public"]["Enums"]["app_role"] | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_logs: {
        Row: {
          id: string
          scan_type: Database["public"]["Enums"]["scan_type"]
          scanned_by_staff_id: string | null
          timestamp: string | null
          user_id: string
        }
        Insert: {
          id?: string
          scan_type: Database["public"]["Enums"]["scan_type"]
          scanned_by_staff_id?: string | null
          timestamp?: string | null
          user_id: string
        }
        Update: {
          id?: string
          scan_type?: Database["public"]["Enums"]["scan_type"]
          scanned_by_staff_id?: string | null
          timestamp?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_logs_scanned_by_staff_id_fkey"
            columns: ["scanned_by_staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      judge_assignments: {
        Row: {
          id: string
          judge_id: string
          round_name: string
          team_id: string
        }
        Insert: {
          id?: string
          judge_id: string
          round_name?: string
          team_id: string
        }
        Update: {
          id?: string
          judge_id?: string
          round_name?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "judge_assignments_judge_id_fkey"
            columns: ["judge_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "judge_assignments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      judge_scores: {
        Row: {
          created_at: string | null
          id: string
          judge_id: string
          notes: string | null
          round_name: string
          score_feasibility: number | null
          score_innovation: number | null
          score_problem: number | null
          score_prototype: number | null
          score_solution: number | null
          score_trust: number | null
          score_user_experience: number | null
          team_id: string
          total_score: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          judge_id: string
          notes?: string | null
          round_name?: string
          score_feasibility?: number | null
          score_innovation?: number | null
          score_problem?: number | null
          score_prototype?: number | null
          score_solution?: number | null
          score_trust?: number | null
          score_user_experience?: number | null
          team_id: string
          total_score?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          judge_id?: string
          notes?: string | null
          round_name?: string
          score_feasibility?: number | null
          score_innovation?: number | null
          score_problem?: number | null
          score_prototype?: number | null
          score_solution?: number | null
          score_trust?: number | null
          score_user_experience?: number | null
          team_id?: string
          total_score?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "judge_scores_judge_id_fkey"
            columns: ["judge_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "judge_scores_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          created_at: string | null
          deck_filename: string | null
          deck_mime: string | null
          deck_path: string | null
          deck_size_bytes: number | null
          github_url: string | null
          id: string
          team_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          deck_filename?: string | null
          deck_mime?: string | null
          deck_path?: string | null
          deck_size_bytes?: number | null
          github_url?: string | null
          id?: string
          team_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          deck_filename?: string | null
          deck_mime?: string | null
          deck_path?: string | null
          deck_size_bytes?: number | null
          github_url?: string | null
          id?: string
          team_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "submissions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_sessions: {
        Row: {
          created_at: string | null
          display_name: string
          end_time: string | null
          id: string
          is_active: boolean | null
          meal_type: string
          start_time: string | null
        }
        Insert: {
          created_at?: string | null
          display_name: string
          end_time?: string | null
          id?: string
          is_active?: boolean | null
          meal_type: string
          start_time?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string
          end_time?: string | null
          id?: string
          is_active?: boolean | null
          meal_type?: string
          start_time?: string | null
        }
        Relationships: []
      }
      meal_transactions: {
        Row: {
          id: string
          meal_type: string
          scanned_by_staff_id: string | null
          timestamp: string | null
          user_id: string
        }
        Insert: {
          id?: string
          meal_type: string
          scanned_by_staff_id?: string | null
          timestamp?: string | null
          user_id: string
        }
        Update: {
          id?: string
          meal_type?: string
          scanned_by_staff_id?: string | null
          timestamp?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_transactions_scanned_by_staff_id_fkey"
            columns: ["scanned_by_staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          attendance_marked_at: string | null
          attendance_marked_by: string | null
          attendance_note: string | null
          attendance_status: Database["public"]["Enums"]["attendance_status"]
          checked_in_day1: boolean | null
          created_at: string | null
          dietary_restrictions: string | null
          email: string
          id: string
          is_inside_venue: boolean | null
          last_scan_timestamp: string | null
          name: string
          phone: string | null
          qr_token: string
          team_id: string | null
          tshirt_size: string | null
          updated_at: string | null
        }
        Insert: {
          attendance_marked_at?: string | null
          attendance_marked_by?: string | null
          attendance_note?: string | null
          attendance_status?: Database["public"]["Enums"]["attendance_status"]
          checked_in_day1?: boolean | null
          created_at?: string | null
          dietary_restrictions?: string | null
          email: string
          id: string
          is_inside_venue?: boolean | null
          last_scan_timestamp?: string | null
          name: string
          phone?: string | null
          qr_token?: string
          team_id?: string | null
          tshirt_size?: string | null
          updated_at?: string | null
        }
        Update: {
          attendance_marked_at?: string | null
          attendance_marked_by?: string | null
          attendance_note?: string | null
          attendance_status?: Database["public"]["Enums"]["attendance_status"]
          checked_in_day1?: boolean | null
          created_at?: string | null
          dietary_restrictions?: string | null
          email?: string
          id?: string
          is_inside_venue?: boolean | null
          last_scan_timestamp?: string | null
          name?: string
          phone?: string | null
          qr_token?: string
          team_id?: string | null
          tshirt_size?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_attendance_marked_by_fkey"
            columns: ["attendance_marked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      problem_statements: {
        Row: {
          body_md: string
          created_at: string | null
          created_by: string | null
          display_order: number
          domain: Database["public"]["Enums"]["team_domain"]
          id: string
          is_published: boolean
          title: string
          updated_at: string | null
        }
        Insert: {
          body_md: string
          created_at?: string | null
          created_by?: string | null
          display_order?: number
          domain: Database["public"]["Enums"]["team_domain"]
          id?: string
          is_published?: boolean
          title: string
          updated_at?: string | null
        }
        Update: {
          body_md?: string
          created_at?: string | null
          created_by?: string | null
          display_order?: number
          domain?: Database["public"]["Enums"]["team_domain"]
          id?: string
          is_published?: boolean
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "problem_statements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          body: string
          created_at: string | null
          created_by: string | null
          creator_role: Database["public"]["Enums"]["app_role"]
          id: string
          published_at: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["notification_status"]
          target_domains: Database["public"]["Enums"]["team_domain"][] | null
          target_role: Database["public"]["Enums"]["app_role"] | null
          target_team_ids: string[] | null
          target_type: Database["public"]["Enums"]["notification_target"]
          target_user_ids: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          body: string
          created_at?: string | null
          created_by?: string | null
          creator_role: Database["public"]["Enums"]["app_role"]
          id?: string
          published_at?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          target_domains?: Database["public"]["Enums"]["team_domain"][] | null
          target_role?: Database["public"]["Enums"]["app_role"] | null
          target_team_ids?: string[] | null
          target_type: Database["public"]["Enums"]["notification_target"]
          target_user_ids?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          body?: string
          created_at?: string | null
          created_by?: string | null
          creator_role?: Database["public"]["Enums"]["app_role"]
          id?: string
          published_at?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          target_domains?: Database["public"]["Enums"]["team_domain"][] | null
          target_role?: Database["public"]["Enums"]["app_role"] | null
          target_team_ids?: string[] | null
          target_type?: Database["public"]["Enums"]["notification_target"]
          target_user_ids?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      queries: {
        Row: {
          admin_notes: string | null
          category: Database["public"]["Enums"]["query_category"]
          created_at: string | null
          description: string | null
          id: string
          status: Database["public"]["Enums"]["query_status"]
          team_id: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          category?: Database["public"]["Enums"]["query_category"]
          created_at?: string | null
          description?: string | null
          id?: string
          status?: Database["public"]["Enums"]["query_status"]
          team_id?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          category?: Database["public"]["Enums"]["query_category"]
          created_at?: string | null
          description?: string | null
          id?: string
          status?: Database["public"]["Enums"]["query_status"]
          team_id?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "queries_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string | null
          domain: Database["public"]["Enums"]["team_domain"] | null
          id: string
          table_number: string | null
          team_code: string
          team_name: string
          total_score: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          domain?: Database["public"]["Enums"]["team_domain"] | null
          id?: string
          table_number?: string | null
          team_code: string
          team_name: string
          total_score?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          domain?: Database["public"]["Enums"]["team_domain"] | null
          id?: string
          table_number?: string | null
          team_code?: string
          team_name?: string
          total_score?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mark_attendance: {
        Args: {
          _user_id: string
          _status: Database["public"]["Enums"]["attendance_status"]
          _note?: string | null
        }
        Returns: void
      }
      user_team_id: {
        Args: { _uid: string }
        Returns: string | null
      }
      user_team_domain: {
        Args: { _uid: string }
        Returns: Database["public"]["Enums"]["team_domain"] | null
      }
    }
    Enums: {
      app_role: "super_admin" | "participant" | "volunteer" | "judge" | "rsvp" | "query_team"
      attendance_status: "pending" | "checked_in" | "checked_out" | "absent"
      notification_status: "pending" | "approved" | "rejected"
      notification_target: "all" | "teams" | "domains" | "individuals" | "role"
      query_category: "wifi" | "bug" | "mentor_help" | "logistics" | "other"
      query_status: "open" | "in_progress" | "resolved"
      scan_type: "entry" | "exit"
      team_domain: "Fintech" | "Healthcare" | "Logistics"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
