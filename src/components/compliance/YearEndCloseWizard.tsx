import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useYearEndClose } from "@/hooks/useYearEndClose";
import { useTrialBalance } from "@/hooks/useTrialBalance";
import { useReconciliation } from "@/hooks/useReconciliation";
import { CheckCircle2, Circle, Lock, Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Props {
  ngoId: string;
  fiscalYear: number;
}

export function YearEndCloseWizard({ ngoId, fiscalYear }: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const { yearPeriods, allLocked, hasClosingEntries, closingEntries, generateClosingEntries, lockFiscalYear } = useYearEndClose(ngoId, fiscalYear);
  const { data: trialBalance } = useTrialBalance(ngoId);

  const steps = [
    { label: "Review Periods", description: "Verify all fiscal periods are present" },
    { label: "Confirm Reconciliation", description: "All periods must be reconciled" },
    { label: "Generate Closing Entries", description: "Zero out income/expense accounts" },
    { label: "Lock Fiscal Year", description: "Prevent further edits" },
  ];

  const handleGenerateClosing = async () => {
    if (!trialBalance || trialBalance.length === 0) {
      toast({ variant: "destructive", title: "No data", description: "No trial balance data available." });
      return;
    }
    try {
      await generateClosingEntries.mutateAsync(trialBalance);
      toast({ title: "Closing entries generated", description: `Income/expense accounts zeroed for FY${fiscalYear}.` });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleLock = async () => {
    try {
      await lockFiscalYear.mutateAsync();
      toast({ title: "Fiscal year locked", description: `FY${fiscalYear} is now locked. No further edits allowed.` });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Year-End Close — FY{fiscalYear}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress */}
        <div className="flex gap-2">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-1">
              {step > i + 1 || (i + 1 === 4 && allLocked) ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : step === i + 1 ? (
                <Circle className="h-5 w-5 text-primary fill-primary/20" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground" />
              )}
              <span className={`text-xs ${step === i + 1 ? "font-semibold" : "text-muted-foreground"}`}>{s.label}</span>
              {i < 3 && <span className="text-muted-foreground mx-1">→</span>}
            </div>
          ))}
        </div>

        {/* Step 1: Review Periods */}
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{steps[0].description}</p>
            {yearPeriods.length === 0 ? (
              <div className="flex items-center gap-2 text-destructive"><AlertCircle className="h-4 w-4" /> No periods found for FY{fiscalYear}.</div>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Period</TableHead><TableHead>Type</TableHead><TableHead>Dates</TableHead><TableHead>Locked</TableHead></TableRow></TableHeader>
                <TableBody>
                  {yearPeriods.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.label}</TableCell>
                      <TableCell>{p.period_type}</TableCell>
                      <TableCell className="text-sm">{p.start_date} — {p.end_date}</TableCell>
                      <TableCell>{(p as any).is_locked ? <Badge className="bg-green-100 text-green-800">Locked</Badge> : <Badge variant="outline">Open</Badge>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <Button onClick={() => setStep(2)} disabled={yearPeriods.length === 0}>Continue</Button>
          </div>
        )}

        {/* Step 2: Confirm Reconciliation */}
        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{steps[1].description}</p>
            <p className="text-sm">All {yearPeriods.length} period(s) reviewed. Confirm reconciliation status before proceeding.</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => setStep(3)}>Confirm & Continue</Button>
            </div>
          </div>
        )}

        {/* Step 3: Generate Closing Entries */}
        {step === 3 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{steps[2].description}</p>
            {hasClosingEntries ? (
              <div>
                <Badge className="bg-green-100 text-green-800 mb-2">Closing entries already generated ({closingEntries.length} entries)</Badge>
                <Table>
                  <TableHeader><TableRow><TableHead>Account</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {closingEntries.map((e: any) => (
                      <TableRow key={e.id}>
                        <TableCell>{e.accounts?.code} — {e.accounts?.name}</TableCell>
                        <TableCell className="text-right font-mono">{Number(e.debit).toLocaleString("en-US", { style: "currency", currency: "USD" })}</TableCell>
                        <TableCell className="text-right font-mono">{Number(e.credit).toLocaleString("en-US", { style: "currency", currency: "USD" })}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <Button onClick={handleGenerateClosing} disabled={generateClosingEntries.isPending}>
                {generateClosingEntries.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                Generate Closing Entries
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={() => setStep(4)} disabled={!hasClosingEntries}>Continue</Button>
            </div>
          </div>
        )}

        {/* Step 4: Lock */}
        {step === 4 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{steps[3].description}</p>
            {allLocked ? (
              <div className="flex items-center gap-2 text-green-600"><Lock className="h-4 w-4" /> FY{fiscalYear} is locked.</div>
            ) : (
              <Button onClick={handleLock} disabled={lockFiscalYear.isPending} variant="destructive">
                {lockFiscalYear.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Lock className="h-4 w-4 mr-1" />}
                Lock FY{fiscalYear}
              </Button>
            )}
            <Button variant="outline" onClick={() => setStep(3)}>Back</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
