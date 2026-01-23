import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface DevelopmentFunder {
  id: string;
  name: string;
  type: string | null;
  website: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateDevelopmentFunderInput {
  name: string;
  type?: string;
  website?: string;
  notes?: string;
}

const fundersTable = "funders";

export const useDevelopmentFunders = () =>
  useQuery({
    queryKey: ["development-funders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(fundersTable as never)
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      return data as DevelopmentFunder[];
    },
  });

export const useCreateDevelopmentFunder = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: CreateDevelopmentFunderInput) => {
      const { data, error } = await supabase
        .from(fundersTable as never)
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data as DevelopmentFunder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["development-funders"] });
      toast({
        title: "Funder saved",
        description: "The funder record has been updated.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Failed to save funder",
        description: error.message,
      });
    },
  });
};

export const useUpdateDevelopmentFunder = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<DevelopmentFunder> & { id: string }) => {
      const { data, error } = await supabase
        .from(fundersTable as never)
        .update(input)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as DevelopmentFunder;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["development-funders"] });
      queryClient.invalidateQueries({ queryKey: ["development-funders", data.id] });
      toast({
        title: "Funder updated",
        description: "The funder record has been updated.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Failed to update funder",
        description: error.message,
      });
    },
  });
};
