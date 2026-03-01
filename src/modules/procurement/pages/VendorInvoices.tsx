import { ModulePage } from "@/modules/shared/ModulePage";

export default function VendorInvoices() {
  return <ModulePage title="Vendor Invoices" subtitle="Invoice matching and payment processing" features={["3-Way Match", "Payment Scheduling", "Aging Reports", "Dispute Tracking"]} />;
}
