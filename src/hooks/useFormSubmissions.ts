import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Json } from '@/integrations/supabase/types';

export interface FormSubmission {
  id: string;
  form_template_id: string;
  ngo_id: string | null;
  work_item_id: string | null;
  submitted_by_user_id: string | null;
  payload_json: Json;
  submission_status: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  form_template?: {
    name: string;
    module: string;
  };
}

export interface CreateFormSubmissionInput {
  form_template_id: string;
  ngo_id?: string;
  work_item_id?: string;
  submitted_by_user_id?: string;
  payload_json?: Json;
  submission_status?: string;
}

export const useFormSubmissions = (filters?: { ngo_id?: string; form_template_id?: string }) => {
  return useQuery({
    queryKey: ['form-submissions', filters],
    queryFn: async () => {
      let query = supabase
        .from('form_submissions')
        .select(`
          *,
          form_template:form_templates!form_submissions_form_template_id_fkey(name, module)
        `);
      
      if (filters?.ngo_id) {
        query = query.eq('ngo_id', filters.ngo_id);
      }
      if (filters?.form_template_id) {
        query = query.eq('form_template_id', filters.form_template_id);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as FormSubmission[];
    },
  });
};

export const useFormSubmission = (id: string) => {
  return useQuery({
    queryKey: ['form-submissions', 'detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('form_submissions')
        .select(`
          *,
          form_template:form_templates!form_submissions_form_template_id_fkey(name, module, schema_json)
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as FormSubmission;
    },
    enabled: !!id,
  });
};

export const useCreateFormSubmission = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: CreateFormSubmissionInput) => {
      const { data, error } = await supabase
        .from('form_submissions')
        .insert(input)
        .select()
        .single();
      
      if (error) throw error;
      return data as FormSubmission;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-submissions'] });
      toast({
        title: 'Form saved',
        description: 'Your form has been saved.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Error saving form',
        description: error.message,
      });
    },
  });
};

export const useUpdateFormSubmission = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<FormSubmission> & { id: string }) => {
      const { data, error } = await supabase
        .from('form_submissions')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as FormSubmission;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-submissions'] });
      toast({
        title: 'Form updated',
        description: 'Your form has been updated.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Error updating form',
        description: error.message,
      });
    },
  });
};
