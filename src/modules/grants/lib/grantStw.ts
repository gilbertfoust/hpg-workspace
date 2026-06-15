export interface GrantStwNGO {
  id: string;
  name: string;
  region: string;
  mission: string;
  focusAreas: string[];
  annualBudget: string;
  needs: string[];
  differentiators: string[];
}

export interface GrantStwOpportunity {
  id: string;
  name: string;
  funder: string;
  description: string;
  themes: string[];
  region: string;
  amountRange: [string, string];
  deadline: string;
  url: string;
}

export interface GrantAlignmentResult {
  ngo: GrantStwNGO;
  grant: GrantStwOpportunity;
  score: number;
  themeMatches: string[];
  regionMatch: boolean;
  notes: string[];
}

export interface DraftGrantProposal {
  alignment: GrantAlignmentResult;
  content: string;
  filename: string;
}

export const grantStwDemoNgos: GrantStwNGO[] = [
  {
    id: "hpg-01",
    name: "HPG Clean Water Coalition",
    region: "East Africa",
    mission: "Deliver safe water access and hygiene training to rural communities.",
    focusAreas: ["water", "sanitation", "hygiene", "infrastructure"],
    annualBudget: "$1.8M",
    needs: ["borehole drilling", "solar pumps", "behavior change campaigns"],
    differentiators: ["community-led maintenance", "local artisans", "women-led water committees"],
  },
  {
    id: "hpg-02",
    name: "HPG Climate Resilience Network",
    region: "South Asia",
    mission: "Strengthen climate resilience for smallholder farmers through training and finance.",
    focusAreas: ["climate", "agriculture", "livelihoods", "finance"],
    annualBudget: "$2.3M",
    needs: ["drought-resistant seeds", "micro-insurance", "market linkages"],
    differentiators: ["farmer field schools", "mobile agronomy coaching", "impact-linked financing"],
  },
  {
    id: "hpg-03",
    name: "HPG Girls Education Alliance",
    region: "West Africa",
    mission: "Expand access to STEM education for girls through scholarships and mentorship.",
    focusAreas: ["education", "gender", "technology", "scholarships"],
    annualBudget: "$1.2M",
    needs: ["STEM labs", "teacher training", "mentorship networks"],
    differentiators: ["alumnae mentors", "public-private partnerships", "scholar-led community projects"],
  },
];

export const grantStwDemoOpportunities: GrantStwOpportunity[] = [
  {
    id: "grant-usaid-wash",
    name: "USAID WASH Innovation Fund",
    funder: "USAID",
    description: "Supports scalable water, sanitation, and hygiene solutions with strong community engagement and sustainability plans.",
    themes: ["water", "sanitation", "hygiene", "innovation"],
    region: "East Africa",
    amountRange: ["$250k", "$1M"],
    deadline: "2024-10-15",
    url: "https://www.usaid.gov/",
  },
  {
    id: "grant-gates-climate",
    name: "Gates Foundation Climate-Smart Agriculture",
    funder: "Bill & Melinda Gates Foundation",
    description: "Invests in climate adaptation for smallholder farmers, including drought-resistant crops, digital advisory tools, and inclusive finance.",
    themes: ["climate", "agriculture", "finance", "digital"],
    region: "South Asia",
    amountRange: ["$500k", "$2M"],
    deadline: "2024-11-01",
    url: "https://www.gatesfoundation.org/",
  },
  {
    id: "grant-unicef-girls",
    name: "UNICEF Girls in STEM Challenge",
    funder: "UNICEF",
    description: "Funds education initiatives that improve girls' access to STEM resources, teacher training, and community support.",
    themes: ["education", "gender", "technology", "community"],
    region: "West Africa",
    amountRange: ["$150k", "$750k"],
    deadline: "2024-12-05",
    url: "https://www.unicef.org/",
  },
];

const normalizeTokens = (values: string[]) => {
  const tokens = new Map<string, number>();
  values.forEach((value) => {
    value
      .toLowerCase()
      .replace(/\//g, " ")
      .split(/\s+/)
      .map((token) => token.replace(/[,.;:()[\]{}]/g, "").trim())
      .filter(Boolean)
      .forEach((token) => tokens.set(token, (tokens.get(token) || 0) + 1));
  });
  return tokens;
};

const intersectionCount = (left: Map<string, number>, right: Map<string, number>) => {
  let count = 0;
  left.forEach((value, key) => {
    if (right.has(key)) count += Math.min(value, right.get(key) || 0);
  });
  return count;
};

export const scoreGrantAlignment = (ngo: GrantStwNGO, grant: GrantStwOpportunity): GrantAlignmentResult => {
  const ngoTokens = normalizeTokens([...ngo.focusAreas, ...ngo.needs, ngo.mission]);
  const grantTokens = normalizeTokens([...grant.themes, grant.description]);
  const themeMatches = grant.themes.filter((theme) => ngoTokens.has(theme.toLowerCase()));
  const overlapScore = themeMatches.length;
  const regionMatch = ngo.region.toLowerCase() === grant.region.toLowerCase();
  const regionScore = regionMatch ? 0.5 : 0;
  const descriptionScore = Math.min(intersectionCount(ngoTokens, grantTokens) * 0.1, 1);
  const score = overlapScore + regionScore + descriptionScore;

  const notes: string[] = [];
  if (themeMatches.length) notes.push(`Matches themes: ${themeMatches.join(", ")}`);
  if (regionMatch) notes.push("Operates in the target region");
  if (descriptionScore > 0) notes.push("Mission language overlaps grant description");

  return { ngo, grant, score, themeMatches, regionMatch, notes };
};

export const alignGrantOpportunities = (
  ngos: GrantStwNGO[],
  grants: GrantStwOpportunity[],
  options?: { minScore?: number; requireRegionMatch?: boolean; requiredTheme?: string }
) => {
  const requiredTheme = options?.requiredTheme?.toLowerCase().trim();
  return ngos
    .flatMap((ngo) => grants.map((grant) => scoreGrantAlignment(ngo, grant)))
    .filter((result) => result.score >= (options?.minScore || 0))
    .filter((result) => !options?.requireRegionMatch || result.regionMatch)
    .filter((result) => !requiredTheme || result.grant.themes.map((theme) => theme.toLowerCase()).includes(requiredTheme))
    .sort((a, b) => b.score - a.score);
};

export const buildGrantDraft = (alignment: GrantAlignmentResult): DraftGrantProposal => {
  const { ngo, grant } = alignment;
  const content = `# ${grant.name}\n\n**Funder:** ${grant.funder}\n**Deadline:** ${grant.deadline}\n**Amount Range:** ${grant.amountRange[0]} - ${grant.amountRange[1]}\n**URL:** ${grant.url}\n\n## Cover Letter\nDear ${grant.funder} Team,\n\nOn behalf of ${ngo.name}, we are pleased to submit our proposal for ${grant.name}. Our organization operates in ${ngo.region} and focuses on ${ngo.focusAreas.join(", ")}. We see strong alignment with your priorities of ${grant.themes.join(", ")} and look forward to partnering to scale our impact.\n\n## Organizational Summary\n${ngo.name} is an HPG member organization with an annual budget of ${ngo.annualBudget}. Our mission is: "${ngo.mission}". We specialize in ${ngo.differentiators.join(", ")}.\n\n## Problem Statement\nCommunities in ${ngo.region} face persistent challenges related to ${ngo.needs.join(", ")}. Without investment, these barriers will limit equitable progress toward the Sustainable Development Goals.\n\n## Proposed Activities & Milestones\n- Launch an inception workshop with local partners to confirm needs.\n- Implement core activities around ${ngo.focusAreas.join(", ")} tailored to the grant's emphasis on ${grant.themes.join(", ")}.\n- Stand up monitoring systems and community feedback loops to adapt in real time.\n- Share learnings with HPG peers to multiply impact.\n\n## Measurement & Learning\nWe will track reach, outcome adoption, and sustainability. Example KPIs include number of households served, percentage improvement against the baseline, and cost per beneficiary. We will generate quarterly learning briefs for the funder.\n\n## Budget Snapshot\nRequested support: ${grant.amountRange[0]} - ${grant.amountRange[1]}. Funds will prioritize frontline delivery, local staffing, community governance, and third-party evaluation.\n\n## Attachments to Prepare\n- Board roster and bios\n- Audited financials\n- Letters of support from community partners\n- Workplan Gantt chart\n`;

  return {
    alignment,
    content,
    filename: `${ngo.id}__${grant.id}.md`,
  };
};

export const buildTopGrantDrafts = (alignments: GrantAlignmentResult[], maxResults = 5) =>
  alignments.slice(0, maxResults).map(buildGrantDraft);
