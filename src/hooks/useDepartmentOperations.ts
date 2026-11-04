/* Authorized views over HPG's existing Communications and Marketing workflow tables.
 * Creation, edits, stage changes, versioning, and approvals use the existing
 * department RPCs, preserving role checks and evidence gates in the database.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { ensureSupabase } from "@/integrations/supabase/client";

export type DepartmentLane = "communications" | "marketing";
export type OperationsRecord = {
  id: string;
  title: string;
  status: string;
  priority?: string | null;
  due_at?: string | null;
  scheduled_at?: string | null;
  created_at?: string;
  work_item_id?: string | null;
  owner_user_id?: string | null;
  editor_user_id?: string | null;
  strategist_user_id?: string | null;
  reviewer_user_id?: string | null;
  ngo_id?: string | null;
  current_version?: number | null;
  publication_url?: string | null;
  published_url?: string | null;
  public_url?: string | null;
  pitch_summary?: string | null;
  content_type?: string | null;
  story_angle?: string | null;
  publication_type?: string | null;
  audience_segment?: string | null;
  objective?: string | null;
  target_audience?: string | null;
  primary_cta?: string | null;
  campaign_type?: string | null;
  channels?: string[];
  platform?: string | null;
  body_text?: string | null;
  campaign_id?: string | null;
  channel_account_id?: string | null;
  [key: string]: unknown;
};

export type OperationsPerson = { id: string; full_name: string; user_id?: string; can_final_approve?: boolean };
export type OperationsCalendarEntry = { id: string; title: string; kind: string; status: string; starts_at: string | null };
export type OperationsAccount = { id: string; platform: string; scope_name: string; handle: string | null; ownership_status: string; public_url: string | null };
export type OperationsResponse = {
  summary: Record<string, number | string>;
  editorial: OperationsRecord[];
  publications: OperationsRecord[];
  campaigns: OperationsRecord[];
  posts: OperationsRecord[];
  accounts: OperationsAccount[];
  calendar: OperationsCalendarEntry[];
  people: OperationsPerson[];
};

const api = () => ensureSupabase() as any;
const key = (lane: DepartmentLane) => ["department-operations", lane];
const fail = (r: { error?: { message?: string } | null }) => { if (r.error) throw new Error(r.error.message || "Department action failed"); };

export function useDepartmentOperations(lane: DepartmentLane) {
  const { user } = useAuth();
  return useQuery<OperationsResponse>({
    queryKey: key(lane),
    enabled: !!user?.id,
    retry: false,
    staleTime: 30000,
    queryFn: async () => {
      const client = api();
      const authorized = await client.rpc(lane === "communications" ? "is_communications_staff" : "is_marketing_staff");
      fail(authorized);
      if (authorized.data !== true) throw new Error("Your assigned department does not have access to this operational hub.");

      if (lane === "communications") {
        const [summary, editorial, publications, people, calendar] = await Promise.all([
          client.rpc("get_communications_hub_snapshot"),
          client.from("communications_editorial_items").select("id,title,status,priority,due_at,scheduled_at,created_at,work_item_id,owner_user_id,editor_user_id,ngo_id,current_version,pitch_summary,content_type,story_angle,publication_url").order("created_at", { ascending: false }).limit(200),
          client.from("communications_publications").select("id,title,status,priority,due_at,scheduled_at,created_at,work_item_id,ngo_id,editor_user_id,publication_type,audience_segment,channels,published_url").order("created_at", { ascending: false }).limit(200),
          client.rpc("get_communications_assignable_users"),
          client.from("communications_editorial_calendar").select("title,entity_id,event_type,status,starts_at").order("starts_at", { ascending: true }).limit(200),
        ]);
        for (const r of [summary, editorial, publications, people, calendar]) fail(r);
        return {
          summary: summary.data || {},
          editorial: editorial.data || [], publications: publications.data || [],
          campaigns: [], posts: [], accounts: [],
          calendar: (calendar.data || []).map((item: { title: string; entity_id: string; event_type: string; status: string; starts_at: string | null }) => ({
            id: item.entity_id, title: item.title, kind: item.event_type, status: item.status, starts_at: item.starts_at,
          })),
          people: (people.data || []).map((p: { user_id: string; full_name: string; can_final_approve?: boolean }) => ({
            id: p.user_id, user_id: p.user_id, full_name: p.full_name, can_final_approve: p.can_final_approve,
          })),
        };
      }

      const [summary, campaigns, posts, accounts, people, calendar] = await Promise.all([
        client.rpc("get_marketing_snapshot"),
        client.from("marketing_campaigns").select("id,title,status,priority,due_at,scheduled_at,created_at,work_item_id,owner_user_id,strategist_user_id,ngo_id,current_version,objective,target_audience,primary_cta,campaign_type,channels,landing_page_url,donation_page_url").order("created_at", { ascending: false }).limit(200),
        client.from("marketing_social_posts").select("id,title,status,priority,due_at,scheduled_at,created_at,work_item_id,owner_user_id,reviewer_user_id,ngo_id,current_version,platform,body_text,campaign_id,channel_account_id,public_url").order("created_at", { ascending: false }).limit(200),
        client.from("marketing_channel_accounts").select("id,platform,scope_name,handle,ownership_status,public_url").order("platform").limit(100),
        client.rpc("get_marketing_assignable_users"),
        client.rpc("get_marketing_calendar"),
      ]);
      for (const r of [summary, campaigns, posts, accounts, people, calendar]) fail(r);
      return {
        summary: summary.data?.summary || {},
        editorial: [], publications: [],
        campaigns: campaigns.data || [], posts: posts.data || [],
        accounts: accounts.data || [],
        calendar: Array.isArray(calendar.data) ? calendar.data : [],
        people: (people.data || []).map((p: { id: string; full_name: string }) => ({ id: p.id, full_name: p.full_name })),
      };
    },
  });
}

type RpcAction =
  | { action: "create"; lane: DepartmentLane; board: string; record: Record<string, unknown> }
  | { action: "update"; lane: DepartmentLane; board: string; id: string; changes: Record<string, unknown>; reason?: string }
  | { action: "transition"; lane: DepartmentLane; board: string; id: string; target: string; reason?: string }
  | { action: "version"; lane: DepartmentLane; entityType: string; id: string; headline?: string; body?: string; summary?: string }
  | { action: "approve"; lane: DepartmentLane; entityType: string; id: string; approvalType: string; decision: "approved" | "changes_requested" | "rejected"; notes: string };

export function useDepartmentAction(lane: DepartmentLane) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (act: RpcAction) => {
      if (act.lane !== lane) throw new Error("The department action does not match this hub");
      let name: string, args: Record<string, unknown>;
      switch (act.action) {
        case "create":
          name = lane === "communications" ? "create_communications_record_unlinked" : "create_marketing_record";
          args = { p_board_key: act.board, p_record: act.record };
          break;
        case "update":
          name = lane === "communications" ? "update_communications_record" : "update_marketing_record";
          args = { p_board_key: act.board, p_entity_id: act.id, p_changes: act.changes, p_reason: act.reason || null };
          break;
        case "transition":
          name = lane === "communications" ? "transition_communications_card" : "transition_marketing_card";
          args = { p_board_key: act.board, p_entity_id: act.id, p_target_status: act.target, p_reason: act.reason || null };
          break;
        case "version":
          if (lane === "communications") {
            name = "submit_communications_version";
            args = { p_entity_type: act.entityType, p_entity_id: act.id, p_headline: act.headline || "", p_body_markdown: act.body || "", p_dek: act.summary || null, p_change_summary: "Submitted from HPG departmental operations" };
          } else {
            name = "submit_marketing_version";
            args = { p_entity_type: act.entityType, p_entity_id: act.id, p_change_summary: act.summary || "Submitted from HPG departmental operations" };
          }
          break;
        case "approve":
          name = lane === "communications" ? "record_communications_approval" : "record_marketing_approval";
          args = { p_entity_type: act.entityType, p_entity_id: act.id, p_approval_type: act.approvalType, p_decision: act.decision, p_notes: act.notes.trim() || null };
          break;
      }
      const result = await api().rpc(name, args);
      fail(result);
      return result.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key(lane) }),
  });
}
