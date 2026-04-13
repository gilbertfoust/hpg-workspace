import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TemplateAnalytics {
  templateId: string;
  templateName: string;
  module: string;
  total: number;
  draft: number;
  submitted: number;
  accepted: number;
  rejected: number;
  completionRate: number;
  avgHoursToSubmit: number | null;
}

export interface FormAnalyticsSummary {
  totalSubmissions: number;
  avgCompletionRate: number;
  avgHoursToComplete: number | null;
  mostActiveTemplate: string;
  perTemplate: TemplateAnalytics[];
  perModule: Record<string, number>;
}

export const useFormAnalytics = () => {
  return useQuery({
    queryKey: ['form-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('form_submissions')
        .select('id, submission_status, created_at, submitted_at, form_template_id, form_templates(id, name, module)');

      if (error) throw error;

      const byTemplate = new Map<string, {
        name: string; module: string;
        total: number; draft: number; submitted: number; accepted: number; rejected: number;
        durations: number[];
      }>();

      for (const row of data || []) {
        const tpl = row.form_templates as any;
        if (!tpl) continue;
        const key = tpl.id as string;
        if (!byTemplate.has(key)) {
          byTemplate.set(key, { name: tpl.name, module: tpl.module, total: 0, draft: 0, submitted: 0, accepted: 0, rejected: 0, durations: [] });
        }
        const entry = byTemplate.get(key)!;
        entry.total++;
        const s = (row.submission_status || 'submitted') as string;
        if (s === 'draft') entry.draft++;
        else if (s === 'submitted') entry.submitted++;
        else if (s === 'accepted') entry.accepted++;
        else if (s === 'rejected') entry.rejected++;

        if (row.submitted_at && row.created_at) {
          const hrs = (new Date(row.submitted_at).getTime() - new Date(row.created_at).getTime()) / 3600000;
          if (hrs >= 0) entry.durations.push(hrs);
        }
      }

      const perTemplate: TemplateAnalytics[] = [];
      const perModule: Record<string, number> = {};
      let totalSubs = 0;
      let rateSum = 0;
      let rateCount = 0;
      const allDurations: number[] = [];

      for (const [id, e] of byTemplate) {
        const denom = e.submitted + e.accepted + e.rejected;
        const rate = denom > 0 ? (e.accepted / denom) * 100 : 0;
        const avg = e.durations.length > 0 ? e.durations.reduce((a, b) => a + b, 0) / e.durations.length : null;
        perTemplate.push({ templateId: id, templateName: e.name, module: e.module, total: e.total, draft: e.draft, submitted: e.submitted, accepted: e.accepted, rejected: e.rejected, completionRate: Math.round(rate), avgHoursToSubmit: avg !== null ? Math.round(avg * 10) / 10 : null });
        totalSubs += e.total;
        if (denom > 0) { rateSum += rate; rateCount++; }
        allDurations.push(...e.durations);
        perModule[e.module] = (perModule[e.module] || 0) + e.total;
      }

      perTemplate.sort((a, b) => b.total - a.total);

      const summary: FormAnalyticsSummary = {
        totalSubmissions: totalSubs,
        avgCompletionRate: rateCount > 0 ? Math.round(rateSum / rateCount) : 0,
        avgHoursToComplete: allDurations.length > 0 ? Math.round((allDurations.reduce((a, b) => a + b, 0) / allDurations.length) * 10) / 10 : null,
        mostActiveTemplate: perTemplate[0]?.templateName || '—',
        perTemplate,
        perModule,
      };
      return summary;
    },
  });
};
