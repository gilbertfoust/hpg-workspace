import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FSA_INTAKE_CHECKLIST = [
  { label: "Log intake: source (email/form/referral) + date received", checked: false },
  { label: "Create/confirm Drive folder link is on the card", checked: false },
  { label: "Complete Roles block (names): EAO (pre-sign), IDF, GC, Program Lead, Finance Lead, Dev Lead", checked: false },
  { label: "Send acknowledgement email (template) + record date sent", checked: false },
  { label: "Application Received", checked: false },
  { label: "Create Pre-Due Diligence Report", checked: false },
  { label: "Request availability / send scheduling link + track response", checked: false },
  { label: "Schedule meeting + calendar invite sent + meeting link pasted to card", checked: false },
  { label: "Agenda/pre-reads link added to card", checked: false },
  { label: "Meeting held: notes link posted + summary decision (proceed / pause / decline)", checked: false },
  { label: "If pause/decline: move to correct list + record reason (neutral)", checked: false },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    const { org_name, contact_name, contact_email, contact_phone, ein, mission, country, projected_budget } = body;

    if (!org_name || typeof org_name !== "string" || org_name.trim().length === 0) {
      return new Response(JSON.stringify({ error: "org_name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!contact_name || typeof contact_name !== "string") {
      return new Response(JSON.stringify({ error: "contact_name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Create NGO as prospect
    const { data: ngo, error: ngoError } = await supabase
      .from("ngos")
      .insert({
        legal_name: org_name.trim(),
        common_name: org_name.trim(),
        status: "prospect",
        country: country || null,
        ein: ein || null,
        mission: mission || null,
      })
      .select("id")
      .single();

    if (ngoError) throw ngoError;

    // Create contact
    const { error: contactError } = await supabase.from("contacts").insert({
      name: contact_name.trim(),
      email: contact_email || null,
      phone: contact_phone || null,
      ngo_id: ngo.id,
      is_primary: true,
    });

    if (contactError) throw contactError;

    // Create G1 Intake work item with checklist
    const { error: wiError } = await supabase.from("work_items").insert({
      title: `G1 - Application Meeting Intake — ${org_name.trim()}`,
      description: `Initial FSA intake for ${org_name.trim()}. Contact: ${contact_name.trim()}.`,
      module: "ngo_coordination",
      ngo_id: ngo.id,
      type: "NGO Onboarding",
      status: "not_started",
      priority: "medium",
      checklist_json: FSA_INTAKE_CHECKLIST,
    });

    if (wiError) throw wiError;

    // If budget included, create finance work item for onboarding fee
    if (projected_budget && typeof projected_budget === "number" && projected_budget > 0) {
      const fee = Math.round(projected_budget * 0.1 * 100) / 100;
      await supabase.from("work_items").insert({
        title: `G2 - Finance Processing — ${org_name.trim()}`,
        description: `Onboarding fee: $${fee.toLocaleString()} (10% of $${projected_budget.toLocaleString()} projected budget).`,
        module: "finance",
        ngo_id: ngo.id,
        type: "NGO Onboarding",
        status: "not_started",
        priority: "medium",
        checklist_json: [
          { label: "Fee amount confirmed (or waiver attached)", checked: false },
          { label: "Billing contact verified", checked: false },
          { label: "Send link for onboarding fee", checked: false },
          { label: "Payment received/cleared OR waiver/deferral logged", checked: false },
          { label: "Invoice recorded (invoice #, date)", checked: false },
          { label: "Confirm Receipt/confirmation sent to NGO", checked: false },
          { label: "Finance 'Release Contract' confirmation posted", checked: false },
        ],
      });
    }

    return new Response(JSON.stringify({ ngo_id: ngo.id, status: "created" }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
