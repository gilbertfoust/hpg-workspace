import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CurriculumAsset {
  id: string;
  title: string;
  description: string | null;
  version: string | null;
  audience: string | null;
  format: string | null;
  language: string | null;
  status: string | null;
  file_url: string | null;
  last_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export const useCurriculumAssets = () => {
  return useQuery({
    queryKey: ['curriculum-assets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('curriculum_assets')
        .select('*')
        .order('last_updated_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CurriculumAsset[];
    },
  });
};

export const useCreateCurriculumAsset = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: Partial<CurriculumAsset>) => {
      const { data, error } = await supabase
        .from('curriculum_assets')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data as CurriculumAsset;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['curriculum-assets'] });
      toast({
        title: 'Asset created',
        description: 'The curriculum asset has been created.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Error creating asset',
        description: error.message,
      });
    },
  });
};

export const useUpdateCurriculumAsset = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<CurriculumAsset> & { id: string }) => {
      const { data, error } = await supabase
        .from('curriculum_assets')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as CurriculumAsset;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['curriculum-assets'] });
      queryClient.invalidateQueries({ queryKey: ['curriculum-assets', data.id] });
      toast({
        title: 'Asset updated',
        description: 'The curriculum asset has been updated.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Error updating asset',
        description: error.message,
      });
    },
  });
};
