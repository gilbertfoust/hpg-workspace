import { useState, useCallback, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import type { SigningRequestByToken } from "@/types/esignature";
import type { PdfSignaturePlacement } from "@/types/pdf";
import { PdfViewer } from "@/components/pdf/PdfViewer";
import { ESignatureCapture } from "@/components/esign/ESignatureCapture";
import { ESignaturePlacer } from "@/components/esign/ESignaturePlacer";

type PageState = "loading" | "ready" | "signing" | "signed" | "error";

export default function SignDocument() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<PageState>("loading");
  const [request, setRequest] = useState<SigningRequestByToken | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [placement, setPlacement] = useState<PdfSignaturePlacement | null>(null);
  const [pageDims, setPageDims] = useState({ width: 612, height: 792, pageIndex: 0 });
  const [viewerScale, setViewerScale] = useState(1);

  useEffect(() => {
    if (!token || !supabase) {
      setErrorMsg("Invalid signing link");
      setState("error");
      return;
    }

    async function loadRequest() {
      const { data, error } = await supabase!.rpc("get_signing_request_by_token" as never, {
        request_token: token!,
      } as never);

      if (error || !data || (data as unknown[]).length === 0) {
        setErrorMsg("Signing request not found");
        setState("error");
        return;
      }

      const req = (data as unknown[])[0] as SigningRequestByToken;

      if (req.status === "signed") {
        setErrorMsg("This document has already been signed");
        setState("error");
        return;
      }

      if (new Date(req.expires_at) < new Date()) {
        setErrorMsg("This signing link has expired");
        setState("error");
        return;
      }

      setRequest(req);

      const { data: urlData, error: urlError } = await supabase!.storage
        .from("esign-documents")
        .createSignedUrl(req.storage_path, 3600);

      if (!urlError && urlData?.signedUrl) {
        setPdfUrl(urlData.signedUrl);
      }

      setState("ready");
    }

    loadRequest();
  }, [token]);

  const handleSign = useCallback(async () => {
    if (!request || !token || !supabase) return;

    if (!signatureDataUrl) {
      toast.error("Please capture your signature first");
      return;
    }

    setState("signing");

    const signedDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const effectivePlacement = placement ?? {
      pageIndex: pageDims.pageIndex,
      x: 50,
      y: pageDims.height - 120,
      width: 200,
      height: 60,
    };

    try {
      const { data, error } = await supabase.functions.invoke("process-signature", {
        body: {
          token,
          signature_data: signatureDataUrl,
          signature_placement: {
            ...effectivePlacement,
            pageIndex: pageDims.pageIndex,
          },
          signer_caption: `Signed by ${request.signer_name} on ${signedDate}`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setState("signed");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to sign document");
      setState("ready");
    }
  }, [request, token, signatureDataUrl, placement, pageDims]);

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-6">
            <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
            <p className="mt-4 text-lg font-medium">{errorMsg}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state === "signed") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-6">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
            <h2 className="mt-4 text-xl font-bold">Document Signed!</h2>
            <p className="mt-2 text-muted-foreground">
              &ldquo;{request?.original_filename}&rdquo; has been signed successfully.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-5xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Sign Document: {request?.original_filename}</CardTitle>
            <p className="text-sm text-muted-foreground">
              Requested for {request?.signer_name} ({request?.signer_email})
            </p>
          </CardHeader>
          <CardContent>
            {pdfUrl && (
              <div className="h-[55vh] min-h-[400px]">
                <PdfViewer
                  url={pdfUrl}
                  fileName={request?.original_filename}
                  className="h-full"
                  showThumbnails
                  onPageDimensions={(w, h, pageIndex) => setPageDims({ width: w, height: h, pageIndex })}
                  onScaleChange={setViewerScale}
                  overlay={
                    signatureDataUrl ? (
                      <ESignaturePlacer
                        signatureDataUrl={signatureDataUrl}
                        pageWidth={pageDims.width}
                        pageHeight={pageDims.height}
                        scale={viewerScale}
                        placement={placement ? { ...placement, pageIndex: pageDims.pageIndex } : null}
                        onPlacementChange={(p) => setPlacement({ ...p, pageIndex: pageDims.pageIndex })}
                      />
                    ) : null
                  }
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your Signature</CardTitle>
            <p className="text-sm text-muted-foreground">
              Capture your signature, then drag it onto the document above.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <ESignatureCapture onCapture={setSignatureDataUrl} />
            {signatureDataUrl && (
              <p className="text-xs text-muted-foreground">
                Signature captured. Drag the box on the PDF to position it before signing.
              </p>
            )}
            <Button onClick={handleSign} disabled={state === "signing"} className="w-full" size="lg">
              {state === "signing" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing...
                </>
              ) : (
                "Finish & Sign"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
