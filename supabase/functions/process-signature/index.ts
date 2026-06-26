import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    const { token, signature_data, signature_placement, signer_caption } = await req.json();

    if (!token || !signature_data) {
      return new Response(
        JSON.stringify({ error: "Missing token or signature data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get signing request by token
    const { data: requests, error: fetchError } = await supabase.rpc(
      "get_signing_request_by_token",
      { request_token: token }
    );

    if (fetchError || !requests || requests.length === 0) {
      return new Response(
        JSON.stringify({ error: "Signing request not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const signingRequest = requests[0];

    if (signingRequest.status !== "pending") {
      return new Response(
        JSON.stringify({ error: "This document has already been signed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new Date(signingRequest.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "This signing link has expired" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Download original PDF
    const { data: pdfData, error: downloadError } = await supabase.storage
      .from("esign-documents")
      .download(signingRequest.storage_path);

    if (downloadError || !pdfData) {
      return new Response(
        JSON.stringify({ error: "Failed to download original PDF" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use pdf-lib to add signature
    const { PDFDocument, rgb, StandardFonts } = await import(
      "https://esm.sh/pdf-lib@1.17.1"
    );

    const pdfBytes = await pdfData.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const pageIndex =
      typeof signature_placement?.pageIndex === "number"
        ? Math.max(0, Math.min(pages.length - 1, signature_placement.pageIndex))
        : pages.length - 1;
    const targetPage = pages[pageIndex];
    const { height: pageHeight } = targetPage.getSize();

    // Decode signature image from data URL
    const signatureBase64 = signature_data.split(",")[1];
    const signatureBytes = Uint8Array.from(atob(signatureBase64), (c) =>
      c.charCodeAt(0)
    );
    const signatureImage = await pdfDoc.embedPng(signatureBytes);

    const sigWidth = signature_placement?.width ?? 200;
    const sigHeight =
      signature_placement?.height ??
      (signatureImage.height / signatureImage.width) * sigWidth;
    const sigX = signature_placement?.x ?? 50;
    const sigY =
      signature_placement?.y != null
        ? pageHeight - signature_placement.y - sigHeight
        : 80;

    targetPage.drawImage(signatureImage, {
      x: sigX,
      y: sigY,
      width: sigWidth,
      height: sigHeight,
    });

    // Add text line with signer name and date
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const signedDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const caption =
      signer_caption ||
      `Signed by ${signingRequest.signer_name} on ${signedDate}`;
    targetPage.drawText(caption, {
      x: sigX,
      y: Math.max(20, sigY - 14),
      size: 10,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });

    const signedPdfBytes = await pdfDoc.save();

    // Upload signed PDF
    const signedPath = `signed/${signingRequest.id}/${signingRequest.original_filename}`;
    const { error: uploadError } = await supabase.storage
      .from("esign-signed-documents")
      .upload(signedPath, signedPdfBytes, {
        contentType: "application/pdf",
      });

    if (uploadError) {
      return new Response(
        JSON.stringify({ error: "Failed to upload signed PDF" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get signer IP
    const signerIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";

    // Update signing request
    await supabase
      .from("signing_requests")
      .update({
        status: "signed",
        signed_at: new Date().toISOString(),
        signer_ip: signerIp,
      })
      .eq("id", signingRequest.id);

    // Insert signed document record
    await supabase
      .from("signed_documents")
      .insert({
        signing_request_id: signingRequest.id,
        storage_path: signedPath,
      });

    // Fetch requester email for notification routing
    let requesterEmail: string | null = null;
    if (signingRequest.created_by_user_id) {
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", signingRequest.created_by_user_id)
        .single();
      requesterEmail = profileRow?.email ?? null;
    }

    // Send notification (fire and forget)
    try {
      await fetch(`${supabaseUrl}/functions/v1/send-signed-notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          document_name: signingRequest.original_filename,
          signer_name: signingRequest.signer_name,
          signer_email: signingRequest.signer_email,
          signed_at: new Date().toISOString(),
          signer_ip: signerIp,
          requester_email: requesterEmail,
        }),
      });
    } catch (notifError) {
      console.error("Failed to send notification:", notifError);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing signature:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
