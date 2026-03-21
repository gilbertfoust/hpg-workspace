import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNGOs } from "@/hooks/useNGOs";
import { useTaxRates } from "@/hooks/useTaxRates";
import { useInvoices } from "@/hooks/useInvoices";

function fmt(n: number) { return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export default function TaxLiabilityPage() {
  const { toast } = useToast();
  const { data: ngos } = useNGOs();
  const [selectedNgoId, setSelectedNgoId] = useState("");
  const { data: taxRates, create: createRate } = useTaxRates(selectedNgoId || undefined);
  const { data: invoices } = useInvoices(selectedNgoId || undefined);
  const [showCreate, setShowCreate] = useState(false);
  const [rateName, setRateName] = useState("");
  const [rateValue, setRateValue] = useState(0);

  const totalTaxCollected = useMemo(() => {
    return invoices?.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.tax_amount), 0) || 0;
  }, [invoices]);

  const totalTaxOutstanding = useMemo(() => {
    return invoices?.filter(i => i.status !== "paid" && i.status !== "void").reduce((s, i) => s + Number(i.tax_amount), 0) || 0;
  }, [invoices]);

  const handleCreateRate = async () => {
    if (!selectedNgoId || !rateName) return;
    try {
      await createRate.mutateAsync({ ngo_id: selectedNgoId, name: rateName, rate: rateValue });
      toast({ title: "Tax rate created" });
      setRateName(""); setRateValue(0); setShowCreate(false);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  return (
    <MainLayout title="Tax Liability" subtitle="Track tax collected and owed">
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex items-end gap-4">
          <div className="w-64">
            <Label>NGO</Label>
            <Select value={selectedNgoId} onValueChange={setSelectedNgoId}>
              <SelectTrigger><SelectValue placeholder="Select NGO" /></SelectTrigger>
              <SelectContent>{ngos?.map(n => <SelectItem key={n.id} value={n.id}>{n.legal_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        {selectedNgoId && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Tax Collected (Paid Invoices)</p><p className="text-2xl font-bold text-emerald-600">${fmt(totalTaxCollected)}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Tax Outstanding</p><p className="text-2xl font-bold text-amber-600">${fmt(totalTaxOutstanding)}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Tax Liability</p><p className="text-2xl font-bold">${fmt(totalTaxCollected + totalTaxOutstanding)}</p></CardContent></Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Tax Rates</CardTitle>
                  <Dialog open={showCreate} onOpenChange={setShowCreate}>
                    <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" /> Add Rate</Button></DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Add Tax Rate</DialogTitle></DialogHeader>
                      <div className="space-y-3">
                        <div><Label>Name</Label><Input value={rateName} onChange={e => setRateName(e.target.value)} placeholder="e.g., Sales Tax" /></div>
                        <div><Label>Rate (%)</Label><Input type="number" value={rateValue || ""} onChange={e => setRateValue(Number(e.target.value))} /></div>
                        <Button onClick={handleCreateRate} className="w-full" disabled={!rateName}>Add Rate</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead>Default</TableHead>
                      <TableHead>Active</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {taxRates?.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-right font-mono">{Number(r.rate).toFixed(2)}%</TableCell>
                        <TableCell>{r.is_default ? "Yes" : "No"}</TableCell>
                        <TableCell>{r.is_active ? "Active" : "Inactive"}</TableCell>
                      </TableRow>
                    ))}
                    {(!taxRates || taxRates.length === 0) && (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No tax rates configured</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </MainLayout>
  );
}
