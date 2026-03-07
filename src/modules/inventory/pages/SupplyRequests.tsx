import { useState } from "react";
import { useSupplyRequests } from "@/hooks/useSupplyRequests";
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
import { SUPPLY_REQUEST_STATUSES, PRIORITIES } from "../types";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  draft: "secondary",
  pending_approval: "outline",
  approved: "default",
  partially_fulfilled: "outline",
  fulfilled: "default",
  rejected: "destructive",
  canceled: "secondary",
};

export default function SupplyRequests() {
  const { data: requests, isLoading, create } = useSupplyRequests();
  const { data: ngos } = useNGOs();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ngo_id: "", request_number: "", priority: "normal", needed_by: "", notes: "" });

  const filtered = (requests ?? []).filter(r => {
    const matchSearch = r.request_number.toLowerCase().includes(search.toLowerCase()) || (r.notes ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleCreate = () => {
    if (!form.ngo_id || !form.request_number) return;
    create.mutate({
      ...form,
      needed_by: form.needed_by || undefined,
    }, {
      onSuccess: () => { setOpen(false); setForm({ ngo_id: "", request_number: "", priority: "normal", needed_by: "", notes: "" }); },
    });
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Supply Requests</h1>
            <p className="text-muted-foreground">Request and fulfill supply orders</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />New Request</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Supply Request</DialogTitle></DialogHeader>
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
                    <Label>Request # *</Label>
                    <Input value={form.request_number} onChange={e => setForm(p => ({ ...p, request_number: e.target.value }))} placeholder="SR-2026-001" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Priority</Label>
                    <Select value={form.priority} onValueChange={v => setForm(p => ({ ...p, priority: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Needed By</Label>
                  <Input type="date" value={form.needed_by} onChange={e => setForm(p => ({ ...p, needed_by: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label>Notes</Label>
                  <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
                </div>
                <Button onClick={handleCreate} disabled={create.isPending}>{create.isPending ? "Saving…" : "Create Request"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search requests…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {SUPPLY_REQUEST_STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request #</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Requested By</TableHead>
                  <TableHead>Needed By</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Items</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No requests found</TableCell></TableRow>
                ) : filtered.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono font-medium">{r.request_number}</TableCell>
                    <TableCell>
                      <Badge variant={statusColors[r.status] as any ?? "secondary"}>
                        {r.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.priority === "urgent" ? "destructive" : r.priority === "high" ? "default" : "outline"}>
                        {r.priority}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{(r as any).profiles?.full_name ?? "—"}</TableCell>
                    <TableCell className="text-xs">{r.needed_by ? format(new Date(r.needed_by), "MMM d, yyyy") : "—"}</TableCell>
                    <TableCell className="text-xs">{format(new Date(r.created_at), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-xs">{(r as any).supply_request_items?.length ?? 0} items</TableCell>
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
