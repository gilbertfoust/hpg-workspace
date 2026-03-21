import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNGOs } from "@/hooks/useNGOs";
import { useRecurringTransactions } from "@/hooks/useRecurringTransactions";
import { format } from "date-fns";

const FREQUENCIES = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annual", label: "Annual" },
];

export default function RecurringTransactionsPage() {
  const { toast } = useToast();
  const { data: ngos } = useNGOs();
  const [selectedNgoId, setSelectedNgoId] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const { data: recurring, create, update, remove } = useRecurringTransactions(selectedNgoId || undefined);

  const [templateName, setTemplateName] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [nextRunDate, setNextRunDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);

  const handleCreate = async () => {
    if (!selectedNgoId || !templateName || !nextRunDate) return;
    try {
      await create.mutateAsync({
        ngo_id: selectedNgoId,
        template_name: templateName,
        frequency,
        next_run_date: nextRunDate,
        transaction_template: { description, amount },
      });
      toast({ title: "Recurring transaction created" });
      setTemplateName(""); setDescription(""); setAmount(0);
      setShowCreate(false);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    await update.mutateAsync({ id, is_active: !currentActive });
  };

  return (
    <MainLayout title="Recurring Transactions" subtitle="Automate repetitive journal entries">
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex items-end gap-4">
          <div className="w-64">
            <Label>NGO</Label>
            <Select value={selectedNgoId} onValueChange={setSelectedNgoId}>
              <SelectTrigger><SelectValue placeholder="Select NGO" /></SelectTrigger>
              <SelectContent>{ngos?.map(n => <SelectItem key={n.id} value={n.id}>{n.legal_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {selectedNgoId && (
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
              <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" /> New Recurring</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create Recurring Transaction</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Template Name</Label><Input value={templateName} onChange={e => setTemplateName(e.target.value)} /></div>
                  <div>
                    <Label>Frequency</Label>
                    <Select value={frequency} onValueChange={setFrequency}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Next Run Date</Label><Input type="date" value={nextRunDate} onChange={e => setNextRunDate(e.target.value)} /></div>
                  <div><Label>Description</Label><Input value={description} onChange={e => setDescription(e.target.value)} /></div>
                  <div><Label>Amount</Label><Input type="number" value={amount || ""} onChange={e => setAmount(Number(e.target.value))} /></div>
                  <Button onClick={handleCreate} className="w-full" disabled={!templateName}>Create</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {selectedNgoId && (
          <Card>
            <CardHeader><CardTitle>Recurring Transactions</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Template</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Next Run</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recurring?.map(r => {
                    const tmpl = r.transaction_template as any;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.template_name}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{r.frequency}</Badge></TableCell>
                        <TableCell>{format(new Date(r.next_run_date), "MMM d, yyyy")}</TableCell>
                        <TableCell className="font-mono">${tmpl?.amount?.toLocaleString() || "—"}</TableCell>
                        <TableCell>
                          <Switch checked={r.is_active} onCheckedChange={() => toggleActive(r.id, r.is_active)} />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => remove.mutate(r.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(!recurring || recurring.length === 0) && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No recurring transactions</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
