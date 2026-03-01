import { ModulePage } from "@/modules/shared/ModulePage";

export default function InventoryItems() {
  return <ModulePage title="Inventory Items" subtitle="Catalog of all tracked items" features={["Search & Filter", "Categories", "Reorder Points", "Locations"]} />;
}
