import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupabaseNotConfiguredError, supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

export type NgoBundleRow = Pick<
  Database['public']['Tables']['ngos']['Row'],
  'id' | 'bundle' | 'country' | 'notes' | 'legal_name' | 'common_name'
>;

export interface BundleSummary {
  name: string;
  region: string | null;
  notes: string | null;
  ngoCount: number;
}

const ensureSupabase = () => {
  if (!supabase) {
    throw getSupabaseNotConfiguredError();
  }
};

const deriveBundles = (ngos: NgoBundleRow[]): BundleSummary[] => {
  const bundleMap = new Map<string, BundleSummary>();

  ngos.forEach((ngo) => {
    if (!ngo.bundle) return;
    const existing = bundleMap.get(ngo.bundle) ?? {
      name: ngo.bundle,
      region: ngo.country ?? null,
      notes: ngo.notes ?? null,
      ngoCount: 0,
    };

    const region = existing.region ?? ngo.country ?? null;
    const notes = existing.notes ?? ngo.notes ?? null;

    bundleMap.set(ngo.bundle, {
      name: ngo.bundle,
      region,
      notes,
      ngoCount: existing.ngoCount + 1,
    });
  });

  return Array.from(bundleMap.values()).sort((a, b) => a.name.localeCompare(b.name));
};

export const useAdminConfigBundles = () => {
  return useQuery({
    queryKey: ['admin-config', 'bundles'],
    queryFn: async () => {
      ensureSupabase();
      const { data, error } = await supabase
        .from('ngos')
        .select('id, bundle, country, notes, legal_name, common_name')
        .order('common_name', { ascending: true });

      if (error) throw error;
      const ngos = (data ?? []) as NgoBundleRow[];
      return {
        ngos,
        bundles: deriveBundles(ngos),
      };
    },
  });
};

export const useCreateBundle = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: {
      name: string;
      region?: string;
      notes?: string;
      seedNgoId: string;
    }) => {
      ensureSupabase();
      const { data, error } = await supabase
        .from('ngos')
        .update({
          bundle: input.name,
          country: input.region ?? null,
          notes: input.notes ?? null,
        })
        .eq('id', input.seedNgoId)
        .select('id')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-config', 'bundles'] });
      toast({
        title: 'Bundle added',
        description: 'The bundle has been created and assigned to an NGO.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Unable to add bundle',
        description: error.message,
      });
    },
  });
};

export const useUpdateBundle = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: {
      previousName: string;
      name: string;
      region?: string;
      notes?: string;
    }) => {
      ensureSupabase();
      const { error } = await supabase
        .from('ngos')
        .update({
          bundle: input.name,
          country: input.region ?? null,
          notes: input.notes ?? null,
        })
        .eq('bundle', input.previousName);

      if (error) throw error;
      return input;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-config', 'bundles'] });
      toast({
        title: 'Bundle updated',
        description: 'Bundle metadata has been saved.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Unable to update bundle',
        description: error.message,
      });
    },
  });
};
