import { useInventoryItems } from "@/hooks/useInventoryItems";
import { useStockMovements } from "@/hooks/useStockMovements";
import { useSupplyRequests } from "@/hooks/useSupplyRequests";
import { KPICard } from "@/components/common/KPICard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Package, ArrowUpDown, ClipboardList, AlertTriangle } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";

export default function InventoryDashboard() {
  const navigate = useNavigate();
  const { data: items } = useInventoryItems();
  const { data: movements } = useStockMovements();
  const { data: requests } = useSupplyRequests();

  const activeItems = items?.filter(i => i.is_active) ?? [];
  const lowStock = activeItems.filter(i => i.reorder_point && i.quantity_on_hand <= (i.reorder_point as number));
  const totalValue = activeItems.reduce((s, i) => s + (i.quantity_on_hand * i.unit_cost), 0);
  const pendingRequests = requests?.filter(r => ["draft", "pending_approval"].includes(r.status)) ?? [];

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
                {lowStock.slice(0, 5).map(item => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{item.name}</span>
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
