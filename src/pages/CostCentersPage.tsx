import { MainLayout } from "@/components/layout/MainLayout";
import { CostCentersTable } from "@/components/usage-accounting/CostCentersTable";

const CostCentersPage = () => (
  <MainLayout>
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cost Centers</h1>
        <p className="text-muted-foreground">Manage organizational cost centers for usage tracking and allocation.</p>
      </div>
      <CostCentersTable />
    </div>
  </MainLayout>
);

export default CostCentersPage;
