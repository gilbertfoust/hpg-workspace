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
      access_requests: {
        Row: {
          created_at: string
          id: string
          justification: string
          priority: string
          request_type: string
          requested_by_user_id: string
          status: string
          target_user: string
          updated_at: string
          work_item_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          justification?: string
          priority?: string
          request_type: string
          requested_by_user_id: string
          status?: string
          target_user: string
          updated_at?: string
          work_item_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          justification?: string
          priority?: string
          request_type?: string
          requested_by_user_id?: string
          status?: string
          target_user?: string
          updated_at?: string
          work_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_requests_requested_by_user_id_fkey"
            columns: ["requested_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_requests_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          account_description: string | null
          balance_sheet_section: string | null
          cash_flow_section: string | null
          code: string
          created_at: string
          financial_statement_type: string | null
          id: string
          income_statement_section: string | null
          is_active: boolean
          is_contra_account: boolean | null
          name: string
          ngo_id: string | null
          normal_balance: string | null
          parent_account_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          account_description?: string | null
          balance_sheet_section?: string | null
          cash_flow_section?: string | null
          code: string
          created_at?: string
          financial_statement_type?: string | null
          id?: string
          income_statement_section?: string | null
          is_active?: boolean
          is_contra_account?: boolean | null
          name: string
          ngo_id?: string | null
          normal_balance?: string | null
          parent_account_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          account_description?: string | null
          balance_sheet_section?: string | null
          cash_flow_section?: string | null
          code?: string
          created_at?: string
          financial_statement_type?: string | null
          id?: string
          income_statement_section?: string | null
          is_active?: boolean
          is_contra_account?: boolean | null
          name?: string
          ngo_id?: string | null
          normal_balance?: string | null
          parent_account_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_parent_account_id_fkey"
            columns: ["parent_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      actuals: {
        Row: {
          amount: number
          category_id: string
          created_at: string
          created_by_user_id: string | null
          fiscal_period_id: string
          id: string
          ngo_id: string
          source: string
          supporting_document_url: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          category_id: string
          created_at?: string
          created_by_user_id?: string | null
          fiscal_period_id: string
          id?: string
          ngo_id: string
          source?: string
          supporting_document_url?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string
          created_at?: string
          created_by_user_id?: string | null
          fiscal_period_id?: string
          id?: string
          ngo_id?: string
          source?: string
          supporting_document_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "actuals_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actuals_fiscal_period_id_fkey"
            columns: ["fiscal_period_id"]
            isOneToOne: false
            referencedRelation: "fiscal_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actuals_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
        ]
      }
      allocation_results: {
        Row: {
          allocated_amount: number
          allocation_rule_id: string
          allocation_run_id: string
          created_at: string | null
          details_json: Json | null
          id: string
          journal_transaction_id: string | null
          source_cost_center_id: string | null
          source_usage_entry_id: string
          target_cost_center_id: string
        }
        Insert: {
          allocated_amount?: number
          allocation_rule_id: string
          allocation_run_id: string
          created_at?: string | null
          details_json?: Json | null
          id?: string
          journal_transaction_id?: string | null
          source_cost_center_id?: string | null
          source_usage_entry_id: string
          target_cost_center_id: string
        }
        Update: {
          allocated_amount?: number
          allocation_rule_id?: string
          allocation_run_id?: string
          created_at?: string | null
          details_json?: Json | null
          id?: string
          journal_transaction_id?: string | null
          source_cost_center_id?: string | null
          source_usage_entry_id?: string
          target_cost_center_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "allocation_results_allocation_rule_id_fkey"
            columns: ["allocation_rule_id"]
            isOneToOne: false
            referencedRelation: "allocation_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocation_results_allocation_run_id_fkey"
            columns: ["allocation_run_id"]
            isOneToOne: false
            referencedRelation: "allocation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocation_results_journal_transaction_id_fkey"
            columns: ["journal_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocation_results_source_cost_center_id_fkey"
            columns: ["source_cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocation_results_source_usage_entry_id_fkey"
            columns: ["source_usage_entry_id"]
            isOneToOne: false
            referencedRelation: "usage_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocation_results_target_cost_center_id_fkey"
            columns: ["target_cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      allocation_rules: {
        Row: {
          basis_type: string
          created_at: string | null
          effective_end_date: string | null
          effective_start_date: string
          expense_account_id: string | null
          id: string
          is_active: boolean | null
          name: string
          offset_account_id: string | null
          rule_config_json: Json | null
          source_cost_center_id: string | null
          target_scope_type: string
          updated_at: string | null
        }
        Insert: {
          basis_type: string
          created_at?: string | null
          effective_end_date?: string | null
          effective_start_date: string
          expense_account_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          offset_account_id?: string | null
          rule_config_json?: Json | null
          source_cost_center_id?: string | null
          target_scope_type: string
          updated_at?: string | null
        }
        Update: {
          basis_type?: string
          created_at?: string | null
          effective_end_date?: string | null
          effective_start_date?: string
          expense_account_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          offset_account_id?: string | null
          rule_config_json?: Json | null
          source_cost_center_id?: string | null
          target_scope_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "allocation_rules_expense_account_id_fkey"
            columns: ["expense_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocation_rules_offset_account_id_fkey"
            columns: ["offset_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocation_rules_source_cost_center_id_fkey"
            columns: ["source_cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      allocation_runs: {
        Row: {
          created_at: string | null
          created_by_user_id: string | null
          fiscal_period_id: string
          id: string
          name: string
          notes: string | null
          posted_at: string | null
          status: string
        }
        Insert: {
          created_at?: string | null
          created_by_user_id?: string | null
          fiscal_period_id: string
          id?: string
          name: string
          notes?: string | null
          posted_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string | null
          created_by_user_id?: string | null
          fiscal_period_id?: string
          id?: string
          name?: string
          notes?: string | null
          posted_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "allocation_runs_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocation_runs_fiscal_period_id_fkey"
            columns: ["fiscal_period_id"]
            isOneToOne: false
            referencedRelation: "fiscal_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      applicants: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          role_applied_for: string | null
          stage: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          role_applied_for?: string | null
          stage?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          role_applied_for?: string | null
          stage?: string
        }
        Relationships: []
      }
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
      asset_depreciation: {
        Row: {
          accumulated_depreciation: number
          asset_id: string
          book_value: number
          created_at: string
          depreciation_amount: number
          id: string
          ngo_id: string
          period_date: string
          period_label: string
          transaction_id: string | null
        }
        Insert: {
          accumulated_depreciation?: number
          asset_id: string
          book_value?: number
          created_at?: string
          depreciation_amount?: number
          id?: string
          ngo_id: string
          period_date: string
          period_label: string
          transaction_id?: string | null
        }
        Update: {
          accumulated_depreciation?: number
          asset_id?: string
          book_value?: number
          created_at?: string
          depreciation_amount?: number
          id?: string
          ngo_id?: string
          period_date?: string
          period_label?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_depreciation_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_depreciation_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_depreciation_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_maintenance: {
        Row: {
          asset_id: string
          assigned_to_user_id: string | null
          completed_date: string | null
          cost: number | null
          created_at: string
          description: string
          id: string
          maintenance_type: string
          ngo_id: string
          notes: string | null
          scheduled_date: string | null
          status: string
          updated_at: string
          vendor_org_id: string | null
        }
        Insert: {
          asset_id: string
          assigned_to_user_id?: string | null
          completed_date?: string | null
          cost?: number | null
          created_at?: string
          description: string
          id?: string
          maintenance_type?: string
          ngo_id: string
          notes?: string | null
          scheduled_date?: string | null
          status?: string
          updated_at?: string
          vendor_org_id?: string | null
        }
        Update: {
          asset_id?: string
          assigned_to_user_id?: string | null
          completed_date?: string | null
          cost?: number | null
          created_at?: string
          description?: string
          id?: string
          maintenance_type?: string
          ngo_id?: string
          notes?: string | null
          scheduled_date?: string | null
          status?: string
          updated_at?: string
          vendor_org_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_maintenance_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_maintenance_assigned_to_user_id_fkey"
            columns: ["assigned_to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_maintenance_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_maintenance_vendor_org_id_fkey"
            columns: ["vendor_org_id"]
            isOneToOne: false
            referencedRelation: "crm_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          account_id: string | null
          acquisition_cost: number
          acquisition_date: string | null
          asset_tag: string | null
          assigned_to_staff_id: string | null
          category: string
          created_at: string
          depreciation_method: string
          description: string | null
          disposed_date: string | null
          disposed_value: number | null
          id: string
          location: string | null
          name: string
          ngo_id: string
          notes: string | null
          salvage_value: number
          serial_number: string | null
          status: string
          updated_at: string
          useful_life_months: number | null
        }
        Insert: {
          account_id?: string | null
          acquisition_cost?: number
          acquisition_date?: string | null
          asset_tag?: string | null
          assigned_to_staff_id?: string | null
          category?: string
          created_at?: string
          depreciation_method?: string
          description?: string | null
          disposed_date?: string | null
          disposed_value?: number | null
          id?: string
          location?: string | null
          name: string
          ngo_id: string
          notes?: string | null
          salvage_value?: number
          serial_number?: string | null
          status?: string
          updated_at?: string
          useful_life_months?: number | null
        }
        Update: {
          account_id?: string | null
          acquisition_cost?: number
          acquisition_date?: string | null
          asset_tag?: string | null
          assigned_to_staff_id?: string | null
          category?: string
          created_at?: string
          depreciation_method?: string
          description?: string | null
          disposed_date?: string | null
          disposed_value?: number | null
          id?: string
          location?: string | null
          name?: string
          ngo_id?: string
          notes?: string | null
          salvage_value?: number
          serial_number?: string | null
          status?: string
          updated_at?: string
          useful_life_months?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_assigned_to_staff_id_fkey"
            columns: ["assigned_to_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
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
      bank_reconciliation_items: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          item_date: string
          item_type: string
          linked_transaction_id: string | null
          reconciliation_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          item_date?: string
          item_type?: string
          linked_transaction_id?: string | null
          reconciliation_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          item_date?: string
          item_type?: string
          linked_transaction_id?: string | null
          reconciliation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_reconciliation_items_linked_transaction_id_fkey"
            columns: ["linked_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliation_items_reconciliation_id_fkey"
            columns: ["reconciliation_id"]
            isOneToOne: false
            referencedRelation: "bank_reconciliations"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_reconciliations: {
        Row: {
          adjusted_balance: number
          bank_account_id: string
          created_at: string
          fiscal_period_id: string
          id: string
          ngo_id: string
          notes: string | null
          starting_balance: number
          status: string
          updated_at: string
        }
        Insert: {
          adjusted_balance?: number
          bank_account_id: string
          created_at?: string
          fiscal_period_id: string
          id?: string
          ngo_id: string
          notes?: string | null
          starting_balance?: number
          status?: string
          updated_at?: string
        }
        Update: {
          adjusted_balance?: number
          bank_account_id?: string
          created_at?: string
          fiscal_period_id?: string
          id?: string
          ngo_id?: string
          notes?: string | null
          starting_balance?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_reconciliations_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliations_fiscal_period_id_fkey"
            columns: ["fiscal_period_id"]
            isOneToOne: false
            referencedRelation: "fiscal_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliations_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_line_items: {
        Row: {
          account_id: string | null
          amount: number
          bill_id: string
          created_at: string
          description: string
          id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          account_id?: string | null
          amount?: number
          bill_id: string
          created_at?: string
          description?: string
          id?: string
          quantity?: number
          unit_price?: number
        }
        Update: {
          account_id?: string | null
          amount?: number
          bill_id?: string
          created_at?: string
          description?: string
          id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "bill_line_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_line_items_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          ap_account_id: string | null
          bill_date: string
          bill_number: string
          created_at: string
          due_date: string
          fiscal_period_id: string | null
          id: string
          ngo_id: string
          notes: string | null
          paid_date: string | null
          payment_transaction_id: string | null
          status: string
          subtotal: number
          tax_amount: number
          total: number
          transaction_id: string | null
          updated_at: string
          vendor_name: string
          vendor_org_id: string | null
        }
        Insert: {
          ap_account_id?: string | null
          bill_date?: string
          bill_number: string
          created_at?: string
          due_date: string
          fiscal_period_id?: string | null
          id?: string
          ngo_id: string
          notes?: string | null
          paid_date?: string | null
          payment_transaction_id?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          total?: number
          transaction_id?: string | null
          updated_at?: string
          vendor_name: string
          vendor_org_id?: string | null
        }
        Update: {
          ap_account_id?: string | null
          bill_date?: string
          bill_number?: string
          created_at?: string
          due_date?: string
          fiscal_period_id?: string | null
          id?: string
          ngo_id?: string
          notes?: string | null
          paid_date?: string | null
          payment_transaction_id?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          total?: number
          transaction_id?: string | null
          updated_at?: string
          vendor_name?: string
          vendor_org_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bills_ap_account_id_fkey"
            columns: ["ap_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_fiscal_period_id_fkey"
            columns: ["fiscal_period_id"]
            isOneToOne: false
            referencedRelation: "fiscal_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_payment_transaction_id_fkey"
            columns: ["payment_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_vendor_org_id_fkey"
            columns: ["vendor_org_id"]
            isOneToOne: false
            referencedRelation: "crm_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_categories: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          ngo_id: string | null
          type: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          ngo_id?: string | null
          type: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          ngo_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_categories_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          amount: number
          category_id: string
          created_at: string
          created_by_user_id: string | null
          fiscal_period_id: string
          id: string
          ngo_id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          category_id: string
          created_at?: string
          created_by_user_id?: string | null
          fiscal_period_id: string
          id?: string
          ngo_id: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string
          created_at?: string
          created_by_user_id?: string | null
          fiscal_period_id?: string
          id?: string
          ngo_id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_fiscal_period_id_fkey"
            columns: ["fiscal_period_id"]
            isOneToOne: false
            referencedRelation: "fiscal_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_flow_forecast_lines: {
        Row: {
          amount: number
          category_label: string
          created_at: string
          forecast_id: string
          id: string
          line_type: string
          month_index: number
        }
        Insert: {
          amount?: number
          category_label?: string
          created_at?: string
          forecast_id: string
          id?: string
          line_type?: string
          month_index?: number
        }
        Update: {
          amount?: number
          category_label?: string
          created_at?: string
          forecast_id?: string
          id?: string
          line_type?: string
          month_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "cash_flow_forecast_lines_forecast_id_fkey"
            columns: ["forecast_id"]
            isOneToOne: false
            referencedRelation: "cash_flow_forecasts"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_flow_forecasts: {
        Row: {
          created_at: string
          id: string
          month_count: number
          name: string
          ngo_id: string
          start_month: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          month_count?: number
          name: string
          ngo_id: string
          start_month: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          month_count?: number
          name?: string
          ngo_id?: string
          start_month?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_flow_forecasts_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
        ]
      }
      closing_entries: {
        Row: {
          account_id: string
          created_at: string
          created_by_user_id: string | null
          credit: number
          debit: number
          fiscal_year: number
          id: string
          memo: string | null
          ngo_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by_user_id?: string | null
          credit?: number
          debit?: number
          fiscal_year: number
          id?: string
          memo?: string | null
          ngo_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by_user_id?: string | null
          credit?: number
          debit?: number
          fiscal_year?: number
          id?: string
          memo?: string | null
          ngo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "closing_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "closing_entries_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
        ]
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
      compliance_packages: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          data_json: Json
          file_path: string | null
          fiscal_year: number
          id: string
          ngo_id: string
          package_type: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          data_json?: Json
          file_path?: string | null
          fiscal_year: number
          id?: string
          ngo_id: string
          package_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          data_json?: Json
          file_path?: string | null
          fiscal_year?: number
          id?: string
          ngo_id?: string
          package_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_packages_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
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
      controller_alerts: {
        Row: {
          context_json: Json | null
          created_at: string
          id: string
          message: string
          module: string
          ngo_id: string | null
          resolved_at: string | null
          severity: string
          status: string
        }
        Insert: {
          context_json?: Json | null
          created_at?: string
          id?: string
          message: string
          module: string
          ngo_id?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
        }
        Update: {
          context_json?: Json | null
          created_at?: string
          id?: string
          message?: string
          module?: string
          ngo_id?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "controller_alerts_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_centers: {
        Row: {
          code: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          ngo_id: string | null
          parent_cost_center_id: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          ngo_id?: string | null
          parent_cost_center_id?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          ngo_id?: string | null
          parent_cost_center_id?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_centers_parent_cost_center_id_fkey"
            columns: ["parent_cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      country_compliance_profiles: {
        Row: {
          annual_audit_required: boolean | null
          country_code: string
          country_name: string
          created_at: string
          filing_deadline: string | null
          id: string
          is_active: boolean | null
          notes: string | null
          registration_required: boolean | null
          regulatory_body: string | null
          requirements_json: Json | null
          tax_filing_required: boolean | null
          updated_at: string
        }
        Insert: {
          annual_audit_required?: boolean | null
          country_code: string
          country_name: string
          created_at?: string
          filing_deadline?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          registration_required?: boolean | null
          regulatory_body?: string | null
          requirements_json?: Json | null
          tax_filing_required?: boolean | null
          updated_at?: string
        }
        Update: {
          annual_audit_required?: boolean | null
          country_code?: string
          country_name?: string
          created_at?: string
          filing_deadline?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          registration_required?: boolean | null
          regulatory_body?: string | null
          requirements_json?: Json | null
          tax_filing_required?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      crm_contacts: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          department: string | null
          email: string | null
          first_name: string
          id: string
          is_active: boolean
          is_primary: boolean
          last_name: string
          notes: string | null
          organization_id: string | null
          phone: string | null
          tags: string[] | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          department?: string | null
          email?: string | null
          first_name: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          last_name: string
          notes?: string | null
          organization_id?: string | null
          phone?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          department?: string | null
          email?: string | null
          first_name?: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          last_name?: string
          notes?: string | null
          organization_id?: string | null
          phone?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_contacts_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deals: {
        Row: {
          actual_close_date: string | null
          amount: number | null
          assigned_user_id: string | null
          contact_id: string | null
          created_at: string
          created_by_user_id: string | null
          deal_type: string
          expected_close_date: string | null
          id: string
          ngo_id: string | null
          notes: string | null
          organization_id: string | null
          probability: number | null
          stage: string
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          actual_close_date?: string | null
          amount?: number | null
          assigned_user_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          deal_type?: string
          expected_close_date?: string | null
          id?: string
          ngo_id?: string | null
          notes?: string | null
          organization_id?: string | null
          probability?: number | null
          stage?: string
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          actual_close_date?: string | null
          amount?: number | null
          assigned_user_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          deal_type?: string
          expected_close_date?: string | null
          id?: string
          ngo_id?: string | null
          notes?: string | null
          organization_id?: string | null
          probability?: number | null
          stage?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_deals_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_interactions: {
        Row: {
          contact_id: string | null
          created_at: string
          description: string | null
          id: string
          interaction_date: string
          interaction_type: string
          logged_by_user_id: string | null
          organization_id: string | null
          subject: string
          updated_at: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          interaction_date?: string
          interaction_type?: string
          logged_by_user_id?: string | null
          organization_id?: string | null
          subject: string
          updated_at?: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          interaction_date?: string
          interaction_type?: string
          logged_by_user_id?: string | null
          organization_id?: string | null
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_interactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_interactions_logged_by_user_id_fkey"
            columns: ["logged_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_interactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_organizations: {
        Row: {
          address: string | null
          annual_revenue: number | null
          city: string | null
          country: string | null
          created_at: string
          created_by_user_id: string | null
          description: string | null
          email: string | null
          employee_count: number | null
          id: string
          industry: string | null
          is_active: boolean
          name: string
          org_type: string
          phone: string | null
          state_province: string | null
          tags: string[] | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          annual_revenue?: number | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          email?: string | null
          employee_count?: number | null
          id?: string
          industry?: string | null
          is_active?: boolean
          name: string
          org_type?: string
          phone?: string | null
          state_province?: string | null
          tags?: string[] | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          annual_revenue?: number | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          email?: string | null
          employee_count?: number | null
          id?: string
          industry?: string | null
          is_active?: boolean
          name?: string
          org_type?: string
          phone?: string | null
          state_province?: string | null
          tags?: string[] | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_organizations_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_extraction_logs: {
        Row: {
          confidence_score: number | null
          created_at: string
          extracted_data_json: Json
          id: string
          intake_id: string
          raw_text: string | null
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          extracted_data_json?: Json
          id?: string
          intake_id: string
          raw_text?: string | null
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          extracted_data_json?: Json
          id?: string
          intake_id?: string
          raw_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_extraction_logs_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "document_intake_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      document_intake_submissions: {
        Row: {
          created_at: string
          extracted_data_json: Json
          file_name: string | null
          file_path: string | null
          fiscal_period_id: string | null
          id: string
          ngo_id: string
          reviewer_notes: string | null
          reviewer_user_id: string | null
          status: string
          submitted_by_user_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          extracted_data_json?: Json
          file_name?: string | null
          file_path?: string | null
          fiscal_period_id?: string | null
          id?: string
          ngo_id: string
          reviewer_notes?: string | null
          reviewer_user_id?: string | null
          status?: string
          submitted_by_user_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          extracted_data_json?: Json
          file_name?: string | null
          file_path?: string | null
          fiscal_period_id?: string | null
          id?: string
          ngo_id?: string
          reviewer_notes?: string | null
          reviewer_user_id?: string | null
          status?: string
          submitted_by_user_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_intake_submissions_fiscal_period_id_fkey"
            columns: ["fiscal_period_id"]
            isOneToOne: false
            referencedRelation: "fiscal_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_intake_submissions_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
        ]
      }
      document_to_transaction_links: {
        Row: {
          created_at: string
          id: string
          intake_id: string
          transaction_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          intake_id: string
          transaction_id: string
        }
        Update: {
          created_at?: string
          id?: string
          intake_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_to_transaction_links_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "document_intake_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_to_transaction_links_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
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
      esign_documents: {
        Row: {
          created_at: string
          id: string
          original_filename: string
          owner_id: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          original_filename: string
          owner_id: string
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          original_filename?: string
          owner_id?: string
          storage_path?: string
        }
        Relationships: []
      }
      financial_review_status: {
        Row: {
          comments: string | null
          created_at: string
          fiscal_period_id: string
          id: string
          last_updated_at: string
          ngo_id: string
          reviewer_id: string | null
          status: string
        }
        Insert: {
          comments?: string | null
          created_at?: string
          fiscal_period_id: string
          id?: string
          last_updated_at?: string
          ngo_id: string
          reviewer_id?: string | null
          status?: string
        }
        Update: {
          comments?: string | null
          created_at?: string
          fiscal_period_id?: string
          id?: string
          last_updated_at?: string
          ngo_id?: string
          reviewer_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_review_status_fiscal_period_id_fkey"
            columns: ["fiscal_period_id"]
            isOneToOne: false
            referencedRelation: "fiscal_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_review_status_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_statements: {
        Row: {
          created_at: string
          data_json: Json
          fiscal_year: number
          generated_by_user_id: string | null
          id: string
          ngo_id: string
          statement_type: string
        }
        Insert: {
          created_at?: string
          data_json?: Json
          fiscal_year: number
          generated_by_user_id?: string | null
          id?: string
          ngo_id: string
          statement_type: string
        }
        Update: {
          created_at?: string
          data_json?: Json
          fiscal_year?: number
          generated_by_user_id?: string | null
          id?: string
          ngo_id?: string
          statement_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_statements_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_periods: {
        Row: {
          created_at: string
          currency_code: string | null
          end_date: string
          id: string
          is_locked: boolean
          label: string
          ngo_id: string
          period_type: string
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency_code?: string | null
          end_date: string
          id?: string
          is_locked?: boolean
          label: string
          ngo_id: string
          period_type: string
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency_code?: string | null
          end_date?: string
          id?: string
          is_locked?: boolean
          label?: string
          ngo_id?: string
          period_type?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_periods_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
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
      funders: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          type: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          type?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          type?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      fx_rates: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          effective_date: string
          from_currency: string
          id: string
          rate: number
          source: string | null
          to_currency: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          effective_date?: string
          from_currency?: string
          id?: string
          rate: number
          source?: string | null
          to_currency: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          effective_date?: string
          from_currency?: string
          id?: string
          rate?: number
          source?: string | null
          to_currency?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fx_rates_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      grant_applications: {
        Row: {
          amount_awarded: number | null
          amount_requested: number | null
          assigned_user_id: string | null
          awarded_at: string | null
          closed_at: string | null
          created_at: string
          id: string
          ngo_id: string
          notes: string | null
          opportunity_id: string | null
          reporting_due_at: string | null
          stage: string
          submitted_at: string | null
          title: string
          updated_at: string
          work_item_id: string | null
        }
        Insert: {
          amount_awarded?: number | null
          amount_requested?: number | null
          assigned_user_id?: string | null
          awarded_at?: string | null
          closed_at?: string | null
          created_at?: string
          id?: string
          ngo_id: string
          notes?: string | null
          opportunity_id?: string | null
          reporting_due_at?: string | null
          stage?: string
          submitted_at?: string | null
          title: string
          updated_at?: string
          work_item_id?: string | null
        }
        Update: {
          amount_awarded?: number | null
          amount_requested?: number | null
          assigned_user_id?: string | null
          awarded_at?: string | null
          closed_at?: string | null
          created_at?: string
          id?: string
          ngo_id?: string
          notes?: string | null
          opportunity_id?: string | null
          reporting_due_at?: string | null
          stage?: string
          submitted_at?: string | null
          title?: string
          updated_at?: string
          work_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grant_applications_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grant_applications_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grant_applications_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "grant_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grant_applications_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      grant_opportunities: {
        Row: {
          country: string | null
          created_at: string
          cycle: string | null
          deadline: string | null
          description: string | null
          eligibility_criteria: string | null
          focus_areas: string[] | null
          id: string
          max_award: number | null
          min_award: number | null
          notes: string | null
          region: string | null
          source_id: string | null
          status: string
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          cycle?: string | null
          deadline?: string | null
          description?: string | null
          eligibility_criteria?: string | null
          focus_areas?: string[] | null
          id?: string
          max_award?: number | null
          min_award?: number | null
          notes?: string | null
          region?: string | null
          source_id?: string | null
          status?: string
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          cycle?: string | null
          deadline?: string | null
          description?: string | null
          eligibility_criteria?: string | null
          focus_areas?: string[] | null
          id?: string
          max_award?: number | null
          min_award?: number | null
          notes?: string | null
          region?: string | null
          source_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grant_opportunities_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "grant_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      grant_restriction_rules: {
        Row: {
          allowed_account_ids_json: Json | null
          cost_center_id: string | null
          created_at: string | null
          grant_application_id: string | null
          id: string
          is_active: boolean | null
          notes: string | null
          restricted_categories_json: Json | null
        }
        Insert: {
          allowed_account_ids_json?: Json | null
          cost_center_id?: string | null
          created_at?: string | null
          grant_application_id?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          restricted_categories_json?: Json | null
        }
        Update: {
          allowed_account_ids_json?: Json | null
          cost_center_id?: string | null
          created_at?: string | null
          grant_application_id?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          restricted_categories_json?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "grant_restriction_rules_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grant_restriction_rules_grant_application_id_fkey"
            columns: ["grant_application_id"]
            isOneToOne: false
            referencedRelation: "grant_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      grant_sources: {
        Row: {
          country: string | null
          created_at: string
          description: string | null
          focus_areas: string[] | null
          funder_type: string
          id: string
          is_active: boolean
          max_award: number | null
          min_award: number | null
          name: string
          region: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          description?: string | null
          focus_areas?: string[] | null
          funder_type?: string
          id?: string
          is_active?: boolean
          max_award?: number | null
          min_award?: number | null
          name: string
          region?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          description?: string | null
          focus_areas?: string[] | null
          funder_type?: string
          id?: string
          is_active?: boolean
          max_award?: number | null
          min_award?: number | null
          name?: string
          region?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      hr_checklist_assignments: {
        Row: {
          assigned_at: string
          checklist_id: string
          completed_at: string | null
          id: string
          item_statuses: Json
          staff_id: string
          status: string
        }
        Insert: {
          assigned_at?: string
          checklist_id: string
          completed_at?: string | null
          id?: string
          item_statuses?: Json
          staff_id: string
          status?: string
        }
        Update: {
          assigned_at?: string
          checklist_id?: string
          completed_at?: string | null
          id?: string
          item_statuses?: Json
          staff_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_checklist_assignments_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "hr_checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_checklist_assignments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_checklists: {
        Row: {
          checklist_type: string
          created_at: string
          id: string
          items: Json
          name: string
          ngo_id: string | null
          updated_at: string
        }
        Insert: {
          checklist_type?: string
          created_at?: string
          id?: string
          items?: Json
          name: string
          ngo_id?: string | null
          updated_at?: string
        }
        Update: {
          checklist_type?: string
          created_at?: string
          id?: string
          items?: Json
          name?: string
          ngo_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_checklists_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
        ]
      }
      inter_ngo_transfers: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by_user_id: string | null
          completed_at: string | null
          created_at: string
          created_by_user_id: string | null
          currency: string
          from_ngo_id: string
          id: string
          reason: string | null
          status: string
          to_ngo_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          approved_at?: string | null
          approved_by_user_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          currency?: string
          from_ngo_id: string
          id?: string
          reason?: string | null
          status?: string
          to_ngo_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by_user_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          currency?: string
          from_ngo_id?: string
          id?: string
          reason?: string | null
          status?: string
          to_ngo_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inter_ngo_transfers_approved_by_user_id_fkey"
            columns: ["approved_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inter_ngo_transfers_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inter_ngo_transfers_from_ngo_id_fkey"
            columns: ["from_ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inter_ngo_transfers_to_ngo_id_fkey"
            columns: ["to_ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_charges: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          fiscal_period_id: string
          from_cost_center_id: string
          id: string
          journal_transaction_id: string | null
          status: string
          to_cost_center_id: string
        }
        Insert: {
          amount?: number
          created_at?: string | null
          description?: string | null
          fiscal_period_id: string
          from_cost_center_id: string
          id?: string
          journal_transaction_id?: string | null
          status?: string
          to_cost_center_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          fiscal_period_id?: string
          from_cost_center_id?: string
          id?: string
          journal_transaction_id?: string | null
          status?: string
          to_cost_center_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_charges_fiscal_period_id_fkey"
            columns: ["fiscal_period_id"]
            isOneToOne: false
            referencedRelation: "fiscal_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_charges_from_cost_center_id_fkey"
            columns: ["from_cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_charges_journal_transaction_id_fkey"
            columns: ["journal_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_charges_to_cost_center_id_fkey"
            columns: ["to_cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      interviews: {
        Row: {
          applicant_id: string
          created_at: string
          id: string
          interview_date: string
          interviewer_user_id: string | null
          notes: string | null
          recommendation: string | null
          rubric_scores: Json | null
        }
        Insert: {
          applicant_id: string
          created_at?: string
          id?: string
          interview_date: string
          interviewer_user_id?: string | null
          notes?: string | null
          recommendation?: string | null
          rubric_scores?: Json | null
        }
        Update: {
          applicant_id?: string
          created_at?: string
          id?: string
          interview_date?: string
          interviewer_user_id?: string | null
          notes?: string | null
          recommendation?: string | null
          rubric_scores?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "interviews_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "applicants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_interviewer_user_id_fkey"
            columns: ["interviewer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          location: string | null
          name: string
          ngo_id: string
          notes: string | null
          quantity_on_hand: number
          reorder_point: number | null
          reorder_quantity: number | null
          sku: string | null
          unit_cost: number
          unit_of_measure: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          name: string
          ngo_id: string
          notes?: string | null
          quantity_on_hand?: number
          reorder_point?: number | null
          reorder_quantity?: number | null
          sku?: string | null
          unit_cost?: number
          unit_of_measure?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          name?: string
          ngo_id?: string
          notes?: string | null
          quantity_on_hand?: number
          reorder_point?: number | null
          reorder_quantity?: number | null
          sku?: string | null
          unit_cost?: number
          unit_of_measure?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          account_id: string | null
          amount: number
          created_at: string
          description: string
          id: string
          invoice_id: string
          quantity: number
          tax_rate_id: string | null
          unit_price: number
        }
        Insert: {
          account_id?: string | null
          amount?: number
          created_at?: string
          description?: string
          id?: string
          invoice_id: string
          quantity?: number
          tax_rate_id?: string | null
          unit_price?: number
        }
        Update: {
          account_id?: string | null
          amount?: number
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number
          tax_rate_id?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_tax_rate_id_fkey"
            columns: ["tax_rate_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          ar_account_id: string | null
          created_at: string
          customer_email: string | null
          customer_name: string
          due_date: string
          fiscal_period_id: string | null
          id: string
          invoice_number: string
          issue_date: string
          ngo_id: string
          notes: string | null
          paid_date: string | null
          payment_transaction_id: string | null
          status: string
          subtotal: number
          tax_amount: number
          total: number
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          ar_account_id?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name: string
          due_date: string
          fiscal_period_id?: string | null
          id?: string
          invoice_number: string
          issue_date?: string
          ngo_id: string
          notes?: string | null
          paid_date?: string | null
          payment_transaction_id?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          total?: number
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          ar_account_id?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          due_date?: string
          fiscal_period_id?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string
          ngo_id?: string
          notes?: string | null
          paid_date?: string | null
          payment_transaction_id?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          total?: number
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_ar_account_id_fkey"
            columns: ["ar_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_fiscal_period_id_fkey"
            columns: ["fiscal_period_id"]
            isOneToOne: false
            referencedRelation: "fiscal_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_payment_transaction_id_fkey"
            columns: ["payment_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      job_requisitions: {
        Row: {
          created_at: string
          department_id: string | null
          description: string | null
          employment_type: string | null
          id: string
          location: string | null
          status: string
          title: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          description?: string | null
          employment_type?: string | null
          id?: string
          location?: string | null
          status?: string
          title: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          description?: string | null
          employment_type?: string | null
          id?: string
          location?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_requisitions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "org_units"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          account_id: string
          created_at: string
          credit: number
          debit: number
          id: string
          memo: string | null
          transaction_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          credit?: number
          debit?: number
          id?: string
          memo?: string | null
          transaction_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          credit?: number
          debit?: number
          id?: string
          memo?: string | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      localized_coa_mappings: {
        Row: {
          country_code: string
          created_at: string
          id: string
          is_active: boolean | null
          local_account_code: string
          local_account_name: string
          mapping_notes: string | null
          standard_account_id: string | null
          updated_at: string
        }
        Insert: {
          country_code: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          local_account_code: string
          local_account_name: string
          mapping_notes?: string | null
          standard_account_id?: string | null
          updated_at?: string
        }
        Update: {
          country_code?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          local_account_code?: string
          local_account_name?: string
          mapping_notes?: string | null
          standard_account_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "localized_coa_mappings_standard_account_id_fkey"
            columns: ["standard_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      make_automation_logs: {
        Row: {
          automation_id: string
          created_at: string
          error_message: string | null
          id: string
          request_payload: Json | null
          response_payload: Json | null
          status: string
          triggered_by_user_id: string | null
        }
        Insert: {
          automation_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          request_payload?: Json | null
          response_payload?: Json | null
          status?: string
          triggered_by_user_id?: string | null
        }
        Update: {
          automation_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          request_payload?: Json | null
          response_payload?: Json | null
          status?: string
          triggered_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "make_automation_logs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "make_automations"
            referencedColumns: ["id"]
          },
        ]
      }
      make_automations: {
        Row: {
          automation_type: string
          config_json: Json | null
          created_at: string
          created_by_user_id: string | null
          description: string | null
          id: string
          is_active: boolean
          last_triggered_at: string | null
          name: string
          trigger_count: number
          trigger_event: string
          updated_at: string
          webhook_secret: string | null
          webhook_url: string | null
        }
        Insert: {
          automation_type?: string
          config_json?: Json | null
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          name: string
          trigger_count?: number
          trigger_event: string
          updated_at?: string
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Update: {
          automation_type?: string
          config_json?: Json | null
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          name?: string
          trigger_count?: number
          trigger_event?: string
          updated_at?: string
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      ngo_risk_profiles: {
        Row: {
          compliance_risk_score: number
          created_at: string
          financial_risk_score: number
          hr_risk_score: number
          id: string
          ngo_id: string
          notes: string | null
          operations_risk_score: number
          overall_risk_score: number
          risk_level: string
          updated_at: string
        }
        Insert: {
          compliance_risk_score?: number
          created_at?: string
          financial_risk_score?: number
          hr_risk_score?: number
          id?: string
          ngo_id: string
          notes?: string | null
          operations_risk_score?: number
          overall_risk_score?: number
          risk_level?: string
          updated_at?: string
        }
        Update: {
          compliance_risk_score?: number
          created_at?: string
          financial_risk_score?: number
          hr_risk_score?: number
          id?: string
          ngo_id?: string
          notes?: string | null
          operations_risk_score?: number
          overall_risk_score?: number
          risk_level?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ngo_risk_profiles_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: true
            referencedRelation: "ngos"
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
          region: string | null
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
          region?: string | null
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
          region?: string | null
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
      opening_balances: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          fiscal_period_id: string
          id: string
          ngo_id: string
        }
        Insert: {
          account_id: string
          amount?: number
          created_at?: string
          fiscal_period_id: string
          id?: string
          ngo_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          fiscal_period_id?: string
          id?: string
          ngo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opening_balances_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opening_balances_fiscal_period_id_fkey"
            columns: ["fiscal_period_id"]
            isOneToOne: false
            referencedRelation: "fiscal_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opening_balances_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
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
      partners: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          primary_contact: string | null
          region: string | null
          status: string | null
          type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          primary_contact?: string | null
          region?: string | null
          status?: string | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          primary_contact?: string | null
          region?: string | null
          status?: string | null
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      partnership_pipeline: {
        Row: {
          created_at: string
          id: string
          key_commitments: string | null
          ngo_id: string | null
          notes: string | null
          partner_id: string | null
          stage: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_commitments?: string | null
          ngo_id?: string | null
          notes?: string | null
          partner_id?: string | null
          stage?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          key_commitments?: string | null
          ngo_id?: string | null
          notes?: string | null
          partner_id?: string | null
          stage?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partnership_pipeline_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partnership_pipeline_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      pay_run_items: {
        Row: {
          created_at: string
          deductions: Json
          gross_pay: number
          id: string
          net_pay: number
          overtime_hours: number
          pay_run_id: string
          regular_hours: number
          staff_id: string
        }
        Insert: {
          created_at?: string
          deductions?: Json
          gross_pay?: number
          id?: string
          net_pay?: number
          overtime_hours?: number
          pay_run_id: string
          regular_hours?: number
          staff_id: string
        }
        Update: {
          created_at?: string
          deductions?: Json
          gross_pay?: number
          id?: string
          net_pay?: number
          overtime_hours?: number
          pay_run_id?: string
          regular_hours?: number
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pay_run_items_pay_run_id_fkey"
            columns: ["pay_run_id"]
            isOneToOne: false
            referencedRelation: "pay_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_run_items_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pay_runs: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          id: string
          ngo_id: string
          notes: string | null
          pay_period_end: string
          pay_period_start: string
          run_date: string | null
          status: string
          total_gross: number
          total_net: number
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          ngo_id: string
          notes?: string | null
          pay_period_end: string
          pay_period_start: string
          run_date?: string | null
          status?: string
          total_gross?: number
          total_net?: number
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          ngo_id?: string
          notes?: string | null
          pay_period_end?: string
          pay_period_start?: string
          run_date?: string | null
          status?: string
          total_gross?: number
          total_net?: number
        }
        Relationships: [
          {
            foreignKeyName: "pay_runs_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_runs_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_reviews: {
        Row: {
          areas_for_improvement: string | null
          created_at: string
          goals_met: Json | null
          id: string
          ngo_id: string | null
          overall_rating: number | null
          review_period_end: string
          review_period_start: string
          reviewer_comments: string | null
          reviewer_user_id: string | null
          staff_comments: string | null
          staff_id: string
          status: string
          strengths: string | null
          updated_at: string
        }
        Insert: {
          areas_for_improvement?: string | null
          created_at?: string
          goals_met?: Json | null
          id?: string
          ngo_id?: string | null
          overall_rating?: number | null
          review_period_end: string
          review_period_start: string
          reviewer_comments?: string | null
          reviewer_user_id?: string | null
          staff_comments?: string | null
          staff_id: string
          status?: string
          strengths?: string | null
          updated_at?: string
        }
        Update: {
          areas_for_improvement?: string | null
          created_at?: string
          goals_met?: Json | null
          id?: string
          ngo_id?: string | null
          overall_rating?: number | null
          review_period_end?: string
          review_period_start?: string
          reviewer_comments?: string | null
          reviewer_user_id?: string | null
          staff_comments?: string | null
          staff_id?: string
          status?: string
          strengths?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_reviews_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_reviews_reviewer_user_id_fkey"
            columns: ["reviewer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_reviews_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      period_comparisons: {
        Row: {
          comparison_type: string
          created_at: string
          current_fiscal_period_id: string
          id: string
          ngo_id: string
          previous_fiscal_period_id: string
        }
        Insert: {
          comparison_type?: string
          created_at?: string
          current_fiscal_period_id: string
          id?: string
          ngo_id: string
          previous_fiscal_period_id: string
        }
        Update: {
          comparison_type?: string
          created_at?: string
          current_fiscal_period_id?: string
          id?: string
          ngo_id?: string
          previous_fiscal_period_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "period_comparisons_current_fiscal_period_id_fkey"
            columns: ["current_fiscal_period_id"]
            isOneToOne: false
            referencedRelation: "fiscal_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "period_comparisons_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "period_comparisons_previous_fiscal_period_id_fkey"
            columns: ["previous_fiscal_period_id"]
            isOneToOne: false
            referencedRelation: "fiscal_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      po_line_items: {
        Row: {
          account_id: string | null
          created_at: string
          description: string
          id: string
          purchase_order_id: string
          quantity: number
          received_quantity: number | null
          total_price: number
          unit_price: number
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          description: string
          id?: string
          purchase_order_id: string
          quantity?: number
          received_quantity?: number | null
          total_price?: number
          unit_price?: number
        }
        Update: {
          account_id?: string | null
          created_at?: string
          description?: string
          id?: string
          purchase_order_id?: string
          quantity?: number
          received_quantity?: number | null
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "po_line_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "po_line_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_registry: {
        Row: {
          category: string
          created_at: string
          description: string | null
          document_path: string | null
          id: string
          last_review_date: string | null
          next_review_date: string | null
          notes: string | null
          owner_name: string | null
          policy_name: string
          status: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          document_path?: string | null
          id?: string
          last_review_date?: string | null
          next_review_date?: string | null
          notes?: string | null
          owner_name?: string | null
          policy_name: string
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          document_path?: string | null
          id?: string
          last_review_date?: string | null
          next_review_date?: string | null
          notes?: string | null
          owner_name?: string | null
          policy_name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approval_status: string
          avatar_url: string | null
          created_at: string
          department_id: string | null
          email: string | null
          full_name: string | null
          id: string
          is_approved: boolean
          updated_at: string
        }
        Insert: {
          approval_status?: string
          avatar_url?: string | null
          created_at?: string
          department_id?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_approved?: boolean
          updated_at?: string
        }
        Update: {
          approval_status?: string
          avatar_url?: string | null
          created_at?: string
          department_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_approved?: boolean
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
      proposals: {
        Row: {
          awarded_amount: number | null
          created_at: string
          decision_at: string | null
          grant_opportunity_id: string | null
          id: string
          internal_owner: string | null
          ngo_id: string | null
          notes: string | null
          phase: string | null
          requested_amount: number | null
          submitted_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          awarded_amount?: number | null
          created_at?: string
          decision_at?: string | null
          grant_opportunity_id?: string | null
          id?: string
          internal_owner?: string | null
          ngo_id?: string | null
          notes?: string | null
          phase?: string | null
          requested_amount?: number | null
          submitted_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          awarded_amount?: number | null
          created_at?: string
          decision_at?: string | null
          grant_opportunity_id?: string | null
          id?: string
          internal_owner?: string | null
          ngo_id?: string | null
          notes?: string | null
          phase?: string | null
          requested_amount?: number | null
          submitted_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposals_grant_opportunity_id_fkey"
            columns: ["grant_opportunity_id"]
            isOneToOne: false
            referencedRelation: "grant_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_internal_owner_fkey"
            columns: ["internal_owner"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
        ]
      }
      pto_requests: {
        Row: {
          approved_at: string | null
          approved_by_user_id: string | null
          created_at: string
          end_date: string
          hours_requested: number
          id: string
          leave_type: string
          ngo_id: string
          notes: string | null
          reason: string | null
          staff_id: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          created_at?: string
          end_date: string
          hours_requested?: number
          id?: string
          leave_type?: string
          ngo_id: string
          notes?: string | null
          reason?: string | null
          staff_id: string
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          created_at?: string
          end_date?: string
          hours_requested?: number
          id?: string
          leave_type?: string
          ngo_id?: string
          notes?: string | null
          reason?: string | null
          staff_id?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pto_requests_approved_by_user_id_fkey"
            columns: ["approved_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pto_requests_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pto_requests_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          approved_at: string | null
          approved_by_user_id: string | null
          created_at: string
          created_by_user_id: string | null
          currency_code: string | null
          expected_delivery: string | null
          id: string
          ngo_id: string
          notes: string | null
          order_date: string
          po_number: string
          purchase_request_id: string | null
          shipping_address: string | null
          status: string
          subtotal: number
          tax_amount: number
          total_amount: number
          updated_at: string
          vendor_org_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          currency_code?: string | null
          expected_delivery?: string | null
          id?: string
          ngo_id: string
          notes?: string | null
          order_date?: string
          po_number: string
          purchase_request_id?: string | null
          shipping_address?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
          vendor_org_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          currency_code?: string | null
          expected_delivery?: string | null
          id?: string
          ngo_id?: string
          notes?: string | null
          order_date?: string
          po_number?: string
          purchase_request_id?: string | null
          shipping_address?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
          vendor_org_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_approved_by_user_id_fkey"
            columns: ["approved_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_purchase_request_id_fkey"
            columns: ["purchase_request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_vendor_org_id_fkey"
            columns: ["vendor_org_id"]
            isOneToOne: false
            referencedRelation: "crm_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_requests: {
        Row: {
          approved_at: string | null
          approved_by_user_id: string | null
          created_at: string
          currency_code: string | null
          department_id: string | null
          description: string | null
          estimated_amount: number | null
          id: string
          needed_by: string | null
          ngo_id: string
          notes: string | null
          priority: string
          rejected_reason: string | null
          requested_by_user_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          created_at?: string
          currency_code?: string | null
          department_id?: string | null
          description?: string | null
          estimated_amount?: number | null
          id?: string
          needed_by?: string | null
          ngo_id: string
          notes?: string | null
          priority?: string
          rejected_reason?: string | null
          requested_by_user_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          created_at?: string
          currency_code?: string | null
          department_id?: string | null
          description?: string | null
          estimated_amount?: number | null
          id?: string
          needed_by?: string | null
          ngo_id?: string
          notes?: string | null
          priority?: string
          rejected_reason?: string | null
          requested_by_user_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_requests_approved_by_user_id_fkey"
            columns: ["approved_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requests_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "org_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requests_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requests_requested_by_user_id_fkey"
            columns: ["requested_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          file_name: string
          file_path: string
          id: string
          transaction_id: string
          uploaded_at: string
          uploaded_by_user_id: string | null
        }
        Insert: {
          file_name: string
          file_path: string
          id?: string
          transaction_id: string
          uploaded_at?: string
          uploaded_by_user_id?: string | null
        }
        Update: {
          file_name?: string
          file_path?: string
          id?: string
          transaction_id?: string
          uploaded_at?: string
          uploaded_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipts_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliations: {
        Row: {
          created_at: string
          fiscal_period_id: string
          id: string
          ngo_id: string
          notes: string | null
          reconciled_at: string | null
          reconciled_by_user_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          fiscal_period_id: string
          id?: string
          ngo_id: string
          notes?: string | null
          reconciled_at?: string | null
          reconciled_by_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          fiscal_period_id?: string
          id?: string
          ngo_id?: string
          notes?: string | null
          reconciled_at?: string | null
          reconciled_by_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reconciliations_fiscal_period_id_fkey"
            columns: ["fiscal_period_id"]
            isOneToOne: false
            referencedRelation: "fiscal_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliations_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_donations: {
        Row: {
          amount: number
          created_at: string
          currency_code: string | null
          donor_email: string | null
          donor_name: string
          donor_org_id: string | null
          end_date: string | null
          frequency: string
          id: string
          next_expected_date: string | null
          ngo_id: string
          notes: string | null
          payment_method: string | null
          revenue_stream_id: string | null
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency_code?: string | null
          donor_email?: string | null
          donor_name: string
          donor_org_id?: string | null
          end_date?: string | null
          frequency?: string
          id?: string
          next_expected_date?: string | null
          ngo_id: string
          notes?: string | null
          payment_method?: string | null
          revenue_stream_id?: string | null
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency_code?: string | null
          donor_email?: string | null
          donor_name?: string
          donor_org_id?: string | null
          end_date?: string | null
          frequency?: string
          id?: string
          next_expected_date?: string | null
          ngo_id?: string
          notes?: string | null
          payment_method?: string | null
          revenue_stream_id?: string | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_donations_donor_org_id_fkey"
            columns: ["donor_org_id"]
            isOneToOne: false
            referencedRelation: "crm_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_donations_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_donations_revenue_stream_id_fkey"
            columns: ["revenue_stream_id"]
            isOneToOne: false
            referencedRelation: "revenue_streams"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_transactions: {
        Row: {
          created_at: string
          end_date: string | null
          frequency: string
          id: string
          is_active: boolean
          last_posted_at: string | null
          next_run_date: string
          ngo_id: string
          template_name: string
          transaction_template: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          last_posted_at?: string | null
          next_run_date: string
          ngo_id: string
          template_name: string
          transaction_template?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          last_posted_at?: string | null
          next_run_date?: string
          ngo_id?: string
          template_name?: string
          transaction_template?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_transactions_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
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
          status: string | null
          user_id: string
          work_item_id: string
        }
        Insert: {
          channel?: string | null
          created_at?: string
          id?: string
          remind_at: string
          status?: string | null
          user_id: string
          work_item_id: string
        }
        Update: {
          channel?: string | null
          created_at?: string
          id?: string
          remind_at?: string
          status?: string | null
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
      revenue_recognition: {
        Row: {
          amount: number
          created_at: string
          deferred_amount: number
          description: string | null
          fiscal_period_id: string | null
          id: string
          ngo_id: string
          notes: string | null
          recognition_date: string
          recognition_type: string
          revenue_stream_id: string | null
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          deferred_amount?: number
          description?: string | null
          fiscal_period_id?: string | null
          id?: string
          ngo_id: string
          notes?: string | null
          recognition_date: string
          recognition_type?: string
          revenue_stream_id?: string | null
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          deferred_amount?: number
          description?: string | null
          fiscal_period_id?: string | null
          id?: string
          ngo_id?: string
          notes?: string | null
          recognition_date?: string
          recognition_type?: string
          revenue_stream_id?: string | null
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_recognition_fiscal_period_id_fkey"
            columns: ["fiscal_period_id"]
            isOneToOne: false
            referencedRelation: "fiscal_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_recognition_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_recognition_revenue_stream_id_fkey"
            columns: ["revenue_stream_id"]
            isOneToOne: false
            referencedRelation: "revenue_streams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_recognition_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_streams: {
        Row: {
          account_id: string | null
          annual_target: number | null
          created_at: string
          currency_code: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          ngo_id: string
          notes: string | null
          source: string | null
          stream_type: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          annual_target?: number | null
          created_at?: string
          currency_code?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          ngo_id: string
          notes?: string | null
          source?: string | null
          stream_type?: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          annual_target?: number | null
          created_at?: string
          currency_code?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          ngo_id?: string
          notes?: string | null
          source?: string | null
          stream_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_streams_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_streams_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_ledger_documents: {
        Row: {
          created_at: string
          html_content: string
          id: string
          ngo_id: string
          saved_by_user_id: string | null
          title: string
          transaction_id: string
        }
        Insert: {
          created_at?: string
          html_content: string
          id?: string
          ngo_id: string
          saved_by_user_id?: string | null
          title: string
          transaction_id: string
        }
        Update: {
          created_at?: string
          html_content?: string
          id?: string
          ngo_id?: string
          saved_by_user_id?: string | null
          title?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_ledger_documents_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_ledger_documents_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      signed_documents: {
        Row: {
          created_at: string
          id: string
          signing_request_id: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          signing_request_id: string
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          signing_request_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "signed_documents_signing_request_id_fkey"
            columns: ["signing_request_id"]
            isOneToOne: false
            referencedRelation: "signing_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      signing_requests: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          document_id: string
          expires_at: string
          id: string
          ngo_id: string | null
          signed_at: string | null
          signer_email: string
          signer_ip: string | null
          signer_name: string
          status: string
          token: string
          work_item_id: string | null
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          document_id: string
          expires_at: string
          id?: string
          ngo_id?: string | null
          signed_at?: string | null
          signer_email: string
          signer_ip?: string | null
          signer_name: string
          status?: string
          token?: string
          work_item_id?: string | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          document_id?: string
          expires_at?: string
          id?: string
          ngo_id?: string | null
          signed_at?: string | null
          signer_email?: string
          signer_ip?: string | null
          signer_name?: string
          status?: string
          token?: string
          work_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signing_requests_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "esign_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signing_requests_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signing_requests_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_certifications: {
        Row: {
          certification_name: string
          created_at: string
          document_path: string | null
          expiry_date: string | null
          id: string
          issue_date: string | null
          issuing_body: string | null
          notes: string | null
          staff_id: string
          status: string
        }
        Insert: {
          certification_name: string
          created_at?: string
          document_path?: string | null
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          issuing_body?: string | null
          notes?: string | null
          staff_id: string
          status?: string
        }
        Update: {
          certification_name?: string
          created_at?: string
          document_path?: string | null
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          issuing_body?: string | null
          notes?: string | null
          staff_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_certifications_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_documents: {
        Row: {
          document_type: string
          expiry_date: string | null
          file_name: string
          id: string
          staff_id: string
          storage_path: string
          uploaded_at: string
          uploaded_by_user_id: string | null
        }
        Insert: {
          document_type?: string
          expiry_date?: string | null
          file_name: string
          id?: string
          staff_id: string
          storage_path: string
          uploaded_at?: string
          uploaded_by_user_id?: string | null
        }
        Update: {
          document_type?: string
          expiry_date?: string | null
          file_name?: string
          id?: string
          staff_id?: string
          storage_path?: string
          uploaded_at?: string
          uploaded_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_documents_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_documents_uploaded_by_user_id_fkey"
            columns: ["uploaded_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_profiles: {
        Row: {
          annual_salary: number | null
          created_at: string
          department_id: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          employment_type: string
          end_date: string | null
          first_name: string
          hourly_rate: number | null
          id: string
          job_title: string | null
          last_name: string
          ngo_id: string | null
          notes: string | null
          phone: string | null
          pto_balance_hours: number
          start_date: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          annual_salary?: number | null
          created_at?: string
          department_id?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employment_type?: string
          end_date?: string | null
          first_name: string
          hourly_rate?: number | null
          id?: string
          job_title?: string | null
          last_name: string
          ngo_id?: string | null
          notes?: string | null
          phone?: string | null
          pto_balance_hours?: number
          start_date?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          annual_salary?: number | null
          created_at?: string
          department_id?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employment_type?: string
          end_date?: string | null
          first_name?: string
          hourly_rate?: number | null
          id?: string
          job_title?: string | null
          last_name?: string
          ngo_id?: string | null
          notes?: string | null
          phone?: string | null
          pto_balance_hours?: number
          start_date?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "org_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_profiles_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          id: string
          item_id: string
          movement_type: string
          ngo_id: string
          notes: string | null
          performed_by_user_id: string | null
          quantity: number
          reference_number: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          movement_type?: string
          ngo_id: string
          notes?: string | null
          performed_by_user_id?: string | null
          quantity: number
          reference_number?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          movement_type?: string
          ngo_id?: string
          notes?: string | null
          performed_by_user_id?: string | null
          quantity?: number
          reference_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_performed_by_user_id_fkey"
            columns: ["performed_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      supply_request_items: {
        Row: {
          created_at: string
          id: string
          item_id: string
          notes: string | null
          quantity_fulfilled: number
          quantity_requested: number
          supply_request_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          notes?: string | null
          quantity_fulfilled?: number
          quantity_requested?: number
          supply_request_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          notes?: string | null
          quantity_fulfilled?: number
          quantity_requested?: number
          supply_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supply_request_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_request_items_supply_request_id_fkey"
            columns: ["supply_request_id"]
            isOneToOne: false
            referencedRelation: "supply_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      supply_requests: {
        Row: {
          approved_at: string | null
          approved_by_user_id: string | null
          created_at: string
          id: string
          needed_by: string | null
          ngo_id: string
          notes: string | null
          priority: string
          request_number: string
          requested_by_user_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          created_at?: string
          id?: string
          needed_by?: string | null
          ngo_id: string
          notes?: string | null
          priority?: string
          request_number: string
          requested_by_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          created_at?: string
          id?: string
          needed_by?: string | null
          ngo_id?: string
          notes?: string | null
          priority?: string
          request_number?: string
          requested_by_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supply_requests_approved_by_user_id_fkey"
            columns: ["approved_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_requests_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_requests_requested_by_user_id_fkey"
            columns: ["requested_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_rates: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          ngo_id: string
          rate: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          ngo_id: string
          rate?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          ngo_id?: string
          rate?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_rates_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
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
      tickets: {
        Row: {
          assigned_to_user_id: string | null
          created_at: string
          description: string
          id: string
          related_ngo_id: string | null
          reporter_user_id: string
          severity: string
          status: string
          subject: string
          updated_at: string
          work_item_id: string | null
        }
        Insert: {
          assigned_to_user_id?: string | null
          created_at?: string
          description?: string
          id?: string
          related_ngo_id?: string | null
          reporter_user_id: string
          severity?: string
          status?: string
          subject: string
          updated_at?: string
          work_item_id?: string | null
        }
        Update: {
          assigned_to_user_id?: string | null
          created_at?: string
          description?: string
          id?: string
          related_ngo_id?: string | null
          reporter_user_id?: string
          severity?: string
          status?: string
          subject?: string
          updated_at?: string
          work_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_assigned_to_user_id_fkey"
            columns: ["assigned_to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_related_ngo_id_fkey"
            columns: ["related_ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_reporter_user_id_fkey"
            columns: ["reporter_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheet_entries: {
        Row: {
          cost_center_id: string | null
          created_at: string
          description: string | null
          entry_date: string
          hours: number
          id: string
          staff_id: string
          timesheet_id: string
        }
        Insert: {
          cost_center_id?: string | null
          created_at?: string
          description?: string | null
          entry_date: string
          hours?: number
          id?: string
          staff_id: string
          timesheet_id: string
        }
        Update: {
          cost_center_id?: string | null
          created_at?: string
          description?: string | null
          entry_date?: string
          hours?: number
          id?: string
          staff_id?: string
          timesheet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_entries_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_entries_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_entries_timesheet_id_fkey"
            columns: ["timesheet_id"]
            isOneToOne: false
            referencedRelation: "timesheets"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheets: {
        Row: {
          approved_at: string | null
          approved_by_user_id: string | null
          created_at: string
          id: string
          ngo_id: string
          notes: string | null
          period_end: string
          period_start: string
          staff_id: string
          status: string
          submitted_at: string | null
          total_hours: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          created_at?: string
          id?: string
          ngo_id: string
          notes?: string | null
          period_end: string
          period_start: string
          staff_id: string
          status?: string
          submitted_at?: string | null
          total_hours?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          created_at?: string
          id?: string
          ngo_id?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          staff_id?: string
          status?: string
          submitted_at?: string | null
          total_hours?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheets_approved_by_user_id_fkey"
            columns: ["approved_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_attachments: {
        Row: {
          created_at: string
          file_name: string
          id: string
          mime_type: string | null
          storage_path: string
          transaction_id: string
          uploaded_by_user_id: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string | null
          storage_path: string
          transaction_id: string
          uploaded_by_user_id?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          storage_path?: string
          transaction_id?: string
          uploaded_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transaction_attachments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_attachments_uploaded_by_user_id_fkey"
            columns: ["uploaded_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          description: string
          fiscal_period_id: string | null
          id: string
          is_void: boolean
          ngo_id: string
          reference_number: string | null
          transaction_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          description: string
          fiscal_period_id?: string | null
          id?: string
          is_void?: boolean
          ngo_id: string
          reference_number?: string | null
          transaction_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          description?: string
          fiscal_period_id?: string | null
          id?: string
          is_void?: boolean
          ngo_id?: string
          reference_number?: string | null
          transaction_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_fiscal_period_id_fkey"
            columns: ["fiscal_period_id"]
            isOneToOne: false
            referencedRelation: "fiscal_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
        ]
      }
      treasury_positions: {
        Row: {
          account_name: string
          account_type: string
          as_of_date: string
          bank_name: string | null
          created_at: string
          currency: string
          current_balance: number
          id: string
          ngo_id: string | null
          notes: string | null
          updated_at: string
        }
        Insert: {
          account_name: string
          account_type?: string
          as_of_date?: string
          bank_name?: string | null
          created_at?: string
          currency?: string
          current_balance?: number
          id?: string
          ngo_id?: string | null
          notes?: string | null
          updated_at?: string
        }
        Update: {
          account_name?: string
          account_type?: string
          as_of_date?: string
          bank_name?: string | null
          created_at?: string
          currency?: string
          current_balance?: number
          id?: string
          ngo_id?: string | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treasury_positions_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_entries: {
        Row: {
          cost_center_id: string
          created_at: string | null
          description: string | null
          fiscal_period_id: string
          id: string
          ngo_id: string | null
          quantity: number
          source_reference_id: string | null
          source_reference_type: string | null
          status: string
          submitted_by_user_id: string | null
          total_cost: number
          unit_cost: number
          unit_type: string
          updated_at: string | null
          usage_date: string
          usage_source_id: string
        }
        Insert: {
          cost_center_id: string
          created_at?: string | null
          description?: string | null
          fiscal_period_id: string
          id?: string
          ngo_id?: string | null
          quantity?: number
          source_reference_id?: string | null
          source_reference_type?: string | null
          status?: string
          submitted_by_user_id?: string | null
          total_cost?: number
          unit_cost?: number
          unit_type: string
          updated_at?: string | null
          usage_date: string
          usage_source_id: string
        }
        Update: {
          cost_center_id?: string
          created_at?: string | null
          description?: string | null
          fiscal_period_id?: string
          id?: string
          ngo_id?: string | null
          quantity?: number
          source_reference_id?: string | null
          source_reference_type?: string | null
          status?: string
          submitted_by_user_id?: string | null
          total_cost?: number
          unit_cost?: number
          unit_type?: string
          updated_at?: string | null
          usage_date?: string
          usage_source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_entries_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_entries_fiscal_period_id_fkey"
            columns: ["fiscal_period_id"]
            isOneToOne: false
            referencedRelation: "fiscal_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_entries_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_entries_submitted_by_user_id_fkey"
            columns: ["submitted_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_entries_usage_source_id_fkey"
            columns: ["usage_source_id"]
            isOneToOne: false
            referencedRelation: "usage_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_sources: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          source_reference_id: string | null
          source_table: string | null
          type: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          source_reference_id?: string | null
          source_table?: string | null
          type: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          source_reference_id?: string | null
          source_table?: string | null
          type?: string
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
      vendor_invoices: {
        Row: {
          approved_at: string | null
          approved_by_user_id: string | null
          created_at: string
          currency_code: string | null
          due_date: string | null
          id: string
          invoice_date: string
          invoice_number: string
          ngo_id: string
          notes: string | null
          payment_date: string | null
          payment_reference: string | null
          purchase_order_id: string | null
          status: string
          subtotal: number
          tax_amount: number
          total_amount: number
          transaction_id: string | null
          updated_at: string
          vendor_org_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          created_at?: string
          currency_code?: string | null
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number: string
          ngo_id: string
          notes?: string | null
          payment_date?: string | null
          payment_reference?: string | null
          purchase_order_id?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          transaction_id?: string | null
          updated_at?: string
          vendor_org_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          created_at?: string
          currency_code?: string | null
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          ngo_id?: string
          notes?: string | null
          payment_date?: string | null
          payment_reference?: string | null
          purchase_order_id?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          transaction_id?: string | null
          updated_at?: string
          vendor_org_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_invoices_approved_by_user_id_fkey"
            columns: ["approved_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_invoices_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_invoices_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_invoices_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_invoices_vendor_org_id_fkey"
            columns: ["vendor_org_id"]
            isOneToOne: false
            referencedRelation: "crm_organizations"
            referencedColumns: ["id"]
          },
        ]
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
      get_signing_request_by_token: {
        Args: { request_token: string }
        Returns: {
          created_at: string
          document_id: string
          expires_at: string
          id: string
          original_filename: string
          signed_at: string
          signer_email: string
          signer_ip: string
          signer_name: string
          status: string
          storage_path: string
          token: string
        }[]
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
