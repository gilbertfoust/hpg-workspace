import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type PartnershipStage =
  | "Prospect"
  | "Discovery"
  | "Negotiation"
  | "MOU Drafting"
  | "Active"
  | "Dormant";

export interface PartnershipPipelineRecord {
  id: string;
  partner_id: string | null;
  stage: PartnershipStage | null;
  notes: string | null;
  key_commitments: string | null;
  ngo_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PartnershipPipelineRecordWithPartner extends PartnershipPipelineRecord {
  partner?: {
    id: string;
    name: string;
    type: string | null;
    region: string | null;
    status: string | null;
    primary_contact: string | null;
  } | null;
}

export interface CreatePartnershipPipelineInput {
  partner_id?: string | null;
  stage?: PartnershipStage | null;
  notes?: string | null;
  key_commitments?: string | null;
  ngo_id?: string | null;
}

const pipelineTable = "partnership_pipeline";

export const usePartnershipsPipeline = () =>
  useQuery({
    queryKey: ["partnerships-pipeline"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(pipelineTable as never)
        .select("*, partner:partners(id, name, type, region, status, primary_contact)")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return data as PartnershipPipelineRecordWithPartner[];
    },
  });

export const useCreatePartnershipPipeline = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: CreatePartnershipPipelineInput) => {
      const { data, error } = await supabase
        .from(pipelineTable as never)
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data as PartnershipPipelineRecord;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partnerships-pipeline"] });
      toast({
        title: "Pipeline record saved",
        description: "The partnership pipeline record has been saved.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Failed to save pipeline record",
        description: error.message,
      });
    },
  });
};

export const useUpdatePartnershipPipeline = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<PartnershipPipelineRecord> & { id: string }) => {
      const { data, error } = await supabase
        .from(pipelineTable as never)
        .update(input)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as PartnershipPipelineRecord;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["partnerships-pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["partnerships-pipeline", data.id] });
      toast({
        title: "Pipeline record updated",
        description: "The partnership pipeline record has been updated.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Failed to update pipeline record",
        description: error.message,
      });
    },
  });
};
