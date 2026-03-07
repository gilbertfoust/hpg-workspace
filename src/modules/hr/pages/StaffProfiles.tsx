import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStaffProfiles } from "@/hooks/useStaffProfiles";
import { useNGOs } from "@/hooks/useNGOs";
import { EMPLOYMENT_TYPES, STAFF_STATUSES } from "@/modules/hr/types";
import { Plus, Search, User } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  inactive: "bg-muted text-muted-foreground",
  on_leave: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  terminated: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default function StaffProfiles() {
  const [search, setSearch] = useState("");
  const { data: staff, isLoading, create, update } = useStaffProfiles();
  const { data: ngos } = useNGOs();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", ngo_id: "", email: "", phone: "", job_title: "", employment_type: "full_time", start_date: "", annual_salary: "" });

  const filtered = staff?.filter(s =>
    `${s.first_name} ${s.last_name} ${s.email || ""} ${s.job_title || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = () => {
    if (!form.first_name || !form.last_name || !form.ngo_id) return;
    create.mutate(
      { first_name: form.first_name, last_name: form.last_name, ngo_id: form.ngo_id, email: form.email || undefined, phone: form.phone || undefined, job_title: form.job_title || undefined, employment_type: form.employment_type, start_date: form.start_date || undefined, annual_salary: form.annual_salary ? Number(form.annual_salary) : undefined },
      { onSuccess: () => { setDialogOpen(false); setForm({ first_name: "", last_name: "", ngo_id: "", email: "", phone: "", job_title: "", employment_type: "full_time", start_date: "", annual_salary: "" }); } }
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Staff Profiles</h1>
            <p className="text-muted-foreground">Employee and volunteer directory</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Staff</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Staff Member</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>First Name *</Label><Input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} /></div>
                  <div><Label>Last Name *</Label><Input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} /></div>
                </div>
                <div>
                  <Label>NGO *</Label>
                  <Select value={form.ngo_id} onValueChange={v => setForm(f => ({ ...f, ngo_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select NGO" /></SelectTrigger>
                    <SelectContent>{ngos?.map(n => <SelectItem key={n.id} value={n.id}>{n.common_name || n.legal_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Email</Label><Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                  <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Job Title</Label><Input value={form.job_title} onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))} /></div>
                  <div>
                    <Label>Type</Label>
                    <Select value={form.employment_type} onValueChange={v => setForm(f => ({ ...f, employment_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{EMPLOYMENT_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Start Date</Label><Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></div>
                  <div><Label>Annual Salary</Label><Input type="number" value={form.annual_salary} onChange={e => setForm(f => ({ ...f, annual_salary: e.target.value }))} /></div>
                </div>
                <Button onClick={handleCreate} disabled={!form.first_name || !form.last_name || !form.ngo_id || create.isPending} className="w-full">Add Staff Member</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search staff..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>NGO</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>PTO Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : !filtered?.length ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No staff found</TableCell></TableRow>
                ) : filtered.map(s => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{s.first_name} {s.last_name}</p>
                          {s.email && <p className="text-xs text-muted-foreground">{s.email}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{(s as any).ngos?.common_name || (s as any).ngos?.legal_name || "—"}</TableCell>
                    <TableCell className="text-sm">{s.job_title ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline">{s.employment_type.replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell className="text-sm">{s.pto_balance_hours}h</TableCell>
                    <TableCell><Badge className={STATUS_COLORS[s.status] ?? ""}>{s.status.replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell>
                      <Select value={s.status} onValueChange={v => update.mutate({ id: s.id, status: v })}>
                        <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{STAFF_STATUSES.map(st => <SelectItem key={st} value={st}>{st.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
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
