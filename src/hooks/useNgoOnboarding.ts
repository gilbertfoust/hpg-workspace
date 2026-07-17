import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useNgoOnboarding(ngoId?: string) {
  const queryClient = useQueryClient();
  const enabled = Boolean(ngoId);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["ngo-onboarding", ngoId] });

  const onboarding = useQuery({
    queryKey: ["ngo-onboarding", ngoId, "status"],
    enabled,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("ngo_portal_onboarding").select("*").eq("ngo_id", ngoId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const agreement = useQuery({
    queryKey: ["ngo-onboarding", ngoId, "agreement", onboarding.data?.agreement_id],
    enabled: Boolean(onboarding.data?.agreement_id),
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("ngo_agreements").select("*").eq("id", onboarding.data.agreement_id).single();
      if (error) throw error;
      return data;
    },
  });

  const payments = useQuery({
    queryKey: ["ngo-onboarding", ngoId, "payments"],
    enabled,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("ngo_onboarding_payment_sessions").select("*").eq("ngo_id", ngoId).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const banks = useQuery({
    queryKey: ["ngo-onboarding", ngoId, "banks"],
    enabled,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("ngo_bank_connections").select("*").eq("ngo_id", ngoId).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const signAgreement = useMutation({
    mutationFn: async ({ signerName, signerTitle, signatureDocumentId }: { signerName: string; signerTitle: string; signatureDocumentId: string }) => {
      const { data, error } = await (supabase as any).rpc("sign_ngo_agreement", {
        p_agreement_id: agreement.data?.id,
        p_signer_name: signerName,
        p_signer_title: signerTitle,
        p_signature_document_id: signatureDocumentId,
        p_electronic_consent: true,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { invalidate(); toast.success("Agreement signed"); },
    onError: (error: Error) => toast.error(error.message),
  });

  const createPayment = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("create-ngo-onboarding-payment", { body: { ngoId } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { checkoutUrl: string };
    },
    onSuccess: (data) => { invalidate(); window.location.assign(data.checkoutUrl); },
    onError: (error: Error) => toast.error(error.message),
  });

  const createBankLink = useMutation({
    mutationFn: async (input: { countryCode: string; currency: string; provider: string }) => {
      const { data, error } = await supabase.functions.invoke("create-ngo-bank-link", { body: { ngoId, ...input } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const exchangePlaid = useMutation({
    mutationFn: async ({ connectionId, publicToken, accountId }: { connectionId: string; publicToken: string; accountId?: string }) => {
      const { data, error } = await supabase.functions.invoke("exchange-ngo-bank-link", { body: { connectionId, publicToken, accountId } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => { invalidate(); toast.success("Bank connection verified"); },
    onError: (error: Error) => toast.error(error.message),
  });

  return { onboarding, agreement, payments, banks, signAgreement, createPayment, createBankLink, exchangePlaid };
}
