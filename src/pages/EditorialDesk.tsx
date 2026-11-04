import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, CalendarDays, CheckCircle2, ClipboardCheck, FileText, GraduationCap, Layers3, LockKeyhole, Newspaper, Plus, Printer, Send, ShieldCheck, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDocuments } from "@/hooks/useDocuments";
import {
  type EditableFields, type EditorialItem, type EditorialKind,
  useEditorialData, useCreateEditorialItem, useUpdateEditorialItem, useAddIssueContribution,
  useRemoveIssueContribution, useReorderIssueContribution, useSubmitEditorial,
  useReviewEditorial, useRecordEditorialPublication
} from "@/hooks/useEditorial";
import "./editorial-print.css";

const kinds: { value: EditorialKind; label: string }[] = [
  { value: "article", label: "Magazine article" },
  { value: "issue", label: "Magazine issue" },
  { value: "interview", label: "Interview" },
  { value: "press_release", label: "Press release" },
  { value: "newsletter", label: "Newsletter" },
  { value: "research_brief", label: "Research brief" },
];
const editableStates = ["draft", "changes_requested"];
const emptyFields = (): EditableFields => ({
  title: "", summary: "", body_markdown: "", planned_publish_at: null,
  interviewee_name: null, interview_date: null, consent_confirmed: false,
  consent_document_id: null, transcript_document_id: null,
});
const pretty = (name: string) => name.replaceAll("_", " ").replace(/\b\w/g, char => char.toUpperCase());
const asDay = (iso: string | null) => iso ? iso.slice(0, 10) : "";
const toIso = (value: string) => value ? new Date(value + "T12:00:00").toISOString() : null;
const kindLabel = (kind: EditorialKind) => kinds.find(k => k.value === kind)?.label || pretty(kind);
function describeError(error: unknown) { return error instanceof Error ? error.message : "The operation could not be completed."; }
function RenderArticle({ copy }: { copy: string }) {
  return <div className="space-y-3 whitespace-pre-wrap text-sm leading-7">
    {copy.split(/\n{2,}/).filter(Boolean).map((paragraph, index) =>
      paragraph.startsWith("## ") ? <h3 key={index} className="mt-5 text-lg font-semibold">{paragraph.slice(3)}</h3> :
      paragraph.startsWith("# ") ? <h2 key={index} className="mt-5 text-xl font-bold">{paragraph.slice(2)}</h2> :
        <p key={index}>{paragraph}</p>)}
  </div>;
}

export default function EditorialDesk() {
  const editorial = useEditorialData();
  const create = useCreateEditorialItem();
  const update = useUpdateEditorialItem();
  const addContribution = useAddIssueContribution();
  const removeContribution = useRemoveIssueContribution();
  const reorderContribution = useReorderIssueContribution();
  const submit = useSubmitEditorial();
  const review = useReviewEditorial();
  const publish = useRecordEditorialPublication();
  const documents = useDocuments();

  const [createOpen, setCreateOpen] = useState(false);
  const [newKind, setNewKind] = useState<EditorialKind>("article");
  const [newTitle, setNewTitle] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditableFields>(emptyFields);
  const [reviewNote, setReviewNote] = useState("");
  const [publicationUrl, setPublicationUrl] = useState("");
  const [newContributionId, setNewContributionId] = useState("");
  const [calendarDate, setCalendarDate] = useState<Date | undefined>(new Date());
  const [search, setSearch] = useState("");

  const items = useMemo(() => editorial.data?.items || [], [editorial.data?.items]);
  const current = items.find(item => item.id === activeId) || null;
  const members = useMemo(() => (editorial.data?.members || []).filter(member => member.issue_id === activeId)
    .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)), [editorial.data?.members, activeId]);
  const issueContents = members.map(member => ({
    member, item: items.find(item => item.id === member.content_id),
  })).filter((entry): entry is { member: typeof members[number]; item: EditorialItem } => !!entry.item);
  const visibleItems = items.filter(item => (
    (item.title + " " + item.summary + " " + item.kind).toLowerCase().includes(search.toLowerCase())
  ));
  const calendarItems = items.filter(item => asDay(item.planned_publish_at) === (calendarDate
    ? [calendarDate.getFullYear(), String(calendarDate.getMonth() + 1).padStart(2, "0"), String(calendarDate.getDate()).padStart(2, "0")].join("-")
    : ""));
  const consentDocuments = (documents.data || []).filter(doc => /consent|release|interview|permission/i.test(doc.file_name));
  const openForEditing = !!current && editableStates.includes(current.status);

  useEffect(() => {
    if (!current) { setDraft(emptyFields()); return; }
    const { title, summary, body_markdown, planned_publish_at, interviewee_name, interview_date,
      consent_confirmed, consent_document_id, transcript_document_id } = current;
    setDraft({ title, summary, body_markdown, planned_publish_at, interviewee_name, interview_date,
      consent_confirmed, consent_document_id, transcript_document_id });
    setReviewNote(""); setPublicationUrl(current.published_url || "");
    setNewContributionId("");
  }, [current?.id, current?.updated_at, current?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const createItem = async () => {
    if (!newTitle.trim()) return;
    try {
      const result = await create.mutateAsync({ ...emptyFields(), title: newTitle.trim(), kind: newKind });
      setCreateOpen(false); setNewTitle(""); setNewKind("article"); setActiveId(result.id);
      toast.success("Editorial draft created");
    } catch (error) { toast.error(describeError(error)); }
  };
  const saveDraft = async () => {
    if (!current || !draft.title.trim()) return;
    try {
      await update.mutateAsync({ id: current.id, values: { ...draft, title: draft.title.trim() } });
      toast.success("Draft saved with revision history");
    } catch (error) { toast.error(describeError(error)); }
  };
  const requestReview = async () => {
    if (!current) return;
    try {
      await submit.mutateAsync({ p_id: current.id });
      toast.success("Sent to the editorial review queue");
    } catch (error) { toast.error(describeError(error)); }
  };
  const decide = async (decision: "approved" | "changes_requested") => {
    if (!current) return;
    try {
      await review.mutateAsync({ p_id: current.id, p_decision: decision, p_note: reviewNote });
      toast.success(decision === "approved" ? "Editorial approval recorded" : "Revision requested");
      setReviewNote("");
    } catch (error) { toast.error(describeError(error)); }
  };
  const recordRelease = async () => {
    if (!current) return;
    try {
      await publish.mutateAsync({ p_id: current.id, p_url: publicationUrl.trim() });
      toast.success("External publication recorded in the editorial audit trail");
    } catch (error) { toast.error(describeError(error)); }
  };
  const attachContribution = async () => {
    if (!current || !newContributionId) return;
    try {
      await addContribution.mutateAsync({ issue_id: current.id, content_id: newContributionId, sort_order: members.length + 1 });
      setNewContributionId(""); toast.success("Contribution added to the magazine issue");
    } catch (error) { toast.error(describeError(error)); }
  };
  const moveContribution = async (index: number, change: -1 | 1) => {
    const next = [...members], target = index + change;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    try {
      for (let position = 0; position < next.length; position++) {
        await reorderContribution.mutateAsync({ id: next[position].id, sort_order: position + 1 });
      }
      toast.success("Magazine order updated");
    } catch (error) { toast.error(describeError(error)); }
  };

  return <MainLayout title="Editorial Production Desk" subtitle="Editorial calendar, interviews, magazine assembly, approvals and publication records.">
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card/95 p-4">
        <div className="flex-1">
          <p className="font-semibold">Publication controls are separate from ordinary task completion.</p>
          <p className="text-sm text-muted-foreground">Approval requires an authorized second reviewer. A publication record requires a URL where an approved edition or item has already been released; this system does not itself publish to an external website.</p>
        </div>
        <Button asChild variant="outline" size="sm"><Link to="/learning?track=communications"><GraduationCap className="mr-2 h-4 w-4" /> Tutorial</Link></Button>
        <Button asChild variant="outline" size="sm"><Link to="/modules/communications">Assignments</Link></Button>
        <Button onClick={() => setCreateOpen(true)} disabled={!editorial.data?.canWrite}><Plus className="mr-2 h-4 w-4" /> New content</Button>
      </div>

      {editorial.isLoading && <Card><CardContent className="p-6">Checking editorial access and loading records…</CardContent></Card>}
      {editorial.error && <Card><CardContent className="space-y-3 p-6">
        <div className="flex items-center gap-2 font-semibold"><LockKeyhole className="h-4 w-4" /> Editorial production is not configured or accessible yet.</div>
        <p className="text-sm text-muted-foreground">The editorial database migration and role permissions must be verified before publication controls can be used. Assignment tracking remains available in Communications Studio.</p>
        <p className="break-words text-xs text-destructive">{describeError(editorial.error)}</p>
        <Button asChild variant="outline" size="sm"><Link to="/modules/communications">Return to Communications Studio</Link></Button>
      </CardContent></Card>}

      {editorial.data && !editorial.data.canWrite && <Card><CardContent className="p-6 text-sm">This desk is restricted to authorized communications and editorial staff. Contact your department administrator if access is expected.</CardContent></Card>}

      {editorial.data?.canWrite && <>
        <div className="grid gap-3 sm:grid-cols-4">
          {[["Drafts", "draft"], ["Under review", "in_review"], ["Approved", "approved"], ["Recorded releases", "published"]].map(([label, status]) =>
            <Card key={status}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{items.filter(item => item.status === status).length}</p></CardContent></Card>
          )}
        </div>
        <Tabs defaultValue="editorial" className="space-y-4">
          <TabsList className="h-auto flex-wrap justify-start">
            <TabsTrigger value="editorial"><Newspaper className="mr-2 h-4 w-4" /> Editorial Desk</TabsTrigger>
            <TabsTrigger value="calendar"><CalendarDays className="mr-2 h-4 w-4" /> Calendar</TabsTrigger>
            <TabsTrigger value="interviews"><UserRound className="mr-2 h-4 w-4" /> Interviews</TabsTrigger>
            <TabsTrigger value="issues"><Layers3 className="mr-2 h-4 w-4" /> Magazines</TabsTrigger>
            <TabsTrigger value="review"><ClipboardCheck className="mr-2 h-4 w-4" /> Review Queue</TabsTrigger>
          </TabsList>

          <TabsContent value="editorial" className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
            <Card className="h-fit">
              <CardHeader><CardTitle className="text-lg">Content library</CardTitle><CardDescription>Choose an item to write, review, or assemble.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <Input aria-label="Search editorial items" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search editorial items" />
                <div className="max-h-[600px] space-y-2 overflow-y-auto">
                  {visibleItems.length === 0 && <p className="text-sm text-muted-foreground">No editorial items yet.</p>}
                  {visibleItems.map(item => <button key={item.id} type="button" onClick={() => setActiveId(item.id)}
                    className={"w-full rounded-lg border p-3 text-left hover:bg-muted/50 " + (activeId === item.id ? "border-primary bg-primary/5" : "")}>
                    <p className="text-sm font-semibold">{item.title}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{kindLabel(item.kind)}</Badge><Badge variant="secondary">{pretty(item.status)}</Badge>
                    </div>
                  </button>)}
                </div>
              </CardContent>
            </Card>
            {!current ? <Card><CardContent className="p-10 text-center text-muted-foreground">Select an item to see its editorial controls. Start with a new article, issue, or interview.</CardContent></Card> :
              <div className="space-y-4">
                <Card>
                  <CardHeader className="space-y-2">
                    <div className="flex flex-wrap gap-2"><Badge variant="outline">{kindLabel(current.kind)}</Badge><Badge>{pretty(current.status)}</Badge><Badge variant="secondary">Revision {current.revision}</Badge></div>
                    <CardTitle>{current.title}</CardTitle>
                    <CardDescription>Content ID: {current.id}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2 sm:col-span-2"><Label>Title</Label><Input value={draft.title} disabled={!openForEditing} onChange={e => setDraft(v => ({ ...v, title: e.target.value }))} maxLength={240} /></div>
                      <div className="space-y-2 sm:col-span-2"><Label>Editorial summary / abstract</Label><Textarea rows={2} value={draft.summary} disabled={!openForEditing} onChange={e => setDraft(v => ({ ...v, summary: e.target.value }))} /></div>
                      <div className="space-y-2"><Label>Planned release date</Label><Input type="date" value={asDay(draft.planned_publish_at)} disabled={!openForEditing} onChange={e => setDraft(v => ({ ...v, planned_publish_at: toIso(e.target.value) }))} /></div>
                      {current.kind === "interview" && <div className="space-y-2"><Label>Interview date</Label><Input type="date" value={asDay(draft.interview_date)} disabled={!openForEditing} onChange={e => setDraft(v => ({ ...v, interview_date: toIso(e.target.value) }))} /></div>}
                    </div>
                    {current.kind === "interview" && <div className="space-y-3 rounded-lg border p-4">
                      <h3 className="font-semibold">Interview preparation and consent</h3>
                      <div className="space-y-2"><Label>Interviewee / subject</Label><Input value={draft.interviewee_name || ""} disabled={!openForEditing} onChange={e => setDraft(v => ({ ...v, interviewee_name: e.target.value }))} /></div>
                      <div className="space-y-2"><Label>Signed consent / release document</Label>
                        <Select value={draft.consent_document_id || "none"} disabled={!openForEditing} onValueChange={id => setDraft(v => ({ ...v, consent_document_id: id === "none" ? null : id }))}>
                          <SelectTrigger><SelectValue placeholder="Choose stored consent document" /></SelectTrigger>
                          <SelectContent><SelectItem value="none">No evidence attached</SelectItem>
                            {consentDocuments.map(doc => <SelectItem key={doc.id} value={doc.id}>{doc.file_name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">A signed consent record must already exist in authorized Documents storage. <Link className="text-primary underline" to="/documents">Open Documents</Link></p>
                      </div>
                      <div className="space-y-2"><Label>Transcript document (optional)</Label>
                        <Select value={draft.transcript_document_id || "none"} disabled={!openForEditing} onValueChange={id => setDraft(v => ({ ...v, transcript_document_id: id === "none" ? null : id }))}>
                          <SelectTrigger><SelectValue placeholder="Choose a document" /></SelectTrigger>
                          <SelectContent><SelectItem value="none">No transcript linked</SelectItem>
                            {(documents.data || []).filter(doc => /transcript|interview/i.test(doc.file_name)).map(doc => <SelectItem key={doc.id} value={doc.id}>{doc.file_name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <label className="flex items-start gap-2 text-sm"><Checkbox checked={draft.consent_confirmed} disabled={!openForEditing} onCheckedChange={value => setDraft(v => ({ ...v, consent_confirmed: value === true }))} />
                        I have verified the consent document and the agreed publication scope.</label>
                    </div>}
                    {current.kind !== "issue" && <div className="space-y-2">
                      <Label>{current.kind === "interview" ? "Interview brief, questions, notes and approved text" : "Draft body (Markdown supported as plain source text)"}</Label>
                      <Textarea rows={14} className="font-mono text-sm" value={draft.body_markdown} disabled={!openForEditing} onChange={e => setDraft(v => ({ ...v, body_markdown: e.target.value }))} />
                    </div>}
                    {current.kind === "issue" && <p className="text-sm text-muted-foreground">Issue content is assembled below from contributions. The issue title and editorial summary are used on the cover.</p>}
                    {openForEditing && <div className="flex flex-wrap gap-2">
                      <Button disabled={update.isPending || !draft.title.trim()} onClick={saveDraft}><FileText className="mr-2 h-4 w-4" /> Save draft</Button>
                      <Button variant="outline" disabled={submit.isPending || update.isPending} onClick={requestReview}><Send className="mr-2 h-4 w-4" /> Submit saved version for review</Button>
                    </div>}
                    {!openForEditing && <p className="text-xs text-muted-foreground">Approved and submitted content is locked against direct editing. Changes requested by a reviewer re-open the draft.</p>}
                  </CardContent>
                </Card>

                {current.kind === "issue" && <Card>
                  <CardHeader><CardTitle className="text-lg">Magazine issue assembly</CardTitle><CardDescription>Arrange editorial content, review the complete issue, and print an internal proof.</CardDescription></CardHeader>
                  <CardContent className="space-y-4">
                    {openForEditing && <div className="flex flex-wrap gap-2">
                      <Select value={newContributionId} onValueChange={setNewContributionId}>
                        <SelectTrigger className="min-w-52 flex-1"><SelectValue placeholder="Select content to include" /></SelectTrigger>
                        <SelectContent>{items.filter(item => item.kind !== "issue" && !members.some(member => member.content_id === item.id))
                          .map(item => <SelectItem key={item.id} value={item.id}>{item.title} ({pretty(item.status)})</SelectItem>)}</SelectContent>
                      </Select>
                      <Button variant="outline" disabled={!newContributionId || addContribution.isPending} onClick={attachContribution}><Plus className="mr-2 h-4 w-4" /> Add</Button>
                    </div>}
                    {issueContents.length === 0 && <p className="text-sm text-muted-foreground">No contributions have been added to this issue.</p>}
                    {issueContents.map(({ member, item }, index) => <div key={member.id} className="flex flex-wrap items-center gap-2 rounded-md border p-3">
                      <span className="text-xs text-muted-foreground">{index + 1}.</span><span className="flex-1 text-sm font-medium">{item.title}</span>
                      <Badge variant="outline">{pretty(item.status)}</Badge>
                      {openForEditing && <>
                        <Button aria-label={"Move " + item.title + " up"} size="icon" variant="ghost" disabled={index === 0 || reorderContribution.isPending} onClick={() => moveContribution(index, -1)}><ArrowUp className="h-4 w-4" /></Button>
                        <Button aria-label={"Move " + item.title + " down"} size="icon" variant="ghost" disabled={index === issueContents.length - 1 || reorderContribution.isPending} onClick={() => moveContribution(index, 1)}><ArrowDown className="h-4 w-4" /></Button>
                        <Button aria-label={"Remove " + item.title} size="icon" variant="ghost" disabled={removeContribution.isPending} onClick={async () => { try { await removeContribution.mutateAsync(member.id); toast.success("Removed"); } catch (error) { toast.error(describeError(error)); } }}><X className="h-4 w-4" /></Button>
                      </>}
                    </div>)}
                    <Button variant="outline" onClick={() => window.print()} disabled={issueContents.length === 0}><Printer className="mr-2 h-4 w-4" /> Print magazine proof</Button>
                    <p className="text-xs text-muted-foreground">The print view is an internal draft. Every included item must be independently approved before the issue itself can be approved.</p>
                  </CardContent>
                </Card>}

                {current.status === "in_review" && <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Editorial approval</CardTitle><CardDescription>Only designated reviewers can make a decision. Authors cannot approve their own work.</CardDescription></CardHeader>
                  <CardContent className="space-y-3">
                    {editorial.data?.canApprove ? <>
                      <Textarea rows={3} placeholder="Review notes; required when requesting changes" value={reviewNote} onChange={e => setReviewNote(e.target.value)} />
                      <div className="flex flex-wrap gap-2">
                        <Button disabled={review.isPending} onClick={() => decide("approved")}><CheckCircle2 className="mr-2 h-4 w-4" /> Approve</Button>
                        <Button variant="outline" disabled={review.isPending || !reviewNote.trim()} onClick={() => decide("changes_requested")}>Request changes</Button>
                      </div>
                    </> : <p className="text-sm text-muted-foreground">An independent authorized reviewer must decide on this submission.</p>}
                  </CardContent>
                </Card>}

                {current.status === "approved" && <Card>
                  <CardHeader><CardTitle className="text-lg">Record an externally published release</CardTitle><CardDescription>Only after the content has actually appeared at the verified URL.</CardDescription></CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    <Input aria-label="Published HTTPS URL" className="min-w-56 flex-1" placeholder="https://publication.example/issue" value={publicationUrl} onChange={e => setPublicationUrl(e.target.value)} disabled={!editorial.data?.canApprove} />
                    <Button disabled={!editorial.data?.canApprove || publish.isPending || !/^https:\/\/\S+$/i.test(publicationUrl)} onClick={recordRelease}>Record publication</Button>
                  </CardContent>
                </Card>}

                {current.published_url && <Card><CardContent className="p-4 text-sm"><strong>Publication on record:</strong> <a href={current.published_url} target="_blank" rel="noopener noreferrer" className="ml-2 break-all text-primary underline">{current.published_url}</a></CardContent></Card>}
                <Card>
                  <CardHeader><CardTitle className="text-base">Editorial decisions and audit trail</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {(editorial.data?.reviews || []).filter(r => r.editorial_item_id === current.id).map(record => <div key={record.id} className="rounded-md border p-3 text-sm">
                      <p className="font-medium">{pretty(record.decision)} · {new Date(record.created_at).toLocaleString()}</p><p className="whitespace-pre-wrap text-muted-foreground">{record.note || "No additional note"}</p>
                    </div>)}
                    {(editorial.data?.events || []).filter(event => event.editorial_item_id === current.id).map(event => <p key={event.id} className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString()} — {pretty(event.action)}</p>)}
                  </CardContent>
                </Card>

                {current.kind === "issue" && <section id="editorial-printable" className="editorial-print-only" aria-label="Printable magazine proof">
                  <header className="mb-10 border-b-2 pb-6"><p>HUMANITY PATHWAYS GLOBAL</p><h1 className="my-5 text-4xl font-bold">{current.title}</h1><p>{current.summary}</p><small>Internal proof — not for distribution</small></header>
                  <h2 className="mb-6 text-2xl font-semibold">Contents</h2>
                  <ol className="mb-10 list-decimal pl-6">{issueContents.map(({ item }) => <li key={item.id}>{item.title}</li>)}</ol>
                  {issueContents.map(({ item }) => <article key={item.id} className="mb-12">
                    <h2 className="mb-3 border-b pb-2 text-2xl font-semibold">{item.title}</h2><p className="mb-6 italic">{item.summary}</p><RenderArticle copy={item.body_markdown} />
                  </article>)}
                </section>}
              </div>}
          </TabsContent>

          <TabsContent value="calendar">
            <Card><CardHeader><CardTitle>Editorial calendar</CardTitle><CardDescription>Select a day to see planned publication dates. Scheduling here does not publish automatically.</CardDescription></CardHeader>
              <CardContent className="grid gap-6 md:grid-cols-[300px_1fr]">
                <Calendar mode="single" selected={calendarDate} onSelect={setCalendarDate} className="rounded-md border" modifiers={{ planned: items.map(item => item.planned_publish_at).filter((value): value is string => !!value).map(value => new Date(value)) }} modifiersClassNames={{ planned: "font-bold underline underline-offset-4" }} />
                <div><h3 className="mb-3 font-medium">{calendarDate?.toDateString() || "Choose a date"}</h3>
                  {calendarItems.length === 0 ? <p className="text-sm text-muted-foreground">No releases planned for this day.</p> : calendarItems.map(item =>
                    <button key={item.id} type="button" className="mb-2 block w-full rounded-md border p-3 text-left text-sm hover:bg-muted" onClick={() => { setActiveId(item.id); toast.info("Item selected. Open Editorial Desk to edit."); }}>
                      <strong>{item.title}</strong> <Badge variant="outline">{pretty(item.status)}</Badge>
                    </button>)}
                </div>
              </CardContent></Card>
          </TabsContent>
          <TabsContent value="interviews"><Card><CardHeader><CardTitle>Interview management</CardTitle><CardDescription>Schedule, coordinate consent, link transcripts, and request editorial approval.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {items.filter(item => item.kind === "interview").length === 0 && <p className="text-sm text-muted-foreground">No interviews yet. Choose New content → Interview to create a plan.</p>}
              {items.filter(item => item.kind === "interview").map(item => <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-md border p-3">
                <div className="flex-1"><p className="font-medium">{item.title}</p><p className="text-xs text-muted-foreground">{item.interviewee_name || "Subject not yet assigned"} · {item.interview_date ? new Date(item.interview_date).toLocaleDateString() : "Date not set"}</p></div>
                <Badge variant={item.consent_confirmed && item.consent_document_id ? "secondary" : "outline"}>{item.consent_confirmed && item.consent_document_id ? "Consent documented" : "Consent evidence needed"}</Badge>
                <Button size="sm" variant="outline" onClick={() => { setActiveId(item.id); toast.info("Interview selected. Open Editorial Desk to edit."); }}>Select</Button>
              </div>)}
            </CardContent></Card></TabsContent>
          <TabsContent value="issues"><Card><CardHeader><CardTitle>Magazine production</CardTitle><CardDescription>Manage issue outlines, ordered contributions, internal proofs, and reviewed publication records.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {items.filter(item => item.kind === "issue").length === 0 && <p className="text-sm text-muted-foreground">No magazine issues yet. Choose New content → Magazine issue.</p>}
              {items.filter(item => item.kind === "issue").map(item => <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-md border p-3">
                <div className="flex-1"><p className="font-medium">{item.title}</p><p className="text-xs text-muted-foreground">{(editorial.data?.members || []).filter(member => member.issue_id === item.id).length} contributions · {item.planned_publish_at ? asDay(item.planned_publish_at) : "Unscheduled"}</p></div>
                <Badge variant="outline">{pretty(item.status)}</Badge><Button size="sm" variant="outline" onClick={() => { setActiveId(item.id); toast.info("Magazine selected. Open Editorial Desk to assemble."); }}>Select issue</Button>
              </div>)}
            </CardContent></Card></TabsContent>
          <TabsContent value="review"><Card><CardHeader><CardTitle>Editorial review queue</CardTitle><CardDescription>Decisions require independent reviewer permissions and are retained in the audit history.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {items.filter(item => item.status === "in_review").length === 0 && <p className="text-sm text-muted-foreground">No submissions awaiting review.</p>}
              {items.filter(item => item.status === "in_review").map(item => <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-md border p-3">
                <span className="flex-1 text-sm font-medium">{item.title}</span><Badge variant="outline">{kindLabel(item.kind)}</Badge><Button size="sm" variant="outline" onClick={() => { setActiveId(item.id); toast.info("Submission selected. Open Editorial Desk to review."); }}>Select for review</Button>
              </div>)}
              {!editorial.data.canApprove && <p className="text-xs text-muted-foreground"><LockKeyhole className="mr-1 inline h-3 w-3" /> Your role can read editorial status but cannot approve content.</p>}
            </CardContent></Card></TabsContent>
        </Tabs>
      </>}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent><DialogHeader><DialogTitle>Create editorial content</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Content type</Label>
              <Select value={newKind} onValueChange={value => setNewKind(value as EditorialKind)}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{kinds.map(kind => <SelectItem key={kind.value} value={kind.value}>{kind.label}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-2"><Label>Working title</Label><Input value={newTitle} maxLength={240} onChange={e => setNewTitle(e.target.value)} placeholder="Name this article, issue or interview" /></div>
            <Button className="w-full" disabled={create.isPending || !newTitle.trim()} onClick={createItem}><Plus className="mr-2 h-4 w-4" /> Create private draft</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  </MainLayout>;
}
