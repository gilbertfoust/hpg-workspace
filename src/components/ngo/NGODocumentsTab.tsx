import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  FileClock
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
import { format } from "date-fns";
import { useDocuments, DocumentCategory } from "@/hooks/useDocuments";
import { FormSubmissionSheet } from "./FormSubmissionSheet";
import { documentRequestTemplate } from "./ngoFormTemplates";
import { FormSubmission, useUpdateFormSubmission } from "@/hooks/useFormSubmissions";
import { StatusChip } from "@/components/common/StatusChip";
import { useCreateWorkItem, useWorkItems } from "@/hooks/useWorkItems";
import { useEnsureFormTemplate, FormTemplate } from "@/hooks/useFormTemplates";
import { useDocuments, useDocumentUrl, useDeleteDocument, DocumentCategory, Document } from "@/hooks/useDocuments";
import { DocumentUploadDialog } from "./DocumentUploadDialog";

interface NGODocumentsTabProps {
  ngoId: string;
  launchDocumentRequest?: boolean;
  onDocumentRequestHandled?: () => void;
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

const requestStatusMap: Record<string, "approved" | "in-progress" | "rejected" | "draft" | "waiting-ngo" | "waiting-hpg" | "under-review" | "submitted"> = {
  draft: "draft",
  not_started: "draft",
  in_progress: "in-progress",
  waiting_on_ngo: "waiting-ngo",
  waiting_on_hpg: "waiting-hpg",
  submitted: "submitted",
  under_review: "under-review",
  approved: "approved",
  rejected: "rejected",
  complete: "approved",
  canceled: "draft",
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

export function NGODocumentsTab({ ngoId, launchDocumentRequest, onDocumentRequestHandled }: NGODocumentsTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<DocumentCategory | "all">("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplate | null>(null);
  const [initialValues, setInitialValues] = useState<Record<string, unknown> | undefined>(undefined);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null);

  const filters = {
    ngo_id: ngoId,
    ...(categoryFilter !== "all" && { category: categoryFilter }),
  };

  const { data: documents, isLoading } = useDocuments(filters);
  const { data: requests } = useWorkItems({
    ngo_id: ngoId,
    module: "ngo_coordination",
    type: "Document Request",
  });
  const ensureTemplate = useEnsureFormTemplate();
  const createWorkItem = useCreateWorkItem();
  const updateSubmission = useUpdateFormSubmission();
  const { downloadDocument, previewDocument } = useDocumentUrl();
  const deleteMutation = useDeleteDocument();

  const filteredDocs = documents?.filter(doc =>
    doc.file_name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const filteredRequests = (requests || []).filter((request) => request.status !== "complete" && request.status !== "canceled");

  const groupedDocuments = useMemo(() => {
    const grouped = new Map<string, typeof filteredDocs>();
    filteredDocs.forEach((doc) => {
      const key = doc.category || "other";
      const bucket = grouped.get(key) || [];
      bucket.push(doc);
      grouped.set(key, bucket);
    });
    return grouped;
  }, [filteredDocs]);

  const handleRequestDocument = useCallback(async () => {
    const template = await ensureTemplate.mutateAsync(documentRequestTemplate);
    setSelectedTemplate(template);
    setInitialValues({
      external_visible: true,
    });
    setSheetOpen(true);
  }, [ensureTemplate]);

  useEffect(() => {
    if (launchDocumentRequest) {
      handleRequestDocument().finally(() => onDocumentRequestHandled?.());
    }
  }, [handleRequestDocument, launchDocumentRequest, onDocumentRequestHandled]);

  const handleSubmissionSuccess = async (
    submission: FormSubmission,
    payload: Record<string, unknown>,
    submitted: boolean
  ) => {
    if (!submitted || !selectedTemplate) return;

    if (selectedTemplate.name === documentRequestTemplate.name) {
      const dueDate = payload.due_date ? String(payload.due_date) : null;
      const title = payload.document_type ? String(payload.document_type) : "Document Request";
      const workItem = await createWorkItem.mutateAsync({
        title: `Document Request — ${title}`,
        module: "ngo_coordination",
        type: "Document Request",
        ngo_id: ngoId,
        description: payload.description ? String(payload.description) : null,
        due_date: dueDate,
        status: "waiting_on_ngo",
        priority: "medium",
        evidence_required: true,
        external_visible: payload.external_visible === true,
      });

      await updateSubmission.mutateAsync({
        id: submission.id,
        work_item_id: workItem.id,
      });
    }
  };

  const handleSheetClose = (open: boolean) => {
    if (!open) {
      setSelectedTemplate(null);
      setInitialValues(undefined);
    }
    setSheetOpen(open);
  };

  const categoryEntries = categoryFilter === "all"
    ? Array.from(groupedDocuments.entries())
    : [[categoryFilter, groupedDocuments.get(categoryFilter) || []]];

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
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-1 gap-3 w-full sm:w-auto">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as DocumentCategory | "all")}>
            <SelectTrigger className="w-40">
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
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRequestDocument} disabled={ensureTemplate.isPending}>
            <FileClock className="w-4 h-4 mr-2" />
            Request Document
          </Button>
          <Button>
            <Upload className="w-4 h-4 mr-2" />
            Upload Document
          </Button>
        </div>
        <Button onClick={() => setUploadDialogOpen(true)}>
          <Upload className="w-4 h-4 mr-2" />
          Upload Document
        </Button>
      </div>

      {/* Document Requests */}
      {filteredRequests.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Outstanding Document Requests</h4>
              <Badge variant="outline" className="text-xs">{filteredRequests.length}</Badge>
            </div>
            <div className="space-y-3">
              {filteredRequests.map((request) => (
                <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-muted p-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{request.title}</p>
                    {request.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{request.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {request.status && (
                      <StatusChip status={requestStatusMap[request.status] || "draft"} />
                    )}
                    <Badge variant="outline" className="text-xs capitalize">
                      {(request.evidence_status || "missing").replace(/_/g, " ")}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {request.due_date ? format(new Date(request.due_date), "MMM d, yyyy") : "No due date"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
        <div className="space-y-6">
          {categoryEntries.map(([category, docs]) => (
            <div key={category} className="space-y-3">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {categoryLabels[category as DocumentCategory] || "Other"}
                </h4>
                <Badge variant="outline" className="text-xs">{docs?.length || 0}</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(docs || []).map((doc) => (
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
                              {doc.category ? categoryLabels[doc.category] : "Other"}
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
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Eye className="w-4 h-4 mr-2" />
                              Preview
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Download className="w-4 h-4 mr-2" />
                              Download
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
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
      {!isLoading && filteredDocs.length === 0 && filteredRequests.length === 0 && (
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

      <FormSubmissionSheet
        open={sheetOpen}
        onOpenChange={handleSheetClose}
        template={selectedTemplate}
        submission={null}
        ngoId={ngoId}
        initialValues={initialValues}
        onSubmitSuccess={handleSubmissionSuccess}
      />
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
