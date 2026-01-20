import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ProgramActivity {
  id: string;
  ngo_id: string | null;
  activity_date: string;
  title: string;
  activity_type: string | null;
  participants_count: number | null;
  location: string | null;
  status: string | null;
  work_item_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProgramActivityFilters {
  ngo_id?: string;
  startDate?: string;
  endDate?: string;
  activity_type?: string;
  status?: string;
}

export const useProgramActivities = (filters?: ProgramActivityFilters) => {
  return useQuery({
    queryKey: ['program-activities', filters],
    queryFn: async () => {
      let query = supabase
        .from('program_activities')
        .select('*')
        .order('activity_date', { ascending: false });

      if (filters?.ngo_id) {
        query = query.eq('ngo_id', filters.ngo_id);
      }
      if (filters?.startDate) {
        query = query.gte('activity_date', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('activity_date', filters.endDate);
      }
      if (filters?.activity_type) {
        query = query.eq('activity_type', filters.activity_type);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ProgramActivity[];
    },
  });
};

export const useCreateProgramActivity = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: Partial<ProgramActivity>) => {
      const { data, error } = await supabase
        .from('program_activities')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data as ProgramActivity;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['program-activities'] });
      toast({
        title: 'Program activity created',
        description: 'The program activity has been saved.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Error saving activity',
        description: error.message,
      });
    },
  });
};

export const useUpdateProgramActivity = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<ProgramActivity> & { id: string }) => {
      const { data, error } = await supabase
        .from('program_activities')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as ProgramActivity;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['program-activities'] });
      queryClient.invalidateQueries({ queryKey: ['program-activities', data.id] });
      toast({
        title: 'Program activity updated',
        description: 'The program activity has been updated.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Error updating activity',
        description: error.message,
      });
    },
  });
};
