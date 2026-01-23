// src/hooks/useWorkItems.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type WorkItemStatus = "open" | "in_progress" | "completed" | "blocked";

export interface WorkItem {
  id: string;
  title: string;
  description?: string | null;
  status?: WorkItemStatus;
  ngo_id?: string | null;
  module?: string | null;
  department?: string | null;
  due_date?: string | null;
}

type ListFilters = {
  ngoId?: string | null;
  status?: WorkItemStatus;
};

export const useWorkItems = (filters?: ListFilters) => {
  return useQuery<WorkItem[]>({
    queryKey: ["work-items", filters],
    queryFn: async () => {
      let query = supabase.from("work_items").select("*").order("created_at", { ascending: false });

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
      const { data, error } = await supabase.from("work_items").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return (data as WorkItem) ?? null;
    },
  });
};

export const useCreateWorkItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Partial<WorkItem>) => {
      const { data, error } = await supabase.from("work_items").insert(input).select().single();
      if (error) throw error;
      return data as WorkItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-items"] });
    },
  });
};

export const useUpdateWorkItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Partial<WorkItem> & { id: string }) => {
      const { id, ...rest } = input;
      const { data, error } = await supabase.from("work_items").update(rest).eq("id", id).select().single();
      if (error) throw error;
      return data as WorkItem;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["work-items"] });
      queryClient.invalidateQueries({ queryKey: ["work-item", variables.id] });
    },
  });
};
