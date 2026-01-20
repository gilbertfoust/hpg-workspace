import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { Json } from "@/integrations/supabase/types";
import type { ModuleType, Priority, WorkItemStatus } from "@/hooks/useWorkItems";

export type ApplicantStage = "Applied" | "Screening" | "Interviewing" | "Offer" | "Hired" | "Rejected";

export interface Applicant {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role_applied_for: string | null;
  stage: ApplicantStage;
  notes: string | null;
  created_at: string;
}

export interface CreateApplicantInput {
  full_name: string;
  email?: string | null;
  phone?: string | null;
  role_applied_for?: string | null;
  stage?: ApplicantStage;
  notes?: string | null;
}

export interface UpdateApplicantInput {
  id: string;
  full_name?: string;
  email?: string | null;
  phone?: string | null;
  role_applied_for?: string | null;
  stage?: ApplicantStage;
  notes?: string | null;
}

const applicantsTable = "applicants";

const onboardingWorkItems = (applicant: Applicant) => {
  const baseDescription = `Onboarding tasks for ${applicant.full_name}. Applicant ID: ${applicant.id}.`;

  return [
    {
      title: "Provision Slack, Google Workspace, and Trello access",
      module: "it" as ModuleType,
      description: `${baseDescription} Ensure accounts and group access are configured.`,
    },
    {
      title: "Onboarding orientation & policy walkthrough",
      module: "administration" as ModuleType,
      description: `${baseDescription} Schedule orientation and share policy acknowledgements.`,
    },
    {
      title: "Payroll and expense setup",
      module: "finance" as ModuleType,
      description: `${baseDescription} Collect payroll details and confirm expense process.`,
    },
  ];
};

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
    entity_type: "applicant",
    entity_id: entry.entity_id ?? null,
    before_json: entry.before_json ?? null,
    after_json: entry.after_json ?? null,
    actor_user_id: entry.actor_user_id ?? null,
    reason: entry.reason ?? null,
  });

  if (error) throw error;
};

export const useHRApplicants = () => {
  return useQuery({
    queryKey: ["hr", "applicants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(applicantsTable)
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Applicant[];
    },
  });
};

export const useCreateHRApplicant = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateApplicantInput) => {
      const { data, error } = await supabase
        .from(applicantsTable)
        .insert({
          full_name: input.full_name,
          email: input.email ?? null,
          phone: input.phone ?? null,
          role_applied_for: input.role_applied_for ?? null,
          stage: input.stage ?? "Applied",
          notes: input.notes ?? null,
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

      return data as Applicant;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr", "applicants"] });
      toast({
        title: "Applicant added",
        description: "The applicant has been added to the pipeline.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error creating applicant",
        description: error.message,
      });
    },
  });
};

export const useUpdateHRApplicant = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: UpdateApplicantInput) => {
      const { data: before, error: beforeError } = await supabase
        .from(applicantsTable)
        .select("*")
        .eq("id", input.id)
        .single();

      if (beforeError) throw beforeError;

      const { data, error } = await supabase
        .from(applicantsTable)
        .update({
          full_name: input.full_name ?? before.full_name,
          email: input.email ?? before.email,
          phone: input.phone ?? before.phone,
          role_applied_for: input.role_applied_for ?? before.role_applied_for,
          stage: input.stage ?? before.stage,
          notes: input.notes ?? before.notes,
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

      if (before.stage !== "Hired" && data.stage === "Hired") {
        const workItems = onboardingWorkItems(data).map((item) => ({
          ...item,
          status: "not_started" as WorkItemStatus,
          priority: "medium" as Priority,
          created_by_user_id: user?.id ?? null,
          owner_user_id: null,
          department_id: null,
          ngo_id: null,
          type: "onboarding",
        }));

        const { data: createdWorkItems, error: workItemError } = await supabase
          .from("work_items")
          .insert(workItems)
          .select("*");

        if (workItemError) throw workItemError;

        await createAuditEntry({
          action_type: "onboarding_created",
          entity_id: data.id,
          before_json: before as Json,
          after_json: {
            applicant: data,
            work_items: createdWorkItems,
          } as Json,
          actor_user_id: user?.id ?? null,
          reason: "Applicant stage changed to Hired",
        });
      }

      return data as Applicant;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr", "applicants"] });
      queryClient.invalidateQueries({ queryKey: ["work-items"] });
      toast({
        title: "Applicant updated",
        description: "Applicant details have been updated.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error updating applicant",
        description: error.message,
      });
    },
  });
};
