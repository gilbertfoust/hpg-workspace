export interface CRMOrganization {
  id: string;
  name: string;
  org_type: string;
  industry: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state_province: string | null;
  country: string | null;
  description: string | null;
  annual_revenue: number | null;
  employee_count: number | null;
  tags: string[];
  is_active: boolean;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CRMContact {
  id: string;
  organization_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  department: string | null;
  is_primary: boolean;
  is_active: boolean;
  notes: string | null;
  tags: string[];
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  crm_organizations?: CRMOrganization | null;
}

export interface CRMInteraction {
  id: string;
  organization_id: string | null;
  contact_id: string | null;
  interaction_type: string;
  subject: string;
  description: string | null;
  interaction_date: string;
  logged_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  crm_organizations?: { name: string } | null;
  crm_contacts?: { first_name: string; last_name: string } | null;
  profiles?: { full_name: string | null } | null;
}

export interface CRMDeal {
  id: string;
  organization_id: string | null;
  contact_id: string | null;
  title: string;
  deal_type: string;
  stage: string;
  amount: number | null;
  probability: number | null;
  expected_close_date: string | null;
  actual_close_date: string | null;
  ngo_id: string | null;
  assigned_user_id: string | null;
  notes: string | null;
  tags: string[];
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  crm_organizations?: { name: string } | null;
  crm_contacts?: { first_name: string; last_name: string } | null;
  profiles?: { full_name: string | null } | null;
}

export const CRM_ORG_TYPES = ["donor", "partner", "vendor", "funder", "government", "corporate", "other"] as const;
export const INTERACTION_TYPES = ["call", "email", "meeting", "note", "task", "event", "other"] as const;
export const DEAL_TYPES = ["donation", "grant", "partnership", "sponsorship", "contract", "other"] as const;
export const DEAL_STAGES = ["lead", "qualified", "proposal", "negotiation", "committed", "won", "lost", "closed"] as const;
