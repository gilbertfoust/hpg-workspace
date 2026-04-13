import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, FileText } from "lucide-react";
import { format } from "date-fns";
import { useFormSubmissions } from "@/hooks/useFormSubmissions";
import { useFormTemplates } from "@/hooks/useFormTemplates";
import { useProfiles } from "@/hooks/useProfiles";
import { FormSubmissionDetailSheet } from "./FormSubmissionDetailSheet";

const statusColors: Record<string, string> = {
  submitted: "bg-green-500/10 text-green-700",
  draft: "bg-amber-500/10 text-amber-700",
  accepted: "bg-blue-500/10 text-blue-700",
  rejected: "bg-destructive/10 text-destructive",
};

export default function FormSubmissionsTab() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [templateFilter, setTemplateFilter] = useState<string>("all");
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);

  const { data: submissions, isLoading } = useFormSubmissions();
  const { data: templates } = useFormTemplates();
  const { data: profiles } = useProfiles();

  const profileMap = useMemo(() => {
    const map = new Map<string, string>();
    (profiles || []).forEach((p) => map.set(p.id, p.full_name || p.email || p.id));
    return map;
  }, [profiles]);

  const filtered = useMemo(() => {
    if (!submissions) return [];
    return submissions.filter((s) => {
      if (statusFilter !== "all" && s.submission_status !== statusFilter) return false;
      if (templateFilter !== "all" && s.form_template_id !== templateFilter) return false;
      return true;
    });
  }, [submissions, statusFilter, templateFilter]);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Form Submissions
              </CardTitle>
              <CardDescription>
                {filtered.length} submission{filtered.length !== 1 ? "s" : ""}
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Select value={templateFilter} onValueChange={setTemplateFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Form" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All forms</SelectItem>
                  {(templates || []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No submissions found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Form</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted By</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium">
                      {sub.form_template?.name || "Unknown form"}
                      <span className="block text-xs text-muted-foreground capitalize">
                        {sub.form_template?.module?.replace(/_/g, " ") || ""}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[sub.submission_status || "draft"] || "bg-muted text-muted-foreground"}>
                        {sub.submission_status || "draft"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {sub.submitted_by_user_id
                        ? profileMap.get(sub.submitted_by_user_id) || "Unknown"
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {sub.submitted_at
                        ? format(new Date(sub.submitted_at), "MMM d, yyyy")
                        : sub.created_at
                        ? format(new Date(sub.created_at), "MMM d, yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelectedSubmissionId(sub.id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <FormSubmissionDetailSheet
        open={!!selectedSubmissionId}
        onOpenChange={(open) => !open && setSelectedSubmissionId(null)}
        submissionId={selectedSubmissionId}
      />
    </>
  );
}
