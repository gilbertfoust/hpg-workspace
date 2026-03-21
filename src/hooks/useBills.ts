import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useBills(ngoId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["bills", ngoId],
    enabled: !!ngoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bills")
        .select("*")
        .eq("ngo_id", ngoId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (bill: {
      ngo_id: string;
      bill_number: string;
      vendor_name: string;
      vendor_org_id?: string;
      bill_date?: string;
      due_date: string;
      subtotal?: number;
      tax_amount?: number;
      total?: number;
      notes?: string;
      ap_account_id?: string;
      fiscal_period_id?: string;
    }) => {
      const { data, error } = await supabase.from("bills").insert(bill).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bills"] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { error } = await supabase.from("bills").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bills"] }),
  });

  return { ...query, create, update };
}

export function useBillLineItems(billId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["bill_line_items", billId],
    enabled: !!billId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bill_line_items")
        .select("*")
        .eq("bill_id", billId!)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (item: {
      bill_id: string;
      description: string;
      quantity?: number;
      unit_price?: number;
      account_id?: string;
      amount?: number;
    }) => {
      const { data, error } = await supabase.from("bill_line_items").insert(item).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bill_line_items"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bill_line_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bill_line_items"] }),
  });

  return { ...query, create, remove };
}
