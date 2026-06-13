import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import type { ModuleType } from "@/hooks/useWorkItems";

export interface NgoRequestTemplate {
  id: string;
  name: string;
  description: string | null;
  request_type: string;
  default_module: ModuleType | null;
  schema_json: unknown;
  is_active: boolean;
  created_at: string;
}

export interface NgoRequestSubmission {
  id: string;
  template_id: string;
  ngo_id: string;
  user_id: string;
  payload_json: Record<string, unknown>;
  status: string;
  requested_module: ModuleType | null;
  routed_module: ModuleType | null;
  routed_work_item_id: string | null;
  coordinator_notes: string | null;
  submitted_at: string;
  routed_at: string | null;
  created_at: string;
  ngo_request_templates?: { name: string; request_type: string } | null;
}

const ensureSupabase = () => {
  if (!supabase) throw getSupabaseNotConfiguredError();
  return supabase;
};

export const useNgoRequestTemplates = () => {
  return useQuery<NgoRequestTemplate[]>({
    queryKey: ["ngo-request-templates"],
    enabled: !!supabase,
    queryFn: async () => {
      const client = ensureSupabase();
      const { data, error } = await client
        .from("ngo_request_templates" as never)
        .select("*" as never)
        .eq("is_active" as never, true as never)
        .order("name" as never, { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as NgoRequestTemplate[];
    },
  });
};

export const useNgoRequestSubmissions = (ngoIds: string[]) => {
  return useQuery<NgoRequestSubmission[]>({
    queryKey: ["ngo-request-submissions", ngoIds],
    enabled: ngoIds.length > 0 && !!supabase,
    queryFn: async () => {
      const client = ensureSupabase();
      const { data, error } = await client
        .from("ngo_request_submissions" as never)
        .select("*, ngo_request_templates(name, request_type)" as never)
        .in("ngo_id" as never, ngoIds as never)
        .order("submitted_at" as never, { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as NgoRequestSubmission[];
    },
  });
};

export const useCreateNgoRequestSubmission = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      template,
      ngoId,
      payload,
      requestedModule,
    }: {
      template: NgoRequestTemplate;
      ngoId: string;
      payload: Record<string, unknown>;
      requestedModule?: ModuleType | null;
    }) => {
      if (!user?.id) throw new Error("You must be logged in to submit a request.");
      const client = ensureSupabase();
      const { data, error } = await client
        .from("ngo_request_submissions" as never)
        .insert({
          template_id: template.id,
          ngo_id: ngoId,
          user_id: user.id,
          payload_json: payload,
          requested_module: requestedModule || template.default_module || "ngo_coordination",
          status: "submitted_to_ngo_coordination",
        } as never)
        .select("*" as never)
        .single();

      if (error) throw error;
      return data as unknown as NgoRequestSubmission;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ngo-request-submissions"] });
      toast({
        title: "Request submitted",
        description: "Your request was sent to NGO Coordination for review.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Unable to submit request",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    },
  });
};
