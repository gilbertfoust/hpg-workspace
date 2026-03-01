import { ModulePage } from "@/modules/shared/ModulePage";

export default function InventoryDashboard() {
  return (
    <ModulePage
      title="Inventory & Supplies"
      subtitle="Track inventory, stock movements, and supply requests"
      features={["Item Catalog", "Stock Levels", "Movement History", "Low Stock Alerts", "Supply Requests"]}
      subPages={[
        { label: "Items", path: "/inventory/items" },
        { label: "Stock Movements", path: "/inventory/movements" },
        { label: "Supply Requests", path: "/inventory/requests" },
      ]}
    />
  );
}
