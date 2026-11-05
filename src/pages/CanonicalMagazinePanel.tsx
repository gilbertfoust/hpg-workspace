import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, ExternalLink, Printer, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { type OperationsRecord } from "@/hooks/useDepartmentOperations";
import {
  type Publication, type PublicContribution, useCommunicationsIssuePreview,
  usePublishCommunicationsIssue, useWithdrawCommunicationsIssue,
} from "@/hooks/usePublications";
import "./editorial-print.css";

const displayDate = (value?: string | null) => value ? new Date(value).toLocaleString() : "Not scheduled";
const errorMessage = (err: unknown) => err instanceof Error ? err.message : "This action could not be completed.";

function ArticleProof({ item }: { item: PublicContribution }) {
  return <article className="break-inside-avoid-page space-y-3 border-b pb-8">
    {item.section && <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{item.section}</p>}
    <h3 className="text-xl font-semibold">{item.title}</h3>
    {item.summary && <p className="italic text-muted-foreground">{item.summary}</p>}
    <div className="space-y-3 text-sm leading-7">
      {(item.body_markdown || "").split(/\n{2,}/).filter(Boolean).map((paragraph, i) =>
        <p key={i} className="whitespace-pre-wrap">{paragraph.replace(/^#{1,4}\s+/, "")}</p>
      )}
    </div>
  </article>;
}

export default function CanonicalMagazinePanel({ issue, authorized, livePublication }: {
  issue: OperationsRecord;
  authorized: boolean;
  livePublication?: Publication;
}) {
  const [showProof, setShowProof] = useState(false);
  const [slug, setSlug] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [withdrawalReason, setWithdrawalReason] = useState("");
  const proof = useCommunicationsIssuePreview(issue.id);
  const publish = usePublishCommunicationsIssue();
  const withdraw = useWithdrawCommunicationsIssue();
  const issueArticles = useMemo(() => proof.data?.articles || [], [proof.data?.articles]);
  const due = !!issue.scheduled_at && new Date(issue.scheduled_at).getTime() <= Date.now();
  const canRelease = issue.status === "scheduled" && authorized && !livePublication && due;
  const publicUrl = (name: string) => new URL(import.meta.env.BASE_URL + "publications/" + name, window.location.origin).toString();

  const publishIssue = async () => {
    if (!confirmed || !canRelease) return;
    try {
      const released = await publish.mutateAsync({ id: issue.id, slug: slug.trim() });
      setConfirmed(false);
      toast.success("Approved HPG magazine edition released: " + publicUrl(released.slug));
    } catch (err) { toast.error(errorMessage(err)); }
  };
  const withdrawIssue = async () => {
    if (!livePublication || !authorized || withdrawalReason.trim().length < 10) return;
    try {
      await withdraw.mutateAsync({ id: issue.id, reason: withdrawalReason.trim() });
      setWithdrawalReason("");
      toast.success("Public magazine edition withdrawn. Previously cached copies may remain available.");
    } catch (err) { toast.error(errorMessage(err)); }
  };

  return <Card data-tour="canonical-magazine-release">
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-base"><BookOpen className="h-4 w-4" /> Magazine proof and publication</CardTitle>
      <CardDescription>
        Preview the original Communications issue, then release an approved, text-only copy through HPG Publications.
        Design files, private images, consent evidence, and recordings remain inside authorized storage.
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">Canonical status: {issue.status.replaceAll("_", " ")}</Badge>
        <Badge variant="outline">{issueArticles.length} reviewed contributions in preview</Badge>
        <span className="text-xs text-muted-foreground">Planned release: {displayDate(issue.scheduled_at)}</span>
      </div>
      {proof.error && <p role="alert" className="text-sm text-destructive">
        The internal magazine preview is not ready: {errorMessage(proof.error)}.
      </p>}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setShowProof(v => !v)} disabled={proof.isLoading || !!proof.error}>
          {showProof ? "Hide internal proof" : "Preview internal magazine proof"}
        </Button>
        <Button variant="outline" disabled={issueArticles.length === 0} onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" /> Print internal proof
        </Button>
      </div>
      {showProof && proof.data && <div className="max-h-[620px] space-y-6 overflow-y-auto rounded-lg border bg-muted/20 p-5">
        <p className="text-xs font-semibold text-muted-foreground">INTERNAL EDITORIAL PROOF — NOT FOR PUBLIC DISTRIBUTION</p>
        <h2 className="text-2xl font-semibold">{proof.data.title}</h2>
        {proof.data.summary && <p className="italic">{proof.data.summary}</p>}
        {issueArticles.length === 0
          ? <p className="text-sm text-muted-foreground">No approved contributions can be previewed yet. Add reviewed stories using Magazine story placements.</p>
          : issueArticles.map((item,i) => <ArticleProof key={item.editorial_item_id || i} item={item} />)}
      </div>}
      <section id="editorial-printable" className="editorial-print-only" aria-label="Printable canonical magazine proof">
        <header className="mb-10 border-b-2 pb-6">
          <p>HUMANITY PATHWAYS GLOBAL</p>
          <h1 className="my-5 text-4xl font-bold">{proof.data?.title || issue.title}</h1>
          <p>{proof.data?.summary || ""}</p>
          <small>INTERNAL PROOF — NOT FOR PUBLIC DISTRIBUTION</small>
        </header>
        <h2 className="mb-5 text-xl font-semibold">Contents</h2>
        <ol className="mb-10 list-decimal pl-6">
          {issueArticles.map((item,i) => <li key={i}>{item.title}</li>)}
        </ol>
        {issueArticles.map((item,i) => <ArticleProof key={i} item={item} />)}
      </section>

      {livePublication && <div className="space-y-3 rounded-lg border p-4">
        <p className="font-semibold">HPG public edition is live</p>
        <Link to={"/publications/" + livePublication.slug} className="block break-all text-sm text-primary underline">
          <ExternalLink className="mr-1 inline h-4 w-4" />{publicUrl(livePublication.slug)}
        </Link>
        {authorized && <div className="space-y-2 border-t pt-3">
          <Label>Reason to withdraw (at least 10 characters)</Label>
          <Textarea rows={2} value={withdrawalReason} onChange={e => setWithdrawalReason(e.target.value)} />
          <Button variant="outline" disabled={withdraw.isPending || withdrawalReason.trim().length < 10} onClick={withdrawIssue}>
            Withdraw HPG magazine edition
          </Button>
        </div>}
      </div>}
      {canRelease && <div className="space-y-3 rounded-lg border border-primary/30 p-4">
        <p className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4" /> Authorized magazine release</p>
        <p className="text-sm text-muted-foreground">
          The database independently verifies the entire issue, each story's current version and approvals,
          current fact checks, consent evidence, scheduled time, and the separate distribution approval.
        </p>
        <div className="space-y-1">
          <Label htmlFor={"issue-slug-" + issue.id}>Public URL name</Label>
          <Input id={"issue-slug-" + issue.id} placeholder="hpg-magazine-first-edition" value={slug}
            onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} maxLength={90} />
        </div>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={confirmed} onCheckedChange={v => setConfirmed(v === true)} />
          I confirm this exact issue and all contributing stories have been approved for public text release, including consent, embargo and rights checks.
        </label>
        <Button disabled={publish.isPending || !!proof.error || !confirmed || issueArticles.length===0 ||
          !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length < 4} onClick={publishIssue}>
          {publish.isPending ? "Publishing…" : "Publish approved issue to HPG"}
        </Button>
      </div>}
      {issue.status === "scheduled" && !due && <p className="text-sm text-muted-foreground">
        The approved issue is scheduled for a future time. Publication is not yet available.
      </p>}
      {issue.status === "distributed" && !livePublication && <p className="text-sm text-muted-foreground">
        The issue has historical distribution evidence, but no currently live HPG text edition.
        A previous edition may have been withdrawn or distributed through another channel.
      </p>}
      <p className="text-xs text-muted-foreground">
        Completing a task, entering a date, or generating a proof never automatically publishes material.
        The public snapshot is permanent for audit purposes; corrections require the approved editorial process.
      </p>
    </CardContent>
  </Card>;
}
