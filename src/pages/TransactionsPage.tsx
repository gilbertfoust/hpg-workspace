import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { TransactionsTable } from "@/components/finance/TransactionsTable";
import { JournalEntryTable } from "@/components/finance/JournalEntryTable";
import { TransactionForm } from "@/components/finance/TransactionForm";
import { SavedLedgersSection } from "@/components/finance/SavedLedgersSection";
import { generateTransactionHTML } from "@/components/finance/TransactionDocumentGenerator";
import { useTransactions, Transaction } from "@/hooks/useTransactions";
import { useJournalEntries } from "@/hooks/useJournalEntries";
import { useAccounts } from "@/hooks/useAccounts";
import { useSavedLedgerDocuments } from "@/hooks/useSavedLedgerDocuments";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Plus, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

const TransactionsPage = () => {
  const [ngoId, setNgoId] = useState<string>("");
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: ngos } = useQuery({
    queryKey: ["ngos_list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ngos").select("id, common_name, legal_name").order("common_name");
      if (error) throw error;
      return data || [];
    },
  });

  const activeNgoId = ngoId && ngoId !== "__all__" ? ngoId : undefined;
  const { data: transactions, isLoading, voidTransaction, create } = useTransactions(activeNgoId);
  const { data: entries } = useJournalEntries(selected?.id);
  const { data: accounts } = useAccounts(activeNgoId);
  const { data: savedDocs, isLoading: savedDocsLoading, save: saveLedgerDoc, remove: removeLedgerDoc } = useSavedLedgerDocuments(activeNgoId);

  const activeNgo = (ngos || []).find((n) => n.id === activeNgoId);
  const ngoName = activeNgo?.common_name || activeNgo?.legal_name || "NGO";

  const handleVoid = async (id: string) => {
    try {
      await voidTransaction.mutateAsync(id);
      toast({ title: "Transaction voided" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleSubmit = async (data: { transaction_date: string; description: string; reference_number: string; entries: any[] }) => {
    if (!activeNgoId) {
      toast({ variant: "destructive", title: "Please select an NGO first" });
      return;
    }
    try {
      await create.mutateAsync({
        transaction: {
          ngo_id: activeNgoId,
          fiscal_period_id: null,
          transaction_date: data.transaction_date,
          description: data.description,
          reference_number: data.reference_number || null,
          created_by_user_id: user?.id || null,
        },
        entries: data.entries,
      });
      toast({ title: "Transaction posted to General Ledger" });
      setFormOpen(false);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleSaveAsDocument = async () => {
    if (!selected || !entries || !accounts || !activeNgoId) return;
    try {
      const html = generateTransactionHTML(selected, entries, accounts, ngoName);
      const title = `${selected.description} — ${format(new Date(selected.transaction_date), "MMM d, yyyy")}`;
      await saveLedgerDoc.mutateAsync({
        ngo_id: activeNgoId,
        transaction_id: selected.id,
        title,
        html_content: html,
        saved_by_user_id: user?.id || null,
      });
      toast({ title: "Transaction saved as ledger document" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleDeleteDoc = async (id: string) => {
    try {
      await removeLedgerDoc.mutateAsync(id);
      toast({ title: "Ledger document deleted" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-2xl font-bold">Transactions & Journal Entries</h1>
          <div className="flex gap-2 items-center">
            <Select value={ngoId} onValueChange={(v) => { setNgoId(v); setSelected(null); setFormOpen(false); }}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Select NGO *" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All NGOs</SelectItem>
                {(ngos || []).map((n) => (
                  <SelectItem key={n.id} value={n.id}>{n.common_name || n.legal_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activeNgoId && (
              <Button onClick={() => setFormOpen(!formOpen)} variant={formOpen ? "secondary" : "default"}>
                <Plus className="h-4 w-4 mr-1" /> New Entry
              </Button>
            )}
          </div>
        </div>

        {!activeNgoId && (
          <div className="text-center text-muted-foreground py-12 border rounded-lg bg-muted/30">
            Select an NGO above to view and post transactions.
          </div>
        )}

        {activeNgoId && (
          <Collapsible open={formOpen} onOpenChange={setFormOpen}>
            <CollapsibleContent className="animate-accordion-down">
              {accounts && accounts.length > 0 ? (
                <TransactionForm accounts={accounts} onSubmit={handleSubmit} submitting={create.isPending} />
              ) : (
                <div className="border rounded-lg p-6 text-center text-muted-foreground">
                  No accounts found for this NGO. Please set up a Chart of Accounts first.
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}

        {activeNgoId && (
          <TransactionsTable transactions={transactions || []} isLoading={isLoading} onVoid={handleVoid} onSelect={setSelected} />
        )}

        {activeNgoId && (
          <SavedLedgersSection
            documents={savedDocs || []}
            isLoading={savedDocsLoading}
            onDelete={handleDeleteDoc}
            deleting={removeLedgerDoc.isPending}
          />
        )}

        <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
          <SheetContent className="sm:max-w-lg">
            <SheetHeader>
              <SheetTitle>Transaction Detail</SheetTitle>
            </SheetHeader>
            {selected && (
              <div className="space-y-4 mt-4">
                <div className="text-sm space-y-1">
                  <p><span className="font-medium">Date:</span> {format(new Date(selected.transaction_date), "MMM d, yyyy")}</p>
                  <p><span className="font-medium">Description:</span> {selected.description}</p>
                  {selected.reference_number && <p><span className="font-medium">Reference:</span> {selected.reference_number}</p>}
                  <p><span className="font-medium">Status:</span> {selected.is_void ? "Void" : "Posted"}</p>
                </div>
                {entries && accounts && <JournalEntryTable entries={entries} accounts={accounts} />}
                {entries && entries.length > 0 && !selected.is_void && (
                  <Button onClick={handleSaveAsDocument} disabled={saveLedgerDoc.isPending} className="w-full">
                    {saveLedgerDoc.isPending ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-1" />
                    )}
                    Save as Ledger Document
                  </Button>
                )}
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </MainLayout>
  );
};

export default TransactionsPage;
