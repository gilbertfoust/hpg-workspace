import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { ensureSupabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExternalLink, LockKeyhole, ClipboardCheck, Handshake, Link2, Send, FileText } from "lucide-react";

type Case = {id:string; organization_name:string; organization_type:string; geography:string|null;
  contact_name:string|null; contact_email:string|null; program_alignment:string|null; summary:string;
  stage:string; review_status:string; next_action:string|null; next_action_due_at:string|null;
  proposal_narrative:string|null; requested_resources:string|null; estimated_cost_notes:string|null;
  source_prospect_id:string|null; created_at:string; updated_at:string;};
type Activity = {id:string;case_id:string;activity_type:string;details:string;created_at:string;};
type Prospect = {id:string;prospect_name:string;prospect_type:string;geography:string|null;};
type CaseResource={id:string;case_id:string;title:string;url:string;resource_type:string;created_at:string};
type SupportRequest={id:string;case_id:string;request_type:string;details:string;status:string;work_item_id:string|null;created_at:string};
type Portfolio = {cases:Case[];activities:Activity[];available_prospects:Prospect[];resources:CaseResource[];support_requests:SupportRequest[];};
const references=[
 ["Board Partnership Development Operating Hub","https://humanitypathways.atlassian.net/wiki/spaces/BODS/pages/607125514/Partnership+Development+Working-Board+Operating+Hub+Proposed"],
 ["Partnership Development Resource Hub","https://humanitypathways.atlassian.net/wiki/spaces/DDS/pages/22315118/Partnership+Development+Board+Portfolio+Resource+Hub+Proposed"],
 ["Partnership Development SOPs","https://humanitypathways.atlassian.net/wiki/spaces/DDS/pages/35127314/Partnership+Development+SOPs"],
 ["Partnership reporting forms","https://humanitypathways.atlassian.net/wiki/spaces/DDS/pages/289112069/Partnership+Development+Reporting+Templates+HPG"],
 ["Grant and partnership forms — collection 1","https://humanitypathways.atlassian.net/wiki/spaces/DDS/pages/605028365/Grant+and+partnership+development+forms+1"],
 ["Grant and partnership forms — collection 2","https://humanitypathways.atlassian.net/wiki/spaces/DDS/pages/605290497/Grant+and+partnership+development+forms+2"],
 ["Partnership and fiscal sponsorship conversations","https://humanitypathways.atlassian.net/wiki/spaces/DDS/pages/340393985/Partnership+Fiscal+Sponsorship+Conversation+SOP"],
 ["International partnership outreach","https://humanitypathways.atlassian.net/wiki/spaces/DDS/pages/113115137/International+Partnership+Development+Specialist"],
 ["General Counsel resource library","https://humanitypathways.atlassian.net/wiki/spaces/GC/pages/515375186/General+Counsel+Resource+Library+Complete+Version"],
 ["How the Development Department Works","https://humanitypathways.atlassian.net/wiki/spaces/DDS/pages/89391118/How+the+Development+Department+Works"],
 ["HPG Executive Professional Academy","https://humanitypathways.atlassian.net/wiki/spaces/HH/pages/117800962/HPG+Executive+Professional+Academy"],
 ["Academy course catalog","https://humanitypathways.atlassian.net/wiki/spaces/HH/pages/604340226/EPA+Learning+Pathways+and+Course+Catalog"],
 ["Academy operations SOP","https://humanitypathways.atlassian.net/wiki/spaces/HH/pages/604405761/EPA+Academy+Operations+SOP"],
 ["International Academy roadmap","https://humanitypathways.atlassian.net/wiki/spaces/HH/pages/604504065/EPA+International+Delivery+and+Development+Roadmap"],
 ["Partnership core reports","https://humanitypathways.atlassian.net/wiki/spaces/DDS/pages/245465092/Core+Reports+for+Partnership+Development+Reps"],
] as const;
const label=(text:string)=>text.replaceAll("_"," ").replace(/\b\w/g,v=>v.toUpperCase());
const date=(text:string|null)=>text?new Date(text).toLocaleDateString():"Unscheduled";
async function rpc<T>(name:string,args?:Record<string,unknown>):Promise<T>{
 const result=await ensureSupabase().rpc(name as never,(args??{}) as never);
 if(result.error)throw new Error(result.error.message);
 return result.data as T;
}

export default function PartnershipDevelopmentPortal(){
 const qc=useQueryClient();
 const { user }=useAuth();
 const [tab,setTab]=useState("dashboard");
 const [caseId,setCaseId]=useState("");
 const [notice,setNotice]=useState("");
 const [error,setError]=useState("");
 const [newCase,setNewCase]=useState({name:"",geography:"",contact:"",email:"",program:"",summary:"",type:"community_partner"});
 const [log,setLog]=useState({type:"outreach",details:"",next:"",due:"",stage:"unchanged"});
 const [proposal,setProposal]=useState({narrative:"",resources:"",cost:""});
 const [resource,setResource]=useState({title:"",url:"",type:"drive"});
 const [support,setSupport]=useState({type:"research",details:""});
 const access=useQuery({queryKey:["partnership-portfolio-access",user?.id],enabled:!!user?.id,queryFn:()=>rpc<boolean>("can_access_partnership_portal"),retry:false,staleTime:0});
 const data=useQuery({queryKey:["partnership-portfolio-data",user?.id],enabled:!!user?.id&&access.data===true,queryFn:()=>rpc<Portfolio>("partnership_portal_overview")});
 const refresh=()=>{void qc.invalidateQueries({queryKey:["partnership-portfolio-data",user?.id]});};
 const cases=data.data?.cases??[];
 const activities=data.data?.activities??[];
 const selected=cases.find(c=>c.id===caseId)??cases[0];
 useEffect(()=>{
   setLog({type:"outreach",details:"",next:"",due:"",stage:"unchanged"});
   setProposal({narrative:selected?.proposal_narrative??"",resources:selected?.requested_resources??"",cost:selected?.estimated_cost_notes??""});
   setResource({title:"",url:"",type:"drive"});
   setSupport({type:"research",details:""});
 },[selected?.id]);
 const action=useMutation({mutationFn:async (values:{name:string;args:Record<string,unknown>})=>rpc<unknown>(values.name,values.args),
   onSuccess:(result,variables)=>{
     setError("");
     if(["partnership_portal_create_case","partnership_portal_import_prospect"].includes(variables.name)){
       setCaseId(String(result));
       setNewCase({name:"",geography:"",contact:"",email:"",program:"",summary:"",type:"community_partner"});
       setTab("outreach");
       setNotice("Partnership case opened or created without a duplicate organization entry.");
     } else if(variables.name==="partnership_portal_record_activity"){
       setLog({type:"outreach",details:"",next:"",due:"",stage:"unchanged"});
       setNotice("Outreach or meeting activity recorded.");
     } else if(variables.name==="partnership_portal_submit_review"){
       setNotice("Proposal submitted for Development triage. No Board approval has been granted.");
     } else if(variables.name==="partnership_portal_link_resource"){
       setResource({title:"",url:"",type:"drive"});
       setNotice("A link to an existing file was recorded. Its original permissions remain in effect.");
     } else if(variables.name==="partnership_portal_request_support"){
       setSupport({type:"research",details:""});
       setNotice("A Development support request has been submitted for departmental triage.");
     } else {
       setNotice("Changes recorded in the controlled partnership portfolio.");
     }
     refresh();
   },
   onError:(e:Error)=>{setError(e.message);setNotice("");}
 });
 const create=()=>action.mutate({name:"partnership_portal_create_case",args:{
  p_name:newCase.name,p_type:newCase.type,p_geography:newCase.geography||null,
  p_contact_name:newCase.contact||null,p_contact_email:newCase.email||null,
  p_program:newCase.program||null,p_summary:newCase.summary}});
 const record=()=>{if(!selected)return;action.mutate({name:"partnership_portal_record_activity",args:{
  p_case_id:selected.id,p_kind:log.type,p_details:log.details,
  p_next_action:log.next||null,p_due_at:log.due?new Date(log.due).toISOString():null,
  p_new_stage:log.stage==="unchanged"?null:log.stage}});};
 const submit=()=>{if(!selected)return;action.mutate({name:"partnership_portal_submit_review",args:{
  p_case_id:selected.id,p_proposal:proposal.narrative,p_resources:proposal.resources,p_cost_notes:proposal.cost}});};
 const addResource=()=>{if(!selected)return;action.mutate({name:"partnership_portal_link_resource",args:{
  p_case_id:selected.id,p_title:resource.title,p_url:resource.url,p_type:resource.type}});};
 const requestSupport=()=>{if(!selected)return;action.mutate({name:"partnership_portal_request_support",args:{
  p_case_id:selected.id,p_kind:support.type,p_details:support.details}});};
 const stats=[
 {name:"Prospects",count:cases.filter(c=>["identified","outreach"].includes(c.stage)).length,target:"To agree"},
 {name:"Outreach activities",count:activities.filter(a=>a.activity_type==="outreach").length,target:"To agree"},
 {name:"Meetings",count:activities.filter(a=>a.activity_type==="meeting").length,target:"To agree"},
 {name:"Proposals",count:cases.filter(c=>["proposal","review_requested","approved","active"].includes(c.stage)).length,target:"To agree"},
 {name:"Reviews pending",count:cases.filter(c=>c.review_status==="submitted").length,target:"—"},
 {name:"Approved partners",count:cases.filter(c=>c.stage==="active").length,target:"To agree"},
 ];
 if(access.isLoading)return <MainLayout title="Partnership Development"><p className="p-4">Checking Board portfolio access…</p></MainLayout>;
 if(access.data!==true)return <MainLayout title="Partnership Development" subtitle="Board-linked operational portfolio">
  <Alert><LockKeyhole className="h-4 w-4"/><AlertTitle>Operational assignment required</AlertTitle><AlertDescription>
    Access requires an authenticated Workspace account, active Board membership and recorded operational authorization.
    A Board role alone does not permit access to Development records. No director is automatically assigned.
  </AlertDescription></Alert></MainLayout>;
 return <MainLayout title="Partnership Development" subtitle="Proposed working Board portfolio • Partnerships, advocacy, external affairs and strategic outreach">
  <div className="space-y-5">
   <Alert><Handshake className="h-4 w-4"/><AlertTitle>Board governance and operational authority are separate</AlertTitle>
    <AlertDescription>This portfolio records relationship development and proposals. It never authorizes funding, binding agreements, project activation or Board votes.</AlertDescription></Alert>
   {notice&&<Alert><AlertDescription>{notice}</AlertDescription></Alert>}
   {error&&<Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
   {data.isError&&<Alert variant="destructive"><AlertDescription>Portfolio records are unavailable. Confirm database migration and permissions.</AlertDescription></Alert>}
   <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
    {stats.map(s=><Card key={s.name}><CardContent className="p-3">
     <p className="text-xs text-muted-foreground">{s.name}</p><p className="text-2xl font-semibold">{s.count}</p>
     <p className="text-xs text-muted-foreground">90-day target: {s.target}</p>
    </CardContent></Card>)}
   </div>
   <Tabs value={tab} onValueChange={setTab}>
    <TabsList className="h-auto flex-wrap">
     <TabsTrigger value="dashboard">Dashboard</TabsTrigger><TabsTrigger value="cases">Prospects & CRM</TabsTrigger>
     <TabsTrigger value="outreach">Outreach & Meetings</TabsTrigger><TabsTrigger value="proposal">Proposals & Reviews</TabsTrigger>
     <TabsTrigger value="handoffs">Documents & Handoffs</TabsTrigger>
     <TabsTrigger value="resources">Programs & Resources</TabsTrigger><TabsTrigger value="governance">Board & Reports</TabsTrigger>
    </TabsList>
    <TabsContent value="dashboard" className="grid gap-4 md:grid-cols-2">
     <Card><CardHeader><CardTitle>My next actions</CardTitle></CardHeader><CardContent className="space-y-2">
      {cases.filter(c=>c.next_action).slice(0,10).map(c=><div key={c.id} className="border-b pb-2 text-sm">
        <b>{c.organization_name}</b><p>{c.next_action}</p><p className="text-muted-foreground">{date(c.next_action_due_at)}</p></div>)}
      {!cases.some(c=>c.next_action)&&<p className="text-sm text-muted-foreground">No next actions recorded yet.</p>}
     </CardContent></Card>
     <Card><CardHeader><CardTitle>Recent activity</CardTitle></CardHeader><CardContent className="space-y-2">
      {activities.slice(0,10).map(a=><div key={a.id} className="border-b pb-2 text-sm">
       <Badge variant="secondary">{label(a.activity_type)}</Badge><p className="mt-1">{a.details}</p><small>{date(a.created_at)}</small></div>)}
      {!activities.length&&<p className="text-sm text-muted-foreground">No activity has been logged.</p>}
     </CardContent></Card>
    </TabsContent>
    <TabsContent value="cases" className="grid gap-4 lg:grid-cols-2">
     <Card><CardHeader><CardTitle>New partnership prospect</CardTitle><CardDescription>Creates a linked Development outreach record, not an agreement.</CardDescription></CardHeader><CardContent className="space-y-3">
      <div><Label>Organization</Label><Input value={newCase.name} onChange={e=>setNewCase(v=>({...v,name:e.target.value}))}/></div>
      <div><Label>Category</Label><Select value={newCase.type} onValueChange={type=>setNewCase(v=>({...v,type}))}>
       <SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{["community_partner","foundation","education","corporate","ngo","government","in_kind","other"].map(x=><SelectItem key={x} value={x}>{label(x)}</SelectItem>)}</SelectContent></Select></div>
      <div className="grid grid-cols-2 gap-2">
       <div><Label>Region or country</Label><Input value={newCase.geography} onChange={e=>setNewCase(v=>({...v,geography:e.target.value}))}/></div>
       <div><Label>Primary contact</Label><Input value={newCase.contact} onChange={e=>setNewCase(v=>({...v,contact:e.target.value}))}/></div>
       <div><Label>Contact email</Label><Input type="email" value={newCase.email} onChange={e=>setNewCase(v=>({...v,email:e.target.value}))}/></div>
       <div><Label>Related NGO/program</Label><Input value={newCase.program} onChange={e=>setNewCase(v=>({...v,program:e.target.value}))}/></div>
      </div>
      <div><Label>Collaboration idea</Label><Textarea value={newCase.summary} onChange={e=>setNewCase(v=>({...v,summary:e.target.value}))}/></div>
      <Button disabled={action.isPending||newCase.name.trim().length<2} onClick={create}>Create prospect</Button>
     </CardContent></Card>
     <Card><CardHeader><CardTitle>Assigned Development leads</CardTitle><CardDescription>Only prospects explicitly shared by authorized Development staff appear here. This prevents exposure of confidential or unrelated prospects and avoids re-entering research.</CardDescription></CardHeader><CardContent className="max-h-[530px] space-y-2 overflow-y-auto">
      {(data.data?.available_prospects??[]).map(p=><div key={p.id} className="flex items-center justify-between border-b pb-2 gap-2 text-sm">
       <div><b>{p.prospect_name}</b><p className="text-muted-foreground">{p.geography||p.prospect_type}</p></div>
       <Button size="sm" variant="outline" disabled={action.isPending} onClick={()=>action.mutate({name:"partnership_portal_import_prospect",args:{p_prospect_id:p.id}})}>Import</Button>
      </div>)}
      {!(data.data?.available_prospects?.length)&&<p className="text-sm text-muted-foreground">No new leads assigned to this Board portfolio. Development can share suitable prospects after role approval.</p>}
     </CardContent></Card>
     <Card className="lg:col-span-2"><CardHeader><CardTitle>Partnership pipeline</CardTitle></CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
       {cases.map(c=><button type="button" key={c.id} className="rounded border p-3 text-left hover:bg-muted/40" onClick={()=>{setCaseId(c.id);setTab("outreach");}}>
        <div className="flex justify-between gap-2"><b>{c.organization_name}</b><Badge variant="secondary">{label(c.stage)}</Badge></div>
        <p className="text-xs text-muted-foreground mt-2">{c.geography||"Region to confirm"} · {c.program_alignment||"Program to confirm"}</p>
        <p className="text-sm mt-2">{c.next_action||"No follow-up recorded"}</p>
       </button>)}
       {!cases.length&&<p className="text-sm text-muted-foreground">The dedicated partnership pipeline is empty. Import existing leads or create your first case.</p>}
      </CardContent></Card>
    </TabsContent>
    <TabsContent value="outreach" className="grid gap-4 lg:grid-cols-2">
     <Card><CardHeader><CardTitle>Log outreach, meeting or outcome</CardTitle></CardHeader><CardContent className="space-y-3">
      <CasePicker cases={cases} selected={selected?.id??""} choose={setCaseId}/>
      <div><Label>Activity</Label><Select value={log.type} onValueChange={type=>setLog(v=>({...v,type}))}><SelectTrigger><SelectValue/></SelectTrigger>
       <SelectContent>{["outreach","meeting","follow_up","proposal","outcome","note"].map(x=><SelectItem key={x} value={x}>{label(x)}</SelectItem>)}</SelectContent></Select></div>
      <div><Label>Discussion, commitments and outcomes</Label><Textarea rows={5} value={log.details} onChange={e=>setLog(v=>({...v,details:e.target.value}))}/></div>
      <div><Label>Next action</Label><Input value={log.next} onChange={e=>setLog(v=>({...v,next:e.target.value}))}/></div>
      <div className="grid grid-cols-2 gap-2">
       <div><Label>Follow-up date</Label><Input type="datetime-local" value={log.due} onChange={e=>setLog(v=>({...v,due:e.target.value}))}/></div>
       <div><Label>Case stage (locked during review)</Label><Select disabled={selected?.review_status!=="not_submitted"&&selected?.review_status!=="changes_requested"} value={log.stage} onValueChange={stage=>setLog(v=>({...v,stage}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>
        {["unchanged","identified","outreach","discovery","proposal","closed"].map(x=><SelectItem key={x} value={x}>{label(x)}</SelectItem>)}
       </SelectContent></Select></div>
      </div>
      <Button disabled={!selected||action.isPending||log.details.trim().length<3} onClick={record}>Save activity</Button>
     </CardContent></Card>
     <Card><CardHeader><CardTitle>History: {selected?.organization_name||"No case selected"}</CardTitle></CardHeader><CardContent className="space-y-3">
      {activities.filter(x=>x.case_id===selected?.id).map(a=><div key={a.id} className="border-b pb-2 text-sm">
        <div className="flex justify-between"><Badge variant="outline">{label(a.activity_type)}</Badge><span className="text-muted-foreground">{date(a.created_at)}</span></div>
        <p className="mt-2">{a.details}</p></div>)}
     </CardContent></Card>
    </TabsContent>
    <TabsContent value="proposal" className="space-y-4">
     <Card><CardHeader><CardTitle>Partnership proposal for departmental review</CardTitle>
      <CardDescription>Submitting a proposal is not executive or Board approval; the governed approval and contract processes remain separate.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
       <CasePicker cases={cases} selected={selected?.id??""} choose={setCaseId}/>
       {selected&&<Badge variant="secondary">{label(selected.review_status)}</Badge>}
       <div><Label>Proposal, target beneficiaries, deliverables and outcomes (at least 60 characters)</Label><Textarea rows={6} value={proposal.narrative} onChange={e=>setProposal(v=>({...v,narrative:e.target.value}))}/></div>
       <div><Label>Resources, partner/HPG responsibilities, staffing and dependencies</Label><Textarea rows={4} value={proposal.resources} onChange={e=>setProposal(v=>({...v,resources:e.target.value}))}/></div>
       <div><Label>Budget forecast, funding, compliance and risk questions</Label><Textarea rows={3} value={proposal.cost} onChange={e=>setProposal(v=>({...v,cost:e.target.value}))}/></div>
       <Button disabled={!selected||action.isPending||proposal.narrative.trim().length<60||proposal.resources.trim().length<10||!["not_submitted","changes_requested"].includes(selected.review_status)}
        onClick={submit}><ClipboardCheck className="mr-2 h-4 w-4"/>Submit review request</Button>
      </CardContent></Card>
     {cases.filter(x=>x.review_status==="submitted").map(x=><Card key={x.id}><CardContent className="p-3 text-sm"><b>{x.organization_name}</b> — Under departmental/executive review, not approved.</CardContent></Card>)}
    </TabsContent>
    <TabsContent value="handoffs" className="space-y-4">
     <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>Link existing documents</CardTitle>
        <CardDescription>Use approved Google Drive, Confluence and Development documents without creating another file repository. External access still depends on the original file's sharing permissions.</CardDescription></CardHeader>
       <CardContent className="space-y-3">
        <CasePicker cases={cases} selected={selected?.id??""} choose={setCaseId}/>
        <div><Label>Document title</Label><Input value={resource.title} onChange={e=>setResource(v=>({...v,title:e.target.value}))} placeholder="Introduction deck, research brief, proposed MOU…"/></div>
        <div><Label>Secure document URL (HTTPS)</Label><Input type="url" value={resource.url} onChange={e=>setResource(v=>({...v,url:e.target.value}))} placeholder="https://…"/></div>
        <div><Label>Document category</Label><Select value={resource.type} onValueChange={type=>setResource(v=>({...v,type}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>
          {["confluence","drive","proposal","presentation","research","agreement_draft","other"].map(x=><SelectItem key={x} value={x}>{label(x)}</SelectItem>)}
        </SelectContent></Select></div>
        <Button disabled={!selected||action.isPending||resource.title.trim().length<2||!/^https:\/\/[^\s]+$/i.test(resource.url)} onClick={addResource}><Link2 className="mr-2 h-4 w-4"/>Save reference</Button>
       </CardContent></Card>
      <Card><CardHeader><CardTitle>Request Development support</CardTitle>
        <CardDescription>Ask for grant research, proposal writing, budget analysis or another specialized assessment; departmental staff triage the request in their existing work queue.</CardDescription></CardHeader>
       <CardContent className="space-y-3">
        <CasePicker cases={cases} selected={selected?.id??""} choose={setCaseId}/>
        <div><Label>Support category</Label><Select value={support.type} onValueChange={type=>setSupport(v=>({...v,type}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>
         {["research","grant_writing","budget","program","communications","legal_compliance","other"].map(x=><SelectItem key={x} value={x}>{label(x)}</SelectItem>)}
        </SelectContent></Select></div>
        <div><Label>What information, document or analysis is needed?</Label><Textarea rows={5} value={support.details} onChange={e=>setSupport(v=>({...v,details:e.target.value}))} placeholder="Explain the organization, objective, related NGO and needed output…"/></div>
        <Button disabled={!selected||action.isPending||support.details.trim().length<10} onClick={requestSupport}><Send className="mr-2 h-4 w-4"/>Request support</Button>
       </CardContent></Card>
     </div>
     <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>Linked documents and presentations</CardTitle></CardHeader>
       <CardContent className="space-y-2">
        {(data.data?.resources??[]).filter(x=>x.case_id===selected?.id).map(x=><a key={x.id} href={x.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-2 rounded border p-3 text-sm hover:bg-muted/40"><div className="flex items-center gap-2"><FileText className="h-4 w-4"/><div><b>{x.title}</b><p className="text-xs text-muted-foreground">{label(x.resource_type)}</p></div></div><ExternalLink className="h-4 w-4"/></a>)}
        {!(data.data?.resources??[]).some(x=>x.case_id===selected?.id)&&<p className="text-sm text-muted-foreground">No documents linked to this case yet.</p>}
       </CardContent></Card>
      <Card><CardHeader><CardTitle>Departmental requests and status</CardTitle></CardHeader>
       <CardContent className="space-y-2">
        {(data.data?.support_requests??[]).filter(x=>x.case_id===selected?.id).map(x=><div key={x.id} className="rounded border p-3 text-sm"><div className="flex justify-between"><b>{label(x.request_type)}</b><Badge variant="secondary">{label(x.status)}</Badge></div><p className="mt-1">{x.details}</p><p className="text-xs text-muted-foreground">Submitted {date(x.created_at)}</p></div>)}
        {!(data.data?.support_requests??[]).some(x=>x.case_id===selected?.id)&&<p className="text-sm text-muted-foreground">No departmental support requests have been submitted.</p>}
       </CardContent></Card>
     </div>
    </TabsContent>
    <TabsContent value="resources" className="space-y-4">
     <Card><CardHeader><CardTitle>Partnership, Development & Academy documentation</CardTitle>
      <CardDescription>Curated Confluence descriptions and operational procedures; individual access permissions still apply.</CardDescription></CardHeader>
      <CardContent className="grid gap-2 md:grid-cols-2">{references.map(([title,url])=>
       <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="flex justify-between gap-2 items-center border rounded p-3 text-sm hover:bg-muted/40">
        <span>{title}</span><ExternalLink className="h-4 w-4 shrink-0"/></a>)}</CardContent></Card>
     <Card><CardHeader><CardTitle>Proposed operating model: external relationships and strategy</CardTitle><CardDescription>Working-Board authority remains subject to Board approval and written delegation.</CardDescription></CardHeader><CardContent className="space-y-2 text-sm">
      <p><b>Portfolio responsibility:</b> cultivate institutional partnerships, advocacy, civic and community engagement, public affairs, media contacts, sponsorship relationships and the external relationship-building component of strategic planning. Keep a documented pipeline of leads, meetings, collaboration opportunities and outcomes.</p>
      <p><b>Two-way handoff:</b> Development research can generate targets for external cultivation; relationships developed here return to Development for grant writing, eligibility checks, budget planning, proposals and coordination. Program, Finance, Compliance, Counsel and authorized Board processes retain their applicable approvals.</p>
      <p><b>Christie / Development:</b> coordinate research-to-outreach handoffs, proposal preparation and two-way performance reporting.</p>
      <p><b>Yogesh / Research:</b> identify and screen funders and potential partners; Development retains grant research, budgets with Finance, and grant/proposal writing.</p>
      <p><b>Juanita / Academy:</b> proposed leadership and organizational development oversight, including delegated training sections for HPG personnel, sponsored NGOs, other NGOs and stakeholders, subject to approvals.</p>
      <p><b>Program and Academy:</b> program ownership, curriculum approval, learner support and educational event delivery remain with authorized program leaders; externally cultivated partners can support those activities.</p>
     </CardContent></Card>
    </TabsContent>
    <TabsContent value="governance" className="grid gap-4 md:grid-cols-2">
     <Card><CardHeader><CardTitle>Governed Board decisions</CardTitle></CardHeader><CardContent>
      <p className="text-sm mb-3">Board membership, voting, approvals, minutes and final agreements follow HPG's existing governed process. Portal cases cannot self-authorize their approval.</p>
      <Button variant="outline" asChild><Link to="/board/hub">Open Board of Directors Hub</Link></Button>
     </CardContent></Card>
     <Card><CardHeader><CardTitle>Weekly and monthly reporting</CardTitle></CardHeader><CardContent>
      <p className="text-sm mb-3">Use recorded outreach activity and official Confluence templates for monthly pipeline reviews and quarterly outcomes.</p>
      <a className="text-sm underline" target="_blank" rel="noopener noreferrer" href="https://humanitypathways.atlassian.net/wiki/spaces/DDS/pages/289112069/Partnership+Development+Reporting+Templates+HPG">Open Partnership Reporting Templates</a>
     </CardContent></Card>
    </TabsContent>
   </Tabs>
  </div>
 </MainLayout>;
}
function CasePicker({cases,selected,choose}:{cases:Case[];selected:string;choose:(id:string)=>void}){
 return <div><Label>Partnership case</Label><Select value={selected} onValueChange={choose}>
  <SelectTrigger><SelectValue placeholder="Choose a case"/></SelectTrigger><SelectContent>
   {cases.map(c=><SelectItem key={c.id} value={c.id}>{c.organization_name}</SelectItem>)}
  </SelectContent></Select></div>;
}
