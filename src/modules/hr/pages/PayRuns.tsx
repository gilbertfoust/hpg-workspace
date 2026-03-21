import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { usePayRuns, usePayRunItems } from "@/hooks/usePayRuns";
import { useStaffProfiles } from "@/hooks/useStaffProfiles";
import { useTimesheets } from "@/hooks/useTimesheets";
import { useNGOs } from "@/hooks/useNGOs";
import { useAuth } from "@/contexts/AuthContext";
import { DollarSign, Plus, Download, Play } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  processing: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

export default function PayRuns() {
  const { data: runs, create, updateStatus } = usePayRuns();
  const { data: ngos } = useNGOs();
  const { data: staff } = useStaffProfiles({ status: "active" });
  const { data: timesheets } = useTimesheets({ status: "approved" });
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ ngo_id: "", pay_period_start: "", pay_period_end: "", notes: "" });
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const { data: items, create: createItem } = usePayRunItems(selectedRunId || undefined);

  const handleCreate = () => {
    if (!form.ngo_id || !form.pay_period_start || !form.pay_period_end) return;
    create.mutate({
      ngo_id: form.ngo_id,
      pay_period_start: form.pay_period_start,
      pay_period_end: form.pay_period_end,
      run_date: new Date().toISOString().split("T")[0],
      notes: form.notes || undefined,
      created_by_user_id: user?.id,
    }, { onSuccess: () => { setDialogOpen(false); setForm({ ngo_id: "", pay_period_start: "", pay_period_end: "", notes: "" }); } });
  };

  const generateItems = (run: any) => {
    const ngoStaff = staff?.filter(s => s.ngo_id === run.ngo_id) || [];
    const periodTimesheets = timesheets?.filter(t =>
      t.ngo_id === run.ngo_id &&
      t.period_start >= run.pay_period_start &&
      t.period_end <= run.pay_period_end
    ) || [];

    for (const s of ngoStaff) {
      const hours = periodTimesheets.filter(t => t.staff_id === s.id).reduce((sum, t) => sum + (t.total_hours || 0), 0);
      const grossPay = s.hourly_rate ? hours * Number(s.hourly_rate) : (s.annual_salary ? Number(s.annual_salary) / 26 : 0);
      createItem.mutate({
        pay_run_id: run.id,
        staff_id: s.id,
        regular_hours: hours,
        gross_pay: Math.round(grossPay * 100) / 100,
        net_pay: Math.round(grossPay * 0.75 * 100) / 100,
      });
    }
    toast.success("Pay run items generated");
  };

  const exportCSV = () => {
    if (!items?.length) return;
    const csv = [
      "Employee,Regular Hours,OT Hours,Gross Pay,Deductions,Net Pay",
      ...items.map(i => `"${(i as any).staff_profiles?.first_name} ${(i as any).staff_profiles?.last_name}",${i.regular_hours},${i.overtime_hours},${Number(i.gross_pay).toFixed(2)},"${JSON.stringify(i.deductions)}",${Number(i.net_pay).toFixed(2)}`)
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pay-run-${selectedRunId?.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  const selectedRun = runs?.find(r => r.id === selectedRunId);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><DollarSign className="h-6 w-6" />Pay Runs</h1>
            <p className="text-muted-foreground">Payroll processing and export</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Pay Run</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Pay Run</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>NGO *</Label>
                  <Select value={form.ngo_id} onValueChange={v => setForm(f => ({ ...f, ngo_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{ngos?.map(n => <SelectItem key={n.id} value={n.id}>{n.common_name || n.legal_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Period Start *</Label><Input type="date" value={form.pay_period_start} onChange={e => setForm(f => ({ ...f, pay_period_start: e.target.value }))} /></div>
                  <div><Label>Period End *</Label><Input type="date" value={form.pay_period_end} onChange={e => setForm(f => ({ ...f, pay_period_end: e.target.value }))} /></div>
                </div>
                <div><Label>Notes</Label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
                <Button className="w-full" onClick={handleCreate} disabled={!form.ngo_id || !form.pay_period_start || !form.pay_period_end}>Create Pay Run</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>NGO</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!runs?.length ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No pay runs</TableCell></TableRow>
                ) : runs.map(r => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelectedRunId(r.id)}>
                    <TableCell className="font-medium">{(r as any).ngos?.common_name || (r as any).ngos?.legal_name}</TableCell>
                    <TableCell className="text-sm">{format(new Date(r.pay_period_start), "MMM d")} – {format(new Date(r.pay_period_end), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-right font-mono">${Number(r.total_gross).toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono">${Number(r.total_net).toLocaleString()}</TableCell>
                    <TableCell><Badge className={STATUS_COLORS[r.status] ?? ""}>{r.status}</Badge></TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      {r.status === "draft" && (
                        <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: r.id, status: "processing" })}>Process</Button>
                      )}
                      {r.status === "processing" && (
                        <Button size="sm" onClick={() => updateStatus.mutate({ id: r.id, status: "completed" })}>Complete</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Sheet open={!!selectedRunId} onOpenChange={open => !open && setSelectedRunId(null)}>
          <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
            <SheetHeader><SheetTitle>Pay Run Detail</SheetTitle></SheetHeader>
            {selectedRun && (
              <div className="space-y-4 mt-4">
                <div className="flex gap-2">
                  {selectedRun.status === "draft" && (
                    <Button size="sm" onClick={() => generateItems(selectedRun)}><Play className="h-3 w-3 mr-1" />Generate Items</Button>
                  )}
                  <Button size="sm" variant="outline" onClick={exportCSV} disabled={!items?.length}><Download className="h-3 w-3 mr-1" />Export CSV</Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!items?.length ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No items — click Generate</TableCell></TableRow>
                    ) : items.map(i => (
                      <TableRow key={i.id}>
                        <TableCell className="font-medium">{(i as any).staff_profiles?.first_name} {(i as any).staff_profiles?.last_name}</TableCell>
                        <TableCell className="text-right font-mono">{Number(i.regular_hours).toFixed(1)}h</TableCell>
                        <TableCell className="text-right font-mono">${Number(i.gross_pay).toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono">${Number(i.net_pay).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </MainLayout>
  );
}
