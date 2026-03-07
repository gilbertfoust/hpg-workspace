import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAssets } from "@/hooks/useAssets";
import { useAssetDepreciation } from "@/hooks/useAssetDepreciation";
import { useAssetMaintenance } from "@/hooks/useAssetMaintenance";
import { Package, TrendingDown, Wrench, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

export default function AssetsDashboard() {
  const navigate = useNavigate();
  const { data: assets } = useAssets();
  const { data: depreciation } = useAssetDepreciation();
  const { data: maintenance } = useAssetMaintenance();

  const activeAssets = assets?.filter(a => a.status === "active").length ?? 0;
  const totalCost = assets?.reduce((s, a) => s + Number(a.acquisition_cost), 0) ?? 0;
  const pendingMaintenance = maintenance?.filter(m => m.status === "scheduled").length ?? 0;
  const recentDepreciation = depreciation?.slice(0, 5) ?? [];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Asset Management</h1>
          <p className="text-muted-foreground">Track, depreciate, and maintain organizational assets</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/assets/registry")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Assets</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{activeAssets}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Acquisition Cost</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">${totalCost.toLocaleString()}</p></CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/assets/depreciation")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Depreciation Records</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{depreciation?.length ?? 0}</p></CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/assets/maintenance")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending Maintenance</CardTitle>
              <Wrench className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{pendingMaintenance}</p></CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Recent Assets</CardTitle></CardHeader>
            <CardContent>
              {assets?.slice(0, 5).map(a => (
                <div key={a.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{a.name}</p>
                    <p className="text-xs text-muted-foreground">{a.category} · ${Number(a.acquisition_cost).toLocaleString()}</p>
                  </div>
                  <Badge variant={a.status === "active" ? "default" : "secondary"}>{a.status.replace(/_/g, " ")}</Badge>
                </div>
              )) ?? <p className="text-sm text-muted-foreground">No assets yet</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Upcoming Maintenance</CardTitle></CardHeader>
            <CardContent>
              {maintenance?.filter(m => m.status === "scheduled").slice(0, 5).map(m => (
                <div key={m.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{m.description}</p>
                    <p className="text-xs text-muted-foreground">{(m as any).assets?.name} · {m.scheduled_date}</p>
                  </div>
                  <Badge variant="outline">{m.maintenance_type}</Badge>
                </div>
              )) ?? <p className="text-sm text-muted-foreground">No maintenance scheduled</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
