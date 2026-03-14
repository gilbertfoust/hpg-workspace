import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SavedLedgerDocument {
  id: string;
  ngo_id: string;
  transaction_id: string;
  title: string;
  html_content: string;
  saved_by_user_id: string | null;
  created_at: string;
}

export function useSavedLedgerDocuments(ngoId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["saved_ledger_documents", ngoId],
    enabled: !!ngoId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("saved_ledger_documents")
        .select("*")
        .eq("ngo_id", ngoId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as SavedLedgerDocument[];
    },
  });

  const save = useMutation({
    mutationFn: async (payload: {
      ngo_id: string;
      transaction_id: string;
      title: string;
      html_content: string;
      saved_by_user_id: string | null;
    }) => {
      const { data, error } = await (supabase as any)
        .from("saved_ledger_documents")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as SavedLedgerDocument;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved_ledger_documents"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("saved_ledger_documents")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved_ledger_documents"] });
    },
  });

  return { ...query, save, remove };
}
