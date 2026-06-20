import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

export type SponseeOutreachStatus = Database["public"]["Enums"]["sponsee_outreach_status"];
export type PotentialSponsee = Database["public"]["Tables"]["potential_sponsees"]["Row"];
export type PotentialSponseeInput = Database["public"]["Tables"]["potential_sponsees"]["Insert"];

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
      const { data, error } = await supabase
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

      const { data, error } = await supabase
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
      const { data, error } = await supabase
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
