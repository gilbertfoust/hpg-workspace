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
import { FileText, GitBranch, Search, Sparkles, Target, Trophy } from "lucide-react";
import {
  alignGrantOpportunities,
  buildGrantDraft,
  buildTopGrantDrafts,
  grantStwDemoNgos,
  grantStwDemoOpportunities,
  type GrantAlignmentResult,
} from "@/modules/grants/lib/grantStw";

const formatScore = (score: number) => score.toFixed(2);

export default function GrantWriterTrackerClub() {
  const [search, setSearch] = useState("");
  const [minScore, setMinScore] = useState("0");
  const [requiredTheme, setRequiredTheme] = useState("all");
  const [requireRegionMatch, setRequireRegionMatch] = useState(false);
  const [selectedAlignment, setSelectedAlignment] = useState<GrantAlignmentResult | null>(null);

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
    return scored.filter((result) => {
      return [
        result.ngo.name,
        result.ngo.region,
        result.ngo.mission,
        result.grant.name,
        result.grant.funder,
        result.grant.description,
        result.grant.region,
        ...result.grant.themes,
        ...result.ngo.focusAreas,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [minScore, requireRegionMatch, requiredTheme, search]);

  const topDrafts = useMemo(() => buildTopGrantDrafts(alignments, 3), [alignments]);
  const draft = selectedAlignment ? buildGrantDraft(selectedAlignment) : topDrafts[0] || null;

  const stats = {
    ngos: grantStwDemoNgos.length,
    grants: grantStwDemoOpportunities.length,
    matches: alignments.length,
    strongMatches: alignments.filter((alignment) => alignment.score >= 2).length,
  };

  return (
    <MainLayout
      title="Grant Writer Tracker Club"
      subtitle="Development grant seeker, tracker, alignment scorer, and proposal draft workspace"
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-5 text-center">
              <p className="text-2xl font-bold">{stats.ngos}</p>
              <p className="text-xs text-muted-foreground mt-1">Demo NGO Profiles</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 text-center">
              <p className="text-2xl font-bold">{stats.grants}</p>
              <p className="text-xs text-muted-foreground mt-1">Grant Opportunities</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 text-center">
              <p className="text-2xl font-bold text-primary">{stats.matches}</p>
              <p className="text-xs text-muted-foreground mt-1">Current Matches</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 text-center">
              <p className="text-2xl font-bold text-emerald-600">{stats.strongMatches}</p>
              <p className="text-xs text-muted-foreground mt-1">Strong Fits</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Grant STW merged into Development
            </CardTitle>
            <CardDescription>
              This page brings the separate Grant-Writer repo into HPG Workspace as a staff-facing Development tool: seek opportunities, score NGO alignment, track fit, and generate proposal drafts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Seeker</Badge>
              <Badge variant="outline">Tracker</Badge>
              <Badge variant="outline">Writer</Badge>
              <Badge variant="secondary">Offline demo data preserved</Badge>
              <Badge variant="secondary">Ready for real grant-source integration</Badge>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="matches" className="space-y-4">
          <TabsList>
            <TabsTrigger value="matches"><Target className="mr-2 h-4 w-4" />Alignment Tracker</TabsTrigger>
            <TabsTrigger value="drafts"><FileText className="mr-2 h-4 w-4" />Draft Writer</TabsTrigger>
            <TabsTrigger value="pipeline"><GitBranch className="mr-2 h-4 w-4" />Tracker Club Workflow</TabsTrigger>
          </TabsList>

          <TabsContent value="matches" className="space-y-4">
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
                    <Checkbox checked={requireRegionMatch} onCheckedChange={(value) => setRequireRegionMatch(value === true)} />
                    Region match
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
                      {alignment.grant.themes.map((theme) => (
                        <Badge key={theme} variant={alignment.themeMatches.includes(theme) ? "default" : "outline"}>{theme}</Badge>
                      ))}
                    </div>
                    <div className="text-sm">
                      <p className="font-medium mb-1">Alignment notes</p>
                      <ul className="list-disc pl-5 text-muted-foreground">
                        {alignment.notes.length ? alignment.notes.map((note) => <li key={note}>{note}</li>) : <li>No alignment notes.</li>}
                      </ul>
                    </div>
                    <Button variant="outline" onClick={() => setSelectedAlignment(alignment)}>Generate Draft From This Match</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="drafts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Proposal Draft Writer</CardTitle>
                <CardDescription>
                  Draft is generated from the selected alignment match. It follows the Grant-Writer repo structure: cover letter, organizational summary, problem statement, activities, measurement, budget, and attachments.
                </CardDescription>
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
                ) : (
                  <p className="text-sm text-muted-foreground">No draft available. Select a grant alignment first.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pipeline" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-primary" />Grant Writer Tracker Club Workflow</CardTitle>
                <CardDescription>How this should operate inside Development.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-4">
                  {[
                    ["1", "Seek", "Load grant opportunities from demo data now; connect real funder sources later."],
                    ["2", "Score", "Match opportunities against NGO mission, region, themes, needs, and differentiators."],
                    ["3", "Track", "Use fit scores to prioritize Development grant-writing assignments."],
                    ["4", "Write", "Generate editable proposal drafts for grant writers and department review."],
                  ].map(([step, title, description]) => (
                    <div key={step} className="rounded-lg border p-4">
                      <Badge className="mb-3">Step {step}</Badge>
                      <h3 className="font-semibold">{title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
