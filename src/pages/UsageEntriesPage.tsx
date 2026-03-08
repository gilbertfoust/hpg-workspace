import { MainLayout } from "@/components/layout/MainLayout";
import { UsageSummaryCards } from "@/components/usage-accounting/UsageSummaryCards";
import { UsageEntriesTable } from "@/components/usage-accounting/UsageEntriesTable";
import { UsageEntryForm } from "@/components/usage-accounting/UsageEntryForm";

const UsageEntriesPage = () => (
  <MainLayout>
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usage Tracking</h1>
          <p className="text-muted-foreground">Log and review shared-service usage across cost centers.</p>
        </div>
        <UsageEntryForm />
      </div>
      <UsageSummaryCards />
      <UsageEntriesTable />
    </div>
  </MainLayout>
);

export default UsageEntriesPage;
