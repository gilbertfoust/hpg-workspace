import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, CheckCircle2, ExternalLink, FileCheck2, Loader2, ShieldAlert } from "lucide-react";
import { useWorkspaceNgo } from "@/hooks/useWorkspaceNgo";
import { useForm990 } from "@/hooks/useForm990";

export default function FinanceForm990Page() {
  const { selectedNgo, selectedNgoId } = useWorkspaceNgo();
  const [returnId, setReturnId] = useState<string | null>(null);
  const form990 = useForm990(selectedNgoId, returnId);
  const [create, setCreate] = useState({ taxYear: new Date().getFullYear() - 1, grossReceipts: "", assets: "", legalName: selectedNgo?.legal_name || "", ein: "", forceFull: false, ineligible990n: false });
  const [sectionDrafts, setSectionDrafts] = useState<Record<string,string>>({});
  useEffect(() => setCreate((current) => ({ ...current, legalName: selectedNgo?.legal_name || "" })), [selectedNgo?.legal_name]);
  useEffect(() => { if (!returnId && form990.returns.data?.[0]) setReturnId(form990.returns.data[0].id); }, [form990.returns.data, returnId]);
  const current = form990.returns.data?.find((item: any) => item.id === returnId);

  if (!selectedNgoId) return <MainLayout title="Form 990 Center"><Card><CardContent className="p-8 text-sm text-muted-foreground">Select an NGO to prepare its annual exempt-organization return.</CardContent></Card></MainLayout>;
  return <MainLayout title="Form 990 Center" subtitle={`${selectedNgo?.common_name || selectedNgo?.legal_name}: annual return preparation, validation, and authorized filing handoff.`}>
    <div className="space-y-6">
      <div className="rounded-lg border bg-amber-50 p-4 text-sm text-amber-950 flex gap-3"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" /><p>Production Form 990 e-file transmission activates only after HPG or its provider has an EFIN/ETIN and passes IRS Assurance Testing. Form 990-N uses the IRS-authenticated filing handoff because no general third-party filing API is published.</p></div>
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-5">
          <Card><CardHeader><CardTitle>Start annual return</CardTitle><CardDescription>The system selects 990-N when receipts normally qualify, unless Finance forces the full 990.</CardDescription></CardHeader><CardContent className="space-y-3">
            <div className="space-y-2"><Label>Tax year</Label><Input type="number" value={create.taxYear} onChange={(e) => setCreate({ ...create, taxYear: Number(e.target.value) })} /></div>
            <div className="space-y-2"><Label>Legal name</Label><Input value={create.legalName} onChange={(e) => setCreate({ ...create, legalName: e.target.value })} /></div>
            <div className="space-y-2"><Label>EIN</Label><Input placeholder="12-3456789" value={create.ein} onChange={(e) => setCreate({ ...create, ein: e.target.value })} /></div>
            <div className="space-y-2"><Label>Gross receipts</Label><Input type="number" value={create.grossReceipts} onChange={(e) => setCreate({ ...create, grossReceipts: e.target.value })} /></div>
            <div className="space-y-2"><Label>Year-end assets</Label><Input type="number" value={create.assets} onChange={(e) => setCreate({ ...create, assets: e.target.value })} /></div>
            <label className="flex gap-2 text-sm"><input type="checkbox" checked={create.forceFull} onChange={(e) => setCreate({ ...create, forceFull: e.target.checked })} />Prepare full Form 990</label>
            <label className="flex gap-2 text-sm"><input type="checkbox" checked={create.ineligible990n} onChange={(e) => setCreate({ ...create, ineligible990n: e.target.checked })} />Organization is not eligible for 990-N</label>
            <Button className="w-full" disabled={form990.create.isPending || !create.legalName || !create.ein} onClick={() => form990.create.mutate(create)}>{form990.create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create return</Button>
          </CardContent></Card>
          <Card><CardHeader><CardTitle>Returns</CardTitle></CardHeader><CardContent className="space-y-2">{(form990.returns.data ?? []).map((item: any) => <button key={item.id} onClick={() => setReturnId(item.id)} className={`w-full rounded-md border p-3 text-left ${item.id === returnId ? "border-primary bg-primary/5" : ""}`}><div className="flex justify-between"><span className="font-medium">{item.tax_year} {item.form_type}</span><Badge variant="secondary">{item.status.replaceAll("_"," ")}</Badge></div></button>)}</CardContent></Card>
        </div>
        <div className="space-y-5">
          {!current ? <Card><CardContent className="p-10 text-sm text-muted-foreground">Create or select a return.</CardContent></Card> : <>
            <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>{current.tax_year} {current.form_type}</CardTitle><CardDescription>IRS schema release: {current.irs_schema_version || "not applicable / not selected"}</CardDescription></div><Badge>{current.status.replaceAll("_"," ")}</Badge></div></CardHeader><CardContent className="flex flex-wrap gap-2"><Button variant="outline" disabled={form990.validate.isPending} onClick={() => form990.validate.mutate()}><FileCheck2 className="mr-2 h-4 w-4" />Validate</Button><Button disabled={form990.prepare.isPending} onClick={() => form990.prepare.mutate()}>Prepare filing handoff</Button>{current.form_type === "990-N" && <Button asChild variant="outline"><a href="https://www.irs.gov/charities-non-profits/annual-electronic-notice-form-990-n-for-small-organizations-faqs-how-to-file" target="_blank" rel="noreferrer">Open IRS 990-N filing <ExternalLink className="ml-2 h-4 w-4" /></a></Button>}</CardContent></Card>
            {current.validation_summary && <Card><CardContent className="p-4 flex items-center gap-3">{current.validation_summary.passed ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertTriangle className="h-5 w-5 text-amber-600" />}<p className="text-sm">{current.validation_summary.errors || 0} errors · {current.validation_summary.warnings || 0} warnings</p></CardContent></Card>}
            <Card><CardHeader><CardTitle>Return sections</CardTitle><CardDescription>Section data is preserved as a versioned preparation record before official-schema export.</CardDescription></CardHeader><CardContent className="space-y-4">{form990.sections.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (form990.sections.data ?? []).map((section: any) => { const value = sectionDrafts[section.id] ?? JSON.stringify(section.data_json || {}, null, 2); return <div key={section.id} className="rounded-md border p-4 space-y-3"><div className="flex justify-between"><p className="font-medium">{section.section_label}</p><Badge variant={section.completed ? "default" : "secondary"}>{section.completed ? "complete" : "incomplete"}</Badge></div><Textarea className="min-h-32 font-mono text-xs" value={value} onChange={(e) => setSectionDrafts({ ...sectionDrafts, [section.id]: e.target.value })} /><Button size="sm" onClick={() => { try { form990.saveSection.mutate({ sectionKey: section.section_key, data: JSON.parse(value), completed: true }); } catch { /* keep draft for correction */ } }}>Save section as complete</Button></div>; })}</CardContent></Card>
          </>}
        </div>
      </div>
    </div>
  </MainLayout>;
}
