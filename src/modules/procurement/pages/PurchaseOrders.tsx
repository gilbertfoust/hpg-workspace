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
import { usePurchaseOrders } from "@/hooks/usePurchaseOrders";
import { useNGOs } from "@/hooks/useNGOs";
import { useCRMOrganizations } from "@/hooks/useCRMOrganizations";
import { useAuth } from "@/contexts/AuthContext";
import { PO_STATUSES } from "@/modules/procurement/types";
import { Plus, DollarSign } from "lucide-react";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_approval: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  approved: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  sent: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  partially_received: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  received: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  closed: "bg-muted text-muted-foreground",
  canceled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default function PurchaseOrders() {
  const { data: pos, isLoading, create, updateStatus } = usePurchaseOrders();
  const { data: ngos } = useNGOs();
  const { data: vendors } = useCRMOrganizations({ org_type: "vendor" });
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ ngo_id: "", po_number: "", vendor_org_id: "", total_amount: "", expected_delivery: "", notes: "" });

  const handleCreate = () => {
    if (!form.ngo_id || !form.po_number) return;
    create.mutate(
      { ngo_id: form.ngo_id, po_number: form.po_number, vendor_org_id: form.vendor_org_id || undefined, total_amount: form.total_amount ? Number(form.total_amount) : undefined, expected_delivery: form.expected_delivery || undefined, created_by_user_id: user?.id, notes: form.notes || undefined },
      { onSuccess: () => { setDialogOpen(false); setForm({ ngo_id: "", po_number: "", vendor_org_id: "", total_amount: "", expected_delivery: "", notes: "" }); } }
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Purchase Orders</h1>
            <p className="text-muted-foreground">Create and manage purchase orders for vendors</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New PO</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Purchase Order</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>PO Number *</Label><Input value={form.po_number} onChange={e => setForm(f => ({ ...f, po_number: e.target.value }))} placeholder="PO-001" /></div>
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
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Total Amount</Label><Input type="number" value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} /></div>
                  <div><Label>Expected Delivery</Label><Input type="date" value={form.expected_delivery} onChange={e => setForm(f => ({ ...f, expected_delivery: e.target.value }))} /></div>
                </div>
                <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
                <Button onClick={handleCreate} disabled={!form.ngo_id || !form.po_number || create.isPending} className="w-full">Create PO</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO #</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>NGO</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : !pos?.length ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No purchase orders</TableCell></TableRow>
                ) : pos.map(po => (
                  <TableRow key={po.id}>
                    <TableCell className="font-medium">{po.po_number}</TableCell>
                    <TableCell className="text-sm">{(po as any).crm_organizations?.name ?? "—"}</TableCell>
                    <TableCell className="text-sm">{(po as any).ngos?.common_name || (po as any).ngos?.legal_name}</TableCell>
                    <TableCell><span className="flex items-center gap-1 text-sm"><DollarSign className="h-3 w-3" />{po.total_amount.toLocaleString()}</span></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{format(new Date(po.order_date), "MMM d, yyyy")}</TableCell>
                    <TableCell><Badge className={STATUS_COLORS[po.status] ?? ""}>{po.status.replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell>
                      <Select value={po.status} onValueChange={v => updateStatus.mutate({ id: po.id, status: v, approved_by_user_id: v === "approved" ? user?.id : undefined })}>
                        <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{PO_STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
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
