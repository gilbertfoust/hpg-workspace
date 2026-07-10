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

type CommunicationRecord = {
  id: string;
  case_registry_id: string | null;
  work_item_id: string | null;
  department_id: string | null;
  communication_type: string;
  authority_level: "automatic" | "draft_for_review" | "human_only";
  channel: string;
  recipient_name: string | null;
  recipient_address: string | null;
  subject: string | null;
  body: string | null;
  status: string;
  attempts: number;
  created_by_agent: string | null;
  source_context: Record<string, unknown> | null;
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

async function requireAuthorizedCaller(
  req: Request,
  supabase: ReturnType<typeof createClient>,
) {
  const configuredWorkerSecret = Deno.env.get("AGENT_OS_WORKER_SECRET") || "";
  const suppliedWorkerSecret = req.headers.get("x-agent-os-worker-secret") || "";

  if (
    configuredWorkerSecret &&
    suppliedWorkerSecret &&
    suppliedWorkerSecret === configuredWorkerSecret
  ) {
    return { allowed: true, mode: "worker_secret" as const, userId: null };
  }

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

  return { allowed: true, mode: "internal_user" as const, userId: userData.user.id };
}

async function recordRun(
  supabase: ReturnType<typeof createClient>,
  communication: CommunicationRecord,
  status: string,
  resultSummary: string,
  errorDetail?: string,
) {
  const runKey = `communication:${communication.id}:attempt:${communication.attempts}`;
  const { error } = await supabase.from("agent_runs").upsert(
    {
      run_key: runKey,
      agent_name: communication.created_by_agent || "Agent OS Communications Worker",
      agent_role: "Controlled Communications Processor",
      department_id: communication.department_id,
      case_registry_id: communication.case_registry_id,
      work_item_id: communication.work_item_id,
      trigger_type: "communication_queue",
      source_event_id: communication.id,
      status,
      confidence: "high",
      systems_consulted: ["communication_queue", "resend"],
      sources_used: [{ queue_record_id: communication.id }],
      action_attempted: `Deliver ${communication.communication_type} through ${communication.channel}`,
      approval_required: false,
      communication_status: status,
      records_changed: [{ table: "communication_queue", id: communication.id }],
      result_summary: resultSummary,
      error_detail: errorDetail || null,
      retry_count: Math.max(communication.attempts - 1, 0),
      completed_at: new Date().toISOString(),
      metadata: {
        authority_level: communication.authority_level,
        channel: communication.channel,
        recipient_present: Boolean(communication.recipient_address),
      },
    },
    { onConflict: "run_key" },
  );

  if (error) console.error("Could not record Agent OS run", error.message);
}

async function updateCommunication(
  supabase: ReturnType<typeof createClient>,
  id: string,
  values: Record<string, unknown>,
) {
  const { error } = await supabase
    .from("communication_queue")
    .update({
      ...values,
      locked_at: null,
      locked_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw error;
}

async function sendEmail(
  communication: CommunicationRecord,
  resendApiKey: string,
  fromEmail: string,
) {
  if (!communication.recipient_address) throw new Error("Recipient address is missing.");
  if (!communication.subject?.trim()) throw new Error("Email subject is missing.");
  if (!communication.body?.trim()) throw new Error("Email body is missing.");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [communication.recipient_address],
      subject: communication.subject,
      text: communication.body,
      headers: {
        "X-HPG-Communication-ID": communication.id,
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof payload?.message === "string" ? payload.message : "Provider rejected the request.";
    throw new Error(`Email delivery failed (${response.status}): ${detail.slice(0, 240)}`);
  }

  return typeof payload?.id === "string" ? payload.id : null;
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

    const caller = await requireAuthorizedCaller(req, supabase);
    if (!caller.allowed) {
      return jsonResponse({ error: caller.reason }, caller.status);
    }

    const body = await req.json().catch(() => ({}));
    const limit = safeLimit(body.limit);
    const liveRequested = body.live === true;
    const liveEnabled = Deno.env.get("AGENT_OS_COMMUNICATIONS_LIVE") === "true";
    const live = liveRequested && liveEnabled;

    if (!live) {
      const { data, error } = await supabase
        .from("communication_queue")
        .select("id, communication_type, authority_level, channel, status, attempts, created_at")
        .eq("authority_level", "automatic")
        .in("status", ["pending", "approved"])
        .or(`next_attempt_at.is.null,next_attempt_at.lte.${new Date().toISOString()}`)
        .order("created_at", { ascending: true })
        .limit(limit);

      if (error) throw error;

      return jsonResponse({
        mode: "dry_run",
        live_requested: liveRequested,
        live_enabled: liveEnabled,
        eligible_count: data?.length || 0,
        eligible: data || [],
        note: "No communication was claimed or sent.",
      });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("AGENT_OS_FROM_EMAIL") || Deno.env.get("FORM_WORKFLOW_FROM_EMAIL");

    if (!resendApiKey || !fromEmail) {
      return jsonResponse(
        { error: "Live delivery is enabled but Resend configuration is incomplete." },
        503,
      );
    }

    await supabase.rpc("recover_stale_agent_os_communications");

    const workerId = `agent-os-communications:${crypto.randomUUID()}`;
    const { data: claimed, error: claimError } = await supabase.rpc(
      "claim_agent_os_communications",
      { p_limit: limit, p_worker_id: workerId },
    );

    if (claimError) throw claimError;

    const processed: Array<{ id: string; status: string; attempt: number; reason?: string }> = [];

    for (const communication of (claimed || []) as CommunicationRecord[]) {
      try {
        if (communication.authority_level !== "automatic") {
          await updateCommunication(supabase, communication.id, {
            status: "blocked",
            error_message: "Only automatic-authority communications may be processed by this worker.",
          });
          await recordRun(
            supabase,
            communication,
            "blocked",
            "Communication blocked because its authority level is not automatic.",
          );
          processed.push({ id: communication.id, status: "blocked", attempt: communication.attempts });
          continue;
        }

        if (communication.channel !== "email") {
          await updateCommunication(supabase, communication.id, {
            status: "blocked",
            error_message: `Unsupported automatic communication channel: ${communication.channel}`,
          });
          await recordRun(
            supabase,
            communication,
            "blocked",
            `Communication blocked because ${communication.channel} is not supported by this worker.`,
          );
          processed.push({ id: communication.id, status: "blocked", attempt: communication.attempts });
          continue;
        }

        const externalMessageId = await sendEmail(communication, resendApiKey, fromEmail);
        await updateCommunication(supabase, communication.id, {
          status: "sent",
          sent_at: new Date().toISOString(),
          external_message_id: externalMessageId,
          next_attempt_at: null,
          error_message: null,
        });
        await recordRun(
          supabase,
          communication,
          "completed",
          "Automatic email delivered successfully.",
        );
        processed.push({ id: communication.id, status: "sent", attempt: communication.attempts });
      } catch (deliveryError) {
        const reason = deliveryError instanceof Error ? deliveryError.message : "Delivery failed.";
        const terminal = communication.attempts >= 3;
        const nextAttemptAt = terminal
          ? null
          : new Date(Date.now() + retryDelayMinutes(communication.attempts) * 60_000).toISOString();

        await updateCommunication(supabase, communication.id, {
          status: terminal ? "failed" : "pending",
          next_attempt_at: nextAttemptAt,
          error_message: reason.slice(0, 1000),
        });
        await recordRun(
          supabase,
          communication,
          terminal ? "failed" : "retry_scheduled",
          terminal
            ? "Automatic email failed after the third attempt."
            : "Automatic email failed and was returned to the queue for retry.",
          reason,
        );
        processed.push({
          id: communication.id,
          status: terminal ? "failed" : "retry_scheduled",
          attempt: communication.attempts,
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
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});
