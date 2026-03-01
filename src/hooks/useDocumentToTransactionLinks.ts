import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DocTransactionLink {
  id: string;
  intake_id: string;
  transaction_id: string;
  created_at: string;
}

export function useDocumentToTransactionLinks(intakeId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["document_to_transaction_links", intakeId],
    enabled: !!intakeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_to_transaction_links" as any)
        .select("*")
        .eq("intake_id", intakeId!);
      if (error) throw error;
      return (data || []) as unknown as DocTransactionLink[];
    },
  });

  const create = useMutation({
    mutationFn: async (link: { intake_id: string; transaction_id: string }) => {
      const { data, error } = await supabase
        .from("document_to_transaction_links" as any)
        .insert(link as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as DocTransactionLink;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["document_to_transaction_links"] }),
  });

  return { ...query, create };
}
