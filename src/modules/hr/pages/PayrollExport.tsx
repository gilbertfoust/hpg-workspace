import { ModulePage } from "@/modules/shared/ModulePage";

export default function PayrollExport() {
  return <ModulePage title="Payroll Export" subtitle="Generate payroll files for external processing" features={["Period Selection", "Deductions", "Export Formats", "Audit Trail"]} />;
}
