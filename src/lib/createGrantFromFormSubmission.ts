import { supabase } from "@/integrations/supabase/client";

/**
 * When a form submission is for a grant suggestion/recommendation,
 * automatically create a grant_application entry in "prospect" stage
 * so it appears on the Grant Pipeline Kanban for research.
 */
export async function createGrantFromFormSubmission(params: {
  formTemplateName: string;
  ngoId?: string | null;
  payloadJson?: Record<string, unknown> | null;
}) {
  const { formTemplateName, ngoId, payloadJson } = params;

  // Only trigger for grant-related form templates
  const nameLC = formTemplateName.toLowerCase();
  const isGrantForm =
    nameLC.includes("grant suggestion") ||
    nameLC.includes("grant recommendation") ||
    nameLC.includes("funding opportunity") ||
    nameLC.includes("grant referral");

  if (!isGrantForm) return null;
  if (!ngoId) return null;

  // Extract grant title from payload
  const title =
    (payloadJson?.grant_name as string) ||
    (payloadJson?.funder_name as string) ||
    (payloadJson?.opportunity_name as string) ||
    (payloadJson?.title as string) ||
    `Grant Suggestion – ${formTemplateName}`;

  const notes = [
    payloadJson?.description && `Description: ${String(payloadJson.description).slice(0, 300)}`,
    payloadJson?.focus_area && `Focus: ${payloadJson.focus_area}`,
    payloadJson?.amount && `Amount: ${payloadJson.amount}`,
    payloadJson?.deadline && `Deadline: ${payloadJson.deadline}`,
    payloadJson?.url && `URL: ${payloadJson.url}`,
    "Auto-created from form submission",
  ]
    .filter(Boolean)
    .join("\n");

  const { data, error } = await supabase
    .from("grant_applications")
    .insert({
      title,
      ngo_id: ngoId,
      stage: "prospect",
      notes,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[createGrantFromFormSubmission] Error:", error);
    return null;
  }

  console.log("[createGrantFromFormSubmission] Created grant application", data.id);
  return data.id;
}
