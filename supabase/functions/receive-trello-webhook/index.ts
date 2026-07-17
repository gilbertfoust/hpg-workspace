import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-trello-webhook-secret",
};

const allowedModules = new Set([
  "ngo_coordination", "administration", "operations", "program", "curriculum",
  "development", "partnership", "marketing", "communications", "hr", "it",
  "finance", "legal",
]);

const json = (body: Record<string, unknown>, status = 200) => new Response(
  JSON.stringify(body),
  { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
);

const cleanText = (value: unknown, max = 16_000) => {
  const text = String(value ?? "").trim();
  return text.length > max ? text.slice(0, max) : text;
};

interface TrelloRoute {
  board_id: string;
  list_id: string;
  completed_list_id: string | null;
  workspace_id: string | null;
  department_module: string;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Trello performs a HEAD/GET-style callback check when a webhook is created.
  if (request.method === "HEAD" || request.method === "GET") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (request.method !== "POST") return json({ error: "Use POST." }, 405);

  const url = new URL(request.url);
  const expectedSecret = Deno.env.get("TRELLO_WEBHOOK_SECRET") || "";
  const suppliedSecret = request.headers.get("x-trello-webhook-secret")
    || url.searchParams.get("secret")
    || "";
  if (!expectedSecret || suppliedSecret !== expectedSecret) {
    return json({ error: "Trello webhook authentication failed." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Server configuration missing." }, 500);

  const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  let eventId: string | null = null;

  try {
    const payload = await request.json();
    const action = payload?.action || {};
    const externalEventId = cleanText(action.id, 200);
    const eventType = cleanText(action.type, 120);
    if (!externalEventId || !eventType) return json({ error: "Trello action id and type are required." }, 400);

    const { data: insertedEvent, error: eventError } = await db
      .from("integration_webhook_events")
      .insert({
        provider: "trello",
        external_event_id: externalEventId,
        event_type: eventType,
        status: "received",
        payload,
      })
      .select("id")
      .single();

    if (eventError?.code === "23505") {
      return json({ success: true, idempotent_replay: true });
    }
    if (eventError) throw eventError;
    eventId = insertedEvent.id;

    const card = action?.data?.card || {};
    const board = action?.data?.board || {};
    const list = action?.data?.list || action?.data?.listAfter || {};
    const cardId = cleanText(card.id, 200);
    if (!cardId) {
      await db.from("integration_webhook_events").update({
        status: "ignored", processed_at: new Date().toISOString(),
      }).eq("id", eventId);
      return json({ success: true, ignored: "Event has no card." });
    }

    let { data: workItem } = await db
      .from("work_items")
      .select("*")
      .eq("trello_card_id", cardId)
      .maybeSingle();

    let route: TrelloRoute | null = null;
    const boardId = cleanText(board.id, 200);
    if (boardId) {
      let routeQuery = db.from("trello_route_mappings").select("*")
        .eq("board_id", boardId).eq("is_active", true).limit(1);
      const listId = cleanText(list.id, 200);
      if (listId) routeQuery = routeQuery.or(`list_id.eq.${listId},completed_list_id.eq.${listId}`);
      const routeResult = await routeQuery.maybeSingle();
      if (routeResult.error) throw routeResult.error;
      route = routeResult.data as TrelloRoute | null;
    }

    // A card created in a mapped Trello board becomes a routed Workspace item.
    if (!workItem && eventType === "createCard" && route) {
      const moduleName = allowedModules.has(route.department_module)
        ? route.department_module
        : "administration";
      const { data: departmentId, error: departmentError } = await db
        .rpc("resolve_work_item_department", { p_module: moduleName });
      if (departmentError) throw departmentError;

      const { data: created, error: createError } = await db.from("work_items").insert({
        module: moduleName,
        department_id: departmentId,
        title: cleanText(card.name, 500) || "Trello work item",
        description: cleanText(card.desc) || "Created from a mapped Trello card.",
        type: "trello_card",
        status: card.closed ? "complete" : "not_started",
        priority: "medium",
        source_system: "trello",
        source_event_id: externalEventId,
        trello_sync: true,
        trello_card_id: cardId,
        trello_board_id: boardId || route.board_id,
        trello_list_id: cleanText(list.id, 200) || route.list_id,
        trello_workspace_id: route.workspace_id,
        completed_at: card.closed ? new Date().toISOString() : null,
        last_external_sync_at: new Date().toISOString(),
      }).select("*").single();
      if (createError) throw createError;
      workItem = created;
    }

    if (!workItem) {
      await db.from("integration_webhook_events").update({
        status: "ignored",
        processed_at: new Date().toISOString(),
        error_message: "No linked work item or active route mapping.",
      }).eq("id", eventId);
      return json({ success: true, ignored: "No linked work item or route." });
    }

    const updates: Record<string, unknown> = {
      last_external_sync_at: new Date().toISOString(),
    };
    if (typeof card.name === "string" && card.name.trim()) updates.title = cleanText(card.name, 500);
    if (typeof card.desc === "string") updates.description = cleanText(card.desc);
    if (action?.data?.listAfter?.id) updates.trello_list_id = cleanText(action.data.listAfter.id, 200);

    const movedToCompletedList = !!(
      route?.completed_list_id
      && action?.data?.listAfter?.id === route.completed_list_id
    );
    if (card.closed === true || movedToCompletedList) {
      updates.status = "complete";
      updates.completed_at = new Date().toISOString();
    } else if (card.closed === false && workItem.status === "complete") {
      updates.status = "in_progress";
      updates.completed_at = null;
    }

    const { error: updateError } = await db.from("work_items")
      .update(updates).eq("id", workItem.id);
    if (updateError) throw updateError;

    // Trello membership is authoritative for My Queue when a mapping exists.
    if (eventType === "addMemberToCard" || eventType === "removeMemberFromCard") {
      const trelloMemberId = cleanText(action?.data?.member?.id || action?.member?.id, 200);
      if (trelloMemberId) {
        const { data: mapping, error: mappingError } = await db
          .from("trello_member_mappings")
          .select("user_id")
          .eq("trello_member_id", trelloMemberId)
          .eq("is_active", true)
          .maybeSingle();
        if (mappingError) throw mappingError;

        if (mapping?.user_id && eventType === "addMemberToCard") {
          const { error: assigneeError } = await db.from("work_item_assignees").upsert({
            work_item_id: workItem.id,
            user_id: mapping.user_id,
            assignment_role: "assignee",
            source_system: "trello",
            external_member_id: trelloMemberId,
          }, { onConflict: "work_item_id,user_id,assignment_role" });
          if (assigneeError) throw assigneeError;
          if (!workItem.owner_user_id) {
            await db.from("work_items").update({
              owner_user_id: mapping.user_id,
              last_external_sync_at: new Date().toISOString(),
            })
              .eq("id", workItem.id).is("owner_user_id", null);
          }
        }

        if (mapping?.user_id && eventType === "removeMemberFromCard") {
          const { error: removeError } = await db.from("work_item_assignees").delete()
            .eq("work_item_id", workItem.id)
            .eq("user_id", mapping.user_id)
            .eq("source_system", "trello");
          if (removeError) throw removeError;
          if (workItem.owner_user_id === mapping.user_id) {
            const { data: replacement } = await db.from("work_item_assignees")
              .select("user_id").eq("work_item_id", workItem.id)
              .in("assignment_role", ["owner", "assignee"]).limit(1).maybeSingle();
            await db.from("work_items").update({
              owner_user_id: replacement?.user_id || null,
              last_external_sync_at: new Date().toISOString(),
            })
              .eq("id", workItem.id);
          }
        }
      }
    }

    await db.from("integration_webhook_events").update({
      status: "processed", processed_at: new Date().toISOString(),
    }).eq("id", eventId);

    return json({ success: true, work_item_id: workItem.id, event_type: eventType });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (eventId) {
      await db.from("integration_webhook_events").update({
        status: "failed", processed_at: new Date().toISOString(), error_message: message,
      }).eq("id", eventId);
    }
    console.error("Trello webhook failed", message);
    return json({ error: message }, 500);
  }
});
