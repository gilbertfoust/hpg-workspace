import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertCircle, CheckCircle2, Download, Eye, FileText, FolderOpen, Loader2, Upload } from "lucide-react";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";
import { useDocumentUrl, useUploadDocument } from "@/hooks/useDocuments";

interface PortalContactRow {
  ngo_id: string | null;
  ngos: { id: string; legal_name: string; common_name: string | null } | null;
}

interface NgoSummary {
  id: string;
  name: string;
}

interface PortalDocumentRow {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  category: string;
  review_status: string | null;
  ngo_id: string | null;
  uploaded_at: string | null;
  created_at: string | null;
}

interface CompliancePeriodRow {
  id: string;
  ngo_id: string;
  period_type: "quarterly" | "annual";
  period_label: string;
  period_start: string | null;
  period_end: string | null;
  due_date: string | null;
  status: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  notes: string | null;
}

const ensureSupabase = () => {
  if (!supabase) throw getSupabaseNotConfiguredError();
};

const statusLabels: Record<string, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  submitted: "Submitted",
  under_review: "Under Review",
  approved: "Approved",
  needs_revision: "Needs Revision",
  overdue: "Overdue",
};

const statusVariant = (status: string) => {
  if (status === "approved") return "default";
  if (status === "overdue" || status === "needs_revision") return "destructive";
  if (status === "submitted" || status === "under_review") return "secondary";
  return "outline";
};

const formatDate = (value: string | null) => value ? format(new Date(value), "MMM d, yyyy") : "—";

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function Portal() {
  const { user } = useAuth();
  const uploadDocument = useUploadDocument();
  const { downloadDocument, previewDocument } = useDocumentUrl();
  const [selectedUploadNgoId, setSelectedUploadNgoId] = useState("");
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const { data: ngoContacts, isLoading: ngoLoading } = useQuery({
    queryKey: ["portal-ngos", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      ensureSupabase();
      const { data, error } = await supabase
        .from("contacts")
        .select("ngo_id, ngos(id, legal_name, common_name)")
        .eq("user_id", user?.id ?? "");
      if (error) throw error;
      return data as PortalContactRow[];
    },
  });

  const ngos = useMemo<NgoSummary[]>((() => {
    const unique = new Map<string, NgoSummary>();
    (ngoContacts || []).forEach((contact) => {
      if (contact.ngo_id && contact.ngos) {
        unique.set(contact.ngo_id, {
          id: contact.ngo_id,
          name: contact.ngos.common_name || contact.ngos.legal_name,
        });
      }
    });
    return Array.from(unique.values());
  }), [ngoContacts]);

  const ngoIds = useMemo(() => ngos.map((ngo) => ngo.id), [ngos]);
  const ngoNameLookup = useMemo(() => new Map(ngos.map((ngo) => [ngo.id, ngo.name])), [ngos]);

  useEffect(() => {
    if (!selectedUploadNgoId && ngos.length > 0) setSelectedUploadNgoId(ngos[0].id);
  }, [ngos, selectedUploadNgoId]);

  const { data: compliancePeriods, isLoading: complianceLoading } = useQuery({
    queryKey: ["portal-compliance-periods", ngoIds],
    enabled: ngoIds.length > 0,
    queryFn: async () => {
      ensureSupabase();
      const { data, error } = await supabase
        .from("ngo_compliance_periods" as never)
        .select("id, ngo_id, period_type, period_label, period_start, period_end, due_date, status, submitted_at, reviewed_at, notes" as never)
        .in("ngo_id" as never, ngoIds as never)
        .order("due_date" as never, { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data || []) as unknown as CompliancePeriodRow[];
    },
  });

  const { data: documents, isLoading: docsLoading } = useQuery({
    queryKey: ["portal-documents", ngoIds],
    enabled: ngoIds.length > 0,
    queryFn: async () => {
      ensureSupabase();
      const { data, error } = await supabase
        .from("documents")
        .select("id, file_name, file_path, file_type, file_size, category, review_status, ngo_id, uploaded_at, created_at")
        .in("ngo_id", ngoIds)
        .order("uploaded_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as PortalDocumentRow[];
    },
  });

  const handleGeneralDocumentUpload = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !selectedUploadNgoId) return;

    try {
      setUploadingId("general-document-upload");
      await uploadDocument.mutateAsync({
        file,
        ngoId: selectedUploadNgoId,
        category: "compliance",
        reviewStatus: "Pending Review",
      });
    } finally {
      setUploadingId(null);
    }
  };

  const totalCompliance = compliancePeriods?.length ?? 0;
  const approvedCompliance = compliancePeriods?.filter((period) => period.status === "approved").length ?? 0;
  const pendingCompliance = compliancePeriods?.filter((period) => ["not_started", "in_progress", "needs_revision", "overdue"].includes(period.status)).length ?? 0;
  const complianceProgress = totalCompliance > 0 ? Math.round((approvedCompliance / totalCompliance) * 100) : 0;

  return (
    <PortalLayout
      title="NGO Compliance Portal"
      subtitle="Upload compliance documents and track your quarterly and annual review status."
    >
      <div className="flex flex-col gap-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-5 text-center">
              <p className="text-2xl font-bold">{ngos.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Linked NGOs</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 text-center">
              <p className="text-2xl font-bold text-primary">{complianceProgress}%</p>
              <p className="text-xs text-muted-foreground mt-1">Compliance Complete</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 text-center">
              <p className="text-2xl font-bold text-orange-500">{pendingCompliance}</p>
              <p className="text-xs text-muted-foreground mt-1">Pending Items</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 text-center">
              <p className="text-2xl font-bold">{documents?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Uploaded Documents</p>
            </CardContent>
          </Card>
        </div>

        {ngos.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {ngos.map((ngo) => (
              <Badge key={ngo.id} variant="secondary" className="px-3 py-1 text-sm">
                {ngo.name}
              </Badge>
            ))}
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Compliance Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={complianceProgress} />
            <p className="text-sm text-muted-foreground">
              {approvedCompliance} of {totalCompliance} quarterly/annual compliance periods approved.
            </p>
          </CardContent>
        </Card>

        <Tabs defaultValue="compliance">
          <TabsList>
            <TabsTrigger value="compliance">
              <FileText className="w-4 h-4 mr-1" />
              Compliance Status
            </TabsTrigger>
            <TabsTrigger value="documents">
              <FolderOpen className="w-4 h-4 mr-1" />
              Documents
            </TabsTrigger>
          </TabsList>

          <TabsContent value="compliance">
            <Card>
              <CardContent className="p-0">
                <div className="border-b px-5 py-4">
                  <h2 className="text-lg font-semibold">Quarterly & Annual Compliance</h2>
                  <p className="text-sm text-muted-foreground">
                    Track review status for your required HPG compliance periods. HPG staff updates approvals and revision requests.
                  </p>
                </div>
                {ngoLoading || complianceLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : compliancePeriods && compliancePeriods.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>NGO</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {compliancePeriods.map((period) => (
                        <TableRow key={period.id}>
                          <TableCell className="font-medium">{ngoNameLookup.get(period.ngo_id) || "—"}</TableCell>
                          <TableCell>{period.period_label}</TableCell>
                          <TableCell className="capitalize">{period.period_type}</TableCell>
                          <TableCell>{formatDate(period.due_date)}</TableCell>
                          <TableCell>
                            <Badge variant={statusVariant(period.status)}>
                              {statusLabels[period.status] || period.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[320px] text-sm text-muted-foreground">
                            {period.notes || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="px-5 py-10 text-sm text-muted-foreground flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5" />
                    <span>No compliance periods have been assigned yet.</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents">
            <Card>
              <CardContent className="p-0">
                <div className="border-b px-5 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Compliance Documents</h2>
                    <p className="text-sm text-muted-foreground">
                      Upload documents for your NGO compliance review. You can view or download files after upload.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    {ngos.length > 1 && (
                      <select
                        className="h-9 rounded-md border bg-background px-3 text-sm"
                        value={selectedUploadNgoId}
                        onChange={(event) => setSelectedUploadNgoId(event.target.value)}
                      >
                        {ngos.map((ngo) => (
                          <option key={ngo.id} value={ngo.id}>{ngo.name}</option>
                        ))}
                      </select>
                    )}
                    <label className="inline-flex">
                      <input
                        type="file"
                        className="hidden"
                        onChange={(event) => handleGeneralDocumentUpload(event.target.files)}
                        disabled={!selectedUploadNgoId || uploadingId === "general-document-upload"}
                      />
                      <Button asChild disabled={!selectedUploadNgoId || uploadingId === "general-document-upload"}>
                        <span>
                          {uploadingId === "general-document-upload" ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="mr-2 h-4 w-4" />
                          )}
                          Upload Compliance Document
                        </span>
                      </Button>
                    </label>
                  </div>
                </div>

                {docsLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : documents && documents.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>File Name</TableHead>
                        <TableHead>NGO</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Review Status</TableHead>
                        <TableHead>Uploaded</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documents.map((document) => (
                        <TableRow key={document.id}>
                          <TableCell className="font-medium">{document.file_name}</TableCell>
                          <TableCell>{document.ngo_id ? ngoNameLookup.get(document.ngo_id) || "—" : "—"}</TableCell>
                          <TableCell><Badge variant="outline">{document.category}</Badge></TableCell>
                          <TableCell>{formatFileSize(document.file_size)}</TableCell>
                          <TableCell><Badge variant="secondary">{document.review_status || "Pending Review"}</Badge></TableCell>
                          <TableCell>{formatDate(document.uploaded_at || document.created_at)}</TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => previewDocument(document.file_path)}>
                                <Eye className="mr-2 h-4 w-4" />
                                View
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => downloadDocument(document.file_path, document.file_name)}>
                                <Download className="mr-2 h-4 w-4" />
                                Download
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="px-5 py-10 text-sm text-muted-foreground">
                    No documents found. Use Upload Compliance Document to add your first file.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PortalLayout>
  );
}
