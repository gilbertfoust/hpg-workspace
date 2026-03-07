import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePurchaseOrders } from "@/hooks/usePurchaseOrders";
import { Package, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

export default function GoodsReceived() {
  const { data: pos, isLoading, updateStatus } = usePurchaseOrders();

  const receivable = pos?.filter(p => ["approved", "sent", "partially_received"].includes(p.status)) ?? [];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Goods Received</h1>
          <p className="text-muted-foreground">Confirm receipt of goods against purchase orders</p>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : receivable.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No POs awaiting receipt. All orders are either received or not yet sent.</CardContent></Card>
        ) : (
          <div className="grid gap-4">
            {receivable.map(po => (
              <Card key={po.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        {po.po_number}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {(po as any).crm_organizations?.name ?? "No vendor"} · {(po as any).ngos?.common_name || (po as any).ngos?.legal_name}
                      </p>
                    </div>
                    <Badge variant={po.status === "partially_received" ? "outline" : "secondary"}>
                      {po.status === "partially_received" ? <><Clock className="h-3 w-3 mr-1" />Partial</> : po.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <span>Total: ${po.total_amount.toLocaleString()}</span>
                      {po.expected_delivery && <span>Expected: {format(new Date(po.expected_delivery), "MMM d, yyyy")}</span>}
                    </div>
                    <div className="flex gap-2">
                      {po.status !== "partially_received" && (
                        <button
                          className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md border hover:bg-accent"
                          onClick={() => updateStatus.mutate({ id: po.id, status: "partially_received" })}
                        >
                          <AlertTriangle className="h-3 w-3" /> Partial Receipt
                        </button>
                      )}
                      <button
                        className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                        onClick={() => updateStatus.mutate({ id: po.id, status: "received" })}
                      >
                        <CheckCircle2 className="h-3 w-3" /> Mark Received
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
