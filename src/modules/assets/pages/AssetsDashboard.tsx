import { ModulePage } from "@/modules/shared/ModulePage";

export default function AssetsDashboard() {
  return (
    <ModulePage
      title="Asset Management"
      subtitle="Track, depreciate, and maintain organizational assets"
      features={["Asset Registry", "Depreciation Schedules", "Maintenance Tracking", "Disposal Workflow", "Ledger Integration"]}
      subPages={[
        { label: "Asset Registry", path: "/assets/registry" },
        { label: "Depreciation", path: "/assets/depreciation" },
        { label: "Maintenance", path: "/assets/maintenance" },
      ]}
    />
  );
}
