import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useFXRates } from "@/hooks/useFXRates";
import { Plus, Trash2, ArrowRightLeft } from "lucide-react";
import { format } from "date-fns";

export default function FXRates() {
  const { data: rates, isLoading, create, remove } = useFXRates();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ from_currency: "USD", to_currency: "", rate: "", effective_date: "", source: "manual" });

  const handleCreate = () => {
    if (!form.to_currency || !form.rate) return;
    create.mutate(
      { from_currency: form.from_currency, to_currency: form.to_currency, rate: Number(form.rate), effective_date: form.effective_date || undefined, source: form.source },
      { onSuccess: () => { setOpen(false); setForm({ from_currency: "USD", to_currency: "", rate: "", effective_date: "", source: "manual" }); } }
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><ArrowRightLeft className="h-6 w-6" />FX Rates</h1>
            <p className="text-muted-foreground">Manage foreign exchange rates for multi-currency operations</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Rate</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New FX Rate</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>From Currency</Label><Input value={form.from_currency} onChange={e => setForm(f => ({ ...f, from_currency: e.target.value.toUpperCase() }))} placeholder="USD" /></div>
                  <div><Label>To Currency *</Label><Input value={form.to_currency} onChange={e => setForm(f => ({ ...f, to_currency: e.target.value.toUpperCase() }))} placeholder="EUR" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Rate *</Label><Input type="number" step="0.000001" value={form.rate} onChange={e => setForm(f => ({ ...f, rate: e.target.value }))} placeholder="0.85" /></div>
                  <div><Label>Effective Date</Label><Input type="date" value={form.effective_date} onChange={e => setForm(f => ({ ...f, effective_date: e.target.value }))} /></div>
                </div>
                <div><Label>Source</Label><Input value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} placeholder="manual, ECB, etc." /></div>
                <Button onClick={handleCreate} disabled={!form.to_currency || !form.rate || create.isPending} className="w-full">Add Rate</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pair</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead>Effective Date</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : !rates?.length ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No FX rates configured</TableCell></TableRow>
                ) : rates.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <span className="font-mono font-medium">{r.from_currency}/{r.to_currency}</span>
                    </TableCell>
                    <TableCell className="text-right font-mono">{Number(r.rate).toFixed(6)}</TableCell>
                    <TableCell className="text-sm">{format(new Date(r.effective_date), "MMM d, yyyy")}</TableCell>
                    <TableCell><Badge variant="outline">{r.source}</Badge></TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => remove.mutate(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
