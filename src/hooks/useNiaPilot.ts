import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getSupabaseNotConfiguredError,
  supabase,
} from "@/integrations/supabase/client";

export interface NiaPilotDashboard {
  agent_key: string;
  display_name: string;
  title: string;
  lifecycle_status: string;
  deployment_status: string;
  runtime_enabled: boolean;
  current_manifest_version: string;
  configuration_sync_status: string;
  reports_to_agent_key: string | null;
  supervisor_agent_name: string | null;
  accountable_human_role: string | null;
  drive_folder_id: string | null;
  workspace_route: string | null;
  pilot_status: string;
  external_actions_enabled: boolean;
  trigger_scope: string;
  required_scenario_count: number;
  passed_scenario_count: number;
  started_at: string | null;
  last_suite_at: string | null;
  last_case_queue_run_at: string | null;
  last_error: string | null;
  enabled_trigger_count: number;
  case_count: number;
  pilot_run_count: number;
  pending_review_count: number;
  pending_communication_count: number;
  audit_event_count: number;
  passed_gate_count: number;
  pending_gate_count: number;
  required_scenario_total: number;
  required_scenario_passed: number;
}

export interface NiaPilotCase {
  id: string;
  reference_number: string;
  organization_name: string | null;
  workflow_stage: string;
  status: string;
  priority: string;
  risk_level: string;
  match_confidence: string;
  approval_required: boolean;
  next_action: string | null;
  due_at: string | null;
  unmatched_reason: string | null;
  applicant_country: string | null;
  pending_review_count: number;
  latest_run_summary: string | null;
  latest_run_at: string | null;
}

export interface NiaPilotScenario {
  scenario_key: string;
  title: string;
  source_ngo_common_name: string;
  expected_risk_level: string;
  expected_match_confidence: string;
  expected_approval_required: boolean;
  is_required: boolean;
  sort_order: number;
  test_contract: Record<string, unknown>;
}

export interface NiaPilotScenarioResult {
  scenario_key: string;
  manifest_version: string;
  passed: boolean;
  actual_risk_level: string | null;
  actual_match_confidence: string | null;
  actual_approval_required: boolean | null;
  checks: Record<string, boolean>;
  result_summary: string;
  executed_at: string;
}

export interface NiaActivationGate {
  gate_key: string;
  gate_status: string;
  evidence: Record<string, unknown>;
  notes: string | null;
  recorded_at: string | null;
  updated_at: string;
}

export interface NiaReviewRequest {
  id: string;
  case_registry_id: string;
  review_type: string;
  reviewer_role: string;
  status: string;
  question: string;
  recommendation: string | null;
  evidence: Record<string, unknown>;
  created_at: string;
}

export interface NiaPilotResult {
  dashboard: NiaPilotDashboard | null;
  cases: NiaPilotCase[];
  scenarios: Array<NiaPilotScenario & { result: NiaPilotScenarioResult | null }>;
  gates: NiaActivationGate[];
  reviews: NiaReviewRequest[];
  runtimeReady: boolean;
  runtimeMessage: string | null;
}

const ensureSupabase = () => {
  if (!supabase) throw getSupabaseNotConfiguredError();
  return supabase;
};

const isMissingPhaseTwoSchema = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };
  const message = candidate.message?.toLowerCase() || "";
  return (
    candidate.code === "42P01" ||
    candidate.code === "PGRST205" ||
    message.includes("agent_os_nia_pilot_dashboard") ||
    message.includes("agent_pilot_scenarios")
  );
};

export function useNiaPilot() {
  return useQuery<NiaPilotResult>({
    queryKey: ["nia-controlled-pilot"],
    enabled: !!supabase,
    refetchInterval: 60_000,
    queryFn: async () => {
      const client = ensureSupabase();
      const [dashboardResponse, caseResponse, scenarioResponse, resultResponse, gateResponse, reviewResponse] =
        await Promise.all([
          client.from("agent_os_nia_pilot_dashboard" as never).select("*" as never).maybeSingle(),
          client
            .from("agent_os_nia_case_queue" as never)
            .select("*" as never)
            .order("updated_at" as never, { ascending: false }),
          client
            .from("agent_pilot_scenarios" as never)
            .select("*" as never)
            .eq("agent_key" as never, "hpg-aos-024" as never)
            .order("sort_order" as never, { ascending: true }),
          client
            .from("agent_pilot_scenario_results" as never)
            .select("scenario_key, manifest_version, passed, actual_risk_level, actual_match_confidence, actual_approval_required, checks, result_summary, executed_at" as never)
            .eq("agent_key" as never, "hpg-aos-024" as never),
          client
            .from("agent_activation_gate_evidence" as never)
            .select("gate_key, gate_status, evidence, notes, recorded_at, updated_at" as never)
            .eq("agent_key" as never, "hpg-aos-024" as never)
            .order("gate_key" as never, { ascending: true }),
          client
            .from("agent_review_requests" as never)
            .select("id, case_registry_id, review_type, reviewer_role, status, question, recommendation, evidence, created_at" as never)
            .eq("agent_key" as never, "hpg-aos-024" as never)
            .eq("status" as never, "pending" as never)
            .order("created_at" as never, { ascending: false }),
        ]);

      const errors = [
        dashboardResponse.error,
        caseResponse.error,
        scenarioResponse.error,
        resultResponse.error,
        gateResponse.error,
        reviewResponse.error,
      ].filter(Boolean);

      if (errors.length > 0) {
        const error = errors[0];
        if (isMissingPhaseTwoSchema(error)) {
          return {
            dashboard: null,
            cases: [],
            scenarios: [],
            gates: [],
            reviews: [],
            runtimeReady: false,
            runtimeMessage: "The Nia controlled-pilot runtime has not been deployed to this Supabase environment.",
          };
        }
        throw error;
      }

      const results = (resultResponse.data || []) as unknown as NiaPilotScenarioResult[];
      const resultByScenario = new Map(results.map((result) => [result.scenario_key, result]));
      const scenarios = ((scenarioResponse.data || []) as unknown as NiaPilotScenario[]).map((scenario) => ({
        ...scenario,
        result: resultByScenario.get(scenario.scenario_key) || null,
      }));

      return {
        dashboard: (dashboardResponse.data || null) as unknown as NiaPilotDashboard | null,
        cases: (caseResponse.data || []) as unknown as NiaPilotCase[],
        scenarios,
        gates: (gateResponse.data || []) as unknown as NiaActivationGate[],
        reviews: (reviewResponse.data || []) as unknown as NiaReviewRequest[],
        runtimeReady: true,
        runtimeMessage: null,
      };
    },
  });
}

function useNiaPilotMutation(functionName: string) {
  const queryClient = useQueryClient();
  return useMutation<Record<string, unknown>, Error>({
    mutationFn: async () => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc(functionName as never);
      if (error) throw error;
      return (data || {}) as unknown as Record<string, unknown>;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["nia-controlled-pilot"] });
      await queryClient.invalidateQueries({ queryKey: ["agent-os-cases"] });
      await queryClient.invalidateQueries({ queryKey: ["agent-os-operations"] });
    },
  });
}

export const useRefreshNiaCases = () => useNiaPilotMutation("agent_os_register_program_coordination_cases");
export const useRunNiaCaseQueue = () => useNiaPilotMutation("agent_os_run_nia_case_queue");
export const useRunNiaScenarioSuite = () => useNiaPilotMutation("agent_os_run_nia_scenario_suite");
