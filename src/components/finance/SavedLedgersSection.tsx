import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SavedLedgerDocument } from "@/hooks/useSavedLedgerDocuments";
import { format } from "date-fns";
import { Eye, Trash2, Printer, FileText, Loader2 } from "lucide-react";

interface SavedLedgersSectionProps {
  documents: SavedLedgerDocument[];
  isLoading: boolean;
  onDelete?: (id: string) => void;
  deleting?: boolean;
}

export function SavedLedgersSection({ documents, isLoading, onDelete, deleting }: SavedLedgersSectionProps) {
  const [viewing, setViewing] = useState<SavedLedgerDocument | null>(null);

  const handlePrint = (doc: SavedLedgerDocument) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head><title>${doc.title}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 2rem; color: #1a1a1a; }
        table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
        th, td { border: 1px solid #d1d5db; padding: 8px 12px; text-align: left; font-size: 13px; }
        th { background: #f3f4f6; font-weight: 600; }
        .text-right { text-align: right; }
        .font-mono { font-family: 'SF Mono', Monaco, monospace; }
        .totals { background: #f9fafb; font-weight: 700; }
        h1 { font-size: 1.25rem; margin-bottom: 0.25rem; }
        .meta { color: #6b7280; font-size: 0.85rem; margin-bottom: 1rem; }
        @media print { body { padding: 0; } }
      </style>
      </head><body>${doc.html_content}
      <script>window.print();</script>
      </body></html>
    `);
    printWindow.document.close();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Saved Ledger Documents
        </CardTitle>
        <Badge variant="secondary">{documents.length}</Badge>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : documents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No saved ledger documents yet. Post a transaction and save it as a document.
          </div>
        ) : (
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead className="w-36">Saved</TableHead>
                  <TableHead className="w-28 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium text-sm">{doc.title}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(doc.created_at), "MMM d, yyyy h:mm a")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setViewing(doc)} title="View">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handlePrint(doc)} title="Print">
                          <Printer className="h-3.5 w-3.5" />
                        </Button>
                        {onDelete && (
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDelete(doc.id)} disabled={deleting} title="Delete">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{viewing?.title}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: viewing.html_content }} />
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => viewing && handlePrint(viewing)}>
              <Printer className="h-4 w-4 mr-1" /> Print
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
