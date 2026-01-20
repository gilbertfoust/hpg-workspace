import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { Json } from "@/integrations/supabase/types";

export type RequisitionStatus = "Open" | "Paused" | "Closed";

export interface JobRequisition {
  id: string;
  title: string;
  department_id: string | null;
  location: string | null;
  employment_type: string | null;
  status: RequisitionStatus;
  description: string | null;
  created_at: string;
}

export interface CreateJobRequisitionInput {
  title: string;
  department_id?: string | null;
  location?: string | null;
  employment_type?: string | null;
  status?: RequisitionStatus;
  description?: string | null;
}

export interface UpdateJobRequisitionInput {
  id: string;
  title?: string;
  department_id?: string | null;
  location?: string | null;
  employment_type?: string | null;
  status?: RequisitionStatus;
  description?: string | null;
}

const requisitionsTable = "job_requisitions";

const createAuditEntry = async (entry: {
  action_type: string;
  entity_id?: string | null;
  before_json?: Json | null;
  after_json?: Json | null;
  actor_user_id?: string | null;
  reason?: string | null;
}) => {
  const { error } = await supabase.from("audit_log").insert({
    action_type: entry.action_type,
    entity_type: "job_requisition",
    entity_id: entry.entity_id ?? null,
    before_json: entry.before_json ?? null,
    after_json: entry.after_json ?? null,
    actor_user_id: entry.actor_user_id ?? null,
    reason: entry.reason ?? null,
  });

  if (error) throw error;
};

export const useHRRequisitions = () => {
  return useQuery({
    queryKey: ["hr", "job-requisitions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(requisitionsTable)
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as JobRequisition[];
    },
  });
};

export const useCreateHRRequisition = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateJobRequisitionInput) => {
      const { data, error } = await supabase
        .from(requisitionsTable)
        .insert({
          title: input.title,
          department_id: input.department_id ?? null,
          location: input.location ?? null,
          employment_type: input.employment_type ?? null,
          status: input.status ?? "Open",
          description: input.description ?? null,
        })
        .select("*")
        .single();

      if (error) throw error;

      await createAuditEntry({
        action_type: "created",
        entity_id: data.id,
        after_json: data as Json,
        actor_user_id: user?.id ?? null,
      });

      return data as JobRequisition;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr", "job-requisitions"] });
      toast({
        title: "Requisition created",
        description: "The job requisition has been added.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error creating requisition",
        description: error.message,
      });
    },
  });
};

export const useUpdateHRRequisition = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: UpdateJobRequisitionInput) => {
      const { data: before, error: beforeError } = await supabase
        .from(requisitionsTable)
        .select("*")
        .eq("id", input.id)
        .single();

      if (beforeError) throw beforeError;

      const { data, error } = await supabase
        .from(requisitionsTable)
        .update({
          title: input.title ?? before.title,
          department_id: input.department_id ?? before.department_id,
          location: input.location ?? before.location,
          employment_type: input.employment_type ?? before.employment_type,
          status: input.status ?? before.status,
          description: input.description ?? before.description,
        })
        .eq("id", input.id)
        .select("*")
        .single();

      if (error) throw error;

      await createAuditEntry({
        action_type: "updated",
        entity_id: data.id,
        before_json: before as Json,
        after_json: data as Json,
        actor_user_id: user?.id ?? null,
      });

      return data as JobRequisition;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr", "job-requisitions"] });
      toast({
        title: "Requisition updated",
        description: "The job requisition has been updated.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error updating requisition",
        description: error.message,
      });
    },
  });
};

export const useDeleteHRRequisition = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data: before, error: beforeError } = await supabase
        .from(requisitionsTable)
        .select("*")
        .eq("id", id)
        .single();

      if (beforeError) throw beforeError;

      const { error } = await supabase
        .from(requisitionsTable)
        .delete()
        .eq("id", id);

      if (error) throw error;

      await createAuditEntry({
        action_type: "deleted",
        entity_id: id,
        before_json: before as Json,
        actor_user_id: user?.id ?? null,
      });

      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr", "job-requisitions"] });
      toast({
        title: "Requisition removed",
        description: "The job requisition has been deleted.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error deleting requisition",
        description: error.message,
      });
    },
  });
};
