import type { NGO } from "@/hooks/useNGOs";
import type { ModuleType, WorkItem } from "@/hooks/useWorkItems";

export type AssistantRiskLevel = "low" | "medium" | "high";

export interface AssistantDocumentGap {
  label: string;
  source: "required_checklist" | "work_item";
  ownerModule: ModuleType | "ngo_coordination";
  reason: string;
}

export interface AssistantDepartmentTask {
  department: string;
  module: ModuleType;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
}

export interface AssistantRiskFlag {
  level: AssistantRiskLevel;
  category: string;
  description: string;
  recommendedAction: string;
}

export interface AssistantPacket {
  ngoId: string;
  displayName: string;
  location: string;
  sponsorshipModel: string;
  currentStatus: string;
  handoffReady: boolean;
  readinessReasons: string[];
  blockers: string[];
  documentsMissing: AssistantDocumentGap[];
  departmentChecklist: AssistantDepartmentTask[];
  riskFlags: AssistantRiskFlag[];
  firstThirtyDayActions: string[];
  introEmail: {
    subject: string;
    body: string;
  };
  cabinetSummary: string;
  mcpContext: {
    toolName: string;
    recommendedNextConnectorAction: string;
    safeToAutomate: boolean;
  };
}

const COMPLETED_STATUSES = new Set(["complete", "approved"]);
const OPEN_STATUSES = new Set([
  "draft",
  "not_started",
  "in_progress",
  "waiting_on_ngo",
  "waiting_on_hpg",
  "submitted",
  "under_review",
]);

const REQUIRED_DOCUMENT_KEYWORDS = [
  { label: "Registration / incorporation documentation", keywords: ["registration", "ein", "501", "aoi", "incorporation"] },
  { label: "Operating agreement, bylaws, or constitution", keywords: ["operating agreement", "bylaws", "constitution"] },
  { label: "Board roster and leadership context", keywords: ["board", "roster", "leadership"] },
  { label: "Mission, vision, and project outline", keywords: ["mission", "vision", "project outline", "program proposal"] },
  { label: "Projected budget or current operating budget", keywords: ["budget", "projected budget"] },
  { label: "Community assessment or needs statement", keywords: ["community assessment", "needs assessment"] },
  { label: "Photo/video evidence for fundraising review", keywords: ["photo", "video", "footage", "media"] },
];

export const POST_CONTRACT_DEPARTMENT_TASKS: AssistantDepartmentTask[] = [
  {
    department: "NGO Coordination",
    module: "ngo_coordination",
    title: "Send NGO Coordination introduction email",
    description: "Introduce NGO Coordination as the liaison, explain routing, request missing documents, and schedule the first onboarding meeting.",
    priority: "high",
  },
  {
    department: "Finance",
    module: "finance",
    title: "Confirm post-contract bookkeeping setup",
    description: "Confirm payment/fee status, budget readiness, chart of accounts setup needs, and reporting expectations for funds handled by HPG.",
    priority: "high",
  },
  {
    department: "Compliance / General Counsel",
    module: "legal",
    title: "Review governance and compliance readiness",
    description: "Review registration documents, governance materials, sanctions/background notes, reporting obligations, and remaining legal/compliance questions.",
    priority: "high",
  },
  {
    department: "Program Department",
    module: "program",
    title: "Confirm program deliverables and impact framework",
    description: "Translate the NGO's project description into deliverables, outcomes, evidence requirements, and a reporting-ready impact structure.",
    priority: "medium",
  },
  {
    department: "Development",
    module: "development",
    title: "Assess funder-readiness",
    description: "Review the NGO's story, budget, community need, and documentation to determine whether grant research or donor packet drafting can begin.",
    priority: "medium",
  },
  {
    department: "Communications",
    module: "communications",
    title: "Prepare approved public narrative",
    description: "Draft or review the NGO's public-facing description and verify that claims are evidence-supported before donor or campaign use.",
    priority: "medium",
  },
  {
    department: "Marketing",
    module: "marketing",
    title: "Hold campaign materials until narrative approval",
    description: "Identify campaign concepts but do not publish materials until Communications, Development, and Finance approve the underlying narrative and budget.",
    priority: "low",
  },
  {
    department: "Technology",
    module: "it",
    title: "Prepare workspace and access setup",
    description: "Confirm Drive folder, portal access, document upload path, Slack/communication spaces, and any future HPG Workstation permissions.",
    priority: "medium",
  },
  {
    department: "Executive Secretariat",
    module: "administration",
    title: "Schedule first onboarding touchpoints",
    description: "Help schedule the NGO onboarding meeting, collect agenda items, and keep the Cabinet-ready status record updated.",
    priority: "medium",
  },
];

function normalize(value?: string | null) {
  return (value || "").toLowerCase();
}

function displayFiscalType(value?: string | null) {
  if (!value) return "Not specified";
  if (value === "model_a") return "Model A";
  if (value === "model_c") return "Model C";
  if (value === "other") return "Other";
  return value;
}

function workItemsForNgo(workItems: WorkItem[], ngoId: string) {
  return workItems.filter((item) => item.ngo_id === ngoId);
}

function isDone(item: WorkItem) {
  return COMPLETED_STATUSES.has(item.status);
}

function isOpen(item: WorkItem) {
  return OPEN_STATUSES.has(item.status);
}

function titleIncludes(item: WorkItem, terms: string[]) {
  const haystack = `${item.title || ""} ${item.description || ""}`.toLowerCase();
  return terms.some((term) => haystack.includes(term));
}

function formatLocation(ngo: NGO) {
  return [ngo.city, ngo.state_province, ngo.country].filter(Boolean).join(", ") || "Location not recorded";
}

function findDocumentGaps(ngoItems: WorkItem[]): AssistantDocumentGap[] {
  const text = ngoItems.map((item) => `${item.title} ${item.description || ""} ${JSON.stringify(item.checklist_json || "")}`).join(" ").toLowerCase();

  const checklistGaps = REQUIRED_DOCUMENT_KEYWORDS.filter((doc) => !doc.keywords.some((keyword) => text.includes(keyword))).map((doc) => ({
    label: doc.label,
    source: "required_checklist" as const,
    ownerModule: "ngo_coordination" as const,
    reason: "This required readiness item was not clearly found in the current onboarding work items.",
  }));

  const workItemGaps = ngoItems
    .filter((item) => item.evidence_required && item.evidence_status === "missing")
    .map((item) => ({
      label: item.title,
      source: "work_item" as const,
      ownerModule: (item.module || "ngo_coordination") as ModuleType,
      reason: "This work item explicitly requires evidence and is marked missing.",
    }));

  const waitingOnNgoGaps = ngoItems
    .filter((item) => item.status === "waiting_on_ngo" && titleIncludes(item, ["document", "docs", "evidence", "budget", "registration", "contract", "signature"]))
    .map((item) => ({
      label: item.title,
      source: "work_item" as const,
      ownerModule: (item.module || "ngo_coordination") as ModuleType,
      reason: "This item is waiting on the NGO and appears documentation-related.",
    }));

  const deduped = new Map<string, AssistantDocumentGap>();
  [...workItemGaps, ...waitingOnNgoGaps, ...checklistGaps].forEach((gap) => {
    if (!deduped.has(gap.label)) deduped.set(gap.label, gap);
  });

  return Array.from(deduped.values());
}

function buildRiskFlags(ngo: NGO, ngoItems: WorkItem[], documentGaps: AssistantDocumentGap[]): AssistantRiskFlag[] {
  const flags: AssistantRiskFlag[] = [];
  const now = new Date();

  const urgentOpen = ngoItems.filter((item) => item.priority === "urgent" && isOpen(item));
  if (urgentOpen.length > 0) {
    flags.push({
      level: "high",
      category: "Operational",
      description: `${urgentOpen.length} urgent onboarding item(s) remain open.`,
      recommendedAction: "Escalate these items to the owning department before marking the NGO as fully onboarded.",
    });
  }

  const overdueItems = ngoItems.filter((item) => item.due_date && isOpen(item) && new Date(item.due_date) < now);
  if (overdueItems.length > 0) {
    flags.push({
      level: "medium",
      category: "Timeline",
      description: `${overdueItems.length} open item(s) appear overdue.`,
      recommendedAction: "Have the Executive Secretariat or NGO Coordinator update due dates, owners, and blocker notes.",
    });
  }

  if (documentGaps.length > 3) {
    flags.push({
      level: "medium",
      category: "Documentation",
      description: `${documentGaps.length} document or evidence gaps may delay funder-readiness.`,
      recommendedAction: "Send a consolidated missing-document request rather than scattered department-by-department emails.",
    });
  }

  if (ngo.status === "at_risk") {
    flags.push({
      level: "high",
      category: "Relationship",
      description: "The NGO record is currently marked at risk.",
      recommendedAction: "Request leadership review before further fundraising, public messaging, or onboarding completion.",
    });
  }

  return flags;
}

function buildIntroEmail(ngo: NGO, gaps: AssistantDocumentGap[]) {
  const displayName = ngo.common_name || ngo.legal_name;
  const contactLine = "Dear [Primary Contact],";
  const missingList = gaps.length
    ? gaps.slice(0, 8).map((gap) => `- ${gap.label}`).join("\n")
    : "- No major missing documents are currently flagged in the workspace.";

  return {
    subject: `Introduction to HPG NGO Coordination — ${displayName}`,
    body: `${contactLine}\n\nThank you for continuing forward with Humanity Pathways Global. At this stage, the NGO Coordination Department will serve as your primary liaison for onboarding, document collection, reporting preparation, and routing questions to the appropriate HPG departments.\n\nThis structure helps Finance, Compliance, Development, Program, Communications, Technology, and the Executive Secretariat work from one coordinated record rather than separate conversations.\n\nBased on the current workspace record, the next items we should confirm or collect are:\n\n${missingList}\n\nWe will also begin preparing your onboarding meeting, reporting expectations, and department-specific setup steps. Please send any available program photos, video footage, community assessment materials, updated budgets, and governance documents through the approved document channel so HPG can review them for internal readiness and possible funder-facing use.\n\nPlease note that donor-facing language, fundraising claims, budgets, and public materials must be reviewed internally before they are used externally.\n\nRespectfully,\nHPG NGO Coordination Department`,
  };
}

function buildCabinetSummary(ngo: NGO, ngoItems: WorkItem[], handoffReady: boolean, gaps: AssistantDocumentGap[], flags: AssistantRiskFlag[]) {
  const displayName = ngo.common_name || ngo.legal_name;
  const done = ngoItems.filter(isDone).length;
  const open = ngoItems.filter(isOpen).length;
  const status = handoffReady ? "appears ready for post-contract NGO Coordination onboarding" : "is not fully ready for post-contract handoff based on the current workspace record";

  return `${displayName} ${status}. Current status is ${ngo.status}; sponsorship model is ${displayFiscalType(ngo.fiscal_type)}; location is ${formatLocation(ngo)}. The workspace shows ${done} completed onboarding-related item(s) and ${open} open item(s). There are ${gaps.length} document/evidence gap(s) and ${flags.length} risk flag(s) requiring review. Recommended executive posture: keep this NGO in structured onboarding, have NGO Coordination consolidate communication, and route department-specific actions through the workspace rather than separate inbox threads.`;
}

export function buildAssistantPacket(ngo: NGO, workItems: WorkItem[]): AssistantPacket {
  const ngoItems = workItemsForNgo(workItems, ngo.id);
  const displayName = ngo.common_name || ngo.legal_name;

  const financeDone = ngoItems.some((item) => titleIncludes(item, ["finance", "fee", "payment"]) && isDone(item));
  const contractDone = ngoItems.some((item) => titleIncludes(item, ["contract", "signature", "signed"]) && isDone(item));
  const onboardingItems = ngoItems.filter((item) => item.type === "NGO Onboarding");
  const completedOnboardingCount = onboardingItems.filter(isDone).length;
  const statusImpliesHandoff = ngo.status === "active" || (ngo.status === "onboarding" && completedOnboardingCount >= 8);
  const handoffReady = statusImpliesHandoff || (financeDone && contractDone);

  const readinessReasons = [
    financeDone ? "Finance/payment-related onboarding item is complete." : "Finance/payment completion is not clearly confirmed in the workspace.",
    contractDone ? "Contract/signature-related onboarding item is complete." : "Contract execution is not clearly confirmed in the workspace.",
    statusImpliesHandoff ? "NGO status and onboarding progress suggest department onboarding can begin." : "NGO status does not yet prove department onboarding readiness.",
  ];

  const blockers = readinessReasons.filter((reason) => reason.includes("not clearly") || reason.includes("does not yet"));
  const documentsMissing = findDocumentGaps(ngoItems);
  const riskFlags = buildRiskFlags(ngo, ngoItems, documentsMissing);
  const introEmail = buildIntroEmail(ngo, documentsMissing);
  const cabinetSummary = buildCabinetSummary(ngo, ngoItems, handoffReady, documentsMissing, riskFlags);

  return {
    ngoId: ngo.id,
    displayName,
    location: formatLocation(ngo),
    sponsorshipModel: displayFiscalType(ngo.fiscal_type),
    currentStatus: ngo.status,
    handoffReady,
    readinessReasons,
    blockers,
    documentsMissing,
    departmentChecklist: POST_CONTRACT_DEPARTMENT_TASKS,
    riskFlags,
    firstThirtyDayActions: [
      "Send NGO Coordination introduction email after human review.",
      "Collect or clarify all missing documents through one consolidated request.",
      "Schedule the first NGO Coordination onboarding meeting.",
      "Confirm Finance setup: payment record, budget review, bookkeeping expectations, and reporting cadence.",
      "Confirm Compliance/General Counsel review of registration, governance, and risk items.",
      "Prepare a funder-readiness note for Development after documents are reviewed.",
      "Prepare approved public narrative only after Communications verifies claims and evidence.",
      "Create or confirm workspace, Drive, and portal access through Technology.",
    ],
    introEmail,
    cabinetSummary,
    mcpContext: {
      toolName: "generate_onboarding_packet",
      recommendedNextConnectorAction: "Expose this same packet builder through a future private MCP tool once backend service credentials are available.",
      safeToAutomate: false,
    },
  };
}

export function buildAllAssistantPackets(ngos: NGO[], workItems: WorkItem[]) {
  return ngos.map((ngo) => buildAssistantPacket(ngo, workItems));
}
