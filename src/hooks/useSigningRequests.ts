import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { SigningRequestWithDocument } from "@/types/esignature";
import { toast } from "sonner";

export function useSigningRequests() {
  return useQuery({
    queryKey: ["signing-requests"],
    queryFn: async (): Promise<SigningRequestWithDocument[]> => {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from("signing_requests" as never)
        .select("*, esign_documents(original_filename)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SigningRequestWithDocument[];
    },
  });
}

export function useCreateSigningRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      document_id: string;
      signer_name: string;
      signer_email: string;
      expires_at: string;
      ngo_id?: string;
      work_item_id?: string;
    }) => {
      if (!supabase) throw new Error("Not connected");

      const { data: { user } } = await supabase.auth.getUser();

      // Fetch document name for email
      const { data: docData } = await supabase
        .from("esign_documents" as never)
        .select("original_filename")
        .eq("id", params.document_id)
        .single() as { data: { original_filename: string } | null };

      // Fetch requester profile name
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", user?.id ?? "")
        .single();

      const { data, error } = await supabase
        .from("signing_requests" as never)
        .insert({
          document_id: params.document_id,
          signer_name: params.signer_name,
          signer_email: params.signer_email,
          expires_at: params.expires_at,
          created_by_user_id: user?.id,
          ngo_id: params.ngo_id || null,
          work_item_id: params.work_item_id || null,
        } as never)
        .select()
        .single();
      if (error) throw error;

      const record = data as { token: string };

      // Send signing email via edge function
      try {
        const response = await supabase.functions.invoke("send-signing-email", {
          body: {
            signer_name: params.signer_name,
            signer_email: params.signer_email,
            token: record.token,
            document_name: docData?.original_filename ?? null,
            requester_name: profileData?.full_name ?? profileData?.email ?? null,
            expires_at: params.expires_at,
          },
        });

        if (response.data?.signing_link) {
          // SMTP not configured — return the link for manual sharing
          return { ...record, signing_link: response.data.signing_link };
        }
      } catch (emailError) {
        console.error("Failed to send signing email:", emailError);
        toast.error("Signing request created but email failed to send");
      }

      return record as { token: string; signing_link?: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signing-requests"] });
    },
  });
}
