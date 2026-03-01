export interface ConsolidationReport {
  id: string;
  period: string;
  ngo_ids: string[];
  status: "draft" | "final";
  total_assets: number;
  total_liabilities: number;
}

export interface NgoRiskProfile {
  id: string;
  ngo_id: string;
  financial_risk_score: number;
  compliance_risk_score: number;
  hr_risk_score: number;
  operations_risk_score: number;
  overall_risk_score: number;
  risk_level: "low" | "medium" | "high";
  notes: string | null;
  created_at: string;
  updated_at: string;
  ngos?: { legal_name: string; common_name: string | null } | null;
}

export interface ControllerAlert {
  id: string;
  ngo_id: string | null;
  module: string;
  severity: "info" | "warning" | "critical";
  message: string;
  context_json: Record<string, unknown>;
  status: "open" | "in_progress" | "resolved" | "dismissed";
  created_at: string;
  resolved_at: string | null;
  ngos?: { legal_name: string; common_name: string | null } | null;
}

export interface InterNGOTransfer {
  id: string;
  from_ngo_id: string;
  to_ngo_id: string;
  amount: number;
  status: string;
}

export interface TreasuryPosition {
  id: string;
  account_name: string;
  balance: number;
  currency: string;
  as_of: string;
}

export const ALERT_MODULES = ["finance", "grants", "procurement", "hr", "assets", "inventory", "compliance", "system"] as const;
export const ALERT_SEVERITIES = ["info", "warning", "critical"] as const;
export const ALERT_STATUSES = ["open", "in_progress", "resolved", "dismissed"] as const;
export const RISK_LEVELS = ["low", "medium", "high"] as const;
