import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getSupabaseNotConfiguredError,
  supabase,
} from "@/integrations/supabase/client";

export interface Phase4Dashboard {
  program_key: string;
  title: string;
  program_version: string;
  program_status: string;
  operating_mode: string;
  authoritative_source: string;
  external_system_role: string;
  external_actions_enabled: boolean;
  autonomous_high_impact_decisions_enabled: boolean;
  required_scenario_count: number;
  passed_scenario_count: number;
  last_validation_run_id: string | null;
  last_validation_at: string | null;
  last_ingestion_at: string | null;
  last_error: string | null;
  memory_count: number;
  latest_synthetic_memory_count: number;
  decision_count: number;
  precedent_entry_count: number;
  relationship_count: number;
  grant_count: number;
  compliance_count: number;
  operational_count: number;
  verified_count: number;
  awaiting_review_count: number;
  current_count: number;
  historical_count: number;
  expired_count: number;
  superseded_count: number;
  unresolved_conflict_count: number;
  outcome_assessed_count: number;
  evidence_count: number;
  precedent_link_count: number;
  active_source_count: number;
  successful_ingestion_count: number;
  latest_source_row_count: number | null;
  latest_inserted_memory_count: number | null;
  external_provenance_count: number;
  trello_provenance_count: number;
  trello_operating_role: string | null;
  trello_status: string | null;
  automated_security_gates_passed: number;
  human_gates_pending: number;
  failed_gate_count: number;
  latest_validation_status: string | null;
  latest_scenario_count: number | null;
  latest_passed_scenario_count: number | null;
  latest_assertion_count: number | null;
  latest_failed_assertion_count: number | null;
  latest_external_side_effect_count: number | null;
  latest_authoritative_mutation_count: number | null;
  latest_source_fingerprint_unchanged: boolean | null;
  latest_validation_completed_at: string | null;
  metadata: Record<string, unknown>;
}

export interface Phase4Memory {
  id: string;
  memory_reference: string;
  memory_type: string;
  title: string;
  summary: string;
  narrative: string | null;
  access_area: string;
  confidentiality: string;
  lifecycle_status: string;
  calculated_temporal_state: string;
  recorded_temporal_state: string;
  confidence: string;
  importance: string;
  primary_entity_type: string | null;
  primary_entity_id: string | null;
  fact_key: string | null;
  fact_value: unknown;
  conflict_status: string;
  source_system: string;
  source_table: string;
  source_record_id: string;
  source_event_id: string | null;
  source_snapshot_sha256: string;
  occurred_at: string;
  effective_from: string | null;
  effective_to: string | null;
  next_review_at: string | null;
  owner_user_id: string | null;
  owner_name: string | null;
  owner_agent_key: string | null;
  owner_agent_name: string | null;
  decision_maker_user_id: string | null;
  decision_maker_name: string | null;
  decision_text: string | null;
  rationale: string | null;
  alternatives_considered: unknown[];
  expected_outcome: string | null;
  actual_outcome: string | null;
  outcome_status: string;
  lessons: unknown[];
  tags: string[];
  supersedes_memory_id: string | null;
  supersedes_reference: string | null;
  superseded_by_memory_id: string | null;
  superseded_by_reference: string | null;
  verified_by_user_id: string | null;
  verified_by_name: string | null;
  verified_at: string | null;
  created_by_user_id: string | null;
  created_by_name: string | null;
  created_by_agent_key: string | null;
  created_at: string;
  updated_at: string;
  evidence_count: number;
  primary_evidence_reference: string | null;
  primary_evidence_url: string | null;
  precedent_count: number;
  event_count: number;
  source_display_name: string | null;
}

export interface Phase4Precedent {
  precedent_link_id: string;
  source_memory_id: string;
  source_reference: string;
  source_memory_type: string;
  source_title: string;
  primary_entity_type: string | null;
  primary_entity_id: string | null;
  precedent_memory_id: string;
  precedent_reference: string;
  precedent_memory_type: string;
  precedent_title: string;
  precedent_occurred_at: string;
  precedent_actual_outcome: string | null;
  precedent_outcome_status: string;
  relationship: string;
  rationale: string;
  confidence: string;
  created_by_user_id: string | null;
  created_by_name: string | null;
  reviewed_by_user_id: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface Phase4SourceCoverage {
  source_key: string;
  display_name: string;
  source_schema: string;
  source_table: string;
  memory_type_hint: string;
  access_area: string;
  confidentiality: string;
  owner_agent_key: string | null;
  owner_agent_name: string | null;
  extraction_version: number;
  is_active: boolean;
  last_ingested_at: string | null;
  last_source_row_count: number;
  last_memory_row_count: number;
  coverage_status: string;
  notes: string | null;
  updated_at: string;
}

export interface Phase4Scenario {
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

export interface Phase4Gate {
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

export interface Phase4RetentionRule {
  rule_key: string;
  memory_type: string;
  confidentiality: string;
  retention_years: number | null;
  permanent_retention: boolean;
  review_frequency_months: number;
  archive_after_months: number | null;
  legal_hold_supported: boolean;
  policy_status: string;
  rationale: string;
  is_active: boolean;
  approved_by_user_id: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  updated_at: string;
}

export interface Phase4Provenance {
  id: string;
  provider_key: string;
  provider_name: string;
  operating_role: string;
  provider_status: string;
  is_authoritative: boolean;
  inbound_mutation_allowed: boolean;
  outbound_mutation_allowed: boolean;
  object_type: string;
  external_object_id: string;
  external_object_url: string | null;
  external_parent_id: string | null;
  source_table: string;
  source_record_id: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  provenance_status: string;
  authoritative: boolean;
  snapshot_sha256: string;
  external_last_activity_at: string | null;
  captured_at: string;
  metadata: Record<string, unknown>;
}

export interface Phase4MemoryResult {
  dashboard: Phase4Dashboard | null;
  memories: Phase4Memory[];
  precedents: Phase4Precedent[];
  sources: Phase4SourceCoverage[];
  scenarios: Phase4Scenario[];
  gates: Phase4Gate[];
  retention: Phase4RetentionRule[];
  provenance: Phase4Provenance[];
  runtimeReady: boolean;
  runtimeMessage: string | null;
}

export interface RecordPhase4MemoryInput {
  memoryType: string;
  title: string;
  summary: string;
  narrative?: string | null;
  accessArea?: string;
  confidentiality?: string;
  importance?: string;
  confidence?: string;
  primaryEntityType?: string | null;
  primaryEntityId?: string | null;
  factKey?: string | null;
  factValue?: unknown;
  occurredAt?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  ownerAgentKey?: string | null;
  decisionMakerUserId?: string | null;
  decisionText?: string | null;
  rationale?: string | null;
  alternativesConsidered?: unknown[];
  expectedOutcome?: string | null;
  tags?: string[];
  evidenceTitle?: string | null;
  evidenceReference?: string | null;
  evidenceUrl?: string | null;
  evidenceSnapshot?: Record<string, unknown>;
  evidenceStrength?: number;
  supersedesMemoryId?: string | null;
  idempotencyKey?: string | null;
}

const ensureSupabase = () => {
  if (!supabase) throw getSupabaseNotConfiguredError();
  return supabase;
};

const queryKey = ["agent-os-phase-4-memory"] as const;

const isMissingPhaseFourSchema = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };
  const message = candidate.message?.toLowerCase() || "";
  return (
    candidate.code === "42P01" ||
    candidate.code === "PGRST205" ||
    message.includes("agent_os_phase4_dashboard") ||
    message.includes("institutional_memory_programs")
  );
};

export function usePhase4Memory() {
  return useQuery<Phase4MemoryResult>({
    queryKey,
    enabled: !!supabase,
    refetchInterval: 60_000,
    queryFn: async () => {
      const client = ensureSupabase();
      const [dashboard, memories, precedents, sources, scenarios, gates, retention, provenance] = await Promise.all([
        client.from("agent_os_phase4_dashboard" as never).select("*" as never).maybeSingle(),
        client.from("agent_os_phase4_memory_timeline" as never).select("*" as never).order("occurred_at" as never, { ascending: false }).limit(500),
        client.from("agent_os_phase4_precedent_library" as never).select("*" as never).order("created_at" as never, { ascending: false }).limit(250),
        client.from("agent_os_phase4_source_coverage" as never).select("*" as never).order("source_key" as never),
        client.from("agent_os_phase4_validation_results" as never).select("*" as never).order("sort_order" as never),
        client.from("agent_os_phase4_governance" as never).select("*" as never).order("sort_order" as never),
        client.from("agent_os_phase4_retention_standard" as never).select("*" as never).order("memory_type" as never),
        client.from("agent_os_phase4_provenance_archive" as never).select("*" as never).order("captured_at" as never, { ascending: false }).limit(500),
      ]);

      const firstError = [
        dashboard.error,
        memories.error,
        precedents.error,
        sources.error,
        scenarios.error,
        gates.error,
        retention.error,
        provenance.error,
      ].find(Boolean);

      if (firstError) {
        if (isMissingPhaseFourSchema(firstError)) {
          return {
            dashboard: null,
            memories: [],
            precedents: [],
            sources: [],
            scenarios: [],
            gates: [],
            retention: [],
            provenance: [],
            runtimeReady: false,
            runtimeMessage: "The Phase 4 institutional-memory runtime has not been deployed to this Supabase environment.",
          };
        }
        throw firstError;
      }

      return {
        dashboard: (dashboard.data || null) as unknown as Phase4Dashboard | null,
        memories: (memories.data || []) as unknown as Phase4Memory[],
        precedents: (precedents.data || []) as unknown as Phase4Precedent[],
        sources: (sources.data || []) as unknown as Phase4SourceCoverage[],
        scenarios: (scenarios.data || []) as unknown as Phase4Scenario[],
        gates: (gates.data || []) as unknown as Phase4Gate[],
        retention: (retention.data || []) as unknown as Phase4RetentionRule[],
        provenance: (provenance.data || []) as unknown as Phase4Provenance[],
        runtimeReady: true,
        runtimeMessage: null,
      };
    },
  });
}

async function invalidatePhase4(queryClient: ReturnType<typeof useQueryClient>) {
  await queryClient.invalidateQueries({ queryKey });
  await queryClient.invalidateQueries({ queryKey: ["work-items"] });
}

function useNoArgPhase4Action(functionName: string) {
  const queryClient = useQueryClient();
  return useMutation<Record<string, unknown>, Error>({
    mutationFn: async () => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc(functionName as never);
      if (error) throw error;
      return (data || {}) as unknown as Record<string, unknown>;
    },
    onSuccess: async () => invalidatePhase4(queryClient),
  });
}

export const useRefreshPhase4Sources = () => useNoArgPhase4Action("agent_os_phase4_refresh_sources");
export const useRunPhase4Validation = () => useNoArgPhase4Action("agent_os_phase4_run_validation");

export function useRecordPhase4Memory() {
  const queryClient = useQueryClient();
  return useMutation<Record<string, unknown>, Error, RecordPhase4MemoryInput>({
    mutationFn: async (input) => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc("agent_os_phase4_record_memory" as never, {
        p_memory_type: input.memoryType,
        p_title: input.title,
        p_summary: input.summary,
        p_narrative: input.narrative || null,
        p_access_area: input.accessArea || "organization",
        p_confidentiality: input.confidentiality || "internal",
        p_importance: input.importance || "important",
        p_confidence: input.confidence || "moderate",
        p_primary_entity_type: input.primaryEntityType || null,
        p_primary_entity_id: input.primaryEntityId || null,
        p_fact_key: input.factKey || null,
        p_fact_value: input.factValue ?? null,
        p_occurred_at: input.occurredAt || new Date().toISOString(),
        p_effective_from: input.effectiveFrom || null,
        p_effective_to: input.effectiveTo || null,
        p_owner_agent_key: input.ownerAgentKey || null,
        p_decision_maker_user_id: input.decisionMakerUserId || null,
        p_decision_text: input.decisionText || null,
        p_rationale: input.rationale || null,
        p_alternatives_considered: input.alternativesConsidered || [],
        p_expected_outcome: input.expectedOutcome || null,
        p_tags: input.tags || [],
        p_evidence_title: input.evidenceTitle || null,
        p_evidence_reference: input.evidenceReference || null,
        p_evidence_url: input.evidenceUrl || null,
        p_evidence_snapshot: input.evidenceSnapshot || {},
        p_evidence_strength: input.evidenceStrength ?? 3,
        p_supersedes_memory_id: input.supersedesMemoryId || null,
        p_idempotency_key: input.idempotencyKey || null,
      } as never);
      if (error) throw error;
      return (data || {}) as unknown as Record<string, unknown>;
    },
    onSuccess: async () => invalidatePhase4(queryClient),
  });
}

export function useVerifyPhase4Memory() {
  const queryClient = useQueryClient();
  return useMutation<Record<string, unknown>, Error, { memoryId: string; notes: string; evidence: Record<string, unknown> }>({
    mutationFn: async ({ memoryId, notes, evidence }) => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc("agent_os_phase4_verify_memory" as never, {
        p_memory_id: memoryId,
        p_review_notes: notes,
        p_review_evidence: evidence,
      } as never);
      if (error) throw error;
      return (data || {}) as unknown as Record<string, unknown>;
    },
    onSuccess: async () => invalidatePhase4(queryClient),
  });
}

export function useRecordPhase4Outcome() {
  const queryClient = useQueryClient();
  return useMutation<
    Record<string, unknown>,
    Error,
    { memoryId: string; actualOutcome: string; outcomeStatus: string; lessons: unknown[]; evidenceReference?: string; evidenceUrl?: string }
  >({
    mutationFn: async ({ memoryId, actualOutcome, outcomeStatus, lessons, evidenceReference, evidenceUrl }) => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc("agent_os_phase4_record_outcome" as never, {
        p_memory_id: memoryId,
        p_actual_outcome: actualOutcome,
        p_outcome_status: outcomeStatus,
        p_lessons: lessons,
        p_evidence_reference: evidenceReference || null,
        p_evidence_url: evidenceUrl || null,
      } as never);
      if (error) throw error;
      return (data || {}) as unknown as Record<string, unknown>;
    },
    onSuccess: async () => invalidatePhase4(queryClient),
  });
}

export function useLinkPhase4Precedent() {
  const queryClient = useQueryClient();
  return useMutation<
    Record<string, unknown>,
    Error,
    { sourceMemoryId: string; precedentMemoryId: string; relationship: string; rationale: string; confidence: string }
  >({
    mutationFn: async ({ sourceMemoryId, precedentMemoryId, relationship, rationale, confidence }) => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc("agent_os_phase4_link_precedent" as never, {
        p_source_memory_id: sourceMemoryId,
        p_precedent_memory_id: precedentMemoryId,
        p_relationship: relationship,
        p_rationale: rationale,
        p_confidence: confidence,
      } as never);
      if (error) throw error;
      return (data || {}) as unknown as Record<string, unknown>;
    },
    onSuccess: async () => invalidatePhase4(queryClient),
  });
}

export function useResolvePhase4Conflict() {
  const queryClient = useQueryClient();
  return useMutation<
    Record<string, unknown>,
    Error,
    { memoryId: string; resolution: string; notes: string; evidenceReference: string }
  >({
    mutationFn: async ({ memoryId, resolution, notes, evidenceReference }) => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc("agent_os_phase4_resolve_conflict" as never, {
        p_memory_id: memoryId,
        p_resolution: resolution,
        p_notes: notes,
        p_evidence_reference: evidenceReference,
      } as never);
      if (error) throw error;
      return (data || {}) as unknown as Record<string, unknown>;
    },
    onSuccess: async () => invalidatePhase4(queryClient),
  });
}

export function useReviewPhase4Gate() {
  const queryClient = useQueryClient();
  return useMutation<
    Record<string, unknown>,
    Error,
    { gateKey: string; status: "passed" | "failed" | "waived"; notes: string; evidenceReference: string }
  >({
    mutationFn: async ({ gateKey, status, notes, evidenceReference }) => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc("agent_os_phase4_record_gate_review" as never, {
        p_gate_key: gateKey,
        p_status: status,
        p_notes: notes,
        p_evidence: {
          evidence_reference: evidenceReference,
          reviewed_from_workspace: true,
          workspace_route: "/hpg-assistant#phase-4",
        },
      } as never);
      if (error) throw error;
      return (data || {}) as unknown as Record<string, unknown>;
    },
    onSuccess: async () => invalidatePhase4(queryClient),
  });
}

export function usePhase4Search({
  query,
  memoryType,
  entityType,
  entityId,
  includeHistorical = true,
  limit = 100,
  enabled = true,
}: {
  query?: string;
  memoryType?: string;
  entityType?: string;
  entityId?: string;
  includeHistorical?: boolean;
  limit?: number;
  enabled?: boolean;
}) {
  return useQuery<Phase4Memory[]>({
    queryKey: ["agent-os-phase-4-search", query, memoryType, entityType, entityId, includeHistorical, limit],
    enabled: enabled && !!supabase,
    queryFn: async () => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc("agent_os_phase4_search" as never, {
        p_query: query?.trim() || null,
        p_memory_type: memoryType && memoryType !== "all" ? memoryType : null,
        p_entity_type: entityType?.trim() || null,
        p_entity_id: entityId?.trim() || null,
        p_include_historical: includeHistorical,
        p_limit: limit,
      } as never);
      if (error) throw error;
      return (data || []) as unknown as Phase4Memory[];
    },
  });
}
