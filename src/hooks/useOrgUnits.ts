import { useQuery } from '@tanstack/react-query';
import { getSupabaseNotConfiguredError, supabase } from '@/integrations/supabase/client';

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
