/* Authenticated, role-scoped HPG internal research library and evidence review. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { ensureSupabase } from "@/integrations/supabase/client";
const api=()=>ensureSupabase() as any;
export type ResearchSource={
  id:string;title:string;authors:string;publisher:string;source_url:string;
  source_type:string;published_on:string|null;accessed_on:string;language_code:string;
  source_summary:string;methodology_notes:string;limitations:string;relevance_notes:string;
  access_scope:"internal"|"restricted";status:"draft"|"submitted"|"reviewed"|"withdrawn";
  version:number;created_by:string;reviewed_by:string|null;
  reviewed_at:string|null;created_at:string;updated_at:string;
};
export type ResearchAnnotation={
  id:string;source_id:string;annotation_type:string;locator:string;note_text:string;
  created_by:string;created_at:string;
};
export type ResearchReview={
  id:string;source_id:string;source_version:number;decision:string;
  evidence_note:string;reviewed_by:string;reviewed_at:string;
};
const fields="id,title,authors,publisher,source_url,source_type,published_on,accessed_on,language_code,source_summary,methodology_notes,limitations,relevance_notes,access_scope,status,version,created_by,reviewed_by,reviewed_at,created_at,updated_at";
export function useWorkspaceResearchLibrary(){
  const {user}=useAuth();
  return useQuery<ResearchSource[]>({
    queryKey:["workspace-research-library",user?.id],enabled:!!user?.id,retry:false,
    queryFn:async()=>{
      const {data,error}=await api().from("workspace_research_sources")
        .select(fields).order("created_at",{ascending:false}).limit(500);
      if(error)throw error;
      return data||[];
    }
  });
}
export function useWorkspaceResearchAnnotations(sourceId?:string){
  const {user}=useAuth();
  return useQuery<ResearchAnnotation[]>({
    queryKey:["workspace-research-annotations",user?.id,sourceId],
    enabled:!!user?.id&&!!sourceId,retry:false,
    queryFn:async()=>{
      const {data,error}=await api().from("workspace_research_annotations")
        .select("id,source_id,annotation_type,locator,note_text,created_by,created_at")
        .eq("source_id",sourceId).order("created_at",{ascending:false});
      if(error)throw error;return data||[];
    }
  });
}
export function useWorkspaceResearchReviews(sourceId?:string){
  const {user}=useAuth();
  return useQuery<ResearchReview[]>({
    queryKey:["workspace-research-reviews",user?.id,sourceId],
    enabled:!!user?.id&&!!sourceId,retry:false,
    queryFn:async()=>{
      const {data,error}=await api().from("workspace_research_reviews")
        .select("id,source_id,source_version,decision,evidence_note,reviewed_by,reviewed_at")
        .eq("source_id",sourceId).order("reviewed_at",{ascending:false});
      if(error)throw error;return data||[];
    }
  });
}
export function useWorkspaceResearchMutations(){
  const {user}=useAuth();const qc=useQueryClient();
  const refresh=()=>qc.invalidateQueries({queryKey:["workspace-research-library",user?.id]});
  const create=useMutation({
    mutationFn:async(input:{
      title:string;authors:string;publisher:string;url:string;sourceType:string;
      summary:string;methodology:string;limitations:string;relevance:string;
      scope:string;language:string;publishedOn:string|null;
    })=>{
      const {data,error}=await api().rpc("create_workspace_research_source",{
        p_title:input.title,p_authors:input.authors,p_publisher:input.publisher,
        p_url:input.url,p_source_type:input.sourceType,p_summary:input.summary,
        p_methodology:input.methodology,p_limitations:input.limitations,
        p_relevance:input.relevance,p_scope:input.scope,p_language:input.language,
        p_published_on:input.publishedOn||null
      });
      if(error)throw error;return data as string;
    },
    onSuccess:refresh
  });
  const submit=useMutation({
    mutationFn:async(id:string)=>{
      const {error}=await api().rpc("submit_workspace_research_source",{p_id:id});
      if(error)throw error;
    },
    onSuccess:refresh
  });
  const revise=useMutation({
    mutationFn:async(input:{id:string;summary:string;methodology:string;limitations:string;relevance:string})=>{
      const {error}=await api().rpc("revise_workspace_research_draft",{
        p_source_id:input.id,p_summary:input.summary,p_methodology:input.methodology,
        p_limitations:input.limitations,p_relevance:input.relevance
      });
      if(error)throw error;
    },
    onSuccess:refresh
  });
  const annotate=useMutation({
    mutationFn:async(input:{id:string;kind:string;locator:string;note:string})=>{
      const {error}=await api().rpc("add_workspace_research_annotation",{
        p_source_id:input.id,p_kind:input.kind,p_locator:input.locator,p_note:input.note
      });
      if(error)throw error;
    },
    onSuccess:(_,input)=>qc.invalidateQueries({queryKey:["workspace-research-annotations",user?.id,input.id]})
  });
  const review=useMutation({
    mutationFn:async(input:{id:string;decision:string;note:string})=>{
      const {error}=await api().rpc("review_workspace_research_source",{
        p_source_id:input.id,p_decision:input.decision,p_note:input.note
      });
      if(error)throw error;
    },
    onSuccess:(_,input)=>{
      refresh();
      qc.invalidateQueries({queryKey:["workspace-research-reviews",user?.id,input.id]});
    }
  });
  return {create,submit,revise,annotate,review};
}
