/* Evidence ledger for Academy deployment readiness. This does not infer that
 * an actual staff workflow has been verified merely because code is deployed.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery,useMutation,useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { ensureSupabase } from "@/integrations/supabase/client";
const api=()=>ensureSupabase() as any;
export type AcademyReadinessRow={
  lesson_id:string;track_id:string;lesson_title:string;question_count:number;
  reviewed_demo_count:number;reviewed_reference_count:number;
  tested_role_count:number;passed_role_count:number;
  blocked_or_failed_count:number;last_role_review_at:string|null;
};
export function useAcademyReadiness(enabled=true){
  const {user}=useAuth();
  return useQuery<AcademyReadinessRow[]>({
    queryKey:["academy-training-readiness",user?.id],
    enabled:!!user?.id&&enabled,retry:false,
    queryFn:async()=>{
      const {data,error}=await api().rpc("get_academy_training_readiness");
      if(error)throw error;return data||[];
    }
  });
}
export function useRecordAcademyAcceptance(){
  const {user}=useAuth();const qc=useQueryClient();
  return useMutation({
    mutationFn:async(input:{lessonId:string;testedUserId:string;outcome:"passed"|"failed"|"blocked";evidenceNote:string})=>{
      const {data,error}=await api().rpc("record_academy_training_acceptance",{
        p_lesson_id:input.lessonId,p_tested_user_id:input.testedUserId,
        p_outcome:input.outcome,p_evidence_note:input.evidenceNote
      });
      if(error)throw error;return data as string;
    },
    onSuccess:()=>qc.invalidateQueries({queryKey:["academy-training-readiness",user?.id]})
  });
}
