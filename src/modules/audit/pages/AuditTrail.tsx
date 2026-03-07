import { ModulePage } from "@/modules/shared/ModulePage";

export default function AuditTrail() {
  return <ModulePage title="Audit Trail" subtitle="Complete log of all data changes" features={["Timeline View", "Entity Filter", "User Filter", "Before/After Diff"]} />;
}
