export interface CRMContact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  organization_id?: string;
}

export interface CRMOrganization {
  id: string;
  name: string;
  type: "donor" | "partner" | "vendor" | "ngo";
}

export interface CRMInteraction {
  id: string;
  contact_id: string;
  type: string;
  notes?: string;
  date: string;
}

export interface CRMDeal {
  id: string;
  title: string;
  stage: string;
  amount?: number;
}
