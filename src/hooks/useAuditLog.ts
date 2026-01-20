import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { getSupabaseNotConfiguredError, supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export interface AuditLogEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action_type: string;
  actor_user_id: string;
  before_json: Json | null;
  after_json: Json | null;
  reason: string | null;
  created_at: string;
}

const ensureSupabase = () => {
  if (!supabase) {
    throw getSupabaseNotConfiguredError();
  }
};

export const useAuditLog = (filters?: { entity_type?: string; entity_id?: string }) => {
  return useQuery({
    queryKey: ['audit-log', filters],
    queryFn: async () => {
      ensureSupabase();
      let query = supabase.from('audit_log').select('*');
      
      if (filters?.entity_type) {
        query = query.eq('entity_type', filters.entity_type);
      }
      if (filters?.entity_id) {
        query = query.eq('entity_id', filters.entity_id);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false }).limit(100);
      
      if (error) throw error;
      return data as AuditLogEntry[];
    },
  });
};

export const useAuditLogForNGO = (ngo_id: string) => {
  return useQuery({
    queryKey: ['audit-log', 'ngo', ngo_id],
    queryFn: async () => {
      ensureSupabase();
      // Get audit logs for the NGO itself
      const { data: ngoLogs, error: ngoError } = await supabase
        .from('audit_log')
        .select('*')
        .eq('entity_type', 'ngo')
        .eq('entity_id', ngo_id)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (ngoError) throw ngoError;
      
      // Get work items for this NGO
      const { data: workItems } = await supabase
        .from('work_items')
        .select('id')
        .eq('ngo_id', ngo_id);
      
      let workItemLogs: AuditLogEntry[] = [];
      
      if (workItems && workItems.length > 0) {
        const workItemIds = workItems.map(wi => wi.id);
        
        const { data, error } = await supabase
          .from('audit_log')
          .select('*')
          .eq('entity_type', 'work_item')
          .in('entity_id', workItemIds)
          .order('created_at', { ascending: false })
          .limit(50);
        
        if (!error && data) {
          workItemLogs = data as AuditLogEntry[];
        }
      }
      
      // Combine and sort
      const allLogs = [...(ngoLogs || []), ...workItemLogs].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      return allLogs.slice(0, 50) as AuditLogEntry[];
    },
    enabled: !!ngo_id,
  });
};
