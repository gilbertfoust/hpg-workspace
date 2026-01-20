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
      approvals: {
        Row: {
          created_at: string
          decided_at: string | null
          decision: string | null
          id: string
          notes: string | null
          reviewer_user_id: string
          work_item_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decision?: string | null
          id?: string
          notes?: string | null
          reviewer_user_id: string
          work_item_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decision?: string | null
          id?: string
          notes?: string | null
          reviewer_user_id?: string
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_reviewer_user_id_fkey"
            columns: ["reviewer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action_type: string
          actor_user_id: string | null
          after_json: Json | null
          before_json: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          reason: string | null
        }
        Insert: {
          action_type: string
          actor_user_id?: string | null
          after_json?: Json | null
          before_json?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          reason?: string | null
        }
        Update: {
          action_type?: string
          actor_user_id?: string | null
          after_json?: Json | null
          before_json?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      comments: {
        Row: {
          author_user_id: string
          comment_text: string
          created_at: string
          id: string
          work_item_id: string
        }
        Insert: {
          author_user_id: string
          comment_text: string
          created_at?: string
          id?: string
          work_item_id: string
        }
        Update: {
          author_user_id?: string
          comment_text?: string
          created_at?: string
          id?: string
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_primary: boolean | null
          location: string | null
          name: string
          ngo_id: string | null
          org_type: Database["public"]["Enums"]["org_type"] | null
          phone: string | null
          title: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean | null
          location?: string | null
          name: string
          ngo_id?: string | null
          org_type?: Database["public"]["Enums"]["org_type"] | null
          phone?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean | null
          location?: string | null
          name?: string
          ngo_id?: string | null
          org_type?: Database["public"]["Enums"]["org_type"] | null
          phone?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: Database["public"]["Enums"]["document_category"] | null
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          ngo_id: string | null
          review_notes: string | null
          review_status: string | null
          reviewed_at: string | null
          reviewer_user_id: string | null
          updated_at: string
          uploaded_at: string
          uploaded_by_user_id: string | null
          work_item_id: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["document_category"] | null
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          ngo_id?: string | null
          review_notes?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewer_user_id?: string | null
          updated_at?: string
          uploaded_at?: string
          uploaded_by_user_id?: string | null
          work_item_id?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["document_category"] | null
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          ngo_id?: string | null
          review_notes?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewer_user_id?: string | null
          updated_at?: string
          uploaded_at?: string
          uploaded_by_user_id?: string | null
          work_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_reviewer_user_id_fkey"
            columns: ["reviewer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_user_id_fkey"
            columns: ["uploaded_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          created_at: string
          form_template_id: string
          id: string
          ngo_id: string | null
          payload_json: Json
          submission_status: string | null
          submitted_at: string | null
          submitted_by_user_id: string | null
          updated_at: string
          work_item_id: string | null
        }
        Insert: {
          created_at?: string
          form_template_id: string
          id?: string
          ngo_id?: string | null
          payload_json?: Json
          submission_status?: string | null
          submitted_at?: string | null
          submitted_by_user_id?: string | null
          updated_at?: string
          work_item_id?: string | null
        }
        Update: {
          created_at?: string
          form_template_id?: string
          id?: string
          ngo_id?: string | null
          payload_json?: Json
          submission_status?: string | null
          submitted_at?: string | null
          submitted_by_user_id?: string | null
          updated_at?: string
          work_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_form_template_id_fkey"
            columns: ["form_template_id"]
            isOneToOne: false
            referencedRelation: "form_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_submitted_by_user_id_fkey"
            columns: ["submitted_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      form_templates: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          description: string | null
          id: string
          is_active: boolean | null
          mapping_json: Json | null
          module: Database["public"]["Enums"]["module_type"]
          name: string
          schema_json: Json
          updated_at: string
          version: number | null
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          mapping_json?: Json | null
          module: Database["public"]["Enums"]["module_type"]
          name: string
          schema_json?: Json
          updated_at?: string
          version?: number | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          mapping_json?: Json | null
          module?: Database["public"]["Enums"]["module_type"]
          name?: string
          schema_json?: Json
          updated_at?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "form_templates_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ngos: {
        Row: {
          admin_pm_user_id: string | null
          bundle: string | null
          city: string | null
          common_name: string | null
          country: string | null
          created_at: string
          fiscal_type: Database["public"]["Enums"]["fiscal_type"] | null
          id: string
          legal_name: string
          ngo_coordinator_user_id: string | null
          notes: string | null
          primary_contact_id: string | null
          state_province: string | null
          status: Database["public"]["Enums"]["ngo_status"] | null
          updated_at: string
          website: string | null
        }
        Insert: {
          admin_pm_user_id?: string | null
          bundle?: string | null
          city?: string | null
          common_name?: string | null
          country?: string | null
          created_at?: string
          fiscal_type?: Database["public"]["Enums"]["fiscal_type"] | null
          id?: string
          legal_name: string
          ngo_coordinator_user_id?: string | null
          notes?: string | null
          primary_contact_id?: string | null
          state_province?: string | null
          status?: Database["public"]["Enums"]["ngo_status"] | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          admin_pm_user_id?: string | null
          bundle?: string | null
          city?: string | null
          common_name?: string | null
          country?: string | null
          created_at?: string
          fiscal_type?: Database["public"]["Enums"]["fiscal_type"] | null
          id?: string
          legal_name?: string
          ngo_coordinator_user_id?: string | null
          notes?: string | null
          primary_contact_id?: string | null
          state_province?: string | null
          status?: Database["public"]["Enums"]["ngo_status"] | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ngos_primary_contact"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ngos_admin_pm_user_id_fkey"
            columns: ["admin_pm_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ngos_ngo_coordinator_user_id_fkey"
            columns: ["ngo_coordinator_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      org_units: {
        Row: {
          created_at: string
          department_name: string
          id: string
          lead_user_id: string | null
          sub_department_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_name: string
          id?: string
          lead_user_id?: string | null
          sub_department_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_name?: string
          id?: string
          lead_user_id?: string | null
          sub_department_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_org_units_lead"
            columns: ["lead_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          department_id: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department_id?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "org_units"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          channel: string | null
          created_at: string
          id: string
          remind_at: string
          seen_at: string | null
          status: string | null
          updated_at: string | null
          user_id: string
          work_item_id: string
        }
        Insert: {
          channel?: string | null
          created_at?: string
          id?: string
          remind_at: string
          seen_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
          work_item_id: string
        }
        Update: {
          channel?: string | null
          created_at?: string
          id?: string
          remind_at?: string
          seen_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      template_groups: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
          work_item_templates: Json | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string
          work_item_templates?: Json | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
          work_item_templates?: Json | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      work_items: {
        Row: {
          approval_policy: Json | null
          approval_required: boolean | null
          approver_user_id: string | null
          completed_at: string | null
          created_at: string
          created_by_user_id: string | null
          department_id: string | null
          dependencies: string[] | null
          description: string | null
          due_date: string | null
          evidence_required: boolean | null
          evidence_status: Database["public"]["Enums"]["evidence_status"] | null
          external_visible: boolean | null
          id: string
          module: Database["public"]["Enums"]["module_type"]
          ngo_id: string | null
          owner_user_id: string | null
          priority: Database["public"]["Enums"]["priority_level"] | null
          start_date: string | null
          status: Database["public"]["Enums"]["work_item_status"] | null
          title: string
          trello_card_id: string | null
          trello_sync: boolean | null
          type: string | null
          updated_at: string
        }
        Insert: {
          approval_policy?: Json | null
          approval_required?: boolean | null
          approver_user_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          department_id?: string | null
          dependencies?: string[] | null
          description?: string | null
          due_date?: string | null
          evidence_required?: boolean | null
          evidence_status?:
            | Database["public"]["Enums"]["evidence_status"]
            | null
          external_visible?: boolean | null
          id?: string
          module: Database["public"]["Enums"]["module_type"]
          ngo_id?: string | null
          owner_user_id?: string | null
          priority?: Database["public"]["Enums"]["priority_level"] | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["work_item_status"] | null
          title: string
          trello_card_id?: string | null
          trello_sync?: boolean | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          approval_policy?: Json | null
          approval_required?: boolean | null
          approver_user_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          department_id?: string | null
          dependencies?: string[] | null
          description?: string | null
          due_date?: string | null
          evidence_required?: boolean | null
          evidence_status?:
            | Database["public"]["Enums"]["evidence_status"]
            | null
          external_visible?: boolean | null
          id?: string
          module?: Database["public"]["Enums"]["module_type"]
          ngo_id?: string | null
          owner_user_id?: string | null
          priority?: Database["public"]["Enums"]["priority_level"] | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["work_item_status"] | null
          title?: string
          trello_card_id?: string | null
          trello_sync?: boolean | null
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_items_approver_user_id_fkey"
            columns: ["approver_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "org_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_department: { Args: never; Returns: string }
      get_my_ngo_id: { Args: never; Returns: string }
      get_my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_ngo_access: { Args: { _ngo_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_internal_user: { Args: never; Returns: boolean }
      is_management: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "admin_pm"
        | "ngo_coordinator"
        | "department_lead"
        | "staff_member"
        | "executive_secretariat"
        | "external_ngo"
      document_category:
        | "onboarding"
        | "compliance"
        | "finance"
        | "hr"
        | "marketing"
        | "communications"
        | "program"
        | "curriculum"
        | "it"
        | "legal"
        | "other"
      evidence_status:
        | "missing"
        | "uploaded"
        | "under_review"
        | "approved"
        | "rejected"
      fiscal_type: "model_a" | "model_c" | "other"
      module_type:
        | "ngo_coordination"
        | "administration"
        | "operations"
        | "program"
        | "curriculum"
        | "development"
        | "partnership"
        | "marketing"
        | "communications"
        | "hr"
        | "it"
        | "finance"
        | "legal"
      ngo_status:
        | "prospect"
        | "onboarding"
        | "active"
        | "at_risk"
        | "offboarding"
        | "closed"
      org_type: "ngo" | "partner" | "funder" | "vendor" | "applicant"
      priority_level: "low" | "medium" | "high"
      work_item_status:
        | "draft"
        | "not_started"
        | "in_progress"
        | "waiting_on_ngo"
        | "waiting_on_hpg"
        | "submitted"
        | "under_review"
        | "approved"
        | "rejected"
        | "complete"
        | "canceled"
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
      app_role: [
        "super_admin",
        "admin_pm",
        "ngo_coordinator",
        "department_lead",
        "staff_member",
        "executive_secretariat",
        "external_ngo",
      ],
      document_category: [
        "onboarding",
        "compliance",
        "finance",
        "hr",
        "marketing",
        "communications",
        "program",
        "curriculum",
        "it",
        "legal",
        "other",
      ],
      evidence_status: [
        "missing",
        "uploaded",
        "under_review",
        "approved",
        "rejected",
      ],
      fiscal_type: ["model_a", "model_c", "other"],
      module_type: [
        "ngo_coordination",
        "administration",
        "operations",
        "program",
        "curriculum",
        "development",
        "partnership",
        "marketing",
        "communications",
        "hr",
        "it",
        "finance",
        "legal",
      ],
      ngo_status: [
        "prospect",
        "onboarding",
        "active",
        "at_risk",
        "offboarding",
        "closed",
      ],
      org_type: ["ngo", "partner", "funder", "vendor", "applicant"],
      priority_level: ["low", "medium", "high"],
      work_item_status: [
        "draft",
        "not_started",
        "in_progress",
        "waiting_on_ngo",
        "waiting_on_hpg",
        "submitted",
        "under_review",
        "approved",
        "rejected",
        "complete",
        "canceled",
      ],
    },
  },
} as const
