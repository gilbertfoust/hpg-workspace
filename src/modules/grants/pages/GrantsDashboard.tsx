import { ModulePage } from "@/modules/shared/ModulePage";

export default function GrantsDashboard() {
  return (
    <ModulePage
      title="Grant Management"
      subtitle="Grant search, tracking, and reporting"
      features={["Grant Search", "Application Pipeline", "Award Tracking", "Compliance Reporting", "Funder Profiles"]}
      subPages={[
        { label: "Grant Search", path: "/grants/search" },
        { label: "Pipeline", path: "/grants/pipeline" },
      ]}
    />
  );
}
