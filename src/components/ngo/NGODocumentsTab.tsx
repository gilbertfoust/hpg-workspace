import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Upload, 
  Search, 
  FileText, 
  File,
  FileSpreadsheet,
  FileImage,
  Download,
  Eye,
  MoreHorizontal,
  FolderOpen,
  Trash2,
  Loader2
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { format, endOfMonth, endOfQuarter, startOfMonth, startOfQuarter } from "date-fns";
import { useDocuments, useDocumentUrl, useDeleteDocument, DocumentCategory, Document } from "@/hooks/useDocuments";
import { useWorkItems } from "@/hooks/useWorkItems";
import { DocumentUploadDialog } from "./DocumentUploadDialog";

interface NGODocumentsTabProps {
  ngoId: string;
}

const categoryLabels: Record<DocumentCategory, string> = {
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

const reviewStatusStyles: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  Pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  Approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  Rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function getFileIcon(fileType: string | null) {
  if (!fileType) return <File className="w-5 h-5" />;
  
  if (fileType.includes("pdf")) return <FileText className="w-5 h-5 text-red-500" />;
  if (fileType.includes("spreadsheet") || fileType.includes("excel") || fileType.includes("csv")) {
    return <FileSpreadsheet className="w-5 h-5 text-green-500" />;
  }
  if (fileType.includes("image")) return <FileImage className="w-5 h-5 text-blue-500" />;
  if (fileType.includes("word") || fileType.includes("document")) {
    return <FileText className="w-5 h-5 text-blue-600" />;
  }
  
  return <File className="w-5 h-5 text-muted-foreground" />;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function NGODocumentsTab({ ngoId }: NGODocumentsTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<DocumentCategory | "all">("all");
  const [workItemFilter, setWorkItemFilter] = useState("all");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null);
  const [rangePreset, setRangePreset] = useState<"month" | "quarter" | "custom">("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const filters = {
    ngo_id: ngoId,
    ...(categoryFilter !== "all" && { category: categoryFilter }),
    ...(workItemFilter !== "all" && { work_item_id: workItemFilter }),
  };

  const { data: documents, isLoading } = useDocuments(filters);
  const { data: allDocuments } = useDocuments({ ngo_id: ngoId });
  const { data: workItems } = useWorkItems({ ngo_id: ngoId });
  const { downloadDocument, previewDocument } = useDocumentUrl();
  const deleteMutation = useDeleteDocument();

  const filteredDocs = documents?.filter(doc =>
    doc.file_name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const getEvidenceRange = () => {
    const today = new Date();
    if (rangePreset === "month") {
      return { start: startOfMonth(today), end: endOfMonth(today) };
    }
    if (rangePreset === "quarter") {
      return { start: startOfQuarter(today), end: endOfQuarter(today) };
    }
    const start = customStart ? new Date(customStart) : startOfMonth(today);
    const end = customEnd ? new Date(customEnd) : endOfMonth(today);
    return { start, end };
  };

  const evidenceRange = getEvidenceRange();
  const evidenceDocuments = (allDocuments || []).filter((doc) => {
    const uploadedAt = new Date(doc.uploaded_at);
    return uploadedAt >= evidenceRange.start && uploadedAt <= evidenceRange.end;
  });
  const evidenceWorkItems = (workItems || []).filter((item) => {
    if (!item.evidence_required) return false;
    const dateToCheck = item.due_date ? new Date(item.due_date) : new Date(item.created_at);
    return dateToCheck >= evidenceRange.start && dateToCheck <= evidenceRange.end;
  });

  const handlePreview = async (doc: Document) => {
    setLoadingDocId(doc.id);
    await previewDocument(doc.file_path);
    setLoadingDocId(null);
  };

  const handleDownload = async (doc: Document) => {
    setLoadingDocId(doc.id);
    await downloadDocument(doc.file_path, doc.file_name);
    setLoadingDocId(null);
  };

  const handleDeleteClick = (doc: Document) => {
    setDocumentToDelete(doc);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (documentToDelete) {
      await deleteMutation.mutateAsync(documentToDelete);
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
    }
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="documents" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="evidence-pack">Evidence Pack</TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="space-y-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex flex-1 flex-wrap gap-3 w-full sm:w-auto">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as DocumentCategory | "all")}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {Object.entries(categoryLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={workItemFilter} onValueChange={setWorkItemFilter}>
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="All work items" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All work items</SelectItem>
                  {(workItems || []).map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => setUploadDialogOpen(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Upload Document
            </Button>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          )}

          {/* Documents Grid */}
          {!isLoading && filteredDocs.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDocs.map((doc) => (
                <Card key={doc.id} className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                        {getFileIcon(doc.file_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate" title={doc.file_name}>
                          {doc.file_name}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {categoryLabels[doc.category] || "Other"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatFileSize(doc.file_size)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(doc.uploaded_at), "MMM d, yyyy")}
                          </span>
                          {doc.review_status && (
                            <Badge className={`text-xs ${reviewStatusStyles[doc.review_status] || ""}`}>
                              {doc.review_status}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            {loadingDocId === doc.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <MoreHorizontal className="w-4 h-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handlePreview(doc)}>
                            <Eye className="w-4 h-4 mr-2" />
                            Preview
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownload(doc)}>
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDeleteClick(doc)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && filteredDocs.length === 0 && (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <FolderOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No documents found</h3>
                  <p className="text-muted-foreground mb-4">
                    {documents?.length === 0 
                      ? "Upload documents to keep track of important files" 
                      : "Try adjusting your search or filters"}
                  </p>
                  <Button onClick={() => setUploadDialogOpen(true)}>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Document
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="evidence-pack" className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                <div className="flex-1">
                  <h3 className="text-sm font-medium">Evidence Pack</h3>
                  <p className="text-xs text-muted-foreground">
                    Aggregated documents and work items requiring evidence for this NGO.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Select value={rangePreset} onValueChange={(value) => setRangePreset(value as "month" | "quarter" | "custom")}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Time window" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="month">This month</SelectItem>
                      <SelectItem value="quarter">This quarter</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                  {rangePreset === "custom" && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                        className="w-40"
                      />
                      <span className="text-xs text-muted-foreground">to</span>
                      <Input
                        type="date"
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className="w-40"
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Showing items from {format(evidenceRange.start, "MMM d, yyyy")} to {format(evidenceRange.end, "MMM d, yyyy")}
              </div>
            </CardContent>
          </Card>

          <div className="bg-card border rounded-lg overflow-hidden">
            <div className="data-table overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Name</th>
                    <th>Category/Module</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {evidenceDocuments.length === 0 && evidenceWorkItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-muted-foreground">
                        No evidence items found for this window.
                      </td>
                    </tr>
                  ) : (
                    <>
                      {evidenceDocuments.map((doc) => (
                        <tr key={`doc-${doc.id}`}>
                          <td className="text-muted-foreground">Document</td>
                          <td className="font-medium">{doc.file_name}</td>
                          <td className="capitalize">{categoryLabels[doc.category] || "Other"}</td>
                          <td className="text-muted-foreground">
                            {format(new Date(doc.uploaded_at), "MMM d, yyyy")}
                          </td>
                          <td>
                            {doc.review_status ? (
                              <Badge className={`text-xs ${reviewStatusStyles[doc.review_status] || ""}`}>
                                {doc.review_status}
                              </Badge>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      ))}
                      {evidenceWorkItems.map((item) => (
                        <tr key={`wi-${item.id}`}>
                          <td className="text-muted-foreground">Work Item</td>
                          <td className="font-medium">{item.title}</td>
                          <td className="capitalize">{item.module.replace(/_/g, " ")}</td>
                          <td className="text-muted-foreground">
                            {item.due_date ? format(new Date(item.due_date), "MMM d, yyyy") : "—"}
                          </td>
                          <td>
                            <Badge variant="outline" className="text-xs capitalize">
                              {item.evidence_status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Upload Dialog */}
      <DocumentUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        ngoId={ngoId}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{documentToDelete?.file_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
