import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getSupabaseNotConfiguredError,
  supabase,
} from "@/integrations/supabase/client";

export interface CreateInternationalActivationInvitationInput {
  caseId: string;
  recipientEmail?: string | null;
  recipientName?: string | null;
  expiresInDays?: number;
}

export interface CreateInternationalActivationInvitationResult {
  ok: boolean;
  invitation_id: string;
  case_reference: string;
  form_url: string;
  expires_at: string;
  communication_queued: boolean;
}

const ensureSupabase = () => {
  if (!supabase) throw getSupabaseNotConfiguredError();
  return supabase;
};

const publicApplicationBaseUrl = () => {
  if (typeof window === "undefined") return "";
  const basePath = import.meta.env.BASE_URL || "/";
  return new URL(basePath, window.location.origin).toString().replace(/\/$/, "");
};

export function useCreateInternationalActivationInvitation() {
  const queryClient = useQueryClient();

  return useMutation<
    CreateInternationalActivationInvitationResult,
    Error,
    CreateInternationalActivationInvitationInput
  >({
    mutationFn: async ({ caseId, recipientEmail, recipientName, expiresInDays = 14 }) => {
      const client = ensureSupabase();
      const { data, error } = await client.functions.invoke("agent-os-external-form", {
        body: {
          action: "create",
          case_id: caseId,
          recipient_email: recipientEmail || undefined,
          recipient_name: recipientName || undefined,
          expires_in_days: expiresInDays,
          public_base_url: publicApplicationBaseUrl(),
        },
      });

      const result = (data || {}) as Partial<CreateInternationalActivationInvitationResult> & {
        error?: string;
      };

      if (error) {
        throw new Error(result.error || error.message || "The secure activation form could not be queued.");
      }
      if (result.error) throw new Error(result.error);
      if (!result.ok || !result.invitation_id || !result.form_url) {
        throw new Error("The secure activation form service returned an incomplete response.");
      }

      return result as CreateInternationalActivationInvitationResult;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["agent-os-cases"] }),
        queryClient.invalidateQueries({ queryKey: ["agent-os-operations"] }),
      ]);
    },
  });
}
