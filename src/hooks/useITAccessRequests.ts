import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { Priority, WorkItem } from "@/hooks/useWorkItems";
import { mapITStatusToWorkItemStatus, ITStatus } from "@/hooks/useITStatus";

export type AccessRequestType =
  | "Slack"
  | "Google Workspace"
  | "Trello"
  | "Drive"
  | "Other";

export interface AccessRequest {
  id: string;
  request_type: AccessRequestType;
  target_user: string;
  requested_by_user_id: string;
  justification: string;
  priority: Priority;
  status: ITStatus;
  work_item_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAccessRequestInput {
  request_type: AccessRequestType;
  target_user: string;
  requested_by_user_id?: string;
  justification: string;
  priority: Priority;
  status: ITStatus;
}

export const useITAccessRequests = () => {
  return useQuery({
    queryKey: ["access-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("access_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as AccessRequest[];
    },
  });
};

export const useCreateITAccessRequest = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateAccessRequestInput) => {
      const requestedBy = input.requested_by_user_id || user?.id;
      if (!requestedBy) {
        throw new Error("Requested by user is required.");
      }

      const title = `Access Request: ${input.request_type}`;
      const description = `Target user: ${input.target_user}\n\nJustification: ${input.justification}`;

      const { data: workItem, error: workItemError } = await supabase
        .from("work_items")
        .insert({
          title,
          description,
          module: "it",
          type: "Access Request",
          status: mapITStatusToWorkItemStatus(input.status),
          priority: input.priority,
          evidence_required: true,
          approval_required: false,
          external_visible: false,
        })
        .select()
        .single();

      if (workItemError) throw workItemError;

      const { data, error } = await supabase
        .from("access_requests")
        .insert({
          request_type: input.request_type,
          target_user: input.target_user,
          requested_by_user_id: requestedBy,
          justification: input.justification,
          priority: input.priority,
          status: input.status,
          work_item_id: (workItem as WorkItem).id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as AccessRequest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-requests"] });
      queryClient.invalidateQueries({ queryKey: ["work-items"] });
      queryClient.invalidateQueries({ queryKey: ["work-item-stats"] });
      toast({
        title: "Access request created",
        description: "The access request has been submitted.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error creating access request",
        description: error.message,
      });
    },
  });
};

export const useUpdateITAccessRequest = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<AccessRequest> & { id: string }) => {
      const { data, error } = await supabase
        .from("access_requests")
        .update(input)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as AccessRequest;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["access-requests"] });
      queryClient.invalidateQueries({ queryKey: ["access-requests", data.id] });
      toast({
        title: "Access request updated",
        description: "The access request has been updated.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error updating access request",
        description: error.message,
      });
    },
  });
};
