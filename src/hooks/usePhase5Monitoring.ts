import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getSupabaseNotConfiguredError,
  supabase,
} from "@/integrations/supabase/client";

export interface Phase5Dashboard {
  program_key: string;
  title: string;
  program_version: string;
  program_status: string;
  operating_mode: string;
  coordinator_agent_key: string | null;
  coordinator_agent_name: string | null;
  authoritative_source: string;
  scan_frequency_minutes: number;
  alert_generation_enabled: boolean;
  deadline_engine_enabled: boolean;
  scheduled_scans_enabled: boolean;
  work_item_creation_enabled: boolean;
  external_notifications_enabled: boolean;
  autonomous_remediation_enabled: boolean;
  required_scenario_count: number;
  passed_scenario_count: number;
  last_scan_run_id: string | null;
  last_scan_at: string | null;
  next_scheduled_scan_at: string | null;
  last_validation_run_id: string | null;
  last_validation_at: string | null;
  last_error: string | null;
  active_rule_count: number;
  active_source_count: number;
  production_alert_count: number;
  active_alert_count: number;
  open_alert_count: number;
  acknowledged_alert_count: number;
  snoozed_alert_count: number;
  escalated_alert_count: number;
  resolved_alert_count: number;
  informational_alert_count: number;
  watch_alert_count: number;
  action_required_alert_count: number;
  high_risk_alert_count: number;
  critical_alert_count: number;
  compliance_alert_count: number;
  financial_alert_count: number;
  grant_alert_count: number;
  governance_alert_count: number;
  operational_alert_count: number;
  response_overdue_count: number;
  escalation_due_count: number;
  active_suppression_count: number;
  pending_escalation_count: number;
  automated_security_gates_passed: number;
  human_gates_pending: number;
  failed_gate_count: number;
  latest_scan_status: string | null;
  latest_scan_mode: string | null;
  latest_scan_rule_count: number | null;
  latest_scan_signal_count: number | null;
  latest_scan_alerts_created: number | null;
  latest_scan_alerts_updated: number | null;
  latest_scan_alerts_deduplicated: number | null;
  latest_scan_alerts_suppressed: number | null;
  latest_scan_alerts_auto_resolved: number | null;
  latest_scan_alerts_escalated: number | null;
  latest_scan_external_side_effect_count: number | null;
  latest_scan_authoritative_mutation_count: number | null;
  latest_scan_completed_at: string | null;
  latest_validation_status: string | null;
  latest_validation_scenario_count: number | null;
  latest_validation_passed_scenario_count: number | null;
  latest_validation_assertion_count: number | null;
  latest_validation_failed_assertion_count: number | null;
  latest_validation_external_side_effect_count: number | null;
  latest_validation_authoritative_mutation_count: number | null;
  latest_validation_source_fingerprint_unchanged: boolean | null;
  latest_validation_completed_at: string | null;
  schedule_job_id: number | null;
  schedule_expression: string | null;
  schedule_active: boolean | null;
  metadata: Record<string, unknown>;
}

export interface Phase5Alert {
  id: string;
  alert_reference: string;
  alert_fingerprint: string;
  rule_key: string;
  category: string;
  severity_key: string;
  severity_rank: number;
  severity_label: string;
  requires_acknowledgement: boolean;
  executive_visibility: boolean;
  original_severity_key: string;
  access_area: string;
  confidentiality: string;
  title: string;
  summary: string;
  entity_type: string | null;
  entity_id: string | null;
  source_table: string;
  source_record_id: string | null;
  aggregation_key: string | null;
  ngo_id: string | null;
  ngo_name: string | null;
  due_at: string | null;
  status: string;
  first_detected_at: string;
  last_detected_at: string;
  occurrence_count: number;
  missed_run_count: number;
  response_due_at: string | null;
  escalation_due_at: string | null;
  owner_agent_key: string | null;
  owner_agent_name: string | null;
  owner_agent_title: string | null;
  owner_user_id: string | null;
  owner_user_name: string | null;
  acknowledged_by_user_id: string | null;
  acknowledged_by_name: string | null;
  acknowledged_at: string | null;
  acknowledgement_notes: string | null;
  snoozed_until: string | null;
  snooze_reason: string | null;
  escalation_level: number;
  resolved_by_user_id: string | null;
  resolved_by_name: string | null;
  resolved_at: string | null;
  resolution_summary: string | null;
  resolution_evidence_reference: string | null;
  dismissed_by_user_id: string | null;
  dismissed_by_name: string | null;
  dismissed_at: string | null;
  dismissal_reason: string | null;
  latest_evidence_sha256: string;
  current_signal_id: string | null;
  created_at: string;
  updated_at: string;
  rule_title: string;
  rule_description: string;
  condition_type: string;
  accountable_human_role: string;
  required_response: string;
  escalation_path: unknown[];
  threshold_config: Record<string, unknown>;
  frequency_minutes: number;
  suppression_window_minutes: number;
  resolve_after_missed_runs: number;
  aggregation_mode: string;
  auto_resolve: boolean;
  rule_status: string;
  rule_version: number;
  signal_value: Record<string, unknown> | null;
  threshold_value: Record<string, unknown> | null;
  evidence_snapshot: Record<string, unknown> | null;
  evidence_sha256: string | null;
  latest_signal_disposition: string | null;
  latest_signal_detected_at: string | null;
  signal_count: number;
  event_count: number;
  pending_escalation_count: number;
}

export interface Phase5Rule {
  rule_key: string;
  category: string;
  title: string;
  description: string;
  evaluator_key: string;
  condition_type: string;
  source_key: string;
  source_name: string;
  source_table: string;
  source_access_area: string;
  source_confidentiality: string;
  threshold_key: string | null;
  threshold_label: string | null;
  threshold_unit: string | null;
  threshold_policy_status: string | null;
  base_severity_key: string;
  owner_agent_key: string | null;
  owner_agent_name: string | null;
  owner_agent_title: string | null;
  access_area: string;
  confidentiality: string;
  accountable_human_role: string;
  required_response: string;
  escalation_path: unknown[];
  threshold_config: Record<string, unknown>;
  frequency_minutes: number;
  lead_days: number | null;
  response_minutes_override: number | null;
  escalation_minutes_override: number | null;
  suppression_window_minutes: number;
  resolve_after_missed_runs: number;
  aggregation_mode: string;
  auto_resolve: boolean;
  is_active: boolean;
  rule_status: string;
  rule_version: number;
  last_evaluated_at: string | null;
  last_error: string | null;
  metadata: Record<string, unknown>;
  updated_at: string;
  total_alert_count: number;
  active_alert_count: number;
}

export interface Phase5Severity {
  severity_key: string;
  severity_rank: number;
  label: string;
  description: string;
  requires_acknowledgement: boolean;
  default_response_minutes: number;
  default_escalation_minutes: number;
  default_work_item_priority: string;
  executive_visibility: boolean;
  is_active: boolean;
  updated_at: string;
}

export interface Phase5Threshold {
  threshold_key: string;
  category: string;
  label: string;
  description: string;
  unit: string;
  direction: string;
  informational_value: number | null;
  watch_value: number | null;
  action_required_value: number | null;
  high_risk_value: number | null;
  critical_value: number | null;
  currency_code: string | null;
  policy_status: string;
  rationale: string;
  approved_by_user_id: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  is_active: boolean;
  updated_at: string;
}

export interface Phase5Source {
  source_key: string;
  display_name: string;
  category: string;
  source_schema: string;
  source_table: string;
  access_area: string;
  confidentiality: string;
  owner_agent_key: string | null;
  owner_agent_name: string | null;
  owner_agent_title: string | null;
  source_description: string;
  is_active: boolean;
  last_scanned_at: string | null;
  last_source_row_count: number;
  last_signal_count: number;
  last_alert_count: number;
  last_error: string | null;
  updated_at: string;
  coverage_status: string;
  active_rule_count: number;
}

export interface Phase5Scan {
  id: string;
  run_key: string;
  run_mode: string;
  status: string;
  as_of: string;
  rule_count: number;
  signal_count: number;
  alerts_created: number;
  alerts_updated: number;
  alerts_deduplicated: number;
  alerts_suppressed: number;
  alerts_auto_resolved: number;
  alerts_escalated: number;
  external_side_effect_count: number;
  authoritative_mutation_count: number;
  triggered_by_user_id: string | null;
  triggered_by_name: string | null;
  started_at: string;
  completed_at: string | null;
  summary: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
}

export interface Phase5Scenario {
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

export interface Phase5Gate {
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

export interface Phase5Suppression {
  id: string;
  suppression_reference: string;
  rule_key: string | null;
  rule_title: string | null;
  alert_fingerprint: string | null;
  entity_type: string | null;
  entity_id: string | null;
  aggregation_key: string | null;
  access_area: string;
  reason: string;
  starts_at: string;
  ends_at: string | null;
  status: string;
  authorized_by_user_id: string;
  authorized_by_name: string | null;
  revoked_by_user_id: string | null;
  revoked_by_name: string | null;
  revoked_at: string | null;
  revocation_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface Phase5Escalation {
  id: string;
  alert_id: string;
  alert_reference: string;
  alert_title: string;
  category: string;
  severity_key: string;
  escalation_level: number;
  from_agent_key: string | null;
  from_agent_name: string | null;
  to_agent_key: string | null;
  to_agent_name: string | null;
  to_user_id: string | null;
  to_user_name: string | null;
  to_role: string;
  reason: string;
  status: string;
  due_at: string | null;
  created_at: string;
  acknowledged_by_user_id: string | null;
  acknowledged_by_name: string | null;
  acknowledged_at: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
}

export interface Phase5MonitoringResult {
  dashboard: Phase5Dashboard | null;
  alerts: Phase5Alert[];
  rules: Phase5Rule[];
  severities: Phase5Severity[];
  thresholds: Phase5Threshold[];
  sources: Phase5Source[];
  scans: Phase5Scan[];
  scenarios: Phase5Scenario[];
  gates: Phase5Gate[];
  suppressions: Phase5Suppression[];
  escalations: Phase5Escalation[];
  runtimeReady: boolean;
  runtimeMessage: string | null;
}

const ensureSupabase = () => {
  if (!supabase) throw getSupabaseNotConfiguredError();
  return supabase;
};

const queryKey = ["agent-os-phase-5-monitoring"] as const;

const isMissingPhaseFiveSchema = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };
  const message = candidate.message?.toLowerCase() || "";
  return (
    candidate.code === "42P01" ||
    candidate.code === "PGRST205" ||
    message.includes("agent_os_phase5_dashboard") ||
    message.includes("monitoring_programs")
  );
};

export function usePhase5Monitoring() {
  return useQuery<Phase5MonitoringResult>({
    queryKey,
    enabled: !!supabase,
    refetchInterval: 60_000,
    queryFn: async () => {
      const client = ensureSupabase();
      const [dashboard, alerts, rules, severities, thresholds, sources, scans, scenarios, gates, suppressions, escalations] = await Promise.all([
        client.from("agent_os_phase5_dashboard" as never).select("*" as never).maybeSingle(),
        client.from("agent_os_phase5_alert_queue" as never).select("*" as never).order("severity_rank" as never, { ascending: false }).order("first_detected_at" as never, { ascending: false }).limit(500),
        client.from("agent_os_phase5_rule_library" as never).select("*" as never).order("category" as never).order("title" as never),
        client.from("agent_os_phase5_severity_matrix" as never).select("*" as never).order("severity_rank" as never),
        client.from("agent_os_phase5_threshold_library" as never).select("*" as never).order("category" as never).order("label" as never),
        client.from("agent_os_phase5_source_coverage" as never).select("*" as never).order("category" as never).order("display_name" as never),
        client.from("agent_os_phase5_scan_history" as never).select("*" as never).order("started_at" as never, { ascending: false }).limit(100),
        client.from("agent_os_phase5_validation_results" as never).select("*" as never).order("sort_order" as never),
        client.from("agent_os_phase5_governance" as never).select("*" as never).order("sort_order" as never),
        client.from("agent_os_phase5_suppressions" as never).select("*" as never).order("created_at" as never, { ascending: false }).limit(100),
        client.from("agent_os_phase5_escalation_queue" as never).select("*" as never).order("created_at" as never, { ascending: false }).limit(100),
      ]);

      const firstError = [
        dashboard.error,
        alerts.error,
        rules.error,
        severities.error,
        thresholds.error,
        sources.error,
        scans.error,
        scenarios.error,
        gates.error,
        suppressions.error,
        escalations.error,
      ].find(Boolean);

      if (firstError) {
        if (isMissingPhaseFiveSchema(firstError)) {
          return {
            dashboard: null,
            alerts: [],
            rules: [],
            severities: [],
            thresholds: [],
            sources: [],
            scans: [],
            scenarios: [],
            gates: [],
            suppressions: [],
            escalations: [],
            runtimeReady: false,
            runtimeMessage: "The Phase 5 continuous-monitoring runtime has not been deployed to this Supabase environment.",
          };
        }
        throw firstError;
      }

      return {
        dashboard: (dashboard.data || null) as unknown as Phase5Dashboard | null,
        alerts: (alerts.data || []) as unknown as Phase5Alert[],
        rules: (rules.data || []) as unknown as Phase5Rule[],
        severities: (severities.data || []) as unknown as Phase5Severity[],
        thresholds: (thresholds.data || []) as unknown as Phase5Threshold[],
        sources: (sources.data || []) as unknown as Phase5Source[],
        scans: (scans.data || []) as unknown as Phase5Scan[],
        scenarios: (scenarios.data || []) as unknown as Phase5Scenario[],
        gates: (gates.data || []) as unknown as Phase5Gate[],
        suppressions: (suppressions.data || []) as unknown as Phase5Suppression[],
        escalations: (escalations.data || []) as unknown as Phase5Escalation[],
        runtimeReady: true,
        runtimeMessage: null,
      };
    },
  });
}

async function invalidatePhase5(queryClient: ReturnType<typeof useQueryClient>) {
  await queryClient.invalidateQueries({ queryKey });
  await queryClient.invalidateQueries({ queryKey: ["work-items"] });
}

function useNoArgPhase5Action(functionName: string) {
  const queryClient = useQueryClient();
  return useMutation<Record<string, unknown>, Error>({
    mutationFn: async () => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc(functionName as never);
      if (error) throw error;
      return (data || {}) as unknown as Record<string, unknown>;
    },
    onSuccess: async () => invalidatePhase5(queryClient),
  });
}

export const useRunPhase5Scan = () => useNoArgPhase5Action("agent_os_phase5_run_scan");
export const useRunPhase5Validation = () => useNoArgPhase5Action("agent_os_phase5_run_validation");

export function useAcknowledgePhase5Alert() {
  const queryClient = useQueryClient();
  return useMutation<Record<string, unknown>, Error, { alertId: string; notes: string }>({
    mutationFn: async ({ alertId, notes }) => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc("agent_os_phase5_acknowledge_alert" as never, {
        p_alert_id: alertId,
        p_notes: notes,
      } as never);
      if (error) throw error;
      return (data || {}) as unknown as Record<string, unknown>;
    },
    onSuccess: async () => invalidatePhase5(queryClient),
  });
}

export function useSnoozePhase5Alert() {
  const queryClient = useQueryClient();
  return useMutation<Record<string, unknown>, Error, { alertId: string; snoozedUntil: string; reason: string }>({
    mutationFn: async ({ alertId, snoozedUntil, reason }) => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc("agent_os_phase5_snooze_alert" as never, {
        p_alert_id: alertId,
        p_snoozed_until: snoozedUntil,
        p_reason: reason,
      } as never);
      if (error) throw error;
      return (data || {}) as unknown as Record<string, unknown>;
    },
    onSuccess: async () => invalidatePhase5(queryClient),
  });
}

export function useResolvePhase5Alert() {
  const queryClient = useQueryClient();
  return useMutation<Record<string, unknown>, Error, { alertId: string; summary: string; evidenceReference: string }>({
    mutationFn: async ({ alertId, summary, evidenceReference }) => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc("agent_os_phase5_resolve_alert" as never, {
        p_alert_id: alertId,
        p_resolution_summary: summary,
        p_evidence_reference: evidenceReference,
      } as never);
      if (error) throw error;
      return (data || {}) as unknown as Record<string, unknown>;
    },
    onSuccess: async () => invalidatePhase5(queryClient),
  });
}

export function useDismissPhase5Alert() {
  const queryClient = useQueryClient();
  return useMutation<Record<string, unknown>, Error, { alertId: string; reason: string }>({
    mutationFn: async ({ alertId, reason }) => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc("agent_os_phase5_dismiss_alert" as never, {
        p_alert_id: alertId,
        p_reason: reason,
      } as never);
      if (error) throw error;
      return (data || {}) as unknown as Record<string, unknown>;
    },
    onSuccess: async () => invalidatePhase5(queryClient),
  });
}

export function useReviewPhase5Gate() {
  const queryClient = useQueryClient();
  return useMutation<
    Record<string, unknown>,
    Error,
    { gateKey: string; status: "passed" | "failed" | "waived"; notes: string; evidenceReference: string }
  >({
    mutationFn: async ({ gateKey, status, notes, evidenceReference }) => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc("agent_os_phase5_record_gate_review" as never, {
        p_gate_key: gateKey,
        p_status: status,
        p_notes: notes,
        p_evidence: {
          evidence_reference: evidenceReference,
          reviewed_from_workspace: true,
          workspace_route: "/hpg-assistant#phase-5",
        },
      } as never);
      if (error) throw error;
      return (data || {}) as unknown as Record<string, unknown>;
    },
    onSuccess: async () => invalidatePhase5(queryClient),
  });
}
