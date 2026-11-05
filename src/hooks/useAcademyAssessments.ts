/* Academy knowledge checks and supervisor endorsements.
 * Question answer keys never enter the client; only graded results are returned.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { ensureSupabase } from "@/integrations/supabase/client";

export type AssessmentCatalogItem = { assessment_id: string; track_id: string; title: string; passing_percent: number; is_active: boolean };
export type Question = { id: string; prompt: string; options: string[] };
export type AssessmentPaper = { id: string; title: string; track_id: string; passing_percent: number; questions: Question[] };
export type AssessmentResult = { id: string; score: number; total: number; percent: number; passed: boolean; submitted_at: string };
export type AssessmentAttempt = { id: string; assessment_id: string; score: number; total: number; passed: boolean; submitted_at: string };
export type SupervisorAssessment = {
  user_id: string; assessment_id: string; assessment_title: string; attempt_id: string;
  score: number; total: number; passed: boolean; submitted_at: string;
  signoff_decision: string | null; signoff_note: string | null;
  signoff_at: string | null; supervisor_name: string | null;
};
const api = () => ensureSupabase() as any;

export function useAcademyAssessments() {
  const { user } = useAuth();
  return useQuery<AssessmentCatalogItem[]>({
    queryKey: ["academy-assessments-catalog"],
    enabled: !!user?.id, retry: false,
    queryFn: async () => {
      const { data,error } = await api().from("academy_assessments")
        .select("assessment_id,track_id,title,passing_percent,is_active")
        .eq("is_active",true).order("track_id");
      if (error) throw error;
      return data || [];
    },
  });
}

export function useAssessmentPaper(id?: string) {
  const { user } = useAuth();
  return useQuery<AssessmentPaper>({
    queryKey: ["academy-assessment-paper",user?.id,id],
    enabled: !!user?.id && !!id, retry: false,
    queryFn: async () => {
      const { data,error } = await api().rpc("get_academy_assessment",{p_assessment:id});
      if (error) throw error;
      return data as AssessmentPaper;
    },
  });
}

export function useAssessmentAttempts() {
  const { user } = useAuth();
  return useQuery<AssessmentAttempt[]>({
    queryKey: ["academy-assessment-attempts",user?.id],
    enabled: !!user?.id, retry: false,
    queryFn: async () => {
      const { data,error } = await api().from("academy_assessment_attempts")
        .select("id,assessment_id,score,total,passed,submitted_at")
        .order("submitted_at",{ascending:false}).limit(100);
      if(error)throw error;
      return data||[];
    },
  });
}

export function useSubmitAssessment() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id,answers }:{ id:string;answers:Record<string,number> }):Promise<AssessmentResult> => {
      const { data,error } = await api().rpc("submit_academy_assessment",{
        p_assessment:id,p_answers:answers,
      });
      if(error)throw error;
      return data as AssessmentResult;
    },
    onSuccess: () => qc.invalidateQueries({queryKey:["academy-assessment-attempts",user?.id]}),
  });
}

export function useAcademySupervisorAssessments() {
  const { user } = useAuth();
  return useQuery<SupervisorAssessment[]>({
    queryKey: ["academy-supervisor-assessments",user?.id],
    enabled:!!user?.id,retry:false,
    queryFn:async()=>{
      const {data,error}=await api().rpc("get_academy_assessment_team");
      if(error)throw error;
      return data||[];
    }
  });
}

export function useSignoffAssessment() {
  const { user }=useAuth();
  const qc=useQueryClient();
  return useMutation({
    mutationFn:async({userId,assessmentId,decision,note}:{
      userId:string;assessmentId:string;decision:"endorsed"|"needs_practice";note:string
    })=>{
      const {data,error}=await api().rpc("signoff_academy_assessment",{
        p_user_id:userId,p_assessment:assessmentId,p_decision:decision,p_note:note
      });
      if(error)throw error;
      return data;
    },
    onSuccess:()=>qc.invalidateQueries({queryKey:["academy-supervisor-assessments",user?.id]})
  });
}
