import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { FormTemplate } from "@/hooks/useFormTemplates";

const ensureSupabase = () => {
  if (!supabase) throw getSupabaseNotConfiguredError();
  return supabase;
};

export interface FormAssignment {
  id: string;
  form_template_id: string;
  ngo_id: string | null;
  assigned_to_user_id: string | null;
  department_id: string | null;
  assigned_by_user_id: string;
  instructions: string | null;
  due_at: string | null;
  status: 'assigned' | 'in_progress' | 'submitted' | 'accepted' | 'needs_revision' | 'waived' | 'cancelled';
  submission_id: string | null;
  external_visible: boolean;
  created_at: string;
  updated_at: string;
  form_template?: FormTemplate;
  submission?: {
    id: string;
    ngo_id: string | null;
    payload_json: unknown;
    submission_status: string | null;
  } | null;
}

export const useFormAssignments = (filters?: { ngoId?: string; assignedToUserId?: string }) => {
  return useQuery({
    queryKey: ['form-assignments', filters],
    queryFn: async () => {
      const client = ensureSupabase();
      let query = client
        .from('form_assignments' as never)
        .select('*, form_template:form_templates(*), submission:form_submissions(id, ngo_id, payload_json, submission_status)' as never)
        .order('due_at' as never, { ascending: true, nullsFirst: false });
      if (filters?.ngoId) query = query.eq('ngo_id' as never, filters.ngoId as never);
      if (filters?.assignedToUserId) query = query.eq('assigned_to_user_id' as never, filters.assignedToUserId as never);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as FormAssignment[];
    },
  });
};

export const useCreateFormAssignment = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      formTemplateId: string;
      ngoId?: string | null;
      assignedToUserId?: string | null;
      departmentId?: string | null;
      instructions?: string | null;
      dueAt?: string | null;
      externalVisible?: boolean;
    }) => {
      const client = ensureSupabase();
      if (!user?.id) throw new Error('Authentication required');
      const { data, error } = await client
        .from('form_assignments' as never)
        .insert({
          form_template_id: input.formTemplateId,
          ngo_id: input.ngoId || null,
          assigned_to_user_id: input.assignedToUserId || null,
          department_id: input.departmentId || null,
          assigned_by_user_id: user.id,
          instructions: input.instructions?.trim() || null,
          due_at: input.dueAt || null,
          external_visible: input.externalVisible ?? true,
        } as never)
        .select('*' as never)
        .single();
      if (error) throw error;
      return data as unknown as FormAssignment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-assignments'] });
      toast({ title: 'Form assigned', description: 'The assignment now appears on the NGO record and in its portal.' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Unable to assign form', description: error.message });
    },
  });
};
