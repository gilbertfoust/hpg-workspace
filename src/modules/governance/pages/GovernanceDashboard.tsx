import { ModulePage } from "@/modules/shared/ModulePage";

export default function GovernanceDashboard() {
  return (
    <ModulePage
      title="Governance"
      subtitle="Multi-currency, multi-country compliance and COA governance"
      features={["FX Rates", "Country Compliance", "Localized COA", "Currency Selector", "Regulatory Tracking"]}
      subPages={[
        { label: "FX Rates", path: "/governance/fx" },
        { label: "Country Compliance", path: "/governance/compliance" },
        { label: "Localized COA", path: "/governance/coa" },
      ]}
    />
  );
}
