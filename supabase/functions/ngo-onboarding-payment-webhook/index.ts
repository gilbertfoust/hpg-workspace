import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_ONBOARDING_WEBHOOK_SECRET");
  if (!stripeKey || !webhookSecret) return new Response("Webhook is not configured", { status: 503 });
  const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });
  const payload = await req.text();
  const signature = req.headers.get("stripe-signature") || "";
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(payload, signature, webhookSecret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const ngoId = session.metadata?.ngo_id;
    if (ngoId) {
      const receiptBytes = new TextEncoder().encode(JSON.stringify({
        event_id: event.id,
        checkout_session_id: session.id,
        payment_intent: session.payment_intent,
        amount_total: session.amount_total,
        currency: session.currency,
        payment_status: session.payment_status,
        completed_at: new Date(event.created * 1000).toISOString(),
      }, null, 2));
      const receiptPath = `${ngoId}/finance/onboarding/${session.id}.json`;
      await service.storage.from("ngo-documents").upload(receiptPath, receiptBytes, { contentType: "application/json", upsert: true });
      const { data: document } = await service.from("documents").insert({
        ngo_id: ngoId,
        file_path: receiptPath,
        file_name: `onboarding-payment-${session.id}.json`,
        file_type: "application/json",
        file_size: receiptBytes.byteLength,
        category: "finance",
        review_status: "approved",
        title: "NGO onboarding payment receipt",
      }).select().single();
      const { data: payment } = await service.from("ngo_onboarding_payment_sessions").update({
        status: "paid",
        provider_status: session.payment_status,
        provider_payment_id: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
        paid_at: new Date().toISOString(),
        receipt_document_id: document?.id || null,
        metadata: { stripe_event_id: event.id },
      }).eq("provider_session_id", session.id).select().maybeSingle();
      await service.from("ngo_portal_onboarding").update({ status: "payment_verified", payment_session_id: payment?.id }).eq("ngo_id", ngoId);
      await service.from("ngos").update({ activation_fee_verified_at: new Date().toISOString(), activation_fee_payment_reference: String(session.payment_intent || session.id) }).eq("id", ngoId);
    }
  }
  return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
});
