import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useFinanceAnalysisCenter(ngoId?: string | null) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["finance-analysis", ngoId] });
  const runs = useQuery({ queryKey: ["finance-analysis", ngoId, "runs"], enabled: Boolean(ngoId), queryFn: async () => { const { data,error }=await (supabase as any).from("finance_analysis_runs").select("*").eq("ngo_id",ngoId).order("created_at",{ascending:false}); if(error)throw error;return data??[]; } });
  const recommendations = useQuery({ queryKey: ["finance-analysis", ngoId, "recommendations"], enabled: Boolean(ngoId), queryFn: async () => { const { data,error }=await (supabase as any).from("finance_recommendations").select("*").eq("ngo_id",ngoId).order("created_at",{ascending:false}); if(error)throw error;return data??[]; } });
  const grants = useQuery({ queryKey: ["finance-analysis", ngoId, "grants"], enabled: Boolean(ngoId), queryFn: async () => { const { data,error }=await (supabase as any).from("grant_applications").select("id,title,stage").eq("ngo_id",ngoId).order("created_at",{ascending:false}); if(error)throw error;return data??[]; } });
  const run = useMutation({ mutationFn: async ({start,end,scenario}:{start:string;end:string;scenario:string})=>{const{data,error}=await (supabase as any).rpc("run_finance_analysis",{p_ngo_id:ngoId,p_period_start:start,p_period_end:end,p_scenario:scenario});if(error)throw error;return data;},onSuccess:()=>{invalidate();toast.success("Financial analysis refreshed");},onError:(e:Error)=>toast.error(e.message)});
  const share = useMutation({ mutationFn:async(id:string)=>{const{data,error}=await (supabase as any).rpc("share_finance_recommendation",{p_recommendation_id:id});if(error)throw error;return data;},onSuccess:()=>{invalidate();toast.success("Recommendation shared with the NGO");},onError:(e:Error)=>toast.error(e.message)});
  const contribute = useMutation({ mutationFn:async(input:{grantId:string;title:string;content:string;analysisRunId?:string;recommendationIds:string[]})=>{const{data,error}=await (supabase as any).rpc("submit_grant_proposal_contribution",{p_grant_application_id:input.grantId,p_department:"finance",p_section_key:"financial_capacity_and_budget",p_section_title:input.title,p_content_markdown:input.content,p_source_analysis_run_id:input.analysisRunId||null,p_source_recommendation_ids:input.recommendationIds});if(error)throw error;return data;},onSuccess:()=>toast.success("Finance contribution sent to Development"),onError:(e:Error)=>toast.error(e.message)});
  return { runs,recommendations,grants,run,share,contribute };
}

export function useNgoSharedRecommendations(ngoId?: string) {
  const queryClient=useQueryClient();
  const query=useQuery({queryKey:["ngo-shared-recommendations",ngoId],enabled:Boolean(ngoId),queryFn:async()=>{const{data,error}=await (supabase as any).from("finance_recommendations").select("*").eq("ngo_id",ngoId).in("status",["shared","acknowledged","resolved"]).order("created_at",{ascending:false});if(error)throw error;return data??[];}});
  const acknowledge=useMutation({mutationFn:async(id:string)=>{const{data,error}=await (supabase as any).rpc("acknowledge_finance_recommendation",{p_recommendation_id:id});if(error)throw error;return data;},onSuccess:()=>queryClient.invalidateQueries({queryKey:["ngo-shared-recommendations",ngoId]}),onError:(e:Error)=>toast.error(e.message)});
  return {...query,acknowledge};
}
