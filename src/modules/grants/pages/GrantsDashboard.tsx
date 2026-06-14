import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGrantApplications } from "@/hooks/useGrantApplications";
import { useGrantOpportunities } from "@/hooks/useGrantOpportunities";
import { GRANT_STAGES } from "@/modules/grants/types";
import { AlertTriangle, DollarSign, FileText, GitBranch, Search, Sparkles, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  alignGrantOpportunities,
  buildGrantDraft,
  buildTopGrantDrafts,
  grantStwDemoNgos,
  grantStwDemoOpportunities,
  type GrantAlignmentResult,
} from "@/modules/grants/lib/grantStw";

const formatScore = (score: number) => score.toFixed(2);

export default function GrantsDashboard() {
  const navigate = useNavigate();
  const { data: applications } = useGrantApplications();
  const { data: opportunities } = useGrantOpportunities({ status: "open" });
  const [search, setSearch] = useState("");
  const [minScore, setMinScore] = useState("0");
  const [requiredTheme, setRequiredTheme] = useState("all");
  const [requireRegionMatch, setRequireRegionMatch] = useState(false);
  const [selectedAlignment, setSelectedAlignment] = useState<GrantAlignmentResult | null>(null);

  const stats = {
    openOpportunities: opportunities?.length ?? 0,
    activeApplications: applications?.filter(a => !["closed", "declined"].includes(a.stage)).length ?? 0,
    totalAwarded: applications?.filter(a => a.stage === "awarded").reduce((s, a) => s + (a.amount_awarded ?? 0), 0) ?? 0,
    deadlineSoon: opportunities?.filter(o => {
      if (!o.deadline) return false;
      const diff = new Date(o.deadline).getTime() - Date.now();
      return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
    }).length ?? 0,
  };

  const stageCounts = GRANT_STAGES.reduce((acc, stage) => {
    acc[stage] = applications?.filter(a => a.stage === stage).length ?? 0;
    return acc;
  }, {} as Record<string, number>);

  const allThemes = useMemo(() => {
    const themes = new Set<string>();
    grantStwDemoOpportunities.forEach((grant) => grant.themes.forEach((theme) => themes.add(theme)));
    return Array.from(themes).sort();
  }, []);

  const alignments = useMemo(() => {
    const scored = alignGrantOpportunities(grantStwDemoNgos, grantStwDemoOpportunities, {
      minScore: Number(minScore) || 0,
      requireRegionMatch,
      requiredTheme: requiredTheme === "all" ? undefined : requiredTheme,
    });
    const q = search.trim().toLowerCase();
    if (!q) return scored;
    return scored.filter((result) => [
      result.ngo.name,
      result.ngo.region,
      result.ngo.mission,
      result.grant.name,
      result.grant.funder,
      result.grant.description,
      result.grant.region,
      ...result.grant.themes,
      ...result.ngo.focusAreas,
    ].join(" ").toLowerCase().includes(q));
  }, [minScore, requireRegionMatch, requiredTheme, search]);

  const topDrafts = useMemo(() => buildTopGrantDrafts(alignments, 3), [alignments]);
  const draft = selectedAlignment ? buildGrantDraft(selectedAlignment) : topDrafts[0] || null;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Development Grant Writer Tracker Club</h1>
          <p className="text-muted-foreground">Search opportunities, track applications, score NGO alignment, and draft grant proposals.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/grants/search")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Open Opportunities</CardTitle>
              <Search className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{stats.openOpportunities}</p></CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/grants/pipeline")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Applications</CardTitle>
              <GitBranch className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{stats.activeApplications}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Awarded</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">${stats.totalAwarded.toLocaleString()}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Strong Demo Fits</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{alignments.filter((alignment) => alignment.score >= 2).length}</p></CardContent>
          </Card>
        </div>

        <Tabs defaultValue="tracker" className="space-y-4">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="pipeline">Pipeline Overview</TabsTrigger>
            <TabsTrigger value="tracker"><Target className="mr-2 h-4 w-4" />STW Tracker</TabsTrigger>
            <TabsTrigger value="writer"><FileText className="mr-2 h-4 w-4" />Draft Writer</TabsTrigger>
          </TabsList>

          <TabsContent value="pipeline" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Pipeline Overview</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {GRANT_STAGES.map(stage => (
                    <Badge key={stage} variant={stageCounts[stage] > 0 ? "default" : "outline"} className="text-xs">
                      {stage.replace(/_/g, " ")} ({stageCounts[stage]})
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Grant STW merged into Development</CardTitle>
                <CardDescription>The separate Grant-Writer repo is now represented inside the main grants dashboard as seeker, tracker, and writer capability.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-4">
                  {[
                    ["Seek", "Load opportunities from the demo source now, then connect real funder sources later."],
                    ["Score", "Match grants against NGO mission, region, focus areas, and needs."],
                    ["Track", "Prioritize grant writing assignments by fit score and funding target."],
                    ["Write", "Generate ready-to-edit proposal drafts for grant writers."],
                  ].map(([title, description]) => (
                    <div key={title} className="rounded-lg border p-4">
                      <h3 className="font-semibold">{title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tracker" className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="grid gap-3 md:grid-cols-[1fr_160px_180px_auto]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input className="pl-9" placeholder="Search NGOs, funders, regions, themes..." value={search} onChange={(event) => setSearch(event.target.value)} />
                  </div>
                  <Input type="number" min="0" step="0.1" value={minScore} onChange={(event) => setMinScore(event.target.value)} placeholder="Min score" />
                  <Select value={requiredTheme} onValueChange={setRequiredTheme}>
                    <SelectTrigger><SelectValue placeholder="Theme" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Themes</SelectItem>
                      {allThemes.map((theme) => <SelectItem key={theme} value={theme}>{theme}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <label className="flex items-center gap-2 rounded-md border px-3 text-sm">
                    <Checkbox checked={requireRegionMatch} onCheckedChange={(value) => setRequireRegionMatch(value === true)} /> Region match
                  </label>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4">
              {alignments.map((alignment) => (
                <Card key={`${alignment.ngo.id}-${alignment.grant.id}`} className="hover:border-primary/50 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <CardTitle className="text-base">{alignment.ngo.name} → {alignment.grant.name}</CardTitle>
                        <CardDescription>{alignment.grant.funder} · {alignment.grant.region} · Deadline {alignment.grant.deadline}</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={alignment.score >= 2 ? "default" : "secondary"}>Score {formatScore(alignment.score)}</Badge>
                        {alignment.regionMatch && <Badge variant="outline">Region match</Badge>}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">{alignment.grant.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {alignment.grant.themes.map((theme) => <Badge key={theme} variant={alignment.themeMatches.includes(theme) ? "default" : "outline"}>{theme}</Badge>)}
                    </div>
                    <ul className="list-disc pl-5 text-sm text-muted-foreground">
                      {alignment.notes.length ? alignment.notes.map((note) => <li key={note}>{note}</li>) : <li>No alignment notes.</li>}
                    </ul>
                    <Button variant="outline" onClick={() => setSelectedAlignment(alignment)}>Generate Draft From This Match</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="writer" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Proposal Draft Writer</CardTitle>
                <CardDescription>Drafts use the Grant-Writer repo structure: cover letter, organizational summary, problem statement, activities, measurement, budget, and attachments.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {draft ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge variant="outline">{draft.filename}</Badge>
                      <Button variant="secondary" onClick={() => navigator.clipboard?.writeText(draft.content)}>Copy Draft</Button>
                    </div>
                    <Textarea value={draft.content} readOnly className="min-h-[520px] font-mono text-xs" />
                  </>
                ) : <p className="text-sm text-muted-foreground">No draft available. Select a grant alignment first.</p>}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
