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
import { useGrantOpportunities, type GrantOpportunityRecord } from "@/hooks/useGrantOpportunities";
import { useNGOs, type NGO } from "@/hooks/useNGOs";
import { useCreateWorkItem } from "@/hooks/useWorkItems";
import { GRANT_STAGES } from "@/modules/grants/types";
import { AlertTriangle, DollarSign, FileText, GitBranch, Search, Sparkles, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import {
  alignGrantOpportunities,
  buildGrantDraft,
  buildTopGrantDrafts,
  grantStwDemoNgos,
  grantStwDemoOpportunities,
  type GrantAlignmentResult,
  type GrantStwNGO,
  type GrantStwOpportunity,
} from "@/modules/grants/lib/grantStw";

const formatScore = (score: number) => score.toFixed(2);

const liveNgoToStw = (ngo: NGO): GrantStwNGO => ({
  id: ngo.id,
  name: ngo.common_name || ngo.legal_name,
  region: ngo.country || "Global",
  mission: ngo.notes || `${ngo.common_name || ngo.legal_name} is an HPG NGO partner seeking aligned grant support.`,
  focusAreas: [ngo.bundle, ngo.fiscal_type, ngo.status, ngo.country].filter(Boolean) as string[],
  annualBudget: "Not recorded",
  needs: [ngo.notes || "grant funding", ngo.country || "program support"].filter(Boolean),
  differentiators: [ngo.fiscal_type, ngo.status, ngo.city, ngo.state_province].filter(Boolean) as string[],
});

const liveOpportunityToStw = (opp: GrantOpportunityRecord): GrantStwOpportunity => ({
  id: opp.id,
  name: opp.title,
  funder: opp.funder_name || opp.funder || opp.grant_sources?.name || "Unknown Funder",
  description: opp.description || "No description recorded.",
  themes: opp.focus_areas?.length ? opp.focus_areas : ([opp.region, opp.country].filter(Boolean) as string[]),
  region: opp.region || opp.country || "Global",
  amountRange: [
    opp.min_award ? `$${Number(opp.min_award).toLocaleString()}` : "TBD",
    opp.max_award ? `$${Number(opp.max_award).toLocaleString()}` : "TBD",
  ],
  deadline: opp.deadline || "No deadline recorded",
  url: opp.url || "",
});

const buildDepartmentGrantTasks = (alignment: GrantAlignmentResult, masterWorkItemId: string, dueDate?: string) => {
  const baseDetails = `Grant: ${alignment.grant.name}\nNGO: ${alignment.ngo.name}\nFunder: ${alignment.grant.funder}\nDeadline: ${alignment.grant.deadline}\nFit score: ${formatScore(alignment.score)}\nMatch notes: ${alignment.notes.join("; ") || "No alignment notes."}`;

  return [
    {
      module: "development" as const,
      title: `Development research: ${alignment.grant.name}`,
      type: "grant_research",
      description: `${baseDetails}\n\nDevelopment responsibilities:\n- Complete needs statement research\n- Gather demographics and community statistics\n- Validate program alignment and outcomes\n- Prepare evidence and data points for proposal narrative`,
    },
    {
      module: "finance" as const,
      title: `Finance budget package: ${alignment.grant.name}`,
      type: "grant_budget",
      description: `${baseDetails}\n\nFinance responsibilities:\n- Draft project budget\n- Confirm allowable costs and fiscal sponsor assumptions\n- Add indirect/admin cost notes\n- Prepare budget narrative for proposal review`,
    },
    {
      module: "communications" as const,
      title: `Communications proposal narrative: ${alignment.grant.name}`,
      type: "grant_narrative",
      description: `${baseDetails}\n\nCommunications responsibilities:\n- Draft LOI language\n- Prepare mission, vision, and organizational background\n- Shape the proposal story and impact framing\n- Polish funder-facing language`,
    },
    {
      module: "ngo_coordination" as const,
      title: `NGO Coordination grant packet: ${alignment.ngo.name}`,
      type: "grant_document_packet",
      description: `${baseDetails}\n\nNGO Coordination responsibilities:\n- Confirm NGO questionnaire details\n- Request missing documents\n- Confirm project contact and program details\n- Gather compliance and evidence packet materials`,
    },
  ].map((task) => ({
    ...task,
    priority: alignment.score >= 2 ? "high" as const : "medium" as const,
    due_date: dueDate,
    ngo_id: alignment.ngo.id,
    dependencies: [masterWorkItemId],
  }));
};

export default function GrantsDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const applicationsQuery = useGrantApplications();
  const createApplication = applicationsQuery.create;
  const { data: applications } = applicationsQuery;
  const { data: opportunities } = useGrantOpportunities({ status: "open" });
  const { data: ngos } = useNGOs();
  const createWorkItem = useCreateWorkItem();

  const [search, setSearch] = useState("");
  const [minScore, setMinScore] = useState("0");
  const [requiredTheme, setRequiredTheme] = useState("all");
  const [requireRegionMatch, setRequireRegionMatch] = useState(false);
  const [selectedAlignment, setSelectedAlignment] = useState<GrantAlignmentResult | null>(null);
  const [creatingKey, setCreatingKey] = useState<string | null>(null);

  const liveNgos = useMemo(() => (ngos?.length ? ngos.map(liveNgoToStw) : []), [ngos]);
  const liveOpportunities = useMemo(() => (opportunities?.length ? opportunities.map(liveOpportunityToStw) : []), [opportunities]);
  const stwNgos = liveNgos.length ? liveNgos : grantStwDemoNgos;
  const stwOpportunities = liveOpportunities.length ? liveOpportunities : grantStwDemoOpportunities;
  const usingLiveData = liveNgos.length > 0 && liveOpportunities.length > 0;

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
    stwOpportunities.forEach((grant) => grant.themes.forEach((theme) => theme && themes.add(theme)));
    return Array.from(themes).sort();
  }, [stwOpportunities]);

  const alignments = useMemo(() => {
    const scored = alignGrantOpportunities(stwNgos, stwOpportunities, {
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
  }, [minScore, requireRegionMatch, requiredTheme, search, stwNgos, stwOpportunities]);

  const topDrafts = useMemo(() => buildTopGrantDrafts(alignments, 3), [alignments]);
  const draft = selectedAlignment ? buildGrantDraft(selectedAlignment) : topDrafts[0] || null;

  const handleCreateGrantTaskPackage = async (alignment: GrantAlignmentResult) => {
    const key = `${alignment.ngo.id}-${alignment.grant.id}`;
    setCreatingKey(key);
    try {
      const draftProposal = buildGrantDraft(alignment);
      const dueDate = alignment.grant.deadline && alignment.grant.deadline !== "No deadline recorded" ? alignment.grant.deadline : undefined;

      const masterWorkItem = await createWorkItem.mutateAsync({
        title: `Grant package: ${alignment.grant.name} for ${alignment.ngo.name}`,
        description: `Coordinate full grant-writing package for ${alignment.ngo.name}.\n\nFunder: ${alignment.grant.funder}\nDeadline: ${alignment.grant.deadline}\nFit score: ${formatScore(alignment.score)}\nNotes: ${alignment.notes.join("; ") || "No alignment notes."}\n\nThis master item is supported by department-specific tasks for Development, Finance, Communications, and NGO Coordination.`,
        module: "development",
        type: "grant_package_master",
        priority: alignment.score >= 2 ? "high" : "medium",
        due_date: dueDate,
        ngo_id: alignment.ngo.id,
      });

      const departmentTasks = buildDepartmentGrantTasks(alignment, masterWorkItem.id, dueDate);
      for (const task of departmentTasks) {
        await createWorkItem.mutateAsync(task);
      }

      await createApplication.mutateAsync({
        title: `${alignment.ngo.name} – ${alignment.grant.name}`,
        ngo_id: alignment.ngo.id,
        opportunity_id: alignment.grant.id,
        stage: "researching",
        source_match_score: alignment.score,
        fit_notes: alignment.notes.join("; "),
        work_item_id: masterWorkItem.id,
        deadline: dueDate,
        draft_text: draftProposal.content,
        notes: `Created from Development Grant Writer Tracker Club. Generated master work item plus ${departmentTasks.length} department tasks. Theme matches: ${alignment.themeMatches.join(", ") || "None"}.`,
      });

      toast({
        title: "Grant task package created",
        description: "Created the master grant item, department tasks, and linked grant application record.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Unable to create grant task package",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setCreatingKey(null);
    }
  };

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
              <CardTitle className="text-sm font-medium">Strong Fits</CardTitle>
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
                <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Grant STW merged into live Development workflow</CardTitle>
                <CardDescription>{usingLiveData ? "Scoring is using live NGO records and live grant opportunities." : "Demo STW scoring is shown until live NGO/opportunity records are available."}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={usingLiveData ? "default" : "secondary"}>{usingLiveData ? "Live data active" : "Demo fallback active"}</Badge>
                  <Badge variant="outline">Seek</Badge>
                  <Badge variant="outline">Score</Badge>
                  <Badge variant="outline">Track</Badge>
                  <Badge variant="outline">Write</Badge>
                  <Badge variant="outline">Department Task Package</Badge>
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
              {alignments.map((alignment) => {
                const key = `${alignment.ngo.id}-${alignment.grant.id}`;
                return (
                  <Card key={key} className="hover:border-primary/50 transition-colors">
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
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => setSelectedAlignment(alignment)}>Generate Draft From This Match</Button>
                        <Button onClick={() => handleCreateGrantTaskPackage(alignment)} disabled={creatingKey === key}>{creatingKey === key ? "Creating Package..." : "Create Department Task Package"}</Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="writer" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Proposal Draft Writer</CardTitle>
                <CardDescription>Drafts use the Grant-Writer repo structure and can be copied into Development/Communications proposal workflows.</CardDescription>
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
