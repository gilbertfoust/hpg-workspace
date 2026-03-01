import { ModulePage } from "@/modules/shared/ModulePage";

export default function CRMDashboard() {
  return (
    <ModulePage
      title="CRM"
      subtitle="Donor, partner, and vendor relationship management"
      features={["Contact Management", "Organization Profiles", "Activity Logs", "Pipeline Tracking", "Gmail Integration"]}
      subPages={[
        { label: "Contacts", path: "/crm/contacts" },
        { label: "Organizations", path: "/crm/organizations" },
        { label: "Interactions", path: "/crm/interactions" },
        { label: "Pipeline", path: "/crm/pipeline" },
      ]}
    />
  );
}
