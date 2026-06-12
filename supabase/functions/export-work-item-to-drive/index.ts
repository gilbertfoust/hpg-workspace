import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const internalRoles = new Set([
  "staff",
  "super_admin",
  "admin_pm",
  "ngo_coordinator",
  "department_lead",
  "executive_secretariat",
]);

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(value: unknown) {
  return String(value ?? "—")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value: unknown) {
  if (!value || typeof value !== "string") return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 120) || "work_item";
}

async function requireInternalCaller(req: Request, supabase: ReturnType<typeof createClient>) {
  const authorization = req.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();

  if (!token) return { allowed: false, status: 401, reason: "Authentication required." };

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return { allowed: false, status: 401, reason: "Authentication could not be verified." };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile || !internalRoles.has(profile.role)) {
    return { allowed: false, status: 403, reason: "Internal staff access is required." };
  }

  return { allowed: true, status: 200, reason: "Authorized." };
}

function buildWorkItemHtml(workItem: Record<string, unknown>, department: Record<string, unknown> | null, ngo: Record<string, unknown> | null) {
  const title = escapeHtml(workItem.title || "Completed Work Item");
  const departmentName = escapeHtml(department?.name || workItem.module || "Unassigned Department");
  const ngoName = escapeHtml(ngo?.common_name || ngo?.legal_name || "No NGO linked");

  const rows = [
    ["Status", workItem.status],
    ["Priority", workItem.priority],
    ["Type", workItem.type],
    ["Department", departmentName],
    ["Module", workItem.module],
    ["NGO", ngoName],
    ["Due Date", workItem.due_date],
    ["Completed At", formatDate(workItem.completed_at || workItem.updated_at)],
    ["Work Item ID", workItem.id],
  ];

  const details = rows.map(([label, value]) => `
    <tr>
      <th>${escapeHtml(label)}</th>
      <td>${typeof value === "string" && value.includes("&") ? value : escapeHtml(value)}</td>
    </tr>
  `).join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #172033; margin: 40px; line-height: 1.5; }
    .eyebrow { color: #64748b; font-size: 12px; letter-spacing: .12em; text-transform: uppercase; }
    h1 { margin: 8px 0 4px; font-size: 28px; }
    .subtitle { color: #475569; margin-bottom: 28px; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0 28px; }
    th { width: 220px; background: #f1f5f9; text-align: left; }
    th, td { border: 1px solid #cbd5e1; padding: 10px 12px; vertical-align: top; }
    .section { margin-top: 28px; }
    .box { border: 1px solid #cbd5e1; background: #f8fafc; padding: 16px; border-radius: 8px; white-space: pre-wrap; }
    .footer { margin-top: 36px; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="eyebrow">Humanity Pathways Global · Completed Work Item Archive</div>
  <h1>${title}</h1>
  <p class="subtitle">Archived for ${departmentName}${ngoName !== "No NGO linked" ? ` · ${ngoName}` : ""}</p>
  <table>${details}</table>
  <div class="section">
    <h2>Description</h2>
    <div class="box">${escapeHtml(workItem.description || "No description recorded.")}</div>
  </div>
  <div class="footer">Generated from HPG Workspace on ${escapeHtml(new Date().toLocaleString("en-US"))}.</div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Use POST." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const driveAccessToken = Deno.env.get("GOOGLE_DRIVE_ACCESS_TOKEN");

    if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: "Server configuration missing." }, 500);

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const caller = await requireInternalCaller(req, supabase);
    if (!caller.allowed) return jsonResponse({ error: caller.reason }, caller.status);

    const body = await req.json().catch(() => ({}));
    const workItemId = typeof body.work_item_id === "string" ? body.work_item_id : "";
    if (!workItemId) return jsonResponse({ error: "work_item_id is required." }, 400);

    const { data: workItem, error: workItemError } = await supabase
      .from("work_items")
      .select("*")
      .eq("id", workItemId)
      .maybeSingle();
    if (workItemError) throw workItemError;
    if (!workItem) return jsonResponse({ error: "Work item not found." }, 404);

    if (workItem.status !== "complete" && workItem.status !== "approved") {
      return jsonResponse({ error: "Only completed or approved work items can be exported to Drive." }, 400);
    }

    const { data: department } = await supabase
      .from("departments")
      .select("id, name, module, google_drive_folder_id, google_drive_folder_url")
      .eq("id", workItem.department_id)
      .maybeSingle();

    if (!department?.google_drive_folder_id) {
      return jsonResponse({ skipped: true, reason: "No Google Drive folder is configured for this department." }, 200);
    }

    if (!driveAccessToken) {
      return jsonResponse({ skipped: true, reason: "GOOGLE_DRIVE_ACCESS_TOKEN has not been installed on the server." }, 200);
    }

    let ngo: Record<string, unknown> | null = null;
    if (workItem.ngo_id) {
      const { data } = await supabase
        .from("ngos")
        .select("id, legal_name, common_name")
        .eq("id", workItem.ngo_id)
        .maybeSingle();
      ngo = data;
    }

    const html = buildWorkItemHtml(workItem, department, ngo);
    const fileName = `${safeFileName(`${department.name}_${workItem.title}`)}_${new Date().toISOString().slice(0, 10)}.html`;
    const metadata = {
      name: fileName,
      mimeType: "application/vnd.google-apps.document",
      parents: [department.google_drive_folder_id],
    };

    const boundary = `hpg_${crypto.randomUUID()}`;
    const multipartBody = [
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      JSON.stringify(metadata),
      `--${boundary}`,
      "Content-Type: text/html; charset=UTF-8",
      "",
      html,
      `--${boundary}--`,
      "",
    ].join("\r\n");

    const upload = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${driveAccessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    });

    const result = await upload.json().catch(() => ({}));
    if (!upload.ok) {
      return jsonResponse({ error: `Google Drive export failed: ${JSON.stringify(result).slice(0, 300)}` }, 502);
    }

    const { error: updateError } = await supabase
      .from("work_items")
      .update({
        google_drive_file_id: result.id,
        google_drive_file_url: result.webViewLink,
        google_drive_exported_at: new Date().toISOString(),
      })
      .eq("id", workItem.id);
    if (updateError) throw updateError;

    return jsonResponse({ file_id: result.id, file_url: result.webViewLink });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
