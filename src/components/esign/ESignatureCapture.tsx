import { useCallback, useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eraser, PenLine, Type, Upload } from "lucide-react";

export interface ESignatureCaptureProps {
  onCapture: (dataUrl: string) => void;
  className?: string;
}

export function ESignatureCapture({ onCapture, className }: ESignatureCaptureProps) {
  const sigRef = useRef<SignatureCanvas | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"draw" | "type" | "upload">("draw");
  const [typed, setTyped] = useState("");

  const emitTyped = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      const canvas = document.createElement("canvas");
      canvas.width = 400;
      canvas.height = 100;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "transparent";
      ctx.clearRect(0, 0, 400, 100);
      ctx.fillStyle = "#1a1a2e";
      ctx.font = "italic 36px Georgia, serif";
      ctx.textBaseline = "middle";
      ctx.fillText(text, 20, 50);
      onCapture(canvas.toDataURL("image/png"));
    },
    [onCapture]
  );

  const handleDrawCapture = () => {
    if (!sigRef.current || sigRef.current.isEmpty()) return;
    onCapture(sigRef.current.toDataURL("image/png"));
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") onCapture(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className={className}>
      <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
        <TabsList className="w-full">
          <TabsTrigger value="draw" className="flex-1 gap-1">
            <PenLine className="h-3.5 w-3.5" /> Draw
          </TabsTrigger>
          <TabsTrigger value="type" className="flex-1 gap-1">
            <Type className="h-3.5 w-3.5" /> Type
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex-1 gap-1">
            <Upload className="h-3.5 w-3.5" /> Upload
          </TabsTrigger>
        </TabsList>

        <TabsContent value="draw" className="mt-3 space-y-2">
          <div className="rounded-md border bg-white">
            <SignatureCanvas
              ref={sigRef}
              canvasProps={{ className: "w-full h-36", style: { width: "100%", height: "144px" } }}
              penColor="#1a1a2e"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => sigRef.current?.clear()}>
              <Eraser className="h-3.5 w-3.5 mr-1" /> Clear
            </Button>
            <Button size="sm" onClick={handleDrawCapture}>
              Use Signature
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="type" className="mt-3 space-y-2">
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Type your full name"
            className="text-lg"
          />
          {typed && (
            <div className="rounded-md border bg-white p-4">
              <p className="text-3xl italic text-[#1a1a2e]" style={{ fontFamily: "Georgia, serif" }}>
                {typed}
              </p>
            </div>
          )}
          <Button size="sm" disabled={!typed.trim()} onClick={() => emitTyped(typed)}>
            Use Signature
          </Button>
        </TabsContent>

        <TabsContent value="upload" className="mt-3 space-y-2">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleUpload} />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" /> Choose image
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
