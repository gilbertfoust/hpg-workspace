import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useStaffProfiles } from "@/hooks/useStaffProfiles";
import { useTimesheets } from "@/hooks/useTimesheets";
import { usePTORequests } from "@/hooks/usePTORequests";
import { useStaffDocuments } from "@/hooks/useStaffDocuments";
import { useStaffCertifications } from "@/hooks/useStaffCertifications";
import { useNGOs } from "@/hooks/useNGOs";
import { useOrgUnits } from "@/hooks/useOrgUnits";
import { EMPLOYMENT_TYPES, STAFF_STATUSES } from "@/modules/hr/types";
import { ArrowLeft, User, Upload, FileText, Clock, CalendarDays, Award, Trash2, Save } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

const STAFF_DOC_TYPES = ["contract", "id_copy", "tax_form", "certification", "other"] as const;

export default function StaffProfileDetail() {
  const { staffId } = useParams<{ staffId: string }>();
  const navigate = useNavigate();
  const { data: allStaff, update } = useStaffProfiles();
  const staff = allStaff?.find(s => s.id === staffId);
  const { data: timesheets } = useTimesheets({ staff_id: staffId });
  const { data: ptos } = usePTORequests({ staff_id: staffId });
  const { data: docs, upload: uploadDoc, remove: removeDoc } = useStaffDocuments(staffId);
  const { data: certs, create: createCert } = useStaffCertifications(staffId);
  const { data: ngos } = useNGOs();
  const { data: orgUnits } = useOrgUnits();
  const fileRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState<string>("other");
  const [certForm, setCertForm] = useState({ certification_name: "", issuing_body: "", issue_date: "", expiry_date: "" });
  const [certOpen, setCertOpen] = useState(false);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  if (!staff) return <MainLayout><div className="p-8 text-center text-muted-foreground">Staff member not found</div></MainLayout>;

  const startEdit = () => {
    setForm({
      first_name: staff.first_name,
      last_name: staff.last_name,
      email: staff.email || "",
      phone: staff.phone || "",
      job_title: staff.job_title || "",
      employment_type: staff.employment_type,
      department_id: staff.department_id || "",
      ngo_id: staff.ngo_id || "",
      status: staff.status,
      start_date: staff.start_date || "",
      end_date: staff.end_date || "",
      annual_salary: String(staff.annual_salary || ""),
      hourly_rate: String(staff.hourly_rate || ""),
      emergency_contact_name: staff.emergency_contact_name || "",
      emergency_contact_phone: staff.emergency_contact_phone || "",
      notes: staff.notes || "",
    });
    setEditing(true);
  };

  const saveEdit = () => {
    const updates: Record<string, unknown> = { id: staffId! };
    Object.entries(form).forEach(([k, v]) => {
      if (k === "annual_salary" || k === "hourly_rate") {
        updates[k] = v ? Number(v) : null;
      } else {
        updates[k] = v || null;
      }
    });
    update.mutate(updates as any, { onSuccess: () => setEditing(false) });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !staffId) return;
    uploadDoc.mutate({ staffId, file, documentType: docType });
    e.target.value = "";
  };

  const downloadDoc = async (storagePath: string, fileName: string) => {
    const { data } = await supabase.storage.from("ngo-documents").createSignedUrl(storagePath, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/erp/hr/staff")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <User className="h-6 w-6" />
              {staff.first_name} {staff.last_name}
            </h1>
            <p className="text-muted-foreground">{staff.job_title || staff.employment_type.replace(/_/g, " ")} · {(staff as any).ngos?.common_name || (staff as any).ngos?.legal_name || "Unassigned"}</p>
          </div>
          <Badge variant={staff.status === "active" ? "default" : "secondary"}>{staff.status.replace(/_/g, " ")}</Badge>
          {!editing && <Button onClick={startEdit}>Edit Profile</Button>}
          {editing && <Button onClick={saveEdit} disabled={update.isPending}><Save className="h-4 w-4 mr-2" />Save</Button>}
        </div>

        <Tabs defaultValue="info" className="space-y-4">
          <TabsList>
            <TabsTrigger value="info">Personal Info</TabsTrigger>
            <TabsTrigger value="documents">Documents ({docs?.length || 0})</TabsTrigger>
            <TabsTrigger value="timesheets">Timesheets ({timesheets?.length || 0})</TabsTrigger>
            <TabsTrigger value="pto">PTO ({ptos?.length || 0})</TabsTrigger>
            <TabsTrigger value="certs">Certifications ({certs?.length || 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="info">
            {editing ? (
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div><Label>First Name</Label><Input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} /></div>
                    <div><Label>Last Name</Label><Input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} /></div>
                    <div><Label>Status</Label>
                      <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{STAFF_STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div><Label>Email</Label><Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                    <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
                    <div><Label>Job Title</Label><Input value={form.job_title} onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))} /></div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div><Label>Employment Type</Label>
                      <Select value={form.employment_type} onValueChange={v => setForm(f => ({ ...f, employment_type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{EMPLOYMENT_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>NGO</Label>
                      <Select value={form.ngo_id} onValueChange={v => setForm(f => ({ ...f, ngo_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>{ngos?.map(n => <SelectItem key={n.id} value={n.id}>{n.common_name || n.legal_name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Department</Label>
                      <Select value={form.department_id} onValueChange={v => setForm(f => ({ ...f, department_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>{orgUnits?.map(o => <SelectItem key={o.id} value={o.id}>{o.department_name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div><Label>Start Date</Label><Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></div>
                    <div><Label>End Date</Label><Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} /></div>
                    <div><Label>Annual Salary</Label><Input type="number" value={form.annual_salary} onChange={e => setForm(f => ({ ...f, annual_salary: e.target.value }))} /></div>
                    <div><Label>Hourly Rate</Label><Input type="number" value={form.hourly_rate} onChange={e => setForm(f => ({ ...f, hourly_rate: e.target.value }))} /></div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><Label>Emergency Contact Name</Label><Input value={form.emergency_contact_name} onChange={e => setForm(f => ({ ...f, emergency_contact_name: e.target.value }))} /></div>
                    <div><Label>Emergency Contact Phone</Label><Input value={form.emergency_contact_phone} onChange={e => setForm(f => ({ ...f, emergency_contact_phone: e.target.value }))} /></div>
                  </div>
                  <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} /></div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle className="text-sm">Contact</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p><span className="text-muted-foreground">Email:</span> {staff.email || "—"}</p>
                    <p><span className="text-muted-foreground">Phone:</span> {staff.phone || "—"}</p>
                    <p><span className="text-muted-foreground">Emergency:</span> {staff.emergency_contact_name || "—"} {staff.emergency_contact_phone ? `(${staff.emergency_contact_phone})` : ""}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-sm">Employment</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p><span className="text-muted-foreground">Type:</span> {staff.employment_type.replace(/_/g, " ")}</p>
                    <p><span className="text-muted-foreground">Department:</span> {(staff as any).org_units?.department_name || "—"}</p>
                    <p><span className="text-muted-foreground">Start:</span> {staff.start_date ? format(new Date(staff.start_date), "MMM d, yyyy") : "—"}</p>
                    <p><span className="text-muted-foreground">Salary:</span> {staff.annual_salary ? `$${Number(staff.annual_salary).toLocaleString()}` : "—"}</p>
                    <p><span className="text-muted-foreground">Rate:</span> {staff.hourly_rate ? `$${Number(staff.hourly_rate).toFixed(2)}/hr` : "—"}</p>
                    <p><span className="text-muted-foreground">PTO Balance:</span> {staff.pto_balance_hours}h</p>
                  </CardContent>
                </Card>
                {staff.notes && (
                  <Card className="md:col-span-2">
                    <CardHeader><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
                    <CardContent><p className="text-sm whitespace-pre-wrap">{staff.notes}</p></CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="documents">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Employee Documents</CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={docType} onValueChange={setDocType}>
                    <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{STAFF_DOC_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                  </Select>
                  <input ref={fileRef} type="file" className="hidden" onChange={handleFileUpload} />
                  <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploadDoc.isPending}>
                    <Upload className="h-3 w-3 mr-1" />Upload
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!docs?.length ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No documents</TableCell></TableRow>
                    ) : docs.map(d => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium flex items-center gap-2"><FileText className="h-3 w-3" />{d.file_name}</TableCell>
                        <TableCell><Badge variant="outline">{d.document_type}</Badge></TableCell>
                        <TableCell className="text-sm">{format(new Date(d.uploaded_at), "MMM d, yyyy")}</TableCell>
                        <TableCell className="text-sm">{d.expiry_date ? format(new Date(d.expiry_date), "MMM d, yyyy") : "—"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => downloadDoc(d.storage_path, d.file_name)}>View</Button>
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeDoc.mutate({ id: d.id, storagePath: d.storage_path })}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timesheets">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Period</TableHead><TableHead>Hours</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {!timesheets?.length ? (
                      <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">No timesheets</TableCell></TableRow>
                    ) : timesheets.map(ts => (
                      <TableRow key={ts.id}>
                        <TableCell className="text-sm">{format(new Date(ts.period_start), "MMM d")} – {format(new Date(ts.period_end), "MMM d, yyyy")}</TableCell>
                        <TableCell className="flex items-center gap-1 text-sm"><Clock className="h-3 w-3" />{ts.total_hours}h</TableCell>
                        <TableCell><Badge variant="outline">{ts.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pto">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Dates</TableHead><TableHead>Hours</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {!ptos?.length ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No PTO requests</TableCell></TableRow>
                    ) : ptos.map(p => (
                      <TableRow key={p.id}>
                        <TableCell><Badge variant="outline">{p.leave_type}</Badge></TableCell>
                        <TableCell className="text-sm flex items-center gap-1"><CalendarDays className="h-3 w-3" />{format(new Date(p.start_date), "MMM d")} – {format(new Date(p.end_date), "MMM d")}</TableCell>
                        <TableCell className="text-sm">{p.hours_requested}h</TableCell>
                        <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="certs">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Certifications & Training</CardTitle>
                <Dialog open={certOpen} onOpenChange={setCertOpen}>
                  <DialogTrigger asChild><Button size="sm"><Award className="h-3 w-3 mr-1" />Add</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add Certification</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div><Label>Certification Name *</Label><Input value={certForm.certification_name} onChange={e => setCertForm(f => ({ ...f, certification_name: e.target.value }))} /></div>
                      <div><Label>Issuing Body</Label><Input value={certForm.issuing_body} onChange={e => setCertForm(f => ({ ...f, issuing_body: e.target.value }))} /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>Issue Date</Label><Input type="date" value={certForm.issue_date} onChange={e => setCertForm(f => ({ ...f, issue_date: e.target.value }))} /></div>
                        <div><Label>Expiry Date</Label><Input type="date" value={certForm.expiry_date} onChange={e => setCertForm(f => ({ ...f, expiry_date: e.target.value }))} /></div>
                      </div>
                      <Button className="w-full" disabled={!certForm.certification_name} onClick={() => {
                        createCert.mutate({ staff_id: staffId!, ...certForm }, { onSuccess: () => { setCertOpen(false); setCertForm({ certification_name: "", issuing_body: "", issue_date: "", expiry_date: "" }); } });
                      }}>Add Certification</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Certification</TableHead><TableHead>Issuer</TableHead><TableHead>Issue Date</TableHead><TableHead>Expiry</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {!certs?.length ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No certifications</TableCell></TableRow>
                    ) : certs.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.certification_name}</TableCell>
                        <TableCell className="text-sm">{c.issuing_body || "—"}</TableCell>
                        <TableCell className="text-sm">{c.issue_date ? format(new Date(c.issue_date), "MMM d, yyyy") : "—"}</TableCell>
                        <TableCell className="text-sm">{c.expiry_date ? format(new Date(c.expiry_date), "MMM d, yyyy") : "—"}</TableCell>
                        <TableCell><Badge variant={c.status === "active" ? "default" : "destructive"}>{c.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
