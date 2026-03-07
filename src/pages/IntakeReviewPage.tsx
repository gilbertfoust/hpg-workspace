import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { IntakeReviewPanel } from "@/components/intake/IntakeReviewPanel";
import { useDocumentIntake } from "@/hooks/useDocumentIntake";
import { ArrowLeft, Loader2 } from "lucide-react";

export default function IntakeReviewPage() {
  const { intakeId } = useParams<{ intakeId: string }>();
  const navigate = useNavigate();
  const { data: submissions, isLoading } = useDocumentIntake();

  const submission = submissions?.find((s) => s.id === intakeId);

  return (
    <MainLayout>
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate("/financial-hub/intake")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Intake
        </Button>

        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && !submission && (
          <p className="text-muted-foreground">Submission not found.</p>
        )}

        {submission && <IntakeReviewPanel submission={submission} />}
      </div>
    </MainLayout>
  );
}
