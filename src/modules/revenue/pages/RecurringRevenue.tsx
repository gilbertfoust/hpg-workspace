import { useState } from "react";
import { useRecurringDonations } from "@/hooks/useRecurringDonations";
import { useRevenueStreams } from "@/hooks/useRevenueStreams";
import { useNGOs } from "@/hooks/useNGOs";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Search } from "lucide-react";
import { DONATION_FREQUENCIES, DONATION_STATUSES } from "../types";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  active: "default",
  paused: "secondary",
  canceled: "destructive",
  completed: "outline",
  failed: "destructive",
};

export default function RecurringRevenue() {
  const { data: donations, isLoading, create } = useRecurringDonations();
  const { data: streams } = useRevenueStreams();
  const { data: ngos } = useNGOs();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ngo_id: "", donor_name: "", donor_email: "", amount: 0, frequency: "monthly", start_date: "", revenue_stream_id: "", payment_method: "", notes: "" });

  const filtered = (donations ?? []).filter(d => {
    const matchSearch = d.donor_name.toLowerCase().includes(search.toLowerCase()) || (d.donor_email ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || d.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleCreate = () => {
    if (!form.ngo_id || !form.donor_name || !form.start_date) return;
    create.mutate({
      ...form,
      amount: Number(form.amount),
      revenue_stream_id: form.revenue_stream_id || undefined,
      payment_method: form.payment_method || undefined,
      notes: form.notes || undefined,
      donor_email: form.donor_email || undefined,
    }, {
      onSuccess: () => { setOpen(false); setForm({ ngo_id: "", donor_name: "", donor_email: "", amount: 0, frequency: "monthly", start_date: "", revenue_stream_id: "", payment_method: "", notes: "" }); },
    });
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Recurring Donations</h1>
            <p className="text-muted-foreground">Track and manage recurring revenue</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Donation</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Recurring Donation</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>NGO *</Label>
                  <Select value={form.ngo_id} onValueChange={v => setForm(p => ({ ...p, ngo_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select NGO" /></SelectTrigger>
                    <SelectContent>{ngos?.map(n => <SelectItem key={n.id} value={n.id}>{n.common_name || n.legal_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Donor Name *</Label>
                    <Input value={form.donor_name} onChange={e => setForm(p => ({ ...p, donor_name: e.target.value }))} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Email</Label>
                    <Input type="email" value={form.donor_email} onChange={e => setForm(p => ({ ...p, donor_email: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label>Amount *</Label>
                    <Input type="number" step="0.01" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: +e.target.value }))} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Frequency</Label>
                    <Select value={form.frequency} onValueChange={v => setForm(p => ({ ...p, frequency: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{DONATION_FREQUENCIES.map(f => <SelectItem key={f} value={f}>{f.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Start Date *</Label>
                    <Input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Revenue Stream</Label>
                  <Select value={form.revenue_stream_id} onValueChange={v => setForm(p => ({ ...p, revenue_stream_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                    <SelectContent>{streams?.filter(s => !form.ngo_id || s.ngo_id === form.ngo_id).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button onClick={handleCreate} disabled={create.isPending}>{create.isPending ? "Saving…" : "Create Donation"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search donors…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {DONATION_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Donor</TableHead>
                  <TableHead>Stream</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>Next Expected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No donations found</TableCell></TableRow>
                ) : filtered.map(d => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div className="font-medium">{d.donor_name}</div>
                      {d.donor_email && <div className="text-xs text-muted-foreground">{d.donor_email}</div>}
                    </TableCell>
                    <TableCell className="text-xs">{(d as any).revenue_streams?.name ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono font-medium">${d.amount.toLocaleString()}</TableCell>
                    <TableCell><Badge variant="outline">{d.frequency.replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell><Badge variant={statusColors[d.status] as any ?? "secondary"}>{d.status}</Badge></TableCell>
                    <TableCell className="text-xs">{format(new Date(d.start_date), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-xs">{d.next_expected_date ? format(new Date(d.next_expected_date), "MMM d, yyyy") : "—"}</TableCell>
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
