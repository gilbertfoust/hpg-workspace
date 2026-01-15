import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type NGOStatus = 'prospect' | 'onboarding' | 'active' | 'at_risk' | 'offboarding' | 'closed';
export type FiscalType = 'model_a' | 'model_c' | 'other';

export interface NGO {
  id: string;
  legal_name: string;
  common_name: string | null;
  bundle: string | null;
  country: string | null;
  state_province: string | null;
  city: string | null;
  website: string | null;
  fiscal_type: FiscalType;
  status: NGOStatus;
  primary_contact_id: string | null;
  ngo_coordinator_user_id: string | null;
  admin_pm_user_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateNGOInput {
  legal_name: string;
  common_name?: string;
  bundle?: string;
  country?: string;
  state_province?: string;
  city?: string;
  website?: string;
  fiscal_type?: FiscalType;
  status?: NGOStatus;
  notes?: string;
}

export const useNGOs = () => {
  return useQuery({
    queryKey: ['ngos'],
    queryFn: async () => {
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
      const { data, error } = await supabase
        .from('ngos')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
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
    mutationFn: async ({ id, ...input }: Partial<NGO> & { id: string }) => {
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
