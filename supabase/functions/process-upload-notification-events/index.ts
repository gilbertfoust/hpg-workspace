import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const internalRoles = new Set([
  "staff",
  "staff_member",
  "super_admin",
  "admin_pm",
  "ngo_coordinator",
  "department_lead",
  "executive_secretariat",
  "vp_operations",
  "vp_programs",
  "vp_development",
  "vp_finance",
  "vp_communications",
]);

type UploadNotificationEvent = {
  id: string;
  notification_type: "slack" | "email";
  notification_status: "queued" | "sent" | "skipped" | "failed";
  recipient: string | null;
  module: string;
  work_item_id: string;
  document_id: string | null;
  metadata_json: Record<string, unknown> | null;
};

type DepartmentRoute = {
  module: string;
  department_name: string;
  slack_channel: string | null;
  slack_webhook_secret_name: string | null;
  email_recipients: string[] | null;
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

  const { data: userRole } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .limit(1)
    .maybeSingle();

  const role = profile?.role || userRole?.role;
  if (!role || !internalRoles.has(role)) {
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
    .from("upload_notification_events")
    .update({
      notification_status: status,
      error_message: message || null,
      processed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw error;
}

async function sendSlackEvent(event: UploadNotificationEvent, route: DepartmentRoute) {
  if (!route.slack_webhook_secret_name) {
    return { status: "skipped" as const, reason: "No Slack webhook secret name configured for this department." };
  }

  const webhookUrl = Deno.env.get(route.slack_webhook_secret_name);
  if (!webhookUrl) {
    return { status: "skipped" as const, reason: "Slack webhook secret has not been installed on the server." };
  }

  const fileName = textValue(event.metadata_json, "file_name", "Uploaded document");
  const departmentName = textValue(event.metadata_json, "department_name", route.department_name);
  const message = [
    `New departmental document upload for *${departmentName}*`,
    `File: ${fileName}`,
    `Department route: ${event.recipient || route.slack_channel || "Not listed"}`,
    `Work item ID: ${event.work_item_id}`,
    event.document_id ? `Document ID: ${event.document_id}` : null,
    "Open HPG Workspace → Dept Queue or Work Items to review the routed intake.",
  ].filter(Boolean).join("\n");

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

async function sendEmailEvent(event: UploadNotificationEvent, route: DepartmentRoute) {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("FORM_WORKFLOW_FROM_EMAIL");

  if (!resendApiKey || !fromEmail) {
    return { status: "skipped" as const, reason: "Email provider settings have not been installed on the server." };
  }

  const recipient = event.recipient || route.email_recipients?.[0] || null;
  if (!recipient) {
    return { status: "skipped" as const, reason: "No email recipient configured for this department." };
  }

  const fileName = textValue(event.metadata_json, "file_name", "Uploaded document");
  const departmentName = textValue(event.metadata_json, "department_name", route.department_name);
  const subject = `New HPG Document Upload — ${departmentName}`;
  const text = [
    `A document upload has been routed to ${departmentName}.`,
    "",
    `File: ${fileName}`,
    `Work item ID: ${event.work_item_id}`,
    "",
    "Open HPG Workspace → Dept Queue or Work Items to review the intake.",
  ].join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [recipient],
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
      .from("upload_notification_events")
      .select("id, notification_type, notification_status, recipient, module, work_item_id, document_id, metadata_json")
      .eq("notification_status", "queued")
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) throw error;

    const processed: Array<{ id: string; status: string; reason?: string }> = [];

    for (const event of (events || []) as UploadNotificationEvent[]) {
      try {
        const { data: route, error: routeError } = await supabase
          .from("department_notification_routes")
          .select("module, department_name, slack_channel, slack_webhook_secret_name, email_recipients, is_active")
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
