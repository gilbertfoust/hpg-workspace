import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type WorkflowEvent = {
  id: string;
  notification_type: "slack" | "email";
  notification_status: "queued" | "sent" | "skipped" | "failed";
  recipient: string | null;
  module: string;
  metadata_json: Record<string, unknown> | null;
};

async function markEvent(
  supabase: ReturnType<typeof createClient>,
  id: string,
  status: "sent" | "skipped" | "failed",
  message?: string,
) {
  await supabase
    .from("form_notification_events")
    .update({
      notification_status: status,
      error_message: message || null,
      processed_at: new Date().toISOString(),
    })
    .eq("id", id);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Server configuration missing." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const limit = typeof body.limit === "number" ? Math.min(Math.max(body.limit, 1), 25) : 10;

    const { data: events, error } = await supabase
      .from("form_notification_events")
      .select("id, notification_type, notification_status, recipient, module, metadata_json")
      .eq("notification_status", "queued")
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) throw error;

    const processed: Array<{ id: string; status: string; reason?: string }> = [];

    for (const event of (events || []) as WorkflowEvent[]) {
      if (!event.recipient) {
        await markEvent(supabase, event.id, "skipped", "No destination configured.");
        processed.push({ id: event.id, status: "skipped", reason: "No destination configured." });
        continue;
      }

      // Delivery providers are intentionally not enabled in this scaffold.
      // The next implementation should add provider-specific senders using server-side secrets only.
      await markEvent(
        supabase,
        event.id,
        "skipped",
        `Delivery provider not configured for ${event.notification_type}.`,
      );
      processed.push({
        id: event.id,
        status: "skipped",
        reason: `Delivery provider not configured for ${event.notification_type}.`,
      });
    }

    return new Response(JSON.stringify({ processed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
