import { useState } from "react";
import { Download, Eye, FileSignature, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReleasedNgoAgreement } from "@/hooks/useNgoOnboarding";

export function NgoAgreementDocument({ ngoId, ngoName, onReview }: { ngoId: string; ngoName: string; onReview: () => void }) {
  const state = useReleasedNgoAgreement(ngoId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const act = async (action: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to open the agreement."); }
    finally { setBusy(false); }
  };
  if (state.onboarding.isLoading || state.agreement.isLoading) return <p role="status" className="p-5 text-sm text-muted-foreground">Loading fiscal sponsorship agreement…</p>;
  if (state.agreement.error) return <div className="p-5 space-y-2"><p role="alert" className="text-sm text-destructive">Unable to load your fiscal sponsorship agreement.</p><Button variant="outline" onClick={() => void state.agreement.refetch()}>Retry</Button></div>;
  const agreement = state.agreement.data;
  if (!agreement) return <p className="p-5 text-sm text-muted-foreground">No released fiscal sponsorship agreement is available for {ngoName}.</p>;
  return <section aria-label="Fiscal Sponsorship Agreement" className="border-b border-primary/30 bg-primary/5 p-5 space-y-3">
    <div className="flex items-start gap-3"><FileSignature className="h-6 w-6 shrink-0 text-primary" /><div className="min-w-0"><h3 className="font-semibold">Fiscal Sponsorship Agreement — {agreement.status === "hpg_signed" ? "Ready for your review and signature" : "Executed copy"}</h3><p className="text-sm text-muted-foreground break-words">{ngoName} · {agreement.agreement_name}</p></div></div>
    {!state.pdfPath && <p role="alert" className="text-sm text-destructive">The signed PDF is not yet available. Please contact HPG Development.</p>}
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={busy || !state.pdfPath} onClick={() => void act(state.previewAgreement)}><Eye className="h-4 w-4 mr-2" />Preview agreement</Button>
      <Button variant="outline" disabled={busy || !state.pdfPath} onClick={() => void act(state.downloadAgreement)}>{busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}Download agreement</Button>
      {agreement.status === "hpg_signed" && <Button onClick={onReview}><FileSignature className="h-4 w-4 mr-2" />Review and sign</Button>}
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}