/* Language-aware Academy instruction. Independent review is required before
 * a translated lesson replaces the authored English lesson for learners.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { ensureSupabase } from "@/integrations/supabase/client";
const api=()=>ensureSupabase() as any;
export type AcademyLanguage = "en"|"fr"|"es"|"pt";
export type LessonTranslation={
  lesson_id:string;language_code:"fr"|"es"|"pt";
  translated_title:string;translated_objective:string;
  translated_steps:string[];translated_practice:string;
  status:"draft"|"reviewed"|"withdrawn";
  version:number;authored_by:string|null;reviewed_by:string|null;
  reviewed_at:string|null;
};
export function useAcademyLessonTranslations(lessonId?:string){
  const {user}=useAuth();
  return useQuery<LessonTranslation[]>({
    queryKey:["academy-lesson-translations",user?.id,lessonId],
    enabled:!!user?.id&&!!lessonId,retry:false,
    queryFn:async()=>{
      const {data,error}=await api().from("academy_lesson_translations")
        .select("lesson_id,language_code,translated_title,translated_objective,translated_steps,translated_practice,status,version,authored_by,reviewed_by,reviewed_at")
        .eq("lesson_id",lessonId);
      if(error)throw error;return data||[];
    }
  });
}
export function useAcademyTranslationAdministration(lessonId?:string){
  const {user}=useAuth();const qc=useQueryClient();
  const refresh=()=>qc.invalidateQueries({queryKey:["academy-lesson-translations",user?.id,lessonId]});
  const save=useMutation({
    mutationFn:async(input:{
      language:"fr"|"es"|"pt";title:string;objective:string;steps:string[];practice:string
    })=>{
      if(!lessonId)throw Error("Choose an authored lesson.");
      const {data,error}=await api().rpc("save_academy_lesson_translation",{
        p_lesson:lessonId,p_language:input.language,
        p_title:input.title,p_objective:input.objective,
        p_steps:input.steps,p_practice:input.practice
      });
      if(error)throw error;return data;
    },
    onSuccess:refresh
  });
  const review=useMutation({
    mutationFn:async(input:{language:"fr"|"es"|"pt";action:"publish"|"withdraw"})=>{
      if(!lessonId)throw Error("Choose a lesson.");
      const {data,error}=await api().rpc("review_academy_lesson_translation",{
        p_lesson:lessonId,p_language:input.language,p_action:input.action
      });
      if(error)throw error;return data;
    },
    onSuccess:refresh
  });
  return {save,review};
}
