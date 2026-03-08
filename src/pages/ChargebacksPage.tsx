import { MainLayout } from "@/components/layout/MainLayout";
import { InternalChargesTable } from "@/components/usage-accounting/InternalChargesTable";

const ChargebacksPage = () => (
  <MainLayout>
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Chargebacks</h1>
        <p className="text-muted-foreground">Manage internal charges between cost centers for shared services.</p>
      </div>
      <InternalChargesTable />
    </div>
  </MainLayout>
);

export default ChargebacksPage;
