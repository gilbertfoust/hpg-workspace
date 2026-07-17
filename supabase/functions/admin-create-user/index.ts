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

    // Verify caller is super_admin
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

    const { data: callerRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .maybeSingle();

    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("role, department_id, org_rank")
      .eq("id", caller.id)
      .maybeSingle();

    let callerDepartment = "";
    if (callerProfile?.department_id) {
      const { data: unit } = await adminClient
        .from("org_units")
        .select("department_name")
        .eq("id", callerProfile.department_id)
        .maybeSingle();
      callerDepartment = String(unit?.department_name || "").trim().toLowerCase();
    }

    const adminRoles = ["super_admin", "admin_pm"];
    const managementRanks = ["chief_executive", "executive_vice_president", "vice_president", "director", "manager"];
    const effectiveCallerRole = String(callerProfile?.role || callerRole?.role || "");
    const isAdmin = adminRoles.includes(effectiveCallerRole);
    const isItManager = ["it", "information technology"].includes(callerDepartment)
      && managementRanks.includes(String(callerProfile?.org_rank || ""));

    if (!isAdmin && !isItManager) {
      return new Response(
        JSON.stringify({ error: "Only an admin, super admin, or authorized IT manager can create users" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const {
      email,
      password,
      full_name,
      role = "staff_member",
      department_id = null,
      org_rank = null,
      ngo_id = null,
      ngo_access_level = "preparer",
    } = await req.json();

    if (!email || !password || !full_name) {
      return new Response(
        JSON.stringify({ error: "email, password, and full_name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const allowedRoles = [
      "super_admin", "admin_pm", "vp_operations", "vp_programs", "vp_development",
      "vp_finance", "vp_communications", "department_lead", "ngo_coordinator",
      "executive_secretariat", "staff", "staff_member", "ngo_user", "external_ngo",
      "viewer", "board",
    ];
    const portalRoles = ["ngo_user", "external_ngo"];
    const allowedRanks = [
      "chief_executive", "executive_vice_president", "vice_president", "director",
      "manager", "specialist", "coordinator", "associate", "staff",
    ];
    const allowedNgoAccess = ["viewer", "preparer", "approver", "ngo_admin"];

    if (!allowedRoles.includes(role)) {
      return new Response(JSON.stringify({ error: "Unsupported role" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (isItManager && !isAdmin && !portalRoles.includes(role)) {
      return new Response(JSON.stringify({ error: "IT managers may create NGO portal accounts only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (portalRoles.includes(role) && !ngo_id) {
      return new Response(JSON.stringify({ error: "An NGO is required for an NGO portal account" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (org_rank && !allowedRanks.includes(org_rank)) {
      return new Response(JSON.stringify({ error: "Unsupported organization rank" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!allowedNgoAccess.includes(ngo_access_level)) {
      return new Response(JSON.stringify({ error: "Unsupported NGO access level" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create user via admin API (auto-confirms email)
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (createError) {
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (newUser.user) {
      await new Promise((r) => setTimeout(r, 250));

      const { error: profileError } = await adminClient.from("profiles").upsert({
        id: newUser.user.id,
        email: String(email).trim().toLowerCase(),
        full_name: String(full_name).trim(),
        role,
        department_id: portalRoles.includes(role) ? null : department_id,
        org_rank: portalRoles.includes(role) ? null : (org_rank || "staff"),
        is_approved: true,
        approval_status: "approved",
      }, { onConflict: "id" });
      if (profileError) {
        await adminClient.auth.admin.deleteUser(newUser.user.id);
        throw profileError;
      }

      await adminClient.from("user_roles").delete().eq("user_id", newUser.user.id);
      const { error: roleError } = await adminClient.from("user_roles").insert({
        user_id: newUser.user.id,
        role,
      });
      if (roleError) {
        await adminClient.auth.admin.deleteUser(newUser.user.id);
        throw roleError;
      }

      if (portalRoles.includes(role)) {
        const { error: membershipError } = await adminClient.from("ngo_portal_memberships").upsert({
          user_id: newUser.user.id,
          ngo_id,
          access_level: ngo_access_level,
          status: "active",
          invited_by_user_id: caller.id,
          accepted_at: new Date().toISOString(),
          can_manage_staff: ngo_access_level === "ngo_admin",
        }, { onConflict: "user_id,ngo_id" });
        if (membershipError) {
          await adminClient.auth.admin.deleteUser(newUser.user.id);
          throw membershipError;
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, user_id: newUser.user?.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in admin-create-user:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
