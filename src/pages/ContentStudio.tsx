import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, Plus, Search, ClipboardList, GraduationCap, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateWorkItem, useUpdateWorkItem, useWorkItems, type ModuleType, type WorkItemStatus } from "@/hooks/useWorkItems";

type ContentType = { value: string; label: string; hint: string };
const communicationTypes: ContentType[] = [
  { value: "magazine_article", label: "Magazine article", hint: "Research, draft, edit, fact-check and approve a story." },
  { value: "magazine_issue", label: "Magazine issue", hint: "Coordinate a collection of articles and artwork." },
  { value: "interview", label: "Interview", hint: "Plan questions, consent, recording and transcript." },
  { value: "press_release", label: "Press release", hint: "Draft, verify, review and distribute an announcement." },
  { value: "newsletter", label: "Newsletter", hint: "Coordinate copy, images and editorial review." },
  { value: "research_brief", label: "Research brief", hint: "Collect original sources and prepare evidence for publication." },
];
const marketingTypes: ContentType[] = [
  { value: "social_post", label: "Social media post", hint: "Track copy, platform, creative assets and review." },
  { value: "campaign", label: "Marketing campaign", hint: "Track campaign goals, assets, audiences and milestones." },
  { value: "interview_promotion", label: "Interview promotion", hint: "Plan approved highlights and release timing." },
  { value: "magazine_promotion", label: "Magazine promotion", hint: "Plan issue launch content and approved calls to action." },
];
const workflowStatuses: { value: WorkItemStatus; label: string }[] = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "under_review", label: "Under review" },
  { value: "complete", label: "Complete" },
  { value: "waiting_on_hpg", label: "Waiting on HPG" },
];

export default function ContentStudio({ module }: { module: "communications" | "marketing" }) {
  const isMarketing = module === "marketing";
  const contentTypes = isMarketing ? marketingTypes : communicationTypes;
  const { user } = useAuth();
  const { data: tasks = [], isLoading, error } = useWorkItems({ module });
  const createTask = useCreateWorkItem();
  const updateTask = useUpdateWorkItem();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [type, setType] = useState(contentTypes[0].value);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");

  const visibleTasks = useMemo(() => tasks.filter(task =>
    (task.title + " " + (task.description || "") + " " + (task.type || "")).toLowerCase().includes(search.toLowerCase())
  ), [tasks, search]);

  const counts = useMemo(() => ({
    total: tasks.length,
    inProgress: tasks.filter(task => task.status === "in_progress").length,
    review: tasks.filter(task => task.status === "under_review").length,
    completed: tasks.filter(task => task.status === "complete").length,
  }), [tasks]);

  const submit = async () => {
    if (!title.trim()) return;
    try {
      await createTask.mutateAsync({
        title: title.trim(),
        description: description.trim() || null,
        type,
        module: module as ModuleType,
        status: "not_started",
        priority: "medium",
        due_date: dueDate || null,
        owner_user_id: user?.id || null,
        created_by_user_id: user?.id || null,
        external_visible: false,
      });
      toast.success("Assignment created in HPG Work Items");
      setTitle(""); setDescription(""); setDueDate(""); setType(contentTypes[0].value); setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the assignment");
    }
  };

  const updateStatus = async (id: string, status: WorkItemStatus) => {
    try {
      await updateTask.mutateAsync({ id, status });
      toast.success("Assignment status updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the assignment");
    }
  };

  return (
    <MainLayout title={isMarketing ? "Marketing Assignments" : "Communications Assignments"}
      subtitle={isMarketing ? "Coordinate campaigns and social-media assignments." : "Coordinate interviews, magazine issues, articles, press releases, and research briefs."}
      actions={<Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> New assignment</Button>}>
      <div className="space-y-6">
        <div className="rounded-xl border bg-card/95 p-4">
          <h2 className="font-semibold">Assignments and controlled editorial publication</h2>
          <p className="mt-1 text-sm text-muted-foreground">Assignments are saved as organizational Work Items. Editorial Production supports separate approval and controlled HPG text publication; private media and external social-media posting remain independent workflows.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm"><Link to={"/learning?track=" + (isMarketing ? "marketing" : "communications")}><GraduationCap className="mr-2 h-4 w-4" /> Guided tutorial</Link></Button>
            {!isMarketing && <Button asChild variant="outline" size="sm"><Link to="/communications/editorial"><FileText className="mr-2 h-4 w-4" /> Editorial production</Link></Button>}
            {!isMarketing && <Button asChild variant="outline" size="sm"><Link to="/communications/media"><FileText className="mr-2 h-4 w-4" /> Private media</Link></Button>}
            {!isMarketing && <Button asChild variant="outline" size="sm"><Link to="/publications"><FileText className="mr-2 h-4 w-4" /> Public editions</Link></Button>}
            <Button asChild variant="outline" size="sm"><Link to={isMarketing ? "/modules/marketing" : "/modules/communications"}><ClipboardList className="mr-2 h-4 w-4" /> Department Operations</Link></Button>
            <Button asChild variant="outline" size="sm"><Link to="/documents"><FileText className="mr-2 h-4 w-4" /> Documents</Link></Button>
            <Button asChild variant="outline" size="sm"><Link to="/work-items"><ClipboardList className="mr-2 h-4 w-4" /> All work items</Link></Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          {[["Total assignments", counts.total], ["In progress", counts.inProgress], ["Awaiting review", counts.review], ["Completed", counts.completed]].map(([label, value]) =>
            <Card key={label}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></CardContent></Card>
          )}
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Department assignments</CardTitle>
            <CardDescription>Use the status selector only for real assignments. Approval is not a substitute for editorial or financial sign-off.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search titles, subjects, and types" value={search} onChange={event => setSearch(event.target.value)} />
            </div>
            {error && <p role="alert" className="text-sm text-destructive">Unable to load assignments: {error instanceof Error ? error.message : "Check your permissions or connection."}</p>}
            {isLoading ? <p className="text-sm text-muted-foreground">Loading assignments…</p> :
              visibleTasks.length === 0 ? <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="font-medium">No assignments found.</p>
                <p className="mt-1 text-sm text-muted-foreground">An authorized team member can use New assignment to begin a real content project.</p>
              </div> : visibleTasks.map(task => (
                <div key={task.id} className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{task.title}</p>
                      <Badge variant="outline">{contentTypes.find(item => item.value === task.type)?.label || task.type || "General"}</Badge>
                    </div>
                    {task.description && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{task.description}</p>}
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {task.due_date && <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Due {task.due_date}</span>}
                      <Link to={"/work-items?workItemId=" + task.id} className="text-primary underline-offset-2 hover:underline">Open full work item</Link>
                    </div>
                  </div>
                  <div className="w-full shrink-0 md:w-48">
                    <Label className="mb-1 block text-xs">Stage</Label>
                    <Select value={task.status} onValueChange={value => updateStatus(task.id, value as WorkItemStatus)} disabled={updateTask.isPending}>
                      <SelectTrigger aria-label={"Status for " + task.title}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {workflowStatuses.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                        {!workflowStatuses.some(item => item.value === task.status) && <SelectItem value={task.status}>{task.status.replaceAll("_", " ")}</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New {isMarketing ? "marketing" : "editorial"} assignment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="studio-type">Assignment type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="studio-type"><SelectValue /></SelectTrigger>
                <SelectContent>{contentTypes.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{contentTypes.find(item => item.value === type)?.hint}</p>
            </div>
            <div className="space-y-2"><Label htmlFor="studio-title">Title</Label><Input id="studio-title" maxLength={180} value={title} onChange={event => setTitle(event.target.value)} placeholder="Describe a real, approved assignment" /></div>
            <div className="space-y-2"><Label htmlFor="studio-description">Brief and review requirements</Label><Textarea id="studio-description" value={description} onChange={event => setDescription(event.target.value)} placeholder="Purpose, audience, assigned contributor, sources, consent, publication approval…" rows={5} /></div>
            <div className="space-y-2"><Label htmlFor="studio-date">Due date (optional)</Label><Input id="studio-date" type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} /></div>
            <p className="text-xs text-muted-foreground">This creates a live internal work item under your account. It will not publish content or notify external audiences.</p>
            <Button className="w-full" disabled={!title.trim() || createTask.isPending} onClick={submit}>{createTask.isPending ? "Creating…" : "Create assignment"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
