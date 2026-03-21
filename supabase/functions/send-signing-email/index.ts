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
    const { signer_name, signer_email, token, document_name, requester_name, expires_at } = await req.json();

    const SMTP_HOST = Deno.env.get("SMTP_HOST") || "";
    const SMTP_PORT = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const SMTP_USER = Deno.env.get("SMTP_USER") || "";
    const SMTP_PASS = Deno.env.get("SMTP_PASS") || "";
    const SMTP_FROM = Deno.env.get("SMTP_FROM") || SMTP_USER;

    const APP_URL = Deno.env.get("APP_URL") || Deno.env.get("SITE_URL") || "";
    const signingLink = `${APP_URL}/sign/${token}`;

    const expiryText = expires_at
      ? new Date(expires_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
      : "7 days from now";

    const docName = document_name || "a document";
    const requesterDisplay = requester_name || "HPG Workstation";

    const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Signature Request</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#1a1a2e;border-radius:10px 10px 0 0;padding:32px 40px;text-align:center;">
              <p style="margin:0;color:#94a3c9;font-size:12px;letter-spacing:2px;text-transform:uppercase;">HPG Workstation</p>
              <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:600;">Signature Request</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px;">
              <p style="margin:0 0 8px;font-size:16px;color:#1a1a2e;font-weight:600;">Hello ${signer_name},</p>
              <p style="margin:0 0 24px;font-size:14px;color:#4b5563;line-height:1.6;">
                <strong>${requesterDisplay}</strong> has requested your signature on the document below. Please review and sign at your earliest convenience.
              </p>

              <!-- Document Info Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:28px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 4px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Document to Sign</p>
                    <p style="margin:0 0 16px;font-size:16px;color:#1a1a2e;font-weight:600;">📄 ${docName}</p>
                    <p style="margin:0 0 4px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Expires On</p>
                    <p style="margin:0;font-size:14px;color:#dc2626;font-weight:500;">⏰ ${expiryText}</p>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a href="${signingLink}"
                       style="display:inline-block;background:#1a1a2e;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 36px;border-radius:8px;letter-spacing:0.3px;">
                      Review &amp; Sign Document →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Fallback Link -->
              <p style="margin:0 0 6px;font-size:12px;color:#6b7280;">If the button doesn't work, paste this link in your browser:</p>
              <p style="margin:0;font-size:11px;color:#2563eb;word-break:break-all;">${signingLink}</p>
            </td>
          </tr>

          <!-- Security Notice -->
          <tr>
            <td style="background:#fefce8;border:1px solid #fde68a;padding:16px 40px;">
              <p style="margin:0;font-size:12px;color:#92400e;">
                🔒 <strong>Security Notice:</strong> This signing link is unique to you and should not be shared. It will expire on ${expiryText}.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border-radius:0 0 10px 10px;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#9ca3af;">
                HPG Workstation — Org Coordination OS &nbsp;·&nbsp; This is an automated message, please do not reply.
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
      console.warn("SMTP not configured, returning signing link for manual sharing");
      return new Response(
        JSON.stringify({
          success: true,
          warning: "SMTP not configured, email not sent",
          signing_link: signingLink,
        }),
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
      to: signer_email,
      subject: `Signature requested: ${docName} — HPG Workstation`,
      html: htmlBody,
    });

    await client.close();

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending signing email:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
