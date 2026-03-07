export interface GrantSource {
  id: string;
  name: string;
  description: string | null;
  website: string | null;
  funder_type: string;
  country: string | null;
  region: string | null;
  focus_areas: string[];
  min_award: number | null;
  max_award: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GrantOpportunity {
  id: string;
  source_id: string | null;
  title: string;
  description: string | null;
  eligibility_criteria: string | null;
  focus_areas: string[];
  country: string | null;
  region: string | null;
  min_award: number | null;
  max_award: number | null;
  deadline: string | null;
  cycle: string | null;
  status: string;
  url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  grant_sources?: GrantSource | null;
}

export interface GrantApplication {
  id: string;
  opportunity_id: string | null;
  ngo_id: string;
  title: string;
  stage: string;
  amount_requested: number | null;
  amount_awarded: number | null;
  submitted_at: string | null;
  awarded_at: string | null;
  reporting_due_at: string | null;
  closed_at: string | null;
  assigned_user_id: string | null;
  work_item_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  grant_opportunities?: GrantOpportunity | null;
  ngos?: { legal_name: string; common_name: string | null } | null;
  profiles?: { full_name: string | null } | null;
}

export const GRANT_STAGES = [
  "prospect",
  "researching",
  "writing",
  "submitted",
  "under_review",
  "awarded",
  "declined",
  "reporting",
  "closed",
] as const;

export const FUNDER_TYPES = [
  "foundation",
  "government",
  "corporate",
  "bilateral",
  "multilateral",
  "individual",
] as const;

export const OPPORTUNITY_STATUSES = ["open", "closed", "upcoming", "archived"] as const;
