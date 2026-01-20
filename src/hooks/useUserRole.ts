import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupabaseNotConfiguredError, supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

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

const ensureSupabase = () => {
  if (!supabase) {
    throw getSupabaseNotConfiguredError();
  }
};

export const useUserRole = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-role', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      ensureSupabase();
      
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

export const useUserRoles = () => {
  return useQuery({
    queryKey: ['user-roles'],
    queryFn: async () => {
      ensureSupabase();
      const { data, error } = await supabase
        .from('user_roles')
        .select('*');

      if (error) throw error;
      return data as UserRole[];
    },
  });
};

export const useUpdateUserRole = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      ensureSupabase();
      const { data, error } = await supabase
        .from('user_roles')
        .upsert({ user_id: userId, role }, { onConflict: 'user_id' })
        .select()
        .single();

      if (error) throw error;
      return data as UserRole;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-role'] });
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
      toast({
        title: 'Role updated',
        description: 'The user role has been updated.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Unable to update role',
        description: error.message,
      });
    },
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

export const useIsAdminUser = () => {
  const { data: role } = useUserRole();

  if (!role) return false;

  const adminRoles: AppRole[] = ['super_admin', 'admin_pm'];
  return adminRoles.includes(role.role);
};

export const useIsSuperAdmin = () => {
  const { data: role } = useUserRole();
  return role?.role === 'super_admin';
};
