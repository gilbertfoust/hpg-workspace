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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Applicant,
  ApplicantStage,
  CreateApplicantInput,
  useCreateHRApplicant,
  useHRApplicants,
} from "@/hooks/useHRApplicants";
import { useHRRequisitions } from "@/hooks/useHRRequisitions";
import { ApplicantDrawer } from "@/components/hr/ApplicantDrawer";

const stages: ApplicantStage[] = [
  "Applied",
  "Screening",
  "Interviewing",
  "Offer",
  "Hired",
  "Rejected",
];

const emptyApplicant: CreateApplicantInput = {
  full_name: "",
  email: "",
  phone: "",
  role_applied_for: null,
  stage: "Applied",
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
    stages.forEach((stage) => groups.set(stage, []));
    applicants.forEach((applicant) => {
      const stage = applicant.stage ?? "Applied";
      if (!groups.has(stage)) {
        groups.set(stage, []);
      }
      groups.get(stage)?.push(applicant);
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
          <h2 className="text-lg font-semibold text-foreground">Applicants Pipeline</h2>
          <p className="text-sm text-muted-foreground">Manage candidates by stage and keep notes centralized.</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Applicant
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading applicants...</p>}

      <div className="space-y-6">
        {stages.map((stage) => {
          const stageApplicants = groupedApplicants.get(stage) ?? [];
          return (
            <div key={stage} className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">{stage}</h3>
                  <Badge variant="outline">{stageApplicants.length}</Badge>
                </div>
              </div>
              {stageApplicants.length === 0 ? (
                <p className="text-sm text-muted-foreground">No applicants in this stage yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Applied</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stageApplicants.map((applicant) => (
                      <TableRow key={applicant.id}>
                        <TableCell className="font-medium text-foreground">{applicant.full_name}</TableCell>
                        <TableCell>{
                          applicant.role_applied_for
                            ? requisitionMap.get(applicant.role_applied_for) ?? "—"
                            : "—"
                        }</TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground">
                            <p>{applicant.email ?? "—"}</p>
                            <p>{applicant.phone ?? "—"}</p>
                          </div>
                        </TableCell>
                        <TableCell>{format(new Date(applicant.created_at), "MMM d, yyyy")}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => handleOpenDrawer(applicant)}>
                            View details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>New applicant</DialogTitle>
            <DialogDescription>Add an applicant to the pipeline.</DialogDescription>
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
              <Label>Stage</Label>
              <Select
                value={formState.stage ?? "Applied"}
                onValueChange={(value: ApplicantStage) => setFormState((prev) => ({ ...prev, stage: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((stage) => (
                    <SelectItem key={stage} value={stage}>
                      {stage}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="applicant-notes">Notes</Label>
              <Textarea
                id="applicant-notes"
                value={formState.notes ?? ""}
                onChange={(event) => setFormState((prev) => ({ ...prev, notes: event.target.value }))}
                rows={4}
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
          if (!openValue) {
            setSelectedApplicant(null);
          }
        }}
      />
    </div>
  );
}
