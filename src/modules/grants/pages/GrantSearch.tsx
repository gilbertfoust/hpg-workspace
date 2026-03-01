import { ModulePage } from "@/modules/shared/ModulePage";

export default function GrantSearch() {
  return <ModulePage title="Grant Search" subtitle="Find grant opportunities by topic, region, and funder" features={["Keyword Search", "Country Filter", "Amount Range", "Saved Searches", "Funder Profiles"]} />;
}
