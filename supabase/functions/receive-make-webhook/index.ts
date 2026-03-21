import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    let payload = {};
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
    const result = await processInboundWebhook(supabase as any, automation, payload);

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
  supabase: any,
  automation: Record<string, unknown>,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const event = automation.trigger_event as string;

  switch (event) {
    case "work_item.created": {
      // Create a work item from Make.com data
      if (payload.title) {
        const { data, error } = await supabase.from("work_items").insert({
          title: payload.title,
          description: payload.description || `Created via Make.com automation: ${automation.name}`,
          status: payload.status || "open",
          priority: payload.priority || "medium",
          department: payload.department || "Administration",
        }).select("id").single();
        return { action: "work_item_created", id: data?.id, error: error?.message };
      }
      return { action: "skipped", reason: "no title provided" };
    }
    case "custom.webhook":
    default:
      return { action: "logged", event, payload_keys: Object.keys(payload) };
  }
}
