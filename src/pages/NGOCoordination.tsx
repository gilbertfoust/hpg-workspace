import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { addDays, format, isWithinInterval } from "date-fns";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusChip } from "@/components/common/StatusChip";
import { FormSubmissionSheet } from "@/components/ngo/FormSubmissionSheet";
import { DocumentRequestDialog } from "@/components/ngo/DocumentRequestDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useNGOs, NGO } from "@/hooks/useNGOs";
import { useWorkItems, WorkItemStatus } from "@/hooks/useWorkItems";
import { useFormTemplates } from "@/hooks/useFormTemplates";
import { getSupabaseNotConfiguredError, isSupabaseNotConfiguredError, supabase } from "@/integrations/supabase/client";
import { SupabaseNotConfiguredNotice } from "@/components/common/SupabaseNotConfiguredNotice";
import { CalendarCheck, FileText, ArrowRight, Inbox } from "lucide-react";
import type { ModuleType } from "@/hooks/useWorkItems";

const statusMap: Record<string, "approved" | "in-progress" | "rejected" | "draft" | "waiting-ngo"> = {
  active: "approved",
  onboarding: "in-progress",
  at_risk: "rejected",
  prospect: "draft",
  offboarding: "waiting-ngo",
  closed: "draft",
};

const openStatuses: WorkItemStatus[] = [
  "not_started",
  "in_progress",
  "waiting_on_ngo",
  "waiting_on_hpg",
  "submitted",
  "under_review",
];

const moduleLabels: Record<ModuleType, string> = {
  ngo_coordination: "NGO Coordination",
  administration: "Administration",
  operations: "Operations",
  program: "Program",
  curriculum: "Curriculum",
  development: "Development / Grants",
  partnership: "Partnerships",
  marketing: "Marketing",
  communications: "Communications",
  hr: "HR",
  it: "Technology / IT",
  finance: "Finance",
  legal: "Legal / Compliance",
};

interface IncomingNgoRequest {
  id: string;
  ngo_id: string;
  status: string;
  requested_module: ModuleType | null;
  submitted_at: string;
  payload_json: Record<string, unknown>;
  ngo_request_templates?: { name: string; request_type: string } | null;
  ngos?: { legal_name: string; common_name: string | null } | null;
}

const ensureSupabase = () => {
  if (!supabase) throw getSupabaseNotConfiguredError();
  return supabase;
};

const requestStatusLabel = (status: string) =>
  status === "submitted_to_ngo_coordination"
    ? "New / Needs Triage"
    : status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function NGOCoordination() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: ngos, isLoading, error } = useNGOs();
  const { data: workItems, isLoading: workItemsLoading, error: workItemsError } = useWorkItems();
  const { data: templates, isLoading: templatesLoading, error: templatesError } = useFormTemplates("ngo_coordination");

  const [selectedCheckInNgo, setSelectedCheckInNgo] = useState<NGO | null>(null);
  const [requestDocsNgo, setRequestDocsNgo] = useState<NGO | null>(null);

  const { data: incomingRequests = [], isLoading: requestsLoading, error: requestsError } = useQuery<IncomingNgoRequest[]>({
    queryKey: ["ngo-coordination-incoming-requests"],
    enabled: !!supabase,
    queryFn: async () => {
      const client = ensureSupabase();
      const { data, error } = await client
        .from("ngo_request_submissions" as never)
        .select("id, ngo_id, status, requested_module, submitted_at, payload_json, ngo_request_templates(name, request_type), ngos(legal_name, common_name)" as never)
        .order("submitted_at" as never, { ascending: false })
        .limit(25);
      if (error) throw error;
      return (data || []) as unknown as IncomingNgoRequest[];
    },
  });

  const coordinatorNGOs = useMemo(
    () => (ngos || []).filter((ngo) => ngo.ngo_coordinator_user_id === user?.id),
    [ngos, user?.id],
  );

  const monthlyTemplate = useMemo(() => {
    if (!templates) return null;
    return (
      templates.find((template) => template.name.toLowerCase() === "monthly ngo check-in") ||
      templates.find((template) => template.name.toLowerCase().includes("monthly"))
    );
  }, [templates]);

  const statsByNgo = useMemo(() => {
    const now = new Date();
    const horizon = addDays(now, 30);
    const byNgo = new Map<string, { open: number; missing: number; upcoming: number }>();

    (workItems || []).forEach((item) => {
      if (!item.ngo_id) return;
      if (!openStatuses.includes(item.status)) return;
      const current = byNgo.get(item.ngo_id) || { open: 0, missing: 0, upcoming: 0 };
      current.open += 1;
      if (item.evidence_required && item.evidence_status === "missing") current.missing += 1;
      if (item.due_date) {
        const dueDate = new Date(item.due_date);
        if (isWithinInterval(dueDate, { start: now, end: horizon })) current.upcoming += 1;
      }
      byNgo.set(item.ngo_id, current);
    });

    return byNgo;
  }, [workItems]);

  const supabaseNotConfigured =
    isSupabaseNotConfiguredError(error) ||
    isSupabaseNotConfiguredError(workItemsError) ||
    isSupabaseNotConfiguredError(templatesError) ||
    isSupabaseNotConfiguredError(requestsError);

  if (supabaseNotConfigured) {
    return (
      <MainLayout title="NGO Coordination" subtitle="Manage your assigned NGO relationships">
        <SupabaseNotConfiguredNotice />
      </MainLayout>
    );
  }

  return (
    <MainLayout title="NGO Coordination" subtitle="Track assigned NGOs, NGO portal requests, check-ins, and document requests">
      <div className="space-y-6">
        {templatesLoading ? null : !monthlyTemplate && (
          <Card className="border-warning/40 bg-warning/5">
            <CardContent className="p-4 text-sm text-muted-foreground">
              Add a form template named “Monthly NGO Check-in” to enable the monthly check-in flow.
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Inbox className="h-5 w-5" />
                Incoming NGO Portal Requests
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Requests submitted by NGOs come here first before being routed to a department.
              </p>
            </div>
            <Badge variant="secondary">{incomingRequests.length} recent</Badge>
          </CardHeader>
          <CardContent className="p-0">
            {requestsLoading ? (
              <div className="p-6"><Skeleton className="h-24" /></div>
            ) : incomingRequests.length === 0 ? (
              <div className="px-5 py-8 text-sm text-muted-foreground">No NGO portal requests yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Request</TableHead>
                    <TableHead>NGO</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Suggested Department</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Summary</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incomingRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">{request.ngo_request_templates?.name || "NGO Request"}</TableCell>
                      <TableCell>{request.ngos?.common_name || request.ngos?.legal_name || "—"}</TableCell>
                      <TableCell><Badge variant="outline">{requestStatusLabel(request.status)}</Badge></TableCell>
                      <TableCell>{request.requested_module ? moduleLabels[request.requested_module] : "NGO Coordination"}</TableCell>
                      <TableCell>{format(new Date(request.submitted_at), "MMM d, yyyy")}</TableCell>
                      <TableCell className="max-w-[260px] truncate text-muted-foreground">{String(request.payload_json?.summary || request.payload_json?.details || "—")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Assigned NGOs</h2>
            <p className="text-sm text-muted-foreground">{coordinatorNGOs.length} organizations assigned to you</p>
          </div>
        </div>

        {isLoading || workItemsLoading ? (
          <div className="grid gap-4">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-40" />)}</div>
        ) : coordinatorNGOs.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground"><p className="text-sm">No NGOs are assigned to you yet.</p></CardContent></Card>
        ) : (
          <div className="grid gap-4">
            {coordinatorNGOs.map((ngo) => {
              const stats = statsByNgo.get(ngo.id) || { open: 0, missing: 0, upcoming: 0 };
              const displayName = ngo.common_name || ngo.legal_name;
              return (
                <Card key={ngo.id}>
                  <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="text-lg">{displayName}</CardTitle>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <StatusChip status={statusMap[ngo.status] || "draft"} />
                        <span>{ngo.bundle || "No bundle"} Bundle</span>
                        <Badge variant="outline">{ngo.country || ngo.city || ngo.state_province || "No location"}</Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => setSelectedCheckInNgo(ngo)} disabled={!monthlyTemplate}>
                        <CalendarCheck className="w-4 h-4 mr-2" />Start Monthly Check-In
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setRequestDocsNgo(ngo)}>
                        <FileText className="w-4 h-4 mr-2" />Request Documents
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/ngos/${ngo.id}`)}>
                        View NGO<ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="rounded-lg border bg-muted/40 p-3"><p className="text-xs uppercase text-muted-foreground">Open work items</p><p className="text-2xl font-semibold">{stats.open}</p></div>
                      <div className="rounded-lg border bg-muted/40 p-3"><p className="text-xs uppercase text-muted-foreground">Missing documents</p><p className="text-2xl font-semibold">{stats.missing}</p></div>
                      <div className="rounded-lg border bg-muted/40 p-3"><p className="text-xs uppercase text-muted-foreground">Upcoming deadlines</p><p className="text-2xl font-semibold">{stats.upcoming}</p></div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <FormSubmissionSheet
        open={!!selectedCheckInNgo}
        onOpenChange={(open) => { if (!open) setSelectedCheckInNgo(null); }}
        template={monthlyTemplate}
        ngoId={selectedCheckInNgo?.id || ""}
        workItemConfig={selectedCheckInNgo ? {
          title: `Monthly NGO Check-In - ${selectedCheckInNgo.common_name || selectedCheckInNgo.legal_name}`,
          type: "Monthly NGO Check-In",
          module: "ngo_coordination",
          description: "Monthly check-in submitted by NGO coordinator.",
          ngoId: selectedCheckInNgo.id,
        } : undefined}
      />

      <DocumentRequestDialog
        open={!!requestDocsNgo}
        onOpenChange={(open) => { if (!open) setRequestDocsNgo(null); }}
        ngo={requestDocsNgo}
      />
    </MainLayout>
  );
}
