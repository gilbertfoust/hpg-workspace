import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useTreasuryPositions } from "@/hooks/useTreasuryPositions";
import { useNGOs } from "@/hooks/useNGOs";
import { Plus, Landmark, DollarSign } from "lucide-react";
import { format } from "date-fns";

const ACCOUNT_TYPES = ["checking", "savings", "money_market", "cd", "investment", "petty_cash"];

export default function Treasury() {
  const { data: positions, isLoading, create } = useTreasuryPositions();
  const { data: ngos } = useNGOs();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ account_name: "", ngo_id: "", bank_name: "", currency: "USD", current_balance: "", account_type: "checking" });

  const totalBalance = (positions ?? []).reduce((sum, p) => sum + Number(p.current_balance), 0);

  const handleCreate = () => {
    if (!form.account_name) return;
    create.mutate(
      { account_name: form.account_name, ngo_id: form.ngo_id || undefined, bank_name: form.bank_name || undefined, currency: form.currency, current_balance: Number(form.current_balance) || 0, account_type: form.account_type },
      { onSuccess: () => { setOpen(false); setForm({ account_name: "", ngo_id: "", bank_name: "", currency: "USD", current_balance: "", account_type: "checking" }); } }
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Landmark className="h-6 w-6" />Treasury</h1>
            <p className="text-muted-foreground">Cash positions and bank account management</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Account</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Treasury Account</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Account Name *</Label><Input value={form.account_name} onChange={e => setForm(f => ({ ...f, account_name: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Bank</Label><Input value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} /></div>
                  <div>
                    <Label>NGO</Label>
                    <Select value={form.ngo_id} onValueChange={v => setForm(f => ({ ...f, ngo_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                      <SelectContent>{ngos?.map(n => <SelectItem key={n.id} value={n.id}>{n.common_name || n.legal_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div><Label>Currency</Label><Input value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))} /></div>
                  <div><Label>Balance</Label><Input type="number" value={form.current_balance} onChange={e => setForm(f => ({ ...f, current_balance: e.target.value }))} /></div>
                  <div>
                    <Label>Type</Label>
                    <Select value={form.account_type} onValueChange={v => setForm(f => ({ ...f, account_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{ACCOUNT_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={handleCreate} disabled={!form.account_name || create.isPending} className="w-full">Add Account</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Cash Position</p>
                <p className="text-3xl font-bold">${totalBalance.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead>NGO</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>As Of</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : !positions?.length ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No treasury accounts</TableCell></TableRow>
                ) : positions.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.account_name}</TableCell>
                    <TableCell className="text-sm">{p.bank_name || "—"}</TableCell>
                    <TableCell className="text-sm">{p.ngos?.common_name || p.ngos?.legal_name || "HQ"}</TableCell>
                    <TableCell><Badge variant="outline">{p.account_type.replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell className="font-mono">{p.currency}</TableCell>
                    <TableCell className="text-right font-mono font-medium">${Number(p.current_balance).toLocaleString()}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{format(new Date(p.as_of_date), "MMM d, yyyy")}</TableCell>
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
