import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json" },
});
const plaidCountries = new Set([
  "US","CA","AT","BE","DK","EE","FI","FR","DE","IE","IT","LV","LT","NL","NO","PL","PT","ES","SE","GB",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const service = createClient(url, serviceKey);
  const { data: userData, error: userError } = await userClient.auth.getUser(auth.slice(7));
  if (userError || !userData.user) return json({ error: "Unauthorized" }, 401);

  try {
    const body = await req.json();
    const ngoId = String(body?.ngoId || "");
    const countryCode = String(body?.countryCode || "").toUpperCase();
    const currency = String(body?.currency || "USD").toUpperCase();
    let provider = String(body?.provider || "auto");
    if (!ngoId || !/^[A-Z]{2}$/.test(countryCode)) return json({ error: "ngoId and a two-letter countryCode are required" }, 400);

    const { data: allowed } = await userClient.rpc("has_ngo_finance_access", { p_ngo_id: ngoId, p_minimum_access: "ngo_admin" });
    if (!allowed) return json({ error: "NGO administrator access required" }, 403);

    if (provider === "auto") {
      if (plaidCountries.has(countryCode) && Deno.env.get("PLAID_CLIENT_ID") && Deno.env.get("PLAID_SECRET")) provider = "plaid";
      else if (Deno.env.get("STRIPE_SECRET_KEY")) provider = "stripe_connect";
      else provider = "wise";
    }
    if (!["plaid","stripe_connect","wise","relay_manual"].includes(provider)) return json({ error: "Unsupported bank provider" }, 400);
    if (provider === "plaid" && !plaidCountries.has(countryCode)) {
      return json({ error: "Plaid bank connectivity is not available for this country; use the international payout onboarding option" }, 400);
    }

    const { data: connection, error: connectionError } = await service.from("ngo_bank_connections").insert({
      ngo_id: ngoId,
      provider,
      connection_purpose: provider === "plaid" ? "data" : "payout",
      country_code: countryCode,
      currency,
      status: "pending",
      consented_by_user_id: userData.user.id,
      consented_at: new Date().toISOString(),
      capabilities: provider === "plaid" ? { transactions: true, account_verification: true, payouts: false } : { payouts: true },
    }).select().single();
    if (connectionError) throw connectionError;

    if (provider === "plaid") {
      const plaidResponse = await fetch(`${Deno.env.get("PLAID_ENV") || "https://production.plaid.com"}/link/token/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: Deno.env.get("PLAID_CLIENT_ID"),
          secret: Deno.env.get("PLAID_SECRET"),
          client_name: "Humanity Pathways Global",
          language: "en",
          country_codes: [countryCode],
          products: ["auth","transactions"],
          user: { client_user_id: `${userData.user.id}:${ngoId}` },
          webhook: Deno.env.get("PLAID_WEBHOOK_URL") || undefined,
        }),
      });
      const plaid = await plaidResponse.json();
      if (!plaidResponse.ok) throw new Error(plaid?.error_message || "Plaid could not start bank verification");
      await service.from("ngo_bank_connection_audit_events").insert({ bank_connection_id: connection.id, event_type: "link_session_created", actor_user_id: userData.user.id });
      return json({ connectionId: connection.id, provider, mode: "plaid_link", linkToken: plaid.link_token, expiresAt: plaid.expiration });
    }

    if (provider === "stripe_connect") {
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (!stripeKey) throw new Error("Stripe Connect is not configured");
      const accountParams = new URLSearchParams({ type: "express", country: countryCode, business_type: "company", "capabilities[transfers][requested]": "true" });
      const accountResponse = await fetch("https://api.stripe.com/v1/accounts", { method: "POST", headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" }, body: accountParams });
      const account = await accountResponse.json();
      if (!accountResponse.ok) throw new Error(account?.error?.message || "Stripe recipient onboarding could not start");
      const returnUrl = `${Deno.env.get("PUBLIC_SITE_URL") || ""}/portal?bank=return`;
      const linkParams = new URLSearchParams({ account: account.id, refresh_url: returnUrl, return_url: returnUrl, type: "account_onboarding" });
      const linkResponse = await fetch("https://api.stripe.com/v1/account_links", { method: "POST", headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" }, body: linkParams });
      const link = await linkResponse.json();
      if (!linkResponse.ok) throw new Error(link?.error?.message || "Stripe onboarding link could not be created");
      await service.from("ngo_bank_connections").update({ provider_account_ref: account.id, status: "verification_required" }).eq("id", connection.id);
      return json({ connectionId: connection.id, provider, mode: "redirect", onboardingUrl: link.url });
    }

    await service.from("ngo_bank_connections").update({ status: "verification_required" }).eq("id", connection.id);
    return json({
      connectionId: connection.id,
      provider,
      mode: "finance_verification",
      message: provider === "wise"
        ? "HPG Finance will verify the organization's Wise payout recipient details."
        : "HPG Finance will verify the Relay/manual payout instructions.",
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Bank connection failed" }, 400);
  }
});
