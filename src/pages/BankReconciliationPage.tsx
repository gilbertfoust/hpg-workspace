import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, CheckCircle, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNGOs } from "@/hooks/useNGOs";
import { useFiscalPeriods } from "@/hooks/useFiscalPeriods";
import { useExtendedAccounts } from "@/hooks/useExtendedAccounts";
import { useBankReconciliations, useBankReconciliationItems } from "@/hooks/useBankReconciliations";
import { format } from "date-fns";
import Papa from "papaparse";

function fmt(n: number) { return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

const ITEM_TYPES = [
  { value: "deposit_in_transit", label: "Deposit in Transit" },
  { value: "outstanding_check", label: "Outstanding Check" },
  { value: "deposit_not_recorded", label: "Deposit Not Recorded" },
  { value: "transfer_not_recorded", label: "Transfer Not Recorded" },
  { value: "adjustment", label: "Adjustment" },
];

export default function BankReconciliationPage() {
  const { toast } = useToast();
  const { data: ngos } = useNGOs();
  const [selectedNgoId, setSelectedNgoId] = useState("");
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [selectedReconciliationId, setSelectedReconciliationId] = useState("");
  const [selectedBankAccountId, setSelectedBankAccountId] = useState("");
  const [startingBalance, setStartingBalance] = useState(0);

  const { data: periods } = useFiscalPeriods(selectedNgoId || undefined);
  const { data: accounts } = useExtendedAccounts(selectedNgoId || undefined);
  const bankAccounts = accounts?.filter(a => a.type === "asset") || [];
  const { data: reconciliations, create: createRecon, update: updateRecon } = useBankReconciliations(selectedNgoId || undefined);
  const { data: items, create: createItem, remove: removeItem } = useBankReconciliationItems(selectedReconciliationId || undefined);

  // New item form
  const [newItemType, setNewItemType] = useState("adjustment");
  const [newItemDate, setNewItemDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newItemAmount, setNewItemAmount] = useState(0);

  const handleCreateReconciliation = async () => {
    if (!selectedNgoId || !selectedPeriodId || !selectedBankAccountId) return;
    try {
      const result = await createRecon.mutateAsync({
        ngo_id: selectedNgoId,
        fiscal_period_id: selectedPeriodId,
        bank_account_id: selectedBankAccountId,
        starting_balance: startingBalance,
        adjusted_balance: startingBalance,
        status: "draft",
        notes: null,
      });
      setSelectedReconciliationId(result.id);
      toast({ title: "Reconciliation created" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleAddItem = async () => {
    if (!selectedReconciliationId || !newItemDescription) return;
    try {
      await createItem.mutateAsync({
        reconciliation_id: selectedReconciliationId,
        item_type: newItemType as any,
        item_date: newItemDate,
        description: newItemDescription,
        amount: newItemAmount,
        linked_transaction_id: null,
      });
      setNewItemDescription("");
      setNewItemAmount(0);
      toast({ title: "Item added" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const currentRecon = reconciliations?.find(r => r.id === selectedReconciliationId);
  
  const depositsInTransit = items?.filter(i => i.item_type === "deposit_in_transit") || [];
  const outstandingChecks = items?.filter(i => i.item_type === "outstanding_check") || [];
  const depositsNotRecorded = items?.filter(i => i.item_type === "deposit_not_recorded") || [];
  const transfersNotRecorded = items?.filter(i => i.item_type === "transfer_not_recorded") || [];
  const adjustments = items?.filter(i => i.item_type === "adjustment") || [];

  const sumItems = (arr: typeof items) => arr?.reduce((s, i) => s + Number(i.amount), 0) || 0;
  const adjustedBalance = (currentRecon?.starting_balance || 0)
    + sumItems(depositsInTransit)
    - sumItems(outstandingChecks)
    + sumItems(depositsNotRecorded)
    - sumItems(transfersNotRecorded)
    + sumItems(adjustments);

  const handleReconcile = async () => {
    if (!selectedReconciliationId) return;
    try {
      await updateRecon.mutateAsync({
        id: selectedReconciliationId,
        adjusted_balance: adjustedBalance,
        status: "reconciled",
      });
      toast({ title: "Reconciliation completed" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const ItemSection = ({ title, items: sectionItems }: { title: string; items: typeof items }) => (
    <div>
      <p className="text-sm font-semibold text-muted-foreground mb-2">{title}</p>
      {sectionItems && sectionItems.length > 0 ? (
        <div className="space-y-1">
          {sectionItems.map(item => (
            <div key={item.id} className="flex items-center justify-between py-1 px-3 border rounded">
              <div className="flex items-center gap-3">
                <span className="text-sm">{format(new Date(item.item_date), "MMM d")}</span>
                <span className="text-sm">{item.description}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm">{fmt(item.amount)}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeItem.mutate(item.id)}>
                  <Trash2 className="w-3 h-3 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">None</p>
      )}
    </div>
  );

  return (
    <MainLayout title="Bank Reconciliation" subtitle="Reconcile bank accounts with the general ledger">
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Setup */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div>
                <Label>NGO</Label>
                <Select value={selectedNgoId} onValueChange={setSelectedNgoId}>
                  <SelectTrigger><SelectValue placeholder="Select NGO" /></SelectTrigger>
                  <SelectContent>{ngos?.map(n => <SelectItem key={n.id} value={n.id}>{n.legal_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Period</Label>
                <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
                  <SelectTrigger><SelectValue placeholder="Period" /></SelectTrigger>
                  <SelectContent>{periods?.map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Bank Account</Label>
                <Select value={selectedBankAccountId} onValueChange={setSelectedBankAccountId}>
                  <SelectTrigger><SelectValue placeholder="Account" /></SelectTrigger>
                  <SelectContent>{bankAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Starting Balance</Label>
                <Input type="number" value={startingBalance} onChange={e => setStartingBalance(Number(e.target.value))} />
              </div>
              <Button onClick={handleCreateReconciliation} disabled={!selectedNgoId || !selectedPeriodId || !selectedBankAccountId}>
                <Plus className="w-4 h-4 mr-1" /> New Recon
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Existing reconciliations */}
        {reconciliations && reconciliations.length > 0 && !selectedReconciliationId && (
          <Card>
            <CardHeader><CardTitle>Reconciliations</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {reconciliations.map(r => (
                  <div key={r.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                       onClick={() => setSelectedReconciliationId(r.id)}>
                    <div>
                      <p className="font-medium">Starting: {fmt(r.starting_balance)} → Adjusted: {fmt(r.adjusted_balance)}</p>
                      <p className="text-sm text-muted-foreground">{format(new Date(r.created_at), "MMM d, yyyy")}</p>
                    </div>
                    <Badge variant={r.status === "reconciled" ? "default" : "outline"} className="capitalize">{r.status}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Reconciliation Detail */}
        {selectedReconciliationId && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Starting Balance</p>
                  <p className="text-xl font-bold">{fmt(currentRecon?.starting_balance || 0)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Adjusted Balance</p>
                  <p className="text-xl font-bold">{fmt(adjustedBalance)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant={currentRecon?.status === "reconciled" ? "default" : "outline"} className="capitalize mt-1">
                    {currentRecon?.status || "draft"}
                  </Badge>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Reconciliation Items</CardTitle>
                  {currentRecon?.status !== "reconciled" && (
                    <Button onClick={handleReconcile} className="gap-2">
                      <CheckCircle className="w-4 h-4" /> Mark Reconciled
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ItemSection title="Deposits in Transit" items={depositsInTransit} />
                <ItemSection title="Outstanding Checks" items={outstandingChecks} />
                <ItemSection title="Deposits Not Recorded" items={depositsNotRecorded} />
                <ItemSection title="Transfers Not Recorded" items={transfersNotRecorded} />
                <ItemSection title="Adjustments" items={adjustments} />

                {currentRecon?.status !== "reconciled" && (
                  <div className="border-t pt-4">
                    <p className="text-sm font-semibold mb-3">Add Item</p>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                      <Select value={newItemType} onValueChange={setNewItemType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ITEM_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input type="date" value={newItemDate} onChange={e => setNewItemDate(e.target.value)} />
                      <Input placeholder="Description" value={newItemDescription} onChange={e => setNewItemDescription(e.target.value)} />
                      <Input type="number" placeholder="Amount" value={newItemAmount || ""} onChange={e => setNewItemAmount(Number(e.target.value))} />
                      <Button onClick={handleAddItem} disabled={!newItemDescription}>
                        <Plus className="w-4 h-4 mr-1" /> Add
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </MainLayout>
  );
}
