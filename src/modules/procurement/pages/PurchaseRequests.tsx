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
import { usePurchaseRequests } from "@/hooks/usePurchaseRequests";
import { useNGOs } from "@/hooks/useNGOs";
import { useAuth } from "@/contexts/AuthContext";
import { PR_STATUSES } from "@/modules/procurement/types";
import { Plus, DollarSign, Calendar } from "lucide-react";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_approval: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  canceled: "bg-muted text-muted-foreground",
};

export default function PurchaseRequests() {
  const { data: prs, isLoading, create, updateStatus } = usePurchaseRequests();
  const { data: ngos } = useNGOs();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", ngo_id: "", description: "", estimated_amount: "", priority: "medium", needed_by: "" });

  const handleCreate = () => {
    if (!form.title || !form.ngo_id) return;
    create.mutate(
      { title: form.title, ngo_id: form.ngo_id, description: form.description || undefined, estimated_amount: form.estimated_amount ? Number(form.estimated_amount) : undefined, priority: form.priority, needed_by: form.needed_by || undefined, requested_by_user_id: user?.id },
      { onSuccess: () => { setDialogOpen(false); setForm({ title: "", ngo_id: "", description: "", estimated_amount: "", priority: "medium", needed_by: "" }); } }
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Purchase Requests</h1>
            <p className="text-muted-foreground">Submit and track purchase requests for approval</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Request</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Purchase Request</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
                <div>
                  <Label>NGO *</Label>
                  <Select value={form.ngo_id} onValueChange={v => setForm(f => ({ ...f, ngo_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select NGO" /></SelectTrigger>
                    <SelectContent>{ngos?.map(n => <SelectItem key={n.id} value={n.id}>{n.common_name || n.legal_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Estimated Amount</Label><Input type="number" value={form.estimated_amount} onChange={e => setForm(f => ({ ...f, estimated_amount: e.target.value }))} /></div>
                  <div>
                    <Label>Priority</Label>
                    <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Needed By</Label><Input type="date" value={form.needed_by} onChange={e => setForm(f => ({ ...f, needed_by: e.target.value }))} /></div>
                <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
                <Button onClick={handleCreate} disabled={!form.title || !form.ngo_id || create.isPending} className="w-full">Submit Request</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>NGO</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : !prs?.length ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No purchase requests</TableCell></TableRow>
                ) : prs.map(pr => (
                  <TableRow key={pr.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{pr.title}</p>
                        {pr.needed_by && <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />Need by {format(new Date(pr.needed_by), "MMM d")}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{(pr as any).ngos?.common_name || (pr as any).ngos?.legal_name}</TableCell>
                    <TableCell>{pr.estimated_amount ? <span className="flex items-center gap-1 text-sm"><DollarSign className="h-3 w-3" />{pr.estimated_amount.toLocaleString()}</span> : "—"}</TableCell>
                    <TableCell><Badge variant={pr.priority === "high" ? "destructive" : "outline"}>{pr.priority}</Badge></TableCell>
                    <TableCell><Badge className={STATUS_COLORS[pr.status] ?? ""}>{pr.status.replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell>
                      {pr.status === "draft" && (
                        <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: pr.id, status: "pending_approval" })}>Submit</Button>
                      )}
                      {pr.status === "pending_approval" && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="default" onClick={() => updateStatus.mutate({ id: pr.id, status: "approved", approved_by_user_id: user?.id })}>Approve</Button>
                          <Button size="sm" variant="destructive" onClick={() => updateStatus.mutate({ id: pr.id, status: "rejected" })}>Reject</Button>
                        </div>
                      )}
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
