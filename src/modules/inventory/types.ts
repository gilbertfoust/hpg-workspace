export interface InventoryItem {
  id: string;
  name: string;
  sku?: string;
  category: string;
  quantity: number;
  reorder_point?: number;
}

export interface StockMovement {
  id: string;
  item_id: string;
  type: "in" | "out" | "transfer";
  quantity: number;
  date: string;
}

export interface SupplyRequest {
  id: string;
  requested_by: string;
  items: { item_id: string; quantity: number }[];
  status: string;
}
