import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useCRMContacts(filters?: { organization_id?: string; search?: string }) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["crm_contacts", filters],
    queryFn: async () => {
      let q = supabase.from("crm_contacts").select("*, crm_organizations(id, name, org_type)").order("last_name");
      if (filters?.organization_id) q = q.eq("organization_id", filters.organization_id);
      if (filters?.search) q = q.or(`first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (contact: { first_name: string; last_name: string; organization_id?: string; email?: string; phone?: string; title?: string; department?: string; is_primary?: boolean; notes?: string }) => {
      const { data, error } = await supabase.from("crm_contacts").insert(contact).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["crm_contacts"] }); toast.success("Contact created"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, create };
}
