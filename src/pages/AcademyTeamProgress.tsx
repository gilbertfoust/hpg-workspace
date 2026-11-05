import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, GraduationCap, Search, Users } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useUserRole, isAdminRole } from "@/hooks/useUserRole";
import { useAcademyCatalog, useAcademyTeamProgress } from "@/hooks/useAcademyProgress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

const readable = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, ch => ch.toUpperCase());
const dateLabel = (value: string | null) => value ? new Date(value).toLocaleDateString() : "No completion recorded";
export default function AcademyTeamProgress() {
  const { data: userRole } = useUserRole();
  const team = useAcademyTeamProgress();
  const catalog = useAcademyCatalog();
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const members = useMemo(() => (team.data || []).filter(m =>
    (m.full_name + " " + m.role).toLowerCase().includes(search.toLowerCase())), [team.data, search]);
  const chosen = (team.data || []).find(m => m.user_id === selectedUser);
  const titles = new Map((catalog.data || []).map(lesson => [lesson.lesson_id, lesson.title]));
  const completedTotal = (team.data || []).reduce((sum, member) => sum + member.completed_count, 0);
  const activeCount = (team.data || []).filter(member => member.completed_count > 0).length;
  const canViewReport = isAdminRole(userRole?.role) || (team.data || []).length > 0;

  return <MainLayout title="Learning Academy — Team Progress"
    subtitle="Self-reported practice activity for directly supervised staff or authorized administrators.">
    <div className="mx-auto max-w-6xl space-y-5">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-5">
          <GraduationCap className="h-7 w-7 text-primary" />
          <div className="min-w-60 flex-1 space-y-1">
            <h2 className="font-semibold">Training orientation report</h2>
            <p className="text-sm text-muted-foreground">
              Counts reflect what participants themselves marked complete. These are not exam results, HR certifications,
              mandatory-compliance attestations, or independent proof of proficiency.
            </p>
          </div>
          <Button size="sm" variant="outline" asChild>
            <Link to="/learning"><ArrowLeft className="mr-1 h-4 w-4" /> Back to Academy</Link>
          </Button>
        </CardContent>
      </Card>
      {(team.isLoading || catalog.isLoading) && <p className="text-sm text-muted-foreground">Loading authorized training records…</p>}
      {(team.error || catalog.error) && <Card><CardContent className="p-5 text-sm text-destructive" role="alert">
        The Academy report could not be loaded. Verify that your approved account has training access and try again.
      </CardContent></Card>}
      {!team.isLoading && !team.error && !canViewReport && <Card><CardContent className="p-6 text-sm text-muted-foreground">
        No directly assigned reports are available for your account. Team reports are limited to authorized administrators and colleagues identified as your direct reports in HPG's staff profiles.
      </CardContent></Card>}
      {canViewReport && !team.error && !catalog.error && <>
        <div className="grid gap-3 sm:grid-cols-3">
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">People in reporting scope</p>
            <p className="text-3xl font-semibold">{team.data?.length || 0}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">People with recorded practice</p>
            <p className="text-3xl font-semibold">{activeCount}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Self-reported lesson completions</p>
            <p className="text-3xl font-semibold">{completedTotal}</p></CardContent></Card>
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(290px,1fr)_minmax(0,1.3fr)]">
          <Card className="h-fit">
            <CardHeader><CardTitle className="flex gap-2 text-lg"><Users className="h-5 w-5" /> Team roster</CardTitle>
              <CardDescription>Only active colleagues inside your permitted reporting scope.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input aria-label="Find team member" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search names or roles" /></div>
              <div className="max-h-[650px] space-y-2 overflow-y-auto">
                {members.length === 0 && <p className="p-3 text-sm text-muted-foreground">No matching staff member.</p>}
                {members.map(member => <button key={member.user_id} type="button"
                  onClick={() => setSelectedUser(member.user_id)}
                  className={"w-full rounded-lg border p-3 text-left transition hover:bg-muted/40 " + (member.user_id === selectedUser ? "border-primary bg-primary/5" : "")}>
                  <p className="font-medium">{member.full_name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{readable(member.role)} · {dateLabel(member.last_completed_at)}</p>
                  <p className="mt-2 text-sm">{member.completed_count} lessons self-reported</p>
                </button>)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-lg">{chosen ? chosen.full_name : "Select a colleague"}</CardTitle>
              <CardDescription>{chosen ? "The lesson list reflects self-reported practice, not independent competency assessment." :
                "Open a team member to review their current saved Academy activities."}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {chosen && <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{readable(chosen.role)}</Badge>
                  <Badge variant="secondary">{chosen.completed_count} lessons recorded</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Most recent activity: {dateLabel(chosen.last_completed_at)}</p>
                <Progress value={catalog.data?.length ? Math.round(chosen.completed_lessons.length / catalog.data.length * 100) : 0} />
                <p className="text-xs text-muted-foreground">The bar compares recorded lessons to the entire authored catalog. Some lessons may be unavailable for this role; it is not a required-training percentage.</p>
                {chosen.completed_lessons.length === 0 ? <p className="text-sm text-muted-foreground">No lessons have been marked complete.</p> :
                  <div className="space-y-2">
                    {chosen.completed_lessons.map(id => <div key={id} className="rounded-md border p-3 text-sm">
                      <p className="font-medium">{titles.get(id) || id}</p>
                      <p className="text-xs text-muted-foreground">Self-reported practice completion</p>
                    </div>)}
                  </div>}
              </>}
            </CardContent>
          </Card>
        </div>
      </>}
    </div>
  </MainLayout>;
}
