import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface PolicyRecord {
  id: string;
  policy_name: string;
  category: string;
  owner_name: string | null;
  description: string | null;
  document_path: string | null;
  status: string;
  last_review_date: string | null;
  next_review_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const usePolicyRegistry = () => {
  return useQuery({
    queryKey: ['policy-registry'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('policy_registry')
        .select('*')
        .order('category', { ascending: true })
        .order('policy_name', { ascending: true });
      if (error) throw error;
      return data as unknown as PolicyRecord[];
    },
  });
};

export const useCreatePolicy = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: Omit<PolicyRecord, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('policy_registry')
        .insert(input as any)
        .select('*')
        .single();
      if (error) throw error;
      return data as unknown as PolicyRecord;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['policy-registry'] });
      toast({ title: 'Policy created' });
    },
    onError: (e: Error) => {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    },
  });
};

export const useUpdatePolicy = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PolicyRecord> & { id: string }) => {
      const { data, error } = await supabase
        .from('policy_registry')
        .update(updates as any)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return data as unknown as PolicyRecord;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['policy-registry'] });
      toast({ title: 'Policy updated' });
    },
    onError: (e: Error) => {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    },
  });
};
