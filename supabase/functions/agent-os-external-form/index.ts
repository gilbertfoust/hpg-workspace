import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-agent-os-worker-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const internalRoles = new Set([
  "staff",
  "super_admin",
  "admin_pm",
  "ngo_coordinator",
  "department_lead",
  "executive_secretariat",
]);

const postAgreementStages = new Set([
  "agreement_signed",
  "onboarding_fee_form_sent",
  "onboarding_fee_payment_pending",
  "payment_received_verified",
  "confirmation_letter_issued",
  "activation_processed",
  "transferred_to_ngo_coordination",
  "onboarding_in_progress",
  "active_sponsored_ngo",
  "ongoing_monitoring",
]);

type JsonObject = Record<string, unknown>;

type InvitationRecord = {
  id: string;
  token_hash: string;
  case_registry_id: string;
  ngo_id: string | null;
  form_template_id: string;
  recipient_email: string;
  recipient_name: string | null;
  status: string;
  expires_at: string;
  created_by_user_id: string | null;
  created_by_agent: string | null;
};

type CaseRecord = {
  id: string;
  reference_number: string;
  case_type: string;
  organization_name: string | null;
  person_name: string | null;
  primary_email: string | null;
  ngo_id: string | null;
  workflow_stage: string;
  jurisdiction_class: string | null;
  activation_fee_policy_key: string | null;
  activation_fee_amount_cents: number | null;
  activation_fee_currency: string | null;
  activation_fee_form_template_id: string | null;
  owner_user_id: string | null;
  supervisor_user_id: string | null;
  created_by_user_id: string | null;
  metadata: JsonObject | null;
};

function jsonResponse(payload: JsonObject, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function cleanText(value: unknown, maxLength = 1000) {
  const result = String(value ?? "").trim();
  return result.length > maxLength ? result.slice(0, maxLength) : result;
}

function tokenBytes() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeBaseUrl(value: unknown) {
  const text = cleanText(value, 2000).replace(/\/+$/, "");
  if (!text) throw new Error("A public application base URL is required.");
  const url = new URL(text);
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !local) throw new Error("The public application URL must use HTTPS.");
  return url.toString().replace(/\/+$/, "");
}

function isUsCountry(country: unknown) {
  const normalized = cleanText(country, 200).toLowerCase().replace(/[^a-z]/g, "");
  return ["us", "usa", "unitedstates", "unitedstatesofamerica"].includes(normalized);
}

async function requireInternalCaller(
  req: Request,
  supabase: ReturnType<typeof createClient>,
) {
  const configuredWorkerSecret = Deno.env.get("AGENT_OS_WORKER_SECRET") || "";
  const suppliedWorkerSecret = req.headers.get("x-agent-os-worker-secret") || "";

  if (configuredWorkerSecret && suppliedWorkerSecret === configuredWorkerSecret) {
    return { allowed: true as const, mode: "worker_secret" as const, userId: null };
  }

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { allowed: false as const, status: 401, reason: "Authentication required." };

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return { allowed: false as const, status: 401, reason: "Authentication could not be verified." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile || !internalRoles.has(String(profile.role))) {
    return { allowed: false as const, status: 403, reason: "Internal HPG staff access is required." };
  }

  return { allowed: true as const, mode: "internal_user" as const, userId: userData.user.id };
}

async function fetchInvitation(
  supabase: ReturnType<typeof createClient>,
  token: string,
) {
  if (!/^[a-f0-9]{64}$/i.test(token)) return null;
  const tokenHash = await hashToken(token.toLowerCase());
  const { data, error } = await supabase
    .from("agent_os_external_form_invitations")
    .select("id, token_hash, case_registry_id, ngo_id, form_template_id, recipient_email, recipient_name, status, expires_at, created_by_user_id, created_by_agent")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error) throw error;
  return data as InvitationRecord | null;
}

async function fetchCase(
  supabase: ReturnType<typeof createClient>,
  caseId: string,
) {
  const { data, error } = await supabase
    .from("case_registry")
    .select("id, reference_number, case_type, organization_name, person_name, primary_email, ngo_id, workflow_stage, jurisdiction_class, activation_fee_policy_key, activation_fee_amount_cents, activation_fee_currency, activation_fee_form_template_id, owner_user_id, supervisor_user_id, created_by_user_id, metadata")
    .eq("id", caseId)
    .single();
  if (error) throw error;
  return data as CaseRecord;
}

async function expireIfNeeded(
  supabase: ReturnType<typeof createClient>,
  invitation: InvitationRecord,
) {
  if (new Date(invitation.expires_at).getTime() > Date.now()) return false;
  if (!["submitted", "expired", "revoked"].includes(invitation.status)) {
    await supabase
      .from("agent_os_external_form_invitations")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", invitation.id);
  }
  return true;
}

async function createInvitation(
  req: Request,
  supabase: ReturnType<typeof createClient>,
  body: JsonObject,
) {
  const caller = await requireInternalCaller(req, supabase);
  if (!caller.allowed) return jsonResponse({ error: caller.reason }, caller.status);

  const caseId = cleanText(body.case_id, 100);
  if (!caseId) return jsonResponse({ error: "case_id is required." }, 400);

  let caseRecord = await fetchCase(supabase, caseId);
  if (caseRecord.case_type !== "sponsorship") {
    return jsonResponse({ error: "External activation fee invitations are only available for sponsorship cases." }, 400);
  }
  if (!postAgreementStages.has(caseRecord.workflow_stage)) {
    return jsonResponse({ error: "The agreement must be signed before an activation fee form is issued." }, 409);
  }

  if (!caseRecord.activation_fee_policy_key || !caseRecord.jurisdiction_class) {
    const { error: routeError } = await supabase.rpc("agent_os_route_activation_fee", { p_case_id: caseId });
    if (routeError) throw routeError;
    caseRecord = await fetchCase(supabase, caseId);
  }

  if (caseRecord.jurisdiction_class !== "international") {
    return jsonResponse({
      error: "This case is classified as a U.S. NGO and must use the existing U.S. onboarding fee form.",
    }, 409);
  }
  if (caseRecord.activation_fee_amount_cents !== 10000 || caseRecord.activation_fee_currency !== "USD") {
    return jsonResponse({ error: "The international activation fee policy is not configured for exactly $100 USD." }, 500);
  }
  if (!caseRecord.activation_fee_form_template_id) {
    return jsonResponse({ error: "The international activation fee form template is not configured." }, 500);
  }

  const recipientEmail = cleanText(body.recipient_email || caseRecord.primary_email, 500).toLowerCase();
  if (!recipientEmail || !recipientEmail.includes("@")) {
    return jsonResponse({ error: "A valid recipient email is required." }, 400);
  }

  const recipientName = cleanText(body.recipient_name || caseRecord.person_name || caseRecord.organization_name, 500) || null;
  const publicBaseUrl = normalizeBaseUrl(body.public_base_url);
  const requestedDays = Number(body.expires_in_days ?? 14);
  const expiresInDays = Number.isFinite(requestedDays) ? Math.min(Math.max(Math.trunc(requestedDays), 1), 30) : 14;
  const expiresAt = new Date(Date.now() + expiresInDays * 86_400_000).toISOString();
  const rawToken = tokenBytes();
  const tokenHash = await hashToken(rawToken);

  await supabase
    .from("agent_os_external_form_invitations")
    .update({ status: "revoked", revoked_at: new Date().toISOString(), revoked_by_user_id: caller.userId })
    .eq("case_registry_id", caseId)
    .eq("form_template_id", caseRecord.activation_fee_form_template_id)
    .in("status", ["pending", "sent", "processing"]);

  const { data: invitation, error: invitationError } = await supabase
    .from("agent_os_external_form_invitations")
    .insert({
      token_hash: tokenHash,
      case_registry_id: caseId,
      ngo_id: caseRecord.ngo_id,
      form_template_id: caseRecord.activation_fee_form_template_id,
      recipient_email: recipientEmail,
      recipient_name: recipientName,
      status: "pending",
      expires_at: expiresAt,
      created_by_user_id: caller.userId,
      created_by_agent: caller.mode === "worker_secret" ? "Agent OS External Form Worker" : null,
      metadata: {
        jurisdiction_class: "international",
        amount_cents: 10000,
        currency: "USD",
      },
    })
    .select("id")
    .single();

  if (invitationError) throw invitationError;

  const invitationId = String(invitation.id);
  const formUrl = `${publicBaseUrl}/external-form/${rawToken}`;
  const idempotencyKey = `external-form-invitation:${invitationId}`;
  const organization = caseRecord.organization_name || "your organization";

  const { error: communicationError } = await supabase.from("communication_queue").upsert(
    {
      idempotency_key: idempotencyKey,
      case_registry_id: caseId,
      communication_type: "international_activation_fee_form",
      authority_level: "automatic",
      channel: "email",
      recipient_name: recipientName,
      recipient_address: recipientEmail,
      subject: `HPG International NGO Activation Fee — ${caseRecord.reference_number}`,
      body:
        `Dear ${recipientName || "Organization Representative"},\n\n` +
        `The fiscal sponsorship agreement for ${organization} has been signed. Please complete the secure International NGO Activation Fee Form and submit the fixed $100 USD activation fee using the instructions provided.\n\n` +
        `Secure form: ${formUrl}\n` +
        `HPG NGO Profile Number: ${caseRecord.reference_number}\n` +
        `This link expires in ${expiresInDays} day${expiresInDays === 1 ? "" : "s"}.\n\n` +
        `After HPG Finance verifies the payment, HPG will issue the confirmation letter and begin activation and onboarding.\n\nHumanity Pathways Global`,
      status: "pending",
      requires_human_review: false,
      source_context: {
        invitation_id: invitationId,
        form_url: formUrl,
        jurisdiction_class: "international",
        amount_cents: 10000,
        currency: "USD",
      },
      created_by_agent: "Agent OS External Form Worker",
      created_by_user_id: caller.userId,
    },
    { onConflict: "idempotency_key" },
  );

  if (communicationError) throw communicationError;

  await supabase.from("case_registry").update({
    next_action: "Send the secure International NGO Activation Fee Form for $100 USD.",
    metadata: {
      ...(caseRecord.metadata || {}),
      external_form_invitation_id: invitationId,
      external_form_invitation_expires_at: expiresAt,
    },
    updated_at: new Date().toISOString(),
  }).eq("id", caseId);

  return jsonResponse({
    ok: true,
    invitation_id: invitationId,
    case_reference: caseRecord.reference_number,
    form_url: formUrl,
    expires_at: expiresAt,
    communication_queued: true,
  }, 201);
}

async function getForm(
  supabase: ReturnType<typeof createClient>,
  body: JsonObject,
) {
  const token = cleanText(body.token, 200).toLowerCase();
  const invitation = await fetchInvitation(supabase, token);
  if (!invitation) return jsonResponse({ error: "This form link is invalid." }, 404);
  if (await expireIfNeeded(supabase, invitation)) return jsonResponse({ error: "This form link has expired." }, 410);
  if (invitation.status === "revoked") return jsonResponse({ error: "This form link is no longer active." }, 410);
  if (invitation.status === "submitted") {
    return jsonResponse({ ok: true, submitted: true, message: "This form has already been submitted." });
  }
  if (!["pending", "sent", "processing"].includes(invitation.status)) {
    return jsonResponse({ error: "This form link is not currently available." }, 409);
  }

  const [{ data: template, error: templateError }, caseRecord] = await Promise.all([
    supabase
      .from("form_templates")
      .select("id, name, description, schema_json")
      .eq("id", invitation.form_template_id)
      .eq("is_active", true)
      .single(),
    fetchCase(supabase, invitation.case_registry_id),
  ]);
  if (templateError) throw templateError;

  if (caseRecord.jurisdiction_class !== "international") {
    return jsonResponse({ error: "This form is not available for the case jurisdiction." }, 409);
  }

  if (!invitation.status.startsWith("submitted")) {
    await supabase
      .from("agent_os_external_form_invitations")
      .update({ opened_at: new Date().toISOString() })
      .eq("id", invitation.id)
      .is("opened_at", null);
  }

  return jsonResponse({
    ok: true,
    submitted: false,
    form: template,
    case: {
      reference_number: caseRecord.reference_number,
      organization_name: caseRecord.organization_name,
      amount_usd: 100,
      currency: "USD",
    },
    expires_at: invitation.expires_at,
  });
}

function validateSubmission(payload: JsonObject, caseRecord: CaseRecord) {
  const fee = cleanText(payload.fee_amount_usd, 50).toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!["100", "100usd"].includes(fee)) throw new Error("The international NGO activation fee must be exactly $100 USD.");
  if (payload.agreement_acknowledgment !== true) throw new Error("The signed-agreement acknowledgment is required.");
  if (payload.accuracy_confirmation !== true) throw new Error("The accuracy and authorization certification is required.");
  if (cleanText(payload.ngo_profile_number, 100) !== caseRecord.reference_number) {
    throw new Error("The HPG NGO Profile Number does not match this invitation.");
  }
  const country = cleanText(payload.country, 200);
  if (!country) throw new Error("Country is required.");
  if (isUsCountry(country)) throw new Error("A U.S. NGO cannot use the International NGO Activation Fee Form.");
  for (const field of ["legal_organization_name", "authorized_representative", "billing_email", "payer_name", "payment_method"]) {
    if (!cleanText(payload[field], 1000)) throw new Error(`Missing required field: ${field}`);
  }
}

async function submitForm(
  supabase: ReturnType<typeof createClient>,
  body: JsonObject,
) {
  const token = cleanText(body.token, 200).toLowerCase();
  const payload = body.payload && typeof body.payload === "object" ? body.payload as JsonObject : null;
  if (!payload) return jsonResponse({ error: "Form payload is required." }, 400);

  const invitation = await fetchInvitation(supabase, token);
  if (!invitation) return jsonResponse({ error: "This form link is invalid." }, 404);
  if (await expireIfNeeded(supabase, invitation)) return jsonResponse({ error: "This form link has expired." }, 410);
  if (invitation.status === "submitted") {
    return jsonResponse({ ok: true, submitted: true, message: "This form has already been submitted." });
  }
  if (!["pending", "sent"].includes(invitation.status)) {
    return jsonResponse({ error: "This form is already being processed or is not available." }, 409);
  }

  const caseRecord = await fetchCase(supabase, invitation.case_registry_id);
  validateSubmission(payload, caseRecord);

  const { data: claimed, error: claimError } = await supabase
    .from("agent_os_external_form_invitations")
    .update({
      status: "processing",
      processing_started_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invitation.id)
    .in("status", ["pending", "sent"])
    .select("id")
    .maybeSingle();

  if (claimError) throw claimError;
  if (!claimed) return jsonResponse({ error: "This form is already being processed." }, 409);

  try {
    const { data: submission, error: submissionError } = await supabase
      .from("form_submissions")
      .insert({
        form_template_id: invitation.form_template_id,
        ngo_id: invitation.ngo_id,
        submitted_by_user_id: null,
        payload_json: payload,
        submission_status: "submitted",
        status: "submitted",
        audience: "ngo_portal",
        intake_status: "new",
        routed_to_module: "finance",
        routed_module: "finance",
        submitted_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (submissionError) throw submissionError;

    const actorUserId = invitation.created_by_user_id || caseRecord.owner_user_id || caseRecord.supervisor_user_id || caseRecord.created_by_user_id;
    let workItemId: string | null = null;

    if (actorUserId) {
      const { data: workItem, error: workItemError } = await supabase
        .from("work_items")
        .insert({
          ngo_id: invitation.ngo_id,
          module: "finance",
          type: "international_ngo_activation_fee",
          title: `Verify $100 USD International NGO Activation Fee — ${caseRecord.reference_number}`,
          description: "Review the submitted international activation fee form and verify the payment or transaction reference before releasing the HPG confirmation letter.",
          created_by_user_id: actorUserId,
          owner_user_id: caseRecord.owner_user_id,
          status: "Not Started",
          priority: "High",
          evidence_required: true,
          approval_required: true,
          external_visible: false,
          trello_sync: true,
        })
        .select("id")
        .single();
      if (workItemError) throw workItemError;
      workItemId = String(workItem.id);

      await supabase
        .from("form_submissions")
        .update({ work_item_id: workItemId })
        .eq("id", submission.id);

      await supabase.from("trello_sync_queue").upsert({
        idempotency_key: `international-fee-work-item:${workItemId}`,
        case_registry_id: invitation.case_registry_id,
        work_item_id: workItemId,
        entity_type: "work_item",
        entity_id: workItemId,
        operation: "create_card",
        direction: "supabase_to_trello",
        payload: {
          title: `Verify $100 USD International NGO Activation Fee — ${caseRecord.reference_number}`,
          description: "Finance verification is required before the HPG confirmation letter is issued.",
          department_module: "finance",
          case_type: "sponsorship",
          reference_number: caseRecord.reference_number,
          route_key: "finance_ngo_onboarding",
        },
        status: "pending",
      }, { onConflict: "idempotency_key" });
    }

    await supabase
      .from("agent_os_external_form_invitations")
      .update({
        status: "submitted",
        submitted_at: new Date().toISOString(),
        submission_id: submission.id,
        work_item_id: workItemId,
        processing_started_at: null,
        last_error: null,
      })
      .eq("id", invitation.id);

    const nextStage = caseRecord.workflow_stage === "onboarding_fee_form_sent"
      ? "onboarding_fee_payment_pending"
      : caseRecord.workflow_stage;

    await supabase.from("case_registry").update({
      workflow_stage: nextStage,
      next_action: "Finance must verify the $100 USD international NGO activation payment.",
      metadata: {
        ...(caseRecord.metadata || {}),
        international_activation_fee_submission_id: submission.id,
        external_form_invitation_id: invitation.id,
      },
      updated_at: new Date().toISOString(),
    }).eq("id", invitation.case_registry_id);

    return jsonResponse({
      ok: true,
      submitted: true,
      reference_number: caseRecord.reference_number,
      message: "Your form was submitted securely. HPG Finance will verify the payment before the confirmation letter is issued.",
    }, 201);
  } catch (error) {
    await supabase
      .from("agent_os_external_form_invitations")
      .update({
        status: invitation.status === "sent" ? "sent" : "pending",
        processing_started_at: null,
        last_error: error instanceof Error ? error.message.slice(0, 1000) : "Submission processing failed.",
      })
      .eq("id", invitation.id);
    throw error;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Use POST." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: "Server configuration missing." }, 500);

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const body = await req.json().catch(() => ({})) as JsonObject;
    const action = cleanText(body.action, 50).toLowerCase();

    if (action === "create") return await createInvitation(req, supabase, body);
    if (action === "get") return await getForm(supabase, body);
    if (action === "submit") return await submitForm(supabase, body);

    return jsonResponse({ error: "Unsupported action." }, 400);
  } catch (error) {
    console.error("Agent OS external form error", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error." }, 500);
  }
});
