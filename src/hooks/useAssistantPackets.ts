import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { AssistantPacket } from "@/lib/hpgAssistant";

export type AssistantPacketStatus = "draft" | "reviewed" | "approved" | "archived";

export interface SavedAssistantPacket {
  id: string;
  ngo_id: string;
  packet_type: string;
  status: AssistantPacketStatus;
  title: string;
  summary: string | null;
  packet_json: AssistantPacket;
  email_subject: string | null;
  email_body: string | null;
  cabinet_summary: string | null;
  created_by_user_id: string | null;
  approved_by_user_id: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssistantPacketEvent {
  id: string;
  packet_id: string;
  ngo_id: string;
  event_type: "created" | "reviewed" | "approval" | "archived" | "work_item_draft_created" | "note";
  note: string | null;
  actor_user_id: string | null;
  event_json: Record<string, unknown> | null;
  created_at: string;
}

const ensureSupabase = () => {
  if (!supabase) throw getSupabaseNotConfiguredError();
  return supabase;
};

export const useAssistantPackets = (ngoId?: string | null) => {
  return useQuery<SavedAssistantPacket[]>({
    queryKey: ["assistant-packets", ngoId],
    enabled: !!ngoId && !!supabase,
    queryFn: async () => {
      const client = ensureSupabase();
      const { data, error } = await client
        .from("assistant_packets" as never)
        .select("*" as never)
        .eq("ngo_id" as never, ngoId as never)
        .order("created_at" as never, { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as SavedAssistantPacket[];
    },
  });
};

export const useAssistantPacketEvents = (ngoId?: string | null) => {
  return useQuery<AssistantPacketEvent[]>({
    queryKey: ["assistant-packet-events", ngoId],
    enabled: !!ngoId && !!supabase,
    queryFn: async () => {
      const client = ensureSupabase();
      const { data, error } = await client
        .from("assistant_packet_events" as never)
        .select("*" as never)
        .eq("ngo_id" as never, ngoId as never)
        .order("created_at" as never, { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as AssistantPacketEvent[];
    },
  });
};

export const useSaveAssistantPacket = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (packet: AssistantPacket) => {
      const client = ensureSupabase();
      const { data, error } = await client
        .from("assistant_packets" as never)
        .insert({
          ngo_id: packet.ngoId,
          packet_type: "ngo_coordination_onboarding",
          status: "draft",
          title: `${packet.displayName} — NGO Coordination Packet`,
          summary: packet.cabinetSummary,
          packet_json: packet as any,
          email_subject: packet.introEmail.subject,
          email_body: packet.introEmail.body,
          cabinet_summary: packet.cabinetSummary,
          created_by_user_id: user?.id || null,
        } as never)
        .select("*" as never)
        .single();

      if (error) throw error;

      await client.from("assistant_packet_events" as never).insert({
        packet_id: (data as any).id,
        ngo_id: packet.ngoId,
        event_type: "created",
        note: "Assistant packet saved as draft.",
        actor_user_id: user?.id || null,
      } as never);

      return data as unknown as SavedAssistantPacket;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["assistant-packets", data.ngo_id] });
      queryClient.invalidateQueries({ queryKey: ["assistant-packet-events", data.ngo_id] });
    },
  });
};

export const useApproveAssistantPacket = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ packetId, ngoId, note }: { packetId: string; ngoId: string; note?: string }) => {
      const client = ensureSupabase();
      const { data, error } = await client
        .from("assistant_packets" as never)
        .update({
          status: "approved",
          approved_by_user_id: user?.id || null,
          approved_at: new Date().toISOString(),
        } as never)
        .eq("id" as never, packetId as never)
        .select("*" as never)
        .single();

      if (error) throw error;

      await client.from("assistant_packet_events" as never).insert({
        packet_id: packetId,
        ngo_id: ngoId,
        event_type: "approval",
        note: note || "Assistant packet approved for internal use.",
        actor_user_id: user?.id || null,
      } as never);

      return data as unknown as SavedAssistantPacket;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["assistant-packets", data.ngo_id] });
      queryClient.invalidateQueries({ queryKey: ["assistant-packet-events", data.ngo_id] });
    },
  });
};
