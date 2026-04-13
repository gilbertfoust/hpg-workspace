import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Applicant,
  ApplicantStage,
  ATS_STAGES,
  ATS_STAGES_WITH_REJECTED,
  CreateApplicantInput,
  useCreateHRApplicant,
  useHRApplicants,
} from "@/hooks/useHRApplicants";
import { useHRRequisitions } from "@/hooks/useHRRequisitions";
import { ApplicantDrawer } from "@/components/hr/ApplicantDrawer";

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
  full_name: "",
  email: "",
  phone: "",
  role_applied_for: null,
  stage: "Newly Received",
  notes: "",
};

export function HRApplicantsSection() {
  const { data: applicants = [], isLoading } = useHRApplicants();
  const { data: requisitions = [] } = useHRRequisitions();
  const createApplicant = useCreateHRApplicant();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formState, setFormState] = useState<CreateApplicantInput>(emptyApplicant);
  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const requisitionMap = useMemo(() => {
    return new Map(requisitions.map((req) => [req.id, req.title]));
  }, [requisitions]);

  const groupedApplicants = useMemo(() => {
    const groups = new Map<ApplicantStage, Applicant[]>();
    ATS_STAGES_WITH_REJECTED.forEach((stage) => groups.set(stage, []));
    applicants.forEach((applicant) => {
      const stage = applicant.stage ?? "Newly Received";
      if (!groups.has(stage)) {
        // Legacy stage — put in first column
        groups.get("Newly Received")?.push(applicant);
      } else {
        groups.get(stage)?.push(applicant);
      }
    });
    return groups;
  }, [applicants]);

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
          <p className="text-sm text-muted-foreground">14-stage ATS Kanban — drag-free, click to manage.</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Applicant
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading applicants...</p>}

      <ScrollArea className="w-full">
        <div className="flex gap-3 pb-4" style={{ minWidth: `${ATS_STAGES_WITH_REJECTED.length * 210}px` }}>
          {ATS_STAGES_WITH_REJECTED.map((stage) => {
            const stageApplicants = groupedApplicants.get(stage) ?? [];
            return (
              <div key={stage} className="w-[200px] flex-shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide truncate">{stage}</h3>
                  <Badge variant="secondary" className="text-xs flex-shrink-0">{stageApplicants.length}</Badge>
                </div>
                <div className="space-y-2 min-h-[100px]">
                  {stageApplicants.map((applicant) => (
                    <Card
                      key={applicant.id}
                      className={`border-l-4 ${STAGE_COLORS[stage] || "border-l-muted"} cursor-pointer hover:bg-accent/50 transition-colors`}
                      onClick={() => handleOpenDrawer(applicant)}
                    >
                      <CardContent className="p-3">
                        <p className="text-sm font-medium truncate">{applicant.full_name}</p>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {applicant.role_applied_for
                            ? requisitionMap.get(applicant.role_applied_for) ?? "Unknown role"
                            : "No role specified"}
                        </p>
                        {applicant.department && (
                          <p className="text-xs text-muted-foreground truncate">{applicant.department}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(applicant.created_at), "MMM d")}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                  {stageApplicants.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-6">Empty</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
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
              <Input
                id="applicant-name"
                value={formState.full_name}
                onChange={(event) => setFormState((prev) => ({ ...prev, full_name: event.target.value }))}
                placeholder="Jane Doe"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="applicant-email">Email</Label>
                <Input
                  id="applicant-email"
                  value={formState.email ?? ""}
                  onChange={(event) => setFormState((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="jane@example.org"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="applicant-phone">Phone</Label>
                <Input
                  id="applicant-phone"
                  value={formState.phone ?? ""}
                  onChange={(event) => setFormState((prev) => ({ ...prev, phone: event.target.value }))}
                  placeholder="+254 700 000 000"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Role applied for</Label>
                <Select
                  value={formState.role_applied_for ?? ""}
                  onValueChange={(value) => setFormState((prev) => ({ ...prev, role_applied_for: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select requisition" />
                  </SelectTrigger>
                  <SelectContent>
                    {requisitions.map((req) => (
                      <SelectItem key={req.id} value={req.id}>
                        {req.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Department</Label>
                <Input
                  value={formState.department ?? ""}
                  onChange={(event) => setFormState((prev) => ({ ...prev, department: event.target.value }))}
                  placeholder="e.g. Program"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Hours committing</Label>
                <Input
                  value={formState.hours_committing ?? ""}
                  onChange={(event) => setFormState((prev) => ({ ...prev, hours_committing: event.target.value }))}
                  placeholder="e.g. 10-15 hrs/week"
                />
              </div>
              <div className="grid gap-2">
                <Label>Location / Timezone</Label>
                <Input
                  value={formState.location_timezone ?? ""}
                  onChange={(event) => setFormState((prev) => ({ ...prev, location_timezone: event.target.value }))}
                  placeholder="e.g. EST (New York)"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="applicant-notes">Notes</Label>
              <Textarea
                id="applicant-notes"
                value={formState.notes ?? ""}
                onChange={(event) => setFormState((prev) => ({ ...prev, notes: event.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateApplicant} disabled={!formState.full_name.trim()}>
              Add applicant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ApplicantDrawer
        applicant={selectedApplicant}
        requisitions={requisitions}
        open={drawerOpen}
        onOpenChange={(openValue) => {
          setDrawerOpen(openValue);
          if (!openValue) setSelectedApplicant(null);
        }}
      />
    </div>
  );
}
