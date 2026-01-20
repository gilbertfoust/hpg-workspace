import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { getSupabaseNotConfiguredError, supabase } from '@/integrations/supabase/client';
import { ModuleType } from './useWorkItems';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { Database, Json } from '@/integrations/supabase/types';

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
  mapping_json: Json | null;
  version: number | null;
  is_active: boolean | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface EnsureFormTemplateInput {
  name: string;
  module: ModuleType;
  description?: string | null;
  schema_json: {
    fields: FormField[];
  };
  mapping_json?: Json | null;
  is_active?: boolean;
  version?: number | null;
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

export const useEnsureFormTemplate = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: EnsureFormTemplateInput) => {
      const { data: existing, error: existingError } = await supabase
        .from('form_templates')
        .select('*')
        .eq('name', input.name)
        .eq('module', input.module)
        .maybeSingle();

      if (existingError) throw existingError;
      if (existing) return existing as unknown as FormTemplate;

      const { data, error } = await supabase
        .from('form_templates')
        .insert({
          name: input.name,
          module: input.module,
          description: input.description ?? null,
          schema_json: input.schema_json as Json,
          mapping_json: input.mapping_json ?? {},
          is_active: input.is_active ?? true,
          version: input.version ?? 1,
          created_by_user_id: user?.id ?? null,
        })
        .select('*')
        .single();

      if (error) throw error;
      return data as unknown as FormTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-templates'] });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Unable to create template',
        description: error.message,
      });
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
