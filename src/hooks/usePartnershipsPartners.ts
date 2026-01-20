import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface PartnershipPartner {
  id: string;
  name: string;
  type: string | null;
  region: string | null;
  status: string | null;
  primary_contact: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePartnershipPartnerInput {
  name: string;
  type?: string | null;
  region?: string | null;
  status?: string | null;
  primary_contact?: string | null;
  notes?: string | null;
}

const partnersTable = "partners";

export const usePartnershipsPartners = () =>
  useQuery({
    queryKey: ["partnerships-partners"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from(partnersTable)
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      return data as PartnershipPartner[];
    },
  });

export const useCreatePartnershipPartner = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: CreatePartnershipPartnerInput) => {
      const { data, error } = await (supabase as any)
        .from(partnersTable)
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data as PartnershipPartner;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partnerships-partners"] });
      toast({
        title: "Partner saved",
        description: "The partner record has been saved.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Failed to save partner",
        description: error.message,
      });
    },
  });
};

export const useUpdatePartnershipPartner = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<PartnershipPartner> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from(partnersTable)
        .update(input)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as PartnershipPartner;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["partnerships-partners"] });
      queryClient.invalidateQueries({ queryKey: ["partnerships-partners", data.id] });
      toast({
        title: "Partner updated",
        description: "The partner record has been updated.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Failed to update partner",
        description: error.message,
      });
    },
  });
};
