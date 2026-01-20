import type { DevelopmentOpportunityWithFunder } from "@/hooks/useDevelopmentOpportunities";
import type { DevelopmentProposalWithRelations } from "@/hooks/useDevelopmentProposals";

export type DevelopmentPipelineStage =
  | "Identified"
  | "Qualified"
  | "Drafting"
  | "Submitted"
  | "Awarded"
  | "Declined";

export interface DevelopmentPipelineItem {
  id: string;
  title: string;
  stage: DevelopmentPipelineStage;
  funderName?: string;
  amount?: number | null;
  loiDue?: string | null;
  proposalDue?: string | null;
  deadline?: string | null;
  ngoName?: string | null;
  ngoBundle?: string | null;
  source: "proposal" | "opportunity";
  proposal?: DevelopmentProposalWithRelations | null;
  opportunity?: DevelopmentOpportunityWithFunder | null;
}
