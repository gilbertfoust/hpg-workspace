import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { document_name, signer_name, signer_email, signed_at, signer_ip, requester_email } = await req.json();

    const SMTP_HOST = Deno.env.get("SMTP_HOST") || "";
    const SMTP_USER = Deno.env.get("SMTP_USER") || "";
    const SMTP_PASS = Deno.env.get("SMTP_PASS") || "";
    const SMTP_PORT = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const SMTP_FROM = Deno.env.get("SMTP_FROM") || SMTP_USER;
    const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") || SMTP_USER;

    // Prefer requester_email, fall back to ADMIN_EMAIL
    const notifyEmail = requester_email || ADMIN_EMAIL;

    const signedDate = signed_at
      ? new Date(signed_at).toLocaleString("en-US", {
          year: "numeric", month: "long", day: "numeric",
          hour: "2-digit", minute: "2-digit", timeZoneName: "short",
        })
      : "Unknown";

    const docName = document_name || "Document";
    const ipDisplay = signer_ip && signer_ip !== "unknown" ? signer_ip : "Not recorded";

    const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Document Signed</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#14532d;border-radius:10px 10px 0 0;padding:32px 40px;text-align:center;">
              <p style="margin:0;color:#86efac;font-size:12px;letter-spacing:2px;text-transform:uppercase;">HPG Workstation</p>
              <h1 style="margin:8px 0 4px;color:#ffffff;font-size:22px;font-weight:600;">✅ Document Signed</h1>
              <p style="margin:0;color:#bbf7d0;font-size:13px;">Signature successfully captured</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px;">
              <p style="margin:0 0 24px;font-size:14px;color:#4b5563;line-height:1.6;">
                The following document has been successfully signed. A complete audit record is included below.
              </p>

              <!-- Document Info -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin-bottom:28px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 4px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Signed Document</p>
                    <p style="margin:0;font-size:18px;color:#14532d;font-weight:700;">📄 ${docName}</p>
                  </td>
                </tr>
              </table>

              <!-- Signature Details Table -->
              <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#1a1a2e;text-transform:uppercase;letter-spacing:0.5px;">Signature Details</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:28px;">
                <tr style="background:#f9fafb;">
                  <td style="padding:12px 16px;font-size:12px;color:#6b7280;font-weight:600;width:38%;border-bottom:1px solid #e5e7eb;">Signer Name</td>
                  <td style="padding:12px 16px;font-size:13px;color:#111827;border-bottom:1px solid #e5e7eb;">${signer_name}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;font-size:12px;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;">Signer Email</td>
                  <td style="padding:12px 16px;font-size:13px;color:#111827;border-bottom:1px solid #e5e7eb;">${signer_email}</td>
                </tr>
                <tr style="background:#f9fafb;">
                  <td style="padding:12px 16px;font-size:12px;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;">Signed At</td>
                  <td style="padding:12px 16px;font-size:13px;color:#111827;border-bottom:1px solid #e5e7eb;">${signedDate}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;font-size:12px;color:#6b7280;font-weight:600;">IP Address</td>
                  <td style="padding:12px 16px;font-size:13px;color:#111827;">${ipDisplay}</td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#4b5563;line-height:1.6;">
                You can view and download the signed document from the <strong>E-Signatures</strong> section of HPG Workstation.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border-radius:0 0 10px 10px;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#9ca3af;">
                HPG Workstation — Org Coordination OS &nbsp;·&nbsp; This is an automated notification, please do not reply.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      console.warn("SMTP not configured, logging notification instead");
      console.log("Signed notification:", { document_name, signer_name, signer_email, signed_at });
      return new Response(
        JSON.stringify({ success: true, warning: "SMTP not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const denomailer = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
    const SmtpClient = (denomailer as any).SmtpClient;

    const client = new SmtpClient();
    await client.connectTLS({
      hostname: SMTP_HOST,
      port: SMTP_PORT,
      username: SMTP_USER,
      password: SMTP_PASS,
    });

    await client.send({
      from: SMTP_FROM,
      to: notifyEmail,
      subject: `✅ Signed: ${docName} — HPG Workstation`,
      html: htmlBody,
    });

    await client.close();

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
