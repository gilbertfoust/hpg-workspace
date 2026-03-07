import { MainLayout } from "@/components/layout/MainLayout";
import { useControllerDashboard } from "@/hooks/useControllerDashboard";
import { ControllerDashboardCards } from "../components/ControllerDashboardCards";
import { NgoHealthTable } from "../components/NgoHealthTable";
import { AlertsPanel } from "../components/AlertsPanel";

export default function ControllerDashboard() {
  const { isLoading, kpis, ngoHealthRows } = useControllerDashboard();

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Controller Hub</h1>
          <p className="text-muted-foreground">HPG headquarters financial oversight — NGO health, risk, and cross-module KPIs</p>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">Loading dashboard…</p>
        ) : (
          <>
            <ControllerDashboardCards kpis={kpis} />
            <NgoHealthTable rows={ngoHealthRows} />
            <AlertsPanel />
          </>
        )}
      </div>
    </MainLayout>
  );
}
