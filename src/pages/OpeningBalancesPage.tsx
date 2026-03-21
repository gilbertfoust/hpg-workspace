import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Save } from "lucide-react";
import { useNGOs } from "@/hooks/useNGOs";
import { useFiscalPeriods } from "@/hooks/useFiscalPeriods";
import { useAccounts } from "@/hooks/useAccounts";
import { useOpeningBalances } from "@/hooks/useOpeningBalances";
import { useToast } from "@/hooks/use-toast";

export default function OpeningBalancesPage() {
  const { toast } = useToast();
  const { data: ngos } = useNGOs();
  const [ngoId, setNgoId] = useState("");
  const [periodId, setPeriodId] = useState("");
  const { data: periods } = useFiscalPeriods(ngoId || undefined);
  const { data: accounts } = useAccounts(ngoId || undefined);
  const { data: balances, upsert } = useOpeningBalances(ngoId || undefined, periodId || undefined);

  const [edits, setEdits] = useState<Record<string, number>>({});

  const getBalance = (accountId: string) => {
    if (edits[accountId] !== undefined) return edits[accountId];
    const ob = balances?.find(b => b.account_id === accountId);
    return ob?.amount ?? 0;
  };

  const handleChange = (accountId: string, value: string) => {
    setEdits(prev => ({ ...prev, [accountId]: Number(value) || 0 }));
  };

  const handleSave = async (accountId: string) => {
    if (!ngoId || !periodId) return;
    try {
      await upsert.mutateAsync({
        ngo_id: ngoId,
        fiscal_period_id: periodId,
        account_id: accountId,
        amount: getBalance(accountId),
      });
      const newEdits = { ...edits };
      delete newEdits[accountId];
      setEdits(newEdits);
      toast({ title: "Opening balance saved" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const bsAccounts = accounts?.filter(a => ["asset", "liability", "equity"].includes(a.type)) || [];

  return (
    <MainLayout title="Opening Balances" subtitle="Set beginning balances for each fiscal period">
      <div className="space-y-6 max-w-5xl mx-auto">
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>NGO</Label>
                <Select value={ngoId} onValueChange={(v) => { setNgoId(v); setEdits({}); }}>
                  <SelectTrigger><SelectValue placeholder="Select NGO" /></SelectTrigger>
                  <SelectContent>{ngos?.map(n => <SelectItem key={n.id} value={n.id}>{n.legal_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fiscal Period</Label>
                <Select value={periodId} onValueChange={(v) => { setPeriodId(v); setEdits({}); }}>
                  <SelectTrigger><SelectValue placeholder="Select Period" /></SelectTrigger>
                  <SelectContent>{periods?.map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {ngoId && periodId && (
          <Card>
            <CardHeader><CardTitle>Balance Sheet Accounts</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="w-48">Opening Balance</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bsAccounts.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No balance sheet accounts found</TableCell></TableRow>
                  ) : bsAccounts.map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono text-sm">{a.code}</TableCell>
                      <TableCell>{a.name}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize text-xs">{a.type}</Badge></TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={getBalance(a.id)}
                          onChange={(e) => handleChange(a.id, e.target.value)}
                          className="w-full"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSave(a.id)}
                          disabled={edits[a.id] === undefined}
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
