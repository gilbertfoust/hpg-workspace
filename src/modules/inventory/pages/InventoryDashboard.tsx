import { useInventoryItems } from "@/hooks/useInventoryItems";
import { useStockMovements } from "@/hooks/useStockMovements";
import { useSupplyRequests } from "@/hooks/useSupplyRequests";
import { KPICard } from "@/components/common/KPICard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Package, ArrowUpDown, ClipboardList, AlertTriangle } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(210, 70%, 55%)",
  "hsl(150, 60%, 45%)",
  "hsl(40, 80%, 55%)",
  "hsl(340, 65%, 50%)",
  "hsl(270, 50%, 55%)",
];

export default function InventoryDashboard() {
  const navigate = useNavigate();
  const { data: items } = useInventoryItems();
  const { data: movements } = useStockMovements();
  const { data: requests } = useSupplyRequests();

  const activeItems = items?.filter(i => i.is_active) ?? [];
  const lowStock = activeItems.filter(i => i.reorder_point && i.quantity_on_hand <= (i.reorder_point as number));
  const totalValue = activeItems.reduce((s, i) => s + (i.quantity_on_hand * i.unit_cost), 0);
  const pendingRequests = requests?.filter(r => ["draft", "pending_approval"].includes(r.status)) ?? [];

  // Category distribution
  const catMap = new Map<string, number>();
  activeItems.forEach(i => {
    const cat = i.category?.replace(/_/g, " ") ?? "other";
    catMap.set(cat, (catMap.get(cat) ?? 0) + 1);
  });
  const categoryData = Array.from(catMap.entries()).map(([name, value]) => ({ name, value }));

  // Movement types
  const moveMap = new Map<string, number>();
  movements?.forEach(m => {
    const t = m.movement_type ?? "unknown";
    moveMap.set(t, (moveMap.get(t) ?? 0) + Math.abs(Number(m.quantity)));
  });
  const movementData = Array.from(moveMap.entries()).map(([name, quantity]) => ({ name, quantity }));

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory & Supplies</h1>
          <p className="text-muted-foreground">Track inventory, stock movements, and supply requests</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KPICard title="Active Items" value={activeItems.length} icon={<Package className="h-4 w-4" />} />
          <KPICard title="Total Value" value={`$${totalValue.toLocaleString()}`} icon={<Package className="h-4 w-4" />} />
          <KPICard title="Low Stock Alerts" value={lowStock.length} icon={<AlertTriangle className="h-4 w-4" />} />
          <KPICard title="Pending Requests" value={pendingRequests.length} icon={<ClipboardList className="h-4 w-4" />} />
        </div>

        {/* Charts */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Items by Category</CardTitle>
              <CardDescription>Distribution of active inventory items</CardDescription>
            </CardHeader>
            <CardContent>
              {categoryData.length > 0 ? (
                <div className="h-[240px]">
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
                <p className="text-sm text-muted-foreground text-center py-12">No inventory data</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Stock Movements</CardTitle>
              <CardDescription>Quantity by movement type</CardDescription>
            </CardHeader>
            <CardContent>
              {movementData.length > 0 ? (
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={movementData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                      <Bar dataKey="quantity" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">No movements logged</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Navigation Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/inventory/items")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Item Catalog</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{items?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Total items tracked</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/inventory/movements")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Stock Movements</CardTitle>
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{movements?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Total movements logged</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/inventory/requests")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Supply Requests</CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{requests?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Total requests</p>
            </CardContent>
          </Card>
        </div>

        {/* Low Stock Alerts */}
        {lowStock.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Low Stock Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {lowStock.map(item => (
                  <div key={item.id} className="flex items-center justify-between text-sm p-2 border rounded">
                    <div>
                      <span className="font-medium">{item.name}</span>
                      <Badge variant="outline" className="ml-2 text-xs">{item.category}</Badge>
                    </div>
                    <span className="text-destructive font-mono">
                      {item.quantity_on_hand} / {item.reorder_point} min
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
