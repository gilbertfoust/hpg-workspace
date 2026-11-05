import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, ExternalLink, FileSearch, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole, isAdminRole } from "@/hooks/useUserRole";
import { useWorkspaceResearchLibrary, useWorkspaceResearchAnnotations, useWorkspaceResearchReviews,
  useWorkspaceResearchMutations, type ResearchSource } from "@/hooks/useWorkspaceResearchLibrary";
const pretty=(v:string)=>v.replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());
const message=(e:unknown)=>e instanceof Error?e.message:"The research operation could not be completed.";
type Draft={title:string;authors:string;publisher:string;url:string;sourceType:string;summary:string;
  methodology:string;limitations:string;relevance:string;scope:string;language:string;publishedOn:string};
const blank=():Draft=>({title:"",authors:"",publisher:"",url:"",sourceType:"primary",summary:"",
  methodology:"",limitations:"",relevance:"",scope:"internal",language:"en",publishedOn:""});
const reference=(s:ResearchSource)=>[s.authors||s.publisher||"Author not established",
  "("+ (s.published_on?s.published_on.slice(0,4):"n.d.") + ").",s.title+".",s.publisher+".",s.source_url].join(" ");

export default function WorkspaceResearchLibrary(){
  const {user}=useAuth();
  const {data:access,isLoading:accessLoading}=useUserRole();
  const admin=isAdminRole(access?.role);
  const staff=!!access?.role&&!["ngo_user","external_ngo","board","viewer"].includes(access.role);
  const library=useWorkspaceResearchLibrary();
  const actions=useWorkspaceResearchMutations();
  const [search,setSearch]=useState("");
  const [selectedId,setSelectedId]=useState("");
  const [creating,setCreating]=useState(false);
  const [draft,setDraft]=useState<Draft>(blank());
  const [annotationType,setAnnotationType]=useState("finding");
  const [locator,setLocator]=useState("");
  const [annotation,setAnnotation]=useState("");
  const [decision,setDecision]=useState("verified");
  const [reviewNote,setReviewNote]=useState("");
  const [editing,setEditing]=useState(false);
  const [edited,setEdited]=useState({summary:"",methodology:"",limitations:"",relevance:""});
  const rows=useMemo(()=>library.data||[],[library.data]);
  const selected=rows.find(x=>x.id===selectedId)||rows[0];
  const annotations=useWorkspaceResearchAnnotations(selected?.id);
  const reviews=useWorkspaceResearchReviews(selected?.id);
  const matches=rows.filter(s=>(s.title+" "+s.authors+" "+s.publisher+" "+s.source_summary)
    .toLowerCase().includes(search.toLowerCase()));
  const author=selected?.created_by===user?.id;
  const setField=(field:keyof Draft,value:string)=>setDraft(prev=>({...prev,[field]:value}));
  const save=async()=>{
    try{
      const id=await actions.create.mutateAsync({...draft,publishedOn:draft.publishedOn||null});
      setCreating(false);setDraft(blank());setSelectedId(id);
      toast.success("Internal research draft saved; no source has been independently verified.");
    }catch(e){toast.error(message(e));}
  };
  const submit=async()=>{
    if(!selected)return;
    try{await actions.submit.mutateAsync(selected.id);toast.success("Sent to independent evidence review.");}
    catch(e){toast.error(message(e));}
  };
  const note=async()=>{
    if(!selected)return;
    try{await actions.annotate.mutateAsync({
      id:selected.id,kind:annotationType,locator,note:annotation
    });setAnnotation("");setLocator("");toast.success("Source annotation saved.");}
    catch(e){toast.error(message(e));}
  };
  const review=async()=>{
    if(!selected)return;
    try{await actions.review.mutateAsync({id:selected.id,decision,note:reviewNote});
      setReviewNote("");toast.success("Independent research review recorded.");}
    catch(e){toast.error(message(e));}
  };
  const revise=async()=>{
    if(!selected)return;
    try{await actions.revise.mutateAsync({id:selected.id,...edited});setEditing(false);
      toast.success("Draft revised; review must be submitted again.");}
    catch(e){toast.error(message(e));}
  };
  const inspect=(source:ResearchSource)=>{
    setSelectedId(source.id);setCreating(false);setEditing(false);
    setEdited({summary:source.source_summary,methodology:source.methodology_notes,
      limitations:source.limitations,relevance:source.relevance_notes});
  };
  return <MainLayout title="HPG Research Source Library"
    subtitle="Internal bibliography, original evidence, literature annotations and independent source review.">
    <div className="mx-auto max-w-6xl space-y-4">
      <Card><CardContent className="flex flex-wrap gap-3 items-center p-5">
        <FileSearch className="h-7 w-7 text-primary"/>
        <div className="min-w-60 flex-1">
          <h2 className="font-semibold">Evidence and interpretation are separate records</h2>
          <p className="text-sm text-muted-foreground">Document source links, original context, methodology and limitations before review. A draft or citation is not proof that a claim is accurate.</p>
        </div>
        <Button variant="outline" size="sm" asChild><Link to="/learning?track=research&lesson=research-library">Research tutorial</Link></Button>
      </CardContent></Card>
      {accessLoading&&<p className="text-sm text-muted-foreground">Checking research permissions…</p>}
      {!accessLoading&&!staff&&<Card><CardContent className="p-5 text-sm text-destructive">
        Research records are available only to approved internal HPG staff, not external NGO portal accounts.
      </CardContent></Card>}
      {staff&&<>
        {library.error&&<p role="alert" className="text-sm text-destructive">{message(library.error)}</p>}
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="h-fit">
            <CardHeader><CardTitle>Research bibliography</CardTitle>
              <CardDescription>{rows.length} sources in your authorized scope; {rows.filter(s=>s.status==="reviewed").length} reviewed.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full" onClick={()=>setCreating(x=>!x)}>
                {creating?"Close source editor":"Register a source"}</Button>
              <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/>
                <Input aria-label="Search research sources" className="pl-9"
                  value={search} onChange={e=>setSearch(e.target.value)} placeholder="Title, author, publisher or topic"/></div>
              <div className="max-h-[600px] space-y-2 overflow-y-auto">
                {!matches.length&&<p className="text-sm text-muted-foreground">No accessible sources yet. Do not invent source evidence.</p>}
                {matches.map(source=><button type="button" key={source.id} onClick={()=>inspect(source)}
                  className={"w-full rounded-md border p-3 text-left hover:bg-muted/30 "+
                    (selected?.id===source.id&&!creating?"border-primary bg-primary/5":"")}>
                  <p className="font-medium text-sm">{source.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{source.authors||source.publisher||"Author not established"}</p>
                  <div className="mt-2 flex gap-2"><Badge variant="secondary">{pretty(source.source_type)}</Badge>
                    <Badge variant={source.status==="reviewed"?"default":"outline"}>{pretty(source.status)}</Badge></div>
                </button>)}
              </div>
            </CardContent>
          </Card>
          <div className="space-y-4">
            {creating?<Card><CardHeader><CardTitle className="text-lg">Register an original research source</CardTitle>
              <CardDescription>All new sources begin as restricted drafts pending independent review.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                {(["title","authors","publisher","url"] as const).map(field=><div key={field} className="space-y-1">
                  <Label>{pretty(field)}</Label><Input value={draft[field]} onChange={e=>setField(field,e.target.value)}
                    placeholder={field==="url"?"https://verified-source.example/":undefined}/></div>)}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1"><Label>Source classification</Label>
                    <Select value={draft.sourceType} onValueChange={v=>setField("sourceType",v)}>
                      <SelectTrigger><SelectValue/></SelectTrigger><SelectContent>
                        {["primary","secondary","peer_reviewed","dataset","policy","archival","other"].map(t=><SelectItem key={t} value={t}>{pretty(t)}</SelectItem>)}
                      </SelectContent></Select></div>
                  <div className="space-y-1"><Label>Publication date</Label>
                    <Input type="date" value={draft.publishedOn} onChange={e=>setField("publishedOn",e.target.value)}/></div>
                  <div className="space-y-1"><Label>Access scope</Label>
                    <Select value={draft.scope} onValueChange={v=>setField("scope",v)}>
                      <SelectTrigger><SelectValue/></SelectTrigger><SelectContent>
                        <SelectItem value="internal">Internal staff after review</SelectItem>
                        <SelectItem value="restricted">Author and reviewers only</SelectItem>
                      </SelectContent></Select></div>
                  <div className="space-y-1"><Label>Source language</Label>
                    <Select value={draft.language} onValueChange={v=>setField("language",v)}>
                      <SelectTrigger><SelectValue/></SelectTrigger><SelectContent>
                        {["en","fr","es","pt","other"].map(t=><SelectItem key={t} value={t}>{t.toUpperCase()}</SelectItem>)}
                      </SelectContent></Select></div>
                </div>
                {(["summary","methodology","limitations","relevance"] as const).map(field=><div key={field} className="space-y-1">
                  <Label>{field==="summary"?"Evidence summary":pretty(field)+" and context"}</Label>
                  <Textarea rows={3} value={draft[field]} onChange={e=>setField(field,e.target.value)}/></div>)}
                <Button disabled={actions.create.isPending||draft.title.trim().length<5||
                  !/^https:\/\/\S+$/i.test(draft.url)||draft.summary.trim().length<40} onClick={save}>
                  Save internal research draft</Button>
              </CardContent></Card>:
              selected?<Card><CardHeader><div className="flex flex-wrap gap-2">
                <Badge>{pretty(selected.status)}</Badge><Badge variant="outline">Version {selected.version}</Badge>
                {selected.access_scope==="restricted"&&<Badge variant="outline">Restricted</Badge>}
                </div><CardTitle className="text-lg">{selected.title}</CardTitle>
                <CardDescription>{selected.authors||"Unknown author"} · {selected.publisher||"Unknown publisher"}</CardDescription>
              </CardHeader><CardContent className="space-y-3 text-sm">
                <a href={selected.source_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 break-all text-primary underline"><ExternalLink className="h-4 w-4"/>Original source</a>
                <div className="rounded-md border p-3"><p className="text-xs font-semibold">Reference preview — verify format before publication</p>
                  <p>{reference(selected)}</p><p className="mt-1 text-xs text-muted-foreground">Accessed {selected.accessed_on} · {selected.language_code.toUpperCase()}</p></div>
                <div><strong>Summary:</strong><p className="whitespace-pre-wrap">{selected.source_summary}</p></div>
                {selected.methodology_notes&&<div><strong>Method/provenance:</strong><p className="whitespace-pre-wrap">{selected.methodology_notes}</p></div>}
                {selected.limitations&&<div><strong>Limitations:</strong><p className="whitespace-pre-wrap">{selected.limitations}</p></div>}
                {selected.relevance_notes&&<div><strong>Relevance:</strong><p className="whitespace-pre-wrap">{selected.relevance_notes}</p></div>}
                {author&&selected.status==="draft"&&<div className="flex flex-wrap gap-2 border-t pt-3">
                  <Button size="sm" variant="outline" onClick={()=>setEditing(x=>!x)}>Edit draft notes</Button>
                  <Button size="sm" onClick={submit} disabled={actions.submit.isPending}>Submit for independent review</Button></div>}
                {editing&&author&&selected.status==="draft"&&<div className="space-y-2 rounded-md border p-3">
                  {(["summary","methodology","limitations","relevance"] as const).map(field=><div key={field} className="space-y-1">
                    <Label>{pretty(field)}</Label><Textarea rows={3} value={edited[field]}
                      onChange={e=>setEdited(x=>({...x,[field]:e.target.value}))}/></div>)}
                  <Button disabled={edited.summary.trim().length<40||actions.revise.isPending} onClick={revise}>Save revised draft</Button>
                </div>}
                {admin&&selected.status==="submitted"&&!author&&<div className="space-y-2 rounded-md border p-3">
                  <p className="font-semibold"><ShieldCheck className="mr-2 inline h-4 w-4"/>Independent source review</p>
                  <Select value={decision} onValueChange={setDecision}><SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent><SelectItem value="verified">Verified for internal library</SelectItem>
                      <SelectItem value="needs_revision">Request revision</SelectItem>
                      <SelectItem value="rejected">Reject source</SelectItem></SelectContent></Select>
                  <Textarea rows={3} value={reviewNote} onChange={e=>setReviewNote(e.target.value)}
                    placeholder="Describe the actual verification evidence (20 or more characters)."/>
                  <Button disabled={actions.review.isPending||reviewNote.trim().length<20} onClick={review}>
                    Record independent review</Button></div>}
              </CardContent></Card>:
              <Card><CardContent className="p-6 text-sm text-muted-foreground">Select a source from the library.</CardContent></Card>}
            {selected&&!creating&&<Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5"/>Citations and literature notes</CardTitle>
              <CardDescription>Preserve source locators; distinguish findings from interpretations and hypotheses.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                {(annotations.data||[]).map(item=><div key={item.id} className="rounded-md border p-3 text-sm">
                  <Badge variant="outline">{pretty(item.annotation_type)}</Badge>
                  {item.locator&&<p className="text-xs text-muted-foreground">Locator: {item.locator}</p>}
                  <p className="mt-2 whitespace-pre-wrap">{item.note_text}</p>
                </div>)}
                {!annotations.data?.length&&<p className="text-sm text-muted-foreground">No annotations recorded yet.</p>}
                <div className="space-y-2 border-t pt-3">
                  <Label>Note type</Label><Select value={annotationType} onValueChange={setAnnotationType}>
                    <SelectTrigger><SelectValue/></SelectTrigger><SelectContent>
                      {["citation","finding","context","limitation","hypothesis"].map(v=><SelectItem key={v} value={v}>{pretty(v)}</SelectItem>)}
                    </SelectContent></Select>
                  <Label>Page, paragraph or source locator</Label><Input value={locator} onChange={e=>setLocator(e.target.value)}/>
                  <Label>Documented note (20+ characters)</Label><Textarea rows={3} value={annotation} onChange={e=>setAnnotation(e.target.value)}/>
                  <Button disabled={actions.annotate.isPending||annotation.trim().length<20} onClick={note}>Add traceable annotation</Button>
                </div>
              </CardContent></Card>}
            {selected&&!creating&&!!reviews.data?.length&&<Card>
              <CardHeader><CardTitle className="text-lg">Independent review history</CardTitle></CardHeader>
              <CardContent className="space-y-2">{(reviews.data||[]).map(item=><div key={item.id} className="rounded-md border p-3 text-sm">
                <Badge>{pretty(item.decision)}</Badge><p className="mt-1">{item.evidence_note}</p>
                <p className="text-xs text-muted-foreground">Version {item.source_version} · {new Date(item.reviewed_at).toLocaleString()}</p>
              </div>)}</CardContent></Card>}
          </div>
        </div>
      </>}
    </div>
  </MainLayout>;
}
