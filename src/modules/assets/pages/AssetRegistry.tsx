import { ModulePage } from "@/modules/shared/ModulePage";

export default function AssetRegistry() {
  return <ModulePage title="Asset Registry" subtitle="Complete inventory of organizational assets" features={["Asset Cards", "Categories", "Assignments", "QR/Barcode"]} />;
}
