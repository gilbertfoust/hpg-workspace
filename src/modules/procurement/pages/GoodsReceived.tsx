import { ModulePage } from "@/modules/shared/ModulePage";

export default function GoodsReceived() {
  return <ModulePage title="Goods Received" subtitle="Record and verify received goods against POs" features={["Receipt Confirmation", "Quality Check", "Partial Receipts", "Variance Logging"]} />;
}
