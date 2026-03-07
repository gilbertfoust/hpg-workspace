import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useGrantSources() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["grant_sources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grant_sources")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (source: { name: string; funder_type: string; description?: string; website?: string; country?: string; region?: string; focus_areas?: string[]; min_award?: number; max_award?: number }) => {
      const { data, error } = await supabase.from("grant_sources").insert(source).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grant_sources"] });
      toast.success("Grant source created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, create };
}
