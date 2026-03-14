import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface UsageSource {
  id: string;
  name: string;
  type: string;
  source_table: string | null;
  source_reference_id: string | null;
  description: string;
  created_at: string;
}

export function useUsageSources() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["usage_sources"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("usage_sources").select("*").order("name");
      if (error) throw error;
      return (data || []) as UsageSource[];
    },
  });

  const create = useMutation({
    mutationFn: async (src: Omit<UsageSource, "id" | "created_at">) => {
      const { data, error } = await (supabase as any).from("usage_sources").insert(src).select().single();
      if (error) throw error;
      return data as UsageSource;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["usage_sources"] }); toast.success("Usage source created"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, create };
}
