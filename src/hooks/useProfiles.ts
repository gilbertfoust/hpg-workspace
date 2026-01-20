import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupabaseNotConfiguredError, supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  department_id: string | null;
  created_at: string;
  updated_at: string;
}

const ensureSupabase = () => {
  if (!supabase) {
    throw getSupabaseNotConfiguredError();
  }
};

export const useProfiles = () => {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      ensureSupabase();
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name', { ascending: true });
      
      if (error) throw error;
      return data as Profile[];
    },
  });
};

export const useProfile = (id: string) => {
  return useQuery({
    queryKey: ['profiles', id],
    queryFn: async () => {
      ensureSupabase();
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as Profile;
    },
    enabled: !!id,
  });
};

export const useInternalUsers = () => {
  return useQuery({
    queryKey: ['internal-users'],
    queryFn: async () => {
      ensureSupabase();
      // Get profiles that have internal roles
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .not('role', 'eq', 'external_ngo');
      
      if (rolesError) throw rolesError;
      
      if (!userRoles || userRoles.length === 0) return [];
      
      const userIds = [...new Set(userRoles.map(ur => ur.user_id))];
      
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);
      
      if (profilesError) throw profilesError;
      
      // Attach roles to profiles
      return (profiles || []).map(profile => ({
        ...profile,
        roles: userRoles.filter(ur => ur.user_id === profile.id).map(ur => ur.role),
      }));
    },
  });
};

export const useUpdateProfileDepartment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, departmentId }: { id: string; departmentId: string | null }) => {
      ensureSupabase();
      const { data, error } = await supabase
        .from('profiles')
        .update({ department_id: departmentId })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Profile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      toast({
        title: 'Department updated',
        description: 'The department assignment has been updated.',
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
