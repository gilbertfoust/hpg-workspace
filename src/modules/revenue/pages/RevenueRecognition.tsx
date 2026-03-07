import { useState } from "react";
import { useRevenueRecognition } from "@/hooks/useRevenueRecognition";
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
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search } from "lucide-react";
import { RECOGNITION_TYPES } from "../types";
import { format } from "date-fns";

export default function RevenueRecognition() {
  const { data: entries, isLoading, create } = useRevenueRecognition();
  const { data: streams } = useRevenueStreams();
  const { data: ngos } = useNGOs();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ngo_id: "", recognition_date: "", amount: 0, deferred_amount: 0, recognition_type: "immediate", revenue_stream_id: "", description: "" });

  const filtered = (entries ?? []).filter(e => {
    const matchSearch = (e.description ?? "").toLowerCase().includes(search.toLowerCase()) || ((e as any).revenue_streams?.name ?? "").toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || e.recognition_type === typeFilter;
    return matchSearch && matchType;
  });

  const handleCreate = () => {
    if (!form.ngo_id || !form.recognition_date) return;
    create.mutate({
      ...form,
      amount: Number(form.amount),
      deferred_amount: Number(form.deferred_amount),
      revenue_stream_id: form.revenue_stream_id || undefined,
      description: form.description || undefined,
    }, {
      onSuccess: () => { setOpen(false); setForm({ ngo_id: "", recognition_date: "", amount: 0, deferred_amount: 0, recognition_type: "immediate", revenue_stream_id: "", description: "" }); },
    });
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Revenue Recognition</h1>
            <p className="text-muted-foreground">Track revenue recognition and deferred revenue</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Entry</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Recognition Entry</DialogTitle></DialogHeader>
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
                    <Label>Recognition Date *</Label>
                    <Input type="date" value={form.recognition_date} onChange={e => setForm(p => ({ ...p, recognition_date: e.target.value }))} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Type</Label>
                    <Select value={form.recognition_type} onValueChange={v => setForm(p => ({ ...p, recognition_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{RECOGNITION_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Amount Recognized</Label>
                    <Input type="number" step="0.01" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: +e.target.value }))} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Deferred Amount</Label>
                    <Input type="number" step="0.01" value={form.deferred_amount} onChange={e => setForm(p => ({ ...p, deferred_amount: +e.target.value }))} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Revenue Stream</Label>
                  <Select value={form.revenue_stream_id} onValueChange={v => setForm(p => ({ ...p, revenue_stream_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                    <SelectContent>{streams?.filter(s => !form.ngo_id || s.ngo_id === form.ngo_id).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Description</Label>
                  <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                </div>
                <Button onClick={handleCreate} disabled={create.isPending}>{create.isPending ? "Saving…" : "Create Entry"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search entries…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {RECOGNITION_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Stream</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Recognized</TableHead>
                  <TableHead className="text-right">Deferred</TableHead>
                  <TableHead>Period</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No entries found</TableCell></TableRow>
                ) : filtered.map(e => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs">{format(new Date(e.recognition_date), "MMM d, yyyy")}</TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">{e.description ?? "—"}</TableCell>
                    <TableCell className="text-xs">{(e as any).revenue_streams?.name ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline">{e.recognition_type.replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell className="text-right font-mono font-medium">${e.amount.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">${e.deferred_amount.toLocaleString()}</TableCell>
                    <TableCell className="text-xs">{(e as any).fiscal_periods?.label ?? "—"}</TableCell>
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
