import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

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
    const { ngoId } = await req.json();
    const { data: allowed } = await userClient.rpc("has_ngo_finance_access", { p_ngo_id: ngoId, p_minimum_access: "approver" });
    if (!allowed) return json({ error: "NGO approver access required" }, 403);
    const { data: onboarding } = await service.from("ngo_portal_onboarding").select("*, ngo_agreements(*)").eq("ngo_id", ngoId).single();
    if (!onboarding?.ngo_agreements || onboarding.ngo_agreements.status !== "signed") return json({ error: "The fiscal sponsorship agreement must be signed before payment" }, 409);
    const { data: ngo } = await service.from("ngos").select("legal_name,common_name,activation_fee_amount_cents,activation_fee_currency").eq("id", ngoId).single();
    const amount = Number(ngo?.activation_fee_amount_cents || Deno.env.get("DEFAULT_NGO_ONBOARDING_FEE_CENTS") || 10000);
    const currency = String(ngo?.activation_fee_currency || "USD").toLowerCase();
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ error: "Online onboarding payments are not configured" }, 503);
    const site = Deno.env.get("PUBLIC_SITE_URL") || "";
    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set("success_url", `${site}/portal?onboarding_payment=success&session_id={CHECKOUT_SESSION_ID}`);
    params.set("cancel_url", `${site}/portal?onboarding_payment=cancelled`);
    params.set("client_reference_id", ngoId);
    params.set("metadata[ngo_id]", ngoId);
    params.set("metadata[agreement_id]", onboarding.agreement_id);
    params.set("line_items[0][quantity]", "1");
    params.set("line_items[0][price_data][currency]", currency);
    params.set("line_items[0][price_data][unit_amount]", String(amount));
    params.set("line_items[0][price_data][product_data][name]", "HPG NGO onboarding fee");
    params.set("line_items[0][price_data][product_data][description]", ngo?.common_name || ngo?.legal_name || "NGO onboarding");
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" }, body: params });
    const session = await response.json();
    if (!response.ok) throw new Error(session?.error?.message || "Payment checkout could not be created");
    const { data: payment, error } = await service.from("ngo_onboarding_payment_sessions").insert({
      ngo_id: ngoId,
      agreement_id: onboarding.agreement_id,
      amount_cents: amount,
      currency: currency.toUpperCase(),
      provider: "stripe",
      provider_session_id: session.id,
      provider_status: session.status,
      status: "open",
      checkout_url: session.url,
      created_by_user_id: userData.user.id,
      metadata: { payment_intent: session.payment_intent || null },
    }).select().single();
    if (error) throw error;
    await service.from("ngo_portal_onboarding").update({ status: "payment_pending", payment_session_id: payment.id }).eq("ngo_id", ngoId);
    return json({ checkoutUrl: session.url, paymentSessionId: payment.id });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Payment setup failed" }, 400);
  }
});
