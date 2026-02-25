import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { EsignDocument } from "@/types/esignature";

export function useEsignDocuments() {
  return useQuery({
    queryKey: ["esign-documents"],
    queryFn: async (): Promise<EsignDocument[]> => {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from("esign_documents" as never)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as EsignDocument[];
    },
  });
}

export function useUploadEsignDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      if (!supabase) throw new Error("Not connected");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const filePath = `${user.id}/${crypto.randomUUID()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("esign-documents")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from("esign_documents" as never)
        .insert({
          owner_id: user.id,
          original_filename: file.name,
          storage_path: filePath,
        } as never);
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["esign-documents"] });
    },
  });
}

export function useDeleteEsignDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (doc: EsignDocument) => {
      if (!supabase) throw new Error("Not connected");
      await supabase.storage.from("esign-documents").remove([doc.storage_path]);
      const { error } = await supabase
        .from("esign_documents" as never)
        .delete()
        .eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["esign-documents"] });
    },
  });
}
