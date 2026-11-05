import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CircleHelp, Download, Film, MonitorUp, Square, Trash2 } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useUserRole, isAdminRole } from "@/hooks/useUserRole";
import { tracks } from "@/data/academyCoreTracks";

const mediaTypes = ["video/webm;codecs=vp9,opus","video/webm;codecs=vp8,opus","video/webm","video/mp4"];
const filenamePart = (value: string) => value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").slice(0,65);
const dateTag = () => new Date().toISOString().replace(/[:.]/g, "-");

export default function AcademyRecordingStudio() {
  const {data:access,isLoading}=useUserRole();
  const allowed=isAdminRole(access?.role);
  const [lessonId,setLessonId]=useState("welcome");
  const [recording,setRecording]=useState(false);
  const [preview,setPreview]=useState<string | null>(null);
  const [fileSize,setFileSize]=useState(0);
  const [fileType,setFileType]=useState("");
  const [script,setScript]=useState("");
  const [vtt,setVtt]=useState("");
  const [error,setError]=useState("");
  const recorderRef=useRef<MediaRecorder | null>(null);
  const streamRef=useRef<MediaStream | null>(null);
  const chunksRef=useRef<Blob[]>([]);
  const blobRef=useRef<Blob | null>(null);
  const previewRef=useRef<string | null>(null);
  const allLessons=useMemo(()=>tracks.flatMap(track=>track.lessons.map(lesson=>({
    id:lesson.id,title:lesson.name,track:track.title,steps:lesson.steps,practice:lesson.practice
  }))),[]);
  const selected=allLessons.find(l=>l.id===lessonId)||allLessons[0];
  const isAvailable=typeof navigator!=="undefined"&&typeof navigator.mediaDevices?.getDisplayMedia==="function"&&typeof MediaRecorder!=="undefined";
  const clearPreview=useCallback(()=>{
    if(previewRef.current){URL.revokeObjectURL(previewRef.current);previewRef.current=null;}
    blobRef.current=null;setPreview(null);setFileSize(0);setFileType("");
  },[]);
  useEffect(()=>()=>{
    try{if(recorderRef.current && recorderRef.current.state!=="inactive") recorderRef.current.stop();}catch{/**/}
    streamRef.current?.getTracks().forEach(t=>t.stop());
    if(previewRef.current)URL.revokeObjectURL(previewRef.current);
  },[]);
  const finish=useCallback(()=>{
    if(recorderRef.current&&recorderRef.current.state!=="inactive")recorderRef.current.stop();
    streamRef.current?.getTracks().forEach(track=>track.stop());streamRef.current=null;
    setRecording(false);
  },[]);
  const start=async()=>{
    if(!allowed||!isAvailable||recording)return;
    setError("");clearPreview();chunksRef.current=[];
    try{
      const stream=await navigator.mediaDevices.getDisplayMedia({
        video:{frameRate:{ideal:20,max:30}},audio:true
      });
      streamRef.current=stream;
      const mime=mediaTypes.find(type=>MediaRecorder.isTypeSupported(type));
      const recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);
      recorderRef.current=recorder;
      recorder.ondataavailable=e=>{if(e.data.size>0)chunksRef.current.push(e.data);};
      recorder.onstop=()=>{
        const blob=new Blob(chunksRef.current,{type:recorder.mimeType||"video/webm"});
        if(blob.size>0){
          const url=URL.createObjectURL(blob);
          previewRef.current=url;blobRef.current=blob;
          setPreview(url);setFileSize(blob.size);setFileType(blob.type);
        }
        setRecording(false);
      };
      recorder.onerror=()=>{setError("The recording could not be completed. No file was uploaded.");finish();};
      stream.getVideoTracks()[0]?.addEventListener("ended",finish);
      recorder.start(1000);
      setRecording(true);
    }catch(e){
      streamRef.current?.getTracks().forEach(t=>t.stop());
      setError(e instanceof Error?e.message:"Screen capture is unavailable.");
    }
  };
  const download=()=>{
    if(!blobRef.current||!preview)return;
    const anchor=document.createElement("a");
    const ext=fileType.includes("mp4")?"mp4":"webm";
    anchor.href=preview;anchor.download="hpg-academy-"+filenamePart(selected.id)+"-"+dateTag()+"."+ext;
    document.body.appendChild(anchor);anchor.click();anchor.remove();
  };
  const downloadText=(body:string,suffix:string,mime:string)=>{
    if(!body.trim())return;
    const blob=new Blob([body],{type:mime});
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement("a");
    anchor.href=url;anchor.download="hpg-academy-"+filenamePart(selected.id)+"-"+dateTag()+"."+suffix;
    document.body.appendChild(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const defaultScript="HPG Executive Professional Academy — Workspace Training\n"+
    selected.title+"\n\n"+selected.steps.map((step,i)=>"Step "+(i+1)+": "+step).join("\n\n")+
    "\n\nPractice check: "+selected.practice;
  const subtitleValid=vtt.trim().startsWith("WEBVTT")&&vtt.trim().length>=25;
  return <MainLayout title="Academy — Instructional Recording Studio" subtitle="Create actual screen demonstrations for reviewed HPG Workspace Training lessons.">
    <div className="mx-auto max-w-6xl space-y-5">
      <Card><CardContent className="flex flex-wrap items-center gap-3 p-5">
        <MonitorUp className="h-7 w-7 text-primary"/>
        <div className="min-w-60 flex-1">
          <h2 className="font-semibold">Private production workspace</h2>
          <p className="text-sm text-muted-foreground">Only an authorized Academy administrator can initiate screen capture. Recording requires your browser's explicit screen-selection permission. Files stay on this device until you deliberately save them and upload them to approved organizational storage.</p>
        </div>
        <Button variant="outline" asChild><Link to="/learning">Return to Training</Link></Button>
      </CardContent></Card>
      {isLoading&&<p className="text-sm text-muted-foreground">Checking your Academy production permissions…</p>}
      {!isLoading&&!allowed&&<Card><CardContent className="p-6 text-sm text-destructive">Instructional recording tools are restricted to authorized internal Academy administrators.</CardContent></Card>}
      {allowed&&<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-4">
          <Card><CardHeader><CardTitle className="text-base">Select the real lesson</CardTitle>
            <CardDescription>Use the authored steps as a storyboard and only demonstrate tasks in an approved safe environment.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <Label htmlFor="recording-lesson">Workspace Training lesson</Label>
              <Select value={lessonId} onValueChange={id=>{setLessonId(id);setScript("");setVtt("");}}>
                <SelectTrigger id="recording-lesson"><SelectValue/></SelectTrigger>
                <SelectContent>{allLessons.map(lesson=><SelectItem key={lesson.id} value={lesson.id}>
                  {lesson.track} — {lesson.title}</SelectItem>)}</SelectContent>
              </Select>
              <div className="max-h-72 overflow-y-auto rounded-md border p-3">
                <p className="text-sm font-semibold">{selected.title}</p>
                <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">
                  {selected.steps.map((line,i)=><li key={i}>{line}</li>)}
                </ol>
                <p className="mt-3 text-sm"><strong>Practice check:</strong> {selected.practice}</p>
              </div>
              <p className="text-xs text-muted-foreground">Storyboard only. Opening a lesson does not grant special permissions or cause an operational change.</p>
            </CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Safety and recording guidance</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>1. Use approved demonstration data; close confidential NGO, donor, employee and bank information.</p>
              <p>2. Obtain consent before showing any identifiable third-party participant or their voice.</p>
              <p>3. Announce the task and describe each action, including why approvals may be required.</p>
              <p>4. Stop recording, review the actual file, and redact or redo sensitive material before storing it.</p>
              <p>5. Create accurate captions and a reviewed transcript. Upload the recording to authorized storage, then link it to the lesson through the Academy's independent media-review process.</p>
            </CardContent></Card>
        </div>
        <div className="space-y-4">
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Film className="h-5 w-5"/>Record an approved screen</CardTitle>
            <CardDescription>The video is recorded locally. It is not streamed to HPG or automatically published.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {!isAvailable&&<p className="text-sm text-destructive">Screen recording is unsupported in this browser or on this device. Use a compatible desktop browser and retry.</p>}
              <div className="flex flex-wrap gap-2">
                <Button disabled={!isAvailable||recording} onClick={start}><MonitorUp className="mr-2 h-4 w-4"/>Choose screen and record</Button>
                <Button variant="outline" disabled={!recording} onClick={finish}><Square className="mr-2 h-4 w-4"/>Stop recording</Button>
              </div>
              {recording&&<Badge variant="destructive">Recording in progress — review what is visible and audible</Badge>}
              {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
              {preview&&<div className="space-y-3">
                <video controls playsInline src={preview} className="w-full rounded-lg border" aria-label="Recorded instructional video preview"/>
                <p className="text-xs text-muted-foreground">Recorded file: {(fileSize/1024/1024).toFixed(1)} MB · {fileType||"video"}</p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={download}><Download className="mr-2 h-4 w-4"/>Save recording to device</Button>
                  <Button variant="outline" onClick={clearPreview}><Trash2 className="mr-2 h-4 w-4"/>Discard recording</Button>
                </div>
              </div>}
            </CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Transcript and captions</CardTitle>
            <CardDescription>Review, correct and save the written content. Captions require authentic timing; this page never invents spoken words or synchronization.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <Label>Reviewed transcript / instructor script</Label>
              <Textarea rows={8} value={script} onChange={e=>setScript(e.target.value)}
                placeholder="Paste the actual recording transcript, or revise the lesson storyboard before narrating."/>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={()=>setScript(defaultScript)}>Use lesson storyboard as draft</Button>
                <Button size="sm" variant="outline" disabled={!script.trim()} onClick={()=>downloadText(script,"txt","text/plain")}>Save transcript</Button>
              </div>
              <Label>Verified WebVTT captions (optional)</Label>
              <Textarea rows={5} value={vtt} onChange={e=>setVtt(e.target.value)}
                placeholder={"WEBVTT\n\n00:00:00.000 --> 00:00:04.500\nActual spoken sentence here"} />
              <Button size="sm" variant="outline" disabled={!subtitleValid}
                onClick={()=>downloadText(vtt,"vtt","text/vtt")}>Save reviewed caption file</Button>
              <p className="text-xs text-muted-foreground">The Academy media registry separately requires a reviewed lesson resource link. Merely saving a video or text file does not enroll learners or publish the recording.</p>
            </CardContent></Card>
        </div>
      </div>}
    </div>
  </MainLayout>;
}
