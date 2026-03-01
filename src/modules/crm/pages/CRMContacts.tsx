import { ModulePage } from "@/modules/shared/ModulePage";

export default function CRMContacts() {
  return <ModulePage title="CRM — Contacts" subtitle="Manage donor, partner, and vendor contacts" features={["Search & Filter", "Import/Export", "Contact Cards", "Activity Timeline"]} />;
}
