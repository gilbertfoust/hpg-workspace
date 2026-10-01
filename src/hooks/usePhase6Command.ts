import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getSupabaseNotConfiguredError,
  supabase,
} from "@/integrations/supabase/client";

export interface Phase6Dashboard {
  program_key: string;
  title: string;
  program_version: string;
  program_status: string;
  operating_mode: string;
  executive_agent_key: string | null;
  executive_agent_name: string | null;
  executive_agent_title: string | null;
  executive_authority_user_id: string | null;
  executive_authority_name: string | null;
  executive_authority_email: string | null;
  authoritative_source: string;
  refresh_frequency_minutes: number;
  native_workspace_authoritative: boolean;
  department_snapshots_enabled: boolean;
  decision_packet_generation_enabled: boolean;
  scheduled_refresh_enabled: boolean;
  trello_operational_enabled: boolean;
  external_actions_enabled: boolean;
  autonomous_decisions_enabled: boolean;
  source_mutations_enabled: boolean;
  assignment_execution_enabled: boolean;
  required_scenario_count: number;
  passed_scenario_count: number;
  last_refresh_run_id: string | null;
  last_refresh_at: string | null;
  next_scheduled_refresh_at: string | null;
  last_validation_run_id: string | null;
  last_validation_at: string | null;
  last_error: string | null;
  metadata: Record<string, unknown>;
  active_department_count: number;
  configured_agent_count: number;
  active_native_board_count: number;
  active_board_binding_count: number;
  active_assignment_count: number;
  blocked_assignment_count: number;
  critical_department_count: number;
  high_risk_department_count: number;
  active_decision_count: number;
  queued_decision_count: number;
  under_review_decision_count: number;
  critical_decision_count: number;
  overdue_decision_count: number;
  automated_security_gates_passed: number;
  human_gates_pending: number;
  failed_gate_count: number;
  latest_refresh_status: string | null;
  latest_refresh_mode: string | null;
  latest_source_work_item_count: number | null;
  latest_assignment_count: number | null;
  latest_assignments_created: number | null;
  latest_assignments_updated: number | null;
  latest_assignments_closed: number | null;
  latest_snapshot_count: number | null;
  latest_decision_candidates: number | null;
  latest_decisions_created: number | null;
  latest_decisions_updated: number | null;
  latest_brief_count: number | null;
  latest_refresh_external_side_effect_count: number | null;
  latest_refresh_source_mutation_count: number | null;
  latest_refresh_completed_at: string | null;
  latest_validation_status: string | null;
  latest_validation_scenario_count: number | null;
  latest_validation_passed_scenario_count: number | null;
  latest_validation_assertion_count: number | null;
  latest_validation_failed_assertion_count: number | null;
  latest_validation_external_side_effect_count: number | null;
  latest_validation_source_mutation_count: number | null;
  latest_validation_source_fingerprint_unchanged: boolean | null;
  latest_validation_completed_at: string | null;
  schedule_job_id: number | null;
  schedule_expression: string | null;
  schedule_active: boolean | null;
}

export interface Phase6Department {
  profile_key: string;
  module_key: string;
  display_name: string;
  access_area: string;
  workspace_department_id: string | null;
  workspace_department_name: string | null;
  agent_department_code: string | null;
  lead_agent_key: string;
  lead_agent_name: string | null;
  lead_agent_title: string | null;
  routing_agent_key: string | null;
  routing_agent_name: string | null;
  monitoring_agent_key: string | null;
  monitoring_agent_name: string | null;
  accountable_human_role: string;
  workspace_route: string;
  virtual_board_key: string;
  board_keys: string[];
  capacity_thresholds: Record<string, unknown>;
  priority_weights: Record<string, unknown>;
  is_active: boolean;
  metadata: Record<string, unknown>;
  snapshot_id: string | null;
  refresh_run_id: string | null;
  as_of: string | null;
  open_work_count: number | null;
  overdue_work_count: number | null;
  due_seven_days_count: number | null;
  unowned_work_count: number | null;
  unowned_due_seven_days_count: number | null;
  blocked_work_count: number | null;
  high_priority_work_count: number | null;
  evidence_gap_count: number | null;
  approval_pending_count: number | null;
  active_alert_count: number | null;
  critical_alert_count: number | null;
  high_risk_alert_count: number | null;
  active_assignment_count: number | null;
  active_board_count: number | null;
  agent_count: number | null;
  capacity_score: number | null;
  risk_score: number | null;
  decision_pressure_score: number | null;
  health_status: string | null;
  trend_direction: string | null;
  executive_summary: string | null;
  principal_risks: Array<Record<string, unknown>> | null;
  recommended_actions: Array<Record<string, unknown>> | null;
  source_snapshot_sha256: string | null;
  active_capacity_decision_count: number;
}

export interface Phase6Assignment {
  assignment_id: string;
  program_key: string;
  work_item_id: string;
  department_profile_key: string;
  department_name: string;
  module_key: string;
  access_area: string;
  assigned_agent_key: string;
  assigned_agent_name: string | null;
  assigned_agent_title: string | null;
  routing_agent_key: string | null;
  routing_agent_name: string | null;
  assigned_human_user_id: string | null;
  assigned_human_name: string | null;
  assignment_status: string;
  assignment_mode: string;
  assignment_source: string;
  assignment_reason: string;
  confidence_score: number;
  priority_score: number;
  risk_score: number;
  source_status: string | null;
  source_priority: string | null;
  source_due_date: string | null;
  source_owner_user_id: string | null;
  source_owner_name: string | null;
  source_snapshot: Record<string, unknown>;
  source_snapshot_sha256: string;
  latest_refresh_run_id: string | null;
  first_assigned_at: string;
  last_refreshed_at: string;
  acknowledged_by_user_id: string | null;
  acknowledged_by_name: string | null;
  acknowledged_at: string | null;
  acknowledgement_notes: string | null;
  completed_at: string | null;
  completion_reason: string | null;
  created_at: string;
  updated_at: string;
  ngo_id: string | null;
  ngo_common_name: string | null;
  ngo_legal_name: string | null;
  work_type: string | null;
  work_title: string;
  work_description: string | null;
  work_status: string | null;
  work_priority: string | null;
  work_due_date: string | null;
  work_start_date: string | null;
  department_id: string | null;
  owner_user_id: string | null;
  evidence_required: boolean;
  evidence_status: string | null;
  approval_required: boolean;
  approver_user_id: string | null;
  source_system: string | null;
  source_event_id: string | null;
  hpg_reference_number: string | null;
  workflow_stage: string | null;
  risk_level: string | null;
  next_action: string | null;
}

export interface Phase6Brief {
  id: string;
  brief_reference: string;
  refresh_run_id: string;
  prepared_by_agent_key: string;
  prepared_by_agent_name: string;
  prepared_by_agent_title: string;
  executive_authority_user_id: string;
  executive_authority_name: string;
  as_of: string;
  overall_health_status: string;
  overall_risk_score: number;
  active_department_count: number;
  critical_department_count: number;
  active_decision_count: number;
  critical_decision_count: number;
  headline: string;
  executive_summary: string;
  department_summaries: Array<Record<string, unknown>>;
  top_risks: Array<Record<string, unknown>>;
  top_decisions: Array<Record<string, unknown>>;
  opportunities: Array<Record<string, unknown>>;
  limitations: Array<Record<string, unknown>>;
  source_snapshot: Record<string, unknown>;
  source_snapshot_sha256: string;
  packet_sha256: string;
  external_action_count: number;
  authoritative_source_mutation_count: number;
  created_at: string;
}

export interface Phase6Decision {
  id: string;
  decision_reference: string;
  decision_fingerprint: string;
  source_type: string;
  source_table: string;
  source_record_id: string | null;
  source_access_area: string;
  confidentiality: string;
  category: string;
  decision_type: string;
  title: string;
  decision_question: string;
  context_summary: string;
  current_state: string | null;
  decision_required_by: string | null;
  status: string;
  urgency_score: number;
  impact_score: number;
  reversibility_score: number;
  evidence_strength_score: number;
  confidence_score: number;
  readiness_score: number;
  priority_score: number;
  severity_key: string;
  prepared_by_agent_key: string;
  prepared_by_agent_name: string;
  requested_by_agent_key: string | null;
  requested_by_agent_name: string | null;
  decision_authority_user_id: string;
  decision_authority_name: string;
  accountable_human_role: string;
  recommended_option_key: string | null;
  recommendation_summary: string | null;
  recommendation_rationale: string | null;
  dissent_summary: string | null;
  assumptions: unknown[];
  dependencies: unknown[];
  risks: unknown[];
  expected_outcomes: unknown[];
  source_snapshot: Record<string, unknown>;
  source_snapshot_sha256: string;
  packet_sha256: string;
  latest_refresh_run_id: string | null;
  occurrence_count: number;
  first_queued_at: string;
  last_refreshed_at: string;
  review_started_by_user_id: string | null;
  review_started_by_name: string | null;
  review_started_at: string | null;
  decision_code: string | null;
  decision_text: string | null;
  decision_rationale: string | null;
  conditions: unknown[];
  decided_by_user_id: string | null;
  decided_by_name: string | null;
  decided_at: string | null;
  decision_evidence_reference: string | null;
  external_action_requested: boolean;
  autonomous_execution_enabled: boolean;
  created_at: string;
  updated_at: string;
  option_count: number;
  evidence_count: number;
  position_count: number;
  dissent_count: number;
  event_count: number;
}

export interface Phase6DecisionOption {
  id: string;
  decision_item_id: string;
  decision_reference: string;
  decision_title: string;
  option_key: string;
  label: string;
  description: string;
  recommendation_rank: number;
  is_recommended: boolean;
  estimated_effort: string | null;
  estimated_timeline: string | null;
  expected_benefits: unknown[];
  risks: unknown[];
  conditions: unknown[];
  reversible: boolean;
  consequence_summary: string;
  created_at: string;
}

export interface Phase6DecisionEvidence {
  id: string;
  decision_item_id: string;
  decision_reference: string;
  decision_title: string;
  evidence_type: string;
  source_system: string;
  source_table: string | null;
  source_record_id: string | null;
  evidence_reference: string | null;
  evidence_summary: string;
  evidence_snapshot: Record<string, unknown>;
  evidence_sha256: string;
  evidence_strength_score: number;
  is_primary: boolean;
  created_at: string;
}

export interface Phase6DecisionPosition {
  id: string;
  decision_item_id: string;
  decision_reference: string;
  decision_title: string;
  agent_key: string;
  agent_name: string;
  agent_title: string;
  position_type: string;
  option_key: string | null;
  summary: string;
  rationale: string;
  confidence_score: number;
  evidence_references: unknown[];
  created_by_user_id: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Phase6DecisionEvent {
  id: string;
  decision_item_id: string;
  decision_reference: string;
  decision_title: string;
  event_type: string;
  actor_user_id: string | null;
  actor_user_name: string | null;
  actor_agent_key: string | null;
  actor_agent_name: string | null;
  before_state: Record<string, unknown>;
  after_state: Record<string, unknown>;
  evidence: Record<string, unknown>;
  previous_event_sha256: string | null;
  event_sha256: string;
  created_at: string;
}

export interface Phase6Refresh {
  id: string;
  run_key: string;
  run_mode: string;
  status: string;
  as_of: string;
  department_count: number;
  board_count: number;
  source_work_item_count: number;
  assignment_count: number;
  assignments_created: number;
  assignments_updated: number;
  assignments_closed: number;
  snapshot_count: number;
  decision_candidates: number;
  decisions_created: number;
  decisions_updated: number;
  brief_count: number;
  external_side_effect_count: number;
  authoritative_source_mutation_count: number;
  triggered_by_user_id: string | null;
  triggered_by_name: string | null;
  started_at: string;
  completed_at: string | null;
  summary: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
}

export interface Phase6Scenario {
  scenario_key: string;
  title: string;
  scenario_type: string;
  description: string;
  expected_result: string;
  is_required: boolean;
  sort_order: number;
  validation_run_id: string | null;
  run_key: string | null;
  validation_status: string | null;
  assertion_count: number;
  passed_assertion_count: number;
  failed_assertion_count: number;
  passed: boolean;
  assertions: Array<{
    assertion_key: string;
    passed: boolean;
    expected: unknown;
    actual: unknown;
    detail: string;
    source_lineage: Record<string, unknown>;
  }> | null;
  completed_at: string | null;
}

export interface Phase6Gate {
  program_key: string;
  gate_key: string;
  gate_group: string;
  gate_title: string;
  gate_description: string;
  required_reviewer_role: string | null;
  gate_status: string;
  is_required: boolean;
  sort_order: number;
  evidence: Record<string, unknown>;
  notes: string | null;
  work_item_id: string | null;
  work_item_status: string | null;
  work_item_priority: string | null;
  work_item_due_date: string | null;
  work_item_owner_user_id: string | null;
  work_item_owner_name: string | null;
  recorded_by_user_id: string | null;
  recorded_by_name: string | null;
  recorded_at: string | null;
  updated_at: string;
}

export interface Phase6BoardCoverage {
  board_key: string;
  display_name: string;
  access_area: string;
  movement_mode: string;
  source_route_template: string | null;
  is_active: boolean;
  department_profile_key: string | null;
  department_name: string | null;
  module_key: string | null;
  default_agent_key: string | null;
  default_agent_name: string | null;
  default_agent_title: string | null;
  binding_role: string | null;
  binding_status: string | null;
  binding_reason: string | null;
  metadata: Record<string, unknown> | null;
  updated_at: string | null;
}

export interface Phase6NativeCutover {
  program_key: string;
  total_agent_count: number;
  historical_only_trello_agent_count: number;
  agents_with_workspace_routes: number;
  active_native_board_count: number;
  native_agent_work_board_count: number;
  active_board_binding_count: number;
  trello_synced_work_item_count: number;
  active_trello_queue_count: number;
  native_workspace_authoritative: boolean;
  trello_operational_enabled: boolean;
  external_actions_enabled: boolean;
  autonomous_decisions_enabled: boolean;
  source_mutations_enabled: boolean;
  assignment_execution_enabled: boolean;
}

export interface Phase6CommandResult {
  dashboard: Phase6Dashboard | null;
  departments: Phase6Department[];
  assignments: Phase6Assignment[];
  briefs: Phase6Brief[];
  decisions: Phase6Decision[];
  options: Phase6DecisionOption[];
  evidence: Phase6DecisionEvidence[];
  positions: Phase6DecisionPosition[];
  events: Phase6DecisionEvent[];
  refreshes: Phase6Refresh[];
  scenarios: Phase6Scenario[];
  gates: Phase6Gate[];
  boards: Phase6BoardCoverage[];
  cutover: Phase6NativeCutover | null;
  runtimeReady: boolean;
  runtimeMessage: string | null;
}

const queryKey = ["agent-os-phase-6-command"] as const;

const ensureSupabase = () => {
  if (!supabase) throw getSupabaseNotConfiguredError();
  return supabase;
};

const isMissingPhaseSixSchema = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };
  const message = candidate.message?.toLowerCase() || "";
  return (
    candidate.code === "42P01" ||
    candidate.code === "PGRST205" ||
    message.includes("agent_os_phase6_dashboard") ||
    message.includes("agent_workspace_programs")
  );
};

export function usePhase6Command() {
  return useQuery<Phase6CommandResult>({
    queryKey,
    enabled: !!supabase,
    refetchInterval: 60_000,
    queryFn: async () => {
      const client = ensureSupabase();
      const [dashboard, departments, assignments, briefs, decisions, options, evidence, positions, events, refreshes, scenarios, gates, boards, cutover] = await Promise.all([
        client.from("agent_os_phase6_dashboard" as never).select("*" as never).maybeSingle(),
        client.from("agent_os_phase6_department_command" as never).select("*" as never).order("risk_score" as never, { ascending: false }),
        client.from("agent_os_phase6_agent_work_queue" as never).select("*" as never).order("priority_score" as never, { ascending: false }).limit(1000),
        client.from("agent_os_phase6_executive_briefs" as never).select("*" as never).order("as_of" as never, { ascending: false }).limit(50),
        client.from("agent_os_phase6_decision_queue" as never).select("*" as never).order("priority_score" as never, { ascending: false }).limit(500),
        client.from("agent_os_phase6_decision_options" as never).select("*" as never).order("recommendation_rank" as never).limit(1500),
        client.from("agent_os_phase6_decision_evidence" as never).select("*" as never).order("is_primary" as never, { ascending: false }).order("created_at" as never).limit(2000),
        client.from("agent_os_phase6_decision_positions" as never).select("*" as never).order("created_at" as never).limit(1500),
        client.from("agent_os_phase6_decision_events" as never).select("*" as never).order("created_at" as never, { ascending: false }).limit(2000),
        client.from("agent_os_phase6_refresh_history" as never).select("*" as never).order("started_at" as never, { ascending: false }).limit(100),
        client.from("agent_os_phase6_validation_results" as never).select("*" as never).order("sort_order" as never),
        client.from("agent_os_phase6_governance" as never).select("*" as never).order("sort_order" as never),
        client.from("agent_os_phase6_board_coverage" as never).select("*" as never).order("display_name" as never),
        client.from("agent_os_phase6_native_cutover" as never).select("*" as never).maybeSingle(),
      ]);

      const firstError = [
        dashboard.error,
        departments.error,
        assignments.error,
        briefs.error,
        decisions.error,
        options.error,
        evidence.error,
        positions.error,
        events.error,
        refreshes.error,
        scenarios.error,
        gates.error,
        boards.error,
        cutover.error,
      ].find(Boolean);

      if (firstError) {
        if (isMissingPhaseSixSchema(firstError)) {
          return {
            dashboard: null,
            departments: [],
            assignments: [],
            briefs: [],
            decisions: [],
            options: [],
            evidence: [],
            positions: [],
            events: [],
            refreshes: [],
            scenarios: [],
            gates: [],
            boards: [],
            cutover: null,
            runtimeReady: false,
            runtimeMessage: "The Phase 6 Workspace-native command runtime has not been deployed to this Supabase environment.",
          };
        }
        throw firstError;
      }

      return {
        dashboard: (dashboard.data || null) as unknown as Phase6Dashboard | null,
        departments: (departments.data || []) as unknown as Phase6Department[],
        assignments: (assignments.data || []) as unknown as Phase6Assignment[],
        briefs: (briefs.data || []) as unknown as Phase6Brief[],
        decisions: (decisions.data || []) as unknown as Phase6Decision[],
        options: (options.data || []) as unknown as Phase6DecisionOption[],
        evidence: (evidence.data || []) as unknown as Phase6DecisionEvidence[],
        positions: (positions.data || []) as unknown as Phase6DecisionPosition[],
        events: (events.data || []) as unknown as Phase6DecisionEvent[],
        refreshes: (refreshes.data || []) as unknown as Phase6Refresh[],
        scenarios: (scenarios.data || []) as unknown as Phase6Scenario[],
        gates: (gates.data || []) as unknown as Phase6Gate[],
        boards: (boards.data || []) as unknown as Phase6BoardCoverage[],
        cutover: (cutover.data || null) as unknown as Phase6NativeCutover | null,
        runtimeReady: true,
        runtimeMessage: null,
      };
    },
  });
}

async function invalidatePhase6(queryClient: ReturnType<typeof useQueryClient>) {
  await queryClient.invalidateQueries({ queryKey });
  await queryClient.invalidateQueries({ queryKey: ["work-items"] });
  await queryClient.invalidateQueries({ queryKey: ["agent-os-phase-5-monitoring"] });
}

function useNoArgPhase6Action(functionName: string) {
  const queryClient = useQueryClient();
  return useMutation<Record<string, unknown>, Error>({
    mutationFn: async () => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc(functionName as never);
      if (error) throw error;
      return (data || {}) as unknown as Record<string, unknown>;
    },
    onSuccess: async () => invalidatePhase6(queryClient),
  });
}

export const useRunPhase6Refresh = () => useNoArgPhase6Action("agent_os_phase6_refresh");
export const useRunPhase6Validation = () => useNoArgPhase6Action("agent_os_phase6_run_validation");

export function useUpdatePhase6Assignment() {
  const queryClient = useQueryClient();
  return useMutation<Record<string, unknown>, Error, { assignmentId: string; status: string; notes: string }>({
    mutationFn: async ({ assignmentId, status, notes }) => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc("agent_os_phase6_update_assignment" as never, {
        p_assignment_id: assignmentId,
        p_status: status,
        p_notes: notes,
      } as never);
      if (error) throw error;
      return (data || {}) as unknown as Record<string, unknown>;
    },
    onSuccess: async () => invalidatePhase6(queryClient),
  });
}

export function useBeginPhase6DecisionReview() {
  const queryClient = useQueryClient();
  return useMutation<Record<string, unknown>, Error, { decisionItemId: string; notes: string }>({
    mutationFn: async ({ decisionItemId, notes }) => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc("agent_os_phase6_begin_decision_review" as never, {
        p_decision_item_id: decisionItemId,
        p_notes: notes,
      } as never);
      if (error) throw error;
      return (data || {}) as unknown as Record<string, unknown>;
    },
    onSuccess: async () => invalidatePhase6(queryClient),
  });
}

export function useRecordPhase6Decision() {
  const queryClient = useQueryClient();
  return useMutation<
    Record<string, unknown>,
    Error,
    {
      decisionItemId: string;
      decisionCode: string;
      optionKey: string;
      decisionText: string;
      rationale: string;
      conditions: string[];
      evidenceReference: string;
    }
  >({
    mutationFn: async ({ decisionItemId, decisionCode, optionKey, decisionText, rationale, conditions, evidenceReference }) => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc("agent_os_phase6_record_decision" as never, {
        p_decision_item_id: decisionItemId,
        p_decision_code: decisionCode,
        p_option_key: optionKey,
        p_decision_text: decisionText,
        p_rationale: rationale,
        p_conditions: conditions,
        p_evidence_reference: evidenceReference,
      } as never);
      if (error) throw error;
      return (data || {}) as unknown as Record<string, unknown>;
    },
    onSuccess: async () => invalidatePhase6(queryClient),
  });
}

export function useRecordPhase6Position() {
  const queryClient = useQueryClient();
  return useMutation<
    Record<string, unknown>,
    Error,
    {
      decisionItemId: string;
      agentKey: string;
      positionType: string;
      optionKey: string | null;
      summary: string;
      rationale: string;
      confidenceScore: number;
      evidenceReferences: string[];
    }
  >({
    mutationFn: async ({ decisionItemId, agentKey, positionType, optionKey, summary, rationale, confidenceScore, evidenceReferences }) => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc("agent_os_phase6_record_position" as never, {
        p_decision_item_id: decisionItemId,
        p_agent_key: agentKey,
        p_position_type: positionType,
        p_option_key: optionKey,
        p_summary: summary,
        p_rationale: rationale,
        p_confidence_score: confidenceScore,
        p_evidence_references: evidenceReferences,
      } as never);
      if (error) throw error;
      return (data || {}) as unknown as Record<string, unknown>;
    },
    onSuccess: async () => invalidatePhase6(queryClient),
  });
}

export function useReviewPhase6Gate() {
  const queryClient = useQueryClient();
  return useMutation<
    Record<string, unknown>,
    Error,
    { gateKey: string; status: "passed" | "failed" | "waived"; notes: string; evidenceReference: string }
  >({
    mutationFn: async ({ gateKey, status, notes, evidenceReference }) => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc("agent_os_phase6_record_gate_review" as never, {
        p_gate_key: gateKey,
        p_status: status,
        p_notes: notes,
        p_evidence: {
          evidence_reference: evidenceReference,
          reviewed_from_workspace: true,
          workspace_route: "/agent-os",
        },
      } as never);
      if (error) throw error;
      return (data || {}) as unknown as Record<string, unknown>;
    },
    onSuccess: async () => invalidatePhase6(queryClient),
  });
}
