import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is authenticated
    const authHeader = req.headers.get("authorization") || "";
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { authorization: authHeader } },
    });

    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify caller is super_admin or admin_pm
    const { data: callerRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .in("role", ["super_admin", "admin_pm"])
      .maybeSingle();

    if (!callerRole) {
      return new Response(
        JSON.stringify({ error: "Only admins can approve users" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { target_user_id, action, role } = await req.json();

    if (!target_user_id || !action) {
      return new Response(
        JSON.stringify({ error: "target_user_id and action are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "approve") {
      // Update profile to approved
      const { error: updateError } = await adminClient
        .from("profiles")
        .update({ is_approved: true, approval_status: "approved" })
        .eq("id", target_user_id);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // If a role was specified, update the user's role
      if (role && role !== "staff_member") {
        await adminClient
          .from("user_roles")
          .update({ role })
          .eq("user_id", target_user_id);
      }

      // Get user email to send notification
      const { data: userData } = await adminClient.auth.admin.getUserById(target_user_id);
      
      if (userData?.user?.email) {
        // Send approval email via SMTP
        const smtpHost = Deno.env.get("SMTP_HOST");
        const smtpPort = Deno.env.get("SMTP_PORT");
        const smtpUser = Deno.env.get("SMTP_USER");
        const smtpPass = Deno.env.get("SMTP_PASS");
        const smtpFrom = Deno.env.get("SMTP_FROM") || "noreply@humanitypathwaysglobal.com";
        const appUrl = Deno.env.get("APP_URL") || "https://hpg-workspace.lovable.app";

        if (smtpHost && smtpUser && smtpPass) {
          try {
            const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
            const client = new SMTPClient({
              connection: {
                hostname: smtpHost,
                port: parseInt(smtpPort || "587"),
                tls: true,
                auth: { username: smtpUser, password: smtpPass },
              },
            });

            const profileName = userData.user.user_metadata?.full_name || userData.user.email;

            await client.send({
              from: smtpFrom,
              to: userData.user.email,
              subject: "Your HPG Workstation Account Has Been Approved",
              content: "auto",
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #1a1a2e; margin: 0;">HPG Workstation</h1>
                    <p style="color: #666; margin: 5px 0 0;">Org Coordination OS</p>
                  </div>
                  <div style="background: #f8f9fa; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
                    <h2 style="color: #1a1a2e; margin: 0 0 15px;">Account Approved!</h2>
                    <p style="color: #333; line-height: 1.6;">
                      Hello ${profileName},
                    </p>
                    <p style="color: #333; line-height: 1.6;">
                      Your account has been reviewed and approved by an administrator. You can now log in to the HPG Workstation and access your assigned modules.
                    </p>
                    <div style="text-align: center; margin: 25px 0;">
                      <a href="${appUrl}/auth" style="background: #4f46e5; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 600;">
                        Log In Now
                      </a>
                    </div>
                  </div>
                  <p style="color: #999; font-size: 12px; text-align: center;">
                    Humanity Pathways Global — Empowering Communities Worldwide
                  </p>
                </div>
              `,
            });

            await client.close();
          } catch (emailErr) {
            console.error("Failed to send approval email:", emailErr);
            // Don't fail the approval just because email failed
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, action: "approved" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else if (action === "reject") {
      // Update profile status to rejected
      const { error: updateError } = await adminClient
        .from("profiles")
        .update({ is_approved: false, approval_status: "rejected" })
        .eq("id", target_user_id);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, action: "rejected" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid action. Must be 'approve' or 'reject'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Error in admin-approve-user:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
