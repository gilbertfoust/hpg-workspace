/* Private Learning Academy progress. Completion is explicitly self-reported,
 * not certified training or an HR compliance finding.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { ensureSupabase } from "@/integrations/supabase/client";

export type AcademyCompletion = { lesson_id: string; completed_at: string };
export type AcademyCatalogLesson = { lesson_id: string; title: string; track_id: string; curriculum_version: number };
export type AcademyTeamMember = {
  user_id: string;
  full_name: string;
  role: string;
  department_id: string | null;
  completed_count: number;
  completed_lessons: string[];
  last_completed_at: string | null;
};

const api = () => ensureSupabase() as any;
const key = (userId?: string) => ["academy-progress", userId];

export function useAcademyProgress() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: key(user?.id) });
  const progress = useQuery<AcademyCompletion[]>({
    queryKey: key(user?.id),
    enabled: !!user?.id,
    retry: false,
    queryFn: async () => {
      const { data, error } = await api().from("academy_lesson_progress")
        .select("lesson_id,completed_at").order("completed_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });
  const mark = useMutation({
    mutationFn: async (lessonId: string) => {
      const { error } = await api().from("academy_lesson_progress")
        .insert({ lesson_id: lessonId });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
  const undo = useMutation({
    mutationFn: async (lessonId: string) => {
      const { error } = await api().from("academy_lesson_progress")
        .delete().eq("lesson_id", lessonId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
  const importLegacy = useMutation({
    mutationFn: async (lessonIds: string[]) => {
      const known = new Set((progress.data || []).map(x => x.lesson_id));
      const pending = Array.from(new Set(lessonIds)).filter(x => !known.has(x));
      if (pending.length === 0) return 0;
      const { error } = await api().from("academy_lesson_progress")
        .insert(pending.map(lesson_id => ({ lesson_id })));
      if (error) throw error;
      return pending.length;
    },
    onSuccess: invalidate,
  });
  return { progress, mark, undo, importLegacy };
}

export function useAcademyTeamProgress(enabled = true) {
  const { user } = useAuth();
  return useQuery<AcademyTeamMember[]>({
    queryKey: ["academy-team-progress", user?.id],
    enabled: !!user?.id && enabled,
    retry: false,
    queryFn: async () => {
      const { data, error } = await api().rpc("get_academy_team_progress");
      if (error) throw error;
      return data || [];
    },
  });
}

export function useAcademyCatalog() {
  const { user } = useAuth();
  return useQuery<AcademyCatalogLesson[]>({
    queryKey: ["academy-lesson-catalog"],
    enabled: !!user?.id,
    retry: false,
    queryFn: async () => {
      const { data, error } = await api().from("academy_lessons")
        .select("lesson_id,title,track_id,curriculum_version")
        .order("track_id").order("title");
      if (error) throw error;
      return data || [];
    },
  });
}
