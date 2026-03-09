import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAssets } from "@/hooks/useAssets";
import { useAssetDepreciation } from "@/hooks/useAssetDepreciation";
import { useAssetMaintenance } from "@/hooks/useAssetMaintenance";
import { Package, TrendingDown, Wrench, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { KPICard } from "@/components/common/KPICard";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(210, 70%, 55%)",
  "hsl(150, 60%, 45%)",
  "hsl(40, 80%, 55%)",
  "hsl(340, 65%, 50%)",
  "hsl(270, 50%, 55%)",
];

export default function AssetsDashboard() {
  const navigate = useNavigate();
  const { data: assets } = useAssets();
  const { data: depreciation } = useAssetDepreciation();
  const { data: maintenance } = useAssetMaintenance();

  const activeAssets = assets?.filter(a => a.status === "active") ?? [];
  const totalCost = assets?.reduce((s, a) => s + Number(a.acquisition_cost), 0) ?? 0;
  const totalBookValue = depreciation?.length
    ? depreciation.reduce((s, d) => s + Number(d.book_value ?? 0), 0) / (depreciation.length || 1)
    : totalCost;
  const pendingMaintenance = maintenance?.filter(m => m.status === "scheduled").length ?? 0;

  // By category
  const catMap = new Map<string, number>();
  assets?.forEach(a => {
    const cat = a.category?.replace(/_/g, " ") ?? "other";
    catMap.set(cat, (catMap.get(cat) ?? 0) + 1);
  });
  const categoryData = Array.from(catMap.entries()).map(([name, value]) => ({ name, value }));

  // By status
  const statusMap = new Map<string, number>();
  assets?.forEach(a => {
    const s = a.status?.replace(/_/g, " ") ?? "unknown";
    statusMap.set(s, (statusMap.get(s) ?? 0) + Number(a.acquisition_cost));
  });
  const statusData = Array.from(statusMap.entries()).map(([name, cost]) => ({ name, cost }));

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Asset Management</h1>
          <p className="text-muted-foreground">Track, depreciate, and maintain organizational assets</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KPICard title="Active Assets" value={activeAssets.length} icon={<Package className="h-4 w-4" />} />
          <KPICard title="Total Cost" value={`$${totalCost.toLocaleString()}`} icon={<TrendingDown className="h-4 w-4" />} />
          <KPICard title="Depreciation Records" value={depreciation?.length ?? 0} icon={<TrendingDown className="h-4 w-4" />} />
          <KPICard title="Pending Maintenance" value={pendingMaintenance} icon={<Wrench className="h-4 w-4" />} />
        </div>

        {/* Charts */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assets by Category</CardTitle>
              <CardDescription>Count of assets per category</CardDescription>
            </CardHeader>
            <CardContent>
              {categoryData.length > 0 ? (
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine={false}>
                        {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">No asset data</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cost by Status</CardTitle>
              <CardDescription>Acquisition cost grouped by asset status</CardDescription>
            </CardHeader>
            <CardContent>
              {statusData.length > 0 ? (
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statusData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                      <Bar dataKey="cost" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Cost" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">No data</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/assets/registry")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Asset Registry</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{assets?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Total assets</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/assets/depreciation")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Depreciation</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{depreciation?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Schedule entries</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/assets/maintenance")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Maintenance</CardTitle>
              <Wrench className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{maintenance?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Work orders</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent lists */}
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
                    <p className="text-xs text-muted-foreground">{m.scheduled_date}</p>
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
