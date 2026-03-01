import { ModulePage } from "@/modules/shared/ModulePage";

export default function ControllerDashboard() {
  return (
    <ModulePage
      title="Controller Hub"
      subtitle="HPG headquarters financial oversight and consolidation"
      features={["Financial Consolidation", "NGO Risk Scoring", "Inter-NGO Transfers", "Treasury Management", "Compliance Dashboards"]}
      subPages={[
        { label: "Consolidation", path: "/controller/consolidation" },
        { label: "Risk Scoring", path: "/controller/risk" },
        { label: "Inter-NGO Transfers", path: "/controller/transfers" },
        { label: "Treasury", path: "/controller/treasury" },
      ]}
    />
  );
}
