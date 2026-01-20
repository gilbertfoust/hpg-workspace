import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  AlertCircle,
} from "lucide-react";
import { useDocuments, useDocumentUrl, useDeleteDocument, useUpdateDocument, DocumentCategory, DocumentFilters, Document } from "@/hooks/useDocuments";
import { useNGOs } from "@/hooks/useNGOs";
import { useWorkItems, useUpdateWorkItem } from "@/hooks/useWorkItems";
import { useProfiles, useProfile } from "@/hooks/useProfiles";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgUnits } from "@/hooks/useOrgUnits";
import { DocumentUploadDialog } from "@/components/ngo/DocumentUploadDialog";

const reviewStatusOptions = [
  { label: "All Statuses", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
];

const categoryOptions: { label: string; value: DocumentCategory | "all" }[] = [
  { label: "All Categories", value: "all" },
  { label: "Onboarding", value: "onboarding" },
  { label: "Compliance", value: "compliance" },
  { label: "Finance", value: "finance" },
  { label: "HR", value: "hr" },
  { label: "Marketing", value: "marketing" },
  { label: "Communications", value: "communications" },
  { label: "Program", value: "program" },
  { label: "Curriculum", value: "curriculum" },
  { label: "IT", value: "it" },
  { label: "Legal", value: "legal" },
  { label: "Other", value: "other" },
];

const FileIcon = ({ type }: { type: string | null }) => {
  if (!type) return <File className="w-5 h-5 text-muted-foreground" />;
  if (type.includes("pdf")) return <FileText className="w-5 h-5 text-red-500" />;
  if (type.includes("spreadsheet") || type.includes("excel") || type.includes("csv")) {
    return <FileSpreadsheet className="w-5 h-5 text-green-600" />;
  }
  if (type.includes("word") || type.includes("document")) {
    return <FileText className="w-5 h-5 text-blue-500" />;
  }
  if (type.includes("image")) {
    return <FileImage className="w-5 h-5 text-purple-500" />;
  }
  return <File className="w-5 h-5 text-muted-foreground" />;
};

const ReviewStatusBadge = ({ status }: { status: string | null }) => {
  switch (status) {
    case "approved":
      return (
        <Badge className="bg-success/10 text-success hover:bg-success/20">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Approved
        </Badge>
      );
    case "pending":
      return (
        <Badge className="bg-warning/10 text-warning hover:bg-warning/20">
          <Clock className="w-3 h-3 mr-1" />
          Pending
        </Badge>
      );
    case "rejected":
      return (
        <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/20">
          <XCircle className="w-3 h-3 mr-1" />
          Rejected
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-xs">
          —
        </Badge>
      );
  }
};

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const toStartISOString = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return date.toISOString();
};

const toEndISOString = (value: string) => {
  const date = new Date(`${value}T23:59:59.999`);
  return date.toISOString();
};

const getReviewerCategory = (departmentName: string | null | undefined): DocumentCategory | null => {
  if (!departmentName) return null;
  const normalized = departmentName.toLowerCase();
  if (normalized.includes("finance")) return "finance";
  if (normalized.includes("legal")) return "legal";
  if (normalized.includes("program")) return "program";
  if (normalized.includes("communication")) return "communications";
  if (normalized.includes("marketing")) return "marketing";
  if (normalized.includes("human resources") || normalized.includes("hr")) return "hr";
  if (normalized.includes("it")) return "it";
  if (normalized.includes("curriculum")) return "curriculum";
  if (normalized.includes("compliance")) return "compliance";
  return null;
};

export default function Documents() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory | "all">("all");
  const [selectedNgo, setSelectedNgo] = useState("all");
  const [selectedWorkItem, setSelectedWorkItem] = useState("all");
  const [selectedReviewStatus, setSelectedReviewStatus] = useState("all");
  const [selectedUploader, setSelectedUploader] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  const { data: ngos } = useNGOs();
  const { data: workItems } = useWorkItems();
  const { data: profiles } = useProfiles();
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id || "");
  const { data: orgUnits } = useOrgUnits();

  const departmentName = useMemo(() => {
    if (!profile?.department_id || !orgUnits) return null;
    return orgUnits.find((unit) => unit.id === profile.department_id)?.department_name || null;
  }, [profile?.department_id, orgUnits]);

  const reviewerCategory = getReviewerCategory(departmentName);

  const filters: DocumentFilters = {
    ...(selectedNgo !== "all" && { ngo_id: selectedNgo }),
    ...(selectedWorkItem !== "all" && { work_item_id: selectedWorkItem }),
    ...(selectedCategory !== "all" && { category: selectedCategory }),
    ...(selectedReviewStatus !== "all" && { review_status: selectedReviewStatus }),
    ...(selectedUploader !== "all" && { uploaded_by_user_id: selectedUploader }),
    ...(startDate && { uploaded_from: toStartISOString(startDate) }),
    ...(endDate && { uploaded_to: toEndISOString(endDate) }),
  };

  const { data: documents, isLoading } = useDocuments(filters);
  const { data: reviewQueueDocuments, isLoading: reviewQueueLoading } = useDocuments({
    review_status: "pending",
    ...(reviewerCategory ? { category: reviewerCategory } : {}),
  });
  const { downloadDocument, previewDocument } = useDocumentUrl();
  const deleteMutation = useDeleteDocument();
  const updateDocument = useUpdateDocument();
  const updateWorkItem = useUpdateWorkItem();

  const ngoMap = useMemo(() => new Map((ngos || []).map((ngo) => [ngo.id, ngo.common_name || ngo.legal_name])), [ngos]);
  const workItemMap = useMemo(() => new Map((workItems || []).map((item) => [item.id, item.title])), [workItems]);
  const uploaderMap = useMemo(
    () => new Map((profiles || []).map((profileItem) => [profileItem.id, profileItem.full_name || profileItem.email || "Unknown"])),
    [profiles]
  );

  const filteredDocuments = (documents || []).filter((doc) =>
    doc.file_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleReviewUpdate = async (doc: Document, status: "approved" | "rejected") => {
    await updateDocument.mutateAsync({ id: doc.id, review_status: status });
    if (doc.work_item_id) {
      await updateWorkItem.mutateAsync({ id: doc.work_item_id, evidence_status: status });
    }
  };

  return (
    <MainLayout
      title="Documents"
      subtitle="Manage and review all uploaded files and evidence"
      actions={
        <Button onClick={() => setUploadDialogOpen(true)} disabled={selectedNgo === "all"}>
          <Upload className="w-4 h-4 mr-2" />
          Upload Document
        </Button>
      }
    >
      <Tabs defaultValue="all" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="all">All Documents</TabsTrigger>
          <TabsTrigger value="review-queue">Review Queue</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select value={selectedNgo} onValueChange={setSelectedNgo}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="All NGOs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All NGOs</SelectItem>
                  {(ngos || []).map((ngo) => (
                    <SelectItem key={ngo.id} value={ngo.id}>
                      {ngo.common_name || ngo.legal_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedWorkItem} onValueChange={setSelectedWorkItem}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="All Work Items" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Work Items</SelectItem>
                  {(workItems || []).map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap gap-4">
              <Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as DocumentCategory | "all")}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedReviewStatus} onValueChange={setSelectedReviewStatus}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {reviewStatusOptions.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedUploader} onValueChange={setSelectedUploader}>
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="Uploaded by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Uploaders</SelectItem>
                  {(profiles || []).map((profileItem) => (
                    <SelectItem key={profileItem.id} value={profileItem.id}>
                      {profileItem.full_name || profileItem.email || "Unknown"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-40"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-40"
                />
              </div>

              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  setSelectedNgo("all");
                  setSelectedWorkItem("all");
                  setSelectedCategory("all");
                  setSelectedReviewStatus("all");
                  setSelectedUploader("all");
                  setStartDate("");
                  setEndDate("");
                  setSearchQuery("");
                }}
              >
                <Filter className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Documents Table */}
          <div className="bg-card border rounded-lg overflow-hidden">
            <div className="data-table overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Category</th>
                    <th>NGO</th>
                    <th>Uploaded By</th>
                    <th>Date</th>
                    <th>Size</th>
                    <th>Review Status</th>
                    <th>Work Item</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={9} className="text-center py-8 text-muted-foreground">
                        Loading documents...
                      </td>
                    </tr>
                  ) : filteredDocuments.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-8 text-muted-foreground">
                        No documents found. Adjust your filters or upload new files.
                      </td>
                    </tr>
                  ) : (
                    filteredDocuments.map((doc) => (
                      <tr key={doc.id} className="group">
                        <td>
                          <div className="flex items-center gap-3">
                            <FileIcon type={doc.file_type} />
                            <span className="font-medium">{doc.file_name}</span>
                          </div>
                        </td>
                        <td>
                          <Badge variant="outline" className="text-xs font-normal capitalize">
                            {doc.category}
                          </Badge>
                        </td>
                        <td className="text-muted-foreground">
                          {doc.ngo_id ? ngoMap.get(doc.ngo_id) || "Unknown" : "—"}
                        </td>
                        <td className="text-muted-foreground">
                          {doc.uploaded_by_user_id ? uploaderMap.get(doc.uploaded_by_user_id) || "Unknown" : "—"}
                        </td>
                        <td className="text-muted-foreground whitespace-nowrap">
                          {new Date(doc.uploaded_at).toLocaleDateString()}
                        </td>
                        <td className="text-muted-foreground">{formatFileSize(doc.file_size)}</td>
                        <td>
                          <ReviewStatusBadge status={doc.review_status} />
                        </td>
                        <td className="text-muted-foreground text-xs">
                          {doc.work_item_id ? workItemMap.get(doc.work_item_id) || doc.work_item_id : "—"}
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
                              <DropdownMenuItem onClick={() => previewDocument(doc.file_path)}>
                                <Eye className="w-4 h-4 mr-2" />
                                Preview
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => downloadDocument(doc.file_path, doc.file_name)}>
                                <Download className="w-4 h-4 mr-2" />
                                Download
                              </DropdownMenuItem>
                              {doc.review_status === "pending" && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleReviewUpdate(doc, "approved")}> 
                                    <CheckCircle2 className="w-4 h-4 mr-2 text-success" />
                                    Approve Evidence
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleReviewUpdate(doc, "rejected")}> 
                                    <XCircle className="w-4 h-4 mr-2 text-destructive" />
                                    Reject Evidence
                                  </DropdownMenuItem>
                                </>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => deleteMutation.mutate(doc)}
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

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
            <span>Showing {filteredDocuments.length} of {documents?.length || 0} documents</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled>
                Next
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="review-queue" className="space-y-4">
          <div className="flex flex-col gap-2">
            <h2 className="text-base font-semibold">Review Queue</h2>
            <p className="text-sm text-muted-foreground">
              {reviewerCategory
                ? `Showing pending ${reviewerCategory} documents for ${departmentName || "your department"}.`
                : "Showing all pending documents (no department role detected)."}
            </p>
          </div>

          {!reviewerCategory && (
            <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              <AlertCircle className="w-4 h-4" />
              Assign a department to filter the queue by reviewer role.
            </div>
          )}

          <div className="bg-card border rounded-lg overflow-hidden">
            <div className="data-table overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th>File</th>
                    <th>NGO</th>
                    <th>Uploaded By</th>
                    <th>Date</th>
                    <th>Review Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewQueueLoading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-muted-foreground">
                        Loading review queue...
                      </td>
                    </tr>
                  ) : (reviewQueueDocuments || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-muted-foreground">
                        No pending documents in the review queue.
                      </td>
                    </tr>
                  ) : (
                    (reviewQueueDocuments || []).map((doc) => (
                      <tr key={doc.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <FileIcon type={doc.file_type} />
                            <div>
                              <p className="font-medium">{doc.file_name}</p>
                              <p className="text-xs text-muted-foreground capitalize">
                                {doc.category}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="text-muted-foreground">
                          {doc.ngo_id ? ngoMap.get(doc.ngo_id) || "Unknown" : "—"}
                        </td>
                        <td className="text-muted-foreground">
                          {doc.uploaded_by_user_id ? uploaderMap.get(doc.uploaded_by_user_id) || "Unknown" : "—"}
                        </td>
                        <td className="text-muted-foreground whitespace-nowrap">
                          {new Date(doc.uploaded_at).toLocaleDateString()}
                        </td>
                        <td>
                          <ReviewStatusBadge status={doc.review_status} />
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleReviewUpdate(doc, "approved")}
                              disabled={updateDocument.isPending}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleReviewUpdate(doc, "rejected")}
                              disabled={updateDocument.isPending}
                            >
                              <XCircle className="w-4 h-4 mr-2" />
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => previewDocument(doc.file_path)}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              Preview
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <DocumentUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        ngoId={selectedNgo !== "all" ? selectedNgo : ""}
      />
    </MainLayout>
  );
}
