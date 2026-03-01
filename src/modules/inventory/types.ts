export interface InventoryItem {
  id: string;
  ngo_id: string;
  name: string;
  sku: string | null;
  category: string;
  description: string | null;
  unit_of_measure: string;
  quantity_on_hand: number;
  reorder_point: number | null;
  reorder_quantity: number | null;
  unit_cost: number;
  location: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  ngos?: { legal_name: string; common_name: string | null } | null;
}

export interface StockMovement {
  id: string;
  ngo_id: string;
  item_id: string;
  movement_type: "in" | "out" | "transfer" | "adjustment" | "return";
  quantity: number;
  reference_number: string | null;
  performed_by_user_id: string | null;
  notes: string | null;
  created_at: string;
  inventory_items?: { name: string } | null;
  profiles?: { full_name: string | null } | null;
}

export interface SupplyRequest {
  id: string;
  ngo_id: string;
  request_number: string;
  requested_by_user_id: string | null;
  status: string;
  priority: string;
  needed_by: string | null;
  approved_by_user_id: string | null;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  profiles?: { full_name: string | null } | null;
  supply_request_items?: SupplyRequestItem[];
}

export interface SupplyRequestItem {
  id: string;
  supply_request_id: string;
  item_id: string;
  quantity_requested: number;
  quantity_fulfilled: number;
  notes: string | null;
  created_at: string;
  inventory_items?: { name: string } | null;
}

export const INVENTORY_CATEGORIES = ["general", "office", "medical", "food", "cleaning", "technology", "field_equipment", "vehicle_parts", "other"] as const;
export const MOVEMENT_TYPES = ["in", "out", "transfer", "adjustment", "return"] as const;
export const SUPPLY_REQUEST_STATUSES = ["draft", "pending_approval", "approved", "partially_fulfilled", "fulfilled", "rejected", "canceled"] as const;
export const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
