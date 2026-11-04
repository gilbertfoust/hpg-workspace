import { useState } from "react";
import { Link } from "react-router-dom";
import { FileImage, FileText, GraduationCap, ImagePlus, LockKeyhole, ShieldCheck, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEditorialData } from "@/hooks/useEditorial";
import { useDocuments } from "@/hooks/useDocuments";
import { useEditorialAssets, useUploadEditorialAsset, useReviewEditorialAsset, getEditorialAssetPreview, type EditorialAsset } from "@/hooks/useEditorialAssets";

function errorMessage(error: unknown) { return error instanceof Error ? error.message : "Unable to perform this action."; }
const size = (bytes: number) => (bytes / 1024 / 1024).toFixed(1) + " MB";
const types = [
  { label: "Unknown / needs review", value: "unknown" },
  { label: "Original HPG work", value: "owned" },
  { label: "Licensed material", value: "licensed" },
  { label: "Permission obtained", value: "permission" },
  { label: "Public-domain source", value: "public_domain" },
] as const;
function statusText(status: string) { return status === "cleared" ? "Rights cleared — private" : status === "rejected" ? "Rejected" : "Awaiting rights review"; }

export default function EditorialMediaDesk() {
  const editorial = useEditorialData();
  const media = useEditorialAssets();
  const documents = useDocuments();
  const upload = useUploadEditorialAsset();
  const review = useReviewEditorialAsset();
  const [itemId, setItemId] = useState("none");
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [credit, setCredit] = useState("");
  const [license, setLicense] = useState<typeof types[number]["value"]>("unknown");
  const [rightsId, setRightsId] = useState("none");
  const [reviewNotes, setReviewNotes] = useState<Record<string,string>>({});
  const [filter, setFilter] = useState("all");

  const rightsDocs = (documents.data || []).filter(doc => /license|permission|release|consent|rights/i.test(doc.file_name));
  const visible = (media.data || []).filter(asset => filter === "all" || asset.rights_status === filter);
  const uploaded = async () => {
    if (!file || itemId === "none") return;
    try {
      await upload.mutateAsync({
        editorial_item_id: itemId, file, alt_text: alt.trim(), attribution: credit.trim(),
        license_type: license, rights_document_id: rightsId === "none" ? null : rightsId,
      });
      setFile(null); setAlt(""); setCredit(""); setLicense("unknown"); setRightsId("none");
      const input = document.querySelector<HTMLInputElement>("#editorial-media-file");
      if (input) input.value = "";
      toast.success("Media uploaded privately. Independent rights review is required.");
    } catch (error) { toast.error(errorMessage(error)); }
  };
  const showPrivate = async (asset: EditorialAsset) => {
    // Opening a temporary blank tab inside the click keeps the preview user-initiated.
    const opened = window.open("about:blank", "_blank", "noopener,noreferrer");
    try {
      const url = await getEditorialAssetPreview(asset);
      if (opened) opened.location.href = url;
      else window.location.assign(url);
    } catch (error) {
      if (opened) opened.close();
      toast.error(errorMessage(error));
    }
  };
  const decide = async (id: string, decision: "cleared" | "rejected") => {
    try {
      await review.mutateAsync({ id, decision, note: reviewNotes[id] || "" });
      toast.success(decision === "cleared" ? "Rights clearance recorded" : "Asset rejected");
    } catch (error) { toast.error(errorMessage(error)); }
  };

  return <MainLayout title="Editorial Media Library" subtitle="Private interview, photography, audio, video and supporting files with independent rights review.">
    <div className="mx-auto max-w-6xl space-y-5">
      <Card className="border-amber-600/30">
        <CardContent className="flex flex-wrap items-start gap-4 p-5">
          <LockKeyhole className="h-6 w-6 shrink-0 text-amber-700" />
          <div className="flex-1 space-y-1">
            <h2 className="font-semibold">Private media by default</h2>
            <p className="text-sm text-muted-foreground">Files are stored in a private bucket and viewed through short-lived links. Rights clearance is an editorial decision, not public distribution. The HPG public publications page currently releases approved text-only snapshots, without these private files.</p>
          </div>
          <Button asChild variant="outline" size="sm"><Link to="/learning?track=communications"><GraduationCap className="mr-2 h-4 w-4" /> Learning Academy</Link></Button>
          <Button asChild variant="outline" size="sm"><Link to="/communications/editorial">Editorial Production</Link></Button>
        </CardContent>
      </Card>

      {(editorial.isLoading || media.isLoading) && <p className="text-sm text-muted-foreground">Checking media permissions and loading library…</p>}
      {(editorial.error || media.error) && <Card><CardContent className="p-5 text-sm text-destructive" role="alert">
        Media access is not ready: {errorMessage(editorial.error || media.error)}
      </CardContent></Card>}
      {editorial.data && !editorial.data.canWrite && <Card><CardContent className="p-5 text-sm">This media library is restricted to authorized editorial personnel.</CardContent></Card>}

      {editorial.data?.canWrite && <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><ImagePlus className="h-5 w-5" /> Upload private media</CardTitle>
            <CardDescription>Up to 25 MB per browser upload. Use the approved organizational Drive for larger recordings.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Related editorial content</Label>
              <Select value={itemId} onValueChange={setItemId}>
                <SelectTrigger><SelectValue placeholder="Choose article or interview" /></SelectTrigger>
                <SelectContent><SelectItem value="none">Select an editorial item</SelectItem>
                  {(editorial.data?.items || []).map(item => <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label htmlFor="editorial-media-file">Media file</Label>
              <Input id="editorial-media-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/wav"
                onChange={e => setFile(e.target.files?.[0] || null)} /></div>
            <div className="space-y-2"><Label>Alt text (required for images)</Label>
              <Textarea value={alt} onChange={e => setAlt(e.target.value)} rows={2} placeholder="Describe the useful visual information" /></div>
            <div className="space-y-2"><Label>Creator / source credit</Label>
              <Input value={credit} onChange={e => setCredit(e.target.value)} placeholder="Photographer, author, or rights holder" /></div>
            <div className="space-y-2"><Label>Rights basis</Label>
              <Select value={license} onValueChange={v => setLicense(v as typeof license)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{types.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>License / release document</Label>
              <Select value={rightsId} onValueChange={setRightsId}>
                <SelectTrigger><SelectValue placeholder="Select supporting document" /></SelectTrigger>
                <SelectContent><SelectItem value="none">Not attached</SelectItem>
                  {rightsDocs.map(d => <SelectItem key={d.id} value={d.id}>{d.file_name}</SelectItem>)}</SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Store signed consent and rights evidence in <Link className="text-primary underline" to="/documents">Documents</Link>. Files depicting identifiable people may require separate releases even if the photograph was taken by HPG.</p>
            </div>
            <Button className="w-full" disabled={itemId === "none" || !file || upload.isPending} onClick={uploaded}>
              <ImagePlus className="mr-2 h-4 w-4" /> {upload.isPending ? "Uploading…" : "Upload for rights review"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-3">
            <CardTitle className="flex items-center gap-2 text-lg"><FileImage className="h-5 w-5" /> Private asset library</CardTitle>
            <CardDescription>Files remain internal, including those marked rights-cleared. Publishing images to a public magazine requires a separate approved release process.</CardDescription>
            <Select value={filter} onValueChange={setFilter}><SelectTrigger className="max-w-60"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All rights statuses</SelectItem><SelectItem value="pending">Awaiting review</SelectItem><SelectItem value="cleared">Cleared</SelectItem><SelectItem value="rejected">Rejected</SelectItem></SelectContent></Select>
          </CardHeader>
          <CardContent className="space-y-3">
            {media.data && visible.length === 0 && <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No media files match this filter.</div>}
            {visible.map(asset => {
              const related = (editorial.data?.items || []).find(item => item.id === asset.editorial_item_id);
              const note = reviewNotes[asset.id] || "";
              return <div key={asset.id} className="space-y-3 rounded-lg border p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <FileImage className="mt-1 h-5 w-5 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="break-all font-medium">{asset.file_name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{related?.title || "Editorial content"} · {size(asset.file_size)} · {asset.content_type}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Rights: {asset.license_type.replaceAll("_", " ")} · Credit: {asset.attribution || "Not provided"}</p>
                  </div>
                  <Badge variant={asset.rights_status === "cleared" ? "secondary" : "outline"}>{statusText(asset.rights_status)}</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => showPrivate(asset)}><ExternalLink className="mr-2 h-3.5 w-3.5" /> View privately</Button>
                  {asset.rights_status === "pending" && editorial.data?.canApprove && <>
                    <Button size="sm" variant="outline" disabled={review.isPending} onClick={() => decide(asset.id, "cleared")}><ShieldCheck className="mr-2 h-3.5 w-3.5" /> Clear rights</Button>
                    <Button size="sm" variant="outline" disabled={review.isPending || note.trim().length < 5} onClick={() => decide(asset.id, "rejected")}>Reject</Button>
                  </>}
                </div>
                {asset.rights_status === "pending" && editorial.data?.canApprove && <Textarea rows={2} placeholder="Reviewer note or rejection reason"
                  value={note} onChange={e => setReviewNotes(prev => ({ ...prev, [asset.id]: e.target.value }))} />}
                {asset.rights_note && <p className="text-xs text-muted-foreground"><FileText className="mr-1 inline h-3 w-3" /> {asset.rights_note}</p>}
              </div>;
            })}
          </CardContent>
        </Card>
      </div>}
    </div>
  </MainLayout>;
}
