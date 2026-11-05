/* Existing HPG Board meeting functions are the source of truth.
 * Every mutating action is delegated to guarded server RPCs; the browser never
 * writes ballots or meeting status directly.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { ensureSupabase } from "@/integrations/supabase/client";

export type BoardMeeting = {
  id:string; title:string; scheduled_at:string; timezone:string; location:string|null;
  status:string;version:number;quorum:number;required_yes:number;policy_reference:string;
  current_minutes_revision:number;
};
export type BoardMotion = { id:string;meeting_id:string;position:number;title:string;motion:string;status:string };
export type BoardAttendee = { meeting_id:string;user_id:string;display_name:string;present:boolean };
export type BoardBallot = {agenda_id:string;user_id:string;decision:"yes"|"no"|"recused";reason:string|null};
export type BoardMinutes = {meeting_id:string;revision:number;content:string;created_by:string;created_at:string};
export type BoardActionItem = {id:string;meeting_id:string;title:string;owner_user_id:string;due_date:string;work_item_id:string;status:string};
export type BoardBinding = {agenda_id:string;packet_digest:string|null;is_stale:boolean;state:string;work_item_id:string};
export type BoardMember = {user_id:string;display_name:string;board_title:string;is_active:boolean;term_starts_on:string|null;term_ends_on:string|null};
export type BoardWorkspace = {
  can_manage:boolean; meetings:BoardMeeting[];agenda:BoardMotion[];attendees:BoardAttendee[];
  ballots:BoardBallot[];minutes:BoardMinutes[];actions:BoardActionItem[];
  bindings:BoardBinding[];roster:BoardMember[];owners:{id:string;name:string}[];
  minutes_ballots:{meeting_id:string;revision:number;user_id:string;decision:string}[];
};
const api=()=>ensureSupabase() as any;
const key=["board-meeting-workspace"];

export function useBoardWorkspace(){
  const {user}=useAuth();
  return useQuery<BoardWorkspace>({
    queryKey:[...key,user?.id],enabled:!!user?.id,retry:false,
    queryFn:async()=>{
      const {data,error}=await api().rpc("bod_meeting_workspace");
      if(error)throw error;
      return data as BoardWorkspace;
    },
  });
}
export function useCreateBoardMeeting(){
  const qc=useQueryClient();
  return useMutation({
    mutationFn:async(payload:{
      title:string;scheduledAt:string;timezone:string;location:string;
      quorum:number;requiredYes:number;policyReference:string;
    })=>{
      const {data,error}=await api().rpc("create_bod_meeting",{
        p_request_key:crypto.randomUUID(),
        p_title:payload.title.trim(),
        p_scheduled_at:new Date(payload.scheduledAt).toISOString(),
        p_timezone:payload.timezone,
        p_location:payload.location.trim()||null,
        p_quorum:payload.quorum,p_required_yes:payload.requiredYes,
        p_policy_reference:payload.policyReference.trim()
      });
      if(error)throw error;
      return String(data);
    },
    onSuccess:()=>qc.invalidateQueries({queryKey:key})
  });
}
export function useBoardAction(){
  const qc=useQueryClient();
  return useMutation({
    mutationFn:async({id,version,action,payload={}}:{
      id:string;version:number;action:string;payload?:Record<string,unknown>
    })=>{
      const {data,error}=await api().rpc("act_bod_meeting",{
        p_id:id,p_version:version,p_action:action,p_payload:payload
      });
      if(error)throw error;
      return data as BoardMeeting;
    },
    onSuccess:()=>qc.invalidateQueries({queryKey:key})
  });
}
export function useBoardPacketPreview(meetingId?:string){
  const {user}=useAuth();
  return useQuery<Record<string,unknown>>({
    queryKey:["board-packet-preview",meetingId],
    enabled:!!user?.id&&!!meetingId,retry:false,
    queryFn:async()=>{
      const {data,error}=await api().rpc("preview_bod_packet",{p_meeting_id:meetingId});
      if(error)throw error;
      return data as Record<string,unknown>;
    }
  });
}
export function useRetainBoardPacket(){
  const qc=useQueryClient();
  return useMutation({
    mutationFn:async({id,version}:{id:string;version:number})=>{
      const {data,error}=await api().rpc("retain_bod_packet",{
        p_meeting_id:id,p_meeting_version:version,p_request_key:crypto.randomUUID()
      });
      if(error)throw error;
      return data as string;
    },
    onSuccess:()=>qc.invalidateQueries({queryKey:key})
  });
}
