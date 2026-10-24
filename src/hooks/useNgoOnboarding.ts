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
      if (!data) throw new Error("No agreement was returned for this organization. Please contact HPG Development.");
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
    mutationFn: async ({ signerName, signerTitle, signatureDataUrl }: { signerName: string; signerTitle: string; signatureDataUrl: string }) => {
      if (!agreement.data?.id || agreement.data.status !== "hpg_signed") throw new Error("The HPG-signed agreement must be available before signing.");
      const { data, error } = await supabase.functions.invoke("sign-ngo-agreement", {
        body: { agreementId: agreement.data.id, party: "ngo", signerName, signerTitle, signatureDataUrl, consent: true },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => { invalidate(); toast.success("Agreement signed"); },
    onError: (error: Error) => toast.error(error.message),
  });

  const downloadAgreement = async () => {
    const item = agreement.data;
    const path = item?.status === "executed" ? item?.executed_pdf_path : item?.hpg_signed_pdf_path;
    if (!path) throw new Error("The signed agreement document has not been made available.");
    const { data, error } = await supabase.storage.from("ngo-agreements").createSignedUrl(path, 120);
    if (error || !data?.signedUrl) throw error || new Error("Unable to generate a secure agreement link.");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

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

  return { onboarding, agreement, payments, banks, signAgreement, downloadAgreement, createPayment, createBankLink, exchangePlaid };
}
