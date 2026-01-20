import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ProgramMonthlyReport {
  id: string;
  ngo_id: string;
  report_month: number;
  report_year: number;
  activities_summary: string;
  successes: string;
  challenges: string;
  requested_support: string | null;
  created_at: string;
  updated_at: string;
}

export const useProgramMonthlyReports = (filters?: { ngo_id?: string; report_month?: number; report_year?: number }) => {
  return useQuery({
    queryKey: ['program-monthly-reports', filters],
    queryFn: async () => {
      let query = supabase
        .from('program_monthly_reports')
        .select('*')
        .order('report_year', { ascending: false })
        .order('report_month', { ascending: false });

      if (filters?.ngo_id) {
        query = query.eq('ngo_id', filters.ngo_id);
      }
      if (filters?.report_month) {
        query = query.eq('report_month', filters.report_month);
      }
      if (filters?.report_year) {
        query = query.eq('report_year', filters.report_year);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ProgramMonthlyReport[];
    },
  });
};

export const useUpsertProgramMonthlyReport = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: Omit<ProgramMonthlyReport, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('program_monthly_reports')
        .upsert(input, { onConflict: 'ngo_id,report_month,report_year' })
        .select()
        .single();

      if (error) throw error;
      return data as ProgramMonthlyReport;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['program-monthly-reports'] });
      toast({
        title: 'Monthly report saved',
        description: 'The monthly program report has been captured.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Error saving report',
        description: error.message,
      });
    },
  });
};
