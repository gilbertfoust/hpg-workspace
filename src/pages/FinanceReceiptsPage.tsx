import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Paperclip, Upload, AlertCircle, CheckCircle2 } from "lucide-react";
import { DocumentUploadDialog } from "@/components/documents/DocumentUploadDialog";
import { FinanceDocumentLinkDialog } from "@/components/finance/accounting/FinanceDocumentLinkDialog";
import {
  useFinanceDocumentsPicker,
  useFinanceReceiptCoverage,
  useLinkFinanceDocument,
} from "@/hooks/useFinanceDocumentLinks";
import type { FinanceReceiptStatus } from "@/types/financeAccounting";
import { FINANCE_JOURNAL_STATUS_LABELS } from "@/types/financeAccounting";

const receiptBadge = (status: FinanceReceiptStatus) => {
  switch (status) {
    case "attached":
      return (
        <Badge className="gap-1 bg-green-600 hover:bg-green-600">
          <CheckCircle2 className="h-3 w-3" />
          Receipt attached
        </Badge>
      );
    case "partial":
      return (
        <Badge variant="outline" className="gap-1 border-amber-500 text-amber-700">
          Partial
        </Badge>
      );
    default:
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="h-3 w-3" />
          Missing receipt
        </Badge>
      );
  }
};

const FinanceReceiptsPage = () => {
  const [statusFilter, setStatusFilter] = useState<"all" | FinanceReceiptStatus>("missing");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [linkTarget, setLinkTarget] = useState<{ id: string; label: string } | null>(null);

  const { data, isLoading, error } = useFinanceReceiptCoverage();
  const { data: documents = [], refetch: refetchDocuments } = useFinanceDocumentsPicker();
  const linkDocument = useLinkFinanceDocument();

  const entries = data?.entries ?? [];

  const filteredEntries = useMemo(() => {
    if (statusFilter === "all") return entries;
    return entries.filter((entry) => entry.receipt_status === statusFilter);
  }, [entries, statusFilter]);

  const handleLink = async (input: { documentId: string; linkNotes?: string }) => {
    if (!linkTarget) return;
    await linkDocument.mutateAsync({
      documentId: input.documentId,
      entityType: "journal_entry",
      entityId: linkTarget.id,
      linkNotes: input.linkNotes,
    });
  };

  return (
    <MainLayout
      title="Receipts & Supporting Documents"
      subtitle="Link receipts to journal entries — finance uploads route to the Finance inbox"
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Missing receipts</CardDescription>
              <CardTitle className="text-2xl text-destructive">{data?.missingCount ?? 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Receipt attached</CardDescription>
              <CardTitle className="text-2xl text-green-600">{data?.attachedCount ?? 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Tracked entries</CardDescription>
              <CardTitle className="text-2xl">{entries.length}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Paperclip className="h-4 w-4" />
                Finance receipt coverage
              </CardTitle>
              <CardDescription>
                Posted and draft journal entries are checked for linked documents, line-level document IDs, and
                finance_document_links records. Upload new files via Finance Document routing to the Finance work inbox.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setUploadOpen(true);
              }}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload finance document
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Receipt status filter</Label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All entries</SelectItem>
                  <SelectItem value="missing">Missing receipt</SelectItem>
                  <SelectItem value="attached">Receipt attached</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <p className="text-sm text-destructive py-6 text-center">
                {(error as Error).message.includes("does not exist")
                  ? "Finance document link tables are not applied yet. Run the Phase 35 migration locally."
                  : (error as Error).message}
              </p>
            ) : filteredEntries.length === 0 ? (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                {statusFilter === "missing"
                  ? "No journal entries are missing receipts for the current filter."
                  : "No journal entries match this filter."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="p-3">Entry</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Memo</th>
                      <th className="p-3">JE status</th>
                      <th className="p-3">Receipt</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.map((entry) => (
                      <tr key={entry.id} className="border-b hover:bg-muted/40">
                        <td className="p-3 font-mono">{entry.entry_number}</td>
                        <td className="p-3">{entry.entry_date}</td>
                        <td className="p-3 max-w-xs truncate">{entry.memo || "—"}</td>
                        <td className="p-3">
                          <Badge variant="outline">{FINANCE_JOURNAL_STATUS_LABELS[entry.status]}</Badge>
                        </td>
                        <td className="p-3">{receiptBadge(entry.receipt_status)}</td>
                        <td className="p-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setLinkTarget({ id: entry.id, label: entry.entry_number })}
                          >
                            <Paperclip className="h-3 w-3 mr-1" />
                            Link receipt
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <DocumentUploadDialog
        open={uploadOpen}
        onOpenChange={(open) => {
          setUploadOpen(open);
          if (!open) void refetchDocuments();
        }}
        defaultRouteType="finance"
      />

      {linkTarget && (
        <FinanceDocumentLinkDialog
          open={!!linkTarget}
          onOpenChange={(open) => !open && setLinkTarget(null)}
          entityType="journal_entry"
          entityId={linkTarget.id}
          entityLabel={linkTarget.label}
          documents={documents}
          onLink={handleLink}
          isLinking={linkDocument.isPending}
        />
      )}
    </MainLayout>
  );
};

export default FinanceReceiptsPage;
