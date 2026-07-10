import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  CircleAlert,
  DatabaseZap,
  Loader2,
  MailPlus,
  ShieldCheck,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AgentOSCase, AgentOSCaseQueueResult, AgentOSRiskLevel } from "@/hooks/useAgentOSCases";
import { useCreateInternationalActivationInvitation } from "@/hooks/useAgentOSActivationFee";
import { useToast } from "@/hooks/use-toast";

interface AgentOSQueuePanelProps {
  data?: AgentOSCaseQueueResult;
  isLoading: boolean;
}

const postAgreementStages = new Set([
  "agreement_signed",
  "onboarding_fee_form_sent",
  "onboarding_fee_payment_pending",
  "payment_received_verified",
  "confirmation_letter_issued",
  "activation_processed",
  "transferred_to_ngo_coordination",
  "onboarding_in_progress",
  "active_sponsored_ngo",
  "ongoing_monitoring",
]);

const titleCase = (value: string) =>
  value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const riskVariant = (risk: AgentOSRiskLevel): "default" | "secondary" | "destructive" | "outline" => {
  if (risk === "high") return "destructive";
  if (risk === "elevated") return "default";
  if (risk === "moderate") return "secondary";
  return "outline";
};

const invitationEligible = (item: AgentOSCase) =>
  item.case_type === "sponsorship" &&
  item.jurisdiction_class === "international" &&
  postAgreementStages.has(item.workflow_stage) &&
  !item.activation_fee_form_sent_at &&
  !item.activation_fee_verified_at;

function ActivationFeeCell({ item }: { item: AgentOSCase }) {
  const { toast } = useToast();
  const invitation = useCreateInternationalActivationInvitation();
  const [submittingCaseId, setSubmittingCaseId] = useState<string | null>(null);

  if (item.case_type !== "sponsorship") {
    return <span className="text-xs text-muted-foreground">Not applicable</span>;
  }

  if (!item.jurisdiction_class) {
    return <Badge variant="outline">Jurisdiction pending</Badge>;
  }

  if (item.activation_fee_verified_at) {
    return (
      <div className="space-y-1">
        <Badge className="gap-1"><ShieldCheck className="h-3 w-3" />Finance verified</Badge>
        <p className="text-xs text-muted-foreground">
          {format(new Date(item.activation_fee_verified_at), "MMM d, yyyy")}
        </p>
      </div>
    );
  }

  if (item.jurisdiction_class === "us_domestic") {
    return (
      <div className="space-y-1">
        <Badge variant="secondary">U.S. form only</Badge>
        <p className="max-w-[190px] text-xs text-muted-foreground">
          Existing U.S. NGO onboarding fee process
        </p>
      </div>
    );
  }

  if (item.activation_fee_form_sent_at) {
    return (
      <div className="space-y-1">
        <Badge variant="secondary" className="gap-1"><MailPlus className="h-3 w-3" />$100 form sent</Badge>
        <p className="text-xs text-muted-foreground">
          {format(new Date(item.activation_fee_form_sent_at), "MMM d, yyyy")}
        </p>
      </div>
    );
  }

  if (!postAgreementStages.has(item.workflow_stage)) {
    return (
      <div className="space-y-1">
        <Badge variant="outline">International · $100</Badge>
        <p className="max-w-[190px] text-xs text-muted-foreground">
          Available after the agreement is fully signed
        </p>
      </div>
    );
  }

  const isSubmitting = invitation.isPending && submittingCaseId === item.id;
  const disabled = !invitationEligible(item) || !item.primary_email || invitation.isPending;

  const queueInvitation = async () => {
    setSubmittingCaseId(item.id);
    try {
      const result = await invitation.mutateAsync({
        caseId: item.id,
        recipientEmail: item.primary_email,
        recipientName: item.person_name || item.organization_name,
        expiresInDays: 14,
      });
      toast({
        title: "Secure international form queued",
        description: `${result.case_reference}: the $100 USD form invitation is in the controlled communication queue. It is not marked sent until delivery succeeds.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Invitation not queued",
        description: error instanceof Error ? error.message : "The secure form invitation could not be created.",
      });
    } finally {
      setSubmittingCaseId(null);
    }
  };

  return (
    <div className="space-y-2">
      <Badge variant="outline">International · $100 USD</Badge>
      <Button size="sm" variant="outline" disabled={disabled} onClick={queueInvitation}>
        {isSubmitting ? (
          <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Queueing...</>
        ) : (
          <><MailPlus className="mr-2 h-3.5 w-3.5" />Queue secure form</>
        )}
      </Button>
      {!item.primary_email && (
        <p className="max-w-[190px] text-xs text-destructive">Recipient email required</p>
      )}
    </div>
  );
}

export function AgentOSQueuePanel({ data, isLoading }: AgentOSQueuePanelProps) {
  const cases = data?.cases || [];

  const stats = useMemo(() => {
    const urgent = cases.filter((item) => item.priority === "urgent" || item.priority === "critical").length;
    const risk = cases.filter((item) => item.risk_level === "high" || item.risk_level === "elevated").length;
    const unmatched = cases.filter(
      (item) => item.match_confidence === "low" || Boolean(item.unmatched_reason),
    ).length;
    const approvals = cases.filter((item) => item.approval_required).length;
    return { urgent, risk, unmatched, approvals };
  }, [cases]);

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  if (data && !data.runtimeReady) {
    return (
      <Alert className="border-warning/40 bg-warning/5">
        <DatabaseZap className="h-4 w-4" />
        <AlertTitle>Agent OS runtime migration pending</AlertTitle>
        <AlertDescription>
          {data.runtimeMessage} The existing NGO Coordination tools remain available while Technology validates and deploys the runtime schema.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bot className="h-5 w-5" />
              Nia Okafor — Agent OS Case Queue
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Permanent cases, approval gates, risks, next actions, and controlled NGO activation-fee routing.
            </p>
          </div>
          <Badge variant="secondary">{cases.length} active cases</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
              <CircleAlert className="h-4 w-4" /> Urgent
            </div>
            <p className="mt-1 text-2xl font-semibold">{stats.urgent}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
              <AlertTriangle className="h-4 w-4" /> Elevated / High Risk
            </div>
            <p className="mt-1 text-2xl font-semibold">{stats.risk}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
              <Bot className="h-4 w-4" /> Unmatched
            </div>
            <p className="mt-1 text-2xl font-semibold">{stats.unmatched}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" /> Approval Gates
            </div>
            <p className="mt-1 text-2xl font-semibold">{stats.approvals}</p>
          </div>
        </div>

        {cases.length === 0 ? (
          <div className="rounded-lg border border-dashed px-5 py-8 text-center text-sm text-muted-foreground">
            No Agent OS cases are currently assigned to this queue.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Organization / Person</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Next Action</TableHead>
                  <TableHead>Activation Fee</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cases.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs font-medium">{item.reference_number}</TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {item.organization_name || item.person_name || "Unidentified intake"}
                      </div>
                      <div className="text-xs text-muted-foreground">{titleCase(item.case_type)}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline">{titleCase(item.workflow_stage)}</Badge>
                        {item.approval_required && <Badge variant="secondary">Approval needed</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={riskVariant(item.risk_level)}>{titleCase(item.risk_level)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.match_confidence === "low" ? "destructive" : "outline"}>
                        {titleCase(item.match_confidence)}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[320px]">
                      <p className="truncate">{item.next_action || item.unmatched_reason || "No next action recorded"}</p>
                    </TableCell>
                    <TableCell className="min-w-[220px]"><ActivationFeeCell item={item} /></TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {format(new Date(item.updated_at), "MMM d, h:mm a")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
