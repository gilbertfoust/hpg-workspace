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
  created_at: string;
  updated_at: string;
}

export interface CreateCalendarEventInput {
  title: string;
  event_type: CalendarEventType;
  starts_at: string;
  ends_at?: string | null;
  description?: string | null;
  ngo_id?: string | null;
  department_id?: string | null;
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
      const { data, error } = await supabase
        .from("calendar_events" as never)
        .select("*")
        .order("starts_at", { ascending: true });

      if (error) {
        if (error.code === "42P01" || error.message.includes("does not exist")) {
          return [] as CalendarEvent[];
        }
        throw error;
      }
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

      const { data, error } = await supabase
        .from("calendar_events" as never)
        .insert({
          ...input,
          created_by_user_id: user.id,
        } as never)
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
        description:
          error.message.includes("does not exist") || error.message.includes("42P01")
            ? "Calendar events table is not available yet. Apply the proposed calendar_events migration first."
            : error.message,
      });
    },
  });
};

export const useCanManageCalendarEvents = (role?: string | null) => isAdminRole(role);
