import { ModulePage } from "@/modules/shared/ModulePage";

export default function ProcurementDashboard() {
  return (
    <ModulePage
      title="Procurement"
      subtitle="Purchase-to-pay workflow management"
      features={["Purchase Requests", "Purchase Orders", "Vendor Invoices", "Goods Received", "Approval Flows", "Ledger Integration"]}
      subPages={[
        { label: "Purchase Requests", path: "/procurement/requests" },
        { label: "Purchase Orders", path: "/procurement/orders" },
        { label: "Vendor Invoices", path: "/procurement/invoices" },
        { label: "Goods Received", path: "/procurement/received" },
      ]}
    />
  );
}
