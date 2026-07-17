import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { BarChart3, Download, Eye, Loader2, Upload, FileText, FileSignature, FolderOpen, ReceiptText, ShieldCheck } from "lucide-react";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";
import { useDocumentUrl, useUploadDocument } from "@/hooks/useDocuments";
import { emptyPayloadForFields, useNgoPortalFormTemplates, useSubmitNgoPortalForm } from "@/hooks/useNgoPortalForms";
import type { FormTemplate } from "@/hooks/useFormTemplates";
import { NgoFinancePortal } from "@/components/portal/NgoFinancePortal";
import { NgoOnboardingPortal } from "@/components/portal/NgoOnboardingPortal";
import { NgoFinancialInsights } from "@/components/portal/NgoFinancialInsights";

interface PortalContactRow {
  ngo_id: string | null;
  ngos: { id: string; legal_name: string; common_name: string | null; country?: string | null } | null;
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

interface CompliancePeriodRow {
  id: string;
  ngo_id: string;
  period_type: string;
  period_label: string;
  period_start: string | null;
  period_end: string | null;
  due_date: string | null;
  status: string;
  submitted_at: string | null;
  reviewed_at: string | null;
}

const ensureSupabase = () => { if (!supabase) throw getSupabaseNotConfiguredError(); };
const formatDate = (v: string | null) => v ? format(new Date(v), "MMM d, yyyy") : "—";
const formatFileSize = (bytes: number | null) => {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

function StatusBadge({ status }: { status: string | null }) {
  const clean = status ? status.replace(/_/g, " ") : "Pending";
  const variant = status === "approved" ? "default" : status === "rejected" || status === "overdue" ? "destructive" : "secondary";
  return <Badge variant={variant}>{clean}</Badge>;
}

function NgoPortalRequestForm({ template, ngoId }: { template: FormTemplate; ngoId: string }) {
  const submitRequest = useSubmitNgoPortalForm();
  const [payload, setPayload] = useState<Record<string, string>>(() => emptyPayloadForFields(template.schema_json?.fields || []));

  useEffect(() => {
    setPayload(emptyPayloadForFields(template.schema_json?.fields || []));
  }, [template.id, template.schema_json?.fields]);

  const updateField = (name: string, value: string) => setPayload((current) => ({ ...current, [name]: value }));

  const handleSubmit = async () => {
    const fields = template.schema_json?.fields || [];
    const missing = fields.find((field) => field.required && !String(payload[field.name] || "").trim());
    if (missing) throw new Error(`${missing.label} is required.`);
    await submitRequest.mutateAsync({ formTemplate: template, ngoId, payloadJson: payload });
    setPayload(emptyPayloadForFields(fields));
  };

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div>
          <h3 className="text-lg font-semibold">{template.name}</h3>
          <p className="text-sm text-muted-foreground">{template.description}</p>
        </div>
        <div className="grid gap-4">
          {(template.schema_json?.fields || []).map((field) => (
            <div key={field.name} className="space-y-2">
              <Label>{field.label}{field.required ? " *" : ""}</Label>
              {field.type === "textarea" ? (
                <Textarea value={payload[field.name] || ""} onChange={(event) => updateField(field.name, event.target.value)} rows={4} />
              ) : field.type === "select" ? (
                <Select value={payload[field.name] || ""} onValueChange={(value) => updateField(field.name, value)}>
                  <SelectTrigger><SelectValue placeholder="Select an option" /></SelectTrigger>
                  <SelectContent>{(field.options || []).map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                </Select>
              ) : (
                <Input type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"} value={payload[field.name] || ""} onChange={(event) => updateField(field.name, event.target.value)} />
              )}
            </div>
          ))}
        </div>
        <Button onClick={handleSubmit} disabled={submitRequest.isPending}>
          {submitRequest.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Submit to NGO Coordination
        </Button>
      </CardContent>
    </Card>
  );
}

export default function Portal() {
  const { user } = useAuth();
  const uploadDocument = useUploadDocument();
  const { downloadDocument, previewDocument } = useDocumentUrl();
  const { data: portalForms = [], isLoading: formsLoading } = useNgoPortalFormTemplates();
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [selectedUploadNgoId, setSelectedUploadNgoId] = useState<string>("");

  const { data: ngoContacts, isLoading: ngoLoading } = useQuery({
    queryKey: ["portal-ngos", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      ensureSupabase();
      const { data, error } = await (supabase as any).from("ngo_portal_memberships").select("ngo_id, ngos(id, legal_name, common_name, country)").eq("user_id", user?.id ?? "").eq("status", "active");
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

  const { data: requestSubmissions, isLoading: requestsLoading } = useQuery({
    queryKey: ["portal-form-submissions", ngoIds],
    enabled: ngoIds.length > 0,
    queryFn: async () => {
      ensureSupabase();
      const { data, error } = await supabase
        .from("form_submissions")
        .select("id, ngo_id, submission_status, intake_status, routed_to_module, submitted_at, created_at, form_templates(name)")
        .in("ngo_id", ngoIds)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: compliancePeriods, isLoading: complianceLoading } = useQuery({
    queryKey: ["portal-compliance-periods", ngoIds],
    enabled: ngoIds.length > 0,
    queryFn: async () => {
      ensureSupabase();
      const { data, error } = await (supabase as any)
        .from("ngo_compliance_periods")
        .select("id, ngo_id, period_type, period_label, period_start, period_end, due_date, status, submitted_at, reviewed_at")
        .in("ngo_id", ngoIds)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CompliancePeriodRow[];
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

  const activeNgoId = selectedUploadNgoId || ngos[0]?.id || "";

  return (
    <PortalLayout title="NGO Portal" subtitle="Submit requests, upload documents, and track compliance for your organization.">
      <div className="flex flex-col gap-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardContent className="p-5 text-center"><p className="text-2xl font-bold">{ngos.length}</p><p className="text-xs text-muted-foreground mt-1">Your NGOs</p></CardContent></Card>
          <Card><CardContent className="p-5 text-center"><p className="text-2xl font-bold">{requestSubmissions?.length ?? 0}</p><p className="text-xs text-muted-foreground mt-1">Requests</p></CardContent></Card>
          <Card><CardContent className="p-5 text-center"><p className="text-2xl font-bold">{compliancePeriods?.length ?? 0}</p><p className="text-xs text-muted-foreground mt-1">Compliance Periods</p></CardContent></Card>
          <Card><CardContent className="p-5 text-center"><p className="text-2xl font-bold">{documents?.length ?? 0}</p><p className="text-xs text-muted-foreground mt-1">Documents</p></CardContent></Card>
        </div>

        <div className="rounded-lg border bg-card p-4 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-primary mt-0.5" />
          <p className="text-sm text-muted-foreground">This portal is locked to NGO access only. Requests are submitted to NGO Coordination first, then routed internally to the correct HPG department.</p>
        </div>

        {ngos.length > 0 && <div className="flex flex-wrap gap-2">{ngos.map(ngo => <Badge key={ngo.id} variant="secondary" className="px-3 py-1 text-sm">{ngo.name}</Badge>)}</div>}

        <Tabs defaultValue="onboarding">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="onboarding"><FileSignature className="w-4 h-4 mr-1" />Onboarding</TabsTrigger>
            <TabsTrigger value="requests"><FileText className="w-4 h-4 mr-1" />Submit Request</TabsTrigger>
            <TabsTrigger value="finance"><ReceiptText className="w-4 h-4 mr-1" />Accounting</TabsTrigger>
            <TabsTrigger value="insights"><BarChart3 className="w-4 h-4 mr-1" />Financial Insights</TabsTrigger>
            <TabsTrigger value="tracking"><FileText className="w-4 h-4 mr-1" />Request Tracking</TabsTrigger>
            <TabsTrigger value="compliance"><ShieldCheck className="w-4 h-4 mr-1" />Compliance</TabsTrigger>
            <TabsTrigger value="documents"><FolderOpen className="w-4 h-4 mr-1" />Documents</TabsTrigger>
          </TabsList>

          <TabsContent value="onboarding">
            {activeNgoId ? <NgoOnboardingPortal ngoId={activeNgoId} country={ngoContacts?.find((row) => row.ngo_id === activeNgoId)?.ngos?.country} /> : <Card><CardContent className="p-8 text-sm text-muted-foreground">Your account is not linked to an active NGO.</CardContent></Card>}
          </TabsContent>

          <TabsContent value="requests" className="space-y-4">
            {formsLoading || ngoLoading ? <div className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div> : portalForms.length > 0 && activeNgoId ? portalForms.map((template) => <NgoPortalRequestForm key={template.id} template={template} ngoId={activeNgoId} />) : <Card><CardContent className="p-8 text-sm text-muted-foreground">No NGO request forms are available yet.</CardContent></Card>}
          </TabsContent>

          <TabsContent value="finance">
            {activeNgoId ? <NgoFinancePortal ngoId={activeNgoId} /> : <Card><CardContent className="p-8 text-sm text-muted-foreground">Your account is not linked to an active NGO.</CardContent></Card>}
          </TabsContent>

          <TabsContent value="insights">
            {activeNgoId ? <NgoFinancialInsights ngoId={activeNgoId} /> : null}
          </TabsContent>

          <TabsContent value="tracking">
            <Card><CardContent className="p-0">
              <div className="border-b px-5 py-4"><h2 className="text-lg font-semibold">Request Tracking</h2><p className="text-sm text-muted-foreground">Requests submitted to NGO Coordination and routed internally.</p></div>
              {requestsLoading ? <div className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div> : requestSubmissions && requestSubmissions.length > 0 ? (
                <Table><TableHeader><TableRow><TableHead>Request</TableHead><TableHead>NGO</TableHead><TableHead>Intake</TableHead><TableHead>Routed To</TableHead><TableHead>Submitted</TableHead></TableRow></TableHeader><TableBody>{requestSubmissions.map((s) => <TableRow key={s.id}><TableCell className="font-medium">{s.form_templates?.name || "Request"}</TableCell><TableCell>{s.ngo_id ? ngoNameLookup.get(s.ngo_id) || "—" : "—"}</TableCell><TableCell><StatusBadge status={s.intake_status} /></TableCell><TableCell>{s.routed_to_module || "NGO Coordination"}</TableCell><TableCell>{s.submitted_at ? formatDate(s.submitted_at) : formatDate(s.created_at)}</TableCell></TableRow>)}</TableBody></Table>
              ) : <div className="px-5 py-10 text-sm text-muted-foreground">No requests submitted yet.</div>}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="compliance">
            <Card><CardContent className="p-0">
              <div className="border-b px-5 py-4"><h2 className="text-lg font-semibold">Quarterly & Annual Compliance</h2><p className="text-sm text-muted-foreground">Track status for required compliance periods.</p></div>
              {complianceLoading ? <div className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div> : compliancePeriods && compliancePeriods.length > 0 ? (
                <Table><TableHeader><TableRow><TableHead>Period</TableHead><TableHead>NGO</TableHead><TableHead>Type</TableHead><TableHead>Due Date</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{compliancePeriods.map((p) => <TableRow key={p.id}><TableCell className="font-medium">{p.period_label}</TableCell><TableCell>{ngoNameLookup.get(p.ngo_id) || "—"}</TableCell><TableCell>{p.period_type}</TableCell><TableCell>{formatDate(p.due_date)}</TableCell><TableCell><StatusBadge status={p.status} /></TableCell></TableRow>)}</TableBody></Table>
              ) : <div className="px-5 py-10 text-sm text-muted-foreground">No compliance periods are available yet.</div>}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="documents">
            <Card><CardContent className="p-0">
              <div className="border-b px-5 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h2 className="text-lg font-semibold">Documents</h2><p className="text-sm text-muted-foreground">Upload, view, and download files associated with your NGO.</p></div><div className="flex flex-col gap-2 sm:flex-row sm:items-center">{ngos.length > 1 && <select className="h-9 rounded-md border bg-background px-3 text-sm" value={selectedUploadNgoId} onChange={(e) => setSelectedUploadNgoId(e.target.value)}>{ngos.map(ngo => <option key={ngo.id} value={ngo.id}>{ngo.name}</option>)}</select>}<label className="inline-flex"><input type="file" className="hidden" onChange={(e) => handleGeneralDocumentUpload(e.target.files)} disabled={!activeNgoId || uploadingId === "general-document-upload"} /><Button asChild disabled={!activeNgoId || uploadingId === "general-document-upload"}><span>{uploadingId === "general-document-upload" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Upload Document</span></Button></label></div></div>
              {docsLoading ? <div className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div> : documents && documents.length > 0 ? (
                <Table><TableHeader><TableRow><TableHead>File Name</TableHead><TableHead>NGO</TableHead><TableHead>Category</TableHead><TableHead>Size</TableHead><TableHead>Status</TableHead><TableHead>Uploaded</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{documents.map(d => <TableRow key={d.id}><TableCell className="font-medium">{d.file_name}</TableCell><TableCell>{d.ngo_id ? ngoNameLookup.get(d.ngo_id) || "—" : "—"}</TableCell><TableCell><Badge variant="outline">{d.category}</Badge></TableCell><TableCell>{formatFileSize(d.file_size)}</TableCell><TableCell><StatusBadge status={d.review_status} /></TableCell><TableCell>{formatDate(d.uploaded_at || d.created_at)}</TableCell><TableCell className="text-right"><div className="inline-flex gap-2"><Button variant="outline" size="sm" onClick={() => previewDocument(d.file_path)}><Eye className="mr-2 h-4 w-4" />View</Button><Button variant="outline" size="sm" onClick={() => downloadDocument(d.file_path, d.file_name)}><Download className="mr-2 h-4 w-4" />Download</Button></div></TableCell></TableRow>)}</TableBody></Table>
              ) : <div className="px-5 py-10 text-sm text-muted-foreground">No documents found. Use Upload Document to add your first file.</div>}
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </PortalLayout>
  );
}
