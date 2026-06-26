import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  assignUserRole,
  corsHeaders,
  jsonResponse,
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

    const { caller } = authResult;
    const { target_user_id, new_role } = await req.json();

    if (!target_user_id || !new_role) {
      return jsonResponse({ error: "target_user_id and new_role are required" }, 400);
    }

    if (target_user_id === caller.id) {
      return jsonResponse({ error: "Cannot change your own role" }, 400);
    }

    await assignUserRole(adminClient, target_user_id, new_role);

    return jsonResponse({ success: true });
  } catch (error) {
    console.error("Error in admin-update-role:", error);
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
