import type { PartnershipPipelineRecordWithPartner } from "@/hooks/usePartnershipsPipeline";

export type PartnershipPipelineStage =
  | "Prospect"
  | "Discovery"
  | "Negotiation"
  | "MOU Drafting"
  | "Active"
  | "Dormant";

export interface PartnershipPipelineItem {
  id: string;
  stage: PartnershipPipelineStage;
  partnerName: string;
  partnerType?: string | null;
  region?: string | null;
  status?: string | null;
  primaryContact?: string | null;
  ngoName?: string | null;
  ngoBundle?: string | null;
  notes?: string | null;
  keyCommitments?: string | null;
  record: PartnershipPipelineRecordWithPartner;
}
