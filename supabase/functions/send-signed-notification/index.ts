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
    const { document_name, signer_name, signer_email, signed_at } = await req.json();

    const SMTP_HOST = Deno.env.get("SMTP_HOST") || "";
    const SMTP_USER = Deno.env.get("SMTP_USER") || "";
    const SMTP_PASS = Deno.env.get("SMTP_PASS") || "";
    const SMTP_PORT = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const SMTP_FROM = Deno.env.get("SMTP_FROM") || SMTP_USER;
    const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") || SMTP_USER;

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      console.warn("SMTP not configured, logging notification instead");
      console.log("Signed notification:", { document_name, signer_name, signer_email, signed_at });
      return new Response(
        JSON.stringify({ success: true, warning: "SMTP not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { SmtpClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");

    const client = new SmtpClient();
    await client.connectTLS({
      hostname: SMTP_HOST,
      port: SMTP_PORT,
      username: SMTP_USER,
      password: SMTP_PASS,
    });

    const signedDate = new Date(signed_at).toLocaleString("en-US");

    await client.send({
      from: SMTP_FROM,
      to: ADMIN_EMAIL,
      subject: `Document signed: ${document_name}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Document Signed</h2>
          <p>A document has been signed:</p>
          <ul>
            <li><strong>Document:</strong> ${document_name}</li>
            <li><strong>Signed by:</strong> ${signer_name} (${signer_email})</li>
            <li><strong>Date:</strong> ${signedDate}</li>
          </ul>
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
    console.error("Error sending notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
