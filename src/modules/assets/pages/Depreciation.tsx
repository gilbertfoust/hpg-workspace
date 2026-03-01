import { ModulePage } from "@/modules/shared/ModulePage";

export default function Depreciation() {
  return <ModulePage title="Depreciation" subtitle="Calculate and record asset depreciation" features={["Straight-Line", "Declining Balance", "Schedule Preview", "Journal Entry Generation"]} />;
}
