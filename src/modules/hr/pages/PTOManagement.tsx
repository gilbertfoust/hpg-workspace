import { ModulePage } from "@/modules/shared/ModulePage";

export default function PTOManagement() {
  return <ModulePage title="PTO Management" subtitle="Leave requests and balance tracking" features={["Request Form", "Balance Dashboard", "Calendar View", "Policy Rules"]} />;
}
