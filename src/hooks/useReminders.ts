import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addHours } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";
import { insertReminder, REMINDER_CHANNEL_IN_APP, REMINDER_STATUS_SCHEDULED } from "@/lib/reminders";

export interface Reminder {
  id: string;
  work_item_id: string;
  user_id: string;
  remind_at: string;
  channel: string | null;
  status: string | null;
  created_at: string;
  work_items?: {
    id: string;
    title: string;
    due_date: string | null;
  } | null;
}

const REMINDER_POLL_INTERVAL_MS = 120000;

const ensureSupabase = () => {
  if (!supabase) {
    throw getSupabaseNotConfiguredError();
  }
};

export const useUpcomingReminders = (options?: { hours?: number }) => {
  const { user } = useAuth();
  const hours = options?.hours ?? 48;

  return useQuery({
    queryKey: ["reminders", "upcoming", user?.id, hours],
    enabled: !!user?.id,
    refetchInterval: REMINDER_POLL_INTERVAL_MS,
    queryFn: async () => {
      ensureSupabase();
      const now = new Date();
      const until = addHours(now, hours);

      const { data, error } = await supabase
        .from("reminders")
        .select("id, work_item_id, user_id, remind_at, channel, status, created_at, work_items(id, title, due_date)")
        .eq("user_id", user!.id)
        .neq("status", "seen")
        .gte("remind_at", now.toISOString())
        .lte("remind_at", until.toISOString())
        .order("remind_at", { ascending: true });

      if (error) {
        throw error;
      }

      return data as Reminder[];
    },
  });
};

export const useCreateReminder = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: {
      workItemId: string;
      remindAt: string;
      userId?: string | null;
      channel?: string;
    }) => {
      const userId = input.userId ?? user?.id;
      if (!userId) {
        throw new Error("No user available for reminder.");
      }

      const { data, error } = await insertReminder({
        work_item_id: input.workItemId,
        user_id: userId,
        remind_at: input.remindAt,
        channel: input.channel ?? REMINDER_CHANNEL_IN_APP,
        status: REMINDER_STATUS_SCHEDULED,
      });

      if (error) {
        throw error;
      }

      return data as Reminder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      toast({
        title: "Reminder scheduled",
        description: "We'll surface it in your notifications.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error scheduling reminder",
        description: error.message,
      });
    },
  });
};

export const useMarkReminderSeen = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reminderId: string) => {
      ensureSupabase();
      const { data, error } = await supabase
        .from("reminders")
        .update({ status: "seen" })
        .eq("id", reminderId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data as Reminder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
    },
  });
};
