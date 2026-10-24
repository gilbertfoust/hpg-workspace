import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useRef } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { agreementPdfPath, releasedAgreementStatuses, resolveReleasedAgreement, type NgoAgreement } from "@/lib/ngoAgreement";

// Narrow adapter for existing live tables missing from this snapshot's generated types.
type AgreementDatabase = { public: { Tables: {
  ngo_agreements: { Row: NgoAgreement; Insert: Partial<NgoAgreement>; Update: Partial<NgoAgreement>; Relationships: [] };
  ngo_portal_onboarding: { Row: { ngo_id: string; agreement_id: string | null }; Insert: { ngo_id: string; agreement_id?: string | null }; Update: { agreement_id?: string | null }; Relationships: [] };
}; Views: {}; Functions: {}; Enums: {}; CompositeTypes: {} } };
const agreementClient = supabase as unknown as SupabaseClient<AgreementDatabase>;

export function useReleasedNgoAgreement(ngoId?: string) {
  const onboarding = useQuery({
    queryKey: ["ngo-onboarding", ngoId, "status"],
    enabled: Boolean(ngoId),
    queryFn: async () => {
      if (!ngoId) return null;
      const { data, error } = await agreementClient.from("ngo_portal_onboarding").select("ngo_id, agreement_id").eq("ngo_id", ngoId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const agreement = useQuery({
    queryKey: ["ngo-onboarding", ngoId, "agreement", onboarding.data?.agreement_id],
    enabled: Boolean(ngoId) && !onboarding.isPending,
    queryFn: async () => {
      if (!ngoId) return null;
      return resolveReleasedAgreement(ngoId, onboarding.data?.agreement_id, async (id) => {
        const { data, error } = await agreementClient.from("ngo_agreements").select("*").eq("ngo_id", ngoId).eq("id", id).in("status", releasedAgreementStatuses).maybeSingle();
        if (error) throw error;
        return data;
      }, async () => {
        const { data, error } = await agreementClient.from("ngo_agreements").select("*").eq("ngo_id", ngoId).in("status", releasedAgreementStatuses).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(1).maybeSingle();
        if (error) throw error;
        return data;
      });
    },
  });
  const pdfPath = agreementPdfPath(agreement.data ?? null, ngoId ?? "");
  const downloadAgreement = async () => {
    if (!pdfPath) throw new Error("The signed agreement PDF is not available. Please contact HPG Development.");
    const { data, error } = await supabase.storage.from("ngo-agreements").createSignedUrl(pdfPath, 60, { download: "Fiscal-Sponsorship-Agreement.pdf" });
    if (error || !data?.signedUrl) throw error || new Error("Unable to access the signed agreement PDF.");
    window.location.assign(data.signedUrl);
  };
  const previewAgreement = async () => {
    // Reserve the tab during the click, before any asynchronous authenticated fetch.
    const tab = window.open("", "_blank");
    if (!tab) throw new Error("Please allow a new tab to preview the agreement, or use Download.");
    tab.opener = null;
    try {
      if (!pdfPath) throw new Error("The signed agreement PDF is not available. Please contact HPG Development.");
      const { data, error } = await supabase.storage.from("ngo-agreements").download(pdfPath);
      if (error || !data) throw error || new Error("Unable to preview the signed agreement PDF.");
      const url = URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
      tab.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 300_000);
    } catch (error) { tab.close(); throw error; }
  };
  return { onboarding, agreement, pdfPath, downloadAgreement, previewAgreement };
}

export function useNgoOnboarding(ngoId?: string) {
  const queryClient = useQueryClient();
  const enabled = Boolean(ngoId);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["ngo-onboarding", ngoId] });
  const { onboarding, agreement, pdfPath, downloadAgreement, previewAgreement } = useReleasedNgoAgreement(ngoId);
  const signing = useRef(false);
  const submittedAgreementId = useRef<string | null>(null);

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
      const item = agreement.data;
      if (!item || item.ngo_id !== ngoId || item.status !== "hpg_signed" || !pdfPath) throw new Error("The HPG-signed agreement must be available before signing.");
      if (signing.current || submittedAgreementId.current === item.id) throw new Error("This agreement has already been submitted for signature.");
      signing.current = true;
      try {
      const fresh = await agreement.refetch();
      if (fresh.error) throw fresh.error;
      if (fresh.data?.id !== item.id || fresh.data.status !== "hpg_signed") throw new Error("The agreement has changed. Please review its current status before signing.");
      const { data, error } = await supabase.functions.invoke("sign-ngo-agreement", {
        body: { agreementId: item.id, party: "ngo", signerName, signerTitle, signatureDataUrl, consent: true },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      submittedAgreementId.current = item.id;
      return data;
      } finally { signing.current = false; await invalidate(); }
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

  return { onboarding, agreement, payments, banks, signAgreement, pdfPath, downloadAgreement, previewAgreement, createPayment, createBankLink, exchangePlaid };
}
