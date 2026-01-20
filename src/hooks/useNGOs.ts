import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { getSupabaseNotConfiguredError, supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

export type NGOStatus = Database['public']['Enums']['ngo_status'];
export type FiscalType = Database['public']['Enums']['fiscal_type'];
export type NGO = Database['public']['Tables']['ngos']['Row'];
export type CreateNGOInput = Database['public']['Tables']['ngos']['Insert'];
import { useAuth } from '@/contexts/AuthContext';

export type NGOStatus = 'Prospect' | 'Onboarding' | 'Active' | 'At-Risk' | 'Offboarding' | 'Closed';
export type FiscalType = 'Model A' | 'Model C' | 'Other';

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
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateNGOInput) => {
      ensureSupabase();
      const { data, error } = await supabase
        .from('ngos')
        .insert(input)
        .select()
        .single();
      
      if (error) throw error;

      const { error: auditError } = await supabase
        .from('audit_log')
        .insert({
          actor_user_id: user?.id,
          action_type: 'create',
          entity_type: 'ngo',
          entity_id: data.id,
          before_json: null,
          after_json: {
            legal_name: data.legal_name,
            status: data.status,
          },
        });

      if (auditError) {
        console.error('Failed to write audit log', auditError);
      }
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
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, ...input }: Database['public']['Tables']['ngos']['Update'] & { id: string }) => {
    mutationFn: async ({ id, ...input }: Partial<NGO> & { id: string }) => {
      const { data: beforeData } = await supabase
        .from('ngos')
        .select('*')
        .eq('id', id)
        .single();

      ensureSupabase();
      const { data, error } = await supabase
        .from('ngos')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;

      const { error: auditError } = await supabase
        .from('audit_log')
        .insert({
          actor_user_id: user?.id,
          action_type: 'update',
          entity_type: 'ngo',
          entity_id: data.id,
          before_json: beforeData
            ? { legal_name: beforeData.legal_name, status: beforeData.status, notes: beforeData.notes }
            : null,
          after_json: { legal_name: data.legal_name, status: data.status, notes: data.notes },
        });

      if (auditError) {
        console.error('Failed to write audit log', auditError);
      }
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
        active: data.filter(n => n.status === 'Active').length,
        onboarding: data.filter(n => n.status === 'Onboarding').length,
        at_risk: data.filter(n => n.status === 'At-Risk').length,
        prospect: data.filter(n => n.status === 'Prospect').length,
      };
      
      return stats;
    },
  });
};
