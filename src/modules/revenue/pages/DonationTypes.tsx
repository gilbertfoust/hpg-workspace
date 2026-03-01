import { useState } from "react";
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
import { STREAM_TYPES } from "../types";

export default function DonationTypes() {
  const { data: streams, isLoading, create } = useRevenueStreams();
  const { data: ngos } = useNGOs();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", ngo_id: "", stream_type: "donation", source: "", annual_target: 0, description: "" });

  const filtered = (streams ?? []).filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || s.stream_type === typeFilter;
    return matchSearch && matchType;
  });

  const handleCreate = () => {
    if (!form.name || !form.ngo_id) return;
    create.mutate({ ...form, annual_target: Number(form.annual_target) }, {
      onSuccess: () => { setOpen(false); setForm({ name: "", ngo_id: "", stream_type: "donation", source: "", annual_target: 0, description: "" }); },
    });
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Revenue Streams</h1>
            <p className="text-muted-foreground">Manage donation types and revenue sources</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Stream</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Revenue Stream</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Name *</Label>
                  <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label>NGO *</Label>
                  <Select value={form.ngo_id} onValueChange={v => setForm(p => ({ ...p, ngo_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select NGO" /></SelectTrigger>
                    <SelectContent>{ngos?.map(n => <SelectItem key={n.id} value={n.id}>{n.common_name || n.legal_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Type</Label>
                    <Select value={form.stream_type} onValueChange={v => setForm(p => ({ ...p, stream_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{STREAM_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Annual Target</Label>
                    <Input type="number" value={form.annual_target} onChange={e => setForm(p => ({ ...p, annual_target: +e.target.value }))} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Source</Label>
                  <Input value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))} />
                </div>
                <Button onClick={handleCreate} disabled={create.isPending}>{create.isPending ? "Saving…" : "Create Stream"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search streams…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {STREAM_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Annual Target</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>NGO</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No streams found</TableCell></TableRow>
                ) : filtered.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell><Badge variant="outline">{s.stream_type.replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell>{s.source ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono">${(s.annual_target ?? 0).toLocaleString()}</TableCell>
                    <TableCell><Badge variant={s.is_active ? "default" : "secondary"}>{s.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{(s as any).ngos?.common_name || (s as any).ngos?.legal_name || "—"}</TableCell>
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
