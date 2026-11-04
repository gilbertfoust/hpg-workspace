/* Editorial tables are introduced by the editorial workflow migration.
 * The generated Supabase types are refreshed during deployment; the narrow
 * dynamic client below avoids coupling this feature to outdated generated types.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ensureSupabase } from "@/integrations/supabase/client";

export type EditorialKind = "article" | "issue" | "interview" | "press_release" | "newsletter" | "research_brief";
export type EditorialStatus = "draft" | "in_review" | "changes_requested" | "approved" | "published" | "archived";

export type EditorialItem = {
  id: string;
  kind: EditorialKind;
  title: string;
  summary: string;
  body_markdown: string;
  status: EditorialStatus;
  planned_publish_at: string | null;
  published_at: string | null;
  published_url: string | null;
  interviewee_name: string | null;
  interview_date: string | null;
  consent_confirmed: boolean;
  consent_document_id: string | null;
  transcript_document_id: string | null;
  author_id: string;
  approved_by: string | null;
  approved_at: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
};

export type EditorialIssueMember = {
  id: string;
  issue_id: string;
  content_id: string;
  sort_order: number;
  created_at: string;
};
export type EditorialReview = {
  id: string;
  editorial_item_id: string;
  reviewer_id: string;
  decision: "approved" | "changes_requested";
  note: string;
  created_at: string;
};
export type EditorialEvent = {
  id: string;
  editorial_item_id: string;
  actor_id: string;
  action: string;
  detail: Record<string, unknown>;
  created_at: string;
};
export type EditableFields = Pick<EditorialItem, "title" | "summary" | "body_markdown" | "planned_publish_at" |
  "interviewee_name" | "interview_date" | "consent_confirmed" | "consent_document_id" | "transcript_document_id">;
export type NewEditorialItem = EditableFields & { kind: EditorialKind };

const api = () => ensureSupabase() as any;
const editorQueries = ["editorial"] as const;
const invalidate = (qc: ReturnType<typeof useQueryClient>) => qc.invalidateQueries({ queryKey: editorQueries });

export function useEditorialData() {
  return useQuery({
    queryKey: [...editorQueries, "all"],
    retry: false,
    queryFn: async (): Promise<{
      items: EditorialItem[];
      members: EditorialIssueMember[];
      reviews: EditorialReview[];
      events: EditorialEvent[];
      canWrite: boolean;
      canApprove: boolean;
    }> => {
      const client = api();
      const permissions = await Promise.all([
        client.rpc("can_write_editorial"),
        client.rpc("can_approve_editorial"),
      ]);
      for (const permission of permissions) if (permission.error) throw permission.error;
      if (!permissions[0].data) return { items: [], members: [], reviews: [], events: [], canWrite: false, canApprove: false };
      const [items, members, reviews, events] = await Promise.all([
        client.from("editorial_items").select("*").order("created_at", { ascending: false }),
        client.from("editorial_issue_items").select("*").order("sort_order").order("created_at"),
        client.from("editorial_reviews").select("*").order("created_at", { ascending: false }),
        client.from("editorial_events").select("*").order("created_at", { ascending: false }).limit(250),
      ]);
      for (const result of [items, members, reviews, events]) if (result.error) throw result.error;
      return {
        items: (items.data || []) as EditorialItem[],
        members: (members.data || []) as EditorialIssueMember[],
        reviews: (reviews.data || []) as EditorialReview[],
        events: (events.data || []) as EditorialEvent[],
        canWrite: true,
        canApprove: !!permissions[1].data,
      };
    },
  });
}

export function useCreateEditorialItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewEditorialItem): Promise<EditorialItem> => {
      const { data, error } = await api().from("editorial_items").insert(input).select("*").single();
      if (error) throw error;
      return data as EditorialItem;
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateEditorialItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: EditableFields }): Promise<EditorialItem> => {
      const { data, error } = await api().from("editorial_items").update(values).eq("id", id).select("*").single();
      if (error) throw error;
      return data as EditorialItem;
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useAddIssueContribution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ issue_id, content_id, sort_order }: { issue_id: string; content_id: string; sort_order: number }) => {
      const { error } = await api().from("editorial_issue_items").insert({ issue_id, content_id, sort_order });
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useRemoveIssueContribution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api().from("editorial_issue_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useReorderIssueContribution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, sort_order }: { id: string; sort_order: number }) => {
      const { error } = await api().from("editorial_issue_items").update({ sort_order }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc),
  });
}

function useEditorialRpc<TPayload extends Record<string, unknown>>(name: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TPayload): Promise<EditorialItem> => {
      const { data, error } = await api().rpc(name, payload);
      if (error) throw error;
      return data as EditorialItem;
    },
    onSuccess: () => invalidate(qc),
  });
}

export const useSubmitEditorial = () =>
  useEditorialRpc<{ p_id: string }>("submit_editorial_item");

export const useReviewEditorial = () =>
  useEditorialRpc<{ p_id: string; p_decision: "approved" | "changes_requested"; p_note: string }>("review_editorial_item");

export const useRecordEditorialPublication = () =>
  useEditorialRpc<{ p_id: string; p_url: string }>("record_editorial_publication");
