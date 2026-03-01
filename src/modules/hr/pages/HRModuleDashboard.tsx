import { ModulePage } from "@/modules/shared/ModulePage";

export default function HRModuleDashboard() {
  return (
    <ModulePage
      title="HR & Workforce"
      subtitle="Staff management, timesheets, PTO, and payroll"
      features={["Staff Profiles", "Timesheets", "PTO Management", "Payroll Export", "Contractor Tracking"]}
      subPages={[
        { label: "Staff Profiles", path: "/erp/hr/staff" },
        { label: "Timesheets", path: "/erp/hr/timesheets" },
        { label: "PTO Management", path: "/erp/hr/pto" },
        { label: "Payroll Export", path: "/erp/hr/payroll" },
      ]}
    />
  );
}
