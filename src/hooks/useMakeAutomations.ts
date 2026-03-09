import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface MakeAutomation {
  id: string;
  name: string;
  description: string | null;
  automation_type: string;
  trigger_event: string;
  webhook_url: string | null;
  webhook_secret: string | null;
  is_active: boolean;
  config_json: Record<string, unknown>;
  last_triggered_at: string | null;
  trigger_count: number;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MakeAutomationLog {
  id: string;
  automation_id: string;
  status: string;
  request_payload: Record<string, unknown> | null;
  response_payload: Record<string, unknown> | null;
  error_message: string | null;
  triggered_by_user_id: string | null;
  created_at: string;
}

export function useMakeAutomations() {
  return useQuery({
    queryKey: ["make-automations"],
    queryFn: async () => {
      if (!supabase) throw new Error("Backend not configured");
      const { data, error } = await supabase
        .from("make_automations" as string)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as MakeAutomation[];
    },
  });
}

export function useMakeAutomationLogs(automationId?: string) {
  return useQuery({
    queryKey: ["make-automation-logs", automationId],
    enabled: !!automationId,
    queryFn: async () => {
      if (!supabase) throw new Error("Backend not configured");
      const { data, error } = await supabase
        .from("make_automation_logs" as string)
        .select("*")
        .eq("automation_id", automationId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as unknown as MakeAutomationLog[];
    },
  });
}

export function useCreateMakeAutomation() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: Partial<MakeAutomation>) => {
      if (!supabase) throw new Error("Backend not configured");
      const { data, error } = await supabase
        .from("make_automations" as string)
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as MakeAutomation;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["make-automations"] });
      toast({ title: "Automation created" });
    },
    onError: (e: Error) => {
      toast({ variant: "destructive", title: "Error", description: e.message });
    },
  });
}

export function useUpdateMakeAutomation() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MakeAutomation> & { id: string }) => {
      if (!supabase) throw new Error("Backend not configured");
      const { data, error } = await supabase
        .from("make_automations" as string)
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as MakeAutomation;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["make-automations"] });
      toast({ title: "Automation updated" });
    },
    onError: (e: Error) => {
      toast({ variant: "destructive", title: "Error", description: e.message });
    },
  });
}

export function useDeleteMakeAutomation() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) throw new Error("Backend not configured");
      const { error } = await supabase
        .from("make_automations" as string)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["make-automations"] });
      toast({ title: "Automation deleted" });
    },
    onError: (e: Error) => {
      toast({ variant: "destructive", title: "Error", description: e.message });
    },
  });
}

export function useTriggerMakeAutomation() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ automationId, payload }: { automationId: string; payload?: Record<string, unknown> }) => {
      if (!supabase) throw new Error("Backend not configured");
      const { data, error } = await supabase.functions.invoke("trigger-make-scenario", {
        body: { automation_id: automationId, payload },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["make-automations"] });
      qc.invalidateQueries({ queryKey: ["make-automation-logs"] });
      toast({ title: data?.success ? "Automation triggered successfully" : "Automation triggered with issues" });
    },
    onError: (e: Error) => {
      toast({ variant: "destructive", title: "Trigger failed", description: e.message });
    },
  });
}
