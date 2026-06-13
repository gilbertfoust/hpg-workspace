import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import type { FormField, FormTemplate } from "@/hooks/useFormTemplates";
import type { Json } from "@/integrations/supabase/types";

const ensureSupabase = () => {
  if (!supabase) throw getSupabaseNotConfiguredError();
  return supabase;
};

export interface NgoPortalSubmissionInput {
  formTemplate: FormTemplate;
  ngoId: string;
  payloadJson: Record<string, unknown>;
}

export const useNgoPortalFormTemplates = () => {
  return useQuery<FormTemplate[]>({
    queryKey: ["ngo-portal-form-templates"],
    enabled: !!supabase,
    queryFn: async () => {
      const client = ensureSupabase();
      const { data, error } = await client
        .from("form_templates")
        .select("*")
        .eq("is_active", true)
        .eq("form_audience" as never, "ngo_portal" as never)
        .order("name", { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as FormTemplate[];
    },
  });
};

export const useSubmitNgoPortalForm = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ formTemplate, ngoId, payloadJson }: NgoPortalSubmissionInput) => {
      const client = ensureSupabase();
      if (!user?.id) throw new Error("You must be logged in to submit an NGO request.");

      const titleField = ((formTemplate.mapping_json as Record<string, unknown> | null)?.titleField as string | undefined) || "summary";
      const summary = String(payloadJson[titleField] || payloadJson.summary || formTemplate.name);

      const { data: submission, error: submissionError } = await client
        .from("form_submissions")
        .insert({
          form_template_id: formTemplate.id,
          ngo_id: ngoId,
          submitted_by_user_id: user.id,
          payload_json: payloadJson as Json,
          submission_status: "submitted",
          submitted_at: new Date().toISOString(),
          intake_status: "new",
        } as never)
        .select("*")
        .single();

      if (submissionError) throw submissionError;

      const { data: workItem, error: workItemError } = await client
        .from("work_items")
        .insert({
          title: `NGO Request: ${summary}`,
          description: `Submitted from NGO Portal form: ${formTemplate.name}`,
          module: "ngo_coordination",
          ngo_id: ngoId,
          status: "submitted",
          priority: "medium",
          type: "ngo_portal_request",
          external_visible: true,
          created_by_user_id: user.id,
        } as never)
        .select("id")
        .single();

      if (workItemError) throw workItemError;

      await client
        .from("form_submissions")
        .update({ work_item_id: (workItem as { id: string }).id } as never)
        .eq("id" as never, (submission as { id: string }).id as never);

      return submission;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-form-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["portal-work-items"] });
      toast({ title: "Request submitted", description: "Your request was sent to NGO Coordination for routing." });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Unable to submit request", description: error.message });
    },
  });
};

export const emptyPayloadForFields = (fields: FormField[]) =>
  fields.reduce<Record<string, string>>((acc, field) => {
    acc[field.name] = "";
    return acc;
  }, {});
