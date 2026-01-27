// src/hooks/useWorkItems.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type WorkItemStatus =
  | "draft"
  | "not_started"
  | "in_progress"
  | "waiting_on_ngo"
  | "waiting_on_hpg"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "complete"
  | "canceled";

export type ModuleType =
  | "ngo_coordination"
  | "administration"
  | "operations"
  | "program"
  | "curriculum"
  | "development"
  | "partnerships"
  | "marketing"
  | "communications"
  | "hr"
  | "it"
  | "finance"
  | "legal";

export type Priority = "low" | "medium" | "high" | "urgent";

export interface WorkItem {
  id: string;
  title: string;
  description?: string | null;
  status: WorkItemStatus;
  ngo_id?: string | null;
  module?: ModuleType | null;
  department_id?: string | null;
  due_date?: string | null;
  owner_user_id?: string | null;
  approval_required?: boolean;
  approver_user_id?: string | null;
  evidence_required?: boolean;
  evidence_status?: string | null;
  priority?: Priority | null;
  type?: string | null;
  external_visible?: boolean;
}

type ListFilters = {
  ngoId?: string | null;
  status?: WorkItemStatus;
};

export const useWorkItems = (filters?: ListFilters) => {
  return useQuery<WorkItem[]>({
    queryKey: ["work-items", filters],
    queryFn: async () => {
      let query = supabase.from("work_items" as never).select("*").order("created_at", { ascending: false });

      if (filters?.ngoId) {
        query = query.eq("ngo_id", filters.ngoId);
      }
      if (filters?.status) {
        query = query.eq("status", filters.status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as WorkItem[];
    },
  });
};

export const useWorkItem = (id?: string | null) => {
  return useQuery<WorkItem | null>({
    queryKey: ["work-item", id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase.from("work_items" as never).select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return (data as WorkItem) ?? null;
    },
  });
};

export const useCreateWorkItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Partial<WorkItem> & { module: ModuleType }) => {
      const { data, error } = await supabase.from("work_items" as never).insert(input).select().single();
      if (error) throw error;
      return data as WorkItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-items"] });
      queryClient.invalidateQueries({ queryKey: ["my-queue-work-items"] });
      queryClient.invalidateQueries({ queryKey: ["department-queue-work-items"] });
    },
  });
};

export const useUpdateWorkItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Partial<WorkItem> & { id: string }) => {
      const { id, ...rest } = input;
      const { data, error } = await supabase.from("work_items" as never).update(rest).eq("id", id).select().single();
      if (error) throw error;
      return data as WorkItem;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["work-items"] });
      queryClient.invalidateQueries({ queryKey: ["work-item", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["my-queue-work-items"] });
      queryClient.invalidateQueries({ queryKey: ["department-queue-work-items"] });
    },
  });
};

// Hook for My Queue - returns work items assigned to current user
export const useMyQueueWorkItems = () => {
  const { user } = useAuth();
  return useQuery<WorkItem[]>({
    queryKey: ["my-queue-work-items", user?.id],
    enabled: !!user?.id && !!supabase,
    queryFn: async () => {
      if (!user?.id || !supabase) return [];
      
      const { data, error } = await supabase
        .from("work_items" as never)
        .select("*")
        .eq("owner_user_id", user.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return (data ?? []) as WorkItem[];
    },
  });
};

// Hook for Department Queue - returns work items for departments where user is lead
export const useDepartmentQueueWorkItems = (departmentIds: string[]) => {
  return useQuery<WorkItem[]>({
    queryKey: ["department-queue-work-items", departmentIds],
    enabled: departmentIds.length > 0 && !!supabase,
    queryFn: async () => {
      if (departmentIds.length === 0 || !supabase) return [];
      
      const { data, error } = await supabase
        .from("work_items" as never)
        .select("*")
        .in("department_id", departmentIds)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return (data ?? []) as WorkItem[];
    },
  });
};

// Bulk update work items
export const useBulkUpdateWorkItems = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, updates }: { ids: string[]; updates: Partial<WorkItem> }) => {
      // TODO: Replace with actual Supabase bulk update when table exists
      // For now, just invalidate queries
      return { ids, updates };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-items"] });
      queryClient.invalidateQueries({ queryKey: ["my-queue-work-items"] });
      queryClient.invalidateQueries({ queryKey: ["department-queue-work-items"] });
    },
  });
};

// Bulk bump due dates
export const useBulkBumpWorkItemDueDates = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ items, bumpDays }: { items: WorkItem[]; bumpDays: number }) => {
      if (!supabase) throw new Error("Supabase client not available");
      if (items.length === 0) return { items, bumpDays };
      
      // Calculate new due dates and prepare updates
      const updates = items.map((item) => {
        if (!item.due_date) return null;
        const currentDate = new Date(item.due_date);
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() + bumpDays);
        return {
          id: item.id,
          due_date: newDate.toISOString().split('T')[0], // Format as YYYY-MM-DD
        };
      }).filter((update): update is { id: string; due_date: string } => update !== null);
      
      if (updates.length === 0) return { items, bumpDays };
      
      // Perform bulk update using RPC or individual updates
      // Since Supabase doesn't support bulk updates with different values per row easily,
      // we'll use a transaction-like approach with Promise.all
      const updatePromises = updates.map((update) =>
        supabase
          .from("work_items" as never)
          .update({ due_date: update.due_date })
          .eq("id", update.id)
      );
      
      const results = await Promise.all(updatePromises);
      const errors = results.filter((r) => r.error).map((r) => r.error);
      
      if (errors.length > 0) {
        throw new Error(`Failed to update some work items: ${errors[0]?.message}`);
      }
      
      return { items, bumpDays, updated: updates.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-items"] });
      queryClient.invalidateQueries({ queryKey: ["my-queue-work-items"] });
      queryClient.invalidateQueries({ queryKey: ["department-queue-work-items"] });
    },
  });
};
