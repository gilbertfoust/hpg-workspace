import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocumentUploadDialog } from "@/components/documents/DocumentUploadDialog";
import { EsignDocumentsTab } from "@/components/esign/EsignDocumentsTab";
import { SigningRequestsTab } from "@/components/esign/SigningRequestsTab";
import { PdfViewerDialog } from "@/components/pdf/PdfViewerDialog";
import { PdfMergeSplitDialog } from "@/components/pdf/PdfMergeSplitDialog";
import { Link } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Upload,
  Filter,
  MoreHorizontal,
  FileText,
  FileImage,
  FileSpreadsheet,
  File,
  Download,
  Eye,
  Trash2,
  CheckCircle2,
  Clock,
  XCircle,
  PenTool,
  Loader2,
  Layers,
  ExternalLink,
} from "lucide-react";
import { useDocuments, useDeleteDocument, useDocumentUrl, type Document } from "@/hooks/useDocuments";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

const categories = ["All Categories", "onboarding", "compliance", "finance", "hr", "marketing", "communications", "program", "curriculum", "it", "legal", "other"];

const categoryLabels: Record<string, string> = {
  "All Categories": "All Categories",
  onboarding: "Onboarding",
  compliance: "Compliance",
  finance: "Finance",
  hr: "HR",
  marketing: "Marketing",
  communications: "Communications",
  program: "Program",
  curriculum: "Curriculum",
  it: "IT",
  legal: "Legal",
  other: "Other",
};

const FileIcon = ({ type }: { type: string | null }) => {
  if (!type) return <File className="w-5 h-5 text-muted-foreground" />;
  if (type.includes("pdf")) return <FileText className="w-5 h-5 text-destructive" />;
  if (type.includes("sheet") || type.includes("excel") || type.includes("csv")) return <FileSpreadsheet className="w-5 h-5 text-primary" />;
  if (type.includes("image")) return <FileImage className="w-5 h-5 text-accent-foreground" />;
  if (type.includes("word") || type.includes("document")) return <FileText className="w-5 h-5 text-primary" />;
  return <File className="w-5 h-5 text-muted-foreground" />;
};

const ReviewStatusBadge = ({ status }: { status: string | null }) => {
  switch (status?.toLowerCase()) {
    case "approved":
      return (
        <Badge className="bg-success/10 text-success hover:bg-success/20">
          <CheckCircle2 className="w-3 h-3 mr-1" />Approved
        </Badge>
      );
    case "pending":
      return (
        <Badge className="bg-warning/10 text-warning hover:bg-warning/20">
          <Clock className="w-3 h-3 mr-1" />Pending
        </Badge>
      );
    case "rejected":
      return (
        <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/20">
          <XCircle className="w-3 h-3 mr-1" />Rejected
        </Badge>
      );
    default:
      return <Badge variant="outline">{status || "—"}</Badge>;
  }
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Documents() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("documents");
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{ url: string; name: string } | null>(null);
  const [mergeSplitOpen, setMergeSplitOpen] = useState(false);

  const categoryFilter = selectedCategory === "All Categories" ? undefined : selectedCategory as any;
  const { data: documents, isLoading } = useDocuments({ category: categoryFilter });
  const deleteMutation = useDeleteDocument();
  const { downloadDocument, previewDocument, getSignedUrl } = useDocumentUrl();

  const filteredDocs = (documents || []).filter((doc) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return doc.file_name.toLowerCase().includes(q);
  });

  const handlePreview = async (doc: Document) => {
    if (doc.file_type?.includes("pdf")) {
      const url = await getSignedUrl(doc.file_path);
      if (url) setPdfPreview({ url, name: doc.file_name });
    } else {
      previewDocument(doc.file_path);
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget, {
      onSuccess: () => setDeleteTarget(null),
    });
  };

  return (
    <MainLayout
      title="Documents"
      subtitle="Manage documents, uploads, and e-signatures"
      actions={
        activeTab === "documents" ? (
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/pdf-workspace">
                <ExternalLink className="w-4 h-4 mr-2" />
                PDF Workspace
              </Link>
            </Button>
            <Button variant="outline" onClick={() => setMergeSplitOpen(true)}>
              <Layers className="w-4 h-4 mr-2" />
              Merge / Split
            </Button>
            <Button onClick={() => setUploadDialogOpen(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Upload Document
            </Button>
          </div>
        ) : undefined
      }
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="documents">
            <FileText className="w-4 h-4 mr-2" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="esign-docs">
            <PenTool className="w-4 h-4 mr-2" />
            E-Sign Documents
          </TabsTrigger>
          <TabsTrigger value="signing-requests">
            <PenTool className="w-4 h-4 mr-2" />
            Signing Requests
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {categoryLabels[cat] || cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Documents Table */}
          <div className="bg-card border rounded-lg overflow-hidden">
            <div className="data-table overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Category</th>
                    <th>Date</th>
                    <th>Size</th>
                    <th>Review Status</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td><Skeleton className="h-5 w-48" /></td>
                        <td><Skeleton className="h-5 w-20" /></td>
                        <td><Skeleton className="h-5 w-24" /></td>
                        <td><Skeleton className="h-5 w-16" /></td>
                        <td><Skeleton className="h-5 w-20" /></td>
                        <td><Skeleton className="h-5 w-8" /></td>
                      </tr>
                    ))
                  ) : filteredDocs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-muted-foreground">
                        <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
                        <p>No documents found</p>
                      </td>
                    </tr>
                  ) : (
                    filteredDocs.map((doc) => (
                      <tr key={doc.id} className="group cursor-pointer">
                        <td>
                          <div className="flex items-center gap-3">
                            <FileIcon type={doc.file_type} />
                            <span className="font-medium truncate max-w-[300px]">{doc.file_name}</span>
                          </div>
                        </td>
                        <td>
                          <Badge variant="outline" className="text-xs font-normal capitalize">
                            {doc.category || "—"}
                          </Badge>
                        </td>
                        <td className="text-muted-foreground whitespace-nowrap">
                          {format(new Date(doc.uploaded_at), "MMM d, yyyy")}
                        </td>
                        <td className="text-muted-foreground">
                          {formatFileSize(doc.file_size)}
                        </td>
                        <td>
                          <ReviewStatusBadge status={doc.review_status} />
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-0 group-hover:opacity-100"
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handlePreview(doc)}>
                                <Eye className="w-4 h-4 mr-2" />
                                Preview
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => downloadDocument(doc.file_path, doc.file_name)}>
                                <Download className="w-4 h-4 mr-2" />
                                Download
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeleteTarget(doc)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Count */}
          <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
            <span>Showing {filteredDocs.length} document{filteredDocs.length !== 1 ? "s" : ""}</span>
          </div>
        </TabsContent>

        <TabsContent value="esign-docs">
          <EsignDocumentsTab />
        </TabsContent>

        <TabsContent value="signing-requests">
          <SigningRequestsTab />
        </TabsContent>
      </Tabs>

      {/* Upload Dialog */}
      <DocumentUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.file_name}</strong>? This will permanently remove the file from storage and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deleting...</>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PdfViewerDialog
        open={!!pdfPreview}
        onOpenChange={(open) => !open && setPdfPreview(null)}
        url={pdfPreview?.url}
        fileName={pdfPreview?.name}
        title={pdfPreview?.name}
      />

      <PdfMergeSplitDialog open={mergeSplitOpen} onOpenChange={setMergeSplitOpen} />
    </MainLayout>
  );
}
