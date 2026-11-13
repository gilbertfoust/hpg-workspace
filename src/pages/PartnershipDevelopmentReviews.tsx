import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { ensureSupabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardCheck } from "lucide-react";

type Review = {
 id:string;case_id:string;status:string;created_at:string;work_item_id:string|null;
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
 const queue=useQuery({queryKey:["partnership-development-review-queue"],queryFn:()=>rpc<Review[]>("partnership_portal_development_queue"),retry:false});
 const triage=useMutation({
   mutationFn:(id:string)=>rpc<string>("partnership_portal_triage_review",{p_request_id:id}),
   onSuccess:()=>void qc.invalidateQueries({queryKey:["partnership-development-review-queue"]})
 });
 const requests=queue.data??[];
 return <MainLayout title="Partnership Development Reviews" subtitle="Development Department • Cross-department proposal intake">
 <div className="space-y-4">
 <Alert><ClipboardCheck className="h-4 w-4"/><AlertDescription>
  Board portfolio holders can submit proposals here, but only authorized Development staff may route a governed work item.
  This triage does not approve the proposal, create a Board motion, sign an agreement or commit HPG funds.
 </AlertDescription></Alert>
 {queue.isError&&<Alert variant="destructive"><AlertDescription>Development authorization or the review queue is unavailable.</AlertDescription></Alert>}
 {triage.isError&&<Alert variant="destructive"><AlertDescription>{triage.error.message}</AlertDescription></Alert>}
 {queue.isLoading&&<p className="text-sm text-muted-foreground">Loading review requests…</p>}
 {requests.map(r=><Card key={r.id}>
  <CardHeader><div className="flex items-center justify-between gap-2"><CardTitle>{r.organization_name}</CardTitle><Badge variant="outline">{r.status}</Badge></div>
   <CardDescription>{r.geography||"Region not specified"} · {r.program_alignment||"Program to be assigned"} · Submitted {new Date(r.created_at).toLocaleDateString()}</CardDescription>
  </CardHeader>
  <CardContent className="space-y-3 text-sm">
   <div><b>Proposed relationship and results</b><p className="whitespace-pre-wrap">{r.proposal_narrative||"No narrative provided"}</p></div>
   <div><b>Resource and department dependencies</b><p className="whitespace-pre-wrap">{r.requested_resources||"Unspecified"}</p></div>
   <div><b>Budget and risk questions</b><p className="whitespace-pre-wrap">{r.estimated_cost_notes||"Not provided"}</p></div>
   {r.work_item_id
     ?<Button variant="outline" asChild><Link to={"/work-items?workItemId="+encodeURIComponent(r.work_item_id)}>Open governed review work item</Link></Button>
     :<Button disabled={r.status!=="submitted"||triage.isPending} onClick={()=>triage.mutate(r.id)}>Accept and route to Development work queue</Button>}
   <p className="text-xs text-muted-foreground">Finance, Compliance, Program, General Counsel and Board review must be completed in their authorized systems as applicable.</p>
  </CardContent>
 </Card>)}
 {!queue.isLoading&&!requests.length&&!queue.isError&&<Card><CardContent className="p-6 text-sm text-muted-foreground">No partnership review requests have been submitted.</CardContent></Card>}
 </div>
 </MainLayout>;
}