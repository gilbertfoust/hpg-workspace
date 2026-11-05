import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ArrowLeft, ClipboardCheck, FileText, Gavel, Users, Vote } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  useBoardWorkspace,useBoardAction,useCreateBoardMeeting,useRetainBoardPacket,
  useBoardPacketPreview,type BoardMeeting,type BoardMotion
} from "@/hooks/useBoardMeetings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const pretty=(s:string)=>s.replaceAll("_"," ").replace(/\b\w/g,x=>x.toUpperCase());
const date=(s?:string|null)=>s?new Date(s).toLocaleString():"Not scheduled";
const msg=(e:unknown)=>e instanceof Error?e.message:"The Board action could not be recorded.";

function MeetingControls({ meeting, actions, canManage, onAction, busy }: {
  meeting:BoardMeeting;
  actions:{id:string;title:string;owner_user_id:string;due_date:string;work_item_id:string;status:string}[];
  canManage:boolean;
  onAction:(action:string,payload?:Record<string,unknown>)=>Promise<void>;
  busy:boolean;
}) {
  const [minutes,setMinutes]=useState("");
  const [cancelReason,setCancelReason]=useState("");
  const [actionTitle,setActionTitle]=useState("");
  const [actionOwner,setActionOwner]=useState("none");
  const [actionDue,setActionDue]=useState("");
  const snapshot=useBoardWorkspace();
  const owners=snapshot.data?.owners||[];
  const ownMinutes=(snapshot.data?.minutes||[]).filter(m=>m.meeting_id===meeting.id).sort((a,b)=>b.revision-a.revision);
  const latest=ownMinutes[0];
  const [minDecision,setMinDecision]=useState("yes");
  const [minReason,setMinReason]=useState("");
  return <div className="space-y-4">
    <Card>
      <CardHeader><CardTitle className="text-lg">Meeting procedure</CardTitle>
        <CardDescription>All transitions use HPG's original governed Board process. Quorum, director eligibility, approval thresholds and minutes reviews are enforced on the server.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{pretty(meeting.status)}</Badge><Badge variant="outline">Version {meeting.version}</Badge>
          <Badge variant="outline">Quorum {meeting.quorum}</Badge>
          <Badge variant="outline">Yes threshold {meeting.required_yes}</Badge>
        </div>
        <p className="text-sm">Policy: {meeting.policy_reference}</p>
        <div className="flex flex-wrap gap-2">
          {canManage&&meeting.status==="draft"&&<Button disabled={busy} onClick={()=>onAction("publish")}>Publish agenda and record eligible directors</Button>}
          {canManage&&meeting.status==="published"&&<Button disabled={busy} onClick={()=>onAction("start")}>Start meeting</Button>}
          {["published","in_session"].includes(meeting.status)&&<Button variant="outline" disabled={busy} onClick={()=>onAction("attend")}>Record my attendance</Button>}
        </div>
        {canManage&&["draft","published","in_session","minutes_review"].includes(meeting.status)&&<div className="space-y-2 border-t pt-3">
          <Label>Reason to cancel the meeting</Label>
          <Input value={cancelReason} onChange={e=>setCancelReason(e.target.value)} placeholder="Required explanation"/>
          <Button size="sm" variant="outline" disabled={busy||cancelReason.trim().length<10} onClick={()=>onAction("cancel",{reason:cancelReason})}>Cancel governed meeting</Button>
        </div>}
      </CardContent>
    </Card>
    <Card>
      <CardHeader><CardTitle className="text-lg">Meeting minutes</CardTitle>
        <CardDescription>Minutes are versioned. Current eligible directors must independently approve them; the author cannot vote for their own minutes.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        {latest&&<div className="space-y-2 rounded-lg border p-4">
          <Badge variant="outline">Revision {latest.revision}</Badge>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{latest.content}</p>
          <p className="text-xs text-muted-foreground">Submitted: {date(latest.created_at)}</p>
        </div>}
        {canManage&&["in_session","minutes_review"].includes(meeting.status)&&<div className="space-y-2">
          <Label>Proposed minutes (new revision)</Label>
          <Textarea rows={8} value={minutes} onChange={e=>setMinutes(e.target.value)} placeholder="Record attendance, discussions, decisions, evidence references, and unresolved matters."/>
          <Button disabled={busy||minutes.trim().length<15} onClick={async()=>{await onAction("submit_minutes",{content:minutes});setMinutes("");}}>Submit minutes for director review</Button>
        </div>}
        {meeting.status==="minutes_review"&&latest&&<div className="space-y-2 border-t pt-3">
          <Label>Director's vote on current minutes revision</Label>
          <Select value={minDecision} onValueChange={setMinDecision}><SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>{["yes","no","recused"].map(v=><SelectItem key={v} value={v}>{pretty(v)}</SelectItem>)}</SelectContent>
          </Select>
          {minDecision!=="yes"&&<Textarea value={minReason} rows={2} onChange={e=>setMinReason(e.target.value)} placeholder="Explain opposition or recusal (required)"/>}
          <Button variant="outline" disabled={busy||(minDecision!=="yes"&&!minReason.trim())} onClick={()=>onAction("approve_minutes",{revision:latest.revision,decision:minDecision,reason:minReason||null})}>Submit my minutes ballot</Button>
        </div>}
      </CardContent>
    </Card>
    {meeting.status==="approved"&&<Card>
      <CardHeader><CardTitle className="text-lg">Actions from approved minutes</CardTitle>
        <CardDescription>Board action items become assigned HPG Workspace work items with an owner, due date, and supporting evidence requirements.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        {actions.map(a=><div key={a.id} className="rounded-md border p-3 text-sm">
          <p className="font-medium">{a.title}</p><p className="text-xs text-muted-foreground">Due {a.due_date} · {pretty(a.status)}</p>
          <Link to={"/work-items?workItemId="+a.work_item_id} className="text-primary underline">Open linked workspace action</Link>
        </div>)}
        {canManage&&<div className="space-y-2 rounded-md border p-3">
          <Label>New action item</Label><Input value={actionTitle} onChange={e=>setActionTitle(e.target.value)} placeholder="Decision and follow-up"/>
          <Label>Responsible owner</Label>
          <Select value={actionOwner} onValueChange={setActionOwner}><SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent><SelectItem value="none">Choose an active staff or director</SelectItem>
              {owners.map(o=><SelectItem value={o.id} key={o.id}>{o.name}</SelectItem>)}
            </SelectContent></Select>
          <Label>Due date</Label><Input type="date" value={actionDue} onChange={e=>setActionDue(e.target.value)}/>
          <Button disabled={busy||actionTitle.trim().length<3||actionOwner==="none"||!actionDue} onClick={()=>onAction("assign_action",{
            request_key:crypto.randomUUID(),title:actionTitle,owner_user_id:actionOwner,due_date:actionDue
          })}>Create governed work item</Button>
        </div>}
      </CardContent>
    </Card>}
  </div>;
}

function AgendaPanel({meeting,canManage,onAction,busy}:{
  meeting:BoardMeeting;canManage:boolean;
  onAction:(action:string,payload?:Record<string,unknown>)=>Promise<void>;
  busy:boolean;
}) {
  const {user}=useAuth();
  const board=useBoardWorkspace();
  const agenda=(board.data?.agenda||[]).filter(a=>a.meeting_id===meeting.id).sort((a,b)=>a.position-b.position);
  const ballots=board.data?.ballots||[];
  const bindings=board.data?.bindings||[];
  const [title,setTitle]=useState("");const [motion,setMotion]=useState("");
  const [voteSelections,setVoteSelections]=useState<Record<string,string>>({});
  const [voteReasons,setVoteReasons]=useState<Record<string,string>>({});
  const present=(board.data?.attendees||[]).some(a=>a.meeting_id===meeting.id&&a.user_id===user?.id&&a.present);
  const renderMotion=(item:BoardMotion)=>{
    const binding=bindings.find(b=>b.agenda_id===item.id);
    const cast=ballots.filter(b=>b.agenda_id===item.id);
    const voted=cast.some(b=>b.user_id===user?.id);
    const selected=voteSelections[item.id]||"yes";
    const reason=voteReasons[item.id]||"";
    return <div key={item.id} className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{item.position}. {item.title}</span>
        <Badge variant="outline">{pretty(item.status)}</Badge>
        {binding?.is_stale&&<Badge variant="destructive">Source packet changed — refresh required</Badge>}
      </div>
      <p className="whitespace-pre-wrap text-sm">{item.motion}</p>
      <p className="text-xs text-muted-foreground">{cast.length} recorded ballot(s); applicable quorum is enforced when closing a motion.</p>
      <div className="flex flex-wrap gap-2">
        {canManage&&meeting.status==="draft"&&item.status==="draft"&&<Button variant="outline" size="sm" disabled={busy} onClick={()=>onAction("remove_agenda",{agenda_id:item.id})}>Remove draft motion</Button>}
        {canManage&&["draft","in_session"].includes(meeting.status)&&["draft","open"].includes(item.status)&&
          <Button variant="outline" size="sm" disabled={busy} onClick={()=>onAction("defer_motion",{agenda_id:item.id,reason:"Deferred for later Board consideration"})}>Defer motion</Button>}
        {canManage&&meeting.status==="in_session"&&item.status==="draft"&&<Button size="sm" disabled={busy||!!binding?.is_stale} onClick={()=>onAction("open_motion",{agenda_id:item.id})}>Open voting</Button>}
        {canManage&&meeting.status==="in_session"&&item.status==="open"&&<Button size="sm" variant="outline" disabled={busy||!!binding?.is_stale} onClick={()=>onAction("close_motion",{agenda_id:item.id})}>Close and determine motion</Button>}
      </div>
      {meeting.status==="in_session"&&item.status==="open"&&present&&!voted&&
        <div className="space-y-2 rounded-lg bg-muted/30 p-3">
          <Label>My ballot</Label>
          <Select value={selected} onValueChange={value=>setVoteSelections(old=>({...old,[item.id]:value}))}>
            <SelectTrigger><SelectValue/></SelectTrigger><SelectContent>
              {["yes","no","recused"].map(v=><SelectItem value={v} key={v}>{pretty(v)}</SelectItem>)}
            </SelectContent>
          </Select>
          {selected==="recused"&&<Textarea rows={2} value={reason} onChange={e=>setVoteReasons(old=>({...old,[item.id]:e.target.value}))} placeholder="Reason for recusal is required"/>}
          <Button size="sm" disabled={busy||!!binding?.is_stale||(selected==="recused"&&!reason.trim())} onClick={()=>onAction("vote",{
            agenda_id:item.id,decision:selected,reason:reason||null,packet_digest:binding?.packet_digest||null
          })}>Submit my director ballot</Button>
        </div>}
      {voted&&<p className="text-sm text-muted-foreground">Your ballot has already been recorded for this motion.</p>}
    </div>;
  };
  return <Card><CardHeader><CardTitle className="text-lg">Agenda and governed motions</CardTitle>
    <CardDescription>Only published meetings may start voting. Each eligible director must record attendance, and source-linked motions must have current supporting evidence.</CardDescription></CardHeader>
    <CardContent className="space-y-3">
      {!agenda.length&&<p className="text-sm text-muted-foreground">No motions have been added to this meeting.</p>}
      {agenda.map(renderMotion)}
      {canManage&&meeting.status==="draft"&&<div className="space-y-3 border-t pt-4">
        <Label>New motion title</Label><Input value={title} onChange={e=>setTitle(e.target.value)}/>
        <Label>Proposed motion text</Label><Textarea rows={3} value={motion} onChange={e=>setMotion(e.target.value)} />
        <Button disabled={busy||!title.trim()||!motion.trim()} onClick={async()=>{
          await onAction("add_agenda",{title:title.trim(),motion:motion.trim()});
          setTitle("");setMotion("");
        }}>Add draft agenda motion</Button>
      </div>}
    </CardContent>
  </Card>;
}

export default function BoardHub(){
  const {user}=useAuth();
  const board=useBoardWorkspace();
  const add=useCreateBoardMeeting();
  const command=useBoardAction();
  const retain=useRetainBoardPacket();
  const [meetingId,setMeetingId]=useState<string|null>(null);
  const [creating,setCreating]=useState(false);
  const [title,setTitle]=useState("");const [scheduled,setScheduled]=useState("");
  const [timezone,setTimezone]=useState("America/Detroit");const [location,setLocation]=useState("");
  const [quorum,setQuorum]=useState("2");const [requiredYes,setRequiredYes]=useState("2");
  const [policy,setPolicy]=useState("");
  const meetings=board.data?.meetings||[];
  const chosen=meetings.find(m=>m.id===meetingId)||meetings[0];
  const actions=(board.data?.actions||[]).filter(a=>a.meeting_id===chosen?.id);
  const members=board.data?.roster||[];
  const attendees=(board.data?.attendees||[]).filter(a=>a.meeting_id===chosen?.id);
  const canManage=board.data?.can_manage===true;
  const packet=useBoardPacketPreview(chosen?.id);
  const totals=useMemo(()=>({
    meetings:meetings.length,
    future:meetings.filter(m=>["draft","published"].includes(m.status)).length,
    directors:members.filter(m=>m.is_active).length
  }),[meetings,members]);

  const run=async(action:string,payload:Record<string,unknown>={})=>{
    if(!chosen)return;
    try{
      await command.mutateAsync({id:chosen.id,version:chosen.version,action,payload});
      toast.success("Board action recorded by the governed meeting workflow.");
    }catch(e){toast.error(msg(e));}
  };
  const create=async()=>{
    try{
      const id=await add.mutateAsync({
        title,scheduledAt:scheduled,timezone,location,
        quorum:Number(quorum),requiredYes:Number(requiredYes),policyReference:policy
      });
      setMeetingId(id);setCreating(false);
      setTitle("");setScheduled("");setPolicy("");setLocation("");
      toast.success("Draft Board meeting created; no director has been invited or recorded as voting.");
    }catch(e){toast.error(msg(e));}
  };
  const savePacket=async()=>{
    if(!chosen)return;
    try {
      await retain.mutateAsync({id:chosen.id,version:chosen.version});
      toast.success("Meeting packet snapshot retained in the Board audit history.");
    }catch(e){toast.error(msg(e));}
  };
  return <MainLayout title="HPG Board of Directors Hub" subtitle="Private agenda, quorum, director voting, meeting minutes and governed work-item follow-up.">
    <div className="mx-auto max-w-6xl space-y-5">
      <Card><CardContent className="flex flex-wrap items-center gap-3 p-5">
        <Gavel className="h-8 w-8 text-primary"/>
        <div className="min-w-64 flex-1">
          <h2 className="font-semibold">Board governance workspace</h2>
          <p className="text-sm text-muted-foreground">Only current Board members and authorized administrators may read this data. Voting, quorum and action assignments follow existing HPG authorization rules; no meeting or ballot is created simply by opening this screen.</p>
        </div>
        <Button variant="outline" size="sm" asChild><Link to="/learning?track=board"><ArrowLeft className="mr-2 h-4 w-4"/>Board orientation</Link></Button>
      </CardContent></Card>
      {board.isLoading&&<p className="text-sm text-muted-foreground">Verifying Board membership and loading governed records…</p>}
      {board.error&&<Card><CardContent className="p-6 text-sm text-destructive" role="alert">
        Board meeting access is unavailable: {msg(board.error)}. A Board role alone does not replace active membership or the required permissions.
      </CardContent></Card>}
      {board.data&&<>
        <div className="grid gap-3 sm:grid-cols-3">
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Meeting records</p><p className="text-2xl font-semibold">{totals.meetings}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Draft / scheduled meetings</p><p className="text-2xl font-semibold">{totals.future}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Active roster entries</p><p className="text-2xl font-semibold">{totals.directors}</p></CardContent></Card>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {meetings.length>0&&<Select value={chosen?.id||""} onValueChange={setMeetingId}>
            <SelectTrigger className="min-w-64 max-w-lg"><SelectValue placeholder="Select meeting"/></SelectTrigger>
            <SelectContent>{meetings.map(m=><SelectItem value={m.id} key={m.id}>{m.title} · {pretty(m.status)}</SelectItem>)}</SelectContent>
          </Select>}
          {canManage&&<Button onClick={()=>setCreating(v=>!v)}>{creating?"Close new meeting":"Create draft Board meeting"}</Button>}
        </div>
        {canManage&&creating&&<Card>
          <CardHeader><CardTitle>Create a draft Board meeting</CardTitle>
            <CardDescription>Quorum and yes thresholds must come from the applicable Board charter/bylaws or meeting authority. These fields are not calculated automatically.</CardDescription></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2"><Label>Meeting title</Label><Input value={title} onChange={e=>setTitle(e.target.value)}/></div>
            <div className="space-y-1"><Label>Scheduled start (your local time)</Label><Input type="datetime-local" value={scheduled} onChange={e=>setScheduled(e.target.value)}/></div>
            <div className="space-y-1"><Label>IANA meeting timezone</Label><Input value={timezone} onChange={e=>setTimezone(e.target.value)} placeholder="America/Detroit"/></div>
            <div className="space-y-1"><Label>Location / video link (optional)</Label><Input value={location} onChange={e=>setLocation(e.target.value)}/></div>
            <div className="space-y-1"><Label>Minimum non-recused quorum</Label><Input type="number" min={1} value={quorum} onChange={e=>setQuorum(e.target.value)}/></div>
            <div className="space-y-1"><Label>Votes required for approval</Label><Input type="number" min={1} value={requiredYes} onChange={e=>setRequiredYes(e.target.value)}/></div>
            <div className="space-y-1 md:col-span-2"><Label>Applicable policy / bylaw reference</Label><Textarea rows={2} value={policy} onChange={e=>setPolicy(e.target.value)} placeholder="Specific governance provision and approval rule"/></div>
            <div className="md:col-span-2"><Button disabled={add.isPending||!title.trim()||!scheduled||!timezone||!policy.trim()||Number(quorum)<1||Number(requiredYes)<1} onClick={create}>Save draft meeting</Button></div>
          </CardContent></Card>}
        {chosen?<Tabs defaultValue="agenda">
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="agenda"><Vote className="mr-1 h-4 w-4"/>Agenda & voting</TabsTrigger>
            <TabsTrigger value="minutes"><FileText className="mr-1 h-4 w-4"/>Minutes & actions</TabsTrigger>
            <TabsTrigger value="roster"><Users className="mr-1 h-4 w-4"/>Attendance & roster</TabsTrigger>
            <TabsTrigger value="packet"><ClipboardCheck className="mr-1 h-4 w-4"/>Meeting packet</TabsTrigger>
          </TabsList>
          <TabsContent value="agenda" className="mt-4 space-y-4">
            <Card><CardContent className="flex flex-wrap gap-3 p-4">
              <div className="flex-1"><p className="font-semibold">{chosen.title}</p>
                <p className="text-sm text-muted-foreground">{date(chosen.scheduled_at)} · {chosen.timezone}</p>
                <p className="text-sm text-muted-foreground">{chosen.location||"Location not specified"}</p>
              </div>
              <Badge>{pretty(chosen.status)}</Badge>
            </CardContent></Card>
            <AgendaPanel meeting={chosen} canManage={canManage} onAction={run} busy={command.isPending}/>
          </TabsContent>
          <TabsContent value="minutes" className="mt-4"><MeetingControls meeting={chosen} actions={actions}
            canManage={canManage} onAction={run} busy={command.isPending}/></TabsContent>
          <TabsContent value="roster" className="mt-4"><Card>
            <CardHeader><CardTitle className="text-lg">Eligible directors and attendance</CardTitle>
              <CardDescription>Attendance is captured for a published meeting. Active roster membership does not independently authorize every motion.</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {members.length===0&&<p className="text-sm text-muted-foreground">No active Board membership records were returned. Administrators must verify roster and terms before meeting publication.</p>}
              {members.map(member=><div key={member.user_id} className="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm">
                <div className="flex-1"><p className="font-medium">{member.display_name}</p>
                  <p className="text-xs text-muted-foreground">{member.board_title} · Term: {member.term_starts_on||"unspecified"} to {member.term_ends_on||"unspecified"}</p>
                </div>
                <Badge variant={member.is_active?"default":"outline"}>{member.is_active?"Active":"Inactive"}</Badge>
                <Badge variant="secondary">{attendees.find(a=>a.user_id===member.user_id)?.present?"Present":"Not recorded present"}</Badge>
              </div>)}
            </CardContent>
          </Card></TabsContent>
          <TabsContent value="packet" className="mt-4"><Card>
            <CardHeader><CardTitle className="text-lg">Board evidence packet</CardTitle>
              <CardDescription>Preview the current meeting record and capture a retained snapshot with its existing source-control digest. This does not publish an agenda or cast a vote.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {packet.isLoading&&<p className="text-sm text-muted-foreground">Assembling controlled packet preview…</p>}
              {packet.error&&<p role="alert" className="text-sm text-destructive">{msg(packet.error)}</p>}
              {packet.data&&<div className="max-h-[420px] overflow-auto rounded-lg border bg-muted/20 p-4">
                <pre className="whitespace-pre-wrap break-words text-xs">{JSON.stringify(packet.data,null,2)}</pre>
              </div>}
              {canManage&&<Button variant="outline" disabled={retain.isPending||!packet.data} onClick={savePacket}>Retain current packet revision</Button>}
            </CardContent>
          </Card></TabsContent>
        </Tabs>:<Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          There are no Board meetings in this governance system yet. Authorized meeting administrators may create a draft above. No attendance, agenda, or votes have been fabricated.
        </CardContent></Card>}
        <p className="text-xs text-muted-foreground">Votes are recorded only by eligible directors during an open meeting. Approval of Board minutes is a distinct decision. For confidential information, use the approved Board document workflow.</p>
      </>}
    </div>
  </MainLayout>;
}
