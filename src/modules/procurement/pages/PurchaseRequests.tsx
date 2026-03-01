import { ModulePage } from "@/modules/shared/ModulePage";

export default function PurchaseRequests() {
  return <ModulePage title="Purchase Requests" subtitle="Submit and track purchase requisitions" features={["Request Form", "Multi-Level Approval", "Budget Check", "Attachments"]} />;
}
