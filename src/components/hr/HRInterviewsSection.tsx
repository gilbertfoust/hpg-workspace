import { useMemo } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useHRApplicants } from "@/hooks/useHRApplicants";
import { useHRInterviews } from "@/hooks/useHRInterviews";

export function HRInterviewsSection() {
  const { data: interviews = [], isLoading } = useHRInterviews();
  const { data: applicants = [] } = useHRApplicants();

  const applicantMap = useMemo(() => {
    return new Map(applicants.map((applicant) => [applicant.id, applicant]));
  }, [applicants]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Interview Scorecards</h2>
        <p className="text-sm text-muted-foreground">Review interview activity and recommendations.</p>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Applicant</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Interview Date</TableHead>
              <TableHead>Recommendation</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  Loading interviews...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && interviews.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  No interviews recorded yet.
                </TableCell>
              </TableRow>
            )}
            {interviews.map((interview) => {
              const applicant = applicantMap.get(interview.applicant_id);
              return (
                <TableRow key={interview.id}>
                  <TableCell className="font-medium text-foreground">
                    {applicant?.full_name ?? "Unknown"}
                  </TableCell>
                  <TableCell>{applicant?.stage ?? "—"}</TableCell>
                  <TableCell>{format(new Date(interview.interview_date), "MMM d, yyyy p")}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{interview.recommendation ?? "Pending"}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {interview.notes ? interview.notes.slice(0, 80) : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
