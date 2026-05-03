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
      audit_log: {
        Row: {
          action: string
          after_state: Json | null
          before_state: Json | null
          created_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          org_id: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          org_id: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          org_id?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      category_overrides: {
        Row: {
          category: string
          created_at: string | null
          description_pattern: string
          id: string
          org_id: string
          subcategory: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description_pattern: string
          id?: string
          org_id: string
          subcategory?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description_pattern?: string
          id?: string
          org_id?: string
          subcategory?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "category_overrides_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      category_rules: {
        Row: {
          category: string
          created_at: string | null
          id: string
          is_active: boolean | null
          match_type: string
          match_value: string
          org_id: string | null
          priority: number | null
          subcategory: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          match_type: string
          match_value: string
          org_id?: string | null
          priority?: number | null
          subcategory?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          match_type?: string
          match_value?: string
          org_id?: string | null
          priority?: number | null
          subcategory?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "category_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string | null
          data_context: Json | null
          execution_result: Json | null
          function_calls: Json | null
          id: string
          intent: string | null
          model_used: string | null
          org_id: string
          role: string
          session_id: string
          tokens_used: number | null
        }
        Insert: {
          content: string
          created_at?: string | null
          data_context?: Json | null
          execution_result?: Json | null
          function_calls?: Json | null
          id?: string
          intent?: string | null
          model_used?: string | null
          org_id: string
          role: string
          session_id: string
          tokens_used?: number | null
        }
        Update: {
          content?: string
          created_at?: string | null
          data_context?: Json | null
          execution_result?: Json | null
          function_calls?: Json | null
          id?: string
          intent?: string | null
          model_used?: string | null
          org_id?: string
          role?: string
          session_id?: string
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string | null
          id: string
          org_id: string
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          org_id: string
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          org_id?: string
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      connections: {
        Row: {
          account_name: string | null
          created_at: string | null
          encrypted_access_token: string | null
          encrypted_item_id: string | null
          encrypted_refresh_token: string | null
          id: string
          last_synced_at: string | null
          metadata: Json | null
          org_id: string
          provider: string
          status: string
          sync_cursor: string | null
          updated_at: string | null
        }
        Insert: {
          account_name?: string | null
          created_at?: string | null
          encrypted_access_token?: string | null
          encrypted_item_id?: string | null
          encrypted_refresh_token?: string | null
          id?: string
          last_synced_at?: string | null
          metadata?: Json | null
          org_id: string
          provider: string
          status?: string
          sync_cursor?: string | null
          updated_at?: string | null
        }
        Update: {
          account_name?: string | null
          created_at?: string | null
          encrypted_access_token?: string | null
          encrypted_item_id?: string | null
          encrypted_refresh_token?: string | null
          id?: string
          last_synced_at?: string | null
          metadata?: Json | null
          org_id?: string
          provider?: string
          status?: string
          sync_cursor?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "connections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      csv_imports: {
        Row: {
          column_mapping: Json | null
          created_at: string | null
          error_log: Json | null
          file_name: string
          file_type: string
          file_url: string
          id: string
          imported_rows: number | null
          org_id: string
          platform: string | null
          skipped_rows: number | null
          status: string | null
          total_rows: number | null
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          column_mapping?: Json | null
          created_at?: string | null
          error_log?: Json | null
          file_name: string
          file_type: string
          file_url: string
          id?: string
          imported_rows?: number | null
          org_id: string
          platform?: string | null
          skipped_rows?: number | null
          status?: string | null
          total_rows?: number | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          column_mapping?: Json | null
          created_at?: string | null
          error_log?: Json | null
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          imported_rows?: number | null
          org_id?: string
          platform?: string | null
          skipped_rows?: number | null
          status?: string | null
          total_rows?: number | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "csv_imports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          churned_at: string | null
          created_at: string | null
          email: string | null
          external_id: string | null
          first_seen: string | null
          id: string
          last_seen: string | null
          metadata: Json | null
          mrr: number | null
          name: string | null
          org_id: string
          plan: string | null
          source: string | null
          status: string | null
          total_revenue: number | null
          updated_at: string | null
        }
        Insert: {
          churned_at?: string | null
          created_at?: string | null
          email?: string | null
          external_id?: string | null
          first_seen?: string | null
          id?: string
          last_seen?: string | null
          metadata?: Json | null
          mrr?: number | null
          name?: string | null
          org_id: string
          plan?: string | null
          source?: string | null
          status?: string | null
          total_revenue?: number | null
          updated_at?: string | null
        }
        Update: {
          churned_at?: string | null
          created_at?: string | null
          email?: string | null
          external_id?: string | null
          first_seen?: string | null
          id?: string
          last_seen?: string | null
          metadata?: Json | null
          mrr?: number | null
          name?: string | null
          org_id?: string
          plan?: string | null
          source?: string | null
          status?: string | null
          total_revenue?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      data_completeness: {
        Row: {
          bank_connected: boolean | null
          expense_completeness: string | null
          has_csv_imports: boolean | null
          has_manual_entries: boolean | null
          id: string
          last_assessed_at: string | null
          org_id: string
          paypal_connected: boolean | null
          revenue_completeness: string | null
          shopify_connected: boolean | null
          stripe_connected: boolean | null
        }
        Insert: {
          bank_connected?: boolean | null
          expense_completeness?: string | null
          has_csv_imports?: boolean | null
          has_manual_entries?: boolean | null
          id?: string
          last_assessed_at?: string | null
          org_id: string
          paypal_connected?: boolean | null
          revenue_completeness?: string | null
          shopify_connected?: boolean | null
          stripe_connected?: boolean | null
        }
        Update: {
          bank_connected?: boolean | null
          expense_completeness?: string | null
          has_csv_imports?: boolean | null
          has_manual_entries?: boolean | null
          id?: string
          last_assessed_at?: string | null
          org_id?: string
          paypal_connected?: boolean | null
          revenue_completeness?: string | null
          shopify_connected?: boolean | null
          stripe_connected?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "data_completeness_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_reports: {
        Row: {
          amount: number
          category: string
          created_at: string | null
          currency: string | null
          date: string
          id: string
          notes: string | null
          org_id: string
          receipt_url: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          submitter_id: string | null
          submitter_name: string | null
          title: string
          transaction_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string | null
          currency?: string | null
          date: string
          id?: string
          notes?: string | null
          org_id: string
          receipt_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          submitter_id?: string | null
          submitter_name?: string | null
          title: string
          transaction_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string | null
          currency?: string | null
          date?: string
          id?: string
          notes?: string | null
          org_id?: string
          receipt_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          submitter_id?: string | null
          submitter_name?: string | null
          title?: string
          transaction_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_reports_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_updates: {
        Row: {
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          metrics_snapshot: Json | null
          month: string
          org_id: string
          period: string
          sent_at: string | null
          sent_to: string[] | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          metrics_snapshot?: Json | null
          month: string
          org_id: string
          period: string
          sent_at?: string | null
          sent_to?: string[] | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          metrics_snapshot?: Json | null
          month?: string
          org_id?: string
          period?: string
          sent_at?: string | null
          sent_to?: string[] | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investor_updates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          currency: string | null
          customer_email: string | null
          customer_name: string | null
          due_date: string | null
          external_id: string | null
          id: string
          invoice_date: string | null
          invoice_number: string
          line_items: Json | null
          notes: string | null
          org_id: string
          paid_at: string | null
          source: string | null
          status: string
          tax_amount: number | null
          total_amount: number | null
          updated_at: string | null
          vendor_name: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          customer_email?: string | null
          customer_name?: string | null
          due_date?: string | null
          external_id?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number: string
          line_items?: Json | null
          notes?: string | null
          org_id: string
          paid_at?: string | null
          source?: string | null
          status?: string
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string | null
          vendor_name?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          customer_email?: string | null
          customer_name?: string | null
          due_date?: string | null
          external_id?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string
          line_items?: Json | null
          notes?: string | null
          org_id?: string
          paid_at?: string | null
          source?: string | null
          status?: string
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string | null
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_snapshots: {
        Row: {
          active_customers: number | null
          arr: number | null
          burn_rate: number | null
          cash_balance: number | null
          churn_rate: number | null
          churned_customers: number | null
          computed_at: string | null
          id: string
          month: string
          mrr: number | null
          net_income: number | null
          new_customers: number | null
          org_id: string
          runway_months: number | null
          total_expenses: number | null
          total_revenue: number | null
        }
        Insert: {
          active_customers?: number | null
          arr?: number | null
          burn_rate?: number | null
          cash_balance?: number | null
          churn_rate?: number | null
          churned_customers?: number | null
          computed_at?: string | null
          id?: string
          month: string
          mrr?: number | null
          net_income?: number | null
          new_customers?: number | null
          org_id: string
          runway_months?: number | null
          total_expenses?: number | null
          total_revenue?: number | null
        }
        Update: {
          active_customers?: number | null
          arr?: number | null
          burn_rate?: number | null
          cash_balance?: number | null
          churn_rate?: number | null
          churned_customers?: number | null
          computed_at?: string | null
          id?: string
          month?: string
          mrr?: number | null
          net_income?: number | null
          new_customers?: number | null
          org_id?: string
          runway_months?: number | null
          total_expenses?: number | null
          total_revenue?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_snapshots_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          created_at: string | null
          id: string
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          org_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          currency: string
          fiscal_year_start: number | null
          id: string
          industry: string | null
          name: string
          owner_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          currency?: string
          fiscal_year_start?: number | null
          id?: string
          industry?: string | null
          name: string
          owner_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string
          fiscal_year_start?: number | null
          id?: string
          industry?: string | null
          name?: string
          owner_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount: number
          cancelled_at: string | null
          created_at: string | null
          currency: string | null
          current_period_end: string | null
          current_period_start: string | null
          customer_id: string | null
          external_id: string | null
          id: string
          interval: string | null
          metadata: Json | null
          org_id: string
          plan_name: string | null
          source: string
          status: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          cancelled_at?: string | null
          created_at?: string | null
          currency?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          customer_id?: string | null
          external_id?: string | null
          id?: string
          interval?: string | null
          metadata?: Json | null
          org_id: string
          plan_name?: string | null
          source: string
          status: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          cancelled_at?: string | null
          created_at?: string | null
          currency?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          customer_id?: string | null
          external_id?: string | null
          id?: string
          interval?: string | null
          metadata?: Json | null
          org_id?: string
          plan_name?: string | null
          source?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_logs: {
        Row: {
          completed_at: string | null
          connection_id: string | null
          error_message: string | null
          id: string
          org_id: string
          provider: string
          records_skipped: number | null
          records_synced: number | null
          started_at: string | null
          status: string
          sync_type: string
        }
        Insert: {
          completed_at?: string | null
          connection_id?: string | null
          error_message?: string | null
          id?: string
          org_id: string
          provider: string
          records_skipped?: number | null
          records_synced?: number | null
          started_at?: string | null
          status: string
          sync_type: string
        }
        Update: {
          completed_at?: string | null
          connection_id?: string | null
          error_message?: string | null
          id?: string
          org_id?: string
          provider?: string
          records_skipped?: number | null
          records_synced?: number | null
          started_at?: string | null
          status?: string
          sync_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_logs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          amount_usd: number | null
          category: string | null
          category_confidence: string | null
          category_method: string | null
          created_at: string | null
          created_by: string | null
          currency: string
          customer_id: string | null
          date: string
          description: string | null
          id: string
          invoice_id: string | null
          is_reconciled: boolean | null
          is_reviewed: boolean | null
          notes: string | null
          org_id: string
          raw_metadata: Json | null
          receipt_url: string | null
          reconciled_with: string | null
          source: string
          source_account: string | null
          source_ref_id: string | null
          status: string | null
          subcategory: string | null
          tags: string[] | null
          type: string
          updated_at: string | null
          vendor: string | null
        }
        Insert: {
          amount: number
          amount_usd?: number | null
          category?: string | null
          category_confidence?: string | null
          category_method?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          date: string
          description?: string | null
          id?: string
          invoice_id?: string | null
          is_reconciled?: boolean | null
          is_reviewed?: boolean | null
          notes?: string | null
          org_id: string
          raw_metadata?: Json | null
          receipt_url?: string | null
          reconciled_with?: string | null
          source: string
          source_account?: string | null
          source_ref_id?: string | null
          status?: string | null
          subcategory?: string | null
          tags?: string[] | null
          type: string
          updated_at?: string | null
          vendor?: string | null
        }
        Update: {
          amount?: number
          amount_usd?: number | null
          category?: string | null
          category_confidence?: string | null
          category_method?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          date?: string
          description?: string | null
          id?: string
          invoice_id?: string | null
          is_reconciled?: boolean | null
          is_reviewed?: boolean | null
          notes?: string | null
          org_id?: string
          raw_metadata?: Json | null
          receipt_url?: string | null
          reconciled_with?: string | null
          source?: string
          source_account?: string | null
          source_ref_id?: string | null
          status?: string | null
          subcategory?: string | null
          tags?: string[] | null
          type?: string
          updated_at?: string | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_reconciled_with_fkey"
            columns: ["reconciled_with"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          created_at: string | null
          id: string
          llm_model: string | null
          llm_provider: string | null
          notification_prefs: Json | null
          org_id: string | null
          theme: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          llm_model?: string | null
          llm_provider?: string | null
          notification_prefs?: Json | null
          org_id?: string | null
          theme?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          llm_model?: string | null
          llm_provider?: string | null
          notification_prefs?: Json | null
          org_id?: string | null
          theme?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          created_at: string | null
          error: string | null
          event_id: string
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          provider: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          error?: string | null
          event_id: string
          event_type: string
          id?: string
          payload: Json
          processed_at?: string | null
          provider: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          error?: string | null
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
          status?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_org_id: { Args: never; Returns: string }
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
