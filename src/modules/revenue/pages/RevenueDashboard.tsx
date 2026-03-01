import { ModulePage } from "@/modules/shared/ModulePage";

export default function RevenueDashboard() {
  return (
    <ModulePage
      title="Revenue Management"
      subtitle="Donation types, recurring revenue, and recognition schedules"
      features={["Donation Tracking", "Recurring Revenue", "Revenue Recognition", "Deferred Revenue", "Restriction Tracking"]}
      subPages={[
        { label: "Donation Types", path: "/revenue/donations" },
        { label: "Recurring Revenue", path: "/revenue/recurring" },
        { label: "Revenue Recognition", path: "/revenue/recognition" },
      ]}
    />
  );
}
