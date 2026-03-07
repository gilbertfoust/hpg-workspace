import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertsPanel } from "./AlertsPanel";

interface Props {
  ngoId: string;
  grants: any[];
  purchaseOrders: any[];
  vendorInvoices: any[];
  staff: any[];
  assets: any[];
  inventory: any[];
  compliance: any[];
}

export function NgoControllerTabs({ ngoId, grants, purchaseOrders, vendorInvoices, staff, assets, inventory, compliance }: Props) {
  const grantsByStage = grants.reduce((acc: Record<string, number>, g: any) => {
    acc[g.stage] = (acc[g.stage] || 0) + 1;
    return acc;
  }, {});
  const totalAwarded = grants.filter((g: any) => g.stage === "awarded").reduce((s: number, g: any) => s + (g.amount_awarded ?? 0), 0);

  const openPOs = purchaseOrders.filter((p: any) => !["closed", "canceled"].includes(p.status));
  const unpaidInvoices = vendorInvoices.filter((v: any) => ["received", "pending_approval", "approved"].includes(v.status));

  const activeStaff = staff.filter((s: any) => s.status === "active");
  const activeAssets = assets.filter((a: any) => a.status === "active");
  const totalAssetValue = assets.reduce((s: number, a: any) => s + (a.acquisition_cost ?? 0), 0);
  const activeItems = inventory.filter((i: any) => i.is_active);
  const lowStock = activeItems.filter((i: any) => i.reorder_point && i.quantity_on_hand < i.reorder_point);
  const inventoryValue = activeItems.reduce((s: number, i: any) => s + (i.quantity_on_hand * i.unit_cost), 0);

  return (
    <Tabs defaultValue="grants" className="space-y-4">
      <TabsList>
        <TabsTrigger value="grants">Grants & Revenue</TabsTrigger>
        <TabsTrigger value="procurement">Procurement</TabsTrigger>
        <TabsTrigger value="hr">HR & Ops</TabsTrigger>
        <TabsTrigger value="alerts">Alerts</TabsTrigger>
      </TabsList>

      <TabsContent value="grants">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Total Awarded</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">${totalAwarded.toLocaleString()}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Pipeline</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {Object.entries(grantsByStage).map(([stage, count]) => (
                  <Badge key={stage} variant="outline">{stage}: {count as number}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Total Applications</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{grants.length}</p></CardContent>
          </Card>
        </div>
        {grants.length > 0 && (
          <Card className="mt-4">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="text-right">Requested</TableHead>
                    <TableHead className="text-right">Awarded</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grants.slice(0, 10).map((g: any) => (
                    <TableRow key={g.id}>
                      <TableCell className="font-medium">{g.title}</TableCell>
                      <TableCell><Badge variant="outline">{g.stage}</Badge></TableCell>
                      <TableCell className="text-right font-mono">${(g.amount_requested ?? 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono">${(g.amount_awarded ?? 0).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="procurement">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Open Purchase Orders</CardTitle></CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{openPOs.length}</p>
              <p className="text-xs text-muted-foreground">${openPOs.reduce((s: number, p: any) => s + (p.total_amount ?? 0), 0).toLocaleString()} total</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Unpaid Invoices</CardTitle></CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{unpaidInvoices.length}</p>
              <p className="text-xs text-muted-foreground">${unpaidInvoices.reduce((s: number, v: any) => s + (v.total_amount ?? 0), 0).toLocaleString()} outstanding</p>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="hr">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Active Staff</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{activeStaff.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Active Assets</CardTitle></CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{activeAssets.length}</p>
              <p className="text-xs text-muted-foreground">${totalAssetValue.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Inventory Items</CardTitle></CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{activeItems.length}</p>
              <p className="text-xs text-muted-foreground">${inventoryValue.toLocaleString()} value</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Low Stock Alerts</CardTitle></CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{lowStock.length}</p>
              {lowStock.length > 0 && <p className="text-xs text-destructive">Below reorder point</p>}
            </CardContent>
          </Card>
        </div>
        {compliance.length > 0 && (
          <Card className="mt-4">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Compliance Packages</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {compliance.map((c: any) => (
                  <Badge key={c.id} variant={c.status === "approved" ? "default" : "secondary"}>
                    {c.package_type} FY{c.fiscal_year}: {c.status}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="alerts">
        <AlertsPanel ngoId={ngoId} />
      </TabsContent>
    </Tabs>
  );
}
