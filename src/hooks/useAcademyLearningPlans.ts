/* Role-driven, auditable Workspace Training paths. Other HPG Academy divisions
 * are independent and never included in this internal staff learning plan.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { ensureSupabase } from "@/integrations/supabase/client";
const api=()=>ensureSupabase() as any;
export type LearningPlanRow={
  track_id:string;title:string;status:string;required:boolean;source:"automatic"|"manual";
  due_at:string|null;lesson_count:number;completed_count:number;
  passed_exam:boolean;supervisor_endorsed:boolean;sequence:number;
};
export type TeamCourseAssignment={
  user_id:string;full_name:string;staff_role:string;track_id:string;track_title:string;
  status:string;required:boolean;source:string;due_at:string|null;assigned_at:string;
};
export type AcademyCourseSyllabus={
  track_id:string;overview:string;learning_outcomes:string[];prerequisite_tracks:string[];
  assessment_id:string|null;provisional_minutes:number;status:string;version:number;
};
export type AcademyLessonStandard={
  lesson_id:string;objective:string;practice_evidence:string;required_references:string[];
  prerequisite_lessons:string[];planned_minutes:number;editorial_state:string;version:number;
};
const planKey=(id?:string)=>["academy-learning-plan",id];
export function useMyAcademyPlan(){
  const {user}=useAuth();
  const qc=useQueryClient();
  const plan=useQuery<LearningPlanRow[]>({
    queryKey:planKey(user?.id),enabled:!!user?.id,retry:false,
    queryFn:async()=>{
      const {data,error}=await api().rpc("get_my_academy_learning_plan");
      if(error)throw error;return data||[];
    }
  });
  const refresh=useMutation({
    mutationFn:async()=>{
      const {data,error}=await api().rpc("refresh_my_academy_pathway");
      if(error)throw error;return data as number;
    },
    onSuccess:()=>qc.invalidateQueries({queryKey:planKey(user?.id)})
  });
  return {plan,refresh};
}
export function useAcademyTeamCourseAssignments(enabled=true){
  const {user}=useAuth();
  return useQuery<TeamCourseAssignment[]>({
    queryKey:["academy-team-course-assignments",user?.id],
    enabled:!!user?.id&&enabled,retry:false,
    queryFn:async()=>{
      const {data,error}=await api().rpc("get_team_academy_course_assignments");
      if(error)throw error;return data||[];
    }
  });
}
export function useAcademyCourseSyllabi(){
  const {user}=useAuth();
  return useQuery<AcademyCourseSyllabus[]>({
    queryKey:["academy-course-syllabi"],enabled:!!user?.id,retry:false,
    queryFn:async()=>{
      const {data,error}=await api().from("academy_course_syllabi")
        .select("track_id,overview,learning_outcomes,prerequisite_tracks,assessment_id,provisional_minutes,status,version");
      if(error)throw error;return data||[];
    }
  });
}
export function useAcademyLessonStandards(lessonId?:string){
  const {user}=useAuth();
  return useQuery<AcademyLessonStandard[]>({
    queryKey:["academy-lesson-standards",lessonId],enabled:!!user?.id,retry:false,
    queryFn:async()=>{
      let query=api().from("academy_lesson_standards")
        .select("lesson_id,objective,practice_evidence,required_references,prerequisite_lessons,planned_minutes,editorial_state,version");
      if(lessonId)query=query.eq("lesson_id",lessonId);
      const {data,error}=await query;
      if(error)throw error;return data||[];
    }
  });
}
export function useAcademyPathwayAdministration(){
  const {user}=useAuth();
  const qc=useQueryClient();
  const assign=useMutation({
    mutationFn:async(input:{userId:string;trackId:string;state:"assigned"|"paused"|"removed";required:boolean;dueAt:string|null})=>{
      const {data,error}=await api().rpc("set_academy_course_assignment",{
        p_user:input.userId,p_track:input.trackId,p_state:input.state,
        p_required:input.required,p_due_at:input.dueAt||null
      });
      if(error)throw error;return data;
    },
    onSuccess:()=>{
      qc.invalidateQueries({queryKey:["academy-team-course-assignments",user?.id]});
      qc.invalidateQueries({queryKey:["academy-learning-plan"]});
    }
  });
  const editLesson=useMutation({
    mutationFn:async(input:{lessonId:string;objective:string;practiceEvidence:string;minutes:number;
      prerequisiteLessons:string[];references:string[];reviewed:boolean})=>{
      const {error}=await api().rpc("update_academy_lesson_standard",{
        p_lesson:input.lessonId,p_objective:input.objective,p_practice:input.practiceEvidence,
        p_minutes:input.minutes,p_prerequisites:input.prerequisiteLessons,
        p_references:input.references,p_mark_reviewed:input.reviewed
      });
      if(error)throw error;
    },
    onSuccess:()=>qc.invalidateQueries({queryKey:["academy-lesson-standards"]})
  });
  return {assign,editLesson};
}
