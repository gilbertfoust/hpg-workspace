import { ModulePage } from "@/modules/shared/ModulePage";

export default function Timesheets() {
  return <ModulePage title="Timesheets" subtitle="Time tracking and approval" features={["Weekly Entry", "Project Allocation", "Approval Workflow", "Export to Payroll"]} />;
}
