import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { isAdminRole } from "@/hooks/useUserRole";

export type CalendarEventType =
  | "meeting"
  | "deadline"
  | "birthday"
  | "compliance"
  | "training"
  | "grant_submission"
  | "event"
  | "holiday"
  | "milestone"
  | "department_goal"
  | "fundraiser"
  | "other";

export interface CalendarEvent {
  id: string;
  title: string;
  event_type: CalendarEventType;
  starts_at: string;
  ends_at: string | null;
  description: string | null;
  ngo_id: string | null;
  department_id: string | null;
  created_by_user_id: string | null;
  is_all_day: boolean;
  recurrence_rule: string | null;
  importance: "normal" | "important" | "critical";
  created_at: string;
  updated_at: string;
}

export type CreateCalendarEventInput = Omit<
  CalendarEvent,
  "id" | "created_by_user_id" | "created_at" | "updated_at"
>;

interface CalendarQueryResult {
  data: unknown;
  error: Error | null;
}

interface CalendarSelectQuery extends PromiseLike<CalendarQueryResult> {
  select: (columns?: string) => CalendarSelectQuery;
  order: (column: string, options?: { ascending?: boolean }) => CalendarSelectQuery;
  insert: (input: Record<string, unknown>) => CalendarSelectQuery;
  single: () => Promise<CalendarQueryResult>;
}

interface CalendarClient {
  from: (table: "calendar_events") => CalendarSelectQuery;
}

const ensureSupabase = () => {
  if (!supabase) {
    throw getSupabaseNotConfiguredError();
  }
};

export const useCalendarEvents = () => {
  return useQuery({
    queryKey: ["calendar-events"],
    enabled: !!supabase,
    queryFn: async () => {
      ensureSupabase();
      const client = supabase as unknown as CalendarClient;
      const { data, error } = await client
        .from("calendar_events")
        .select("*")
        .order("starts_at", { ascending: true });

      if (error) throw error;
      return (data || []) as CalendarEvent[];
    },
  });
};

export const useCreateCalendarEvent = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateCalendarEventInput) => {
      ensureSupabase();
      if (!user?.id) throw new Error("You must be signed in to create events.");

      const client = supabase as unknown as CalendarClient;
      const { data, error } = await client
        .from("calendar_events")
        .insert({
          ...input,
          created_by_user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as CalendarEvent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      toast({ title: "Event created", description: "The calendar event was added." });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Could not create event",
        description: error.message,
      });
    },
  });
};

export const useCanManageCalendarEvents = (role?: string | null) => isAdminRole(role);
