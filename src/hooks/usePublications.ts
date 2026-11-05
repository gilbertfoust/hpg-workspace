/* Public editorial publication snapshots. Only records deliberately marked live
 * have SELECT access for anonymous readers; this hook never queries drafts.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ensureSupabase } from "@/integrations/supabase/client";

export type PublicContribution = { title: string; summary: string; kind: string; body_markdown: string; section?: string; position?: number };
export type Publication = {
  id: string;
  editorial_item_id: string | null;
  communications_editorial_item_id: string | null;
  communications_publication_id: string | null;
  slug: string;
  kind: string;
  title: string;
  summary: string;
  body_markdown: string;
  contributions: PublicContribution[];
  editorial_revision: number;
  published_at: string;
  is_live: boolean;
};
const api = () => ensureSupabase() as any;

export function usePublications() {
  return useQuery<Publication[]>({
    queryKey: ["publications", "live"],
    queryFn: async () => {
      const { data, error } = await api().from("editorial_publications")
        .select("id, editorial_item_id, communications_editorial_item_id, communications_publication_id, slug, kind, title, summary, body_markdown, contributions, editorial_revision, published_at, is_live")
        .eq("is_live", true).order("published_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function usePublication(slug?: string) {
  return useQuery<Publication | null>({
    queryKey: ["publications", "slug", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await api().from("editorial_publications")
        .select("id, editorial_item_id, communications_editorial_item_id, communications_publication_id, slug, kind, title, summary, body_markdown, contributions, editorial_revision, published_at, is_live")
        .eq("slug", slug).eq("is_live", true).maybeSingle();
      if (error) throw error;
      return data as Publication | null;
    },
  });
}

export function usePublishNative() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, slug }: { id: string; slug: string }): Promise<Publication> => {
      const { data, error } = await api().rpc("publish_editorial_native", { p_id: id, p_slug: slug });
      if (error) throw error;
      return data as Publication;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["publications"] });
      qc.invalidateQueries({ queryKey: ["editorial"] });
    },
  });
}

export function useWithdrawNative() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }): Promise<boolean> => {
      const { data, error } = await api().rpc("withdraw_editorial_native", { p_id: id, p_reason: reason });
      if (error) throw error;
      return !!data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["publications"] });
      qc.invalidateQueries({ queryKey: ["editorial"] });
    },
  });
}

/** Canonical Communications web editions preserve the original approval history.
 *  These RPCs never directly insert or mutate the public snapshot table.
 */
export function usePublishCommunicationsEditorial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, slug }: { id: string; slug: string }): Promise<Publication> => {
      const { data, error } = await api().rpc("publish_communications_editorial_native", {
        p_id: id, p_slug: slug,
      });
      if (error) throw error;
      return data as Publication;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["publications"] });
      qc.invalidateQueries({ queryKey: ["department-operations", "communications"] });
    },
  });
}

export function useWithdrawCommunicationsEditorial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data, error } = await api().rpc("withdraw_communications_editorial_native", {
        p_id: id, p_reason: reason,
      });
      if (error) throw error;
      return data === true;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["publications"] });
      qc.invalidateQueries({ queryKey: ["department-operations", "communications"] });
    },
  });
}


export type InternalIssueProof = {
  issue_id: string;
  title: string;
  summary: string;
  status: string;
  planned_publish_at: string | null;
  internal_proof_only: boolean;
  articles: (PublicContribution & { editorial_item_id: string; story_status: string })[];
};

/** Read-only proof assembled by the canonical backend. It does not grant approval. */
export function useCommunicationsIssuePreview(id?: string, enabled = true) {
  return useQuery<InternalIssueProof>({
    queryKey: ["communications-issue-proof", id],
    enabled: enabled && !!id,
    retry: false,
    queryFn: async () => {
      const { data, error } = await api().rpc("get_communications_issue_preview", { p_issue_id: id });
      if (error) throw error;
      return data as InternalIssueProof;
    },
  });
}

export function usePublishCommunicationsIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, slug }: { id: string; slug: string }): Promise<Publication> => {
      const { data, error } = await api().rpc("publish_communications_issue_native", {
        p_issue_id: id, p_slug: slug,
      });
      if (error) throw error;
      return data as Publication;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["publications"] });
      qc.invalidateQueries({ queryKey: ["department-operations", "communications"] });
    },
  });
}

export function useWithdrawCommunicationsIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data, error } = await api().rpc("withdraw_communications_issue_native", {
        p_issue_id: id, p_reason: reason,
      });
      if (error) throw error;
      return data === true;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["publications"] });
      qc.invalidateQueries({ queryKey: ["department-operations", "communications"] });
    },
  });
}
