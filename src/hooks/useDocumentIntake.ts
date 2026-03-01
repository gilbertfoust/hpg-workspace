import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface IntakeSubmission {
  id: string;
  ngo_id: string;
  type: string;
  status: string;
  file_path: string | null;
  file_name: string | null;
  submitted_by_user_id: string | null;
  extracted_data_json: Record<string, unknown>;
  reviewer_user_id: string | null;
  reviewer_notes: string | null;
  fiscal_period_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useDocumentIntake(ngoId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["document_intake_submissions", ngoId],
    queryFn: async () => {
      let q = supabase
        .from("document_intake_submissions" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (ngoId) q = q.eq("ngo_id", ngoId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as IntakeSubmission[];
    },
  });

  const create = useMutation({
    mutationFn: async (
      sub: Omit<IntakeSubmission, "id" | "created_at" | "updated_at" | "extracted_data_json">
    ) => {
      const { data, error } = await supabase
        .from("document_intake_submissions" as any)
        .insert(sub as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as IntakeSubmission;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["document_intake_submissions"] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<IntakeSubmission> & { id: string }) => {
      const { data, error } = await supabase
        .from("document_intake_submissions" as any)
        .update(updates as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as IntakeSubmission;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["document_intake_submissions"] }),
  });

  return { ...query, create, update };
}
