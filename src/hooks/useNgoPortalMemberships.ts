import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface NgoPortalMembership {
  id: string;
  user_id: string;
  ngo_id: string;
  access_level: "viewer" | "preparer" | "approver" | "ngo_admin";
  status: "invited" | "active" | "suspended" | "revoked";
  can_manage_staff: boolean;
  invited_at: string;
  profiles?: { full_name?: string | null; email?: string | null } | null;
  ngos?: { legal_name: string; common_name?: string | null } | null;
}

export function useNgoPortalMemberships() {
  return useQuery({
    queryKey: ["ngo-portal-memberships"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ngo_portal_memberships")
        .select("*, profiles!ngo_portal_memberships_user_id_fkey(full_name,email), ngos(legal_name,common_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as NgoPortalMembership[];
    },
  });
}

export function useSetNgoPortalMembership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      membershipId,
      status,
      accessLevel,
    }: {
      membershipId: string;
      status: NgoPortalMembership["status"];
      accessLevel?: NgoPortalMembership["access_level"];
    }) => {
      const { data, error } = await (supabase as any).rpc("set_ngo_portal_membership", {
        p_membership_id: membershipId,
        p_status: status,
        p_access_level: accessLevel ?? null,
      });
      if (error) throw error;
      return data as NgoPortalMembership;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ngo-portal-memberships"] });
      toast.success("NGO portal access updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
