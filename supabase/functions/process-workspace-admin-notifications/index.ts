import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.90.1";

import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-workspace-notification-secret",
};

type Json = Record<string, unknown>;
type NotificationKind = "workspace_error" | "workspace_access_request" | "work_item_notice" | "ngo_portal_approved" | "workspace_account_approved" | "workspace_signup_received" | "approval_delivery_failed";
type NotificationEvent = {
  id: string;
  notification_kind: NotificationKind;
  source_id: string;
  recipient_email: string;
  dedupe_key: string;
  attempt_count: number;
  lease_token: string;
  payload_json: Json;
};

const json = (body: Json, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const safeLine = (value: unknown, maxLength = 500) => String(value ?? "")
  .split("")
  .map((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 ? " " : character;
  })
  .join("")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, maxLength);

const SUPPORT_EMAIL = "itsupport@humanitypathwaysglobal.com";
const approvalNotice = (kind: NotificationKind) => kind === "ngo_portal_approved" || kind === "workspace_account_approved";
const accountNotice = (kind: NotificationKind) => approvalNotice(kind) || kind === "workspace_signup_received";

const validRecipient = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 320;

const canonicalWorkspaceUrl = (path: string) => {
  const base = safeLine(
    Deno.env.get("APP_BASE_URL") ||
      Deno.env.get("PUBLIC_APP_URL") ||
      "https://hpgworkspace.viahpg.com",
    2_000,
  ).replace(/\/$/, "");
  return `${base}${path}`;
};

const memberWorkspacePath=(notice:Record<string,unknown>)=>{
 const path=String(notice.workspace_path||'');
 const match=path.match(/^\/(?:profile|work-items)\?workItemId=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
 if(!match||match[1].toLowerCase()!==String(notice.work_item_id).toLowerCase())throw new Error('Invalid member work item path.');
 return path;
};

function messageFor(event: NotificationEvent) {
  const payload = event.payload_json || {};
  if (event.notification_kind === "workspace_signup_received") {
    return {
      subject: "We received your HPG Workspace signup",
      text: `Hello ${safeLine(payload.full_name, 200) || "there"},\n\nWe have received your HPG Workspace signup request. Your account is awaiting review and approval. Please wait for a separate approval email before using the workspace; that email will let you know when you can sign in.\n\nIf you receive a separate email verification message, please complete that step while you wait. You do not need to submit another signup request.\n\nThis is a new workspace, and our team is working intensively to resolve its errors. Your input and patience are key. If you encounter an error, please reply to this email with the error message and a screenshot, along with what you were trying to do.\n\nHPG IT Support\n${SUPPORT_EMAIL}\nReference: ${event.id}`,
    };
  }
  if (event.notification_kind === "ngo_portal_approved") {
    return {
      subject: "Your HPG Workspace portal account is approved",
      text: `Hello ${safeLine(payload.full_name, 200) || "team"},\n\nYour HPG Workspace portal account for ${safeLine(payload.ngo_name, 300)} has been approved. You should now be able to sign in, review your organization’s profile, upload requested materials, and follow your program’s progress.\n\nSign in: ${canonicalWorkspaceUrl("/portal")}\n\nThis is a new workspace, and we know it still has many errors. Our team is working intensively to fix them. If you encounter an error, please reply to this email with the error message (or forward the error) and a screenshot, along with what you were trying to do. Your input and patience are key as we improve the workspace. Replies go to ${SUPPORT_EMAIL}.\n\nPortal account approval is separate from sponsorship and contract approval. Your workspace will show any remaining requirements.\n\nHPG IT Support\nReference: ${event.id}`,
    };
  }
  if (event.notification_kind === "workspace_account_approved") {
    return {
      subject: "Your HPG Workspace account is approved",
      text: `Hello ${safeLine(payload.full_name, 200) || "team"},\n\nYour HPG Workspace account has been approved. You should now be able to sign in and use the areas assigned to your role.\n\nSign in: ${canonicalWorkspaceUrl("/auth")}\n\nThis is a new workspace, and we know it still has many errors. Our team is working intensively to fix them. If you encounter an error, please reply to this email with the error message (or forward the error) and a screenshot, along with what you were trying to do. Your input and patience are key as we improve the workspace. Replies go to ${SUPPORT_EMAIL}.\n\nHPG IT Support\nReference: ${event.id}`,
    };
  }
  if (event.notification_kind === "approval_delivery_failed") {
    if (event.recipient_email !== SUPPORT_EMAIL) throw new Error("Unexpected failure-notice recipient.");
    const noticeLabel = payload.original_notification_kind === "workspace_signup_received" ? "signup acknowledgment" : "account approval";
    return {
      subject: `HPG Workspace ${noticeLabel} email needs delivery review`,
      text: `Delivery of a ${noticeLabel} email could not be confirmed and needs staff review.\n\nAccount: ${safeLine(payload.full_name, 200) || "See Workspace record"}\nOrganization: ${safeLine(payload.ngo_name, 300) || "See Workspace record"}\nIntended recipient: ${safeLine(payload.recipient_email, 320)}\nReason: ${safeLine(payload.last_error, 500) || "See the notification record"}\nOriginal notification: ${safeLine(payload.original_notification_id, 100)}\n\nReview the delivery record and provider history before attempting a resend. Open Workspace Admin: ${canonicalWorkspaceUrl("/admin/config?tab=users")}`,
    };
  }
  if (event.notification_kind === "work_item_notice") {
    const label = payload.event_kind === "reminder_72h" ? "Three-day work item reminder" : payload.event_kind === "manager_added_120h" ? "You have been added to help with a five-day work item" : "A work item has been assigned to you";
    return { subject: `HPG Workspace — ${label}`, text: `${label}.\n\n${safeLine(payload.title, 300)}\n\nOpen work item: ${canonicalWorkspaceUrl(memberWorkspacePath(payload))}\n\nReference: ${event.id}` };
  }
  if (event.notification_kind === "workspace_error") {
    const lines = [
      "The HPG Workspace recorded an application error.",
      "",
      `Area: ${safeLine(payload.route_key, 200) || "/other"}`,
      `Source: ${safeLine(payload.source, 100) || "other"}`,
      `Code: ${safeLine(payload.error_code, 100) || "CLIENT_OPERATION_FAILED"}`,
      `Release: ${safeLine(payload.release_id, 200) || "unknown"}`,
      `Occurred (UTC): ${safeLine(payload.occurred_at, 100) || "unknown"}`,
      `Correlation ID: ${safeLine(payload.correlation_id, 100) || "unknown"}`,
      `Event ID: ${event.id}`,
      "",
      `Open IT support: ${canonicalWorkspaceUrl("/it")}`,
      "",
      "For privacy, this automatic notice does not include the error message, stack, form contents, or URL parameters.",
    ];
    return {
      subject: "HPG Workspace error detected",
      text: lines.join("\n"),
    };
  }

  if (event.notification_kind === "workspace_access_request") {
    const name = safeLine(payload.full_name, 200);
    const email = safeLine(payload.email, 320);
    const requestedType = safeLine(payload.requested_account_type, 100);
    const requestSource = safeLine(payload.request_source, 100);
    const organization = safeLine(payload.requested_organization_name, 300);
    const label = requestedType === "ngo"
      ? "NGO portal"
      : requestedType === "staff"
      ? "Staff workspace"
      : requestedType === "board"
      ? "Board of Directors (membership approval required)"
      : requestSource === "google_oauth"
      ? "Google sign-in (assignment needed)"
      : "Assignment needed";
    const lines = [
      "A new HPG Workspace access request is awaiting review.",
      "",
      `Applicant: ${name || "Name not provided"}`,
      `Email: ${email || "Email not provided"}`,
      `Requested access: ${label}`,
    ];
    if (organization) lines.push(`Organization: ${organization}`);
    lines.push(
      `Request source: ${requestSource || "email_signup"}`,
      `Submitted (UTC): ${safeLine(payload.requested_at, 100) || "unknown"}`,
      `Request ID: ${event.id}`,
      "",
      `Review request: ${canonicalWorkspaceUrl("/admin/config?tab=users")}`,
    );
    return {
      subject: `New HPG Workspace access request — ${name || email || "review needed"}`.slice(0, 998),
      text: lines.join("\n"),
    };
  }

  return null;
}

async function finish(
  db: SupabaseClient,
  event: NotificationEvent,
  success: boolean,
  response: Json,
  error?: string,
) {
  const { data, error: finishError } = await db.rpc(
    "finish_workspace_admin_notification",
    {
      p_notification_id: event.id,
      p_lease_token: event.lease_token,
      p_success: success,
      p_response: response,
      p_error: error || null,
    },
  );
  if (finishError) throw finishError;
  return data as { status?: string } | null;
}

async function bounded<T>(operation: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([operation, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Delivery acknowledgement uncertain.')), milliseconds); })]); }
  finally { if (timer !== undefined) clearTimeout(timer); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const smtpHost = Deno.env.get("SMTP_HOST") || "";
    const smtpUser = Deno.env.get("SMTP_USER") || "";
    const smtpPass = Deno.env.get("SMTP_PASS") || "";
    const smtpPort = Number(Deno.env.get("SMTP_PORT") || "465");
    const smtpFrom = Deno.env.get("MAIL_FROM") || smtpUser;
    const smtpReady = Boolean(smtpHost && smtpUser && smtpPass && smtpFrom && smtpPort === 465);
    const from = Deno.env.get("WORKSPACE_NOTIFICATION_FROM_EMAIL") ||
      Deno.env.get("DEPARTMENT_NOTIFICATION_FROM_EMAIL") ||
      Deno.env.get("FORM_WORKFLOW_FROM_EMAIL") ||
      "HPG IT Support <itsupport@humanitypathwaysglobal.com>";
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Workspace notification worker is missing Supabase runtime configuration.");
      return json({ error: "Notification service is unavailable." }, 503);
    }

    const db = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15_000) }) },
    });
    const suppliedSecret = req.headers.get("x-workspace-notification-secret") || "";
    const { data: secretMatches, error: secretError } = await db.rpc(
      "workspace_admin_notification_worker_secret_matches",
      { p_secret: suppliedSecret },
    );
    if (secretError || secretMatches !== true) {
      return json({ error: "Unauthorized." }, 401);
    }

    const configured = Boolean(resendKey || smtpReady);
    const body = await req.json().catch(() => ({}) as Json);
    if (body?.action === "healthcheck") return json({ ready: configured, provider: resendKey ? "resend" : "smtp", configuration_only: true }, configured ? 200 : 503);
    const health = async (outcome: string, count = 0) => {
      try { await db.rpc("record_workspace_notification_worker_health", {
        p_worker_key: "process-workspace-admin-notifications", p_channel: "email",
        p_configuration_present: configured, p_outcome: outcome, p_acknowledged_count: count,
      }); } catch { /* Delivery must not depend on diagnostic availability. */ }
    };
    await health(configured ? "ready" : "unconfigured");
    if (!configured) return json({ error: "Email delivery is not configured." }, 503);

    const limit = 1; // Keep the complete provider and acknowledgement path below the request deadline.
    const { data: claimed, error: claimError } = await db.rpc(
      "claim_workspace_admin_notifications",
      { p_limit: limit, p_lease_seconds: 600 },
    );
    if (claimError) { await health("error"); throw claimError; }

    const results: Json[] = [];
    let acknowledgedCount = 0;
    for (const event of (claimed || []) as NotificationEvent[]) {
      let sending = false;
      const provider = resendKey ? "resend" : "smtp";
      let smtpClient: SMTPClient | null = null;
      const quarantine = async (reason: string, uncertain: boolean) => {
        const updated = await db.from("workspace_admin_notification_events").update({
          status: "deadletter", lease_token: null, leased_until: null,
          last_error: reason, response_json: { provider, send_started: sending, acknowledgement_uncertain: uncertain },
          updated_at: new Date().toISOString(),
        }).eq("id", event.id).eq("status", "leased").eq("lease_token", event.lease_token).select("id").maybeSingle();
        if (updated.error) throw new Error("Notification quarantine could not be recorded.");
        return updated.data ? "deadletter" : "lease_lost";
      };
      const prepare = async () => {
        if (event.notification_kind === "workspace_signup_received") {
          const prepared = await db.rpc("prepare_workspace_signup_received_delivery", { p_notification_id: event.id, p_lease_token: event.lease_token });
          if (prepared.error) throw new Error("Signup receipt recipient revalidation failed.");
          if (prepared.data?.ready !== true) { results.push({ id: event.id, status: "cancelled" }); return false; }
          event.recipient_email = String(prepared.data.recipient_email);
          event.payload_json = prepared.data;
          return true;
        }
        if (event.notification_kind === "workspace_account_approved") {
          const prepared = await db.rpc("prepare_workspace_account_approval_delivery", { p_notification_id: event.id, p_lease_token: event.lease_token });
          if (prepared.error) throw new Error("Account approval recipient revalidation failed.");
          if (prepared.data?.ready !== true) { results.push({ id: event.id, status: prepared.data?.reason === "awaiting_email_verification" ? "awaiting_verification" : "cancelled" }); return false; }
          event.recipient_email = String(prepared.data.recipient_email);
          event.payload_json = prepared.data;
          return true;
        }
        if (event.notification_kind === "ngo_portal_approved") {
          const prepared = await db.rpc("prepare_ngo_approval_delivery", { p_notification_id: event.id, p_lease_token: event.lease_token });
          if (prepared.error) throw new Error("Approval recipient revalidation failed.");
          if (prepared.data?.ready !== true) { results.push({ id: event.id, status: prepared.data?.reason === "awaiting_email_verification" ? "awaiting_verification" : "cancelled" }); return false; }
          event.recipient_email = String(prepared.data.recipient_email);
          event.payload_json = prepared.data;
          return true;
        }
        if (event.notification_kind !== "work_item_notice") return true;
        const prepared = await db.rpc("prepare_member_work_item_delivery", {
          p_event_id: event.source_id, p_channel: "email", p_lease_token: event.lease_token,
        });
        if (prepared.error) throw new Error("Member recipient revalidation failed.");
        if (prepared.data?.ready !== true) {
          // The RPC terminalizes missing-address or revoked-assignment leases.
          results.push({ id: event.id, status: prepared.data?.reason === "recipient_address_missing" ? "no_address" : "cancelled" });
          return false;
        }
        event.recipient_email = String(prepared.data.recipient_email);
        event.payload_json = prepared.data;
        return true;
      };
      try {
        if (!(await prepare())) continue;
        if (!messageFor(event) || !validRecipient(event.recipient_email)) {
          results.push({ id: event.id, status: await quarantine("Unsupported notice or invalid recipient. Correct configuration before retry.", false) });
          continue;
        }
        // Durable marker makes an expired lease safe even if the worker dies
        // after the provider accepts but before the acknowledgement is recorded.
        const marked = await db.from("workspace_admin_notification_events").update({
          response_json: { provider, send_started: true, ...(accountNotice(event.notification_kind) ? { send_stage: "it_wakeup" } : {}) }, updated_at: new Date().toISOString(),
        }).eq("id", event.id).eq("status", "leased").eq("lease_token", event.lease_token)
          .gt("leased_until", new Date().toISOString()).select("id").single();
        if (marked.error || !marked.data) throw new Error("Notification lease lost.");
        // Revalidate after the final database round trip and render from that
        // fresh address/content immediately before starting the provider call.
        if (!(await prepare())) continue;
        const accountMessage = messageFor(event);
        if (!accountMessage || !validRecipient(event.recipient_email)) {
          results.push({ id: event.id, status: await quarantine("Recipient configuration changed before sending.", false) });
          continue;
        }
        // The applications SMTP account rewrites From addresses. Account email
        // is therefore delivered by the connected IT Gmail mailbox. This email
        // only wakes that workflow; it never counts as delivery to the applicant.
        const relayThroughIT = accountNotice(event.notification_kind);
        const recipient = relayThroughIT ? SUPPORT_EMAIL : event.recipient_email;
        const message = relayThroughIT ? {
          subject: "HPG Workspace account email ready",
          text: `An account notification is ready for delivery from the connected IT mailbox.\n\nNotification ID: ${event.id}\n\nThe authorized delivery workflow must claim and revalidate this notification in the Workspace database before sending. This internal notice is not an account approval.`,
        } : accountMessage;
        const acknowledge = async (response: Json) => {
          if (!relayThroughIT) return await finish(db, event, true, response);
          const result = await db.rpc("mark_workspace_it_delivery_ready", {
            p_notification_id: event.id, p_lease_token: event.lease_token,
            p_subject: accountMessage.subject, p_text: accountMessage.text,
            p_wakeup_response: response,
          });
          if (result.error) throw new Error("IT delivery handoff could not be recorded.");
          return { status: "awaiting_it_delivery" };
        };
        if (!resendKey) {
          smtpClient = new SMTPClient({ connection: { hostname: smtpHost, port: smtpPort, tls: smtpPort === 465,
            auth: { username: smtpUser, password: smtpPass } }, pool: false, debug: { log: false, allowUnsecure: false } });
          sending = true;
          await bounded(smtpClient.send({ from: smtpFrom, to: recipient, subject: message.subject, content: message.text,
            headers: { 'Message-ID': `<hpg-workspace-${event.id}${relayThroughIT ? `-wake-${event.lease_token}` : ""}@humanitypathwaysglobal.com>`, 'Auto-Submitted': 'auto-generated', 'X-HPG-Workspace-Notification-ID': event.id, 'Reply-To': SUPPORT_EMAIL } }), 40_000);
          if (!relayThroughIT) acknowledgedCount++;
          const finished = await acknowledge({ provider: "smtp", from: smtpFrom });
          results.push({ id: event.id, kind: event.notification_kind, status: finished?.status || "sent", attempt: event.attempt_count });
          continue;
        }
        sending = true;
        const delivered = await fetch("https://api.resend.com/emails", {
          method: "POST", redirect: "error",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json", "Idempotency-Key": (relayThroughIT ? `${event.dedupe_key}:wake:${event.lease_token}` : event.dedupe_key).slice(0, 256) },
          body: JSON.stringify({ from, to: [recipient], subject: message.subject, text: message.text,
            reply_to: SUPPORT_EMAIL,
            headers: { "X-HPG-Workspace-Notification-ID": event.id } }),
          signal: AbortSignal.timeout(20_000),
        });
        if (delivered.status === 429) {
          sending = false; // Provider explicitly rejected this attempt before acceptance.
          const finished = await finish(db, event, false, { provider: "resend", rejected: true }, "Resend rate limited this request.");
          results.push({ id: event.id, status: finished?.status || "retry" }); continue;
        }
        if ([400,401,403,404,413,415,422].includes(delivered.status)) {
          sending = false;
          results.push({ id: event.id, status: await quarantine(`Resend rejected the request (HTTP ${delivered.status}). Correct the provider configuration before retry.`, false) }); continue;
        }
        const acknowledgement = await delivered.json().catch(() => null);
        if (!delivered.ok || !acknowledgement?.id) {
          if (relayThroughIT) throw new Error("IT workflow wakeup acknowledgement is uncertain.");
          results.push({ id: event.id, status: await quarantine("Provider delivery acknowledgement is uncertain. Reconcile provider history before any resend.", true) }); continue;
        }
        if (!relayThroughIT) acknowledgedCount++;
        const finished = await acknowledge({ provider: "resend", id: safeLine(acknowledgement.id, 200), from });
        results.push({ id: event.id, kind: event.notification_kind, status: finished?.status || "sent", attempt: event.attempt_count });
      } catch {
        try {
          if (sending) {
            if (accountNotice(event.notification_kind)) {
              const finished = await finish(db, event, false, { provider, send_stage: "it_wakeup", send_started: false }, "IT workflow wakeup was not confirmed; retrying the internal notice.");
              results.push({ id: event.id, status: finished?.status || "retry" });
            } else {
              results.push({ id: event.id, status: await quarantine("Provider delivery acknowledgement is uncertain. Reconcile delivery before any resend.", true) });
            }
          } else {
            const finished = await finish(db, event, false, {}, "Notification preparation failed before sending.");
            results.push({ id: event.id, status: finished?.status || "retry" });
          }
        } catch { results.push({ id: event.id, status: "lease_error" }); }
      } finally {
        try { if (smtpClient) await bounded(smtpClient.close(), 2_000); } catch { /* Do not change send outcome. */ }
      }
    }

    await health(acknowledgedCount > 0 ? "sent" : results.some(item => ["deadletter","retry","lease_error","lease_lost"].includes(String(item.status))) ? "error" : "ready", acknowledgedCount);
    return json({ claimed: results.length, processed: results });
  } catch (error) {
    console.error("Workspace notification worker failed.", error);
    return json({ error: "Notification processing failed." }, 500);
  }
});
