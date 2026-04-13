import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.49.1/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    const { full_name, email, phone, role_applied_for, department, hours_committing, location_timezone, personal_email, notes } = body;

    if (!full_name || typeof full_name !== "string" || full_name.trim().length === 0) {
      return new Response(JSON.stringify({ error: "full_name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Create applicant at Newly Received stage
    const { data: applicant, error: appError } = await supabase
      .from("applicants")
      .insert({
        full_name: full_name.trim(),
        email: email || null,
        phone: phone || null,
        role_applied_for: role_applied_for || null,
        stage: "Newly Received",
        department: department || null,
        hours_committing: hours_committing || null,
        location_timezone: location_timezone || null,
        personal_email: personal_email || null,
        notes: notes || null,
      })
      .select("id")
      .single();

    if (appError) throw appError;

    // Create HR screening work item
    const { error: wiError } = await supabase.from("work_items").insert({
      title: `HR Screening — ${full_name.trim()}`,
      description: `New volunteer application received. Conduct eligibility check, confirm tool readiness, and verify availability.`,
      module: "hr",
      type: "recruitment",
      status: "not_started",
      priority: "medium",
      checklist_json: [
        { label: "Acknowledge receipt and send welcome message with expected timeline", checked: false },
        { label: "Conduct basic eligibility check for availability, language, and internet or device access", checked: false },
        { label: "Confirm role interest and department preference", checked: false },
        { label: "Confirm weekly hours range and schedule windows", checked: false },
        { label: "Confirm time zone", checked: false },
        { label: "Add labels (Needs Reply, Missing Docs, Urgent) as needed", checked: false },
        { label: "If information is missing, request it and add the Needs Reply label", checked: false },
      ],
    });

    if (wiError) throw wiError;

    return new Response(JSON.stringify({ applicant_id: applicant.id, status: "created" }), {
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
