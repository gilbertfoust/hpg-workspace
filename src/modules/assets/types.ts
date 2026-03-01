export interface Asset {
  id: string;
  ngo_id: string;
  name: string;
  description: string | null;
  category: string;
  asset_tag: string | null;
  serial_number: string | null;
  acquisition_date: string | null;
  acquisition_cost: number;
  salvage_value: number;
  useful_life_months: number | null;
  depreciation_method: string;
  location: string | null;
  assigned_to_staff_id: string | null;
  account_id: string | null;
  status: string;
  disposed_date: string | null;
  disposed_value: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  ngos?: { legal_name: string; common_name: string | null } | null;
  staff_profiles?: { first_name: string; last_name: string } | null;
}

export interface AssetDepreciation {
  id: string;
  asset_id: string;
  ngo_id: string;
  period_label: string;
  period_date: string;
  depreciation_amount: number;
  accumulated_depreciation: number;
  book_value: number;
  transaction_id: string | null;
  created_at: string;
  assets?: { name: string } | null;
}

export interface AssetMaintenance {
  id: string;
  asset_id: string;
  ngo_id: string;
  maintenance_type: string;
  description: string;
  scheduled_date: string | null;
  completed_date: string | null;
  cost: number | null;
  vendor_org_id: string | null;
  assigned_to_user_id: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  assets?: { name: string } | null;
}

export const ASSET_CATEGORIES = ["equipment", "furniture", "vehicle", "technology", "building", "land", "software", "other"] as const;
export const ASSET_STATUSES = ["active", "in_storage", "maintenance", "disposed", "lost"] as const;
export const DEPRECIATION_METHODS = ["straight_line", "declining_balance", "none"] as const;
export const MAINTENANCE_TYPES = ["preventive", "corrective", "inspection", "upgrade"] as const;
export const MAINTENANCE_STATUSES = ["scheduled", "in_progress", "completed", "canceled"] as const;
