import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PdfSignaturePlacement } from "@/types/pdf";
import { Move } from "lucide-react";

interface ESignaturePlacerProps {
  signatureDataUrl: string | null;
  pageWidth: number;
  pageHeight: number;
  scale: number;
  placement: PdfSignaturePlacement | null;
  onPlacementChange: (placement: PdfSignaturePlacement) => void;
  className?: string;
}

const DEFAULT_WIDTH = 180;
const DEFAULT_HEIGHT = 60;

export function ESignaturePlacer({
  signatureDataUrl,
  pageWidth,
  pageHeight,
  scale,
  placement,
  onPlacementChange,
  className,
}: ESignaturePlacerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const effectivePlacement: PdfSignaturePlacement = placement ?? {
    pageIndex: 0,
    x: 50,
    y: pageHeight - 120,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  };

  useEffect(() => {
    if (!placement && pageWidth > 0) {
      onPlacementChange({
        pageIndex: 0,
        x: 50,
        y: pageHeight - 120,
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
      });
    }
  }, [placement, pageWidth, pageHeight, onPlacementChange]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!signatureDataUrl) return;
      e.preventDefault();
      setDragging(true);
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = (e.clientX - rect.left) / scale;
      const y = (e.clientY - rect.top) / scale;
      dragOffset.current = { x: x - effectivePlacement.x, y: y - effectivePlacement.y };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [signatureDataUrl, scale, effectivePlacement.x, effectivePlacement.y]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(pageWidth - effectivePlacement.width, (e.clientX - rect.left) / scale - dragOffset.current.x));
      const y = Math.max(0, Math.min(pageHeight - effectivePlacement.height, (e.clientY - rect.top) / scale - dragOffset.current.y));
      onPlacementChange({ ...effectivePlacement, x, y });
    },
    [dragging, scale, pageWidth, pageHeight, effectivePlacement, onPlacementChange]
  );

  const handlePointerUp = useCallback(() => setDragging(false), []);

  if (!signatureDataUrl) return null;

  return (
    <div
      ref={containerRef}
      className={cn("absolute inset-0 pointer-events-none", className)}
      style={{ width: pageWidth * scale, height: pageHeight * scale }}
    >
      <div
        className={cn(
          "absolute border-2 border-dashed border-primary bg-primary/5 pointer-events-auto cursor-move rounded",
          dragging && "ring-2 ring-primary"
        )}
        style={{
          left: effectivePlacement.x * scale,
          top: effectivePlacement.y * scale,
          width: effectivePlacement.width * scale,
          height: effectivePlacement.height * scale,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <img
          src={signatureDataUrl}
          alt="Signature placement"
          className="w-full h-full object-contain pointer-events-none"
          draggable={false}
        />
        <div className="absolute -top-6 left-0 flex items-center gap-1 text-[10px] text-primary bg-background/90 px-1 rounded">
          <Move className="h-3 w-3" /> Drag to position
        </div>
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="absolute bottom-2 right-2 pointer-events-auto text-xs h-7"
        onClick={() =>
          onPlacementChange({
            ...effectivePlacement,
            width: effectivePlacement.width * 1.1,
            height: effectivePlacement.height * 1.1,
          })
        }
      >
        Enlarge
      </Button>
    </div>
  );
}
