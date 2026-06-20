import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { isAdminRole } from "@/hooks/useUserRole";
import type { Database } from "@/integrations/supabase/types";

export type CalendarEventType = Database["public"]["Enums"]["calendar_event_type"];
export type CalendarEvent = Database["public"]["Tables"]["calendar_events"]["Row"];
export type CreateCalendarEventInput = Database["public"]["Tables"]["calendar_events"]["Insert"];

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

      const { data, error } = await supabase
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
