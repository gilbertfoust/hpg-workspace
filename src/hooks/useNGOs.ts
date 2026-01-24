import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";


export type NGOStatus = 'Prospect' | 'Onboarding' | 'Active' | 'At-Risk' | 'Offboarding' | 'Closed';
// DB-safe enum values that match Supabase fiscal_type enum exactly
export type DbFiscalType = 'model_a' | 'model_c' | 'other' | 'HPG Internal Project';

// UI-friendly fiscal type labels
export type UIFiscalType = 'Model A' | 'Model C' | 'Other' | 'HPG Internal Project';

/**
 * Normalizes UI fiscal type values ("Model C") to DB enum values ("model_c")
 * Handles both UI labels and already-normalized DB values
 */
export function toDbFiscalType(value: string | UIFiscalType | DbFiscalType | null | undefined): DbFiscalType | undefined {
  if (!value) return undefined;
  
  const normalized = String(value).trim();
  
  // Handle UI labels
  if (normalized === 'Model A') return 'model_a';
  if (normalized === 'Model C') return 'model_c';
  if (normalized === 'Other') return 'other';
  if (normalized === 'HPG Internal Project') return 'HPG Internal Project';
  
  // Handle already-normalized DB values (pass through)
  if (normalized === 'model_a' || normalized === 'model_c' || normalized === 'other' || normalized === 'HPG Internal Project') {
    return normalized as DbFiscalType;
  }
  
  // Fallback: try to normalize by lowercasing and replacing spaces with underscores
  // but preserve "HPG Internal Project" exactly
  if (normalized.toLowerCase().includes('hpg internal')) {
    return 'HPG Internal Project';
  }
  
  const dbValue = normalized.toLowerCase().replace(/\s+/g, '_');
  if (dbValue === 'model_a' || dbValue === 'model_c' || dbValue === 'other') {
    return dbValue as DbFiscalType;
  }
  
  // If we can't normalize, return undefined to let Supabase handle the error
  return undefined;
}

export interface NGO {
  id: string;
  legal_name: string;
  common_name: string | null;
  bundle: string | null;
  country: string | null;
  state_province: string | null;
  city: string | null;
  website: string | null;
  fiscal_type: DbFiscalType;
  status: NGOStatus;
  primary_contact_id: string | null;
  ngo_coordinator_user_id: string | null;
  admin_pm_user_id: string | null;
  notes: string | null;
  confluence_url?: string | null;
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
  fiscal_type?: DbFiscalType | UIFiscalType; // Accept both UI and DB values
  status?: NGOStatus;
  notes?: string;
  confluence_url?: string | null;
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
        .from('ngos' as never)
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
      
      // Normalize fiscal_type from UI values to DB enum values
      const normalizedInput = {
        ...input,
        fiscal_type: input.fiscal_type ? toDbFiscalType(input.fiscal_type) : undefined,
      };
      
      const { data, error } = await supabase
        .from('ngos' as never)
        .insert(normalizedInput)
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
        .from('ngos' as never)
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
