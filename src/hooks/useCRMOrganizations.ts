import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useCRMOrganizations(filters?: { org_type?: string; search?: string }) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["crm_organizations", filters],
    queryFn: async () => {
      let q = supabase.from("crm_organizations").select("*").order("name");
      if (filters?.org_type) q = q.eq("org_type", filters.org_type);
      if (filters?.search) q = q.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (org: { name: string; org_type: string; email?: string; phone?: string; website?: string; city?: string; country?: string; description?: string; industry?: string }) => {
      const { data, error } = await supabase.from("crm_organizations").insert(org).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["crm_organizations"] }); toast.success("Organization created"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Record<string, unknown>) => {
      const { error } = await supabase.from("crm_organizations").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["crm_organizations"] }); toast.success("Organization updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, create, update };
}
