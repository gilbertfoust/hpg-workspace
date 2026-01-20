import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseNotConfiguredError, supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

export type NGOStatus = Database['public']['Enums']['ngo_status'];
export type FiscalType = Database['public']['Enums']['fiscal_type'];
export type NGO = Database['public']['Tables']['ngos']['Row'];
export type CreateNGOInput = Database['public']['Tables']['ngos']['Insert'];

const ensureSupabase = () => {
  if (!supabase) {
    throw getSupabaseNotConfiguredError();
  }
};

export const useNGOs = () => {
  return useQuery({
    queryKey: ['ngos'],
    queryFn: async () => {
      ensureSupabase();
      const { data, error } = await supabase
        .from('ngos')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as NGO[];
    },
  });
};

export const useNGO = (id: string) => {
  return useQuery({
    queryKey: ['ngos', id],
    queryFn: async () => {
      ensureSupabase();
      const { data, error } = await supabase
        .from('ngos')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) throw new Error('NGO not found');
      return data as NGO;
    },
    enabled: !!id,
  });
};

export const useCreateNGO = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: CreateNGOInput) => {
      ensureSupabase();
      const { data, error } = await supabase
        .from('ngos')
        .insert(input)
        .select()
        .single();
      
      if (error) throw error;
      return data as NGO;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ngos'] });
      toast({
        title: 'NGO created',
        description: 'The NGO has been successfully created.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Error creating NGO',
        description: error.message,
      });
    },
  });
};

export const useUpdateNGO = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...input }: Database['public']['Tables']['ngos']['Update'] & { id: string }) => {
    mutationFn: async ({ id, ...input }: Partial<NGO> & { id: string }) => {
      ensureSupabase();
      const { data, error } = await supabase
        .from('ngos')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as NGO;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ngos'] });
      queryClient.invalidateQueries({ queryKey: ['ngos', data.id] });
      toast({
        title: 'NGO updated',
        description: 'The NGO has been successfully updated.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Error updating NGO',
        description: error.message,
      });
    },
  });
};

export const useNGOStats = () => {
  return useQuery({
    queryKey: ['ngo-stats'],
    queryFn: async () => {
      ensureSupabase();
      const { data, error } = await supabase
        .from('ngos')
        .select('status');
      
      if (error) throw error;
      
      const stats = {
        total: data.length,
        active: data.filter(n => n.status === 'active').length,
        onboarding: data.filter(n => n.status === 'onboarding').length,
        at_risk: data.filter(n => n.status === 'at_risk').length,
        prospect: data.filter(n => n.status === 'prospect').length,
      };
      
      return stats;
    },
  });
};
