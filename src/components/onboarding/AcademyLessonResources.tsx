import { useState } from "react";
import { ExternalLink, Film, FileText, BookOpen, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { isAdminRole,useUserRole } from "@/hooks/useUserRole";
import {
  useAcademyLessonResources,useAddAcademyLessonResource,useReviewAcademyLessonResource,
  type AcademyLessonResource
} from "@/hooks/useAcademyLessonResources";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/components/ui/select";

const errText=(e:unknown)=>e instanceof Error?e.message:"Resource could not be processed.";
function ResourceItem({resource,admin,currentUser,onReview,busy}:{
  resource:AcademyLessonResource;admin:boolean;currentUser?:string;
  onReview:(id:string,action:"publish"|"withdraw")=>Promise<void>;busy:boolean;
}){
  const [showTranscript,setShowTranscript]=useState(false);
  return <div className="space-y-2 rounded-lg border p-3">
    <div className="flex flex-wrap items-center gap-2">
      {resource.resource_kind==="recorded_demo"?<Film className="h-4 w-4"/>:<BookOpen className="h-4 w-4"/>}
      <p className="flex-1 font-medium text-sm">{resource.title}</p>
      <Badge variant={resource.status==="published"?"secondary":"outline"}>{resource.status}</Badge>
      <Badge variant="outline">{resource.language_code.toUpperCase()}</Badge>
    </div>
    <p className="text-xs text-muted-foreground">{resource.resource_kind.replaceAll("_"," ")}. Access to the source file still depends on its provider and existing HPG permissions.</p>
    <div className="flex flex-wrap gap-2">
      <Button asChild size="sm" variant="outline"><a href={resource.source_url} target="_blank" rel="noopener noreferrer">
        <ExternalLink className="mr-2 h-4 w-4"/>Open approved instructional resource</a></Button>
      {resource.caption_url&&<Button asChild size="sm" variant="outline"><a href={resource.caption_url} target="_blank" rel="noopener noreferrer">Open captions</a></Button>}
      {!!resource.transcript&&<Button size="sm" variant="ghost" onClick={()=>setShowTranscript(x=>!x)}>
        <FileText className="mr-2 h-4 w-4"/>{showTranscript?"Hide transcript":"Read transcript"}</Button>}
      {admin&&resource.status==="draft"&&
        <Button size="sm" variant="outline" disabled={busy||resource.created_by===currentUser}
          title={resource.created_by===currentUser?"An independent administrator must publish this resource.":undefined}
          onClick={()=>onReview(resource.id,"publish")}><ShieldCheck className="mr-2 h-4 w-4"/>Publish after review</Button>}
      {admin&&resource.status==="published"&&
        <Button size="sm" variant="outline" disabled={busy}
          onClick={()=>onReview(resource.id,"withdraw")}>Withdraw resource</Button>}
    </div>
    {showTranscript&&<div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-md bg-muted/30 p-3 text-sm">{resource.transcript}</div>}
  </div>;
}
export default function AcademyLessonResources({lessonId}:{lessonId:string}){
  const {user}=useAuth();
  const {data:role}=useUserRole();
  const admin=isAdminRole(role?.role);
  const resources=useAcademyLessonResources(lessonId);
  const add=useAddAcademyLessonResource(lessonId);
  const review=useReviewAcademyLessonResource(lessonId);
  const [editing,setEditing]=useState(false);
  const [title,setTitle]=useState("");
  const [kind,setKind]=useState<"recorded_demo"|"guide"|"reference">("recorded_demo");
  const [url,setUrl]=useState("");
  const [captionUrl,setCaptionUrl]=useState("");
  const [transcript,setTranscript]=useState("");
  const [language,setLanguage]=useState("en");
  const onReview=async(id:string,decision:"publish"|"withdraw")=>{
    try{await review.mutateAsync({resourceId:id,decision});toast.success("Instructional resource review recorded.");}
    catch(e){toast.error(errText(e));}
  };
  const save=async()=>{
    try{
      await add.mutateAsync({title:title.trim(),kind,url:url.trim(),captionUrl:captionUrl.trim(),transcript,language});
      setEditing(false);setTitle("");setUrl("");setCaptionUrl("");setTranscript("");setLanguage("en");
      toast.success("Instructional resource saved as a private draft for independent review.");
    }catch(e){toast.error(errText(e));}
  };
  const published=(resources.data||[]).filter(x=>x.status==="published");
  const unpublished=(resources.data||[]).filter(x=>x.status!=="published");
  return <section aria-label="Lesson instructional recordings and resources" className="space-y-3 rounded-lg border p-4">
    <div className="flex flex-wrap items-center gap-2">
      <Film className="h-5 w-5 text-primary"/>
      <h3 className="flex-1 font-semibold">Instructional recordings and reference materials</h3>
      {admin&&<Button variant="outline" size="sm" onClick={()=>setEditing(x=>!x)}>
        {editing?"Close resource editor":"Add reviewed learning resource"}</Button>}
    </div>
    {resources.error&&<p role="alert" className="text-sm text-destructive">Approved media could not be loaded for this account.</p>}
    {resources.isLoading&&<p className="text-xs text-muted-foreground">Loading reviewed instructional references…</p>}
    {published.length===0&&!resources.error&&
      <p className="text-xs text-muted-foreground">No recorded demonstration is approved for this lesson yet. The written instructions, device narration and transcripts above remain available. Video files are never fabricated or automatically published.</p>}
    {published.map(item=><ResourceItem key={item.id} resource={item} admin={admin}
      currentUser={user?.id} onReview={onReview} busy={review.isPending}/>)}
    {admin&&unpublished.length>0&&<div className="space-y-2 border-t pt-3">
      <h4 className="text-sm font-semibold">Internal drafts and retired references</h4>
      {unpublished.map(item=><ResourceItem key={item.id} resource={item} admin={admin}
        currentUser={user?.id} onReview={onReview} busy={review.isPending}/>)}
    </div>}
    {admin&&editing&&<div className="space-y-3 rounded-lg bg-muted/25 p-3">
      <p className="text-sm font-semibold">Author a new controlled instructional resource</p>
      <p className="text-xs text-muted-foreground">Use a real authorized Drive or approved-host URL. Recorded demonstrations require a transcript. Another administrator must review and publish this draft; no link is exposed to ordinary learners before approval. Check the source file's access permissions independently.</p>
      <div className="space-y-1"><Label>Resource title</Label><Input value={title} onChange={e=>setTitle(e.target.value)}/></div>
      <div className="space-y-1"><Label>Kind</Label>
        <Select value={kind} onValueChange={v=>setKind(v as typeof kind)}>
          <SelectTrigger><SelectValue/></SelectTrigger><SelectContent>
            <SelectItem value="recorded_demo">Recorded demonstration</SelectItem>
            <SelectItem value="guide">Instructional guide</SelectItem>
            <SelectItem value="reference">Reference material</SelectItem>
          </SelectContent></Select>
      </div>
      <div className="space-y-1"><Label>Authorized HTTPS resource link</Label>
        <Input inputMode="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..."/></div>
      <div className="space-y-1"><Label>Caption file URL, if available (HTTPS)</Label>
        <Input inputMode="url" value={captionUrl} onChange={e=>setCaptionUrl(e.target.value)} placeholder="https://..."/></div>
      <div className="space-y-1"><Label>Resource language</Label>
        <Select value={language} onValueChange={setLanguage}><SelectTrigger><SelectValue/></SelectTrigger>
          <SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="fr">French</SelectItem>
            <SelectItem value="pt">Portuguese</SelectItem><SelectItem value="es">Spanish</SelectItem></SelectContent></Select>
      </div>
      <div className="space-y-1"><Label>Transcript and accessible instructions</Label>
        <Textarea rows={5} value={transcript} onChange={e=>setTranscript(e.target.value)}
          placeholder="Supply the exact reviewed recording transcript or descriptive instructions." /></div>
      <Button disabled={add.isPending||title.trim().length<5||!/^https:\/\/\S+$/i.test(url.trim())||
        (captionUrl.trim().length>0&&!/^https:\/\/\S+$/i.test(captionUrl.trim()))||
        (kind==="recorded_demo"&&transcript.trim().length<30)}
        onClick={save}>{add.isPending?"Saving draft…":"Save private resource draft"}</Button>
    </div>}
  </section>;
}
