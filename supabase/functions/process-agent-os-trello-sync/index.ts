import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-agent-os-worker-secret",
};

const internalRoles = new Set([
  "staff",
  "super_admin",
  "admin_pm",
  "ngo_coordinator",
  "department_lead",
  "executive_secretariat",
]);

type SupabaseAdmin = any;

type TrelloQueueRecord = {
  id: string;
  case_registry_id: string | null;
  work_item_id: string | null;
  entity_type: string;
  entity_id: string;
  operation: string;
  direction: "supabase_to_trello" | "trello_to_supabase";
  route_key: string | null;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
};

type TrelloRoute = {
  route_key: string;
  workspace_id: string | null;
  board_id: string;
  list_id: string;
  template_card_id: string | null;
  default_labels: string[] | null;
  default_members: string[] | null;
  is_active: boolean;
};

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeLimit(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(Math.max(Math.trunc(value), 1), 50)
    : 10;
}

function retryDelayMinutes(attempts: number) {
  return attempts <= 1 ? 5 : 15;
}

function text(value: unknown, max = 16000) {
  const result = String(value ?? "").trim();
  return result.length > max ? result.slice(0, max) : result;
}

async function requireAuthorizedCaller(req: Request, supabase: SupabaseAdmin) {
  const configuredWorkerSecret = Deno.env.get("AGENT_OS_WORKER_SECRET") || "";
  const suppliedWorkerSecret = req.headers.get("x-agent-os-worker-secret") || "";

  if (configuredWorkerSecret && suppliedWorkerSecret === configuredWorkerSecret) {
    return { allowed: true as const, mode: "worker_secret" as const, userId: null };
  }

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { allowed: false as const, status: 401, reason: "Authentication required." };

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return { allowed: false as const, status: 401, reason: "Authentication could not be verified." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile || !internalRoles.has(String(profile.role))) {
    return { allowed: false as const, status: 403, reason: "Internal staff access is required." };
  }

  return { allowed: true as const, mode: "internal_user" as const, userId: userData.user.id };
}

async function updateQueue(
  supabase: SupabaseAdmin,
  id: string,
  values: Record<string, unknown>,
) {
  const { error } = await supabase
    .from("trello_sync_queue")
    .update({
      ...values,
      locked_at: null,
      locked_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

async function recordRun(
  supabase: SupabaseAdmin,
  item: TrelloQueueRecord,
  status: string,
  resultSummary: string,
  errorDetail?: string,
) {
  const runKey = `trello:${item.id}:attempt:${item.attempts}`;
  const { error } = await supabase.from("agent_runs").upsert(
    {
      run_key: runKey,
      agent_name: "Agent OS Trello Sync Worker",
      agent_role: "Controlled Trello Synchronization Processor",
      case_registry_id: item.case_registry_id,
      work_item_id: item.work_item_id,
      trigger_type: "trello_sync_queue",
      source_event_id: item.id,
      status,
      confidence: "high",
      systems_consulted: ["trello_sync_queue", "trello_route_mappings", "trello"],
      sources_used: [{ queue_record_id: item.id, route_key: item.route_key }],
      action_attempted: `${item.direction}:${item.operation}`,
      approval_required: false,
      records_changed: [{ table: "trello_sync_queue", id: item.id }],
      result_summary: resultSummary,
      error_detail: errorDetail || null,
      retry_count: Math.max(item.attempts - 1, 0),
      completed_at: new Date().toISOString(),
      metadata: {
        entity_type: item.entity_type,
        entity_id: item.entity_id,
        direction: item.direction,
      },
    },
    { onConflict: "run_key" },
  );
  if (error) console.error("Could not record Trello Agent OS run", error.message);
}

async function findRoute(
  supabase: SupabaseAdmin,
  item: TrelloQueueRecord,
): Promise<TrelloRoute | null> {
  const requestedRoute = item.route_key || text(item.payload?.route_key, 200);

  if (requestedRoute) {
    const { data, error } = await supabase
      .from("trello_route_mappings")
      .select("route_key, workspace_id, board_id, list_id, template_card_id, default_labels, default_members, is_active")
      .eq("route_key", requestedRoute)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw error;
    return data as TrelloRoute | null;
  }

  const departmentModule = text(item.payload?.department_module, 120);
  const caseType = text(item.payload?.case_type, 120);
  if (!departmentModule) return null;

  let query = supabase
    .from("trello_route_mappings")
    .select("route_key, workspace_id, board_id, list_id, template_card_id, default_labels, default_members, is_active")
    .eq("department_module", departmentModule)
    .eq("operation", item.operation)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1);

  if (caseType) query = query.or(`case_type.eq.${caseType},case_type.is.null`);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data as TrelloRoute | null;
}

async function trelloRequest(
  path: string,
  method: "POST" | "PUT",
  params: URLSearchParams,
  key: string,
  token: string,
) {
  params.set("key", key);
  params.set("token", token);

  const response = await fetch(`https://api.trello.com/1${path}`, {
    method,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const payload = await response.json().catch(() => ({} as Record<string, unknown>));
  if (!response.ok) {
    const detail = text(payload?.message || payload?.error || "Trello rejected the request.", 300);
    throw new Error(`Trello request failed (${response.status}): ${detail}`);
  }
  return payload as Record<string, unknown>;
}

async function createCard(
  item: TrelloQueueRecord,
  route: TrelloRoute,
  key: string,
  token: string,
) {
  const title = text(item.payload?.title || item.payload?.name || item.entity_id, 16384);
  if (!title) throw new Error("Trello card title is missing.");

  const description = text(
    item.payload?.description ||
      [
        text(item.payload?.reference_number, 200),
        text(item.payload?.case_type, 200),
        text(item.payload?.source_table, 200),
        text(item.payload?.source_record_id, 200),
      ].filter(Boolean).join("\n"),
    16384,
  );

  const params = new URLSearchParams({
    idList: route.list_id,
    name: title,
    desc: description,
    pos: "bottom",
  });

  if (route.template_card_id) {
    params.set("idCardSource", route.template_card_id);
    params.set("keepFromSource", "all");
  }

  const labels = Array.isArray(route.default_labels) ? route.default_labels.filter(Boolean) : [];
  const members = Array.isArray(route.default_members) ? route.default_members.filter(Boolean) : [];
  if (labels.length) params.set("idLabels", labels.join(","));
  if (members.length) params.set("idMembers", members.join(","));

  return await trelloRequest("/cards", "POST", params, key, token);
}

async function updateCard(
  item: TrelloQueueRecord,
  key: string,
  token: string,
) {
  const cardId = text(item.payload?.card_id || item.payload?.trello_card_id, 200);
  if (!cardId) throw new Error("Trello card ID is missing for update.");

  const params = new URLSearchParams();
  const name = text(item.payload?.title || item.payload?.name, 16384);
  const description = text(item.payload?.description, 16384);
  const listId = text(item.payload?.list_id, 200);
  const closed = item.payload?.closed;

  if (name) params.set("name", name);
  if (description) params.set("desc", description);
  if (listId) params.set("idList", listId);
  if (typeof closed === "boolean") params.set("closed", closed ? "true" : "false");
  if ([...params.keys()].length === 0) {
    throw new Error("No supported Trello card update fields were provided.");
  }

  return await trelloRequest(`/cards/${encodeURIComponent(cardId)}`, "PUT", params, key, token);
}

async function persistExternalCard(
  supabase: SupabaseAdmin,
  item: TrelloQueueRecord,
  cardId: string | null,
  cardUrl: string | null,
  route: TrelloRoute | null,
) {
  if (item.case_registry_id && cardId) {
    const { error } = await supabase
      .from("case_registry")
      .update({
        trello_workspace_id: route?.workspace_id || null,
        trello_board_id: route?.board_id || null,
        trello_list_id: route?.list_id || null,
        trello_card_id: cardId,
      })
      .eq("id", item.case_registry_id);
    if (error) throw error;
  }

  if (item.work_item_id && cardId) {
    const { error } = await supabase
      .from("work_items")
      .update({
        trello_workspace_id: route?.workspace_id || null,
        trello_board_id: route?.board_id || null,
        trello_list_id: route?.list_id || null,
        trello_card_id: cardId,
      })
      .eq("id", item.work_item_id);
    if (error) throw error;
  }

  await updateQueue(supabase, item.id, {
    status: "completed",
    completed_at: new Date().toISOString(),
    external_object_id: cardId,
    external_object_url: cardUrl,
    route_key: route?.route_key || item.route_key,
    next_attempt_at: null,
    error_message: null,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Use POST." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: "Server configuration missing." }, 500);

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    }) as SupabaseAdmin;
    const caller = await requireAuthorizedCaller(req, supabase);
    if (!caller.allowed) return jsonResponse({ error: caller.reason }, caller.status);

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const limit = safeLimit(body.limit);
    const liveRequested = body.live === true;
    const liveEnabled = Deno.env.get("AGENT_OS_TRELLO_LIVE") === "true";
    const live = liveRequested && liveEnabled;

    if (!live) {
      const { data, error } = await supabase
        .from("agent_os_trello_route_readiness")
        .select("queue_id, case_registry_id, operation, status, attempts, requested_route_key, route_readiness, department_module, board_id, list_id, template_card_id, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(limit);
      if (error) throw error;

      return jsonResponse({
        mode: "dry_run",
        live_requested: liveRequested,
        live_enabled: liveEnabled,
        eligible_count: data?.length || 0,
        eligible: data || [],
        note: "No Trello operation was claimed or executed.",
      });
    }

    const trelloKey = Deno.env.get("TRELLO_API_KEY");
    const trelloToken = Deno.env.get("TRELLO_API_TOKEN");
    if (!trelloKey || !trelloToken) {
      return jsonResponse({ error: "Live Trello synchronization is enabled but credentials are incomplete." }, 503);
    }

    await supabase.rpc("recover_stale_agent_os_trello_sync");
    const workerId = `agent-os-trello:${crypto.randomUUID()}`;
    const { data: claimed, error: claimError } = await supabase.rpc("claim_agent_os_trello_sync", {
      p_limit: limit,
      p_worker_id: workerId,
    });
    if (claimError) throw claimError;

    const processed: Array<{ id: string; status: string; attempt: number; reason?: string }> = [];

    for (const item of (claimed || []) as TrelloQueueRecord[]) {
      try {
        if (item.direction !== "supabase_to_trello") {
          throw new Error("This worker only supports Supabase-to-Trello operations.");
        }

        const route = await findRoute(supabase, item);
        if (!route && item.operation === "create_card") {
          await updateQueue(supabase, item.id, {
            status: "blocked",
            error_message: "An approved Trello route mapping is required before card creation.",
          });
          await recordRun(
            supabase,
            item,
            "blocked",
            "Trello operation blocked because no active route mapping was found.",
          );
          processed.push({ id: item.id, status: "blocked", attempt: item.attempts });
          continue;
        }

        let result: Record<string, unknown>;
        if (item.operation === "create_card") {
          result = await createCard(item, route as TrelloRoute, trelloKey, trelloToken);
        } else if (item.operation === "update_card" || item.operation === "move_card") {
          result = await updateCard(item, trelloKey, trelloToken);
        } else {
          throw new Error(`Unsupported Trello operation: ${item.operation}`);
        }

        const cardId = text(result.id, 200) || null;
        const cardUrl = text(result.url || result.shortUrl, 1000) || null;
        await persistExternalCard(supabase, item, cardId, cardUrl, route);
        await recordRun(supabase, item, "completed", `Trello ${item.operation} completed successfully.`);
        processed.push({ id: item.id, status: "completed", attempt: item.attempts });
      } catch (syncError) {
        const reason = syncError instanceof Error ? syncError.message : "Trello synchronization failed.";
        const terminal = item.attempts >= 3;
        const nextAttemptAt = terminal
          ? null
          : new Date(Date.now() + retryDelayMinutes(item.attempts) * 60_000).toISOString();

        await updateQueue(supabase, item.id, {
          status: terminal ? "failed" : "pending",
          next_attempt_at: nextAttemptAt,
          error_message: reason.slice(0, 1000),
        });
        await recordRun(
          supabase,
          item,
          terminal ? "failed" : "retry_scheduled",
          terminal
            ? "Trello synchronization failed after the third attempt."
            : "Trello synchronization failed and was returned to the queue for retry.",
          reason,
        );
        processed.push({
          id: item.id,
          status: terminal ? "failed" : "retry_scheduled",
          attempt: item.attempts,
          reason,
        });
      }
    }

    return jsonResponse({
      mode: "live",
      worker_id: workerId,
      claimed_count: claimed?.length || 0,
      processed,
    });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
