import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type WalkthroughStep = {
  target: string;
  title: string;
  text: string;
};

export function GuidedWalkthrough({ steps, label = "Walk me through this screen" }: {
  steps: WalkthroughStep[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const current = steps[Math.min(index, Math.max(0, steps.length - 1))];

  useEffect(() => {
    if (!open || !current) return;
    const element = document.querySelector<HTMLElement>(current.target);
    if (!element) return;
    const oldOutline = element.style.outline;
    const oldOffset = element.style.outlineOffset;
    const oldTransition = element.style.transition;
    element.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    element.style.outline = "3px solid hsl(var(--primary))";
    element.style.outlineOffset = "5px";
    element.style.transition = "outline-color .2s";
    return () => {
      element.style.outline = oldOutline;
      element.style.outlineOffset = oldOffset;
      element.style.transition = oldTransition;
    };
  }, [open, index, current]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [open]);

  const start = () => { setIndex(0); setOpen(true); };
  if (!steps.length) return null;
  return <>
    <Button size="sm" variant="outline" onClick={start}>
      <BookOpen className="mr-2 h-4 w-4" /> {label}
    </Button>
    {open && current && <aside
      className="fixed bottom-4 right-4 z-[100] w-[min(390px,calc(100vw-2rem))] rounded-xl border-2 border-primary/40 bg-background p-5 shadow-2xl"
      aria-label="Interactive workspace orientation">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">Step {index + 1} of {steps.length}</p>
          <h3 className="mt-1 text-lg font-semibold" aria-live="polite">{current.title}</h3>
        </div>
        <Button ref={closeRef} variant="ghost" size="icon" aria-label="Close walkthrough"
          onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{current.text}</p>
      <p className="mt-2 text-xs text-muted-foreground">The highlighted part of the workspace is the real control. This tour never creates or alters organizational records.</p>
      <div className="mt-4 flex items-center justify-between gap-2">
        <Button size="sm" variant="outline" onClick={() => setIndex(i => Math.max(0, i - 1))} disabled={index === 0}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Previous
        </Button>
        {index === steps.length - 1 ? <Button size="sm" onClick={() => setOpen(false)}>Finish orientation</Button> :
          <Button size="sm" onClick={() => setIndex(i => Math.min(steps.length - 1, i + 1))}>Next <ArrowRight className="ml-1 h-4 w-4" /></Button>}
      </div>
    </aside>}
  </>;
}
