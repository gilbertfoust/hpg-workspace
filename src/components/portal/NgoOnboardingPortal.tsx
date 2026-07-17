import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, CreditCard, FileSignature, Landmark, Loader2 } from "lucide-react";
import { useNgoOnboarding } from "@/hooks/useNgoOnboarding";
import { useUploadDocument } from "@/hooks/useDocuments";

declare global {
  interface Window { Plaid?: { create: (options: Record<string, unknown>) => { open: () => void } } }
}

async function loadPlaid() {
  if (window.Plaid) return;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://cdn.plaid.com/link/v2/stable/link-initialize.js"]');
    if (existing) { existing.addEventListener("load", () => resolve(), { once: true }); return; }
    const script = document.createElement("script");
    script.src = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
    script.onload = () => resolve(); script.onerror = () => reject(new Error("Plaid Link could not load"));
    document.head.appendChild(script);
  });
}

export function NgoOnboardingPortal({ ngoId, country }: { ngoId: string; country?: string | null }) {
  const state = useNgoOnboarding(ngoId);
  const upload = useUploadDocument();
  const signature = useRef<SignatureCanvas | null>(null);
  const [signerName, setSignerName] = useState("");
  const [signerTitle, setSignerTitle] = useState("");
  const [consent, setConsent] = useState(false);
  const [provider, setProvider] = useState("auto");
  const [countryCode, setCountryCode] = useState(/^[A-Za-z]{2}$/.test(country || "") ? String(country).toUpperCase() : "US");
  const [currency, setCurrency] = useState("USD");

  const agreement = state.agreement.data;
  const latestPayment = state.payments.data?.[0];
  const sign = async () => {
    if (!signature.current || signature.current.isEmpty() || !signerName || !signerTitle || !consent) return;
    const blob = await new Promise<Blob | null>((resolve) => signature.current?.getTrimmedCanvas().toBlob(resolve, "image/png"));
    if (!blob) return;
    const file = new File([blob], `agreement-signature-${agreement.id}.png`, { type: "image/png" });
    const document = await upload.mutateAsync({ file, ngoId, category: "legal", reviewStatus: "Approved" });
    await state.signAgreement.mutateAsync({ signerName, signerTitle, signatureDocumentId: document.id });
  };

  const connectBank = async () => {
    const result = await state.createBankLink.mutateAsync({ countryCode, currency, provider });
    if (result.mode === "redirect") { window.location.assign(result.onboardingUrl); return; }
    if (result.mode === "plaid_link") {
      await loadPlaid();
      window.Plaid?.create({
        token: result.linkToken,
        onSuccess: (publicToken: string, metadata: any) => state.exchangePlaid.mutate({ connectionId: result.connectionId, publicToken, accountId: metadata?.accounts?.[0]?.id }),
        onExit: () => undefined,
      }).open();
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <Step label="Agreement" complete={agreement?.status === "signed"} />
        <Step label="Onboarding fee" complete={latestPayment?.status === "paid"} />
        <Step label="Bank connection" complete={(state.banks.data ?? []).some((bank: any) => bank.status === "verified")} />
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FileSignature className="h-5 w-5" />Fiscal sponsorship agreement</CardTitle><CardDescription>Review the exact HPG-issued agreement before signing.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          {!agreement ? <p className="text-sm text-muted-foreground">HPG has not issued an agreement to this portal yet.</p> : <>
            <div className="flex items-center justify-between"><p className="font-medium">{agreement.agreement_name} · {agreement.agreement_version}</p><Badge>{agreement.status}</Badge></div>
            <div className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-md border bg-muted/20 p-4 text-sm">{agreement.agreement_body_markdown}</div>
            {agreement.status !== "signed" ? <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label>Authorized signer name</Label><Input value={signerName} onChange={(event) => setSignerName(event.target.value)} /></div>
              <div className="space-y-2"><Label>Signer title</Label><Input value={signerTitle} onChange={(event) => setSignerTitle(event.target.value)} /></div>
              <div className="space-y-2 md:col-span-2"><Label>Signature</Label><div className="rounded-md border bg-white"><SignatureCanvas ref={signature} canvasProps={{ className: "h-40 w-full" }} /></div><Button variant="ghost" size="sm" onClick={() => signature.current?.clear()}>Clear signature</Button></div>
              <label className="flex items-start gap-2 text-sm md:col-span-2"><input className="mt-1" type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />I consent to use this electronic signature and certify I am authorized to sign for the NGO.</label>
              <div className="md:col-span-2"><Button onClick={sign} disabled={upload.isPending || state.signAgreement.isPending || !consent || !signerName || !signerTitle}>{(upload.isPending || state.signAgreement.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Sign agreement</Button></div>
            </div> : <p className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />Signed by {agreement.signer_name} on {new Date(agreement.signed_at).toLocaleDateString()}</p>}
          </>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" />Onboarding payment</CardTitle><CardDescription>Secure checkout settles to HPG's configured Stripe payout bank. Finance verifies Relay settlement.</CardDescription></CardHeader>
        <CardContent>{latestPayment?.status === "paid" ? <p className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />Payment received and receipt archived.</p> : <Button disabled={agreement?.status !== "signed" || state.createPayment.isPending} onClick={() => state.createPayment.mutate()}>{state.createPayment.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Pay onboarding fee</Button>}</CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Landmark className="h-5 w-5" />Connect the NGO bank</CardTitle><CardDescription>Plaid connects supported bank data. Stripe Connect or Wise supplies international payout onboarding. HPG never stores raw bank credentials.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3"><div className="space-y-2"><Label>Country code</Label><Input maxLength={2} value={countryCode} onChange={(event) => setCountryCode(event.target.value.toUpperCase())} /></div><div className="space-y-2"><Label>Currency</Label><Input maxLength={3} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} /></div><div className="space-y-2"><Label>Connection method</Label><Select value={provider} onValueChange={setProvider}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="auto">Best available</SelectItem><SelectItem value="plaid">Plaid bank data</SelectItem><SelectItem value="stripe_connect">Stripe international payout</SelectItem><SelectItem value="wise">Wise payout recipient</SelectItem><SelectItem value="relay_manual">Relay verified instructions</SelectItem></SelectContent></Select></div></div>
          <Button disabled={state.createBankLink.isPending || countryCode.length !== 2 || currency.length !== 3} onClick={connectBank}>{state.createBankLink.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Connect bank or payout account</Button>
          <div className="space-y-2">{(state.banks.data ?? []).map((bank: any) => <div key={bank.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"><div><p className="font-medium">{bank.institution_name || bank.provider.replaceAll("_", " ")}</p><p className="text-xs text-muted-foreground">{bank.country_code} · {bank.currency}{bank.account_mask ? ` · •••• ${bank.account_mask}` : ""}</p></div><Badge variant={bank.status === "verified" ? "default" : "secondary"}>{bank.status.replaceAll("_", " ")}</Badge></div>)}</div>
        </CardContent>
      </Card>
    </div>
  );
}

function Step({ label, complete }: { label: string; complete: boolean }) {
  return <div className="rounded-lg border bg-card p-4"><p className="text-sm text-muted-foreground">{label}</p><p className={`mt-1 flex items-center gap-2 font-medium ${complete ? "text-emerald-700" : ""}`}>{complete ? <CheckCircle2 className="h-4 w-4" /> : <span className="h-3 w-3 rounded-full bg-amber-400" />}{complete ? "Complete" : "Pending"}</p></div>;
}
