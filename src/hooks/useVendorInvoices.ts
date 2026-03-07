import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useVendorInvoices(filters?: { status?: string; ngo_id?: string }) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["vendor_invoices", filters],
    queryFn: async () => {
      let q = supabase.from("vendor_invoices")
        .select("*, ngos(legal_name, common_name), crm_organizations(name), purchase_orders(po_number)")
        .order("created_at", { ascending: false });
      if (filters?.status) q = q.eq("status", filters.status);
      if (filters?.ngo_id) q = q.eq("ngo_id", filters.ngo_id);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (inv: { ngo_id: string; invoice_number: string; vendor_org_id?: string; purchase_order_id?: string; invoice_date?: string; due_date?: string; subtotal?: number; tax_amount?: number; total_amount?: number; notes?: string }) => {
      const { data, error } = await supabase.from("vendor_invoices").insert(inv).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["vendor_invoices"] }); toast.success("Invoice created"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, approved_by_user_id, transaction_id, payment_date, payment_reference }: { id: string; status: string; approved_by_user_id?: string; transaction_id?: string; payment_date?: string; payment_reference?: string }) => {
      const updates: Record<string, unknown> = { status };
      if (status === "approved" && approved_by_user_id) { updates.approved_by_user_id = approved_by_user_id; updates.approved_at = new Date().toISOString(); }
      if (status === "paid") { if (transaction_id) updates.transaction_id = transaction_id; if (payment_date) updates.payment_date = payment_date; if (payment_reference) updates.payment_reference = payment_reference; }
      const { error } = await supabase.from("vendor_invoices").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["vendor_invoices"] }); toast.success("Invoice status updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, create, updateStatus };
}
