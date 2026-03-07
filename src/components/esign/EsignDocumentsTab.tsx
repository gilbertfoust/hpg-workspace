import { useRef } from "react";
import { useEsignDocuments, useUploadEsignDocument, useDeleteEsignDocument } from "@/hooks/useEsignDocuments";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Upload, Trash2, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export function EsignDocumentsTab() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: documents, isLoading } = useEsignDocuments();
  const uploadMutation = useUploadEsignDocument();
  const deleteMutation = useDeleteEsignDocument();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are allowed for e-signatures");
      return;
    }
    try {
      await uploadMutation.mutateAsync(file);
      toast.success("Document uploaded successfully");
    } catch (error: any) {
      toast.error(error.message);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDelete = async (doc: (typeof documents extends (infer T)[] ? T : never)) => {
    try {
      await deleteMutation.mutateAsync(doc);
      toast.success("Document deleted");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Upload PDFs that need to be signed by external parties.
        </p>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleUpload}
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
            size="sm"
          >
            {uploadMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Upload PDF
          </Button>
        </div>
      </div>

      <div className="bg-card border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !documents?.length ? (
          <p className="py-8 text-center text-muted-foreground">
            No e-signature documents yet. Upload a PDF to get started.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Filename</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-red-500" />
                      <span className="font-medium">{doc.original_filename}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(doc.created_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(doc)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
