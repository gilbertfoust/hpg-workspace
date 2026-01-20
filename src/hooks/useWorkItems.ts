import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export type WorkItemStatus = 
  | 'draft'
  | 'not_started'
  | 'in_progress'
  | 'waiting_on_ngo'
  | 'waiting_on_hpg'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'complete'
  | 'canceled';

export type Priority = 'low' | 'medium' | 'high';
export type EvidenceStatus = 'missing' | 'uploaded' | 'under_review' | 'approved' | 'rejected';
export type ModuleType = 
  | 'ngo_coordination'
  | 'administration'
  | 'operations'
  | 'program'
  | 'curriculum'
  | 'development'
  | 'partnership'
  | 'marketing'
  | 'communications'
  | 'hr'
  | 'it'
  | 'finance'
  | 'legal';

export interface WorkItem {
  id: string;
  ngo_id: string | null;
  module: ModuleType;
  type: string | null;
  title: string;
  description: string | null;
  department_id: string | null;
  owner_user_id: string | null;
  created_by_user_id: string | null;
  status: WorkItemStatus;
  priority: Priority;
  due_date: string | null;
  start_date: string | null;
  completed_at: string | null;
  dependencies: string[];
  evidence_required: boolean;
  evidence_status: EvidenceStatus;
  approval_required: boolean;
  approver_user_id: string | null;
  approval_policy: unknown;
  external_visible: boolean;
  trello_sync: boolean;
  trello_card_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateWorkItemInput {
  title: string;
  module: ModuleType;
  type?: string;
  ngo_id?: string;
  description?: string;
  department_id?: string;
  owner_user_id?: string;
  priority?: Priority;
  due_date?: string;
  start_date?: string;
  evidence_required?: boolean;
  approval_required?: boolean;
  external_visible?: boolean;
}

export const useWorkItems = (filters?: {
  ngo_id?: string;
  status?: WorkItemStatus[];
  module?: ModuleType;
  owner_user_id?: string;
  type?: string;
}) => {
  return useQuery({
    queryKey: ['work-items', filters],
    queryFn: async () => {
      let query = supabase
        .from('work_items')
        .select('*')
        .order('due_date', { ascending: true, nullsFirst: false });
      
      if (filters?.ngo_id) {
        query = query.eq('ngo_id', filters.ngo_id);
      }
      if (filters?.status && filters.status.length > 0) {
        query = query.in('status', filters.status);
      }
      if (filters?.module) {
        query = query.eq('module', filters.module);
      }
      if (filters?.owner_user_id) {
        query = query.eq('owner_user_id', filters.owner_user_id);
      }
      if (filters?.type) {
        query = query.eq('type', filters.type);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as WorkItem[];
    },
  });
};

export const useWorkItem = (id: string) => {
  return useQuery({
    queryKey: ['work-items', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_items')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as WorkItem;
    },
    enabled: !!id,
  });
};

export const useCreateWorkItem = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateWorkItemInput) => {
      const { data, error } = await supabase
        .from('work_items')
        .insert({
          ...input,
          created_by_user_id: user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as WorkItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: ['work-item-stats'] });
      toast({
        title: 'Work item created',
        description: 'The work item has been successfully created.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Error creating work item',
        description: error.message,
      });
    },
  });
};

export const useUpdateWorkItem = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<WorkItem> & { id: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { approval_policy, ...safeInput } = input;
      const { data, error } = await supabase
        .from('work_items')
        .update(safeInput)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as WorkItem;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: ['work-items', data.id] });
      queryClient.invalidateQueries({ queryKey: ['work-item-stats'] });
      toast({
        title: 'Work item updated',
        description: 'The work item has been successfully updated.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Error updating work item',
        description: error.message,
      });
    },
  });
};

export const useWorkItemStats = () => {
  return useQuery({
    queryKey: ['work-item-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_items')
        .select('status, due_date, evidence_required, evidence_status');
      
      if (error) throw error;
      
      const today = new Date();
      const in7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      const activeStatuses: WorkItemStatus[] = ['not_started', 'in_progress', 'waiting_on_ngo', 'waiting_on_hpg', 'submitted', 'under_review'];
      
      const activeItems = data.filter(item => activeStatuses.includes(item.status as WorkItemStatus));
      
      const stats = {
        total: data.length,
        active: activeItems.length,
        dueIn7Days: activeItems.filter(item => {
          if (!item.due_date) return false;
          const dueDate = new Date(item.due_date);
          return dueDate >= today && dueDate <= in7Days;
        }).length,
        dueIn30Days: activeItems.filter(item => {
          if (!item.due_date) return false;
          const dueDate = new Date(item.due_date);
          return dueDate >= today && dueDate <= in30Days;
        }).length,
        overdue: activeItems.filter(item => {
          if (!item.due_date) return false;
          const dueDate = new Date(item.due_date);
          return dueDate < today;
        }).length,
        pendingEvidence: data.filter(item => 
          item.evidence_required && 
          item.evidence_status === 'missing' &&
          activeStatuses.includes(item.status as WorkItemStatus)
        ).length,
        complete: data.filter(item => item.status === 'complete').length,
      };
      
      return stats;
    },
  });
};

export const useMyWorkItems = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['my-work-items', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('work_items')
        .select('*')
        .eq('owner_user_id', user.id)
        .not('status', 'in', '("complete","canceled")')
        .order('due_date', { ascending: true, nullsFirst: false });
      
      if (error) throw error;
      return data as WorkItem[];
    },
    enabled: !!user?.id,
  });
};
