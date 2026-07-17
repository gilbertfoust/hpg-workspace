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
  const { data: canRelease } = await userClient.rpc("is_finance_ledger_manager");
  if (!canRelease) return json({ error: "Finance manager access required" }, 403);

  try {
    const { disbursementId } = await req.json();
    const { data: payout, error: payoutError } = await service.from("ngo_fund_disbursements").select("*, ngo_bank_connections(*)").eq("id", disbursementId).single();
    if (payoutError || !payout || payout.status !== "queued") return json({ error: "Queued disbursement not found" }, 404);
    const connection = payout.ngo_bank_connections;
    if (!connection || connection.status !== "verified") throw new Error("Payout destination is not verified");
    if (connection.provider === "relay_manual") return json({ error: "Release this payment in Relay, then upload the final wire receipt" }, 409);

    let transferId = "";
    let providerStatus = "processing";
    let providerResponse: Record<string, unknown> = {};

    if (connection.provider === "stripe_connect") {
      const key = Deno.env.get("STRIPE_SECRET_KEY");
      const destination = connection.provider_recipient_ref || connection.provider_account_ref;
      if (!key || !destination) throw new Error("Stripe Connect recipient is not configured");
      const params = new URLSearchParams({
        amount: String(Math.round(Number(payout.amount) * 100)),
        currency: String(payout.source_currency).toLowerCase(),
        destination,
        description: payout.purpose,
        "metadata[disbursement_id]": payout.id,
        "metadata[disbursement_number]": payout.disbursement_number,
      });
      const response = await fetch("https://api.stripe.com/v1/transfers", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": payout.id },
        body: params,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message || "Stripe transfer failed");
      transferId = result.id;
      providerStatus = "transferred_to_connected_account";
      providerResponse = { id: result.id, amount: result.amount, currency: result.currency, destination: result.destination, created: result.created };
    } else if (connection.provider === "wise") {
      const token = Deno.env.get("WISE_API_TOKEN");
      const profile = Deno.env.get("WISE_PROFILE_ID");
      const recipient = connection.provider_recipient_ref;
      const base = Deno.env.get("WISE_API_BASE_URL") || "https://api.wise.com";
      if (!token || !profile || !recipient) throw new Error("Wise payout credentials or recipient are not configured");
      const quoteResponse = await fetch(`${base}/v3/profiles/${profile}/quotes`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ sourceCurrency: payout.source_currency, targetCurrency: payout.destination_currency, sourceAmount: Number(payout.amount), payOut: "BANK_TRANSFER" }),
      });
      const quote = await quoteResponse.json();
      if (!quoteResponse.ok) throw new Error(quote?.errors?.[0]?.message || "Wise quote failed");
      const transferResponse = await fetch(`${base}/v1/transfers`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ targetAccount: Number(recipient), quoteUuid: quote.id, customerTransactionId: payout.id, details: { reference: payout.disbursement_number } }),
      });
      const transfer = await transferResponse.json();
      if (!transferResponse.ok) throw new Error(transfer?.errors?.[0]?.message || "Wise transfer failed");
      const fundResponse = await fetch(`${base}/v3/profiles/${profile}/transfers/${transfer.id}/payments`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ type: "BALANCE" }),
      });
      const funded = await fundResponse.json();
      if (!fundResponse.ok) throw new Error(funded?.errors?.[0]?.message || "Wise transfer funding failed");
      transferId = String(transfer.id);
      providerStatus = String(funded.status || transfer.status || "processing");
      providerResponse = { transferId: transfer.id, quoteId: quote.id, status: providerStatus, sourceValue: quote.sourceAmount, targetValue: quote.targetAmount, rate: quote.rate };
    } else {
      throw new Error("This provider does not support automatic payout release");
    }

    const { data: recorded, error: recordError } = await service.rpc("record_ngo_disbursement_provider_result", {
      p_disbursement_id: payout.id,
      p_provider_event_id: `${connection.provider}:${transferId}:created`,
      p_provider_transfer_id: transferId,
      p_provider_status: providerStatus,
      p_result_status: "processing",
      p_provider_response: providerResponse,
      p_destination_amount: providerResponse.targetValue || null,
      p_exchange_rate: providerResponse.rate || null,
      p_provider_fee: null,
    });
    if (recordError) throw recordError;
    return json({ disbursement: recorded, message: "Provider accepted the payout. Upload or sync the final settlement receipt before ledger posting." });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Payout processing failed" }, 400);
  }
});
