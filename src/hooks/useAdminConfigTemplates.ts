import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupabaseNotConfiguredError, supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database, Json } from '@/integrations/supabase/types';

export type FormTemplateRow = Database['public']['Tables']['form_templates']['Row'];
export type TemplateGroupRow = Database['public']['Tables']['template_groups']['Row'];

const ensureSupabase = () => {
  if (!supabase) {
    throw getSupabaseNotConfiguredError();
  }
};

const normalizeTemplateIds = (value: Json | null): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item;
        if (typeof item === 'object' && item && 'id' in item && typeof item.id === 'string') {
          return item.id;
        }
        return null;
      })
      .filter((id): id is string => Boolean(id));
  }

  if (typeof value === 'object' && value && 'template_ids' in value) {
    const templateIds = (value as { template_ids?: Json }).template_ids;
    return Array.isArray(templateIds)
      ? templateIds.filter((id): id is string => typeof id === 'string')
      : [];
  }

  return [];
};

export const useAdminConfigTemplates = () => {
  return useQuery({
    queryKey: ['admin-config', 'form-templates'],
    queryFn: async () => {
      ensureSupabase();
      const { data, error } = await supabase
        .from('form_templates')
        .select('id, name, module, description, version, is_active')
        .order('name', { ascending: true });

      if (error) throw error;
      return data as FormTemplateRow[];
    },
  });
};

export const useAdminConfigTemplateGroups = () => {
  return useQuery({
    queryKey: ['admin-config', 'template-groups'],
    queryFn: async () => {
      ensureSupabase();
      const { data, error } = await supabase
        .from('template_groups')
        .select('id, name, description, category, is_active, work_item_templates')
        .order('name', { ascending: true });

      if (error) throw error;
      return data as TemplateGroupRow[];
    },
  });
};

export const useUpdateTemplateMetadata = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<FormTemplateRow> & { id: string }) => {
      ensureSupabase();
      const { data, error } = await supabase
        .from('form_templates')
        .update(input)
        .eq('id', id)
        .select('id')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-config', 'form-templates'] });
      toast({
        title: 'Template updated',
        description: 'Template metadata has been saved.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Unable to update template',
        description: error.message,
      });
    },
  });
};

export const useUpdateTemplateGroupAssignment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: { templateId: string; groupId: string | null }) => {
      ensureSupabase();
      const groups = queryClient.getQueryData<TemplateGroupRow[]>([
        'admin-config',
        'template-groups',
      ]);

      if (!groups) {
        throw new Error('Template groups are not loaded yet.');
      }

      const updates = groups
        .map((group) => {
          const templateIds = normalizeTemplateIds(group.work_item_templates);
          const hasTemplate = templateIds.includes(input.templateId);
          const shouldHaveTemplate = input.groupId === group.id;

          if (hasTemplate === shouldHaveTemplate) {
            return null;
          }

          const nextTemplateIds = shouldHaveTemplate
            ? Array.from(new Set([...templateIds, input.templateId]))
            : templateIds.filter((id) => id !== input.templateId);

          return {
            id: group.id,
            work_item_templates: nextTemplateIds,
          };
        })
        .filter((update): update is { id: string; work_item_templates: Json } => Boolean(update));

      for (const update of updates) {
        const { error } = await supabase
          .from('template_groups')
          .update({ work_item_templates: update.work_item_templates })
          .eq('id', update.id);

        if (error) throw error;
      }

      return input;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-config', 'template-groups'] });
      toast({
        title: 'Template group updated',
        description: 'Template assignment has been saved.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Unable to update template group',
        description: error.message,
      });
    },
  });
};

export const getTemplateGroupName = (
  templateId: string,
  groups: TemplateGroupRow[]
): string | null => {
  for (const group of groups) {
    const templateIds = normalizeTemplateIds(group.work_item_templates);
    if (templateIds.includes(templateId)) return group.name;
  }
  return null;
};

export const getTemplateGroupId = (
  templateId: string,
  groups: TemplateGroupRow[]
): string | null => {
  for (const group of groups) {
    const templateIds = normalizeTemplateIds(group.work_item_templates);
    if (templateIds.includes(templateId)) return group.id;
  }
  return null;
};
