import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useTaxRates(ngoId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["tax_rates", ngoId],
    enabled: !!ngoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tax_rates")
        .select("*")
        .eq("ngo_id", ngoId!)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (rate: { ngo_id: string; name: string; rate: number; is_default?: boolean }) => {
      const { data, error } = await supabase.from("tax_rates").insert(rate).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tax_rates"] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { error } = await supabase.from("tax_rates").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tax_rates"] }),
  });

  return { ...query, create, update };
}
