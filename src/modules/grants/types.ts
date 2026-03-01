export interface GrantSource {
  id: string;
  name: string;
  type: "foundation" | "government" | "corporate" | "individual";
}

export interface GrantOpportunity {
  id: string;
  title: string;
  funder: string;
  amount_range?: string;
  deadline?: string;
}

export interface GrantApplication {
  id: string;
  opportunity_id: string;
  stage: "prospect" | "applied" | "awarded" | "reporting" | "closed";
  amount?: number;
}
