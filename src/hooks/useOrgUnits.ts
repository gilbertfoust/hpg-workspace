import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupabaseNotConfiguredError, supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface OrgUnit {
  id: string;
  department_name: string;
  sub_department_name: string | null;
  lead_user_id: string | null;
  created_at: string;
  updated_at: string;
}

const ensureSupabase = () => {
  if (!supabase) {
    throw getSupabaseNotConfiguredError();
  }
};

export const useOrgUnits = () => {
  return useQuery({
    queryKey: ['org-units'],
    queryFn: async () => {
      ensureSupabase();
      const { data, error } = await supabase
        .from('org_units')
        .select('*')
        .order('department_name', { ascending: true });
      
      if (error) throw error;
      return data as OrgUnit[];
    },
  });
};

export const useDepartments = () => {
  const { data: orgUnits, ...rest } = useOrgUnits();
  
  // Group by department_name and return unique departments
  const departments = orgUnits
    ? [...new Set(orgUnits.map(ou => ou.department_name))]
    : [];
  
  return { data: departments, ...rest };
};

export const useUpdateOrgUnit = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<OrgUnit> & { id: string }) => {
      ensureSupabase();
      const { data, error } = await supabase
        .from('org_units')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as OrgUnit;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-units'] });
      toast({
        title: 'Department updated',
        description: 'The department details have been saved.',
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

export const useCreateOrgUnit = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: Pick<OrgUnit, 'department_name' | 'sub_department_name' | 'lead_user_id'>) => {
      ensureSupabase();
      const { data, error } = await supabase
        .from('org_units')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data as OrgUnit;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-units'] });
      toast({
        title: 'Sub-department added',
        description: 'The new sub-department has been created.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Unable to add sub-department',
        description: error.message,
      });
    },
  });
};
