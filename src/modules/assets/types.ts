export interface Asset {
  id: string;
  name: string;
  category: string;
  acquisition_date: string;
  acquisition_cost: number;
  status: "active" | "disposed" | "maintenance";
}

export interface AssetDepreciation {
  id: string;
  asset_id: string;
  period: string;
  amount: number;
}

export interface AssetMaintenance {
  id: string;
  asset_id: string;
  description: string;
  scheduled_date: string;
  status: string;
}
