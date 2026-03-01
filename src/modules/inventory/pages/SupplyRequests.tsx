import { ModulePage } from "@/modules/shared/ModulePage";

export default function SupplyRequests() {
  return <ModulePage title="Supply Requests" subtitle="Request and fulfill supply orders" features={["Request Form", "Approval Flow", "Fulfillment Tracking", "Budget Check"]} />;
}
