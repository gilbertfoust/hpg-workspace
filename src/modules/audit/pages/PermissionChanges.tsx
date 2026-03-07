import { ModulePage } from "@/modules/shared/ModulePage";

export default function PermissionChanges() {
  return <ModulePage title="Permission Changes" subtitle="Track role and access permission modifications" features={["Change Log", "Role History", "Access Review", "Compliance Reporting"]} />;
}
