import { ModulePage } from "@/modules/shared/ModulePage";

export default function FXRates() {
  return <ModulePage title="FX Rates" subtitle="Foreign exchange rate management" features={["Rate Table", "Historical Rates", "Auto-Update", "Multi-Currency Transactions"]} />;
}
