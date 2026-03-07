import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useVendorInvoices } from "@/hooks/useVendorInvoices";
import { useNGOs } from "@/hooks/useNGOs";
import { useCRMOrganizations } from "@/hooks/useCRMOrganizations";
import { usePurchaseOrders } from "@/hooks/usePurchaseOrders";
import { useAuth } from "@/contexts/AuthContext";
import { VI_STATUSES } from "@/modules/procurement/types";
import { Plus, DollarSign, Link2 } from "lucide-react";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  received: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  pending_approval: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  disputed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  canceled: "bg-muted text-muted-foreground",
};

export default function VendorInvoices() {
  const { data: invoices, isLoading, create, updateStatus } = useVendorInvoices();
  const { data: ngos } = useNGOs();
  const { data: vendors } = useCRMOrganizations({ org_type: "vendor" });
  const { data: pos } = usePurchaseOrders();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ ngo_id: "", invoice_number: "", vendor_org_id: "", purchase_order_id: "", total_amount: "", due_date: "", notes: "" });

  const handleCreate = () => {
    if (!form.ngo_id || !form.invoice_number) return;
    create.mutate(
      { ngo_id: form.ngo_id, invoice_number: form.invoice_number, vendor_org_id: form.vendor_org_id || undefined, purchase_order_id: form.purchase_order_id || undefined, total_amount: form.total_amount ? Number(form.total_amount) : undefined, due_date: form.due_date || undefined, notes: form.notes || undefined },
      { onSuccess: () => { setDialogOpen(false); setForm({ ngo_id: "", invoice_number: "", vendor_org_id: "", purchase_order_id: "", total_amount: "", due_date: "", notes: "" }); } }
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Vendor Invoices</h1>
            <p className="text-muted-foreground">Track invoices, approvals, and payments linked to the ledger</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Invoice</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Vendor Invoice</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Invoice # *</Label><Input value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} /></div>
                  <div>
                    <Label>NGO *</Label>
                    <Select value={form.ngo_id} onValueChange={v => setForm(f => ({ ...f, ngo_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select NGO" /></SelectTrigger>
                      <SelectContent>{ngos?.map(n => <SelectItem key={n.id} value={n.id}>{n.common_name || n.legal_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Vendor</Label>
                  <Select value={form.vendor_org_id} onValueChange={v => setForm(f => ({ ...f, vendor_org_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                    <SelectContent>{vendors?.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Linked PO</Label>
                  <Select value={form.purchase_order_id} onValueChange={v => setForm(f => ({ ...f, purchase_order_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Link to PO (optional)" /></SelectTrigger>
                    <SelectContent>{pos?.map(p => <SelectItem key={p.id} value={p.id}>{p.po_number}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Total Amount</Label><Input type="number" value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} /></div>
                  <div><Label>Due Date</Label><Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>
                </div>
                <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
                <Button onClick={handleCreate} disabled={!form.ngo_id || !form.invoice_number || create.isPending} className="w-full">Create Invoice</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>PO</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ledger</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : !invoices?.length ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No invoices</TableCell></TableRow>
                ) : invoices.map(inv => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">#{inv.invoice_number}</TableCell>
                    <TableCell className="text-sm">{(inv as any).crm_organizations?.name ?? "—"}</TableCell>
                    <TableCell className="text-sm">{(inv as any).purchase_orders?.po_number ? <span className="flex items-center gap-1"><Link2 className="h-3 w-3" />{(inv as any).purchase_orders.po_number}</span> : "—"}</TableCell>
                    <TableCell><span className="flex items-center gap-1 text-sm"><DollarSign className="h-3 w-3" />{inv.total_amount.toLocaleString()}</span></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{inv.due_date ? format(new Date(inv.due_date), "MMM d, yyyy") : "—"}</TableCell>
                    <TableCell><Badge className={STATUS_COLORS[inv.status] ?? ""}>{inv.status.replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell>{inv.transaction_id ? <Badge variant="default" className="text-xs">Linked</Badge> : <Badge variant="outline" className="text-xs">Pending</Badge>}</TableCell>
                    <TableCell>
                      <Select value={inv.status} onValueChange={v => updateStatus.mutate({ id: inv.id, status: v, approved_by_user_id: v === "approved" ? user?.id : undefined })}>
                        <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{VI_STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
