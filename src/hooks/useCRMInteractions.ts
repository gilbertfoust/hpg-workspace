import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useCRMInteractions(filters?: { organization_id?: string; contact_id?: string }) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["crm_interactions", filters],
    queryFn: async () => {
      let q = supabase.from("crm_interactions")
        .select("*, crm_organizations(name), crm_contacts(first_name, last_name), profiles(full_name)")
        .order("interaction_date", { ascending: false });
      if (filters?.organization_id) q = q.eq("organization_id", filters.organization_id);
      if (filters?.contact_id) q = q.eq("contact_id", filters.contact_id);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (interaction: { subject: string; interaction_type: string; organization_id?: string; contact_id?: string; description?: string; interaction_date?: string; logged_by_user_id?: string }) => {
      const { data, error } = await supabase.from("crm_interactions").insert(interaction).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["crm_interactions"] }); toast.success("Interaction logged"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, create };
}
