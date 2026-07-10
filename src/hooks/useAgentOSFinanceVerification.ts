import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getSupabaseNotConfiguredError,
  supabase,
} from "@/integrations/supabase/client";

const ensureSupabase = () => {
  if (!supabase) throw getSupabaseNotConfiguredError();
  return supabase;
};

export function useAgentOSFinanceAuthority() {
  return useQuery<boolean>({
    queryKey: ["agent-os-finance-authority"],
    enabled: !!supabase,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const client = ensureSupabase();
      const { data, error } = await client.rpc("agent_os_has_finance_authority" as never);
      if (error) {
        const message = error.message?.toLowerCase() || "";
        if (error.code === "PGRST202" || message.includes("agent_os_has_finance_authority")) {
          return false;
        }
        throw error;
      }
      return data === true;
    },
  });
}

export interface VerifyActivationFeeInput {
  caseId: string;
  paymentReference: string;
}

export function useVerifyAgentOSActivationFee() {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, VerifyActivationFeeInput>({
    mutationFn: async ({ caseId, paymentReference }) => {
      const normalizedReference = paymentReference.trim();
      if (!normalizedReference) throw new Error("A payment or transaction reference is required.");

      const client = ensureSupabase();
      const { data, error } = await client.rpc("agent_os_verify_activation_fee" as never, {
        p_case_id: caseId,
        p_payment_reference: normalizedReference,
        p_verified_at: new Date().toISOString(),
      } as never);

      if (error) throw new Error(error.message || "Finance verification could not be recorded.");
      return data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["agent-os-cases"] }),
        queryClient.invalidateQueries({ queryKey: ["agent-os-operations"] }),
      ]);
    },
  });
}
