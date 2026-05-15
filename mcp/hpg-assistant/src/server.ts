import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

type WorkItem = {
  id: string;
  title: string;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
  module?: string | null;
  ngo_id?: string | null;
  evidence_required?: boolean | null;
  evidence_status?: string | null;
  due_date?: string | null;
};

type Ngo = {
  id: string;
  legal_name: string;
  common_name?: string | null;
  status?: string | null;
  fiscal_type?: string | null;
  city?: string | null;
  state_province?: string | null;
  country?: string | null;
};

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. MCP server must run server-side only.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const server = new McpServer({
  name: "hpg-assistant-mcp",
  version: "0.1.0",
});

function formatLocation(ngo: Ngo) {
  return [ngo.city, ngo.state_province, ngo.country].filter(Boolean).join(", ") || "Location not recorded";
}

function displayFiscalType(value?: string | null) {
  if (!value) return "Not specified";
  if (value === "model_a") return "Model A";
  if (value === "model_c") return "Model C";
  return value;
}

function summarizeReadiness(ngo: Ngo, workItems: WorkItem[]) {
  const haystack = workItems.map((item) => `${item.title} ${item.description || ""} ${item.status || ""}`).join(" ").toLowerCase();
  const contractSignal = haystack.includes("contract") || haystack.includes("signed") || haystack.includes("signature");
  const paymentSignal = haystack.includes("payment") || haystack.includes("fee") || haystack.includes("finance");
  const handoffReady = ngo.status === "active" || (contractSignal && paymentSignal);

  return {
    handoffReady,
    reasons: [
      contractSignal ? "Contract/signature signal found in work items." : "Contract/signature signal not found in work items.",
      paymentSignal ? "Payment/finance signal found in work items." : "Payment/finance signal not found in work items.",
      ngo.status === "active" ? "NGO status is active." : `NGO status is ${ngo.status || "not recorded"}.`,
    ],
  };
}

function missingDocuments(workItems: WorkItem[]) {
  const text = workItems.map((item) => `${item.title} ${item.description || ""}`).join(" ").toLowerCase();
  const required = [
    ["Registration / incorporation documentation", ["registration", "incorporation", "501", "ein"]],
    ["Bylaws, constitution, or operating agreement", ["bylaws", "constitution", "operating agreement"]],
    ["Board roster or leadership list", ["board", "roster", "leadership"]],
    ["Budget", ["budget"]],
    ["Community assessment or needs statement", ["community assessment", "needs assessment"]],
    ["Photo/video evidence for fundraising review", ["photo", "video", "footage", "media"]],
  ] as const;

  return required
    .filter(([, keywords]) => !keywords.some((keyword) => text.includes(keyword)))
    .map(([label]) => label);
}

server.tool(
  "search_ngos",
  "Search HPG Workspace NGOs by name or country. Read-only.",
  {
    query: z.string().min(1),
    limit: z.number().min(1).max(20).optional(),
  },
  async ({ query, limit = 10 }) => {
    const { data, error } = await supabase
      .from("ngos")
      .select("id, legal_name, common_name, status, fiscal_type, city, state_province, country")
      .or(`legal_name.ilike.%${query}%,common_name.ilike.%${query}%,country.ilike.%${query}%`)
      .limit(limit);

    if (error) throw error;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ ngos: data || [] }, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "generate_onboarding_packet",
  "Generate a draft-only NGO Coordination onboarding packet from HPG Workspace data. Does not write records or send emails.",
  {
    ngo_id: z.string().uuid(),
  },
  async ({ ngo_id }) => {
    const { data: ngo, error: ngoError } = await supabase
      .from("ngos")
      .select("id, legal_name, common_name, status, fiscal_type, city, state_province, country")
      .eq("id", ngo_id)
      .single();

    if (ngoError) throw ngoError;

    const { data: workItems, error: workItemsError } = await supabase
      .from("work_items")
      .select("id, title, description, status, priority, module, ngo_id, evidence_required, evidence_status, due_date")
      .eq("ngo_id", ngo_id)
      .order("created_at", { ascending: false });

    if (workItemsError) throw workItemsError;

    const itemList = (workItems || []) as WorkItem[];
    const readiness = summarizeReadiness(ngo as Ngo, itemList);
    const gaps = missingDocuments(itemList);
    const displayName = (ngo as Ngo).common_name || (ngo as Ngo).legal_name;

    const packet = {
      ngoId: ngo_id,
      displayName,
      location: formatLocation(ngo as Ngo),
      sponsorshipModel: displayFiscalType((ngo as Ngo).fiscal_type),
      currentStatus: (ngo as Ngo).status,
      handoffReady: readiness.handoffReady,
      readinessReasons: readiness.reasons,
      documentsMissing: gaps,
      departmentChecklist: [
        "NGO Coordination: Send introduction email, request missing documents, and schedule onboarding meeting.",
        "Finance: Confirm payment record, budget review, and bookkeeping expectations.",
        "Compliance/Legal: Review governance and registration documents.",
        "Program: Confirm program deliverables and impact evidence needs.",
        "Development: Assess funder-readiness after documents are reviewed.",
        "Communications: Prepare public narrative only after claims are verified.",
        "Technology: Confirm workspace, Drive, and portal access path.",
      ],
      introEmailDraft: {
        subject: `Introduction to HPG NGO Coordination — ${displayName}`,
        body: `Dear [Primary Contact],\n\nThank you for continuing forward with Humanity Pathways Global. The NGO Coordination Department will serve as your primary liaison for onboarding, document collection, reporting preparation, and routing questions to the appropriate HPG departments.\n\nBased on the current workspace record, the next missing or unclear items are:\n\n${gaps.map((gap) => `- ${gap}`).join("\n") || "- No major missing items are currently flagged."}\n\nRespectfully,\nHPG NGO Coordination Department`,
      },
      cabinetSummary: `${displayName} is currently marked ${readiness.handoffReady ? "ready" : "not fully ready"} for NGO Coordination onboarding. Workspace status: ${(ngo as Ngo).status || "not recorded"}. Missing document/evidence gaps: ${gaps.length}.`,
      safety: "Draft-only. This tool does not send emails, approve NGOs, update finances, publish donor claims, or change sponsorship status.",
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(packet, null, 2),
        },
      ],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
