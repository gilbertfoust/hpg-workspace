import { ModulePage } from "@/modules/shared/ModulePage";

export default function AuditDashboard() {
  return (
    <ModulePage
      title="Audit"
      subtitle="Audit trail, user action logs, and permission tracking"
      features={["DB Write Tracking", "User Action Logs", "Permission Changes", "Export Reports"]}
      subPages={[
        { label: "Audit Trail", path: "/audit/trail" },
        { label: "Permission Changes", path: "/audit/permissions" },
      ]}
    />
  );
}
