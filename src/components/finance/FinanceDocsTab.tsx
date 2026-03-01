import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDocuments, useUploadDocument, useDocumentUrl, Document } from "@/hooks/useDocuments";
import { format } from "date-fns";
import { Upload, Download, Eye, FileText, Loader2 } from "lucide-react";

interface FinanceDocsTabProps {
  ngoId: string;
}

const formatSize = (bytes: number | null) => {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function FinanceDocsTab({ ngoId }: FinanceDocsTabProps) {
  const { data: docs, isLoading } = useDocuments({ ngo_id: ngoId, category: "finance" });
  const upload = useUploadDocument();
  const { downloadDocument, previewDocument } = useDocumentUrl();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await upload.mutateAsync({ file, ngoId, category: "finance" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">Financial Documents</CardTitle>
        <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
          Upload Document
        </Button>
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : !docs || docs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No financial documents uploaded yet.</p>
            <p className="text-xs mt-1">Upload budgets, reports, receipts, or supporting evidence.</p>
          </div>
        ) : (
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File Name</TableHead>
                  <TableHead className="w-24">Type</TableHead>
                  <TableHead className="w-20">Size</TableHead>
                  <TableHead className="w-28">Uploaded</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docs.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium text-sm truncate max-w-[250px]">{doc.file_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{doc.file_type?.split("/").pop() || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatSize(doc.file_size)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{format(new Date(doc.uploaded_at), "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      <Badge variant={doc.review_status === "approved" ? "default" : doc.review_status === "rejected" ? "destructive" : "secondary"} className="text-[10px]">
                        {doc.review_status || "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => previewDocument(doc.file_path)} title="Preview">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => downloadDocument(doc.file_path, doc.file_name)} title="Download">
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
