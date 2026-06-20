import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  archiveWorkItemWithFallback,
  completeWorkItemForAdminRecordsWithFallback,
} from "@/lib/workItemRecordActions";

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
  | "partnership"
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
  created_at?: string;
  updated_at?: string;
  completed_at?: string | null;
  archived_at?: string | null;
  archived_by_user_id?: string | null;
  archive_reason?: string | null;
  google_drive_file_url?: string | null;
  google_drive_file_id?: string | null;
  google_drive_exported_at?: string | null;
  dependencies?: string[] | null;
  checklist_json?: unknown;
}

export type CreateWorkItemInput = Partial<WorkItem> & { module: ModuleType };

export type ListFilters = {
  ngoId?: string | null;
  ngo_id?: string | null;
  status?: WorkItemStatus | WorkItemStatus[];
  module?: ModuleType | string;
  type?: string;
  owner_user_id?: string;
  department_id?: string;
  evidence_required?: boolean;
  include_archived?: boolean;
};

const ensureSupabase = () => {
  if (!supabase) throw getSupabaseNotConfiguredError();
  return supabase;
};

const invalidateWorkItemQueries = (queryClient: ReturnType<typeof useQueryClient>, id?: string) => {
  queryClient.invalidateQueries({ queryKey: ["work-items"] });
  queryClient.invalidateQueries({ queryKey: ["my-queue-work-items"] });
  queryClient.invalidateQueries({ queryKey: ["department-queue-work-items"] });
  queryClient.invalidateQueries({ queryKey: ["work-item-admin-records"] });
  if (id) queryClient.invalidateQueries({ queryKey: ["work-item", id] });
};

export const useWorkItems = (filters?: ListFilters) => {
  return useQuery<WorkItem[]>({
    queryKey: ["work-items", filters],
    queryFn: async () => {
      const client = ensureSupabase();
      let query = client.from("work_items").select("*").order("created_at", { ascending: false });

      if (!filters?.include_archived) {
        query = query.is("archived_at", null);
      }

      const ngoId = filters?.ngoId || filters?.ngo_id;
      if (ngoId) query = query.eq("ngo_id", ngoId);
      if (filters?.status) {
        if (Array.isArray(filters.status)) query = query.in("status", filters.status);
        else query = query.eq("status", filters.status);
      }
      if (filters?.evidence_required !== undefined) query = query.eq("evidence_required", filters.evidence_required);
      if (filters?.module) query = query.eq("module", filters.module as any);
      if (filters?.type) query = query.eq("type", filters.type);
      if (filters?.owner_user_id) query = query.eq("owner_user_id", filters.owner_user_id);
      if (filters?.department_id) query = query.eq("department_id", filters.department_id);

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
      const client = ensureSupabase();
      const { data, error } = await client.from("work_items").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return (data as WorkItem) ?? null;
    },
  });
};

export const useCreateWorkItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Partial<WorkItem> & { module: ModuleType }) => {
      const client = ensureSupabase();
      const { data, error } = await client.from("work_items").insert(input as any).select().single();
      if (error) throw error;
      const created = data as WorkItem;

      if (created.due_date) {
        try {
          const { scheduleDefaultReminderForWorkItem } = await import("@/lib/reminders");
          await scheduleDefaultReminderForWorkItem({
            id: created.id,
            due_date: created.due_date,
            owner_user_id: created.owner_user_id || null,
            created_by_user_id: null,
          });
        } catch (e) {
          console.warn("Failed to schedule reminder for new work item:", e);
        }
      }

      return created;
    },
    onSuccess: () => invalidateWorkItemQueries(queryClient),
  });
};

export const useUpdateWorkItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Partial<WorkItem> & { id: string }) => {
      const client = ensureSupabase();
      const { id, ...rest } = input;
      const updatePayload = { ...rest } as Partial<WorkItem>;

      if (updatePayload.status === "complete" && !updatePayload.completed_at) {
        updatePayload.completed_at = new Date().toISOString();
      }

      const { data, error } = await client.from("work_items").update(updatePayload as any).eq("id", id).select().single();
      if (error) throw error;
      const updated = data as WorkItem;

      if (input.due_date && updated.due_date) {
        try {
          const { scheduleDefaultReminderForWorkItem } = await import("@/lib/reminders");
          await scheduleDefaultReminderForWorkItem({
            id: updated.id,
            due_date: updated.due_date,
            owner_user_id: updated.owner_user_id || null,
            created_by_user_id: null,
          });
        } catch (e) {
          console.warn("Failed to schedule reminder for updated work item:", e);
        }
      }

      return updated;
    },
    onSuccess: (_data, variables) => invalidateWorkItemQueries(queryClient, variables.id),
  });
};

export const useCompleteWorkItemForAdminRecords = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const client = ensureSupabase();
      return completeWorkItemForAdminRecordsWithFallback(client, id, notes);
    },
    onSuccess: (_data, variables) => invalidateWorkItemQueries(queryClient, variables.id),
  });
};

export const useArchiveWorkItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const client = ensureSupabase();
      return archiveWorkItemWithFallback(client, id, reason);
    },
    onSuccess: (_data, variables) => invalidateWorkItemQueries(queryClient, variables.id),
  });
};

export const useExportWorkItemToDrive = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const client = ensureSupabase();
      const { data, error } = await client.functions.invoke("export-work-item-to-drive", {
        body: { work_item_id: id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { file_id?: string; file_url?: string; skipped?: boolean; reason?: string };
    },
    onSuccess: (_data, id) => invalidateWorkItemQueries(queryClient, id),
  });
};

export const useMyQueueWorkItems = () => {
  const { user } = useAuth();
  return useQuery<WorkItem[]>({
    queryKey: ["my-queue-work-items", user?.id],
    enabled: !!user?.id && !!supabase,
    queryFn: async () => {
      if (!user?.id) return [];
      const client = ensureSupabase();
      const { data, error } = await client
        .from("work_items")
        .select("*")
        .eq("owner_user_id", user.id)
        .is("archived_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as WorkItem[];
    },
  });
};

export const useDepartmentQueueWorkItems = (departmentIds: string[]) => {
  return useQuery<WorkItem[]>({
    queryKey: ["department-queue-work-items", departmentIds],
    enabled: departmentIds.length > 0 && !!supabase,
    queryFn: async () => {
      if (departmentIds.length === 0) return [];
      const client = ensureSupabase();
      const { data, error } = await client
        .from("work_items")
        .select("*")
        .in("department_id", departmentIds)
        .is("archived_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as WorkItem[];
    },
  });
};

export const useBulkUpdateWorkItems = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, updates }: { ids: string[]; updates: Partial<WorkItem> }) => {
      const client = ensureSupabase();
      if (ids.length === 0) return { ids, updates, updated: 0 };
      const { error } = await client.from("work_items").update(updates as any).in("id", ids);
      if (error) throw error;
      return { ids, updates, updated: ids.length };
    },
    onSuccess: () => invalidateWorkItemQueries(queryClient),
  });
};

export const useBulkBumpWorkItemDueDates = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ items, bumpDays }: { items: WorkItem[]; bumpDays: number }) => {
      const client = ensureSupabase();
      if (items.length === 0) return { items, bumpDays };
      const updates = items.map((item) => {
        if (!item.due_date) return null;
        const currentDate = new Date(item.due_date);
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() + bumpDays);
        return { id: item.id, due_date: newDate.toISOString().split("T")[0] };
      }).filter((update): update is { id: string; due_date: string } => update !== null);

      if (updates.length === 0) return { items, bumpDays };

      const results = await Promise.all(updates.map((update) =>
        client.from("work_items").update({ due_date: update.due_date } as any).eq("id", update.id)
      ));
      const errors = results.filter((r) => r.error).map((r) => r.error);
      if (errors.length > 0) throw new Error(`Failed to update some work items: ${errors[0]?.message}`);

      return { items, bumpDays, updated: updates.length };
    },
    onSuccess: () => invalidateWorkItemQueries(queryClient),
  });
};
