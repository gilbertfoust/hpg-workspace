import { useQuery } from "@tanstack/react-query";
import {
  getSupabaseNotConfiguredError,
  supabase,
} from "@/integrations/supabase/client";

export interface AgentRunRecord {
  id: string;
  agent_name: string;
  agent_role: string | null;
  trigger_type: string;
  status: string;
  confidence: string;
  action_attempted: string | null;
  result_summary: string | null;
  error_detail: string | null;
  retry_count: number;
  started_at: string;
  completed_at: string | null;
  case_registry_id: string | null;
}

export interface CommunicationQueueRecord {
  id: string;
  communication_type: string;
  authority_level: "automatic" | "draft_for_review" | "human_only";
  recipient_name: string | null;
  recipient_address: string | null;
  subject: string | null;
  status: string;
  requires_human_review: boolean;
  attempts: number;
  error_message: string | null;
  created_at: string;
  case_registry_id: string | null;
}

export interface TrelloSyncRecord {
  id: string;
  entity_type: string;
  entity_id: string;
  operation: string;
  direction: "supabase_to_trello" | "trello_to_supabase";
  status: string;
  attempts: number;
  next_attempt_at: string | null;
  error_message: string | null;
  created_at: string;
  case_registry_id: string | null;
}

export interface AgentOSOperationsResult {
  agentRuns: AgentRunRecord[];
  communications: CommunicationQueueRecord[];
  trelloSync: TrelloSyncRecord[];
  runtimeReady: boolean;
  runtimeMessage: string | null;
}

const ensureSupabase = () => {
  if (!supabase) throw getSupabaseNotConfiguredError();
  return supabase;
};

const isMissingRuntimeSchema = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };
  const message = candidate.message?.toLowerCase() || "";
  return (
    candidate.code === "42P01" ||
    candidate.code === "PGRST205" ||
    message.includes("agent_runs") ||
    message.includes("communication_queue") ||
    message.includes("trello_sync_queue")
  );
};

export function useAgentOSOperations(limit = 50) {
  return useQuery<AgentOSOperationsResult>({
    queryKey: ["agent-os-operations", limit],
    enabled: !!supabase,
    refetchInterval: 60_000,
    queryFn: async () => {
      const client = ensureSupabase();

      const [runsResult, communicationsResult, trelloResult] = await Promise.all([
        client
          .from("agent_runs" as never)
          .select(
            "id, agent_name, agent_role, trigger_type, status, confidence, action_attempted, result_summary, error_detail, retry_count, started_at, completed_at, case_registry_id" as never,
          )
          .order("started_at" as never, { ascending: false })
          .limit(limit),
        client
          .from("communication_queue" as never)
          .select(
            "id, communication_type, authority_level, recipient_name, recipient_address, subject, status, requires_human_review, attempts, error_message, created_at, case_registry_id" as never,
          )
          .order("created_at" as never, { ascending: false })
          .limit(limit),
        client
          .from("trello_sync_queue" as never)
          .select(
            "id, entity_type, entity_id, operation, direction, status, attempts, next_attempt_at, error_message, created_at, case_registry_id" as never,
          )
          .order("created_at" as never, { ascending: false })
          .limit(limit),
      ]);

      const firstError = runsResult.error || communicationsResult.error || trelloResult.error;
      if (firstError) {
        if (isMissingRuntimeSchema(firstError)) {
          return {
            agentRuns: [],
            communications: [],
            trelloSync: [],
            runtimeReady: false,
            runtimeMessage:
              "The Agent OS operational queues are committed but have not been deployed to this Supabase environment.",
          };
        }
        throw firstError;
      }

      return {
        agentRuns: (runsResult.data || []) as unknown as AgentRunRecord[],
        communications: (communicationsResult.data || []) as unknown as CommunicationQueueRecord[],
        trelloSync: (trelloResult.data || []) as unknown as TrelloSyncRecord[],
        runtimeReady: true,
        runtimeMessage: null,
      };
    },
  });
}
