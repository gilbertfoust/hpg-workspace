import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useHRChecklists(type?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["hr_checklists", type],
    queryFn: async () => {
      let q = supabase.from("hr_checklists").select("*").order("name");
      if (type) q = q.eq("checklist_type", type);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (checklist: { name: string; checklist_type: string; ngo_id?: string; items?: unknown[] }) => {
      const { data, error } = await supabase.from("hr_checklists").insert({
        ...checklist,
        items: JSON.stringify(checklist.items || []),
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["hr_checklists"] }); toast.success("Checklist created"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Record<string, unknown>) => {
      if (updates.items) updates.items = JSON.stringify(updates.items);
      const { error } = await supabase.from("hr_checklists").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["hr_checklists"] }); toast.success("Checklist updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, create, update };
}

export function useChecklistAssignments(staffId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["hr_checklist_assignments", staffId],
    queryFn: async () => {
      let q = supabase.from("hr_checklist_assignments")
        .select("*, hr_checklists(name, checklist_type, items), staff_profiles(first_name, last_name)")
        .order("assigned_at", { ascending: false });
      if (staffId) q = q.eq("staff_id", staffId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const assign = useMutation({
    mutationFn: async ({ staffId, checklistId }: { staffId: string; checklistId: string }) => {
      const { data, error } = await supabase.from("hr_checklist_assignments").insert({
        staff_id: staffId,
        checklist_id: checklistId,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["hr_checklist_assignments"] }); toast.success("Checklist assigned"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, itemStatuses }: { id: string; status?: string; itemStatuses?: Record<string, boolean> }) => {
      const updates: Record<string, unknown> = {};
      if (status) updates.status = status;
      if (itemStatuses) updates.item_statuses = itemStatuses;
      if (status === "completed") updates.completed_at = new Date().toISOString();
      const { error } = await supabase.from("hr_checklist_assignments").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["hr_checklist_assignments"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, assign, updateStatus };
}
