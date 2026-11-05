/* Approved Workspace Training media references. External Drive/media permissions
 * still apply; a published link never grants access to private external files.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery,useMutation,useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { ensureSupabase } from "@/integrations/supabase/client";
const api=()=>ensureSupabase() as any;
export type AcademyLessonResource = {
  id:string;lesson_id:string;title:string;resource_kind:"recorded_demo"|"guide"|"reference";
  source_url:string;caption_url:string|null;transcript:string;
  language_code:string;status:"draft"|"published"|"withdrawn";
  created_by:string;reviewed_by:string|null;created_at:string;
};
export function useAcademyLessonResources(id?:string){
  const {user}=useAuth();
  return useQuery<AcademyLessonResource[]>({
    queryKey:["academy-lesson-resources",user?.id,id],enabled:!!user?.id&&!!id,retry:false,
    queryFn:async()=>{
      const {data,error}=await api().from("academy_lesson_resources")
        .select("id,lesson_id,title,resource_kind,source_url,caption_url,transcript,language_code,status,created_by,reviewed_by,created_at")
        .eq("lesson_id",id).order("created_at",{ascending:false});
      if(error)throw error;
      return data||[];
    }
  });
}
export function useAddAcademyLessonResource(id?:string){
  const {user}=useAuth();const qc=useQueryClient();
  return useMutation({
    mutationFn:async(values:{title:string;kind:"recorded_demo"|"guide"|"reference";url:string;captionUrl:string;transcript:string;language:string})=>{
      if(!id)throw Error("Choose an authored lesson.");
      const {data,error}=await api().rpc("create_academy_lesson_resource",{
        p_lesson_id:id,p_title:values.title,p_kind:values.kind,
        p_source_url:values.url,p_caption_url:values.captionUrl||null,
        p_transcript:values.transcript,p_language_code:values.language,
      });
      if(error)throw error;return data;
    },
    onSuccess:()=>qc.invalidateQueries({queryKey:["academy-lesson-resources",user?.id,id]})
  });
}
export function useReviewAcademyLessonResource(id?:string){
  const {user}=useAuth();const qc=useQueryClient();
  return useMutation({
    mutationFn:async({resourceId,decision}:{resourceId:string;decision:"publish"|"withdraw"})=>{
      const {error}=await api().rpc("review_academy_lesson_resource",{p_id:resourceId,p_decision:decision});
      if(error)throw error;
    },
    onSuccess:()=>qc.invalidateQueries({queryKey:["academy-lesson-resources",user?.id,id]})
  });
}
