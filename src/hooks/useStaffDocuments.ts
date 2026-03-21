import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useStaffDocuments(staffId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["staff_documents", staffId],
    queryFn: async () => {
      let q = supabase.from("staff_documents").select("*").order("uploaded_at", { ascending: false });
      if (staffId) q = q.eq("staff_id", staffId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!staffId,
  });

  const upload = useMutation({
    mutationFn: async ({ staffId, file, documentType, expiryDate }: { staffId: string; file: File; documentType: string; expiryDate?: string }) => {
      const path = `hr/staff/${staffId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("ngo-documents").upload(path, file);
      if (uploadError) throw uploadError;

      const { data, error } = await supabase.from("staff_documents").insert({
        staff_id: staffId,
        document_type: documentType,
        file_name: file.name,
        storage_path: path,
        expiry_date: expiryDate || null,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["staff_documents"] }); toast.success("Document uploaded"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async ({ id, storagePath }: { id: string; storagePath: string }) => {
      await supabase.storage.from("ngo-documents").remove([storagePath]);
      const { error } = await supabase.from("staff_documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["staff_documents"] }); toast.success("Document removed"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, upload, remove };
}
