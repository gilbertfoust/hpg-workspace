import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Download, Eye, Loader2, Upload, FileText, Clock, FolderOpen } from "lucide-react";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";
import { useDocumentUrl, useUploadDocument } from "@/hooks/useDocuments";
import { WorkItem } from "@/hooks/useWorkItems";

interface PortalContactRow {
  ngo_id: string | null;
  ngos: { id: string; legal_name: string; common_name: string | null } | null;
}

interface NgoSummary { id: string; name: string; }

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

const statusLabels: Record<string, string> = {
  draft: "Draft", not_started: "Not started", in_progress: "In progress",
  waiting_on_ngo: "Waiting on NGO", waiting_on_hpg: "Waiting on HPG",
  submitted: "Submitted", under_review: "Under review", approved: "Approved",
  rejected: "Rejected", complete: "Complete", canceled: "Canceled",
};

const ensureSupabase = () => { if (!supabase) throw getSupabaseNotConfiguredError(); };
const formatDate = (v: string | null) => v ? format(new Date(v), "MMM d, yyyy") : "—";
const formatStatus = (s: string | null) => s ? (statusLabels[s] || s.replace(/_/g, " ")) : "—";
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
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [selectedUploadNgoId, setSelectedUploadNgoId] = useState<string>("");

  const { data: ngoContacts, isLoading: ngoLoading } = useQuery({
    queryKey: ["portal-ngos", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      ensureSupabase();
      const { data, error } = await supabase.from("contacts").select("ngo_id, ngos(id, legal_name, common_name)").eq("user_id", user?.id ?? "");
      if (error) throw error;
      return data as PortalContactRow[];
    },
  });

  const ngos = useMemo<NgoSummary[]>(() => {
    const unique = new Map<string, NgoSummary>();
    (ngoContacts || []).forEach((c) => {
      if (c.ngo_id && c.ngos) unique.set(c.ngo_id, { id: c.ngo_id, name: c.ngos.common_name || c.ngos.legal_name });
    });
    return Array.from(unique.values());
  }, [ngoContacts]);

  const ngoIds = useMemo(() => ngos.map(n => n.id), [ngos]);
  const ngoNameLookup = useMemo(() => new Map(ngos.map(n => [n.id, n.name])), [ngos]);

  useEffect(() => {
    if (!selectedUploadNgoId && ngos.length > 0) setSelectedUploadNgoId(ngos[0].id);
  }, [ngos, selectedUploadNgoId]);

  const { data: workItems, isLoading: workItemsLoading } = useQuery({
    queryKey: ["portal-work-items", ngoIds],
    enabled: ngoIds.length > 0,
    queryFn: async () => {
      ensureSupabase();
      const { data, error } = await supabase.from("work_items").select("*").in("ngo_id", ngoIds).eq("external_visible", true).order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as WorkItem[];
    },
  });

  const { data: formSubmissions, isLoading: formsLoading } = useQuery({
    queryKey: ["portal-form-submissions", ngoIds],
    enabled: ngoIds.length > 0,
    queryFn: async () => {
      ensureSupabase();
      const { data, error } = await supabase
        .from("form_submissions")
        .select("id, form_template_id, ngo_id, submission_status, submitted_at, created_at, form_templates(name)")
        .in("ngo_id", ngoIds)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as any[];
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
        .limit(50);
      if (error) throw error;
      return data as PortalDocumentRow[];
    },
  });

  const uploadPortalDocument = async ({ file, ngoId, workItemId, uploadKey }: { file: File; ngoId: string; workItemId?: string; uploadKey: string }) => {
    try {
      setUploadingId(uploadKey);
      await uploadDocument.mutateAsync({ file, ngoId, category: "other", workItemId, reviewStatus: "Pending" });
    } finally {
      setUploadingId(null);
    }
  };

  const handleFileUpload = async (workItem: WorkItem, files: FileList | null) => {
    const file = files?.[0];
    if (!file || !workItem.ngo_id) return;
    await uploadPortalDocument({ file, ngoId: workItem.ngo_id, workItemId: workItem.id, uploadKey: workItem.id });
  };

  const handleGeneralDocumentUpload = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !selectedUploadNgoId) return;
    await uploadPortalDocument({ file, ngoId: selectedUploadNgoId, uploadKey: "general-document-upload" });
  };

  const isLoading = ngoLoading || workItemsLoading;
  const activeWorkItems = workItems?.filter(wi => !["complete", "canceled", "approved"].includes(wi.status)) ?? [];
  const completedWorkItems = workItems?.filter(wi => ["complete", "approved"].includes(wi.status)) ?? [];

  return (
    <PortalLayout title="NGO Portal" subtitle="View tasks, submissions, and documents for your organization.">
      <div className="flex flex-col gap-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardContent className="p-5 text-center"><p className="text-2xl font-bold">{ngos.length}</p><p className="text-xs text-muted-foreground mt-1">Your NGOs</p></CardContent></Card>
          <Card><CardContent className="p-5 text-center"><p className="text-2xl font-bold text-orange-500">{activeWorkItems.length}</p><p className="text-xs text-muted-foreground mt-1">Active Tasks</p></CardContent></Card>
          <Card><CardContent className="p-5 text-center"><p className="text-2xl font-bold text-primary">{completedWorkItems.length}</p><p className="text-xs text-muted-foreground mt-1">Completed</p></CardContent></Card>
          <Card><CardContent className="p-5 text-center"><p className="text-2xl font-bold">{documents?.length ?? 0}</p><p className="text-xs text-muted-foreground mt-1">Documents</p></CardContent></Card>
        </div>

        {ngos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {ngos.map(ngo => <Badge key={ngo.id} variant="secondary" className="px-3 py-1 text-sm">{ngo.name}</Badge>)}
          </div>
        )}

        <Tabs defaultValue="tasks">
          <TabsList>
            <TabsTrigger value="tasks"><Clock className="w-4 h-4 mr-1" />Tasks</TabsTrigger>
            <TabsTrigger value="forms"><FileText className="w-4 h-4 mr-1" />Form Submissions</TabsTrigger>
            <TabsTrigger value="documents"><FolderOpen className="w-4 h-4 mr-1" />Documents</TabsTrigger>
          </TabsList>

          <TabsContent value="tasks">
            <Card>
              <CardContent className="p-0">
                <div className="border-b px-5 py-4">
                  <h2 className="text-lg font-semibold">External-visible work items</h2>
                  <p className="text-sm text-muted-foreground">Tasks shared with your organization.</p>
                </div>
                {isLoading ? (
                  <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                ) : workItems && workItems.length > 0 ? (
                  <Table>
                    <TableHeader><TableRow><TableHead>NGO</TableHead><TableHead>Status</TableHead><TableHead>Type</TableHead><TableHead>Due</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Evidence</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {workItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.ngo_id ? ngoNameLookup.get(item.ngo_id) || "—" : "—"}</TableCell>
                          <TableCell><Badge variant="outline">{formatStatus(item.status)}</Badge></TableCell>
                          <TableCell>{item.type || "—"}</TableCell>
                          <TableCell>{formatDate(item.due_date)}</TableCell>
                          <TableCell className="max-w-[320px] text-sm text-muted-foreground">{item.description || "—"}</TableCell>
                          <TableCell className="text-right">
                            {item.evidence_required ? (
                              <label className="inline-flex items-center gap-2">
                                <input type="file" className="hidden" onChange={(e) => handleFileUpload(item, e.target.files)} disabled={uploadingId === item.id} />
                                <Button variant="secondary" size="sm" asChild disabled={uploadingId === item.id}>
                                  <span>{uploadingId === item.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Upload</span>
                                </Button>
                              </label>
                            ) : <span className="text-sm text-muted-foreground">Not required</span>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : <div className="px-5 py-10 text-sm text-muted-foreground">No external-visible work items.</div>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="forms">
            <Card>
              <CardContent className="p-0">
                <div className="border-b px-5 py-4"><h2 className="text-lg font-semibold">Form Submissions</h2><p className="text-sm text-muted-foreground">Submissions filed for your NGO.</p></div>
                {formsLoading ? (
                  <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                ) : formSubmissions && formSubmissions.length > 0 ? (
                  <Table>
                    <TableHeader><TableRow><TableHead>Form</TableHead><TableHead>NGO</TableHead><TableHead>Status</TableHead><TableHead>Submitted</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {formSubmissions.map(s => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{s.form_templates?.name ?? "Unknown form"}</TableCell>
                          <TableCell>{s.ngo_id ? ngoNameLookup.get(s.ngo_id) || "—" : "—"}</TableCell>
                          <TableCell><Badge variant={s.submission_status === "submitted" ? "default" : "outline"}>{formatStatus(s.submission_status)}</Badge></TableCell>
                          <TableCell>{s.submitted_at ? formatDate(s.submitted_at) : formatDate(s.created_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : <div className="px-5 py-10 text-sm text-muted-foreground">No form submissions found.</div>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents">
            <Card>
              <CardContent className="p-0">
                <div className="border-b px-5 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div><h2 className="text-lg font-semibold">Documents</h2><p className="text-sm text-muted-foreground">Upload, view, and download files associated with your NGO.</p></div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    {ngos.length > 1 && (
                      <select className="h-9 rounded-md border bg-background px-3 text-sm" value={selectedUploadNgoId} onChange={(e) => setSelectedUploadNgoId(e.target.value)}>
                        {ngos.map(ngo => <option key={ngo.id} value={ngo.id}>{ngo.name}</option>)}
                      </select>
                    )}
                    <label className="inline-flex">
                      <input type="file" className="hidden" onChange={(e) => handleGeneralDocumentUpload(e.target.files)} disabled={!selectedUploadNgoId || uploadingId === "general-document-upload"} />
                      <Button asChild disabled={!selectedUploadNgoId || uploadingId === "general-document-upload"}>
                        <span>{uploadingId === "general-document-upload" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Upload Document</span>
                      </Button>
                    </label>
                  </div>
                </div>
                {docsLoading ? (
                  <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                ) : documents && documents.length > 0 ? (
                  <Table>
                    <TableHeader><TableRow><TableHead>File Name</TableHead><TableHead>NGO</TableHead><TableHead>Category</TableHead><TableHead>Size</TableHead><TableHead>Review Status</TableHead><TableHead>Uploaded</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {documents.map(d => (
                        <TableRow key={d.id}>
                          <TableCell className="font-medium">{d.file_name}</TableCell>
                          <TableCell>{d.ngo_id ? ngoNameLookup.get(d.ngo_id) || "—" : "—"}</TableCell>
                          <TableCell><Badge variant="outline">{d.category}</Badge></TableCell>
                          <TableCell>{formatFileSize(d.file_size)}</TableCell>
                          <TableCell><Badge variant={d.review_status === "Approved" ? "default" : d.review_status === "Rejected" ? "destructive" : "secondary"}>{d.review_status || "Pending"}</Badge></TableCell>
                          <TableCell>{formatDate(d.uploaded_at || d.created_at)}</TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => previewDocument(d.file_path)}><Eye className="mr-2 h-4 w-4" />View</Button>
                              <Button variant="outline" size="sm" onClick={() => downloadDocument(d.file_path, d.file_name)}><Download className="mr-2 h-4 w-4" />Download</Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : <div className="px-5 py-10 text-sm text-muted-foreground">No documents found. Use Upload Document to add your first file.</div>}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PortalLayout>
  );
}