import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkItem } from "@/hooks/useWorkItems";

type Client = SupabaseClient;

export const archiveWorkItemWithFallback = async (
  client: Client,
  id: string,
  reason?: string,
) => {
  const { data, error } = await client.rpc("archive_work_item" as never, {
    _work_item_id: id,
    _reason: reason || "Archived from workspace",
  } as never);

  if (!error) return data as WorkItem;

  const { data: authData } = await client.auth.getUser();
  const userId = authData.user?.id;

  const { data: archived, error: updateError } = await client
    .from("work_items")
    .update({
      status: "canceled",
      archived_at: new Date().toISOString(),
      archived_by_user_id: userId ?? null,
      archive_reason: reason || "Archived from workspace",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (updateError) {
    throw new Error(error.message || updateError.message);
  }

  return archived as WorkItem;
};

export const completeWorkItemForAdminRecordsWithFallback = async (
  client: Client,
  id: string,
  notes?: string,
) => {
  const { data, error } = await client.rpc("complete_work_item_for_admin_records" as never, {
    _work_item_id: id,
    _notes: notes || "Completed and sent to admin records",
  } as never);

  if (!error) return data as WorkItem;

  const { data: authData } = await client.auth.getUser();
  const userId = authData.user?.id;
  const archiveReason = notes || "Completed and sent to admin records";

  const { data: completed, error: updateError } = await client
    .from("work_items")
    .update({
      status: "complete",
      completed_at: new Date().toISOString(),
      archived_at: new Date().toISOString(),
      archived_by_user_id: userId ?? null,
      archive_reason: archiveReason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (updateError) {
    throw new Error(error.message || updateError.message);
  }

  return completed as WorkItem;
};
