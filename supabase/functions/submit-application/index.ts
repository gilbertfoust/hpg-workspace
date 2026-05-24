import { createClient } from "npm:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer/mod.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function b64ToBytes(b64: string) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function safeName(name: string) {
  return name.replace(/[^\w.\- ]+/g, "").replace(/\s+/g, "_").slice(0, 120) || "resume";
}

function getClientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for") || "";
  if (xf) return xf.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  return (real || "").trim();
}

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "Use POST" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return jsonResponse({ ok: false, error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, 500);
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);
    }

    const required = [
      "full_name",
      "email",
      "phone",
      "location",
      "position",
      "start_date",
      "experience_summary",
      "strengths",
      "inspiration",
    ];

    for (const k of required) {
      if (!body[k] || String(body[k]).trim() === "") {
        return jsonResponse({ ok: false, error: `Missing required field: ${k}` }, 400);
      }
    }

    const hasResumeLink = !!String(body.resume_link || "").trim();
    const hasResumeFile = !!body.resume_file?.base64 && !!body.resume_file?.name && !!body.resume_file?.size;

    if (!hasResumeLink && !hasResumeFile) {
      return jsonResponse({ ok: false, error: "Please provide a resume link or upload a file." }, 400);
    }

    if (!Array.isArray(body.availability) || body.availability.length < 1) {
      return jsonResponse({ ok: false, error: "Select at least one availability option" }, 400);
    }

    if (body.consent !== true) {
      return jsonResponse({ ok: false, error: "Consent is required" }, 400);
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const resumeFile = body.resume_file || null;

    delete body.resume_file;
    delete body.application_id;
    delete body.company;

    const allowed: Record<string, unknown> = {
      full_name: String(body.full_name || "").trim(),
      preferred_name: String(body.preferred_name || "").trim(),
      email: String(body.email || "").trim(),
      phone: String(body.phone || "").trim(),
      location: String(body.location || "").trim(),
      linkedin_url: String(body.linkedin_url || "").trim(),
      position: String(body.position || "").trim(),
      availability: Array.isArray(body.availability) ? body.availability : [],
      time_constraints: String(body.time_constraints || "").trim(),
      education: String(body.education || "").trim(),
      experience_summary: String(body.experience_summary || "").trim(),
      strengths: String(body.strengths || "").trim(),
      tools: String(body.tools || "").trim(),
      resume_link: String(body.resume_link || "").trim(),
      inspiration: String(body.inspiration || "").trim(),
      causes: String(body.causes || "").trim(),
      work_auth: String(body.work_auth || "").trim(),
      sponsorship: String(body.sponsorship || "").trim(),
      consent: body.consent === true,
      submitted_ip: getClientIp(req),
      submitted_at: new Date().toISOString(),
      start_date: String(body.start_date || "").trim(),
    };

    const { data: row, error: insErr } = await supabaseAdmin
      .from("volunteer_applications")
      .insert([allowed])
      .select("id")
      .single();

    if (insErr) throw insErr;

    const appId = String(row.id);
    let signedResumeUrl = "";

    if (resumeFile?.base64 && resumeFile?.name && resumeFile?.size) {
      const maxBytes = Number(Deno.env.get("MAX_UPLOAD_BYTES") ?? String(2 * 1024 * 1024));

      if (Number(resumeFile.size) <= maxBytes) {
        const bytes = b64ToBytes(String(resumeFile.base64));
        const filename = safeName(String(resumeFile.name));
        const path = `volunteer_applications/${appId}/${filename}`;

        const up = await supabaseAdmin.storage
          .from("resumes")
          .upload(path, bytes, {
            contentType: String(resumeFile.type || "application/octet-stream"),
            upsert: true,
          });

        if (!up.error) {
          await supabaseAdmin.from("volunteer_applications").update({ resume_file_path: path }).eq("id", appId);
          const signed = await supabaseAdmin.storage.from("resumes").createSignedUrl(path, 60 * 60 * 24 * 7);
          if (!signed.error && signed.data?.signedUrl) signedResumeUrl = signed.data.signedUrl;
        }
      }
    }

    const host = Deno.env.get("SMTP_HOST") ?? "";
    const port = Number(Deno.env.get("SMTP_PORT") ?? "465");
    const user = Deno.env.get("SMTP_USER") ?? "";
    const pass = Deno.env.get("SMTP_PASS") ?? "";
    const hrTo = Deno.env.get("HR_TO_EMAIL") ?? "";
    const trelloHrTo = Deno.env.get("trello_hr_email") ?? "";
    const from = Deno.env.get("MAIL_FROM") ?? user;
    const hrRecipients = [hrTo, trelloHrTo].map((s) => String(s || "").trim()).filter(Boolean);

    if (!host || !user || !pass || hrRecipients.length === 0) {
      return jsonResponse({ ok: true, id: appId, warning: "Saved, but SMTP env vars missing" });
    }

    let mail: SMTPClient | null = null;
    try {
      mail = new SMTPClient({
        connection: {
          hostname: host,
          port,
          tls: true,
          auth: { username: user, password: pass },
        },
      });

      await mail.send({
        from,
        to: hrRecipients,
        subject: `New HPG Application: ${allowed.full_name} (${allowed.position})`,
        content:
          `New application received.\n\n` +
          `Reference ID: ${appId}\n` +
          `Name: ${allowed.full_name}\n` +
          `Email: ${allowed.email}\n` +
          `Phone: ${allowed.phone}\n` +
          `Position: ${allowed.position}\n` +
          `Availability: ${(allowed.availability as string[]).join(", ")}\n` +
          `Resume link: ${allowed.resume_link}\n` +
          (signedResumeUrl ? `Uploaded resume (signed link): ${signedResumeUrl}\n` : ""),
        html:
          `<p><strong>New application received.</strong></p>
           <p><strong>Reference ID:</strong> ${appId}</p>
           <ul>
             <li><strong>Name:</strong> ${allowed.full_name}</li>
             <li><strong>Email:</strong> ${allowed.email}</li>
             <li><strong>Phone:</strong> ${allowed.phone}</li>
             <li><strong>Position:</strong> ${allowed.position}</li>
             <li><strong>Availability:</strong> ${(allowed.availability as string[]).join(", ")}</li>
             <li><strong>Resume link:</strong> <a href="${allowed.resume_link}">${allowed.resume_link}</a></li>
             ${signedResumeUrl ? `<li><strong>Uploaded resume:</strong> <a href="${signedResumeUrl}">Open (valid 7 days)</a></li>` : ``}
           </ul>`,
        headers: {},
      });

      const sendReceipt = (Deno.env.get("SEND_APPLICANT_RECEIPT") ?? "true").toLowerCase() === "true";
      if (sendReceipt) {
        await mail.send({
          from,
          to: String(allowed.email),
          subject: `HPG Application Received (Reference ID: ${appId})`,
          content:
            `We received your application.\n\n` +
            `Reference ID: ${appId}\n` +
            `Position: ${allowed.position}\n` +
            `Submitted: ${new Date().toISOString()}\n\n` +
            `If you need to follow up, include your reference ID.`,
          html:
            `<p>We received your application.</p>
             <p><strong>Reference ID:</strong> ${appId}</p>
             <p><strong>Position:</strong> ${allowed.position}</p>
             <p>If you need to follow up, include your reference ID.</p>`,
          headers: {},
        });
      }
    } finally {
      try {
        mail?.close?.();
      } catch (_e) {
        // ignore close errors
      }
    }

    return jsonResponse({ ok: true, id: appId });
  } catch (err) {
    return jsonResponse({ ok: false, error: String((err as any)?.message || err) }, 500);
  }
});
