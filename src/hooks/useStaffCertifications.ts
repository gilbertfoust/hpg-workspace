import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useStaffCertifications(staffId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["staff_certifications", staffId],
    queryFn: async () => {
      let q = supabase.from("staff_certifications").select("*").order("expiry_date");
      if (staffId) q = q.eq("staff_id", staffId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (cert: { staff_id: string; certification_name: string; issuing_body?: string; issue_date?: string; expiry_date?: string; notes?: string }) => {
      const { data, error } = await supabase.from("staff_certifications").insert(cert).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["staff_certifications"] }); toast.success("Certification added"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Record<string, unknown>) => {
      const { error } = await supabase.from("staff_certifications").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["staff_certifications"] }); toast.success("Certification updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, create, update };
}
