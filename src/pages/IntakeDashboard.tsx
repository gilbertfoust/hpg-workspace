import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useDocumentIntake } from "@/hooks/useDocumentIntake";
import { useNGOs } from "@/hooks/useNGOs";
import { IntakeSubmissionsTable } from "@/components/intake/IntakeSubmissionsTable";
import { IntakeUploadDialog } from "@/components/intake/IntakeUploadDialog";
import { Upload, FileText, Clock, CheckCircle, XCircle } from "lucide-react";

export default function IntakeDashboard() {
  const [ngoFilter, setNgoFilter] = useState<string>("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const { data: ngos } = useNGOs();
  const { data: submissions, isLoading } = useDocumentIntake(
    ngoFilter !== "all" ? ngoFilter : undefined
  );

  const ngoNames = Object.fromEntries(
    (ngos || []).map((n) => [n.id, n.common_name || n.legal_name])
  );

  const counts = {
    total: submissions?.length || 0,
    pending: submissions?.filter((s) => s.status === "pending_review").length || 0,
    approved: submissions?.filter((s) => s.status === "approved").length || 0,
    rejected: submissions?.filter((s) => s.status === "rejected").length || 0,
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Document Intake</h1>
            <p className="text-muted-foreground">Upload, extract, and convert documents into ledger transactions.</p>
          </div>
          <Button onClick={() => setUploadOpen(true)}>
            <Upload className="w-4 h-4 mr-2" /> Upload Document
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 flex items-center gap-3">
              <FileText className="w-8 h-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{counts.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 flex items-center gap-3">
              <Clock className="w-8 h-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{counts.pending}</p>
                <p className="text-xs text-muted-foreground">Pending Review</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{counts.approved}</p>
                <p className="text-xs text-muted-foreground">Approved</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 flex items-center gap-3">
              <XCircle className="w-8 h-8 text-destructive" />
              <div>
                <p className="text-2xl font-bold">{counts.rejected}</p>
                <p className="text-xs text-muted-foreground">Rejected</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-3">
          <Select value={ngoFilter} onValueChange={setNgoFilter}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Filter by NGO" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All NGOs</SelectItem>
              {ngos?.map((n) => (
                <SelectItem key={n.id} value={n.id}>
                  {n.common_name || n.legal_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <IntakeSubmissionsTable
          submissions={submissions || []}
          ngoNames={ngoNames}
        />

        <IntakeUploadDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          preselectedNgoId={ngoFilter !== "all" ? ngoFilter : undefined}
        />
      </div>
    </MainLayout>
  );
}
