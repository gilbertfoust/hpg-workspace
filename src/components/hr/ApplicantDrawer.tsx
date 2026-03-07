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
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useDocuments, useCreateDocument } from "@/hooks/useDocuments";
import {
  Applicant,
  ApplicantStage,
  UpdateApplicantInput,
  useUpdateHRApplicant,
} from "@/hooks/useHRApplicants";
import {
  InterviewRecommendation,
  useCreateHRInterview,
  useHRInterviews,
} from "@/hooks/useHRInterviews";
import type { JobRequisition } from "@/hooks/useHRRequisitions";

const stageOptions: ApplicantStage[] = [
  "Applied",
  "Screening",
  "Interviewing",
  "Offer",
  "Hired",
  "Rejected",
];

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

  const [selectedStage, setSelectedStage] = useState<ApplicantStage>("Applied");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isInterviewOpen, setIsInterviewOpen] = useState(false);
  const [interviewDate, setInterviewDate] = useState("");
  const [interviewerId, setInterviewerId] = useState("");
  const [recommendation, setRecommendation] = useState<InterviewRecommendation | "">("");
  const [interviewNotes, setInterviewNotes] = useState("");
  const [rubricScores, setRubricScores] = useState({
    communication: "",
    skills: "",
    culture: "",
  });

  const { data: documents = [] } = useDocuments(
    applicant
      ? {
          category: "hr",
        }
      : undefined
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
      setSelectedStage(applicant.stage ?? "Applied");
      setNotes(applicant.notes ?? "");
    }
  }, [applicant]);

  if (!applicant) return null;

  const handleStageUpdate = async () => {
    const payload: UpdateApplicantInput = {
      id: applicant.id,
      stage: selectedStage,
      notes,
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
          ? {
              communication: rubricScores.communication,
              skills: rubricScores.skills,
              culture: rubricScores.culture,
            }
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
      <SheetContent className="w-full sm:max-w-[560px]">
        <SheetHeader>
          <SheetTitle>{applicant.full_name}</SheetTitle>
          <SheetDescription>Applicant profile and pipeline details.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Role applied for</p>
                <p className="text-base font-medium text-foreground">{requisitionLabel}</p>
              </div>
              <Badge variant={selectedStage === "Hired" ? "default" : "secondary"}>{selectedStage}</Badge>
            </div>
            <div className="grid gap-2 text-sm text-muted-foreground">
              <span>Email: {applicant.email ?? "—"}</span>
              <span>Phone: {applicant.phone ?? "—"}</span>
              <span>Applied: {format(new Date(applicant.created_at), "MMM d, yyyy")}</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Pipeline stage</h3>
              <Button variant="outline" size="sm" onClick={handleStageUpdate}>
                Update
              </Button>
            </div>
            <Select value={selectedStage} onValueChange={(value: ApplicantStage) => setSelectedStage(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select stage" />
              </SelectTrigger>
              <SelectContent>
                {stageOptions.map((stage) => (
                  <SelectItem key={stage} value={stage}>
                    {stage}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid gap-2">
              <Label htmlFor="applicant-notes">Notes</Label>
              <Textarea
                id="applicant-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Capture screening context, concerns, or offer notes"
                rows={4}
              />
            </div>
          </div>

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
              <Label htmlFor="interview-date">Interview date</Label>
              <Input
                id="interview-date"
                type="datetime-local"
                value={interviewDate}
                onChange={(event) => setInterviewDate(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="interviewer-id">Interviewer user ID</Label>
              <Input
                id="interviewer-id"
                value={interviewerId}
                onChange={(event) => setInterviewerId(event.target.value)}
                placeholder={user?.id ?? "Optional"}
              />
            </div>
            <div className="grid gap-2">
              <Label>Recommendation</Label>
              <Select value={recommendation} onValueChange={(value: InterviewRecommendation) => setRecommendation(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select recommendation" />
                </SelectTrigger>
                <SelectContent>
                  {recommendationOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Rubric scores</Label>
              <div className="grid gap-2 md:grid-cols-3">
                <Input
                  value={rubricScores.communication}
                  onChange={(event) =>
                    setRubricScores((prev) => ({ ...prev, communication: event.target.value }))
                  }
                  placeholder="Communication"
                />
                <Input
                  value={rubricScores.skills}
                  onChange={(event) => setRubricScores((prev) => ({ ...prev, skills: event.target.value }))}
                  placeholder="Skills"
                />
                <Input
                  value={rubricScores.culture}
                  onChange={(event) => setRubricScores((prev) => ({ ...prev, culture: event.target.value }))}
                  placeholder="Culture"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="interview-notes">Notes</Label>
              <Textarea
                id="interview-notes"
                value={interviewNotes}
                onChange={(event) => setInterviewNotes(event.target.value)}
                rows={4}
                placeholder="Key feedback and considerations"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsInterviewOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInterviewSave} disabled={!interviewDate}>
              Save interview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
