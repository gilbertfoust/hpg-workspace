import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePurchaseRequests } from "@/hooks/usePurchaseRequests";
import { usePurchaseOrders } from "@/hooks/usePurchaseOrders";
import { useVendorInvoices } from "@/hooks/useVendorInvoices";
import { FileText, ShoppingCart, Receipt, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

export default function ProcurementDashboard() {
  const navigate = useNavigate();
  const { data: prs } = usePurchaseRequests();
  const { data: pos } = usePurchaseOrders();
  const { data: invoices } = useVendorInvoices();

  const pendingPRs = prs?.filter(p => p.status === "pending_approval").length ?? 0;
  const openPOs = pos?.filter(p => !["closed", "canceled"].includes(p.status)).length ?? 0;
  const unpaidInvoices = invoices?.filter(i => !["paid", "canceled"].includes(i.status)).length ?? 0;
  const totalOutstanding = invoices?.filter(i => !["paid", "canceled"].includes(i.status)).reduce((s, i) => s + (i.total_amount ?? 0), 0) ?? 0;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Procurement</h1>
          <p className="text-muted-foreground">Purchase requests, orders, and vendor invoices</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/procurement/requests")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{pendingPRs}</p></CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/procurement/orders")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Open POs</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{openPOs}</p></CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/procurement/invoices")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Unpaid Invoices</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{unpaidInvoices}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Outstanding Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">${totalOutstanding.toLocaleString()}</p></CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Recent Requests</CardTitle></CardHeader>
            <CardContent>
              {prs?.slice(0, 5).map(pr => (
                <div key={pr.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{pr.title}</p>
                    <p className="text-xs text-muted-foreground">{(pr as any).ngos?.common_name || (pr as any).ngos?.legal_name}</p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0 ml-2">{pr.status.replace(/_/g, " ")}</Badge>
                </div>
              )) ?? <p className="text-sm text-muted-foreground">No requests yet</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Recent POs</CardTitle></CardHeader>
            <CardContent>
              {pos?.slice(0, 5).map(po => (
                <div key={po.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{po.po_number}</p>
                    <p className="text-xs text-muted-foreground">{(po as any).crm_organizations?.name ?? "—"}</p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0 ml-2">{po.status.replace(/_/g, " ")}</Badge>
                </div>
              )) ?? <p className="text-sm text-muted-foreground">No POs yet</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Recent Invoices</CardTitle></CardHeader>
            <CardContent>
              {invoices?.slice(0, 5).map(inv => (
                <div key={inv.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">#{inv.invoice_number}</p>
                    <p className="text-xs text-muted-foreground">${inv.total_amount.toLocaleString()}</p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0 ml-2">{inv.status.replace(/_/g, " ")}</Badge>
                </div>
              )) ?? <p className="text-sm text-muted-foreground">No invoices yet</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
