import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTimesheetEntries } from "@/hooks/useTimesheetEntries";
import { useTimesheets } from "@/hooks/useTimesheets";
import { ArrowLeft, Plus, Trash2, Clock } from "lucide-react";
import { format } from "date-fns";

export default function TimesheetDetail() {
  const [searchParams] = useSearchParams();
  const timesheetId = searchParams.get("id");
  const navigate = useNavigate();
  const { data: timesheets } = useTimesheets();
  const ts = timesheets?.find(t => t.id === timesheetId);
  const { data: entries, create, remove } = useTimesheetEntries(timesheetId || undefined);
  const [form, setForm] = useState({ entry_date: "", hours: "", description: "" });

  const handleAdd = () => {
    if (!timesheetId || !ts || !form.entry_date || !form.hours) return;
    create.mutate({
      timesheet_id: timesheetId,
      staff_id: ts.staff_id,
      entry_date: form.entry_date,
      hours: Number(form.hours),
      description: form.description,
    }, { onSuccess: () => setForm({ entry_date: "", hours: "", description: "" }) });
  };

  const totalEntryHours = entries?.reduce((s, e) => s + Number(e.hours), 0) ?? 0;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/erp/hr/timesheets")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2"><Clock className="h-6 w-6" />Timesheet Entries</h1>
            {ts && <p className="text-muted-foreground">
              {(ts as any).staff_profiles?.first_name} {(ts as any).staff_profiles?.last_name} · {format(new Date(ts.period_start), "MMM d")} – {format(new Date(ts.period_end), "MMM d, yyyy")}
            </p>}
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Total from entries</p>
            <p className="text-2xl font-bold">{totalEntryHours}h</p>
          </div>
        </div>

        {ts?.status === "draft" && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Add Entry</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-3 items-end">
                <div className="flex-1"><Label>Date</Label><Input type="date" value={form.entry_date} onChange={e => setForm(f => ({ ...f, entry_date: e.target.value }))} /></div>
                <div className="w-24"><Label>Hours</Label><Input type="number" step="0.25" value={form.hours} onChange={e => setForm(f => ({ ...f, hours: e.target.value }))} /></div>
                <div className="flex-[2]"><Label>Description</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Task or project" /></div>
                <Button onClick={handleAdd} disabled={!form.entry_date || !form.hours || create.isPending}><Plus className="h-4 w-4 mr-1" />Add</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Description</TableHead>
                  {ts?.status === "draft" && <TableHead className="w-12"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {!entries?.length ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No entries yet — add daily hours above</TableCell></TableRow>
                ) : entries.map(e => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{format(new Date(e.entry_date), "EEE, MMM d")}</TableCell>
                    <TableCell className="font-mono">{Number(e.hours).toFixed(2)}h</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{e.description || "—"}</TableCell>
                    {ts?.status === "draft" && (
                      <TableCell>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove.mutate(e.id)}><Trash2 className="h-3 w-3" /></Button>
                      </TableCell>
                    )}
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
