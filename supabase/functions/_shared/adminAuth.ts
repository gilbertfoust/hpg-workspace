import { createClient, type SupabaseClient, type User } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export async function verifyAdminCaller(
  req: Request,
  adminClient: SupabaseClient,
): Promise<{ caller: User } | { error: string; status: number }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    return { error: "Server configuration error", status: 500 };
  }

  const jwt = getBearerToken(req);
  if (!jwt) {
    return { error: "Unauthorized", status: 401 };
  }

  const callerClient = createClient(supabaseUrl, supabaseAnonKey);
  const {
    data: { user: caller },
    error: callerError,
  } = await callerClient.auth.getUser(jwt);

  if (callerError || !caller) {
    return { error: "Unauthorized", status: 401 };
  }

  const { data: callerRole } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", caller.id)
    .in("role", ["super_admin", "admin_pm"])
    .maybeSingle();

  if (!callerRole) {
    return { error: "Only admins can perform this action", status: 403 };
  }

  return { caller };
}

export const NGO_PORTAL_ROLES = new Set(["external_ngo", "ngo_user"]);

export async function upsertNgoPortalContact(
  adminClient: SupabaseClient,
  params: {
    userId: string;
    ngoId: string;
    fullName: string;
    email: string;
    isPrimary?: boolean;
  },
) {
  const { data: existingContact, error: lookupError } = await adminClient
    .from("contacts")
    .select("id")
    .eq("user_id", params.userId)
    .maybeSingle();

  if (lookupError) {
    throw lookupError;
  }

  const contactPayload = {
    ngo_id: params.ngoId,
    user_id: params.userId,
    name: params.fullName,
    email: params.email,
    org_type: "ngo",
    is_primary: params.isPrimary ?? false,
    updated_at: new Date().toISOString(),
  };

  if (existingContact?.id) {
    const { error } = await adminClient
      .from("contacts")
      .update(contactPayload)
      .eq("id", existingContact.id);
    if (error) throw error;
    return existingContact.id as string;
  }

  const { data: inserted, error: insertError } = await adminClient
    .from("contacts")
    .insert(contactPayload)
    .select("id")
    .single();

  if (insertError) throw insertError;
  return inserted.id as string;
}

export async function assignUserRole(
  adminClient: SupabaseClient,
  userId: string,
  role: string,
) {
  await adminClient.from("user_roles").delete().eq("user_id", userId);

  const { error: insertError } = await adminClient
    .from("user_roles")
    .insert({ user_id: userId, role });

  if (insertError) {
    throw insertError;
  }

  const { error: profileError } = await adminClient
    .from("profiles")
    .update({
      role,
      is_approved: true,
      approval_status: "approved",
    })
    .eq("id", userId);

  if (profileError) {
    const { error: roleOnlyError } = await adminClient
      .from("profiles")
      .update({ role })
      .eq("id", userId);

    if (roleOnlyError) {
      throw roleOnlyError;
    }
  }
}
