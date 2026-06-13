import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Download, Eye, FileText, FolderOpen, HelpCircle, Loader2, Send, Upload } from "lucide-react";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";
import { useDocumentUrl, useUploadDocument } from "@/hooks/useDocuments";
import { useCreateNgoRequestSubmission, useNgoRequestSubmissions, useNgoRequestTemplates, type NgoRequestTemplate } from "@/hooks/useNgoPortalRequests";
import type { ModuleType } from "@/hooks/useWorkItems";

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
  submitted_to_ngo_coordination: "Sent to NGO Coordination",
  triage_in_progress: "NGO Coordination Reviewing",
  routed_to_department: "Routed to Department",
  waiting_on_ngo: "Waiting on NGO",
  complete: "Complete",
  rejected: "Rejected",
  not_started: "Not Started",
  in_progress: "In Progress",
  submitted: "Submitted",
  under_review: "Under Review",
  approved: "Approved",
  overdue: "Overdue",
};

const moduleLabels: Record<ModuleType, string> = {
  ngo_coordination: "NGO Coordination",
  administration: "Administration",
  operations: "Operations",
  program: "Program",
  curriculum: "Curriculum",
  development: "Development / Grants",
  partnership: "Partnerships",
  marketing: "Marketing",
  communications: "Communications",
  hr: "HR",
  it: "Technology / IT",
  finance: "Finance",
  legal: "Legal / Compliance",
};

const moduleOptions: ModuleType[] = [
  "ngo_coordination",
  "finance",
  "legal",
  "development",
  "operations",
  "communications",
  "it",
  "program",
];

const ensureSupabase = () => { if (!supabase) throw getSupabaseNotConfiguredError(); };
const formatDate = (value: string | null) => value ? format(new Date(value), "MMM d, yyyy") : "—";
const formatStatus = (status: string | null) => status ? (statusLabels[status] || status.replace(/_/g, " ")) : "—";
const formatFileSize = (bytes: number | null) => {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function Portal() {
  const { user } = useAuth();
  const uploadDocument = useUploadDocument();
  const createRequest = useCreateNgoRequestSubmission();
  const { downloadDocument, previewDocument } = useDocumentUrl();
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [selectedUploadNgoId, setSelectedUploadNgoId] = useState<string>("");
  const [selectedRequestNgoId, setSelectedRequestNgoId] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<NgoRequestTemplate | null>(null);
  const [requestPayload, setRequestPayload] = useState<Record<string, string>>({});
  const [requestedModule, setRequestedModule] = useState<ModuleType>("ngo_coordination");

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

  const ngos = useMemo<NgoSummary[]>(() => {
    const unique = new Map<string, NgoSummary>();
    (ngoContacts || []).forEach((contact) => {
      if (contact.ngo_id && contact.ngos) {
        unique.set(contact.ngo_id, { id: contact.ngo_id, name: contact.ngos.common_name || contact.ngos.legal_name });
      }
    });
    return Array.from(unique.values());
  }, [ngoContacts]);

  const ngoIds = useMemo(() => ngos.map((ngo) => ngo.id), [ngos]);
  const ngoNameLookup = useMemo(() => new Map(ngos.map((ngo) => [ngo.id, ngo.name])), [ngos]);

  useEffect(() => {
    if (!selectedUploadNgoId && ngos.length > 0) setSelectedUploadNgoId(ngos[0].id);
    if (!selectedRequestNgoId && ngos.length > 0) setSelectedRequestNgoId(ngos[0].id);
  }, [ngos, selectedUploadNgoId, selectedRequestNgoId]);

  const { data: requestTemplates = [], isLoading: templatesLoading } = useNgoRequestTemplates();
  const { data: requestSubmissions = [], isLoading: requestsLoading } = useNgoRequestSubmissions(ngoIds);

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
      await uploadDocument.mutateAsync({ file, ngoId: selectedUploadNgoId, category: "other", reviewStatus: "Pending" });
    } finally {
      setUploadingId(null);
    }
  };

  const openRequestDialog = (template: NgoRequestTemplate) => {
    setSelectedTemplate(template);
    setRequestPayload({});
    setRequestedModule(template.default_module || "ngo_coordination");
  };

  const updatePayload = (key: string, value: string) => {
    setRequestPayload((current) => ({ ...current, [key]: value }));
  };

  const handleSubmitRequest = async () => {
    if (!selectedTemplate || !selectedRequestNgoId) return;
    await createRequest.mutateAsync({
      template: selectedTemplate,
      ngoId: selectedRequestNgoId,
      payload: requestPayload,
      requestedModule,
    });
    setSelectedTemplate(null);
    setRequestPayload({});
  };

  const renderRequestFields = () => {
    if (!selectedTemplate) return null;
    const isReceipt = selectedTemplate.request_type === "receipt_submission";
    const isCompliance = selectedTemplate.request_type === "compliance_support";

    return (
      <div className="space-y-4">
        {ngos.length > 1 && (
          <div className="space-y-2">
            <Label>NGO</Label>
            <Select value={selectedRequestNgoId} onValueChange={setSelectedRequestNgoId}>
              <SelectTrigger><SelectValue placeholder="Select NGO" /></SelectTrigger>
              <SelectContent>{ngos.map((ngo) => <SelectItem key={ngo.id} value={ngo.id}>{ngo.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label>Best department for this request</Label>
          <Select value={requestedModule} onValueChange={(value) => setRequestedModule(value as ModuleType)}>
            <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
            <SelectContent>{moduleOptions.map((module) => <SelectItem key={module} value={module}>{moduleLabels[module]}</SelectItem>)}</SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">NGO Coordination will review this first and can reroute it internally.</p>
        </div>

        {isReceipt && (
          <>
            <div className="space-y-2"><Label>Expense Date</Label><Input type="date" value={requestPayload.expense_date || ""} onChange={(event) => updatePayload("expense_date", event.target.value)} /></div>
            <div className="space-y-2"><Label>Amount</Label><Input type="number" value={requestPayload.amount || ""} onChange={(event) => updatePayload("amount", event.target.value)} /></div>
          </>
        )}

        {isCompliance && (
          <div className="space-y-2"><Label>Compliance Period</Label><Input placeholder="Example: Q2 2026 or Annual 2026" value={requestPayload.compliance_period || ""} onChange={(event) => updatePayload("compliance_period", event.target.value)} /></div>
        )}

        <div className="space-y-2">
          <Label>{isReceipt ? "Purpose / Explanation" : "Request Summary"}</Label>
          <Input value={requestPayload.summary || ""} onChange={(event) => updatePayload("summary", event.target.value)} placeholder="Brief summary" />
        </div>
        <div className="space-y-2">
          <Label>Details</Label>
          <Textarea value={requestPayload.details || ""} onChange={(event) => updatePayload("details", event.target.value)} rows={5} placeholder="Explain what you need help with." />
        </div>
      </div>
    );
  };

  const totalOpenRequests = requestSubmissions.filter((request) => !["complete", "rejected"].includes(request.status)).length;

  return (
    <PortalLayout title="NGO Portal" subtitle="Submit requests, upload documents, and track what NGO Coordination is reviewing for your organization.">
      <div className="flex flex-col gap-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardContent className="p-5 text-center"><p className="text-2xl font-bold">{ngoLoading ? "—" : ngos.length}</p><p className="text-xs text-muted-foreground mt-1">Your NGOs</p></CardContent></Card>
          <Card><CardContent className="p-5 text-center"><p className="text-2xl font-bold text-orange-500">{totalOpenRequests}</p><p className="text-xs text-muted-foreground mt-1">Open Requests</p></CardContent></Card>
          <Card><CardContent className="p-5 text-center"><p className="text-2xl font-bold text-primary">{requestSubmissions.length}</p><p className="text-xs text-muted-foreground mt-1">Total Requests</p></CardContent></Card>
          <Card><CardContent className="p-5 text-center"><p className="text-2xl font-bold">{documents?.length ?? 0}</p><p className="text-xs text-muted-foreground mt-1">Documents</p></CardContent></Card>
        </div>

        {ngos.length > 0 && <div className="flex flex-wrap gap-2">{ngos.map((ngo) => <Badge key={ngo.id} variant="secondary" className="px-3 py-1 text-sm">{ngo.name}</Badge>)}</div>}

        <Tabs defaultValue="requests">
          <TabsList>
            <TabsTrigger value="requests"><HelpCircle className="w-4 h-4 mr-1" />Requests</TabsTrigger>
            <TabsTrigger value="documents"><FolderOpen className="w-4 h-4 mr-1" />Documents</TabsTrigger>
            <TabsTrigger value="history"><FileText className="w-4 h-4 mr-1" />Request History</TabsTrigger>
          </TabsList>

          <TabsContent value="requests">
            <Card>
              <CardHeader>
                <CardTitle>Submit a Request to NGO Coordination</CardTitle>
                <p className="text-sm text-muted-foreground">These are NGO-facing request forms. NGO Coordination receives them first and then routes them to the proper internal department.</p>
              </CardHeader>
              <CardContent>
                {templatesLoading ? <div className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div> : (
                  <div className="grid gap-4 md:grid-cols-3">
                    {requestTemplates.map((template) => (
                      <Card key={template.id} className="border-muted">
                        <CardContent className="p-4 space-y-3">
                          <div>
                            <h3 className="font-semibold">{template.name}</h3>
                            <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
                          </div>
                          <Badge variant="outline">Starts with NGO Coordination</Badge>
                          <Button className="w-full" onClick={() => openRequestDialog(template)}>
                            <Send className="w-4 h-4 mr-2" />Start Request
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents">
            <Card>
              <CardContent className="p-0">
                <div className="border-b px-5 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div><h2 className="text-lg font-semibold">Documents</h2><p className="text-sm text-muted-foreground">Upload, view, and download files associated with your NGO.</p></div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    {ngos.length > 1 && <select className="h-9 rounded-md border bg-background px-3 text-sm" value={selectedUploadNgoId} onChange={(event) => setSelectedUploadNgoId(event.target.value)}>{ngos.map((ngo) => <option key={ngo.id} value={ngo.id}>{ngo.name}</option>)}</select>}
                    <label className="inline-flex">
                      <input type="file" className="hidden" onChange={(event) => handleGeneralDocumentUpload(event.target.files)} disabled={!selectedUploadNgoId || uploadingId === "general-document-upload"} />
                      <Button asChild disabled={!selectedUploadNgoId || uploadingId === "general-document-upload"}>
                        <span>{uploadingId === "general-document-upload" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Upload Document</span>
                      </Button>
                    </label>
                  </div>
                </div>
                {docsLoading ? <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : documents && documents.length > 0 ? (
                  <Table>
                    <TableHeader><TableRow><TableHead>File Name</TableHead><TableHead>NGO</TableHead><TableHead>Category</TableHead><TableHead>Size</TableHead><TableHead>Status</TableHead><TableHead>Uploaded</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                    <TableBody>{documents.map((doc) => <TableRow key={doc.id}><TableCell className="font-medium">{doc.file_name}</TableCell><TableCell>{doc.ngo_id ? ngoNameLookup.get(doc.ngo_id) || "—" : "—"}</TableCell><TableCell><Badge variant="outline">{doc.category}</Badge></TableCell><TableCell>{formatFileSize(doc.file_size)}</TableCell><TableCell><Badge variant="secondary">{doc.review_status || "Pending"}</Badge></TableCell><TableCell>{formatDate(doc.uploaded_at || doc.created_at)}</TableCell><TableCell className="text-right"><div className="inline-flex gap-2"><Button variant="outline" size="sm" onClick={() => previewDocument(doc.file_path)}><Eye className="mr-2 h-4 w-4" />View</Button><Button variant="outline" size="sm" onClick={() => downloadDocument(doc.file_path, doc.file_name)}><Download className="mr-2 h-4 w-4" />Download</Button></div></TableCell></TableRow>)}</TableBody>
                  </Table>
                ) : <div className="px-5 py-10 text-sm text-muted-foreground">No documents found. Use Upload Document to add your first file.</div>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardContent className="p-0">
                <div className="border-b px-5 py-4"><h2 className="text-lg font-semibold">Request History</h2><p className="text-sm text-muted-foreground">Track requests submitted to NGO Coordination and their routing status.</p></div>
                {requestsLoading ? <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : requestSubmissions.length > 0 ? (
                  <Table>
                    <TableHeader><TableRow><TableHead>Request</TableHead><TableHead>NGO</TableHead><TableHead>Status</TableHead><TableHead>Requested Department</TableHead><TableHead>Submitted</TableHead></TableRow></TableHeader>
                    <TableBody>{requestSubmissions.map((request) => <TableRow key={request.id}><TableCell className="font-medium">{request.ngo_request_templates?.name || "Request"}</TableCell><TableCell>{ngoNameLookup.get(request.ngo_id) || "—"}</TableCell><TableCell><Badge variant="outline">{formatStatus(request.status)}</Badge></TableCell><TableCell>{request.requested_module ? moduleLabels[request.requested_module] : "NGO Coordination"}</TableCell><TableCell>{formatDate(request.submitted_at)}</TableCell></TableRow>)}</TableBody>
                  </Table>
                ) : <div className="px-5 py-10 text-sm text-muted-foreground">No requests submitted yet.</div>}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!selectedTemplate} onOpenChange={(open) => !open && setSelectedTemplate(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{selectedTemplate?.name}</DialogTitle>
            <DialogDescription>{selectedTemplate?.description}</DialogDescription>
          </DialogHeader>
          {renderRequestFields()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTemplate(null)}>Cancel</Button>
            <Button onClick={handleSubmitRequest} disabled={createRequest.isPending || !selectedRequestNgoId || !requestPayload.summary}>
              {createRequest.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Submit to NGO Coordination
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
