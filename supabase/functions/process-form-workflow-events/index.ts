import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const internalRoles = new Set([
  "staff",
  "super_admin",
  "admin_pm",
  "ngo_coordinator",
  "department_lead",
  "executive_secretariat",
]);

type WorkflowEvent = {
  id: string;
  notification_type: "slack" | "email";
  notification_status: "queued" | "sent" | "skipped" | "failed";
  recipient: string | null;
  module: string;
  metadata_json: Record<string, unknown> | null;
};

type DepartmentRoute = {
  module: string;
  department_name: string;
  slack_channel: string | null;
  slack_webhook_secret_name: string | null;
  is_active: boolean;
};

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function textValue(metadata: Record<string, unknown> | null, key: string, fallback: string) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

async function requireInternalCaller(req: Request, supabase: ReturnType<typeof createClient>) {
  const authorization = req.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return { allowed: false, status: 401, reason: "Authentication required." };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return { allowed: false, status: 401, reason: "Authentication could not be verified." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile || !internalRoles.has(profile.role)) {
    return { allowed: false, status: 403, reason: "Internal staff access is required." };
  }

  return { allowed: true, status: 200, reason: "Authorized." };
}

async function markEvent(
  supabase: ReturnType<typeof createClient>,
  id: string,
  status: "sent" | "skipped" | "failed",
  message?: string,
) {
  const { error } = await supabase
    .from("form_notification_events")
    .update({
      notification_status: status,
      error_message: message || null,
      processed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw error;
}

async function sendSlackEvent(event: WorkflowEvent, route: DepartmentRoute) {
  if (!route.slack_webhook_secret_name) {
    return { status: "skipped" as const, reason: "No Slack webhook secret name configured for this department." };
  }

  const webhookUrl = Deno.env.get(route.slack_webhook_secret_name);
  if (!webhookUrl) {
    return { status: "skipped" as const, reason: "Slack webhook secret has not been installed on the server." };
  }

  const formName = textValue(event.metadata_json, "form_name", "Form submission");
  const departmentName = textValue(event.metadata_json, "department_name", route.department_name);
  const message = [
    `New HPG form workflow item for *${departmentName}*`,
    `Form: ${formName}`,
    `Department route: ${event.recipient || route.slack_channel || "Not listed"}`,
    `Event ID: ${event.id}`,
    "Open HPG Workspace → Forms → Workflow Events to review the queued work item.",
  ].join("\n");

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: message }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Slack delivery failed (${response.status})${detail ? `: ${detail.slice(0, 160)}` : ""}`);
  }

  return { status: "sent" as const };
}

async function sendEmailEvent(event: WorkflowEvent, route: DepartmentRoute) {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("FORM_WORKFLOW_FROM_EMAIL");

  if (!resendApiKey || !fromEmail) {
    return { status: "skipped" as const, reason: "Email provider settings have not been installed on the server." };
  }

  if (!event.recipient) {
    return { status: "skipped" as const, reason: "No email recipient configured for this department." };
  }

  const formName = textValue(event.metadata_json, "form_name", "Form submission");
  const departmentName = textValue(event.metadata_json, "department_name", route.department_name);
  const subject = `New HPG Form Work Item — ${departmentName}`;
  const text = [
    `A new form submission has been routed to ${departmentName}.`,
    "",
    `Form: ${formName}`,
    `Workflow event ID: ${event.id}`,
    "",
    "Open HPG Workspace → Forms → Workflow Events to review the submission and assigned work item.",
  ].join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [event.recipient],
      subject,
      text,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Email delivery failed (${response.status})${detail ? `: ${detail.slice(0, 160)}` : ""}`);
  }

  return { status: "sent" as const };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Use POST." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Server configuration missing." }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const caller = await requireInternalCaller(req, supabase);
    if (!caller.allowed) {
      return jsonResponse({ error: caller.reason }, caller.status);
    }

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
      try {
        const { data: route, error: routeError } = await supabase
          .from("department_notification_routes")
          .select("module, department_name, slack_channel, slack_webhook_secret_name, is_active")
          .eq("module", event.module)
          .eq("is_active", true)
          .maybeSingle();

        if (routeError) throw routeError;
        if (!route) {
          const reason = "No active department route configured.";
          await markEvent(supabase, event.id, "skipped", reason);
          processed.push({ id: event.id, status: "skipped", reason });
          continue;
        }

        const outcome = event.notification_type === "slack"
          ? await sendSlackEvent(event, route as DepartmentRoute)
          : await sendEmailEvent(event, route as DepartmentRoute);

        await markEvent(supabase, event.id, outcome.status, "reason" in outcome ? outcome.reason : undefined);
        processed.push({ id: event.id, status: outcome.status, ...("reason" in outcome ? { reason: outcome.reason } : {}) });
      } catch (deliveryError) {
        const reason = deliveryError instanceof Error ? deliveryError.message : "Delivery failed.";
        await markEvent(supabase, event.id, "failed", reason);
        processed.push({ id: event.id, status: "failed", reason });
      }
    }

    return jsonResponse({ processed });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
