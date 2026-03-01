import { ModulePage } from "@/modules/shared/ModulePage";

export default function CRMOrganizations() {
  return <ModulePage title="CRM — Organizations" subtitle="Organization profiles and hierarchies" features={["Org Profiles", "Linked Contacts", "Document History", "Relationship Map"]} />;
}
