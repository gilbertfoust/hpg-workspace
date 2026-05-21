import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";

export interface DepartmentWorkflowRoute {
  id: string;
  module: string;
  department_name: string;
  slack_channel: string | null;
  slack_webhook_secret_name: string | null;
  email_recipients: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const ensureSupabase = () => {
  if (!supabase) throw getSupabaseNotConfiguredError();
  return supabase;
};

export const useDepartmentWorkflowRoutes = () => {
  return useQuery<DepartmentWorkflowRoute[]>({
    queryKey: ["department-workflow-routes"],
    enabled: !!supabase,
    queryFn: async () => {
      const client = ensureSupabase();
      const { data, error } = await client
        .from("department_notification_routes" as never)
        .select("*" as never)
        .order("department_name" as never, { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as DepartmentWorkflowRoute[];
    },
  });
};

export const useUpdateDepartmentWorkflowRoute = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      slack_channel,
      email_recipients,
      is_active,
    }: {
      id: string;
      slack_channel?: string | null;
      email_recipients?: string[];
      is_active?: boolean;
    }) => {
      const client = ensureSupabase();
      const updates: Record<string, unknown> = {};

      if (slack_channel !== undefined) updates.slack_channel = slack_channel || null;
      if (email_recipients !== undefined) updates.email_recipients = email_recipients;
      if (is_active !== undefined) updates.is_active = is_active;

      const { data, error } = await client
        .from("department_notification_routes" as never)
        .update(updates as never)
        .eq("id" as never, id as never)
        .select("*" as never)
        .single();

      if (error) throw error;
      return data as unknown as DepartmentWorkflowRoute;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["department-workflow-routes"] });
    },
  });
};
