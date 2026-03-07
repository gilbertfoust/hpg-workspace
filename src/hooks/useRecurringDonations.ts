import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useRecurringDonations(filters?: { ngo_id?: string; status?: string }) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["recurring_donations", filters],
    queryFn: async () => {
      let q = supabase!.from("recurring_donations")
        .select("*, revenue_streams(name), crm_organizations(name)")
        .order("created_at", { ascending: false });
      if (filters?.ngo_id) q = q.eq("ngo_id", filters.ngo_id);
      if (filters?.status) q = q.eq("status", filters.status);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!supabase,
  });

  const create = useMutation({
    mutationFn: async (donation: { ngo_id: string; donor_name: string; amount: number; frequency: string; start_date: string; revenue_stream_id?: string; donor_email?: string; donor_org_id?: string; payment_method?: string; notes?: string }) => {
      const { data, error } = await supabase!.from("recurring_donations").insert(donation).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["recurring_donations"] }); toast.success("Recurring donation added"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Record<string, unknown>) => {
      const { error } = await supabase!.from("recurring_donations").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["recurring_donations"] }); toast.success("Donation updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, create, update };
}
