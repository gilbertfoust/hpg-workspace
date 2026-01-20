import { addDays, subDays } from "date-fns";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export const DEFAULT_REMINDER_OFFSET_DAYS = 3;
export const REMINDER_CHANNEL_IN_APP = "in_app";
export const REMINDER_STATUS_SCHEDULED = "scheduled";

type ReminderInsert = Database["public"]["Tables"]["reminders"]["Insert"];

type ReminderSourceWorkItem = {
  id: string;
  due_date: string | null;
  owner_user_id: string | null;
  created_by_user_id: string | null;
};

export const getDefaultReminderAt = (dueDate: string) =>
  subDays(new Date(dueDate), DEFAULT_REMINDER_OFFSET_DAYS).toISOString();

export const getRelativeReminderAt = (daysFromNow: number) =>
  addDays(new Date(), daysFromNow).toISOString();

export const insertReminder = async (payload: ReminderInsert) => {
  if (!supabase) {
    throw getSupabaseNotConfiguredError();
  }

  return supabase
    .from("reminders")
    .insert(payload)
    .select()
    .single();
};

export const scheduleDefaultReminderForWorkItem = async (workItem: ReminderSourceWorkItem) => {
  if (!supabase || !workItem.due_date) {
    return;
  }

  const userId = workItem.owner_user_id || workItem.created_by_user_id;
  if (!userId) {
    return;
  }

  const remindAt = getDefaultReminderAt(workItem.due_date);
  const { error } = await supabase.from("reminders").insert({
    work_item_id: workItem.id,
    user_id: userId,
    remind_at: remindAt,
    channel: REMINDER_CHANNEL_IN_APP,
    status: REMINDER_STATUS_SCHEDULED,
  });

  if (error) {
    console.warn("Failed to schedule default reminder", error);
  }
};
