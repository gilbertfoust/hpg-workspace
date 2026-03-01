import { ModulePage } from "@/modules/shared/ModulePage";

export default function PurchaseOrders() {
  return <ModulePage title="Purchase Orders" subtitle="Manage approved purchase orders" features={["PO Generation", "Line Items", "Vendor Assignment", "Status Tracking"]} />;
}
