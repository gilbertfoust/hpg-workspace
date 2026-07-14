import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useDocuments, useUploadDocument } from "@/hooks/useDocuments";
import { useFinanceAccessCapabilities } from "@/hooks/useFinanceOperations";
import {
  FINANCE_CUTOVER_METRIC_KEYS,
  FINANCE_CUTOVER_METRIC_LABELS,
  type FinanceCutoverMetricKey,
  type FinanceCutoverMetrics,
  useActivateFinanceSystemOfRecord,
  useApproveFinanceParallelClose,
  useFinanceGoLiveCertification,
  useFinanceGoLiveReadiness,
  useFinanceParallelCloseComparisons,
  useSaveFinanceGoLiveCertification,
  useSaveFinanceParallelClose,
  useSuspendFinanceSystemOfRecord,
} from "@/hooks/useFinanceGoLive";
import { useWorkspaceNgo } from "@/hooks/useWorkspaceNgo";
import { AlertTriangle, CheckCircle2, FileCheck2, Loader2, LockKeyhole, Rocket, Scale, Upload, XCircle } from "lucide-react";

const today = new Date().toISOString().slice(0, 10);
const monthStart = `${today.slice(0, 7)}-01`;
const money = (value: number) => Number(value || 0).toLocaleString(undefined, { style: "currency", currency: "USD" });
const emptyMetrics = () => Object.fromEntries(FINANCE_CUTOVER_METRIC_KEYS.map((key) => [key, ""])) as Record<FinanceCutoverMetricKey, string>;

const initialConfig = {
  cutoverDate: today,
  openingBalanceMode: "imported" as "imported" | "new_zero_balance",
  zeroBalanceAttested: false,
  bankDataMode: "manual_csv" as "manual_csv" | "provider",
  parallelCloseId: "none",
  coaApproved: false,
  restrictedFundsReviewed: false,
  apArReviewed: false,
  accessReviewed: false,
  receiptWorkflowVerified: false,
  historicalArchiveRetained: false,
  accountantName: "",
  accountantCredential: "",
  accountantAttestation: "I certify that the parallel close, opening balances, reconciliations, and supporting financial records are accurate for this NGO.",
  accountantSigned: false,
  signoffDocumentId: "none",
};

const FinanceGoLivePage = () => {
  const { selectedNgo, selectedNgoId } = useWorkspaceNgo();
  const { data: access } = useFinanceAccessCapabilities();
  const canManage = !!access?.can_review;
  const { data: readiness, isLoading: readinessLoading } = useFinanceGoLiveReadiness(selectedNgoId);
  const { data: certification } = useFinanceGoLiveCertification(selectedNgoId);
  const { data: comparisons = [] } = useFinanceParallelCloseComparisons(selectedNgoId);
  const { data: documents = [] } = useDocuments(selectedNgoId ? { ngo_id: selectedNgoId } : undefined);
  const uploadPriorEvidence = useUploadDocument();
  const uploadSignoffEvidence = useUploadDocument();
  const saveParallelClose = useSaveFinanceParallelClose();
  const approveParallelClose = useApproveFinanceParallelClose();
  const saveCertification = useSaveFinanceGoLiveCertification();
  const activateSystem = useActivateFinanceSystemOfRecord();
  const suspendSystem = useSuspendFinanceSystemOfRecord();

  const [priorSystemName, setPriorSystemName] = useState("QuickBooks / prior system");
  const [comparisonStart, setComparisonStart] = useState(monthStart);
  const [comparisonEnd, setComparisonEnd] = useState(today);
  const [tolerance, setTolerance] = useState("0.01");
  const [priorMetrics, setPriorMetrics] = useState(emptyMetrics);
  const [priorEvidenceId, setPriorEvidenceId] = useState("none");
  const [priorEvidenceFile, setPriorEvidenceFile] = useState<File | null>(null);
  const [comparisonNotes, setComparisonNotes] = useState("");
  const [config, setConfig] = useState(initialConfig);
  const [signoffFile, setSignoffFile] = useState<File | null>(null);

  useEffect(() => {
    setConfig(initialConfig);
    setPriorMetrics(emptyMetrics());
    setPriorEvidenceId("none");
    setPriorEvidenceFile(null);
    setSignoffFile(null);
  }, [selectedNgoId]);

  useEffect(() => {
    if (!certification) return;
    setConfig({
      cutoverDate: certification.cutover_date,
      openingBalanceMode: certification.opening_balance_mode,
      zeroBalanceAttested: certification.zero_balance_attested,
      bankDataMode: certification.bank_data_mode,
      parallelCloseId: certification.parallel_close_id ?? "none",
      coaApproved: certification.coa_approved,
      restrictedFundsReviewed: certification.restricted_funds_reviewed,
      apArReviewed: certification.ap_ar_reviewed,
      accessReviewed: certification.access_reviewed,
      receiptWorkflowVerified: certification.receipt_workflow_verified,
      historicalArchiveRetained: certification.historical_archive_retained,
      accountantName: certification.accountant_name ?? "",
      accountantCredential: certification.accountant_credential ?? "",
      accountantAttestation: certification.accountant_attestation ?? initialConfig.accountantAttestation,
      accountantSigned: !!certification.accountant_signed_at,
      signoffDocumentId: certification.accountant_signoff_document_id ?? "none",
    });
  }, [certification]);

  const approvedComparisons = comparisons.filter((comparison) => comparison.status === "approved");
  const latestComparison = comparisons[0];
  const allPriorMetricsEntered = FINANCE_CUTOVER_METRIC_KEYS.every((key) => priorMetrics[key] !== "" && Number.isFinite(Number(priorMetrics[key])));
  const systemLocked = readiness?.is_system_of_record ?? false;

  const documentOptions = useMemo(
    () => documents.map((document) => ({ id: document.id, label: document.file_name })),
    [documents],
  );

  const runParallelClose = async () => {
    if (!selectedNgoId) return;
    let sourceDocumentId = priorEvidenceId === "none" ? "" : priorEvidenceId;
    if (priorEvidenceFile) {
      const uploaded = await uploadPriorEvidence.mutateAsync({
        file: priorEvidenceFile,
        ngoId: selectedNgoId,
        category: "finance",
        reviewStatus: "Approved",
      });
      sourceDocumentId = uploaded.id;
      setPriorEvidenceId(uploaded.id);
      setPriorEvidenceFile(null);
    }
    if (!sourceDocumentId) return;
    const metrics = Object.fromEntries(
      FINANCE_CUTOVER_METRIC_KEYS.map((key) => [key, Number(priorMetrics[key])]),
    ) as FinanceCutoverMetrics;
    await saveParallelClose.mutateAsync({
      ngoId: selectedNgoId,
      startDate: comparisonStart,
      endDate: comparisonEnd,
      priorSystemName,
      priorSourceDocumentId: sourceDocumentId,
      priorMetrics: metrics,
      tolerance: Number(tolerance),
      notes: comparisonNotes,
    });
  };

  const saveGoLivePackage = async () => {
    if (!selectedNgoId) return;
    let signoffDocumentId = config.signoffDocumentId === "none" ? "" : config.signoffDocumentId;
    if (signoffFile) {
      const uploaded = await uploadSignoffEvidence.mutateAsync({
        file: signoffFile,
        ngoId: selectedNgoId,
        category: "finance",
        reviewStatus: "Approved",
      });
      signoffDocumentId = uploaded.id;
      setSignoffFile(null);
    }
    await saveCertification.mutateAsync({
      ngoId: selectedNgoId,
      payload: {
        cutover_date: config.cutoverDate,
        opening_balance_mode: config.openingBalanceMode,
        zero_balance_attested: config.zeroBalanceAttested,
        bank_data_mode: config.bankDataMode,
        parallel_close_id: config.parallelCloseId === "none" ? null : config.parallelCloseId,
        coa_approved: config.coaApproved,
        restricted_funds_reviewed: config.restrictedFundsReviewed,
        ap_ar_reviewed: config.apArReviewed,
        access_reviewed: config.accessReviewed,
        receipt_workflow_verified: config.receiptWorkflowVerified,
        historical_archive_retained: config.historicalArchiveRetained,
        accountant_name: config.accountantName,
        accountant_credential: config.accountantCredential,
        accountant_attestation: config.accountantAttestation,
        accountant_signoff_document_id: signoffDocumentId || null,
        accountant_signed: config.accountantSigned,
      },
    });
  };

  const activate = () => {
    if (!selectedNgoId) return;
    if (!window.confirm("Make HPG Finance the official accounting system of record for this NGO? The evidence package will be locked.")) return;
    activateSystem.mutate(selectedNgoId);
  };

  const suspend = () => {
    if (!selectedNgoId) return;
    const reason = window.prompt("Emergency suspension reason (required):");
    if (!reason?.trim()) return;
    suspendSystem.mutate({ ngoId: selectedNgoId, reason: reason.trim() });
  };

  return (
    <MainLayout
      title="Accounting Go-Live"
      subtitle={`Cutover certification for ${selectedNgo?.common_name || selectedNgo?.legal_name || "the selected NGO"}`}
    >
      {!selectedNgoId ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Select an NGO in the workspace header to build its cutover package.</CardContent></Card>
      ) : (
        <div className="space-y-6">
          <Alert variant={readiness?.is_system_of_record ? "default" : readiness?.is_ready ? "default" : "destructive"}>
            {readiness?.is_system_of_record ? <LockKeyhole className="h-4 w-4" /> : <Rocket className="h-4 w-4" />}
            <AlertTitle>
              {readiness?.is_system_of_record ? "HPG Finance is the system of record" : readiness?.is_ready ? "Ready for final activation" : "Cutover gates are still open"}
            </AlertTitle>
            <AlertDescription>
              {readiness?.is_system_of_record
                ? `Activated ${certification?.activated_at ? new Date(certification.activated_at).toLocaleString() : "with locked evidence"}.`
                : readiness?.is_ready
                  ? "Every database-controlled cutover requirement currently passes."
                  : "Complete the failed gates below; activation is rejected by the database until all pass."}
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader><CardTitle className="text-base">Cutover control gates</CardTitle><CardDescription>These checks are recalculated from live records, not manually marked complete.</CardDescription></CardHeader>
            <CardContent>
              {readinessLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : (
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {(readiness?.checks ?? []).map((check) => (
                    <div key={check.key} className="rounded-md border p-3 flex items-start gap-2">
                      {check.passed ? <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />}
                      <div><p className="text-sm font-medium">{check.label}</p>{check.detail ? <p className="text-xs text-muted-foreground">{check.detail}</p> : null}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Scale className="h-4 w-4" />1. Parallel close comparison</CardTitle><CardDescription>Enter the totals from the prior-system export. HPG calculates its own values and stores every variance.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <Field label="Prior system"><Input value={priorSystemName} onChange={(event) => setPriorSystemName(event.target.value)} disabled={systemLocked} /></Field>
                <Field label="Start date"><Input type="date" value={comparisonStart} onChange={(event) => setComparisonStart(event.target.value)} disabled={systemLocked} /></Field>
                <Field label="End / cutover date"><Input type="date" value={comparisonEnd} onChange={(event) => setComparisonEnd(event.target.value)} disabled={systemLocked} /></Field>
                <Field label="Allowed variance"><Input type="number" min="0" step="0.01" value={tolerance} onChange={(event) => setTolerance(event.target.value)} disabled={systemLocked} /></Field>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {FINANCE_CUTOVER_METRIC_KEYS.map((key) => (
                  <Field key={key} label={FINANCE_CUTOVER_METRIC_LABELS[key]}>
                    <Input type="number" step="0.01" value={priorMetrics[key]} onChange={(event) => setPriorMetrics((metrics) => ({ ...metrics, [key]: event.target.value }))} disabled={systemLocked} />
                  </Field>
                ))}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Prior-system export evidence">
                  <Select value={priorEvidenceId} onValueChange={setPriorEvidenceId} disabled={systemLocked}><SelectTrigger><SelectValue placeholder="Select an existing document" /></SelectTrigger><SelectContent><SelectItem value="none">Upload a new file below</SelectItem>{documentOptions.map((document) => <SelectItem key={document.id} value={document.id}>{document.label}</SelectItem>)}</SelectContent></Select>
                  <Input className="mt-2" type="file" accept=".pdf,.csv,.xlsx,.xls" onChange={(event) => setPriorEvidenceFile(event.target.files?.[0] ?? null)} disabled={systemLocked} />
                </Field>
                <Field label="Comparison notes"><Textarea value={comparisonNotes} onChange={(event) => setComparisonNotes(event.target.value)} disabled={systemLocked} /></Field>
              </div>
              <Button onClick={runParallelClose} disabled={systemLocked || !canManage || !allPriorMetricsEntered || (!priorEvidenceFile && priorEvidenceId === "none") || saveParallelClose.isPending || uploadPriorEvidence.isPending}>
                <Scale className="h-4 w-4 mr-1" />Calculate and save comparison
              </Button>

              {latestComparison ? (
                <div className="space-y-3 pt-2">
                  <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium">Latest comparison</p><StatusBadge status={latestComparison.status} /><span className="text-xs text-muted-foreground">{latestComparison.comparison_start_date} → {latestComparison.comparison_end_date}</span></div>
                  <div className="overflow-x-auto rounded-md border">
                    <Table><TableHeader><TableRow><TableHead>Metric</TableHead><TableHead className="text-right">Prior system</TableHead><TableHead className="text-right">HPG Finance</TableHead><TableHead className="text-right">Variance</TableHead></TableRow></TableHeader><TableBody>
                      {FINANCE_CUTOVER_METRIC_KEYS.map((key) => <MetricRow key={key} metricKey={key} comparison={latestComparison} />)}
                    </TableBody></Table>
                  </div>
                  {latestComparison.status === "matched" && canManage && !systemLocked ? <Button onClick={() => approveParallelClose.mutate(latestComparison.id)} disabled={approveParallelClose.isPending}><FileCheck2 className="h-4 w-4 mr-1" />Approve matched close</Button> : null}
                  {latestComparison.status === "variance" ? <p className="text-sm text-destructive flex items-center gap-1"><AlertTriangle className="h-4 w-4" />Resolve the variances in the ledger or prior-system totals, then run a new comparison.</p> : null}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileCheck2 className="h-4 w-4" />2. Operating controls and accountant sign-off</CardTitle><CardDescription>Attach the signed approval and certify the practical controls that make the workspace safe to operate.</CardDescription></CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Cutover date"><Input type="date" value={config.cutoverDate} onChange={(event) => setConfig((value) => ({ ...value, cutoverDate: event.target.value }))} disabled={systemLocked} /></Field>
                <Field label="Opening balance path"><Select value={config.openingBalanceMode} onValueChange={(openingBalanceMode: typeof config.openingBalanceMode) => setConfig((value) => ({ ...value, openingBalanceMode }))} disabled={systemLocked}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="imported">Posted opening balances</SelectItem><SelectItem value="new_zero_balance">New NGO starts at zero</SelectItem></SelectContent></Select></Field>
                <Field label="Bank data path"><Select value={config.bankDataMode} onValueChange={(bankDataMode: typeof config.bankDataMode) => setConfig((value) => ({ ...value, bankDataMode }))} disabled={systemLocked}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="manual_csv">Statement CSV imports</SelectItem><SelectItem value="provider">Connected provider</SelectItem></SelectContent></Select></Field>
                <Field label="Approved parallel close"><Select value={config.parallelCloseId} onValueChange={(parallelCloseId) => setConfig((value) => ({ ...value, parallelCloseId }))} disabled={systemLocked}><SelectTrigger><SelectValue placeholder="Choose approved comparison" /></SelectTrigger><SelectContent><SelectItem value="none">Not selected</SelectItem>{approvedComparisons.map((comparison) => <SelectItem key={comparison.id} value={comparison.id}>{comparison.comparison_end_date} · {comparison.prior_system_name}</SelectItem>)}</SelectContent></Select></Field>
              </div>
              {config.openingBalanceMode === "new_zero_balance" ? <CheckLine label="I confirm this NGO has no balances before the cutover date." checked={config.zeroBalanceAttested} onChange={(zeroBalanceAttested) => setConfig((value) => ({ ...value, zeroBalanceAttested }))} disabled={systemLocked} /> : null}
              <div className="grid gap-2 md:grid-cols-2">
                <CheckLine label="Chart of accounts and nonprofit mappings approved" checked={config.coaApproved} onChange={(coaApproved) => setConfig((value) => ({ ...value, coaApproved }))} disabled={systemLocked} />
                <CheckLine label="Restricted funds and grants reviewed" checked={config.restrictedFundsReviewed} onChange={(restrictedFundsReviewed) => setConfig((value) => ({ ...value, restrictedFundsReviewed }))} disabled={systemLocked} />
                <CheckLine label="AP and AR aging reviewed" checked={config.apArReviewed} onChange={(apArReviewed) => setConfig((value) => ({ ...value, apArReviewed }))} disabled={systemLocked} />
                <CheckLine label="Finance access, roles, and MFA reviewed" checked={config.accessReviewed} onChange={(accessReviewed) => setConfig((value) => ({ ...value, accessReviewed }))} disabled={systemLocked} />
                <CheckLine label="Receipt extraction and posting tested" checked={config.receiptWorkflowVerified} onChange={(receiptWorkflowVerified) => setConfig((value) => ({ ...value, receiptWorkflowVerified }))} disabled={systemLocked} />
                <CheckLine label="Prior-system historical archive retained" checked={config.historicalArchiveRetained} onChange={(historicalArchiveRetained) => setConfig((value) => ({ ...value, historicalArchiveRetained }))} disabled={systemLocked} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Accountant name"><Input value={config.accountantName} onChange={(event) => setConfig((value) => ({ ...value, accountantName: event.target.value }))} disabled={systemLocked} /></Field>
                <Field label="Credential / firm"><Input value={config.accountantCredential} onChange={(event) => setConfig((value) => ({ ...value, accountantCredential: event.target.value }))} placeholder="CPA, firm, or reviewer title" disabled={systemLocked} /></Field>
                <Field label="Signed evidence document">
                  <Select value={config.signoffDocumentId} onValueChange={(signoffDocumentId) => setConfig((value) => ({ ...value, signoffDocumentId }))} disabled={systemLocked}><SelectTrigger><SelectValue placeholder="Select signed evidence" /></SelectTrigger><SelectContent><SelectItem value="none">Upload a new file below</SelectItem>{documentOptions.map((document) => <SelectItem key={document.id} value={document.id}>{document.label}</SelectItem>)}</SelectContent></Select>
                  <Input className="mt-2" type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(event) => setSignoffFile(event.target.files?.[0] ?? null)} disabled={systemLocked} />
                </Field>
                <Field label="Accountant attestation"><Textarea value={config.accountantAttestation} onChange={(event) => setConfig((value) => ({ ...value, accountantAttestation: event.target.value }))} disabled={systemLocked} /></Field>
              </div>
              <CheckLine label="The named accountant signed this attestation and the attached evidence." checked={config.accountantSigned} onChange={(accountantSigned) => setConfig((value) => ({ ...value, accountantSigned }))} disabled={systemLocked} />
              {!systemLocked ? <Button onClick={saveGoLivePackage} disabled={!canManage || saveCertification.isPending || uploadSignoffEvidence.isPending}><Upload className="h-4 w-4 mr-1" />Save and recheck package</Button> : null}
            </CardContent>
          </Card>

          <Card className={readiness?.is_ready ? "border-emerald-500/50" : "border-amber-500/50"}>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Rocket className="h-4 w-4" />3. System-of-record activation</CardTitle><CardDescription>The database repeats every gate atomically. A stale screen or changed ledger cannot bypass activation.</CardDescription></CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-sm font-medium">Status: <span className="capitalize">{readiness?.status.replace(/_/g, " ") ?? "not started"}</span></p><p className="text-xs text-muted-foreground">{readiness?.blockers.length ? `${readiness.blockers.length} blocking gate${readiness.blockers.length === 1 ? "" : "s"} remain.` : "No cutover blockers remain."}</p></div>
              {readiness?.is_system_of_record ? <Button variant="destructive" onClick={suspend} disabled={!canManage || suspendSystem.isPending}>Emergency suspend</Button> : <Button onClick={activate} disabled={!canManage || !readiness?.is_ready || activateSystem.isPending}><LockKeyhole className="h-4 w-4 mr-1" />Activate system of record</Button>}
            </CardContent>
          </Card>
        </div>
      )}
    </MainLayout>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => <div className="space-y-2"><Label>{label}</Label>{children}</div>;

const CheckLine = ({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) => (
  <label className="rounded-md border p-3 flex items-start gap-2 text-sm cursor-pointer">
    <Checkbox checked={checked} onCheckedChange={(value) => onChange(value === true)} disabled={disabled} className="mt-0.5" />
    <span>{label}</span>
  </label>
);

const MetricRow = ({ metricKey, comparison }: { metricKey: FinanceCutoverMetricKey; comparison: { prior_metrics: FinanceCutoverMetrics; system_metrics: FinanceCutoverMetrics; variances: FinanceCutoverMetrics; tolerance: number } }) => {
  const variance = Number(comparison.variances[metricKey] ?? 0);
  const matched = Math.abs(variance) <= Number(comparison.tolerance);
  return <TableRow><TableCell>{FINANCE_CUTOVER_METRIC_LABELS[metricKey]}</TableCell><TableCell className="text-right">{money(comparison.prior_metrics[metricKey])}</TableCell><TableCell className="text-right">{money(comparison.system_metrics[metricKey])}</TableCell><TableCell className={`text-right ${matched ? "text-emerald-700" : "text-destructive"}`}>{money(variance)}</TableCell></TableRow>;
};

const StatusBadge = ({ status }: { status: string }) => <Badge variant={status === "approved" || status === "matched" ? "default" : "destructive"}>{status}</Badge>;

export default FinanceGoLivePage;
