import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useInvoices(ngoId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["invoices", ngoId],
    enabled: !!ngoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("ngo_id", ngoId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (inv: {
      ngo_id: string;
      invoice_number: string;
      customer_name: string;
      customer_email?: string;
      issue_date?: string;
      due_date: string;
      subtotal?: number;
      tax_amount?: number;
      total?: number;
      notes?: string;
      ar_account_id?: string;
      fiscal_period_id?: string;
    }) => {
      const { data, error } = await supabase.from("invoices").insert(inv).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoices"] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { error } = await supabase.from("invoices").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoices"] }),
  });

  return { ...query, create, update };
}

export function useInvoiceLineItems(invoiceId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["invoice_line_items", invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_line_items")
        .select("*")
        .eq("invoice_id", invoiceId!)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (item: {
      invoice_id: string;
      description: string;
      quantity?: number;
      unit_price?: number;
      account_id?: string;
      tax_rate_id?: string;
      amount?: number;
    }) => {
      const { data, error } = await supabase.from("invoice_line_items").insert(item).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoice_line_items"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invoice_line_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoice_line_items"] }),
  });

  return { ...query, create, remove };
}
