import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTimesheets } from "@/hooks/useTimesheets";
import { useStaffProfiles } from "@/hooks/useStaffProfiles";
import { useNGOs } from "@/hooks/useNGOs";
import { useAuth } from "@/contexts/AuthContext";
import { TIMESHEET_STATUSES } from "@/modules/hr/types";
import { Plus, Clock } from "lucide-react";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default function Timesheets() {
  const navigate = useNavigate();
  const { data: timesheets, isLoading, create, updateStatus, updateHours } = useTimesheets();
  const { data: staff } = useStaffProfiles({ status: "active" });
  const { data: ngos } = useNGOs();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ staff_id: "", ngo_id: "", period_start: "", period_end: "", total_hours: "" });

  const handleCreate = () => {
    if (!form.staff_id || !form.ngo_id || !form.period_start || !form.period_end) return;
    create.mutate(
      { staff_id: form.staff_id, ngo_id: form.ngo_id, period_start: form.period_start, period_end: form.period_end, total_hours: form.total_hours ? Number(form.total_hours) : undefined },
      { onSuccess: () => { setDialogOpen(false); setForm({ staff_id: "", ngo_id: "", period_start: "", period_end: "", total_hours: "" }); } }
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Timesheets</h1>
            <p className="text-muted-foreground">Time tracking and approval workflow</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Timesheet</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Timesheet</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Staff Member *</Label>
                  <Select value={form.staff_id} onValueChange={v => setForm(f => ({ ...f, staff_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                    <SelectContent>{staff?.map(s => <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>NGO *</Label>
                  <Select value={form.ngo_id} onValueChange={v => setForm(f => ({ ...f, ngo_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select NGO" /></SelectTrigger>
                    <SelectContent>{ngos?.map(n => <SelectItem key={n.id} value={n.id}>{n.common_name || n.legal_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Period Start *</Label><Input type="date" value={form.period_start} onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))} /></div>
                  <div><Label>Period End *</Label><Input type="date" value={form.period_end} onChange={e => setForm(f => ({ ...f, period_end: e.target.value }))} /></div>
                </div>
                <div><Label>Total Hours</Label><Input type="number" value={form.total_hours} onChange={e => setForm(f => ({ ...f, total_hours: e.target.value }))} placeholder="0" /></div>
                <Button onClick={handleCreate} disabled={!form.staff_id || !form.ngo_id || !form.period_start || !form.period_end || create.isPending} className="w-full">Create Timesheet</Button>
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
                  <TableHead>Period</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : !timesheets?.length ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No timesheets</TableCell></TableRow>
                ) : timesheets.map(ts => (
                  <TableRow key={ts.id}>
                    <TableCell className="font-medium">{(ts as any).staff_profiles?.first_name} {(ts as any).staff_profiles?.last_name}</TableCell>
                    <TableCell className="text-sm">{format(new Date(ts.period_start), "MMM d")} – {format(new Date(ts.period_end), "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      {ts.status === "draft" ? (
                        <Input type="number" className="w-20 h-8 text-sm" defaultValue={ts.total_hours} onBlur={e => { const v = Number(e.target.value); if (v !== ts.total_hours) updateHours.mutate({ id: ts.id, total_hours: v }); }} />
                      ) : (
                        <span className="flex items-center gap-1 text-sm"><Clock className="h-3 w-3" />{ts.total_hours}h</span>
                      )}
                    </TableCell>
                    <TableCell><Badge className={STATUS_COLORS[ts.status] ?? ""}>{ts.status}</Badge></TableCell>
                    <TableCell>
                      {ts.status === "draft" && <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: ts.id, status: "submitted" })}>Submit</Button>}
                      {ts.status === "submitted" && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="default" onClick={() => updateStatus.mutate({ id: ts.id, status: "approved", approved_by_user_id: user?.id })}>Approve</Button>
                          <Button size="sm" variant="destructive" onClick={() => updateStatus.mutate({ id: ts.id, status: "rejected" })}>Reject</Button>
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
