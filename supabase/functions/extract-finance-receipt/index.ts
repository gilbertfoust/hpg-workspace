import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
};

const cleanText = (value: unknown, maxLength = 500) => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
};

const moneyOrNull = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100) / 100;
};

const dateOrNull = (value: unknown) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : value;
};

const clampConfidence = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(1, parsed));
};

const failDraft = async (client: SupabaseClient, draftId: string, error: unknown) => {
  const message = error instanceof Error ? error.message : "Receipt analysis failed";
  await client
    .from("finance_receipt_drafts")
    .update({
      status: "failed",
      error_message: message.slice(0, 1000),
      extraction_completed_at: new Date().toISOString(),
    })
    .eq("id", draftId)
    .neq("status", "posted");
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return jsonResponse({ error: "Service configuration is incomplete" }, 500);

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.slice("Bearer ".length);
  const { data: userData, error: userError } = await client.auth.getUser(token);
  if (userError || !userData.user) return jsonResponse({ error: "Unauthorized" }, 401);

  const { data: canManage, error: accessError } = await client.rpc("is_finance_ledger_manager");
  if (accessError || !canManage) return jsonResponse({ error: "Finance manager access required" }, 403);

  let draftId = "";
  try {
    const body = await req.json();
    draftId = typeof body?.draftId === "string" ? body.draftId : "";
    if (!draftId) return jsonResponse({ error: "draftId is required" }, 400);

    const { data: draft, error: draftError } = await client
      .from("finance_receipt_drafts")
      .select("*")
      .eq("id", draftId)
      .single();
    if (draftError || !draft) return jsonResponse({ error: "Receipt draft not found" }, 404);
    if (draft.status === "posted") return jsonResponse({ error: "Receipt is already posted" }, 409);

    const { data: document, error: documentError } = await client
      .from("documents")
      .select("id, ngo_id, file_path, file_name, file_type, file_size")
      .eq("id", draft.document_id)
      .eq("ngo_id", draft.ngo_id)
      .single();
    if (documentError || !document) throw new Error("Receipt document is unavailable");

    await client
      .from("finance_receipt_drafts")
      .update({
        status: "processing",
        error_message: null,
        extraction_attempted_at: new Date().toISOString(),
        extraction_completed_at: null,
      })
      .eq("id", draftId)
      .neq("status", "posted");

    const { data: receiptBlob, error: downloadError } = await client.storage
      .from("ngo-documents")
      .download(document.file_path);
    if (downloadError || !receiptBlob) throw new Error("Receipt file could not be downloaded");
    if (receiptBlob.size <= 0 || receiptBlob.size > 15 * 1024 * 1024) {
      throw new Error("Receipt must be between 1 byte and 15 MB");
    }

    const mimeType = document.file_type || receiptBlob.type || "application/octet-stream";
    if (mimeType !== "application/pdf" && !mimeType.startsWith("image/")) {
      throw new Error("Receipt must be a PDF or image");
    }

    const { data: accounts, error: accountsError } = await client
      .from("finance_accounts")
      .select("id, code, name, account_type, account_subtype, is_cash_account")
      .eq("is_active", true)
      .in("account_type", ["expense", "asset", "liability"])
      .order("code");
    if (accountsError || !accounts?.length) throw new Error("Finance chart of accounts is unavailable");

    const expenseAccounts = accounts.filter((account) => account.account_type === "expense");
    const paymentAccounts = accounts.filter((account) => account.account_type === "asset" || account.account_type === "liability");
    if (!expenseAccounts.length || !paymentAccounts.length) {
      throw new Error("Expense and paid-from accounts must be configured before receipt analysis");
    }

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) throw new Error("Receipt intelligence is not configured");

    const bytes = new Uint8Array(await receiptBlob.arrayBuffer());
    const receiptDataUrl = `data:${mimeType};base64,${bytesToBase64(bytes)}`;
    const accountContext = accounts.map((account) => ({
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.account_type,
      subtype: account.account_subtype,
      cash: account.is_cash_account,
    }));

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "You are a careful nonprofit bookkeeper. Read the attached receipt, extract only facts visible in it, and choose the best accounts from the supplied chart. Never invent a value. If uncertain, lower confidence and explain why review is needed.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this receipt for an expense transaction. File: ${document.file_name}. Currency defaults to USD only if no other currency is visible. For credit-card purchases choose a liability paid-from account; for cash, check, ACH, debit-card, or wire choose an asset paid-from account. Available accounts: ${JSON.stringify(accountContext)}`,
              },
              {
                type: "image_url",
                image_url: { url: receiptDataUrl, detail: "high" },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "save_receipt_draft",
              description: "Return the extracted receipt and accounting draft",
              parameters: {
                type: "object",
                properties: {
                  merchant_name: { type: "string" },
                  transaction_date: { type: "string", description: "YYYY-MM-DD or empty string" },
                  subtotal: { type: "number" },
                  tax_amount: { type: "number" },
                  tip_amount: { type: "number" },
                  total_amount: { type: "number" },
                  currency: { type: "string", description: "Three-letter currency code" },
                  payment_method: {
                    type: "string",
                    enum: ["cash", "check", "ach", "debit_card", "credit_card", "wire", "other"],
                  },
                  reference_number: { type: "string", description: "Check number, authorization, or card last four; empty if absent" },
                  memo: { type: "string", description: "Concise business-purpose description based on visible purchased items" },
                  expense_account_id: { type: "string", enum: expenseAccounts.map((account) => account.id) },
                  payment_account_id: { type: "string", enum: paymentAccounts.map((account) => account.id) },
                  confidence: { type: "number", minimum: 0, maximum: 1 },
                  needs_review_reasons: { type: "array", items: { type: "string" } },
                },
                required: [
                  "merchant_name", "transaction_date", "total_amount", "currency",
                  "payment_method", "memo", "expense_account_id", "payment_account_id",
                  "confidence", "needs_review_reasons",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "save_receipt_draft" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) throw new Error("Receipt intelligence is busy; retry in a moment");
      if (aiResponse.status === 402) throw new Error("Receipt intelligence credits are unavailable");
      throw new Error(`Receipt intelligence returned status ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    const argumentsJson = aiResult?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (typeof argumentsJson !== "string") throw new Error("Receipt intelligence did not return a structured draft");

    let extraction: Record<string, unknown>;
    try {
      extraction = JSON.parse(argumentsJson);
    } catch {
      throw new Error("Receipt intelligence returned invalid structured data");
    }

    const validExpenseIds = new Set(expenseAccounts.map((account) => account.id));
    const validPaymentIds = new Set(paymentAccounts.map((account) => account.id));
    const merchant = cleanText(extraction.merchant_name, 200);
    const transactionDate = dateOrNull(extraction.transaction_date);
    const total = moneyOrNull(extraction.total_amount);
    const methodValues = new Set(["cash", "check", "ach", "debit_card", "credit_card", "wire", "other"]);
    const method = typeof extraction.payment_method === "string" && methodValues.has(extraction.payment_method)
      ? extraction.payment_method
      : "other";
    const expenseId = typeof extraction.expense_account_id === "string" && validExpenseIds.has(extraction.expense_account_id)
      ? extraction.expense_account_id
      : null;
    let paymentId = typeof extraction.payment_account_id === "string" && validPaymentIds.has(extraction.payment_account_id)
      ? extraction.payment_account_id
      : null;

    const selectedPaymentAccount = paymentAccounts.find((account) => account.id === paymentId);
    const expectedPaymentType = method === "credit_card" ? "liability" : method === "other" ? null : "asset";
    if (expectedPaymentType && selectedPaymentAccount?.account_type !== expectedPaymentType) paymentId = null;
    if (!paymentId) {
      paymentId = method === "credit_card"
        ? paymentAccounts.find((account) => account.account_type === "liability" && account.account_subtype === "credit_card")?.id ?? null
        : paymentAccounts.find((account) => account.account_type === "asset" && account.is_cash_account)?.id
          ?? paymentAccounts.find((account) => account.account_type === "asset")?.id
          ?? null;
    }

    const confidence = clampConfidence(extraction.confidence);
    const reviewReasons = Array.isArray(extraction.needs_review_reasons)
      ? extraction.needs_review_reasons.map((reason) => cleanText(reason, 250)).filter((reason): reason is string => Boolean(reason)).slice(0, 10)
      : [];
    if (!merchant) reviewReasons.push("Merchant could not be read");
    if (!transactionDate) reviewReasons.push("Transaction date could not be read");
    if (!total || total <= 0) reviewReasons.push("Total amount could not be read");
    if (!expenseId) reviewReasons.push("Expense account needs to be selected");
    if (!paymentId) reviewReasons.push("Paid-from account needs to be selected");
    if (confidence < 0.8) reviewReasons.push("Extraction confidence is below 80%");

    const uniqueReviewReasons = [...new Set(reviewReasons)];
    const status = uniqueReviewReasons.length ? "needs_review" : "ready";
    const completedAt = new Date().toISOString();
    const { data: updatedDraft, error: updateError } = await client
      .from("finance_receipt_drafts")
      .update({
        status,
        merchant_name: merchant,
        transaction_date: transactionDate,
        subtotal: moneyOrNull(extraction.subtotal),
        tax_amount: moneyOrNull(extraction.tax_amount),
        tip_amount: moneyOrNull(extraction.tip_amount),
        total_amount: total,
        currency: (cleanText(extraction.currency, 3) || "USD").toUpperCase(),
        payment_method: method,
        reference_number: cleanText(extraction.reference_number, 120),
        memo: cleanText(extraction.memo, 500),
        suggested_expense_account_id: expenseId,
        suggested_payment_account_id: paymentId,
        confidence,
        needs_review_reasons: uniqueReviewReasons,
        extracted_data_json: extraction,
        error_message: null,
        extraction_completed_at: completedAt,
      })
      .eq("id", draftId)
      .neq("status", "posted")
      .select("*")
      .single();
    if (updateError || !updatedDraft) throw new Error("Receipt draft could not be saved");

    await client
      .from("documents")
      .update({
        title: merchant ? `Receipt — ${merchant}` : `Receipt — ${document.file_name}`,
        review_status: "pending",
      })
      .eq("id", document.id);

    return jsonResponse({ success: true, draft: updatedDraft });
  } catch (error) {
    console.error("extract-finance-receipt failed", error instanceof Error ? error.message : "Unknown error");
    if (draftId) await failDraft(client, draftId, error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Receipt analysis failed" }, 500);
  }
});

