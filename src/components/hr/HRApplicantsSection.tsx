import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Applicant, ApplicantStage, ATS_STAGES_WITH_REJECTED, CreateApplicantInput,
  useCreateHRApplicant, useHRApplicants, useUpdateHRApplicant,
} from "@/hooks/useHRApplicants";
import { useHRRequisitions } from "@/hooks/useHRRequisitions";
import { ApplicantDrawer } from "@/components/hr/ApplicantDrawer";
import { DnDKanbanBoard, KanbanColumn } from "@/components/common/DnDKanbanBoard";

const STAGE_COLORS: Record<string, string> = {
  "Newly Received": "border-l-blue-400",
  "HR Screening": "border-l-indigo-400",
  "Dept Head Approval": "border-l-violet-400",
  "Rejected by Dept": "border-l-red-400",
  "Send Interview Request": "border-l-purple-400",
  "Interview Request Sent": "border-l-fuchsia-400",
  "Interview Times Received": "border-l-pink-400",
  "Interview Confirmation": "border-l-rose-400",
  "Interview Scheduled": "border-l-amber-400",
  "Interview Completed": "border-l-orange-400",
  "Dept Decision Made": "border-l-yellow-400",
  "Onboarding Email Sent": "border-l-lime-400",
  "Materials Received": "border-l-emerald-400",
  "Sent to IT": "border-l-green-500",
};

const emptyApplicant: CreateApplicantInput = {
  full_name: "", email: "", phone: "", role_applied_for: null, stage: "Newly Received", notes: "",
};

export function HRApplicantsSection() {
  const { data: applicants = [], isLoading } = useHRApplicants();
  const { data: requisitions = [] } = useHRRequisitions();
  const createApplicant = useCreateHRApplicant();
  const updateApplicant = useUpdateHRApplicant();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formState, setFormState] = useState<CreateApplicantInput>(emptyApplicant);
  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const requisitionMap = useMemo(() => new Map(requisitions.map((r) => [r.id, r.title])), [requisitions]);

  const columns: KanbanColumn<Applicant>[] = useMemo(() => {
    const groups = new Map<ApplicantStage, Applicant[]>();
    ATS_STAGES_WITH_REJECTED.forEach((s) => groups.set(s, []));
    applicants.forEach((a) => {
      const stage = a.stage ?? "Newly Received";
      if (groups.has(stage)) groups.get(stage)!.push(a);
      else groups.get("Newly Received")!.push(a);
    });
    return ATS_STAGES_WITH_REJECTED.map((stage) => ({
      id: stage,
      label: stage,
      colorClass: STAGE_COLORS[stage],
      items: groups.get(stage) ?? [],
    }));
  }, [applicants]);

  const handleDrop = (applicantId: string, targetStage: string) => {
    updateApplicant.mutate({ id: applicantId, stage: targetStage as ApplicantStage });
  };

  const handleCreateApplicant = async () => {
    if (!formState.full_name.trim()) return;
    await createApplicant.mutateAsync(formState);
    setIsDialogOpen(false);
    setFormState(emptyApplicant);
  };

  const handleOpenDrawer = (applicant: Applicant) => {
    setSelectedApplicant(applicant);
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Recruitment Pipeline</h2>
          <p className="text-sm text-muted-foreground">Drag cards between columns to update stage</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> New Applicant
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading applicants...</p>}

      <ScrollArea className="w-full">
        <DnDKanbanBoard
          columns={columns}
          getItemId={(a) => a.id}
          onDrop={handleDrop}
          renderCard={(applicant, columnId) => (
            <Card
              className={`border-l-4 ${STAGE_COLORS[columnId] || "border-l-muted"} cursor-grab hover:bg-accent/50 transition-colors`}
              onClick={() => handleOpenDrawer(applicant)}
            >
              <CardContent className="p-3">
                <p className="text-sm font-medium truncate">{applicant.full_name}</p>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {applicant.role_applied_for ? requisitionMap.get(applicant.role_applied_for) ?? "Unknown role" : "No role specified"}
                </p>
                {applicant.department && <p className="text-xs text-muted-foreground truncate">{applicant.department}</p>}
                <p className="text-xs text-muted-foreground mt-1">{format(new Date(applicant.created_at), "MMM d")}</p>
              </CardContent>
            </Card>
          )}
        />
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>New applicant</DialogTitle>
            <DialogDescription>Add an applicant to the recruitment pipeline.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="applicant-name">Full name</Label>
              <Input id="applicant-name" value={formState.full_name} onChange={(e) => setFormState((p) => ({ ...p, full_name: e.target.value }))} placeholder="Jane Doe" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="applicant-email">Email</Label>
                <Input id="applicant-email" value={formState.email ?? ""} onChange={(e) => setFormState((p) => ({ ...p, email: e.target.value }))} placeholder="jane@example.org" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="applicant-phone">Phone</Label>
                <Input id="applicant-phone" value={formState.phone ?? ""} onChange={(e) => setFormState((p) => ({ ...p, phone: e.target.value }))} placeholder="+254 700 000 000" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Role applied for</Label>
                <Select value={formState.role_applied_for ?? ""} onValueChange={(v) => setFormState((p) => ({ ...p, role_applied_for: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select requisition" /></SelectTrigger>
                  <SelectContent>{requisitions.map((r) => <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Department</Label>
                <Input value={formState.department ?? ""} onChange={(e) => setFormState((p) => ({ ...p, department: e.target.value }))} placeholder="e.g. Program" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Hours committing</Label>
                <Input value={formState.hours_committing ?? ""} onChange={(e) => setFormState((p) => ({ ...p, hours_committing: e.target.value }))} placeholder="e.g. 10-15 hrs/week" />
              </div>
              <div className="grid gap-2">
                <Label>Location / Timezone</Label>
                <Input value={formState.location_timezone ?? ""} onChange={(e) => setFormState((p) => ({ ...p, location_timezone: e.target.value }))} placeholder="e.g. EST (New York)" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="applicant-notes">Notes</Label>
              <Textarea id="applicant-notes" value={formState.notes ?? ""} onChange={(e) => setFormState((p) => ({ ...p, notes: e.target.value }))} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateApplicant} disabled={!formState.full_name.trim()}>Add applicant</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ApplicantDrawer
        applicant={selectedApplicant}
        requisitions={requisitions}
        open={drawerOpen}
        onOpenChange={(v) => { setDrawerOpen(v); if (!v) setSelectedApplicant(null); }}
      />
    </div>
  );
}
