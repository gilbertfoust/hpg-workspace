import { ModulePage } from "@/modules/shared/ModulePage";

export default function StockMovements() {
  return <ModulePage title="Stock Movements" subtitle="Track incoming, outgoing, and transfer movements" features={["Movement Log", "Batch Operations", "Audit Trail", "Consumption Reports"]} />;
}
