import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IntakeSubmission } from "@/hooks/useDocumentIntake";
import { format } from "date-fns";
import { Eye, FileText, Receipt, Gift, Award, FileInput, RotateCw } from "lucide-react";

const TYPE_ICONS: Record<string, React.ReactNode> = {
  receipt: <Receipt className="w-4 h-4" />,
  donation: <Gift className="w-4 h-4" />,
  grant_award: <Award className="w-4 h-4" />,
  vendor_invoice: <FileInput className="w-4 h-4" />,
  reimbursement: <RotateCw className="w-4 h-4" />,
  other: <FileText className="w-4 h-4" />,
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  submitted: "outline",
  extracted: "secondary",
  processing: "secondary",
  pending_review: "default",
  approved: "default",
  rejected: "destructive",
};

interface Props {
  submissions: IntakeSubmission[];
  ngoNames?: Record<string, string>;
}

export function IntakeSubmissionsTable({ submissions, ngoNames }: Props) {
  const navigate = useNavigate();

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>File</TableHead>
            <TableHead>NGO</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="w-[80px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                No submissions yet.
              </TableCell>
            </TableRow>
          )}
          {submissions.map((s) => (
            <TableRow key={s.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  {TYPE_ICONS[s.type] || TYPE_ICONS.other}
                  <span className="capitalize">{s.type.replace("_", " ")}</span>
                </div>
              </TableCell>
              <TableCell className="max-w-[200px] truncate">{s.file_name || "—"}</TableCell>
              <TableCell>{ngoNames?.[s.ngo_id] || s.ngo_id.slice(0, 8)}</TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANTS[s.status] || "outline"}>
                  {s.status.replace("_", " ")}
                </Badge>
              </TableCell>
              <TableCell>{format(new Date(s.created_at), "MMM d, yyyy")}</TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate(`/financial-hub/intake/review/${s.id}`)}
                >
                  <Eye className="w-4 h-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
