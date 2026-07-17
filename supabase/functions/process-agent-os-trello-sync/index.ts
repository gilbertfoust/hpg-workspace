import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-agent-os-worker-secret, x-work-item-trello-secret",
};

const internalRoles = new Set([
  "super_admin",
  "admin_pm",
  "ngo_coordinator",
  "department_lead",
  "executive_secretariat",
  "staff_member",
  "vp_finance",
]);

type QueueItem = {
  id: string;
  work_item_id: string | null;
  entity_type: string;
  entity_id: string;
  operation: string;
  direction: string;
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

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const cleanText = (value: unknown, max = 16_000) => {
  const result = String(value ?? "").trim();
  return result.length > max ? result.slice(0, max) : result;
};

const safeLimit = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(Math.max(Math.trunc(value), 1), 50)
    : 10;

async function authorize(request: Request, db: SupabaseClient) {
  const configuredSecret = Deno.env.get("WORK_ITEM_TRELLO_SYNC_SECRET")
    || Deno.env.get("AGENT_OS_WORKER_SECRET")
    || "";
  const suppliedSecret = request.headers.get("x-work-item-trello-secret")
    || request.headers.get("x-agent-os-worker-secret")
    || "";
  if (configuredSecret && suppliedSecret === configuredSecret) {
    return { allowed: true as const, mode: "worker_secret" };
  }

  const token = (request.headers.get("Authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) return { allowed: false as const, status: 401, reason: "Authentication required." };

  const { data: userData, error: userError } = await db.auth.getUser(token);
  if (userError || !userData.user) {
    return { allowed: false as const, status: 401, reason: "Authentication could not be verified." };
  }

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile || !internalRoles.has(String(profile.role))) {
    return { allowed: false as const, status: 403, reason: "Internal staff access is required." };
  }
  return { allowed: true as const, mode: "internal_user" };
}

async function findRoute(db: SupabaseClient, item: QueueItem): Promise<TrelloRoute | null> {
  const requested = item.route_key || cleanText(item.payload?.route_key, 200);
  if (requested) {
    const { data, error } = await db
      .from("trello_route_mappings")
      .select("route_key,workspace_id,board_id,list_id,template_card_id,default_labels,default_members,is_active")
      .eq("route_key", requested)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw error;
    return data as TrelloRoute | null;
  }

  const moduleName = cleanText(item.payload?.department_module, 120);
  if (!moduleName) return null;
  const { data, error } = await db
    .from("trello_route_mappings")
    .select("route_key,workspace_id,board_id,list_id,template_card_id,default_labels,default_members,is_active")
    .eq("department_module", moduleName)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
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
  const body = await response.json().catch(() => ({} as Record<string, unknown>));
  if (!response.ok) {
    throw new Error(
      `Trello request failed (${response.status}): ${cleanText(body?.message || body?.error || "Unknown error", 300)}`,
    );
  }
  return body as Record<string, unknown>;
}

async function mappedOwnerMember(db: SupabaseClient, item: QueueItem) {
  const ownerId = cleanText(item.payload?.owner_user_id, 100);
  if (!ownerId) return null;
  const { data, error } = await db
    .from("trello_member_mappings")
    .select("trello_member_id")
    .eq("user_id", ownerId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.trello_member_id || null;
}

async function createCard(
  db: SupabaseClient,
  item: QueueItem,
  route: TrelloRoute,
  key: string,
  token: string,
) {
  const title = cleanText(item.payload?.title || item.entity_id, 16_384);
  if (!title) throw new Error("Trello card title is missing.");
  const params = new URLSearchParams({
    idList: route.list_id,
    name: title,
    desc: cleanText(item.payload?.description),
    pos: "bottom",
  });
  const dueDate = cleanText(item.payload?.due_date, 100);
  if (dueDate) params.set("due", dueDate);
  if (route.template_card_id) {
    params.set("idCardSource", route.template_card_id);
    params.set("keepFromSource", "all");
  }
  const members = new Set(
    Array.isArray(route.default_members) ? route.default_members.filter(Boolean) : [],
  );
  const mappedOwner = await mappedOwnerMember(db, item);
  if (mappedOwner) members.add(mappedOwner);
  const labels = Array.isArray(route.default_labels) ? route.default_labels.filter(Boolean) : [];
  if (members.size) params.set("idMembers", [...members].join(","));
  if (labels.length) params.set("idLabels", labels.join(","));
  return await trelloRequest("/cards", "POST", params, key, token);
}

async function updateCard(
  db: SupabaseClient,
  item: QueueItem,
  key: string,
  token: string,
) {
  const cardId = cleanText(item.payload?.card_id || item.payload?.trello_card_id, 200);
  if (!cardId) throw new Error("Trello card ID is missing for update.");
  const params = new URLSearchParams();
  const title = cleanText(item.payload?.title, 16_384);
  const description = cleanText(item.payload?.description);
  const listId = cleanText(item.payload?.list_id, 200);
  const dueDate = cleanText(item.payload?.due_date, 100);
  if (title) params.set("name", title);
  if (description) params.set("desc", description);
  if (listId) params.set("idList", listId);
  if (dueDate) params.set("due", dueDate);
  if (typeof item.payload?.closed === "boolean") {
    params.set("closed", item.payload.closed ? "true" : "false");
  }
  if ([...params.keys()].length) {
    await trelloRequest(`/cards/${encodeURIComponent(cardId)}`, "PUT", params, key, token);
  }

  const mappedOwner = await mappedOwnerMember(db, item);
  if (mappedOwner) {
    await trelloRequest(
      `/cards/${encodeURIComponent(cardId)}/idMembers`,
      "POST",
      new URLSearchParams({ value: mappedOwner }),
      key,
      token,
    );
  }
  return { id: cardId };
}

async function updateQueue(
  db: SupabaseClient,
  id: string,
  values: Record<string, unknown>,
) {
  const { error } = await db
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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Use POST." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Server configuration missing." }, 500);
    const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const caller = await authorize(request, db);
    if (!caller.allowed) return json({ error: caller.reason }, caller.status);

    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const limit = safeLimit(body.limit);
    const liveRequested = body.live === true;
    const liveEnabled = Deno.env.get("WORK_ITEM_TRELLO_SYNC_LIVE") === "true"
      || Deno.env.get("AGENT_OS_TRELLO_LIVE") === "true";

    if (!liveRequested || !liveEnabled) {
      const { data, error } = await db
        .from("trello_sync_queue")
        .select("id,work_item_id,entity_type,entity_id,operation,route_key,status,attempts,created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(limit);
      if (error) throw error;
      return json({
        mode: "dry_run",
        live_requested: liveRequested,
        live_enabled: liveEnabled,
        eligible_count: data?.length || 0,
        eligible: data || [],
      });
    }

    const trelloKey = Deno.env.get("TRELLO_API_KEY");
    const trelloToken = Deno.env.get("TRELLO_API_TOKEN");
    if (!trelloKey || !trelloToken) {
      return json({ error: "Live Trello credentials are incomplete." }, 503);
    }

    const now = new Date();
    const staleBefore = new Date(now.getTime() - 15 * 60_000).toISOString();
    await db.from("trello_sync_queue").update({
      status: "pending",
      locked_at: null,
      locked_by: null,
      next_attempt_at: now.toISOString(),
      updated_at: now.toISOString(),
    }).eq("status", "processing").lt("locked_at", staleBefore);

    const { data: pending, error: pendingError } = await db
      .from("trello_sync_queue")
      .select("id,work_item_id,entity_type,entity_id,operation,direction,route_key,payload,status,attempts")
      .eq("status", "pending")
      .or(`next_attempt_at.is.null,next_attempt_at.lte.${now.toISOString()}`)
      .order("created_at", { ascending: true })
      .limit(limit);
    if (pendingError) throw pendingError;

    const workerId = `work-item-trello:${crypto.randomUUID()}`;
    const processed: Array<Record<string, unknown>> = [];

    for (const candidate of (pending || []) as QueueItem[]) {
      const attempt = (candidate.attempts || 0) + 1;
      const { data: claimed, error: claimError } = await db
        .from("trello_sync_queue")
        .update({
          status: "processing",
          attempts: attempt,
          last_attempt_at: new Date().toISOString(),
          locked_at: new Date().toISOString(),
          locked_by: workerId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", candidate.id)
        .eq("status", "pending")
        .select("id,work_item_id,entity_type,entity_id,operation,direction,route_key,payload,status,attempts")
        .maybeSingle();
      if (claimError) throw claimError;
      if (!claimed) continue;
      const item = claimed as QueueItem;

      try {
        if (item.direction !== "supabase_to_trello") {
          throw new Error("Only Workspace-to-Trello queue items are supported.");
        }
        const route = await findRoute(db, item);
        if (!route && item.operation === "create_card") {
          throw new Error("An active Trello route mapping is required before card creation.");
        }

        const result = item.operation === "create_card"
          ? await createCard(db, item, route as TrelloRoute, trelloKey, trelloToken)
          : await updateCard(db, item, trelloKey, trelloToken);
        const cardId = cleanText(result.id, 200);
        const cardUrl = cleanText(result.url || result.shortUrl, 1_000);

        if (item.work_item_id && cardId) {
          const { error } = await db.from("work_items").update({
            trello_workspace_id: route?.workspace_id || null,
            trello_board_id: route?.board_id || null,
            trello_list_id: route?.list_id || null,
            trello_card_id: cardId,
            last_external_sync_at: new Date().toISOString(),
          }).eq("id", item.work_item_id);
          if (error) throw error;
        }
        await updateQueue(db, item.id, {
          status: "completed",
          completed_at: new Date().toISOString(),
          next_attempt_at: null,
          error_message: null,
          external_object_id: cardId || null,
          external_object_url: cardUrl || null,
          route_key: route?.route_key || item.route_key,
        });
        processed.push({ id: item.id, status: "completed", attempt });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        const terminal = attempt >= 3 || reason.includes("route mapping");
        await updateQueue(db, item.id, {
          status: terminal ? "failed" : "pending",
          next_attempt_at: terminal
            ? null
            : new Date(Date.now() + (attempt <= 1 ? 5 : 15) * 60_000).toISOString(),
          error_message: reason.slice(0, 1_000),
        });
        processed.push({
          id: item.id,
          status: terminal ? "failed" : "retry_scheduled",
          attempt,
          reason,
        });
      }
    }

    return json({
      mode: "live",
      worker_id: workerId,
      claimed_count: processed.length,
      processed,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
