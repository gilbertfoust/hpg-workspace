import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNGOs } from "@/hooks/useNGOs";
import { toast } from "sonner";
import { ArrowLeftRight, Plus, ArrowRight } from "lucide-react";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  approved: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default function InterNGOTransfers() {
  const qc = useQueryClient();
  const { ngos } = useNGOs();
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ from_ngo_id: "", to_ngo_id: "", amount: "", reason: "" });

  const { data: transfers, isLoading } = useQuery({
    queryKey: ["inter_ngo_transfers"],
    queryFn: async () => {
      const { data, error } = await supabase!
        .from("inter_ngo_transfers")
        .select("*, from_ngo:ngos!inter_ngo_transfers_from_ngo_id_fkey(legal_name), to_ngo:ngos!inter_ngo_transfers_to_ngo_id_fkey(legal_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!supabase,
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase!.from("inter_ngo_transfers").insert([{
        from_ngo_id: form.from_ngo_id,
        to_ngo_id: form.to_ngo_id,
        amount: parseFloat(form.amount),
        reason: form.reason || null,
        status: "pending",
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inter_ngo_transfers"] });
      toast.success("Transfer request created");
      setShowDialog(false);
      setForm({ from_ngo_id: "", to_ngo_id: "", amount: "", reason: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: Record<string, unknown> = { status };
      if (status === "completed") updates.completed_at = new Date().toISOString();
      const { error } = await supabase!.from("inter_ngo_transfers").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inter_ngo_transfers"] });
      toast.success("Transfer updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ngoName = (id: string) => ngos?.find((n) => n.id === id)?.legal_name ?? id.slice(0, 8);
  const totalPending = transfers?.filter((t: any) => t.status === "pending").length ?? 0;
  const totalAmount = transfers?.reduce((s: number, t: any) => s + (t.amount ?? 0), 0) ?? 0;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ArrowLeftRight className="h-6 w-6" />
              Inter-NGO Transfers
            </h1>
            <p className="text-muted-foreground">Manage fund transfers between NGOs</p>
          </div>
          <Button onClick={() => setShowDialog(true)}><Plus className="h-4 w-4 mr-2" />New Transfer</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Transfers</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{transfers?.length ?? 0}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Pending Approval</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold text-yellow-600">{totalPending}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Volume</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">${totalAmount.toLocaleString()}</p></CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead></TableHead>
                  <TableHead>To</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                ) : !transfers?.length ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No transfers yet</TableCell></TableRow>
                ) : (
                  transfers.map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(t.created_at), "MMM d, yyyy")}</TableCell>
                      <TableCell className="font-medium">{t.from_ngo?.legal_name ?? t.from_ngo_id?.slice(0, 8)}</TableCell>
                      <TableCell><ArrowRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                      <TableCell className="font-medium">{t.to_ngo?.legal_name ?? t.to_ngo_id?.slice(0, 8)}</TableCell>
                      <TableCell className="text-right font-mono">${(t.amount ?? 0).toLocaleString()}</TableCell>
                      <TableCell><Badge className={STATUS_COLORS[t.status] ?? ""}>{t.status}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">{t.reason || "—"}</TableCell>
                      <TableCell>
                        {t.status === "pending" && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: t.id, status: "approved" })}>Approve</Button>
                            <Button size="sm" variant="ghost" onClick={() => updateStatus.mutate({ id: t.id, status: "rejected" })}>Reject</Button>
                          </div>
                        )}
                        {t.status === "approved" && (
                          <Button size="sm" onClick={() => updateStatus.mutate({ id: t.id, status: "completed" })}>Complete</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>New Inter-NGO Transfer</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>From NGO</Label>
                <Select value={form.from_ngo_id} onValueChange={(v) => setForm({ ...form, from_ngo_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select source NGO" /></SelectTrigger>
                  <SelectContent>
                    {(ngos ?? []).map((n) => (
                      <SelectItem key={n.id} value={n.id}>{n.legal_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>To NGO</Label>
                <Select value={form.to_ngo_id} onValueChange={(v) => setForm({ ...form, to_ngo_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select destination NGO" /></SelectTrigger>
                  <SelectContent>
                    {(ngos ?? []).filter((n) => n.id !== form.from_ngo_id).map((n) => (
                      <SelectItem key={n.id} value={n.id}>{n.legal_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Amount ($)</Label>
                <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Purpose of transfer…" />
              </div>
              <Button className="w-full" onClick={() => create.mutate()} disabled={!form.from_ngo_id || !form.to_ngo_id || !form.amount || create.isPending}>
                {create.isPending ? "Creating…" : "Create Transfer Request"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
