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
import { usePTORequests } from "@/hooks/usePTORequests";
import { useStaffProfiles } from "@/hooks/useStaffProfiles";
import { useNGOs } from "@/hooks/useNGOs";
import { useAuth } from "@/contexts/AuthContext";
import { LEAVE_TYPES, PTO_STATUSES } from "@/modules/hr/types";
import { Plus, CalendarDays } from "lucide-react";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  canceled: "bg-muted text-muted-foreground",
};

export default function PTOManagement() {
  const { data: ptos, isLoading, create, updateStatus } = usePTORequests();
  const { data: staff } = useStaffProfiles({ status: "active" });
  const { data: ngos } = useNGOs();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ staff_id: "", ngo_id: "", leave_type: "vacation", start_date: "", end_date: "", hours_requested: "8", reason: "" });

  const handleCreate = () => {
    if (!form.staff_id || !form.ngo_id || !form.start_date || !form.end_date) return;
    create.mutate(
      { staff_id: form.staff_id, ngo_id: form.ngo_id, leave_type: form.leave_type, start_date: form.start_date, end_date: form.end_date, hours_requested: Number(form.hours_requested) || 8, reason: form.reason || undefined },
      { onSuccess: () => { setDialogOpen(false); setForm({ staff_id: "", ngo_id: "", leave_type: "vacation", start_date: "", end_date: "", hours_requested: "8", reason: "" }); } }
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">PTO Management</h1>
            <p className="text-muted-foreground">Leave requests and balance tracking</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Request</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New PTO Request</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Staff Member *</Label>
                  <Select value={form.staff_id} onValueChange={v => setForm(f => ({ ...f, staff_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                    <SelectContent>{staff?.map(s => <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>NGO *</Label>
                    <Select value={form.ngo_id} onValueChange={v => setForm(f => ({ ...f, ngo_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select NGO" /></SelectTrigger>
                      <SelectContent>{ngos?.map(n => <SelectItem key={n.id} value={n.id}>{n.common_name || n.legal_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Leave Type</Label>
                    <Select value={form.leave_type} onValueChange={v => setForm(f => ({ ...f, leave_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{LEAVE_TYPES.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div><Label>Start Date *</Label><Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></div>
                  <div><Label>End Date *</Label><Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} /></div>
                  <div><Label>Hours</Label><Input type="number" value={form.hours_requested} onChange={e => setForm(f => ({ ...f, hours_requested: e.target.value }))} /></div>
                </div>
                <div><Label>Reason</Label><Textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} /></div>
                <Button onClick={handleCreate} disabled={!form.staff_id || !form.ngo_id || !form.start_date || !form.end_date || create.isPending} className="w-full">Submit Request</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : !ptos?.length ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No PTO requests</TableCell></TableRow>
                ) : ptos.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{(p as any).staff_profiles?.first_name} {(p as any).staff_profiles?.last_name}</TableCell>
                    <TableCell><Badge variant="outline">{p.leave_type}</Badge></TableCell>
                    <TableCell className="text-sm">
                      <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{format(new Date(p.start_date), "MMM d")} – {format(new Date(p.end_date), "MMM d, yyyy")}</span>
                    </TableCell>
                    <TableCell className="text-sm">{p.hours_requested}h</TableCell>
                    <TableCell><Badge className={STATUS_COLORS[p.status] ?? ""}>{p.status}</Badge></TableCell>
                    <TableCell>
                      {p.status === "pending" && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="default" onClick={() => updateStatus.mutate({ id: p.id, status: "approved", approved_by_user_id: user?.id })}>Approve</Button>
                          <Button size="sm" variant="destructive" onClick={() => updateStatus.mutate({ id: p.id, status: "rejected" })}>Reject</Button>
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
