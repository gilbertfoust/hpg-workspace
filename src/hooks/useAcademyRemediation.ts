/* Private formative assessment recovery and scheduled internal Workspace Training notices. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { ensureSupabase } from "@/integrations/supabase/client";
const api=()=>ensureSupabase() as any;
export type AcademyRecovery={
  assessment_id:string;attempts_last_24h:number;daily_attempt_limit:number;
  retry_after:string|null;review_required:boolean;
  suggested_lessons:{id:string;title:string}[];
};
export type AcademyCourseNotice={
  id:number;track_id:string;kind:"overdue"|"due_soon";due_date:string;
  message:string;created_at:string;seen_at:string|null;
};
export function useAcademyAssessmentRecovery(id?:string){
  const {user}=useAuth();
  return useQuery<AcademyRecovery>({
    queryKey:["academy-assessment-recovery",user?.id,id],
    enabled:!!user?.id&&!!id,retry:false,
    queryFn:async()=>{
      const {data,error}=await api().rpc("get_my_academy_assessment_recovery",{p_assessment:id});
      if(error)throw error;return data as AcademyRecovery;
    }
  });
}
export function useAcademyCourseNotices(){
  const {user}=useAuth();const qc=useQueryClient();
  const query=useQuery<AcademyCourseNotice[]>({
    queryKey:["academy-course-notices",user?.id],enabled:!!user?.id,retry:false,
    queryFn:async()=>{
      const {data,error}=await api().rpc("get_my_academy_course_notifications");
      if(error)throw error;return data||[];
    }
  });
  const markSeen=useMutation({
    mutationFn:async(id:number)=>{
      const {data,error}=await api().rpc("acknowledge_academy_course_notification",{p_id:id});
      if(error)throw error;return data;
    },
    onSuccess:()=>qc.invalidateQueries({queryKey:["academy-course-notices",user?.id]})
  });
  return {query,markSeen};
}
