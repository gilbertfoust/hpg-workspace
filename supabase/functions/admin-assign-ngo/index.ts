import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  jsonResponse,
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

    const { target_user_id, ngo_id, is_primary } = await req.json();

    if (!target_user_id || !ngo_id) {
      return jsonResponse({ error: "target_user_id and ngo_id are required" }, 400);
    }

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", target_user_id)
      .maybeSingle();

    if (profileError) {
      return jsonResponse({ error: profileError.message }, 500);
    }

    if (!profile) {
      return jsonResponse({ error: "User not found" }, 404);
    }

    const contactId = await upsertNgoPortalContact(adminClient, {
      userId: target_user_id,
      ngoId: ngo_id,
      fullName: profile.full_name || profile.email || "NGO Portal User",
      email: profile.email || "",
      isPrimary: Boolean(is_primary),
    });

    const approvalUpdate: Record<string, unknown> = {
      is_approved: true,
      approval_status: "approved",
    };

    const { error: approvalError } = await adminClient
      .from("profiles")
      .update(approvalUpdate)
      .eq("id", target_user_id);

    if (approvalError) {
      console.warn("Could not update profile approval fields:", approvalError.message);
    }

    return jsonResponse({ success: true, contact_id: contactId });
  } catch (error) {
    console.error("Error in admin-assign-ngo:", error);
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
