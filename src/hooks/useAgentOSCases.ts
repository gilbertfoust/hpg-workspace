import { useQuery } from "@tanstack/react-query";
import {
  getSupabaseNotConfiguredError,
  isSupabaseNotConfiguredError,
  supabase,
} from "@/integrations/supabase/client";

export type AgentOSRiskLevel =
  | "low"
  | "moderate"
  | "elevated"
  | "high"
  | "insufficient_information";

export type AgentOSMatchConfidence = "high" | "moderate" | "low" | "unknown";
export type AgentOSJurisdictionClass = "us_domestic" | "international" | null;

export interface AgentOSCase {
  id: string;
  reference_number: string;
  case_type: string;
  ngo_id: string | null;
  person_name: string | null;
  organization_name: string | null;
  primary_email: string | null;
  department_id: string | null;
  subdepartment_function: string | null;
  owner_user_id: string | null;
  supervisor_user_id: string | null;
  workflow_stage: string;
  status: string;
  priority: string;
  risk_level: AgentOSRiskLevel;
  match_confidence: AgentOSMatchConfidence;
  approval_required: boolean;
  drive_folder_url: string | null;
  trello_card_id: string | null;
  next_action: string | null;
  due_at: string | null;
  unmatched_reason: string | null;
  applicant_country: string | null;
  jurisdiction_class: AgentOSJurisdictionClass;
  activation_fee_policy_key: string | null;
  activation_fee_amount_cents: number | null;
  activation_fee_currency: string | null;
  activation_fee_form_sent_at: string | null;
  activation_fee_verified_at: string | null;
  activation_fee_payment_reference: string | null;
  metadata: Record<string, unknown> | null;
  updated_at: string;
  created_at: string;
}

export interface AgentOSCaseQueueResult {
  cases: AgentOSCase[];
  runtimeReady: boolean;
  runtimeMessage: string | null;
}

interface AgentOSCaseFilters {
  ngoId?: string;
  departmentId?: string;
  limit?: number;
}

const ensureSupabase = () => {
  if (!supabase) throw getSupabaseNotConfiguredError();
  return supabase;
};

const isMissingRuntimeSchema = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };
  return (
    candidate.code === "42P01" ||
    candidate.code === "PGRST205" ||
    candidate.message?.toLowerCase().includes("case_registry") === true
  );
};

export function useAgentOSCases(filters: AgentOSCaseFilters = {}) {
  const { ngoId, departmentId, limit = 50 } = filters;

  return useQuery<AgentOSCaseQueueResult>({
    queryKey: ["agent-os-cases", ngoId || null, departmentId || null, limit],
    enabled: !!supabase,
    queryFn: async () => {
      const client = ensureSupabase();
      let query = client
        .from("case_registry" as never)
        .select(
          "id, reference_number, case_type, ngo_id, person_name, organization_name, primary_email, department_id, subdepartment_function, owner_user_id, supervisor_user_id, workflow_stage, status, priority, risk_level, match_confidence, approval_required, drive_folder_url, trello_card_id, next_action, due_at, unmatched_reason, applicant_country, jurisdiction_class, activation_fee_policy_key, activation_fee_amount_cents, activation_fee_currency, activation_fee_form_sent_at, activation_fee_verified_at, activation_fee_payment_reference, metadata, updated_at, created_at" as never,
        )
        .is("archived_at" as never, null)
        .order("updated_at" as never, { ascending: false })
        .limit(limit);

      if (ngoId) query = query.eq("ngo_id" as never, ngoId as never);
      if (departmentId) query = query.eq("department_id" as never, departmentId as never);

      const { data, error } = await query;

      if (error) {
        if (isMissingRuntimeSchema(error)) {
          return {
            cases: [],
            runtimeReady: false,
            runtimeMessage:
              "The Agent OS runtime migration is committed but has not been deployed to this Supabase environment.",
          };
        }
        throw error;
      }

      return {
        cases: (data || []) as unknown as AgentOSCase[],
        runtimeReady: true,
        runtimeMessage: null,
      };
    },
  });
}

export { isSupabaseNotConfiguredError };
