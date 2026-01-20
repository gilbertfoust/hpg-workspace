import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { Priority, WorkItem } from "@/hooks/useWorkItems";
import { mapITStatusToWorkItemStatus, ITStatus } from "@/hooks/useITStatus";

export interface Ticket {
  id: string;
  subject: string;
  description: string;
  reporter_user_id: string;
  severity: Priority;
  status: ITStatus;
  assigned_to_user_id: string | null;
  related_ngo_id: string | null;
  work_item_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTicketInput {
  subject: string;
  description: string;
  reporter_user_id?: string;
  severity: Priority;
  status: ITStatus;
  assigned_to_user_id?: string | null;
  related_ngo_id?: string | null;
}

export const useITTickets = () => {
  return useQuery({
    queryKey: ["it-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Ticket[];
    },
  });
};

export const useCreateITTicket = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateTicketInput) => {
      const reporter = input.reporter_user_id || user?.id;
      if (!reporter) {
        throw new Error("Reporter user is required.");
      }

      const { data: workItem, error: workItemError } = await supabase
        .from("work_items")
        .insert({
          title: `Support Ticket: ${input.subject}`,
          description: input.description,
          module: "it",
          type: "Support Ticket",
          status: mapITStatusToWorkItemStatus(input.status),
          priority: input.severity,
          owner_user_id: input.assigned_to_user_id || null,
          ngo_id: input.related_ngo_id || null,
          evidence_required: false,
          approval_required: false,
          external_visible: false,
        })
        .select()
        .single();

      if (workItemError) throw workItemError;

      const { data, error } = await supabase
        .from("tickets")
        .insert({
          subject: input.subject,
          description: input.description,
          reporter_user_id: reporter,
          severity: input.severity,
          status: input.status,
          assigned_to_user_id: input.assigned_to_user_id || null,
          related_ngo_id: input.related_ngo_id || null,
          work_item_id: (workItem as WorkItem).id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Ticket;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["it-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["work-items"] });
      queryClient.invalidateQueries({ queryKey: ["work-item-stats"] });
      toast({
        title: "Ticket created",
        description: "The support ticket has been created.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error creating ticket",
        description: error.message,
      });
    },
  });
};

export const useUpdateITTicket = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<Ticket> & { id: string }) => {
      const { data, error } = await supabase
        .from("tickets")
        .update(input)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as Ticket;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["it-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["it-tickets", data.id] });
      toast({
        title: "Ticket updated",
        description: "The ticket has been updated.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error updating ticket",
        description: error.message,
      });
    },
  });
};
