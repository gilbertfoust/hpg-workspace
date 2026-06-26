import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, verifyAdminCaller } from "../_shared/adminAuth.ts";

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

    const { target_user_id, new_password } = await req.json();

    if (!target_user_id || !new_password) {
      return jsonResponse({ error: "target_user_id and new_password are required" }, 400);
    }

    if (new_password.length < 8) {
      return jsonResponse({ error: "Password must be at least 8 characters" }, 400);
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      target_user_id,
      { password: new_password },
    );

    if (updateError) {
      return jsonResponse({ error: updateError.message }, 500);
    }

    return jsonResponse({ success: true });
  } catch (error) {
    console.error("Error in admin-reset-password:", error);
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
