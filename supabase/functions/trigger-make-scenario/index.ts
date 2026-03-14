import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const { automation_id, payload } = await req.json();

    if (!automation_id) {
      return new Response(JSON.stringify({ error: "automation_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the automation config
    const { data: automation, error: fetchError } = await supabase
      .from("make_automations")
      .select("*")
      .eq("id", automation_id)
      .eq("is_active", true)
      .single();

    if (fetchError || !automation) {
      return new Response(
        JSON.stringify({ error: "Automation not found or inactive" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!automation.webhook_url) {
      return new Response(
        JSON.stringify({ error: "No webhook URL configured for this automation" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a log entry
    const { data: logEntry } = await supabase
      .from("make_automation_logs")
      .insert({
        automation_id,
        status: "pending",
        request_payload: payload || {},
        triggered_by_user_id: userId,
      })
      .select("id")
      .single();

    // Call the Make.com webhook
    let makeResponse;
    let responseBody;
    try {
      makeResponse = await fetch(automation.webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trigger_event: automation.trigger_event,
          automation_name: automation.name,
          payload: payload || {},
          triggered_at: new Date().toISOString(),
          triggered_by: userId,
        }),
      });
      responseBody = await makeResponse.text();
    } catch (fetchErr) {
      // Update log with error
      if (logEntry?.id) {
        await supabase
          .from("make_automation_logs")
          .update({
            status: "error",
            error_message: fetchErr instanceof Error ? fetchErr.message : "Network error",
          })
          .eq("id", logEntry.id);
      }
      return new Response(
        JSON.stringify({ error: "Failed to reach Make.com webhook" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update log and automation stats
    const logStatus = makeResponse.ok ? "success" : "error";

    if (logEntry?.id) {
      await supabase
        .from("make_automation_logs")
        .update({
          status: logStatus,
          response_payload: { status: makeResponse.status, body: responseBody },
          error_message: makeResponse.ok ? null : `HTTP ${makeResponse.status}`,
        })
        .eq("id", logEntry.id);
    }

    // Use service role to update automation stats (bypasses RLS)
    const serviceClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await serviceClient
      .from("make_automations")
      .update({
        last_triggered_at: new Date().toISOString(),
        trigger_count: (automation.trigger_count || 0) + 1,
      })
      .eq("id", automation_id);

    return new Response(
      JSON.stringify({
        success: makeResponse.ok,
        log_id: logEntry?.id,
        status: makeResponse.status,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error triggering Make scenario:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
