import { useState, useRef, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import type { SigningRequestByToken } from "@/types/esignature";

type PageState = "loading" | "ready" | "signing" | "signed" | "error";

export default function SignDocument() {
  const { token } = useParams<{ token: string }>();
  const sigCanvasRef = useRef<SignatureCanvas | null>(null);
  const [state, setState] = useState<PageState>("loading");
  const [request, setRequest] = useState<SigningRequestByToken | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [typedSignature, setTypedSignature] = useState("");
  const [signatureMode, setSignatureMode] = useState<"draw" | "type">("draw");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

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

      if (error || !data || (data as any[]).length === 0) {
        setErrorMsg("Signing request not found");
        setState("error");
        return;
      }

      const req = (data as any[])[0] as SigningRequestByToken;

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

    let signatureDataUrl: string;

    if (signatureMode === "draw") {
      if (!sigCanvasRef.current || sigCanvasRef.current.isEmpty()) {
        toast.error("Please draw your signature first");
        return;
      }
      signatureDataUrl = sigCanvasRef.current.toDataURL("image/png");
    } else {
      if (!typedSignature.trim()) {
        toast.error("Please type your signature");
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = 400;
      canvas.height = 100;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, 400, 100);
      ctx.fillStyle = "#1a1a2e";
      ctx.font = "italic 36px 'Georgia', serif";
      ctx.textBaseline = "middle";
      ctx.fillText(typedSignature, 20, 50);
      signatureDataUrl = canvas.toDataURL("image/png");
    }

    setState("signing");

    try {
      const { data, error } = await supabase.functions.invoke("process-signature", {
        body: { token, signature_data: signatureDataUrl },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setState("signed");
    } catch (error: any) {
      toast.error(error.message || "Failed to sign document");
      setState("ready");
    }
  }, [request, token, signatureMode, typedSignature]);

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
              "{request?.original_filename}" has been signed successfully.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Sign Document: {request?.original_filename}</CardTitle>
            <p className="text-sm text-muted-foreground">
              Requested for {request?.signer_name} ({request?.signer_email})
            </p>
          </CardHeader>
          <CardContent>
            {pdfUrl && (
              <iframe
                src={pdfUrl}
                className="h-[500px] w-full rounded-md border"
                title="PDF Preview"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your Signature</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={signatureMode} onValueChange={(v) => setSignatureMode(v as "draw" | "type")}>
              <TabsList className="w-full">
                <TabsTrigger value="draw" className="flex-1">Draw</TabsTrigger>
                <TabsTrigger value="type" className="flex-1">Type</TabsTrigger>
              </TabsList>
              <TabsContent value="draw" className="mt-4">
                <div className="rounded-md border bg-white">
                  <SignatureCanvas
                    ref={sigCanvasRef}
                    canvasProps={{
                      className: "w-full h-40",
                      style: { width: "100%", height: "160px" },
                    }}
                    penColor="#1a1a2e"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => sigCanvasRef.current?.clear()}
                >
                  Clear
                </Button>
              </TabsContent>
              <TabsContent value="type" className="mt-4">
                <Input
                  value={typedSignature}
                  onChange={(e) => setTypedSignature(e.target.value)}
                  placeholder="Type your full name"
                  className="text-lg"
                />
                {typedSignature && (
                  <div className="mt-3 rounded-md border bg-white p-4">
                    <p
                      className="text-3xl"
                      style={{ fontFamily: "'Georgia', serif", fontStyle: "italic", color: "#1a1a2e" }}
                    >
                      {typedSignature}
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <Button
              onClick={handleSign}
              disabled={state === "signing"}
              className="w-full"
              size="lg"
            >
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
