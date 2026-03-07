import { ModulePage } from "@/modules/shared/ModulePage";

export default function Treasury() {
  return <ModulePage title="Treasury" subtitle="Cash positions, forecasting, and bank management" features={["Cash Position Dashboard", "Forecasting", "Bank Account Management", "Liquidity Analysis"]} />;
}
