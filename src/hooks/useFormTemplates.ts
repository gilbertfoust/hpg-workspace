import { useQuery } from '@tanstack/react-query';
import { getSupabaseNotConfiguredError, supabase } from '@/integrations/supabase/client';
import { ModuleType } from './useWorkItems';

export interface FormField {
  name: string;
  type: 'text' | 'textarea' | 'email' | 'tel' | 'url' | 'number' | 'date' | 'select' | 'multiselect' | 'checkbox';
  label: string;
  required?: boolean;
  options?: string[];
}

export interface FormTemplate {
  id: string;
  module: ModuleType;
  name: string;
  description: string | null;
  schema_json: {
    fields: FormField[];
  };
  mapping_json: Record<string, unknown>;
  version: number;
  is_active: boolean;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

const ensureSupabase = () => {
  if (!supabase) {
    throw getSupabaseNotConfiguredError();
  }
};

export const useFormTemplates = (module?: ModuleType) => {
  return useQuery({
    queryKey: ['form-templates', module],
    queryFn: async () => {
      ensureSupabase();
      let query = supabase
        .from('form_templates')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });
      
      if (module) {
        query = query.eq('module', module);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as unknown as FormTemplate[];
    },
  });
};

export const useFormTemplate = (id: string) => {
  return useQuery({
    queryKey: ['form-templates', id],
    queryFn: async () => {
      ensureSupabase();
      const { data, error } = await supabase
        .from('form_templates')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as unknown as FormTemplate;
    },
    enabled: !!id,
  });
};
