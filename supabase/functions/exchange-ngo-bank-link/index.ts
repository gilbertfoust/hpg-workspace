import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function encrypt(value: string) {
  const encodedKey = Deno.env.get("BANK_TOKEN_ENCRYPTION_KEY");
  if (!encodedKey) throw new Error("Bank token encryption is not configured");
  const rawKey = Uint8Array.from(atob(encodedKey), (char) => char.charCodeAt(0));
  if (rawKey.byteLength !== 32) throw new Error("Bank token encryption key must be 32 bytes");
  const key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value)));
  const combined = new Uint8Array(iv.length + ciphertext.length);
  combined.set(iv); combined.set(ciphertext, iv.length);
  return `enc:v1:${btoa(String.fromCharCode(...combined))}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const auth = req.headers.get("Authorization") || "";
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const service = createClient(url, serviceKey);
  const { data: userData } = await userClient.auth.getUser(auth.replace("Bearer ", ""));
  if (!userData.user) return json({ error: "Unauthorized" }, 401);
  try {
    const { connectionId, publicToken, accountId } = await req.json();
    const { data: connection } = await service.from("ngo_bank_connections").select("*").eq("id", connectionId).eq("provider", "plaid").single();
    if (!connection) return json({ error: "Bank connection not found" }, 404);
    const { data: allowed } = await userClient.rpc("has_ngo_finance_access", { p_ngo_id: connection.ngo_id, p_minimum_access: "ngo_admin" });
    if (!allowed) return json({ error: "NGO administrator access required" }, 403);

    const plaidBase = Deno.env.get("PLAID_ENV") || "https://production.plaid.com";
    const credentials = { client_id: Deno.env.get("PLAID_CLIENT_ID"), secret: Deno.env.get("PLAID_SECRET") };
    const exchangeResponse = await fetch(`${plaidBase}/item/public_token/exchange`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...credentials, public_token: publicToken }) });
    const exchange = await exchangeResponse.json();
    if (!exchangeResponse.ok) throw new Error(exchange?.error_message || "Plaid token exchange failed");
    const accountsResponse = await fetch(`${plaidBase}/accounts/get`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...credentials, access_token: exchange.access_token }) });
    const accounts = await accountsResponse.json();
    if (!accountsResponse.ok) throw new Error(accounts?.error_message || "Plaid account lookup failed");
    const account = accounts.accounts?.find((item: any) => item.account_id === accountId) || accounts.accounts?.[0];
    if (!account) throw new Error("No bank account was selected");

    await service.from("ngo_bank_connection_credentials").upsert({ bank_connection_id: connection.id, secret_reference: await encrypt(exchange.access_token) });
    const { data: updated, error } = await service.from("ngo_bank_connections").update({
      status: "verified",
      provider_item_ref: exchange.item_id,
      provider_account_ref: account.account_id,
      institution_name: accounts.item?.institution_id || "Connected institution",
      account_name: account.name,
      account_type: account.subtype || account.type,
      account_mask: account.mask,
      verified_at: new Date().toISOString(),
      capabilities: { transactions: true, account_verification: true, payouts: false },
    }).eq("id", connection.id).select().single();
    if (error) throw error;
    await service.from("ngo_bank_connection_audit_events").insert({ bank_connection_id: connection.id, event_type: "verified", actor_user_id: userData.user.id, event_json: { account_mask: account.mask } });
    return json({ connection: updated });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Bank verification failed" }, 400);
  }
});
