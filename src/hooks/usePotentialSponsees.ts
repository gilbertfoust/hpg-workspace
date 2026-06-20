import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export type SponseeOutreachStatus =
  | "research"
  | "contacted"
  | "in_conversation"
  | "on_hold"
  | "declined"
  | "converted";

export interface PotentialSponsee {
  id: string;
  organization_name: string;
  country: string | null;
  state_province: string | null;
  city: string | null;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  mission_area: string | null;
  sponsorship_fit: string | null;
  outreach_status: SponseeOutreachStatus;
  next_follow_up_date: string | null;
  assigned_owner_user_id: string | null;
  notes: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export type PotentialSponseeInput = Omit<
  PotentialSponsee,
  "id" | "created_at" | "updated_at" | "created_by_user_id"
>;

const ensureSupabase = () => {
  if (!supabase) {
    throw getSupabaseNotConfiguredError();
  }
};

const tableMissingMessage =
  "Potential sponsees table is not available yet. Apply the proposed potential_sponsees migration first.";

export const usePotentialSponsees = () => {
  return useQuery({
    queryKey: ["potential-sponsees"],
    enabled: !!supabase,
    queryFn: async () => {
      ensureSupabase();
      const { data, error } = await supabase
        .from("potential_sponsees" as never)
        .select("*")
        .order("organization_name", { ascending: true });

      if (error) {
        if (error.code === "42P01" || error.message.includes("does not exist")) {
          return [] as PotentialSponsee[];
        }
        throw error;
      }
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

      const { data, error } = await supabase
        .from("potential_sponsees" as never)
        .insert({ ...input, created_by_user_id: user.id } as never)
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
        description:
          error.message.includes("does not exist") || error.message.includes("42P01")
            ? tableMissingMessage
            : error.message,
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
      const { data, error } = await supabase
        .from("potential_sponsees" as never)
        .update(input as never)
        .eq("id" as never, id as never)
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
