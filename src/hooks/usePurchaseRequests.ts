import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ensureSupabase, supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PurchaseRequestRecord {
  id: string;
  ngo_id: string;
  title: string;
  description: string | null;
  requested_by_user_id: string | null;
  department_id: string | null;
  priority: string;
  status: string;
  estimated_amount: number | null;
  currency_code: string | null;
  needed_by: string | null;
  approved_by_user_id: string | null;
  approved_at: string | null;
  rejected_reason: string | null;
  notes: string | null;
  submitted_at?: string | null;
  reviewed_by_user_id?: string | null;
  reviewed_at?: string | null;
  work_item_id?: string | null;
  created_at: string;
  updated_at: string;
  ngos: { legal_name: string; common_name: string | null } | null;
  profiles: { full_name: string | null } | null;
  org_units: { department_name: string } | null;
}

export interface PurchaseRequestInput {
  title: string;
  ngo_id: string;
  description?: string;
  estimated_amount?: number;
  priority?: string;
  needed_by?: string;
  department_id?: string;
  notes?: string;
  currency_code?: string;
}

export function usePurchaseRequests(filters?: { status?: string; ngo_id?: string }) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["purchase_requests", filters],
    enabled: !!supabase,
    queryFn: async (): Promise<PurchaseRequestRecord[]> => {
      const client = ensureSupabase();
      let request = client
        .from("purchase_requests")
        .select("*, ngos(legal_name, common_name), profiles(full_name), org_units(department_name)")
        .order("created_at", { ascending: false });
      if (filters?.status) request = request.eq("status", filters.status);
      if (filters?.ngo_id) request = request.eq("ngo_id", filters.ngo_id);
      const { data, error } = await request;
      if (error) throw error;
      return (data ?? []) as unknown as PurchaseRequestRecord[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: PurchaseRequestInput) => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc("save_purchase_request" as never, {
        _request_id: null,
        _payload: input,
      } as never);
      if (error) throw error;
      return data as unknown as PurchaseRequestRecord;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["purchase_requests"] });
      void queryClient.invalidateQueries({ queryKey: ["finance-hub-snapshot"] });
      toast.success("Purchase request created");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, rejected_reason }: {
      id: string;
      status: "pending_approval" | "approved" | "rejected";
      rejected_reason?: string;
    }) => {
      const client = ensureSupabase();
      if (status === "pending_approval") {
        const { error } = await client.rpc("submit_purchase_request" as never, { _request_id: id } as never);
        if (error) throw error;
        return;
      }

      const { error } = await client.rpc("review_purchase_request" as never, {
        _request_id: id,
        _decision: status,
        _reason: rejected_reason ?? null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["purchase_requests"] });
      void queryClient.invalidateQueries({ queryKey: ["finance-workflow-events"] });
      void queryClient.invalidateQueries({ queryKey: ["finance-hub-snapshot"] });
      void queryClient.invalidateQueries({ queryKey: ["work-items"] });
      toast.success("Purchase request status updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return { ...query, create, updateStatus };
}
