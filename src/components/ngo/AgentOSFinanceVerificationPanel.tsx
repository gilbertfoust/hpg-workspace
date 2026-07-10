import { useMemo, useState } from "react";
import { BadgeDollarSign, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { AgentOSCase } from "@/hooks/useAgentOSCases";
import {
  useAgentOSFinanceAuthority,
  useVerifyAgentOSActivationFee,
} from "@/hooks/useAgentOSFinanceVerification";
import { useToast } from "@/hooks/use-toast";

interface AgentOSFinanceVerificationPanelProps {
  cases: AgentOSCase[];
}

const verificationStages = new Set([
  "onboarding_fee_form_sent",
  "onboarding_fee_payment_pending",
]);

const feeLabel = (item: AgentOSCase) => {
  if (item.jurisdiction_class === "international") return "$100 USD international activation fee";
  return "U.S. NGO onboarding fee";
};

export function AgentOSFinanceVerificationPanel({ cases }: AgentOSFinanceVerificationPanelProps) {
  const { toast } = useToast();
  const financeAuthority = useAgentOSFinanceAuthority();
  const verifyFee = useVerifyAgentOSActivationFee();
  const [selectedCase, setSelectedCase] = useState<AgentOSCase | null>(null);
  const [paymentReference, setPaymentReference] = useState("");
  const [confirmedCleared, setConfirmedCleared] = useState(false);

  const pendingCases = useMemo(
    () => cases.filter((item) =>
      item.case_type === "sponsorship" &&
      Boolean(item.activation_fee_policy_key) &&
      !item.activation_fee_verified_at &&
      verificationStages.has(item.workflow_stage),
    ),
    [cases],
  );

  if (financeAuthority.isLoading || !financeAuthority.data || pendingCases.length === 0) return null;

  const closeDialog = () => {
    if (verifyFee.isPending) return;
    setSelectedCase(null);
    setPaymentReference("");
    setConfirmedCleared(false);
  };

  const submitVerification = async () => {
    if (!selectedCase || !confirmedCleared || !paymentReference.trim()) return;

    try {
      await verifyFee.mutateAsync({
        caseId: selectedCase.id,
        paymentReference,
      });
      toast({
        title: "Finance verification recorded",
        description: `${selectedCase.reference_number}: payment verification is complete. The confirmation-letter gate is now unlocked, but no letter was issued automatically.`,
      });
      closeDialog();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Verification not recorded",
        description: error instanceof Error ? error.message : "Finance verification could not be saved.",
      });
    }
  };

  return (
    <>
      <Card className="border-amber-300/60">
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BadgeDollarSign className="h-5 w-5" /> Finance Activation Fee Verification
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Human Finance control. Recording verification unlocks the confirmation-letter stage but does not issue the letter or move funds.
              </p>
            </div>
            <Badge variant="secondary">{pendingCases.length} awaiting verification</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {pendingCases.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold">{item.reference_number}</span>
                  <Badge variant="outline">
                    {item.jurisdiction_class === "international" ? "International · $100 USD" : "U.S. fee route"}
                  </Badge>
                </div>
                <p className="mt-1 font-medium">
                  {item.organization_name || item.person_name || "Unidentified sponsorship case"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{feeLabel(item)}</p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedCase(item);
                  setPaymentReference("");
                  setConfirmedCleared(false);
                }}
              >
                <ShieldCheck className="mr-2 h-4 w-4" /> Record verification
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedCase)} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify activation fee payment</DialogTitle>
            <DialogDescription>
              Confirm that HPG Finance has independently verified the applicable payment for {selectedCase?.reference_number}.
            </DialogDescription>
          </DialogHeader>

          {selectedCase && (
            <div className="space-y-5 py-2">
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>{feeLabel(selectedCase)}</AlertTitle>
                <AlertDescription>
                  {selectedCase.jurisdiction_class === "international"
                    ? "The verified amount must be exactly $100 USD."
                    : "Use the amount and payment instructions from the existing U.S. NGO onboarding fee process."}
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="activation-payment-reference">Payment or transaction reference</Label>
                <Input
                  id="activation-payment-reference"
                  value={paymentReference}
                  onChange={(event) => setPaymentReference(event.target.value)}
                  placeholder="Receipt, transaction, invoice, or bank reference"
                  maxLength={250}
                />
              </div>

              <div className="flex items-start gap-3 rounded-md border p-3">
                <Checkbox
                  id="activation-payment-cleared"
                  checked={confirmedCleared}
                  onCheckedChange={(checked) => setConfirmedCleared(checked === true)}
                />
                <Label htmlFor="activation-payment-cleared" className="cursor-pointer text-sm leading-5">
                  I confirm that HPG Finance verified that the applicable payment cleared and that the reference above is accurate.
                </Label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={verifyFee.isPending}>
              Cancel
            </Button>
            <Button
              onClick={submitVerification}
              disabled={verifyFee.isPending || !confirmedCleared || !paymentReference.trim()}
            >
              {verifyFee.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Recording...</>
              ) : (
                <><ShieldCheck className="mr-2 h-4 w-4" />Confirm Finance verification</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
