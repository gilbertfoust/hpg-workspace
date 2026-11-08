import { useEffect, useMemo, useState } from "react";
import { Headphones, PauseCircle, PlayCircle, Captions, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/** Accessibility-first narration of the current HPG lesson instructions.
 * Uses only speech synthesis on the reader's device, not a hosted audio
 * generator. Captions/transcripts are the authored lesson text, not AI output.
 * Does not pretend a recorded video exists.
 */
export default function AcademyNarratedSteps({ title, steps, currentStep, languageCode = "en" }: {
  title: string; steps: string[]; currentStep: number; languageCode?: string;
}) {
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [captionsVisible, setCaptionsVisible] = useState(false);
  const [supported, setSupported] = useState(false);
  const selected = useMemo(() => steps[Math.min(Math.max(currentStep,0),steps.length-1)] || "", [currentStep,steps]);
  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window);
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false); setPaused(false);
    return () => { if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel(); };
  }, [selected, title, languageCode]);
  const start = () => {
    if (!supported || !selected) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(title + ". Step " + (currentStep+1) + ". " + selected);
    utterance.lang = languageCode === "fr" ? "fr-FR" : languageCode === "es" ? "es-ES" : languageCode === "pt" ? "pt-BR" : "en-US";
    utterance.rate = 0.92;
    utterance.onend = () => { setSpeaking(false); setPaused(false); };
    utterance.onerror = () => { setSpeaking(false); setPaused(false); };
    setSpeaking(true); setPaused(false);
    window.speechSynthesis.speak(utterance);
  };
  const pauseOrResume = () => {
    if (!supported) return;
    if (paused) { window.speechSynthesis.resume(); setPaused(false); }
    else { window.speechSynthesis.pause(); setPaused(true); }
  };
  const stop = () => {
    if (supported) window.speechSynthesis.cancel();
    setSpeaking(false); setPaused(false);
  };
  return <div className="space-y-3 rounded-lg border p-3" aria-label="Lesson narration and transcript">
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline"><Headphones className="mr-1 h-3 w-3"/>Instructional audio</Badge>
      <Badge variant="secondary">Text-to-speech on this device</Badge>
      {supported && <Button type="button" size="sm" variant="outline" onClick={speaking ? pauseOrResume : start}>
        {speaking ? <PauseCircle className="mr-2 h-4 w-4"/> : <PlayCircle className="mr-2 h-4 w-4"/>}
        {speaking ? (paused ? "Resume reading" : "Pause reading") : "Listen to this step"}
      </Button>}
      {speaking && <Button type="button" size="sm" variant="ghost" onClick={stop}>
        <Square className="mr-2 h-3 w-3"/>Stop
      </Button>}
      <Button type="button" size="sm" variant="outline" onClick={() => setCaptionsVisible(x=>!x)}
        aria-expanded={captionsVisible}>
        <Captions className="mr-2 h-4 w-4"/>{captionsVisible?"Hide transcript":"View full transcript"}
      </Button>
    </div>
    {!supported && <p className="text-xs text-muted-foreground">Device audio narration is not available in this browser. All instructions remain visible in text.</p>}
    <p className="text-xs text-muted-foreground">Narration reads the written instructions in English using device-supported voices. This is not a recorded screen demonstration and no audio is uploaded or transmitted.</p>
    {captionsVisible && <div className="max-h-72 overflow-y-auto rounded-md bg-muted/30 p-3">
      <p className="font-semibold text-sm">{title} — transcript</p>
      <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">
        {steps.map((line,i)=><li key={i} className={i===currentStep?"font-semibold text-primary":""}>{line}</li>)}
      </ol>
    </div>}
  </div>;
}
