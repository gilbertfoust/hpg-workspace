import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, BookOpenCheck, RotateCcw, Ban, Send, Eye, Pencil, Trash2 } from "lucide-react";
import { FinanceJournalEntryDialog } from "@/components/finance/accounting/FinanceJournalEntryDialog";
import { useFinanceAccounts } from "@/hooks/useFinanceAccounts";
import { useFinanceFunds } from "@/hooks/useFinanceFunds";
import { useFinanceFiscalPeriods } from "@/hooks/useFinanceFiscalPeriods";
import {
  useDeleteFinanceJournalEntry,
  useFinanceJournalAuditEvents,
  useFinanceJournalEntries,
  useFinanceJournalReferenceData,
  usePostFinanceJournalEntry,
  useReverseFinanceJournalEntry,
  useSaveFinanceJournalEntry,
  useVoidFinanceJournalEntry,
} from "@/hooks/useFinanceJournalEntries";
import type { FinanceJournalEntrySavePayload, FinanceJournalEntryStatus, FinanceJournalEntryWithLines } from "@/types/financeAccounting";
import { FINANCE_JOURNAL_STATUS_LABELS } from "@/types/financeAccounting";
import { computeJournalTotals } from "@/types/financeAccounting";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import {
  uploadFinanceSupportingDocument,
  useLinkFinanceDocument,
} from "@/hooks/useFinanceDocumentLinks";
import { hasFinancePermission } from "@/lib/financePermissions";

const statusVariant = (status: FinanceJournalEntryStatus): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case "posted":
      return "default";
    case "draft":
      return "secondary";
    case "voided":
    case "reversed":
      return "destructive";
    default:
      return "outline";
  }
};

const formatMoney = (value: number) =>
  value.toLocaleString(undefined, { style: "currency", currency: "USD" });

const FinanceJournalEntriesPage = () => {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewEntry, setViewEntry] = useState<FinanceJournalEntryWithLines | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [reverseDialogOpen, setReverseDialogOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [reversalDate, setReversalDate] = useState(new Date().toISOString().slice(0, 10));
  const [reversalMemo, setReversalMemo] = useState("");
  const [auditEntryId, setAuditEntryId] = useState<string | null>(null);

  const { data: entries = [], isLoading, error } = useFinanceJournalEntries();
  const { data: accounts = [] } = useFinanceAccounts();
  const { data: funds = [] } = useFinanceFunds();
  const { data: fiscalPeriods = [] } = useFinanceFiscalPeriods();
  const { data: referenceData } = useFinanceJournalReferenceData();
  const { data: auditEvents = [] } = useFinanceJournalAuditEvents(auditEntryId);

  const saveEntry = useSaveFinanceJournalEntry();
  const linkDocument = useLinkFinanceDocument();
  const deleteEntry = useDeleteFinanceJournalEntry();
  const postEntry = usePostFinanceJournalEntry();
  const voidEntry = useVoidFinanceJournalEntry();
  const reverseEntry = useReverseFinanceJournalEntry();
  const { role } = useUserRole();
  const { toast } = useToast();
  const canPost = hasFinancePermission(role, "post_journal");
  const canVoid = hasFinancePermission(role, "void_transaction");

  const filteredEntries = useMemo(() => {
    if (statusFilter === "all") return entries;
    return entries.filter((entry) => entry.status === statusFilter);
  }, [entries, statusFilter]);

  const openCreate = () => {
    setViewEntry(null);
    setReadOnly(false);
    setDialogOpen(true);
  };

  const openEdit = (entry: FinanceJournalEntryWithLines) => {
    setViewEntry(entry);
    setReadOnly(false);
    setDialogOpen(true);
  };

  const openView = (entry: FinanceJournalEntryWithLines) => {
    setViewEntry(entry);
    setReadOnly(true);
    setDialogOpen(true);
  };

  const handleSave = async ({ input, receipt }: FinanceJournalEntrySavePayload) => {
    const saved = await saveEntry.mutateAsync({ id: viewEntry?.id, input });

    if (!receipt || !saved?.id) return;

    try {
      let documentId = receipt.existingDocumentId || null;
      if (receipt.file) {
        documentId = await uploadFinanceSupportingDocument(receipt.file);
      }

      if (!documentId) return;

      await linkDocument.mutateAsync({
        documentId,
        entityType: "journal_entry",
        entityId: saved.id,
        linkNotes: receipt.linkNotes || undefined,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Journal saved but receipt could not be attached",
        description: error instanceof Error ? error.message : "Try linking the receipt from the entry editor.",
      });
    }
  };

  const handlePost = async (entry: FinanceJournalEntryWithLines) => {
    const totals = computeJournalTotals(entry.lines);
    if (!totals.isBalanced) return;
    await postEntry.mutateAsync(entry.id);
  };

  const handleVoid = async () => {
    if (!viewEntry) return;
    await voidEntry.mutateAsync({ entryId: viewEntry.id, reason: voidReason.trim() || undefined });
    setVoidDialogOpen(false);
    setVoidReason("");
    setViewEntry(null);
  };

  const handleReverse = async () => {
    if (!viewEntry) return;
    await reverseEntry.mutateAsync({
      entryId: viewEntry.id,
      reversalDate,
      memo: reversalMemo.trim() || undefined,
    });
    setReverseDialogOpen(false);
    setReversalMemo("");
    setViewEntry(null);
  };

  const isSaving = saveEntry.isPending;

  return (
    <MainLayout
      title="Journal Entries"
      subtitle="Double-entry journal — draft, post, void, and reverse with audit trail"
    >
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpenCheck className="h-4 w-4" />
                HPG Accounting Journal Entries
              </CardTitle>
              <CardDescription>
                Create balanced journal entries tied to accounts, funds, NGOs, departments, and supporting documents.
                Posted entries are locked; use void or reverse workflows instead of editing.
              </CardDescription>
            </div>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              New journal entry
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <Label>Status filter</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {(Object.keys(FINANCE_JOURNAL_STATUS_LABELS) as FinanceJournalEntryStatus[]).map((status) => (
                      <SelectItem key={status} value={status}>
                        {FINANCE_JOURNAL_STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <p className="text-sm text-destructive py-6 text-center">
                {(error as Error).message.includes("does not exist")
                  ? "Finance accounting tables are not applied yet. Run the Phase 31 migration locally before using journal entries."
                  : (error as Error).message}
              </p>
            ) : filteredEntries.length === 0 ? (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                No journal entries yet. Create a draft entry with at least two balanced lines, then post when ready.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="p-3">Number</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Memo</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Created by</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.map((entry) => {
                      const amount = entry.total_debit ?? 0;
                      const balanced = computeJournalTotals(entry.lines).isBalanced;
                      return (
                        <tr key={entry.id} className="border-b hover:bg-muted/40">
                          <td className="p-3 font-mono">{entry.entry_number}</td>
                          <td className="p-3">{entry.entry_date}</td>
                          <td className="p-3 max-w-xs truncate">{entry.memo || "—"}</td>
                          <td className="p-3">{formatMoney(amount)}</td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1">
                              <Badge variant={statusVariant(entry.status)}>
                                {FINANCE_JOURNAL_STATUS_LABELS[entry.status]}
                              </Badge>
                              {entry.status === "draft" && !balanced && amount > 0 && (
                                <Badge variant="outline">Unbalanced</Badge>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-muted-foreground">{entry.created_by_name || "—"}</td>
                          <td className="p-3">
                            <div className="flex justify-end flex-wrap gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openView(entry)}>
                                <Eye className="h-3 w-3 mr-1" />
                                View
                              </Button>
                              {entry.status === "draft" && (
                                <>
                                  <Button variant="ghost" size="sm" onClick={() => openEdit(entry)}>
                                    <Pencil className="h-3 w-3 mr-1" />
                                    Edit
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handlePost(entry)}
                                    disabled={!balanced || postEntry.isPending || !canPost}
                                  >
                                    <Send className="h-3 w-3 mr-1" />
                                    Post
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive"
                                    onClick={() => deleteEntry.mutate(entry.id)}
                                    disabled={deleteEntry.isPending}
                                  >
                                    <Trash2 className="h-3 w-3 mr-1" />
                                    Delete
                                  </Button>
                                </>
                              )}
                              {entry.status === "posted" && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setViewEntry(entry);
                                      setVoidDialogOpen(true);
                                    }}
                                  >
                                    <Ban className="h-3 w-3 mr-1" />
                                    Void
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setViewEntry(entry);
                                      setReversalDate(new Date().toISOString().slice(0, 10));
                                      setReversalMemo(`Reversal of ${entry.entry_number}`);
                                      setReverseDialogOpen(true);
                                    }}
                                  >
                                    <RotateCcw className="h-3 w-3 mr-1" />
                                    Reverse
                                  </Button>
                                </>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setAuditEntryId(entry.id)}
                              >
                                Audit
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <FinanceJournalEntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entry={viewEntry}
        readOnly={readOnly}
        accounts={accounts}
        funds={funds}
        fiscalPeriods={fiscalPeriods}
        referenceData={referenceData}
        onSave={handleSave}
        isSaving={isSaving}
      />

      <Dialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void journal entry</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Voiding marks the entry as voided without deleting it. This action is audited.
          </p>
          <div className="space-y-2">
            <Label htmlFor="void-reason">Reason</Label>
            <Textarea
              id="void-reason"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Why is this entry being voided?"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleVoid} disabled={voidEntry.isPending || !canVoid}>
              Void entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reverseDialogOpen} onOpenChange={setReverseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reverse journal entry</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Creates a new reversing entry with swapped debits/credits and posts it automatically.
          </p>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reversal-date">Reversal date</Label>
              <Input
                id="reversal-date"
                type="date"
                value={reversalDate}
                onChange={(e) => setReversalDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reversal-memo">Memo</Label>
              <Textarea
                id="reversal-memo"
                value={reversalMemo}
                onChange={(e) => setReversalMemo(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReverseDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleReverse} disabled={reverseEntry.isPending || !canVoid}>
              Post reversal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!auditEntryId} onOpenChange={(open) => !open && setAuditEntryId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Audit trail</DialogTitle>
          </DialogHeader>
          {auditEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No audit events recorded for this entry.</p>
          ) : (
            <ul className="space-y-3 max-h-80 overflow-y-auto">
              {auditEvents.map((event) => (
                <li key={event.id} className="rounded-md border p-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium capitalize">{event.action}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(event.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs mt-1">
                    {event.actor_name || "System"}
                  </p>
                  {Object.keys(event.metadata_json).length > 0 && (
                    <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto">
                      {JSON.stringify(event.metadata_json, null, 2)}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAuditEntryId(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default FinanceJournalEntriesPage;
