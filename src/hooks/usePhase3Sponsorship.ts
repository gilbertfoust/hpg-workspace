import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getSupabaseNotConfiguredError,
  supabase,
} from "@/integrations/supabase/client";

export interface Phase3Dashboard {
  workflow_key: string;
  workflow_version: string;
  title: string;
  workflow_status: string;
  operating_mode: string;
  authoritative_source: string;
  external_actions_enabled: boolean;
  authoritative_mutations_enabled: boolean;
  required_scenario_count: number;
  passed_scenario_count: number;
  last_validation_run_id: string | null;
  last_validation_at: string | null;
  last_error: string | null;
  latest_validation_status: string;
  latest_validation_run_key: string | null;
  latest_scenario_count: number | null;
  latest_passed_scenario_count: number | null;
  latest_assertion_count: number | null;
  latest_failed_assertion_count: number | null;
  latest_external_side_effect_count: number | null;
  latest_authoritative_mutation_count: number | null;
  latest_validation_started_at: string | null;
  latest_validation_completed_at: string | null;
  latest_validation_summary: string | null;
  latest_authoritative_unchanged: boolean;
  stage_count: number;
  shadow_assignment_count: number;
  shadow_case_count: number;
  latest_synthetic_case_count: number;
  latest_stage_run_count: number;
  latest_handoff_count: number;
  latest_pending_case_review_count: number;
  required_gate_count: number;
  passed_gate_count: number;
  pending_gate_count: number;
  failed_gate_count: number;
  automated_security_gates_passed: number;
  human_gates_pending: number;
  workspace_route: string;
}

export interface Phase3Stage {
  stage_key: string;
  stage_order: number;
  stage_name: string;
  department_name: string;
  owner_agent_key: string;
  owner_agent_name: string;
  owner_agent_title: string;
  supervisor_agent_key: string | null;
  supervisor_agent_name: string | null;
  human_authority_role: string;
  decision_class: string;
  required_inputs: unknown[];
  required_outputs: unknown[];
  exit_criteria: unknown[];
  next_stage_key: string | null;
  is_terminal: boolean;
  shadow_assignment_count: number;
  latest_stage_run_count: number;
  latest_validated_run_count: number;
  latest_held_run_count: number;
}

export interface Phase3ScenarioResult {
  scenario_key: string;
  sort_order: number;
  title: string;
  scenario_type: string;
  expected_stop_stage_key: string;
  expected_stop_stage_name: string;
  expected_human_gate: boolean;
  expected_outcome: string;
  assertion_count: number;
  passed_assertion_count: number;
  failed_assertion_count: number;
  passed: boolean;
  stage_run_count: number;
  handoff_count: number;
  case_status: string | null;
  current_control_stage_key: string | null;
  risk_level: string | null;
  match_confidence: string | null;
  last_stage_completed_at: string | null;
  last_validation_run_id: string | null;
}

export interface Phase3Case {
  source_profile_id: string;
  ngo_id: string;
  hpg_profile_number: string | null;
  profile_reference: string;
  legal_name: string;
  common_name: string | null;
  country: string | null;
  state_province: string | null;
  city: string | null;
  source_stage_key: string;
  source_stage_order: number;
  source_stage_name: string;
  mapped_control_stage_key: string;
  control_stage_order: number;
  control_stage_name: string;
  assigned_agent_key: string;
  assigned_agent_name: string;
  assigned_agent_title: string;
  supervisor_agent_name: string | null;
  human_authority_role: string;
  decision_class: string;
  source_workflow_status: string;
  priority: string;
  risk_level: string;
  next_action: string | null;
  due_at: string | null;
  historical_import: boolean;
  evidence_reconstruction_required: boolean;
  source_revision: number;
  source_snapshot_sha256: string | null;
  shadow_status: string;
  assessed_at: string | null;
  case_registry_id: string | null;
  reference_number: string | null;
  runtime_case_status: string | null;
  sponsorship_case_id: string | null;
  sponsorship_runtime_status: string | null;
  human_review_required: boolean | null;
  outcome_summary: string | null;
}

export interface Phase3HumanGate {
  gate_key: string;
  sort_order: number;
  gate_title: string;
  gate_description: string;
  required_reviewer_role: string | null;
  is_required: boolean;
  gate_status: string;
  evidence: Record<string, unknown>;
  notes: string | null;
  recorded_by_name: string | null;
  recorded_at: string | null;
  work_item_id: string | null;
  work_item_module: string | null;
  work_item_status: string | null;
  work_item_priority: string | null;
  work_item_due_date: string | null;
  evidence_required: boolean | null;
  approval_required: boolean | null;
  work_item_completed_at: string | null;
}

export interface Phase3Handoff {
  id: string;
  validation_run_id: string;
  scenario_key: string;
  organization_name: string;
  workflow_case_id: string;
  handoff_sequence: number;
  from_stage_key: string;
  from_stage_name: string;
  to_stage_key: string;
  to_stage_name: string;
  from_agent_key: string;
  from_agent_name: string;
  to_agent_key: string;
  to_agent_name: string;
  status: string;
  acceptance_required: boolean;
  packet_sha256: string;
  accepted_at: string | null;
  dry_run: boolean;
  authoritative_mutation_allowed: boolean;
  created_at: string;
}

export interface Phase3SponsorshipResult {
  dashboard: Phase3Dashboard | null;
  stages: Phase3Stage[];
  scenarios: Phase3ScenarioResult[];
  cases: Phase3Case[];
  gates: Phase3HumanGate[];
  handoffs: Phase3Handoff[];
  runtimeReady: boolean;
  runtimeMessage: string | null;
}

const ensureSupabase = () => {
  if (!supabase) throw getSupabaseNotConfiguredError();
  return supabase;
};

const isMissingPhaseThreeSchema = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };
  const message = candidate.message?.toLowerCase() || "";
  return (
    candidate.code === "42P01" ||
    candidate.code === "PGRST205" ||
    message.includes("agent_os_phase3_dashboard") ||
    message.includes("agent_sponsorship_workflows")
  );
};

export function usePhase3Sponsorship() {
  return useQuery<Phase3SponsorshipResult>({
    queryKey: ["agent-os-phase-3-sponsorship"],
    enabled: !!supabase,
    refetchInterval: 60_000,
    queryFn: async () => {
      const client = ensureSupabase();
      const [dashboard, stages, scenarios, cases, gates, handoffs] = await Promise.all([
        client.from("agent_os_phase3_dashboard" as never).select("*" as never).maybeSingle(),
        client.from("agent_os_phase3_stage_matrix" as never).select("*" as never).order("stage_order" as never),
        client.from("agent_os_phase3_validation_results" as never).select("*" as never).order("sort_order" as never),
        client.from("agent_os_phase3_case_queue" as never).select("*" as never).order("source_stage_order" as never).limit(250),
        client.from("agent_os_phase3_human_gates" as never).select("*" as never).order("sort_order" as never),
        client.from("agent_os_phase3_handoff_evidence" as never).select("*" as never).order("handoff_sequence" as never).limit(250),
      ]);

      const firstError = [dashboard.error, stages.error, scenarios.error, cases.error, gates.error, handoffs.error].find(Boolean);
      if (firstError) {
        if (isMissingPhaseThreeSchema(firstError)) {
          return {
            dashboard: null,
            stages: [],
            scenarios: [],
            cases: [],
            gates: [],
            handoffs: [],
            runtimeReady: false,
            runtimeMessage: "The Phase 3 sponsorship runtime has not been deployed to this Supabase environment.",
          };
        }
        throw firstError;
      }

      return {
        dashboard: (dashboard.data || null) as unknown as Phase3Dashboard | null,
        stages: (stages.data || []) as unknown as Phase3Stage[],
        scenarios: (scenarios.data || []) as unknown as Phase3ScenarioResult[],
        cases: (cases.data || []) as unknown as Phase3Case[],
        gates: (gates.data || []) as unknown as Phase3HumanGate[],
        handoffs: (handoffs.data || []) as unknown as Phase3Handoff[],
        runtimeReady: true,
        runtimeMessage: null,
      };
    },
  });
}

function usePhase3Action(functionName: string) {
  const queryClient = useQueryClient();
  return useMutation<Record<string, unknown>, Error>({
    mutationFn: async () => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc(functionName as never);
      if (error) throw error;
      return (data || {}) as unknown as Record<string, unknown>;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["agent-os-phase-3-sponsorship"] });
      await queryClient.invalidateQueries({ queryKey: ["agent-os-cases"] });
      await queryClient.invalidateQueries({ queryKey: ["work-items"] });
    },
  });
}

export const useRefreshPhase3ShadowCases = () => usePhase3Action("agent_os_phase3_refresh_shadow_assignments");
export const useRunPhase3Validation = () => usePhase3Action("agent_os_phase3_run_validation");

export function useRecordPhase3GateReview() {
  const queryClient = useQueryClient();
  return useMutation<
    Record<string, unknown>,
    Error,
    { gateKey: string; status: "passed" | "failed" | "waived"; notes: string; evidenceReference: string }
  >({
    mutationFn: async ({ gateKey, status, notes, evidenceReference }) => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc("agent_os_phase3_record_gate_review" as never, {
        p_gate_key: gateKey,
        p_status: status,
        p_notes: notes,
        p_evidence: {
          evidence_reference: evidenceReference,
          reviewed_from_workspace: true,
          workspace_route: "/modules/ngo-coordination#phase-3",
        },
      } as never);
      if (error) throw error;
      return (data || {}) as unknown as Record<string, unknown>;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["agent-os-phase-3-sponsorship"] });
      await queryClient.invalidateQueries({ queryKey: ["work-items"] });
    },
  });
}
