import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type AppRole = 
  | 'super_admin'
  | 'admin_pm'
  | 'ngo_coordinator'
  | 'department_lead'
  | 'staff_member'
  | 'executive_secretariat'
  | 'external_ngo';

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export const useUserRole = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-role', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as UserRole | null;
    },
    enabled: !!user?.id,
  });
};

export const useIsInternalUser = () => {
  const { data: role } = useUserRole();
  
  if (!role) return false;
  
  const internalRoles: AppRole[] = [
    'super_admin',
    'admin_pm',
    'ngo_coordinator',
    'department_lead',
    'staff_member',
    'executive_secretariat',
  ];
  
  return internalRoles.includes(role.role);
};

export const useIsManagement = () => {
  const { data: role } = useUserRole();
  
  if (!role) return false;
  
  const managementRoles: AppRole[] = ['super_admin', 'admin_pm', 'executive_secretariat'];
  
  return managementRoles.includes(role.role);
};

export const useIsSuperAdmin = () => {
  const { data: role } = useUserRole();
  return role?.role === 'super_admin';
};
