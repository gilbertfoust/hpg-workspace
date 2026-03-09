import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, Upload, FileText, CheckCircle, Clock, FolderOpen } from "lucide-react";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";
import { useUploadDocument } from "@/hooks/useDocuments";
import { WorkItem } from "@/hooks/useWorkItems";

interface PortalContactRow {
  ngo_id: string | null;
  ngos: { id: string; legal_name: string; common_name: string | null } | null;
}

interface NgoSummary { id: string; name: string; }

const statusLabels: Record<string, string> = {
  draft: "Draft", not_started: "Not started", in_progress: "In progress",
  waiting_on_ngo: "Waiting on NGO", waiting_on_hpg: "Waiting on HPG",
  submitted: "Submitted", under_review: "Under review", approved: "Approved",
  rejected: "Rejected", complete: "Complete", canceled: "Canceled",
};

const ensureSupabase = () => { if (!supabase) throw getSupabaseNotConfiguredError(); };
const formatDate = (v: string | null) => v ? format(new Date(v), "MMM d, yyyy") : "—";
const formatStatus = (s: string | null) => s ? (statusLabels[s] || s.replace(/_/g, " ")) : "—";

export default function Portal() {
  const { user } = useAuth();
  const uploadDocument = useUploadDocument();
  const [uploadingId, setUploadingId] = useState<string | null>(null);

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

  // Form submissions for portal NGOs
  const { data: formSubmissions, isLoading: formsLoading } = useQuery({
    queryKey: ["portal-form-submissions", ngoIds],
    enabled: ngoIds.length > 0,
    queryFn: async () => {
      ensureSupabase();
      const { data, error } = await supabase.from("form_submissions").select("id, form_template_id, ngo_id, status, submitted_at, created_at, form_templates(title)").in("ngo_id", ngoIds).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data as any[];
    },
  });

  // Documents for portal NGOs
  const { data: documents, isLoading: docsLoading } = useQuery({
    queryKey: ["portal-documents", ngoIds],
    enabled: ngoIds.length > 0,
    queryFn: async () => {
      ensureSupabase();
      const { data, error } = await supabase.from("documents").select("id, file_name, category, review_status, ngo_id, created_at").in("ngo_id", ngoIds).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data as any[];
    },
  });

  const handleFileUpload = async (workItem: WorkItem, files: FileList | null) => {
    const file = files?.[0];
    if (!file || !workItem.ngo_id) return;
    try {
      setUploadingId(workItem.id);
      await uploadDocument.mutateAsync({ file, ngoId: workItem.ngo_id, category: "other", workItemId: workItem.id, reviewStatus: "Pending" });
    } finally {
      setUploadingId(null);
    }
  };

  const isLoading = ngoLoading || workItemsLoading;
  const activeWorkItems = workItems?.filter(wi => !["complete", "canceled", "approved"].includes(wi.status)) ?? [];
  const completedWorkItems = workItems?.filter(wi => ["complete", "approved"].includes(wi.status)) ?? [];

  return (
    <PortalLayout title="NGO Portal" subtitle="View tasks, submissions, and documents for your organization.">
      <div className="flex flex-col gap-6">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-5 text-center">
              <p className="text-2xl font-bold">{ngos.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Your NGOs</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 text-center">
              <p className="text-2xl font-bold text-orange-500">{activeWorkItems.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Active Tasks</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 text-center">
              <p className="text-2xl font-bold text-primary">{completedWorkItems.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 text-center">
              <p className="text-2xl font-bold">{documents?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Documents</p>
            </CardContent>
          </Card>
        </div>

        {/* NGO badges */}
        {ngos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {ngos.map(ngo => (
              <Badge key={ngo.id} variant="secondary" className="px-3 py-1 text-sm">{ngo.name}</Badge>
            ))}
          </div>
        )}

        {/* Tabbed Content */}
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
                    <TableHeader>
                      <TableRow>
                        <TableHead>NGO</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Due</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Evidence</TableHead>
                      </TableRow>
                    </TableHeader>
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
                                  <span>
                                    {uploadingId === item.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                    Upload
                                  </span>
                                </Button>
                              </label>
                            ) : (
                              <span className="text-sm text-muted-foreground">Not required</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="px-5 py-10 text-sm text-muted-foreground">No external-visible work items.</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="forms">
            <Card>
              <CardContent className="p-0">
                <div className="border-b px-5 py-4">
                  <h2 className="text-lg font-semibold">Form Submissions</h2>
                  <p className="text-sm text-muted-foreground">Submissions filed for your NGO.</p>
                </div>
                {formsLoading ? (
                  <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                ) : formSubmissions && formSubmissions.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Form</TableHead>
                        <TableHead>NGO</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Submitted</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formSubmissions.map(s => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{s.form_templates?.title ?? "Unknown form"}</TableCell>
                          <TableCell>{s.ngo_id ? ngoNameLookup.get(s.ngo_id) || "—" : "—"}</TableCell>
                          <TableCell><Badge variant={s.status === "submitted" ? "default" : "outline"}>{formatStatus(s.status)}</Badge></TableCell>
                          <TableCell>{s.submitted_at ? formatDate(s.submitted_at) : formatDate(s.created_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="px-5 py-10 text-sm text-muted-foreground">No form submissions found.</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents">
            <Card>
              <CardContent className="p-0">
                <div className="border-b px-5 py-4">
                  <h2 className="text-lg font-semibold">Documents</h2>
                  <p className="text-sm text-muted-foreground">Files associated with your NGO.</p>
                </div>
                {docsLoading ? (
                  <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                ) : documents && documents.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>File Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Review Status</TableHead>
                        <TableHead>Uploaded</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documents.map(d => (
                        <TableRow key={d.id}>
                          <TableCell className="font-medium">{d.file_name}</TableCell>
                          <TableCell><Badge variant="outline">{d.category}</Badge></TableCell>
                          <TableCell>
                            <Badge variant={d.review_status === "Approved" ? "default" : d.review_status === "Rejected" ? "destructive" : "secondary"}>
                              {d.review_status}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDate(d.created_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="px-5 py-10 text-sm text-muted-foreground">No documents found.</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PortalLayout>
  );
}
