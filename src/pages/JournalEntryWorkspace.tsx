import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Save, Send, AlertCircle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useExtendedAccounts, defaultNormalBalance } from "@/hooks/useExtendedAccounts";
import { useTransactions } from "@/hooks/useTransactions";
import { useFiscalPeriods } from "@/hooks/useFiscalPeriods";
import { useNGOs } from "@/hooks/useNGOs";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

interface JournalLine {
  key: string;
  account_id: string;
  debit: number;
  credit: number;
  memo: string;
}

function newLine(): JournalLine {
  return { key: crypto.randomUUID(), account_id: "", debit: 0, credit: 0, memo: "" };
}

export default function JournalEntryWorkspace() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: ngos } = useNGOs();
  const [selectedNgoId, setSelectedNgoId] = useState<string>("");
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const [transactionDate, setTransactionDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [referenceNumber, setReferenceNumber] = useState("");
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<JournalLine[]>([newLine(), newLine()]);
  const [accountSearch, setAccountSearch] = useState("");
  const [posting, setPosting] = useState(false);

  const { data: accounts } = useExtendedAccounts(selectedNgoId || undefined);
  const { data: periods } = useFiscalPeriods(selectedNgoId || undefined);
  const transactions = useTransactions(selectedNgoId || undefined, selectedPeriodId || undefined);

  const totalDebit = useMemo(() => lines.reduce((s, l) => s + l.debit, 0), [lines]);
  const totalCredit = useMemo(() => lines.reduce((s, l) => s + l.credit, 0), [lines]);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const filteredAccounts = useMemo(() => {
    if (!accounts) return [];
    if (!accountSearch) return accounts;
    const lower = accountSearch.toLowerCase();
    return accounts.filter(
      (a) => a.code.toLowerCase().includes(lower) || a.name.toLowerCase().includes(lower)
    );
  }, [accounts, accountSearch]);

  const updateLine = (key: string, field: keyof JournalLine, value: string | number) => {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, [field]: value } : l))
    );
  };

  const removeLine = (key: string) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
  };

  const handlePost = async () => {
    if (!selectedNgoId || !isBalanced) return;

    // Check fiscal period lock
    const period = periods?.find((p) => p.id === selectedPeriodId);
    if (period && (period as any).is_locked) {
      toast({ variant: "destructive", title: "Period locked", description: "This fiscal period is locked." });
      return;
    }

    setPosting(true);
    try {
      await transactions.create.mutateAsync({
        transaction: {
          ngo_id: selectedNgoId,
          fiscal_period_id: selectedPeriodId || null,
          transaction_date: transactionDate,
          description,
          reference_number: referenceNumber || null,
          created_by_user_id: user?.id || null,
          source_module: "journal_workspace",
        },
        entries: lines
          .filter((l) => l.account_id && (l.debit > 0 || l.credit > 0))
          .map((l) => ({
            account_id: l.account_id,
            debit: l.debit,
            credit: l.credit,
            memo: l.memo || undefined,
          })),
      });

      toast({ title: "Journal entry posted", description: `Ref: ${referenceNumber || "—"}` });
      // Reset form
      setLines([newLine(), newLine()]);
      setReferenceNumber("");
      setDescription("");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Post failed", description: err.message });
    } finally {
      setPosting(false);
    }
  };

  const getAccountLabel = (id: string) => {
    const a = accounts?.find((acc) => acc.id === id);
    return a ? `${a.code} — ${a.name}` : "";
  };

  const getNormalBadge = (id: string) => {
    const a = accounts?.find((acc) => acc.id === id);
    if (!a) return null;
    const nb = a.normal_balance || defaultNormalBalance(a.type);
    return (
      <Badge variant="outline" className="text-xs capitalize">
        {nb}
      </Badge>
    );
  };

  return (
    <MainLayout title="Journal Entry Workspace" subtitle="Batch journal entries with debit/credit balancing">
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header Controls */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <Label>NGO</Label>
                <Select value={selectedNgoId} onValueChange={setSelectedNgoId}>
                  <SelectTrigger><SelectValue placeholder="Select NGO" /></SelectTrigger>
                  <SelectContent>
                    {ngos?.map((n) => (
                      <SelectItem key={n.id} value={n.id}>{n.legal_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fiscal Period</Label>
                <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
                  <SelectTrigger><SelectValue placeholder="Select Period" /></SelectTrigger>
                  <SelectContent>
                    {periods?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} />
              </div>
              <div>
                <Label>Reference #</Label>
                <Input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} placeholder="JE-001" />
              </div>
              <div>
                <Label>Description</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Journal entry description" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Journal Lines */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Journal Lines</CardTitle>
              <div className="flex items-center gap-3">
                {isBalanced ? (
                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                    <CheckCircle className="w-3.5 h-3.5 mr-1" /> Balanced
                  </Badge>
                ) : totalDebit > 0 || totalCredit > 0 ? (
                  <Badge variant="destructive">
                    <AlertCircle className="w-3.5 h-3.5 mr-1" /> 
                    Out of balance: {Math.abs(totalDebit - totalCredit).toFixed(2)}
                  </Badge>
                ) : null}
                <Button size="sm" variant="outline" onClick={() => setLines((prev) => [...prev, newLine()])}>
                  <Plus className="w-4 h-4 mr-1" /> Add Line
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-3">
              <Input
                placeholder="Search accounts by code or name..."
                value={accountSearch}
                onChange={(e) => setAccountSearch(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Account</TableHead>
                    <TableHead className="w-[80px]">Normal</TableHead>
                    <TableHead className="w-[140px] text-right">Debit</TableHead>
                    <TableHead className="w-[140px] text-right">Credit</TableHead>
                    <TableHead className="w-[200px]">Memo</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line) => (
                    <TableRow key={line.key}>
                      <TableCell>
                        <Select value={line.account_id} onValueChange={(v) => updateLine(line.key, "account_id", v)}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select account" />
                          </SelectTrigger>
                          <SelectContent>
                            {(accountSearch ? filteredAccounts : accounts)?.map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.code} — {a.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>{getNormalBadge(line.account_id)}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={line.debit || ""}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            updateLine(line.key, "debit", val);
                            if (val > 0) updateLine(line.key, "credit", 0);
                          }}
                          className="h-9 text-right"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={line.credit || ""}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            updateLine(line.key, "credit", val);
                            if (val > 0) updateLine(line.key, "debit", 0);
                          }}
                          className="h-9 text-right"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={line.memo}
                          onChange={(e) => updateLine(line.key, "memo", e.target.value)}
                          className="h-9"
                          placeholder="Memo"
                        />
                      </TableCell>
                      <TableCell>
                        {lines.length > 2 && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeLine(line.key)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Totals row */}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={2} className="text-right">Totals</TableCell>
                    <TableCell className="text-right">{totalDebit.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{totalCredit.toFixed(2)}</TableCell>
                    <TableCell colSpan={2}></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end mt-4 gap-3">
              <Button
                onClick={handlePost}
                disabled={!isBalanced || !selectedNgoId || posting}
              >
                <Send className="w-4 h-4 mr-2" />
                {posting ? "Posting..." : "Post Journal Entry"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
