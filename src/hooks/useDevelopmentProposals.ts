import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type ProposalPhase =
  | "Identified"
  | "Qualified"
  | "Drafting"
  | "Submitted"
  | "Awarded"
  | "Declined";

export interface DevelopmentProposal {
  id: string;
  title: string;
  phase: ProposalPhase | null;
  internal_owner: string | null;
  requested_amount: number | null;
  awarded_amount: number | null;
  submitted_at: string | null;
  decision_at: string | null;
  notes: string | null;
  ngo_id: string | null;
  grant_opportunity_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DevelopmentProposalWithRelations extends DevelopmentProposal {
  opportunity?: {
    id: string;
    name: string;
    funder_id: string | null;
    program_area: string | null;
    deadline: string | null;
    loi_due: string | null;
    proposal_due: string | null;
  } | null;
  ngo?: {
    id: string;
    legal_name: string;
    common_name: string | null;
    bundle: string | null;
  } | null;
  owner?: {
    id: string;
    full_name: string | null;
    email: string | null;
  } | null;
}

export interface CreateDevelopmentProposalInput {
  title: string;
  phase?: ProposalPhase | null;
  internal_owner?: string | null;
  requested_amount?: number | null;
  awarded_amount?: number | null;
  submitted_at?: string | null;
  decision_at?: string | null;
  notes?: string | null;
  ngo_id?: string | null;
  grant_opportunity_id?: string | null;
}

const proposalsTable = "proposals";

export const useDevelopmentProposals = () =>
  useQuery({
    queryKey: ["development-proposals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(proposalsTable as never)
        .select(
          "*, opportunity:grant_opportunities(id, name, funder_id, program_area, deadline, loi_due, proposal_due), ngo:ngos(id, legal_name, common_name, bundle), owner:profiles(id, full_name, email)",
        )
        .order("submitted_at", { ascending: false, nullsFirst: false });

      if (error) throw error;
      return data as DevelopmentProposalWithRelations[];
    },
  });

export const useCreateDevelopmentProposal = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: CreateDevelopmentProposalInput) => {
      const { data, error } = await supabase
        .from(proposalsTable as never)
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data as DevelopmentProposal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["development-proposals"] });
      toast({
        title: "Proposal saved",
        description: "The proposal has been saved.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Failed to save proposal",
        description: error.message,
      });
    },
  });
};

export const useUpdateDevelopmentProposal = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<DevelopmentProposal> & { id: string }) => {
      const { data, error } = await supabase
        .from(proposalsTable as never)
        .update(input)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as DevelopmentProposal;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["development-proposals"] });
      queryClient.invalidateQueries({ queryKey: ["development-proposals", data.id] });
      toast({
        title: "Proposal updated",
        description: "The proposal has been updated.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Failed to update proposal",
        description: error.message,
      });
    },
  });
};
