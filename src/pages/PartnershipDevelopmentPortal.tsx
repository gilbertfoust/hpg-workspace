import { useState } from "react";
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
import { ExternalLink, LockKeyhole, ClipboardCheck, Handshake } from "lucide-react";

type Case = {id:string; organization_name:string; organization_type:string; geography:string|null;
  contact_name:string|null; contact_email:string|null; program_alignment:string|null; summary:string;
  stage:string; review_status:string; next_action:string|null; next_action_due_at:string|null;
  proposal_narrative:string|null; requested_resources:string|null; estimated_cost_notes:string|null;
  source_prospect_id:string|null; created_at:string; updated_at:string;};
type Activity = {id:string;case_id:string;activity_type:string;details:string;created_at:string;};
type Prospect = {id:string;prospect_name:string;prospect_type:string;geography:string|null;};
type Portfolio = {cases:Case[];activities:Activity[];available_prospects:Prospect[];};
const references=[
 ["Partnership Development Division Hub","https://humanitypathways.atlassian.net/wiki/spaces/DDS/pages/22315118/Partnership+Development+Division+Hub+Complete+Version"],
 ["Partnership Development SOPs","https://humanitypathways.atlassian.net/wiki/spaces/DDS/pages/35127314/Partnership+Development+SOPs"],
 ["Partnership reporting forms","https://humanitypathways.atlassian.net/wiki/spaces/DDS/pages/289112069/Partnership+Development+Reporting+Templates+HPG"],
 ["Grant and partnership forms","https://humanitypathways.atlassian.net/wiki/spaces/DDS/pages/605028365/Grant+and+partnership+development+forms+1"],
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
 const [tab,setTab]=useState("dashboard");
 const [caseId,setCaseId]=useState("");
 const [notice,setNotice]=useState("");
 const [error,setError]=useState("");
 const [newCase,setNewCase]=useState({name:"",geography:"",contact:"",email:"",program:"",summary:"",type:"community_partner"});
 const [log,setLog]=useState({type:"outreach",details:"",next:"",due:"",stage:"unchanged"});
 const [proposal,setProposal]=useState({narrative:"",resources:"",cost:""});
 const access=useQuery({queryKey:["partnership-portfolio-access"],queryFn:()=>rpc<boolean>("can_access_partnership_portal"),retry:false});
 const data=useQuery({queryKey:["partnership-portfolio-data"],enabled:access.data===true,queryFn:()=>rpc<Portfolio>("partnership_portal_overview")});
 const refresh=()=>{void qc.invalidateQueries({queryKey:["partnership-portfolio-data"]});};
 const cases=data.data?.cases??[];
 const activities=data.data?.activities??[];
 const selected=cases.find(c=>c.id===caseId)??cases[0];
 const action=useMutation({mutationFn:async (values:{name:string;args:Record<string,unknown>})=>rpc<unknown>(values.name,values.args),
   onSuccess:()=>{setError("");setNotice("Changes recorded in the controlled partnership portfolio.");refresh();},
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
 const stats=[
 {name:"Prospects",count:cases.filter(c=>["identified","outreach"].includes(c.stage)).length,target:"30"},
 {name:"Outreach activities",count:activities.filter(a=>a.activity_type==="outreach").length,target:"20"},
 {name:"Meetings",count:activities.filter(a=>a.activity_type==="meeting").length,target:"10"},
 {name:"Proposals",count:cases.filter(c=>["proposal","review_requested","approved","active"].includes(c.stage)).length,target:"5"},
 {name:"Reviews pending",count:cases.filter(c=>c.review_status==="submitted").length,target:"—"},
 {name:"Approved partners",count:cases.filter(c=>c.stage==="active").length,target:"3"},
 ];
 if(access.isLoading)return <MainLayout title="Partnership Development"><p className="p-4">Checking Board portfolio access…</p></MainLayout>;
 if(access.data!==true)return <MainLayout title="Partnership Development" subtitle="Board-linked operational portfolio">
  <Alert><LockKeyhole className="h-4 w-4"/><AlertTitle>Operational assignment required</AlertTitle><AlertDescription>
    Access requires an authenticated Workspace account, active Board membership and recorded operational authorization.
    A Board role alone does not permit access to Development records. No director is automatically assigned.
  </AlertDescription></Alert></MainLayout>;
 return <MainLayout title="Partnership Development" subtitle="Board portfolio • Institutional relationships and resource development">
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
     <Card><CardHeader><CardTitle>Existing Development leads</CardTitle><CardDescription>Import an existing prospect without making a duplicate.</CardDescription></CardHeader><CardContent className="max-h-[530px] space-y-2 overflow-y-auto">
      {(data.data?.available_prospects??[]).map(p=><div key={p.id} className="flex items-center justify-between border-b pb-2 gap-2 text-sm">
       <div><b>{p.prospect_name}</b><p className="text-muted-foreground">{p.geography||p.prospect_type}</p></div>
       <Button size="sm" variant="outline" disabled={action.isPending} onClick={()=>action.mutate({name:"partnership_portal_import_prospect",args:{p_prospect_id:p.id}})}>Import</Button>
      </div>)}
      {!(data.data?.available_prospects?.length)&&<p className="text-sm text-muted-foreground">No additional unlinked prospects.</p>}
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
       <div><Label>Case stage</Label><Select value={log.stage} onValueChange={stage=>setLog(v=>({...v,stage}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>
        {["unchanged","identified","outreach","discovery","proposal","closed"].map(x=><SelectItem key={x} value={x}>{label(x)}</SelectItem>)}
       </SelectContent></Select></div>
      </div>
      <Button disabled={!selected||action.isPending||log.details.trim().length<3||selected.review_status==="submitted"} onClick={record}>Save activity</Button>
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
       <Button disabled={!selected||action.isPending||proposal.narrative.trim().length<60||proposal.resources.trim().length<10||selected.review_status==="submitted"}
        onClick={submit}><ClipboardCheck className="mr-2 h-4 w-4"/>Submit review request</Button>
      </CardContent></Card>
     {cases.filter(x=>x.review_status==="submitted").map(x=><Card key={x.id}><CardContent className="p-3 text-sm"><b>{x.organization_name}</b> — Under departmental/executive review, not approved.</CardContent></Card>)}
    </TabsContent>
    <TabsContent value="resources" className="space-y-4">
     <Card><CardHeader><CardTitle>Partnership, Development & Academy documentation</CardTitle>
      <CardDescription>Curated Confluence descriptions and operational procedures; individual access permissions still apply.</CardDescription></CardHeader>
      <CardContent className="grid gap-2 md:grid-cols-2">{references.map(([title,url])=>
       <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="flex justify-between gap-2 items-center border rounded p-3 text-sm hover:bg-muted/40">
        <span>{title}</span><ExternalLink className="h-4 w-4 shrink-0"/></a>)}</CardContent></Card>
     <Card><CardHeader><CardTitle>Cross-department relationships</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
      <p><b>Christie / Development:</b> grant research coordination and funding intelligence.</p>
      <p><b>Yogesh / Research:</b> grant research, evidence and funder reports; grant writing remains separately managed.</p>
      <p><b>Juanita / Academy:</b> proposed training lead for HPG personnel, sponsored NGOs, other NGOs and stakeholders, subject to organizational approval.</p>
      <p><b>Program and Academy:</b> curriculum, learner support and educational event delivery remain with designated program owners.</p>
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
