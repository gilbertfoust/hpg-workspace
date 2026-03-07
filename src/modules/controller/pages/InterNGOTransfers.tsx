import { ModulePage } from "@/modules/shared/ModulePage";

export default function InterNGOTransfers() {
  return <ModulePage title="Inter-NGO Transfers" subtitle="Manage fund transfers between NGOs" features={["Transfer Request", "Approval Workflow", "Reconciliation", "Ledger Integration"]} />;
}
