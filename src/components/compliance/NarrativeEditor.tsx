import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Save } from "lucide-react";

interface Props {
  initialData: {
    mission_summary?: string;
    program_notes?: string;
    financial_notes?: string;
  };
  onSave: (data: { mission_summary: string; program_notes: string; financial_notes: string }) => void;
}

export function NarrativeEditor({ initialData, onSave }: Props) {
  const [mission, setMission] = useState(initialData.mission_summary || "");
  const [program, setProgram] = useState(initialData.program_notes || "");
  const [financial, setFinancial] = useState(initialData.financial_notes || "");

  useEffect(() => {
    setMission(initialData.mission_summary || "");
    setProgram(initialData.program_notes || "");
    setFinancial(initialData.financial_notes || "");
  }, [initialData]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Narrative Sections</CardTitle>
        <Button size="sm" onClick={() => onSave({ mission_summary: mission, program_notes: program, financial_notes: financial })}>
          <Save className="h-4 w-4 mr-1" /> Save
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Mission & Program Summary</Label>
          <Textarea value={mission} onChange={(e) => setMission(e.target.value)} rows={4} placeholder="Describe the organization's mission and key programs..." />
        </div>
        <div>
          <Label>Program Notes</Label>
          <Textarea value={program} onChange={(e) => setProgram(e.target.value)} rows={3} placeholder="Key accomplishments, metrics..." />
        </div>
        <div>
          <Label>Notes to Financial Statements</Label>
          <Textarea value={financial} onChange={(e) => setFinancial(e.target.value)} rows={3} placeholder="Accounting policies, significant events..." />
        </div>
      </CardContent>
    </Card>
  );
}
