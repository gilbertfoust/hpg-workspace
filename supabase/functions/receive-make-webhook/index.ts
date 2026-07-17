import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-make-webhook-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const url = new URL(req.url);
    const automationId = url.searchParams.get("automation_id");
    const webhookSecret = req.headers.get("x-make-webhook-secret") || url.searchParams.get("secret");

    if (!automationId) {
      return new Response(
        JSON.stringify({ error: "automation_id query parameter is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch automation
    const { data: automation, error: fetchError } = await supabase
      .from("make_automations")
      .select("*")
      .eq("id", automationId)
      .eq("is_active", true)
      .single();

    if (fetchError || !automation) {
      return new Response(
        JSON.stringify({ error: "Automation not found or inactive" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate webhook secret if configured
    if (automation.webhook_secret && automation.webhook_secret !== webhookSecret) {
      return new Response(
        JSON.stringify({ error: "Invalid webhook secret" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse incoming payload
    let payload: Record<string, unknown> = {};
    try {
      payload = await req.json();
    } catch {
      // Body might not be JSON
      payload = { raw: await req.text() };
    }

    // Log the incoming webhook
    await supabase.from("make_automation_logs").insert({
      automation_id: automationId,
      status: "success",
      request_payload: payload,
      response_payload: { source: "inbound_webhook" },
    });

    // Update automation stats
    await supabase
      .from("make_automations")
      .update({
        last_triggered_at: new Date().toISOString(),
        trigger_count: (automation.trigger_count || 0) + 1,
      })
      .eq("id", automationId);

    // Process based on trigger_event — extensible handlers
    const result = await processInboundWebhook(supabase, automation, payload);

    return new Response(
      JSON.stringify({ success: true, processed: result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing Make webhook:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function processInboundWebhook(
  supabase: SupabaseClient,
  automation: Record<string, unknown>,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const event = automation.trigger_event as string;

  const routableEvents = new Set([
    "work_item.created",
    "gmail.work_item",
    "slack.work_item",
    "gdrive.work_item",
    "department.intake",
  ]);

  if (routableEvents.has(event)) {
    const config = (automation.config_json && typeof automation.config_json === "object")
      ? automation.config_json as Record<string, unknown>
      : {};
    const rawTitle = String(payload.title || payload.subject || payload.name || "").trim();
    if (!rawTitle) return { action: "skipped", reason: "title or subject is required" };

    const department = String(payload.department || config.department || "administration").toLowerCase();
    const moduleAliases: Record<string, string> = {
      "ngo coordination": "ngo_coordination",
      "programs": "program",
      "partnerships": "development",
      "procurement": "development",
      "grants": "development",
      "fundraising": "development",
      "human resources": "hr",
      "technology": "it",
      "audit": "it",
      "governance": "legal",
      "compliance": "legal",
      "assets": "finance",
      "inventory": "finance",
    };
    const allowedModules = new Set([
      "ngo_coordination", "administration", "operations", "program", "curriculum",
      "development", "partnership", "marketing", "communications", "hr", "it",
      "finance", "legal",
    ]);
    const requestedModule = String(payload.module || config.module || moduleAliases[department] || department)
      .toLowerCase().replace(/\s+/g, "_");
    const moduleName = allowedModules.has(requestedModule) ? requestedModule : "administration";
    const externalEventId = String(
      payload.external_event_id || payload.message_id || payload.event_id || payload.id || crypto.randomUUID()
    );
    const provider = event.split(".")[0] || "make";

    const { error: eventError } = await supabase.from("integration_webhook_events").insert({
      provider,
      external_event_id: externalEventId,
      event_type: event,
      status: "received",
      payload,
    });
    if (eventError?.code === "23505") {
      return { action: "idempotent_replay", external_event_id: externalEventId };
    }
    if (eventError) throw eventError;

    const rawPriority = String(payload.priority || config.priority || "medium").toLowerCase();
    const priority = ["low", "medium", "high"].includes(rawPriority) ? rawPriority : "medium";
    const rawStatus = String(payload.status || "not_started").toLowerCase();
    const status = [
      "not_started", "in_progress", "waiting_on_ngo", "waiting_on_hpg",
      "submitted", "under_review", "approved", "rejected", "complete", "canceled",
    ].includes(rawStatus) ? rawStatus : "not_started";

    const { data, error } = await supabase.from("work_items").insert({
      title: rawTitle,
      description: payload.description || payload.body || payload.snippet
        || `Created through ${provider} / Make.com automation: ${automation.name}`,
      module: moduleName,
      status,
      priority,
      type: String(payload.type || `${provider}_intake`),
      ngo_id: payload.ngo_id || null,
      external_visible: payload.external_visible === true,
      trello_sync: payload.sync_to_trello === true || config.sync_to_trello === true,
      source_system: provider,
      source_event_id: externalEventId,
    }).select("id, department_id").single();
    if (error) throw error;

    await supabase.from("integration_webhook_events").update({
      status: "processed",
      processed_at: new Date().toISOString(),
    }).eq("provider", provider).eq("external_event_id", externalEventId);

    return {
      action: "work_item_created",
      id: data.id,
      department_id: data.department_id,
      module: moduleName,
      provider,
    };
  }

  switch (event) {
    case "custom.webhook":
    default:
      return { action: "logged", event, payload_keys: Object.keys(payload) };
  }
}
