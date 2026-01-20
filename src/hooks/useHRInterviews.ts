import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { Json } from "@/integrations/supabase/types";

export type InterviewRecommendation = "Strong yes" | "Yes" | "No" | "Strong no";

export interface Interview {
  id: string;
  applicant_id: string;
  interviewer_user_id: string | null;
  interview_date: string;
  recommendation: InterviewRecommendation | null;
  notes: string | null;
  rubric_scores: Json | null;
  created_at: string;
}

export interface CreateInterviewInput {
  applicant_id: string;
  interviewer_user_id?: string | null;
  interview_date: string;
  recommendation?: InterviewRecommendation | null;
  notes?: string | null;
  rubric_scores?: Json | null;
}

const interviewsTable = "interviews";

const createAuditEntry = async (entry: {
  action_type: string;
  entity_id?: string | null;
  before_json?: Json | null;
  after_json?: Json | null;
  actor_user_id?: string | null;
  reason?: string | null;
}) => {
  const { error } = await supabase.from("audit_log").insert({
    action_type: entry.action_type,
    entity_type: "interview",
    entity_id: entry.entity_id ?? null,
    before_json: entry.before_json ?? null,
    after_json: entry.after_json ?? null,
    actor_user_id: entry.actor_user_id ?? null,
    reason: entry.reason ?? null,
  });

  if (error) throw error;
};

export const useHRInterviews = (applicantId?: string) => {
  return useQuery({
    queryKey: ["hr", "interviews", applicantId],
    queryFn: async () => {
      let query = supabase
        .from(interviewsTable)
        .select("*")
        .order("interview_date", { ascending: false });

      if (applicantId) {
        query = query.eq("applicant_id", applicantId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Interview[];
    },
  });
};

export const useCreateHRInterview = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateInterviewInput) => {
      const { data, error } = await supabase
        .from(interviewsTable)
        .insert({
          applicant_id: input.applicant_id,
          interviewer_user_id: input.interviewer_user_id ?? null,
          interview_date: input.interview_date,
          recommendation: input.recommendation ?? null,
          notes: input.notes ?? null,
          rubric_scores: input.rubric_scores ?? null,
        })
        .select("*")
        .single();

      if (error) throw error;

      await createAuditEntry({
        action_type: "created",
        entity_id: data.id,
        after_json: data as Json,
        actor_user_id: user?.id ?? null,
      });

      return data as Interview;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr", "interviews"] });
      toast({
        title: "Interview added",
        description: "The interview has been logged.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error adding interview",
        description: error.message,
      });
    },
  });
};
