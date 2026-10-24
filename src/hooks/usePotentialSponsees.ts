import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SponseeOutreachStatus = "research" | "contacted" | "in_conversation" | "on_hold" | "declined" | "converted";
// Aligned with the existing user_access_bundle migration; do not regenerate unrelated schema types.
export type PotentialSponsee = {
  id: string; organization_name: string; country: string | null; state_province: string | null;
  city: string | null; contact_person: string | null; email: string | null; phone: string | null;
  website: string | null; mission_area: string | null; sponsorship_fit: string | null;
  outreach_status: SponseeOutreachStatus; next_follow_up_date: string | null;
  assigned_owner_user_id: string | null; notes: string | null; created_by_user_id: string | null;
  created_at: string; updated_at: string;
};
export type PotentialSponseeInput = Pick<PotentialSponsee, "organization_name"> & Partial<Omit<PotentialSponsee, "organization_name">>;
type ProspectDatabase = { public: { Tables: { potential_sponsees: {
  Row: PotentialSponsee; Insert: PotentialSponseeInput; Update: Partial<PotentialSponseeInput>; Relationships: [];
} }; Views: {}; Functions: {} } };
const prospectClient = supabase as unknown as SupabaseClient<ProspectDatabase>;

const ensureSupabase = () => {
  if (!supabase) {
    throw getSupabaseNotConfiguredError();
  }
};

export const usePotentialSponsees = () => {
  return useQuery({
    queryKey: ["potential-sponsees"],
    enabled: !!supabase,
    queryFn: async () => {
      ensureSupabase();
      const { data, error } = await prospectClient
        .from("potential_sponsees")
        .select("*")
        .order("organization_name", { ascending: true });

      if (error) throw error;
      return (data || []) as PotentialSponsee[];
    },
  });
};

export const useCreatePotentialSponsee = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: PotentialSponseeInput) => {
      ensureSupabase();
      if (!user?.id) throw new Error("You must be signed in.");

      const { data, error } = await prospectClient
        .from("potential_sponsees")
        .insert({ ...input, created_by_user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      return data as PotentialSponsee;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["potential-sponsees"] });
      toast({ title: "Prospect saved", description: "Potential sponsee added to the pipeline." });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Could not save prospect",
        description: error.message,
      });
    },
  });
};

export const useUpdatePotentialSponsee = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<PotentialSponseeInput> & { id: string }) => {
      ensureSupabase();
      const { data, error } = await prospectClient
        .from("potential_sponsees")
        .update(input)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as PotentialSponsee;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["potential-sponsees"] });
      toast({ title: "Prospect updated" });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message,
      });
    },
  });
};
