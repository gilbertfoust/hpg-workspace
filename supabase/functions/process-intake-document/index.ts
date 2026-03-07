import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { intakeId } = await req.json();
    if (!intakeId) {
      return new Response(JSON.stringify({ error: "intakeId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the intake submission
    const { data: submission, error: fetchErr } = await supabase
      .from("document_intake_submissions")
      .select("*")
      .eq("id", intakeId)
      .single();

    if (fetchErr || !submission) {
      return new Response(JSON.stringify({ error: "Submission not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update status to processing
    await supabase
      .from("document_intake_submissions")
      .update({ status: "processing" })
      .eq("id", intakeId);

    // Download the file from storage
    let fileContent = "";
    if (submission.file_path) {
      const { data: fileData } = await supabase.storage
        .from("intake-documents")
        .download(submission.file_path);

      if (fileData) {
        // For text-based files, read as text; for others, note metadata
        const fileType = submission.file_name?.split(".").pop()?.toLowerCase() || "";
        if (["txt", "csv", "json", "xml"].includes(fileType)) {
          fileContent = await fileData.text();
        } else {
          fileContent = `[Binary file: ${submission.file_name}, type: ${fileType}, size: ${fileData.size} bytes]`;
        }
      }
    }

    // Call Lovable AI for extraction
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const systemPrompt = `You are a financial document data extractor. Given document information, extract structured financial data. Return a JSON object via the extract_financial_data tool call.`;

    const userPrompt = `Extract financial data from this document:
File name: ${submission.file_name || "unknown"}
Document type: ${submission.type}
File content/info: ${fileContent.slice(0, 8000)}

Extract: date, amount, vendor_or_donor, description, category_guess (one of: office_supplies, travel, professional_services, grants, donations, salaries, utilities, rent, equipment, other), and transaction_type_guess (one of: expense, income, transfer).`;

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "extract_financial_data",
                description: "Return extracted financial document data",
                parameters: {
                  type: "object",
                  properties: {
                    date: { type: "string", description: "Transaction date in YYYY-MM-DD format" },
                    amount: { type: "number", description: "Total amount" },
                    vendor_or_donor: { type: "string", description: "Vendor or donor name" },
                    description: { type: "string", description: "Brief description" },
                    category_guess: { type: "string" },
                    transaction_type_guess: { type: "string", enum: ["expense", "income", "transfer"] },
                    confidence: { type: "number", description: "Confidence score 0-1" },
                  },
                  required: ["date", "amount", "description", "confidence"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "extract_financial_data" } },
        }),
      }
    );

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const errText = await aiResponse.text();
      console.error("AI gateway error:", status, errText);

      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fallback: set status back to submitted
      await supabase
        .from("document_intake_submissions")
        .update({ status: "submitted" })
        .eq("id", intakeId);

      return new Response(JSON.stringify({ error: "AI extraction failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await aiResponse.json();
    let extractedData: Record<string, unknown> = {};
    let confidence = 0;

    try {
      const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        extractedData = JSON.parse(toolCall.function.arguments);
        confidence = (extractedData.confidence as number) || 0.5;
      }
    } catch {
      extractedData = { raw_response: aiResult.choices?.[0]?.message?.content || "" };
      confidence = 0.1;
    }

    // Save extraction log
    await supabase.from("document_extraction_logs").insert({
      intake_id: intakeId,
      raw_text: fileContent.slice(0, 10000),
      extracted_data_json: extractedData,
      confidence_score: confidence,
    });

    // Update the submission with extracted data
    await supabase
      .from("document_intake_submissions")
      .update({
        extracted_data_json: extractedData,
        status: "pending_review",
      })
      .eq("id", intakeId);

    return new Response(
      JSON.stringify({ success: true, extracted: extractedData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("process-intake-document error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
