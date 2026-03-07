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
    const { signer_name, signer_email, token } = await req.json();

    const SMTP_HOST = Deno.env.get("SMTP_HOST") || "";
    const SMTP_PORT = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const SMTP_USER = Deno.env.get("SMTP_USER") || "";
    const SMTP_PASS = Deno.env.get("SMTP_PASS") || "";
    const SMTP_FROM = Deno.env.get("SMTP_FROM") || SMTP_USER;

    // Use the published app URL or fallback
    const APP_URL = Deno.env.get("APP_URL") || Deno.env.get("SITE_URL") || "";
    const signingLink = `${APP_URL}/sign/${token}`;

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      console.warn("SMTP not configured, returning signing link for manual sharing");
      return new Response(
        JSON.stringify({ 
          success: true, 
          warning: "SMTP not configured, email not sent",
          signing_link: signingLink 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { SmtpClient } = await import(
      "https://deno.land/x/denomailer@1.6.0/mod.ts"
    );

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
      subject: "You have a document to sign — HPG Workstation",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Hello ${signer_name},</h2>
          <p>You have been asked to sign a document. Please click the link below to review and sign:</p>
          <p style="margin: 24px 0;">
            <a href="${signingLink}" 
               style="background-color: #1a1a2e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Review & Sign Document
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">
            If the button doesn't work, copy and paste this link: ${signingLink}
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">HPG Workstation — Org Coordination OS</p>
        </div>
      `,
    });

    await client.close();

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending signing email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
