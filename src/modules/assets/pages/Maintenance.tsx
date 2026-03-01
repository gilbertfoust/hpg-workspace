import { ModulePage } from "@/modules/shared/ModulePage";

export default function Maintenance() {
  return <ModulePage title="Maintenance" subtitle="Schedule and track asset maintenance" features={["Preventive Schedule", "Work Orders", "Cost Tracking", "Vendor Assignment"]} />;
}
