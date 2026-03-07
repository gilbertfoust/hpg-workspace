import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

interface AlertFilters {
  ngo_id?: string;
  module?: string;
  severity?: string;
  status?: string;
}

export function useControllerAlerts(filters?: AlertFilters) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["controller_alerts", filters],
    queryFn: async () => {
      let q = supabase!.from("controller_alerts")
        .select("*, ngos(legal_name, common_name)")
        .order("created_at", { ascending: false });
      if (filters?.ngo_id) q = q.eq("ngo_id", filters.ngo_id);
      if (filters?.module) q = q.eq("module", filters.module);
      if (filters?.severity) q = q.eq("severity", filters.severity);
      if (filters?.status) q = q.eq("status", filters.status);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!supabase,
  });

  const create = useMutation({
    mutationFn: async (alert: {
      ngo_id?: string;
      module: string;
      severity: string;
      message: string;
      context_json?: Json;
    }) => {
      const { data, error } = await supabase!.from("controller_alerts")
        .insert([alert]).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["controller_alerts"] });
      toast.success("Alert created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: Record<string, unknown> = { status };
      if (status === "resolved") updates.resolved_at = new Date().toISOString();
      const { error } = await supabase!.from("controller_alerts")
        .update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["controller_alerts"] });
      toast.success("Alert updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, create, updateStatus };
}
