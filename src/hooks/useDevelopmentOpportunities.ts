import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface DevelopmentOpportunity {
  id: string;
  name: string;
  funder_id: string | null;
  program_area: string | null;
  min_amount: number | null;
  max_amount: number | null;
  deadline: string | null;
  loi_due: string | null;
  proposal_due: string | null;
  status: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DevelopmentOpportunityWithFunder extends DevelopmentOpportunity {
  funder?: {
    id: string;
    name: string;
    type: string | null;
  } | null;
}

export interface CreateDevelopmentOpportunityInput {
  name: string;
  funder_id?: string | null;
  program_area?: string;
  min_amount?: number | null;
  max_amount?: number | null;
  deadline?: string | null;
  loi_due?: string | null;
  proposal_due?: string | null;
  status?: string | null;
  notes?: string | null;
}

const opportunitiesTable = "grant_opportunities";

export const useDevelopmentOpportunities = () =>
  useQuery({
    queryKey: ["development-opportunities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(opportunitiesTable as never)
        .select("*, funder:funders(id, name, type)")
        .order("deadline", { ascending: true, nullsFirst: false });

      if (error) throw error;
      return data as DevelopmentOpportunityWithFunder[];
    },
  });

export const useCreateDevelopmentOpportunity = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: CreateDevelopmentOpportunityInput) => {
      const { data, error } = await supabase
        .from(opportunitiesTable as never)
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data as DevelopmentOpportunity;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["development-opportunities"] });
      toast({
        title: "Opportunity saved",
        description: "The grant opportunity has been saved.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Failed to save opportunity",
        description: error.message,
      });
    },
  });
};

export const useUpdateDevelopmentOpportunity = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<DevelopmentOpportunity> & { id: string }) => {
      const { data, error } = await supabase
        .from(opportunitiesTable as never)
        .update(input)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as DevelopmentOpportunity;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["development-opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["development-opportunities", data.id] });
      toast({
        title: "Opportunity updated",
        description: "The grant opportunity has been updated.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Failed to update opportunity",
        description: error.message,
      });
    },
  });
};
