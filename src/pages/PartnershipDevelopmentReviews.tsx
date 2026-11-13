import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { ensureSupabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardCheck } from "lucide-react";

type Support={id:string;case_id:string;request_type:string;details:string;status:string;created_at:string;work_item_id:string|null;organization_name:string;program_alignment:string|null;geography:string|null;};
type Shareable={prospects:{id:string;prospect_name:string;prospect_type:string;geography:string|null}[];portfolio_users:{user_id:string;full_name:string;operational_title:string}[];shared:{prospect_id:string;user_id:string;revoked_at:string|null}[]};
type Review = {
 id:string;case_id:string;status:string;created_at:string;work_item_id:string|null;partner_id:string|null;pipeline_id:string|null;
 organization_name:string;program_alignment:string|null;geography:string|null;
 proposal_narrative:string|null;requested_resources:string|null;estimated_cost_notes:string|null;
 owner_user_id:string;
};
async function rpc<T>(name:string,args?:Record<string,unknown>):Promise<T>{
 const result=await ensureSupabase().rpc(name as never,(args??{}) as never);
 if(result.error)throw new Error(result.error.message);
 return result.data as T;
}
export default function PartnershipDevelopmentReviews(){
 const qc=useQueryClient();
 const {user}=useAuth();
 const [prospectId,setProspectId]=useState("");
 const [targetUserId,setTargetUserId]=useState("");
 const [revision,setRevision]=useState<Record<string,string>>({});
 const queue=useQuery({queryKey:["partnership-development-review-queue",user?.id],enabled:!!user?.id,queryFn:()=>rpc<Review[]>("partnership_portal_development_queue"),retry:false});
 const handoffs=useQuery({queryKey:["partnership-development-leads",user?.id],enabled:!!user?.id,queryFn:()=>rpc<Shareable>("partnership_portal_development_leads"),retry:false});
 const supportQueue=useQuery({queryKey:["partnership-development-support-queue",user?.id],enabled:!!user?.id,queryFn:()=>rpc<Support[]>("partnership_portal_development_support_queue"),retry:false});
 const triage=useMutation({
   mutationFn:(id:string)=>rpc<string>("partnership_portal_triage_review",{p_request_id:id}),
   onSuccess:()=>void qc.invalidateQueries({queryKey:["partnership-development-review-queue",user?.id]})
 });
 const shareLead=useMutation({
  mutationFn:()=>rpc<void>("partnership_portal_share_lead",{p_prospect_id:prospectId,p_portfolio_user_id:targetUserId}),
  onSuccess:()=>{void qc.invalidateQueries({queryKey:["partnership-development-leads",user?.id]});},
 });
 const routeSupport=useMutation({
  mutationFn:(id:string)=>rpc<string>("partnership_portal_triage_support",{p_request_id:id}),
  onSuccess:()=>{void qc.invalidateQueries({queryKey:["partnership-development-support-queue",user?.id]});}
 });
 const requestChanges=useMutation({
  mutationFn:(id:string)=>rpc<void>("partnership_portal_request_changes",{p_request_id:id,p_reason:revision[id]??""}),
  onSuccess:()=>void qc.invalidateQueries({queryKey:["partnership-development-review-queue",user?.id]})
 });
 const requests=queue.data??[];
 const sharedActive=handoffs.data?.shared??[];
 const portfolioUsers=handoffs.data?.portfolio_users??[];
 return <MainLayout title="Partnership Development Reviews" subtitle="Development Department • Cross-department proposal intake">
 <div className="space-y-4">
 <Alert><ClipboardCheck className="h-4 w-4"/><AlertDescription>
  Board portfolio holders can submit proposals here, but only authorized Development staff may route a governed work item.
  This triage does not approve the proposal, create a Board motion, sign an agreement or commit HPG funds.
 </AlertDescription></Alert>
 {queue.isError&&<Alert variant="destructive"><AlertDescription>Development authorization or the review queue is unavailable.</AlertDescription></Alert>}
 {triage.isError&&<Alert variant="destructive"><AlertDescription>{triage.error.message}</AlertDescription></Alert>}
 {routeSupport.isError&&<Alert variant="destructive"><AlertDescription>{routeSupport.error.message}</AlertDescription></Alert>}
 {shareLead.isError&&<Alert variant="destructive"><AlertDescription>{shareLead.error.message}</AlertDescription></Alert>}
 {requestChanges.isError&&<Alert variant="destructive"><AlertDescription>{requestChanges.error.message}</AlertDescription></Alert>}
 {queue.isLoading&&<p className="text-sm text-muted-foreground">Loading review requests…</p>}
 {requests.map(r=><Card key={r.id}>
  <CardHeader><div className="flex items-center justify-between gap-2"><CardTitle>{r.organization_name}</CardTitle><Badge variant="outline">{r.status}</Badge></div>
   <CardDescription>{r.geography||"Region not specified"} · {r.program_alignment||"Program to be assigned"} · Submitted {new Date(r.created_at).toLocaleDateString()}</CardDescription>
  </CardHeader>
  <CardContent className="space-y-3 text-sm">
   <div><b>Proposed relationship and results</b><p className="whitespace-pre-wrap">{r.proposal_narrative||"No narrative provided"}</p></div>
   <div><b>Resource and department dependencies</b><p className="whitespace-pre-wrap">{r.requested_resources||"Unspecified"}</p></div>
   <div><b>Budget and risk questions</b><p className="whitespace-pre-wrap">{r.estimated_cost_notes||"Not provided"}</p></div>
   {r.pipeline_id&&<div><Button variant="outline" size="sm" asChild><Link to="/partnerships">Open linked Development Partnership Pipeline</Link></Button></div>}
   {r.work_item_id
     ?<Button variant="outline" asChild><Link to={"/work-items?workItemId="+encodeURIComponent(r.work_item_id)}>Open governed review work item</Link></Button>
     :<Button disabled={r.status!=="submitted"||triage.isPending} onClick={()=>triage.mutate(r.id)}>Accept and route to Development work queue</Button>}
   {["submitted","routed"].includes(r.status)&&<div className="space-y-2 border-t pt-3"><Label>Request changes before approval</Label><Textarea value={revision[r.id]??""} onChange={e=>setRevision(old=>({...old,[r.id]:e.target.value}))} placeholder="What must the Board portfolio holder revise?"/><Button variant="outline" size="sm" disabled={requestChanges.isPending||(revision[r.id]??"").trim().length<10} onClick={()=>requestChanges.mutate(r.id)}>Return with corrections</Button></div>}
   <p className="text-xs text-muted-foreground">Finance, Compliance, Program, General Counsel and Board review must be completed in their authorized systems as applicable.</p>
  </CardContent>
 </Card>)}
 {!queue.isLoading&&!requests.length&&!queue.isError&&<Card><CardContent className="p-6 text-sm text-muted-foreground">No partnership proposals currently need triage.</CardContent></Card>}
 <Card><CardHeader><CardTitle>Development research, writing and budget requests</CardTitle>
  <CardDescription>These requests originate with the Board partnership portfolio. Accept them into the existing governed Development work queue rather than starting a separate grant-writing system.</CardDescription></CardHeader>
  <CardContent className="space-y-3">
   {supportQueue.isError&&<p className="text-sm text-destructive">The Development support queue is unavailable or access is not authorized.</p>}
   {(supportQueue.data??[]).map(s=><div key={s.id} className="rounded border p-3 space-y-2 text-sm">
    <div className="flex items-center justify-between"><b>{s.organization_name} — {s.request_type.replaceAll("_"," ")}</b><Badge variant="secondary">{s.status}</Badge></div>
    <p>{s.details}</p><p className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</p>
    {s.work_item_id?<Button variant="outline" size="sm" asChild><Link to={"/work-items?workItemId="+encodeURIComponent(s.work_item_id)}>View departmental work item</Link></Button>
    :<Button variant="outline" size="sm" disabled={s.status!=="submitted"||routeSupport.isPending} onClick={()=>routeSupport.mutate(s.id)}>Accept into Development queue</Button>}
   </div>)}
   {!supportQueue.isLoading&&!(supportQueue.data?.length)&&!supportQueue.isError&&<p className="text-sm text-muted-foreground">No departmental support requests yet.</p>}
  </CardContent>
 </Card>
 <Card><CardHeader><CardTitle>Controlled research lead handoff</CardTitle>
  <CardDescription>Share an existing Development prospect with an authorized working-Board portfolio holder. This exposes only the selected prospect; it does not grant general CRM access or create a duplicate lead.</CardDescription></CardHeader>
  <CardContent className="space-y-3">
   {handoffs.isError&&<p className="text-sm text-destructive">The lead handoff directory is unavailable or Development authorization is missing.</p>}
   <div className="grid gap-3 md:grid-cols-2">
    <div><Label>Development prospect</Label><Select value={prospectId} onValueChange={setProspectId}><SelectTrigger><SelectValue placeholder="Select a qualified prospect"/></SelectTrigger><SelectContent>{(handoffs.data?.prospects??[]).map(p=><SelectItem key={p.id} value={p.id}>{p.prospect_name}</SelectItem>)}</SelectContent></Select></div>
    <div><Label>Authorized Board portfolio</Label><Select value={targetUserId} onValueChange={setTargetUserId}><SelectTrigger><SelectValue placeholder="Select an authorized holder"/></SelectTrigger><SelectContent>{portfolioUsers.map(x=><SelectItem key={x.user_id} value={x.user_id}>{x.full_name} — {x.operational_title}</SelectItem>)}</SelectContent></Select></div>
   </div>
   {!portfolioUsers.length&&<p className="text-sm text-muted-foreground">No Board portfolio holder has been activated. Lead sharing will become available after the required approval and account authorization; no one has been assigned prematurely.</p>}
   <Button disabled={!prospectId||!targetUserId||!portfolioUsers.length||shareLead.isPending} onClick={()=>shareLead.mutate()}>Share selected prospect</Button>
   {prospectId&&targetUserId&&sharedActive.some(x=>x.prospect_id===prospectId&&x.user_id===targetUserId&&!x.revoked_at)&&<p className="text-sm text-muted-foreground">This prospect is already available to the selected portfolio holder.</p>}
  </CardContent></Card>
 </div>
 </MainLayout>;
}