import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarPlus, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useDocuments, useCreateDocument } from "@/hooks/useDocuments";
import {
  Applicant,
  ApplicantStage,
  ATS_STAGES_WITH_REJECTED,
  UpdateApplicantInput,
  useUpdateHRApplicant,
} from "@/hooks/useHRApplicants";
import {
  InterviewRecommendation,
  useCreateHRInterview,
  useHRInterviews,
} from "@/hooks/useHRInterviews";
import type { JobRequisition } from "@/hooks/useHRRequisitions";

const recommendationOptions: InterviewRecommendation[] = [
  "Strong yes",
  "Yes",
  "No",
  "Strong no",
];

interface ApplicantDrawerProps {
  applicant: Applicant | null;
  requisitions: JobRequisition[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApplicantDrawer({ applicant, requisitions, open, onOpenChange }: ApplicantDrawerProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const updateApplicant = useUpdateHRApplicant();
  const createDocument = useCreateDocument();
  const createInterview = useCreateHRInterview();

  const [selectedStage, setSelectedStage] = useState<ApplicantStage>("Newly Received");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isInterviewOpen, setIsInterviewOpen] = useState(false);
  const [interviewDate, setInterviewDate] = useState("");
  const [interviewerId, setInterviewerId] = useState("");
  const [recommendation, setRecommendation] = useState<InterviewRecommendation | "">("");
  const [interviewNotes, setInterviewNotes] = useState("");
  const [rubricScores, setRubricScores] = useState({ communication: "", skills: "", culture: "" });

  // Xenia template fields
  const [department, setDepartment] = useState("");
  const [manager, setManager] = useState("");
  const [isOtp, setIsOtp] = useState(false);
  const [hoursCommitting, setHoursCommitting] = useState("");
  const [availabilitySchedule, setAvailabilitySchedule] = useState("");
  const [bestInterviewTimes, setBestInterviewTimes] = useState("");
  const [locationTimezone, setLocationTimezone] = useState("");
  const [departmentalAssessment, setDepartmentalAssessment] = useState("");

  const { data: documents = [] } = useDocuments(
    applicant ? { category: "hr" } : undefined
  );
  const { data: interviews = [] } = useHRInterviews(applicant?.id);

  const requisitionLabel = useMemo(() => {
    if (!applicant?.role_applied_for) return "—";
    return requisitions.find((req) => req.id === applicant.role_applied_for)?.title ?? "—";
  }, [applicant, requisitions]);

  const applicantDocuments = useMemo(() => {
    if (!applicant) return [];
    return documents.filter((doc) => doc.file_path.includes(`/applicants/${applicant.id}/`));
  }, [documents, applicant]);

  useEffect(() => {
    if (applicant) {
      setSelectedStage(applicant.stage ?? "Newly Received");
      setNotes(applicant.notes ?? "");
      setDepartment(applicant.department ?? "");
      setManager(applicant.manager ?? "");
      setIsOtp(applicant.is_otp ?? false);
      setHoursCommitting(applicant.hours_committing ?? "");
      setAvailabilitySchedule(applicant.availability_schedule ?? "");
      setBestInterviewTimes(applicant.best_interview_times ?? "");
      setLocationTimezone(applicant.location_timezone ?? "");
      setDepartmentalAssessment(applicant.departmental_assessment ?? "");
    }
  }, [applicant]);

  if (!applicant) return null;

  const handleUpdate = async () => {
    const payload: UpdateApplicantInput = {
      id: applicant.id,
      stage: selectedStage,
      notes,
      department: department || null,
      manager: manager || null,
      is_otp: isOtp,
      hours_committing: hoursCommitting || null,
      availability_schedule: availabilitySchedule || null,
      best_interview_times: bestInterviewTimes || null,
      location_timezone: locationTimezone || null,
      departmental_assessment: departmentalAssessment || null,
    };
    await updateApplicant.mutateAsync(payload);
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    try {
      const path = `hr/applicants/${applicant.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;
      await createDocument.mutateAsync({
        file_name: `${applicant.full_name} - ${file.name}`,
        file_path: path,
        file_type: file.type,
        file_size: file.size,
        category: "hr",
        uploaded_by_user_id: user?.id ?? undefined,
      });
      setFile(null);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Unable to upload document.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleInterviewSave = async () => {
    if (!interviewDate) return;
    await createInterview.mutateAsync({
      applicant_id: applicant.id,
      interview_date: interviewDate,
      interviewer_user_id: interviewerId || user?.id || null,
      recommendation: recommendation || null,
      notes: interviewNotes || null,
      rubric_scores:
        rubricScores.communication || rubricScores.skills || rubricScores.culture
          ? rubricScores
          : null,
    });
    setIsInterviewOpen(false);
    setInterviewDate("");
    setInterviewerId("");
    setRecommendation("");
    setInterviewNotes("");
    setRubricScores({ communication: "", skills: "", culture: "" });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[560px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{applicant.full_name}</SheetTitle>
          <SheetDescription>Applicant profile and pipeline details.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Summary */}
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Role applied for</p>
                <p className="text-base font-medium text-foreground">{requisitionLabel}</p>
              </div>
              <Badge variant={selectedStage === "Sent to IT" ? "default" : "secondary"}>{selectedStage}</Badge>
            </div>
            <div className="grid gap-2 text-sm text-muted-foreground">
              <span>Email: {applicant.email ?? "—"}</span>
              <span>Phone: {applicant.phone ?? "—"}</span>
              <span>Applied: {format(new Date(applicant.created_at), "MMM d, yyyy")}</span>
            </div>
          </div>

          {/* Stage & Notes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Pipeline stage</h3>
              <Button variant="outline" size="sm" onClick={handleUpdate}>
                Save changes
              </Button>
            </div>
            <Select value={selectedStage} onValueChange={(value: ApplicantStage) => setSelectedStage(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select stage" />
              </SelectTrigger>
              <SelectContent>
                {ATS_STAGES_WITH_REJECTED.map((stage) => (
                  <SelectItem key={stage} value={stage}>
                    {stage}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Capture screening context, concerns, or offer notes"
                rows={3}
              />
            </div>
          </div>

          <Separator />

          {/* Xenia Template Fields */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Volunteer Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label className="text-xs">Department</Label>
                <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Program" />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Manager</Label>
                <Input value={manager} onChange={(e) => setManager(e.target.value)} placeholder="Supervisor name" />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Hours committing</Label>
                <Input value={hoursCommitting} onChange={(e) => setHoursCommitting(e.target.value)} placeholder="10-15 hrs/week" />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Location / Timezone</Label>
                <Input value={locationTimezone} onChange={(e) => setLocationTimezone(e.target.value)} placeholder="EST" />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Availability schedule</Label>
                <Input value={availabilitySchedule} onChange={(e) => setAvailabilitySchedule(e.target.value)} placeholder="Mon-Fri 9am-1pm" />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Best interview times</Label>
                <Input value={bestInterviewTimes} onChange={(e) => setBestInterviewTimes(e.target.value)} placeholder="Tue/Thu afternoons" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isOtp} onCheckedChange={setIsOtp} />
              <Label className="text-xs">One-Time Project (OTP)</Label>
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Departmental Assessment</Label>
              <Textarea
                value={departmentalAssessment}
                onChange={(e) => setDepartmentalAssessment(e.target.value)}
                rows={2}
                placeholder="Department lead's assessment notes"
              />
            </div>
          </div>

          <Separator />

          {/* Documents */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Documents</h3>
              <Badge variant="outline">HR</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
              <Button onClick={handleUpload} disabled={!file || isUploading} className="gap-2">
                <FileUp className="h-4 w-4" />
                {isUploading ? "Uploading..." : "Upload"}
              </Button>
            </div>
            <div className="space-y-2 text-sm text-muted-foreground">
              {applicantDocuments.length === 0 ? (
                <p>No documents uploaded yet.</p>
              ) : (
                applicantDocuments.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between rounded-md border p-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">{doc.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(doc.uploaded_at), "MMM d, yyyy")}
                      </p>
                    </div>
                    <Badge variant="secondary">{doc.file_type ?? "file"}</Badge>
                  </div>
                ))
              )}
            </div>
          </div>

          <Separator />

          {/* Interviews */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Interviews</h3>
              <Button size="sm" variant="outline" className="gap-2" onClick={() => setIsInterviewOpen(true)}>
                <CalendarPlus className="h-4 w-4" />
                Add interview
              </Button>
            </div>
            <div className="space-y-2 text-sm text-muted-foreground">
              {interviews.length === 0 ? (
                <p>No interviews logged yet.</p>
              ) : (
                interviews.map((interview) => (
                  <div key={interview.id} className="rounded-md border p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">
                        {format(new Date(interview.interview_date), "MMM d, yyyy p")}
                      </p>
                      <Badge variant="secondary">{interview.recommendation ?? "Pending"}</Badge>
                    </div>
                    {interview.notes && <p className="text-xs text-muted-foreground">{interview.notes}</p>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </SheetContent>

      <Dialog open={isInterviewOpen} onOpenChange={setIsInterviewOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Add interview</DialogTitle>
            <DialogDescription>Capture interview timing and scorecard feedback.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Interview date</Label>
              <Input type="datetime-local" value={interviewDate} onChange={(e) => setInterviewDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Interviewer user ID</Label>
              <Input value={interviewerId} onChange={(e) => setInterviewerId(e.target.value)} placeholder={user?.id ?? "Optional"} />
            </div>
            <div className="grid gap-2">
              <Label>Recommendation</Label>
              <Select value={recommendation} onValueChange={(value: InterviewRecommendation) => setRecommendation(value)}>
                <SelectTrigger><SelectValue placeholder="Select recommendation" /></SelectTrigger>
                <SelectContent>
                  {recommendationOptions.map((option) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Rubric scores</Label>
              <div className="grid gap-2 md:grid-cols-3">
                <Input value={rubricScores.communication} onChange={(e) => setRubricScores((p) => ({ ...p, communication: e.target.value }))} placeholder="Communication" />
                <Input value={rubricScores.skills} onChange={(e) => setRubricScores((p) => ({ ...p, skills: e.target.value }))} placeholder="Skills" />
                <Input value={rubricScores.culture} onChange={(e) => setRubricScores((p) => ({ ...p, culture: e.target.value }))} placeholder="Culture" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea value={interviewNotes} onChange={(e) => setInterviewNotes(e.target.value)} rows={4} placeholder="Key feedback and considerations" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsInterviewOpen(false)}>Cancel</Button>
            <Button onClick={handleInterviewSave} disabled={!interviewDate}>Save interview</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
