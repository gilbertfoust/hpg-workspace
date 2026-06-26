import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  assignUserRole,
  corsHeaders,
  jsonResponse,
  NGO_PORTAL_ROLES,
  upsertNgoPortalContact,
  verifyAdminCaller,
} from "../_shared/adminAuth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const authResult = await verifyAdminCaller(req, adminClient);
    if ("error" in authResult) {
      return jsonResponse({ error: authResult.error }, authResult.status);
    }

    const { email, password, full_name, role, ngo_id, is_primary } = await req.json();
    const assignedRole = role || "staff_member";

    if (!email || !password || !full_name) {
      return jsonResponse({ error: "email, password, and full_name are required" }, 400);
    }

    if (NGO_PORTAL_ROLES.has(assignedRole) && !ngo_id) {
      return jsonResponse({ error: "ngo_id is required for NGO portal users" }, 400);
    }

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (createError) {
      return jsonResponse({ error: createError.message }, 400);
    }

    const userId = newUser.user?.id;
    if (!userId) {
      return jsonResponse({ error: "User creation did not return an id" }, 500);
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
    await assignUserRole(adminClient, userId, assignedRole);

    if (NGO_PORTAL_ROLES.has(assignedRole) && ngo_id) {
      await upsertNgoPortalContact(adminClient, {
        userId,
        ngoId: ngo_id,
        fullName: full_name,
        email,
        isPrimary: Boolean(is_primary),
      });
    }

    return jsonResponse({ success: true, user_id: userId });
  } catch (error) {
    console.error("Error in admin-create-user:", error);
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
