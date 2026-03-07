import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupabaseNotConfiguredError, supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

export type OrgUnit = Database['public']['Tables']['org_units']['Row'];
export type OrgUnitInsert = Database['public']['Tables']['org_units']['Insert'];
export type OrgUnitUpdate = Database['public']['Tables']['org_units']['Update'];

export interface OrgUnitWithLead extends OrgUnit {
  lead?: {
    id: string;
    full_name: string | null;
    email: string | null;
  } | null;
}

const ensureSupabase = () => {
  if (!supabase) {
    throw getSupabaseNotConfiguredError();
  }
};

export const useAdminConfigOrgUnits = () => {
  return useQuery({
    queryKey: ['admin-config', 'org-units'],
    queryFn: async () => {
      ensureSupabase();
      const { data, error } = await supabase
        .from('org_units')
        .select('*, lead:profiles(id, full_name, email)')
        .order('department_name', { ascending: true });

      if (error) throw error;
      return data as OrgUnitWithLead[];
    },
  });
};

export const useCreateOrgUnit = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: OrgUnitInsert) => {
      ensureSupabase();
      const { data, error } = await supabase
        .from('org_units')
        .insert(input)
        .select('*, lead:profiles(id, full_name, email)')
        .single();

      if (error) throw error;
      return data as OrgUnitWithLead;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-config', 'org-units'] });
      toast({
        title: 'Department added',
        description: 'The org unit has been created.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Unable to add department',
        description: error.message,
      });
    },
  });
};

export const useUpdateOrgUnit = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...input }: OrgUnitUpdate & { id: string }) => {
      ensureSupabase();
      const { data, error } = await supabase
        .from('org_units')
        .update(input)
        .eq('id', id)
        .select('*, lead:profiles(id, full_name, email)')
        .single();

      if (error) throw error;
      return data as OrgUnitWithLead;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-config', 'org-units'] });
      toast({
        title: 'Department updated',
        description: 'Org unit details have been saved.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Unable to update department',
        description: error.message,
      });
    },
  });
};

export const useDeleteOrgUnit = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      ensureSupabase();
      const { error } = await supabase
        .from('org_units')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-config', 'org-units'] });
      toast({
        title: 'Department removed',
        description: 'The org unit has been deleted.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Unable to delete department',
        description: error.message,
      });
    },
  });
};
