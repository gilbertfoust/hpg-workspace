import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFinancialReviewStatus } from "@/hooks/useFinancialReviewStatus";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

const STATUSES = ["not_started", "awaiting_ngo", "under_review", "approved", "needs_revision"] as const;

interface ReviewPanelProps {
  ngoId: string;
  fiscalPeriodId: string;
}

export function ReviewPanel({ ngoId, fiscalPeriodId }: ReviewPanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: reviews, isLoading, upsert } = useFinancialReviewStatus(ngoId, fiscalPeriodId);

  const review = reviews?.[0];
  const [status, setStatus] = useState("not_started");
  const [comments, setComments] = useState("");

  useEffect(() => {
    if (review) {
      setStatus(review.status);
      setComments(review.comments || "");
    }
  }, [review]);

  const handleSave = () => {
    upsert.mutate(
      {
        id: review?.id,
        ngo_id: ngoId,
        fiscal_period_id: fiscalPeriodId,
        status,
        reviewer_id: user?.id || null,
        comments,
      },
      {
        onSuccess: () => toast({ title: "Review status updated" }),
        onError: (err: any) => toast({ variant: "destructive", title: "Error", description: err.message }),
      }
    );
  };

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin" />;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Review Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-1 block">Status</label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-1 block">Comments</label>
          <Textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={3} placeholder="Add review comments..." />
        </div>
        {review?.last_updated_at && (
          <p className="text-xs text-muted-foreground">
            Last updated: {format(new Date(review.last_updated_at), "MMM d, yyyy h:mm a")}
          </p>
        )}
        <Button onClick={handleSave} disabled={upsert.isPending} size="sm">
          {upsert.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Save Review
        </Button>
      </CardContent>
    </Card>
  );
}
