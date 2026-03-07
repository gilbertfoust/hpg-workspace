import { useEffect, useMemo, useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNGOs } from "@/hooks/useNGOs";
import { useUpsertProgramMonthlyReport } from "@/hooks/useProgramMonthlyReports";
import { useCreateWorkItem } from "@/hooks/useWorkItems";

const monthOptions = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

interface ProgramMonthlyReportDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultNgoId?: string;
  defaultMonth: number;
  defaultYear: number;
}

export function ProgramMonthlyReportDrawer({
  open,
  onOpenChange,
  defaultNgoId,
  defaultMonth,
  defaultYear,
}: ProgramMonthlyReportDrawerProps) {
  const { data: ngos } = useNGOs();
  const { mutateAsync: saveReport, isPending } = useUpsertProgramMonthlyReport();
  const { mutateAsync: createWorkItem, isPending: isWorkItemPending } = useCreateWorkItem();

  const [ngoId, setNgoId] = useState(defaultNgoId || "");
  const [reportMonth, setReportMonth] = useState(defaultMonth.toString());
  const [reportYear, setReportYear] = useState(defaultYear.toString());
  const [activitiesSummary, setActivitiesSummary] = useState("");
  const [successes, setSuccesses] = useState("");
  const [challenges, setChallenges] = useState("");
  const [requestedSupport, setRequestedSupport] = useState("");
  const [challengeSeverity, setChallengeSeverity] = useState("medium");

  const ngoName = useMemo(() => {
    return ngos?.find((ngo) => ngo.id === ngoId)?.common_name ||
      ngos?.find((ngo) => ngo.id === ngoId)?.legal_name || "";
  }, [ngoId, ngos]);

  useEffect(() => {
    if (open) {
      setNgoId(defaultNgoId || "");
      setReportMonth(defaultMonth.toString());
      setReportYear(defaultYear.toString());
    }
  }, [defaultMonth, defaultNgoId, defaultYear, open]);

  const handleSubmit = async () => {
    if (!ngoId || !reportMonth || !reportYear) {
      return;
    }

    await saveReport({
      ngo_id: ngoId,
      report_month: Number(reportMonth),
      report_year: Number(reportYear),
      activities_summary: activitiesSummary,
      successes,
      challenges,
      requested_support: requestedSupport || null,
    });

    const shouldCreateWorkItem = challengeSeverity === "high" || requestedSupport.trim().length > 0;
    if (shouldCreateWorkItem) {
      const monthLabel = monthOptions.find((option) => option.value === Number(reportMonth))?.label;
      await createWorkItem({
        module: "program",
        ngo_id: ngoId,
        type: "Monthly Report Follow-up",
        title: `Program support follow-up: ${ngoName || "NGO"} (${monthLabel} ${reportYear})`,
        description: [
          `Activities summary: ${activitiesSummary || "N/A"}`,
          `Successes: ${successes || "N/A"}`,
          `Challenges: ${challenges || "N/A"}`,
          `Requested support: ${requestedSupport || "N/A"}`,
          `Challenge severity: ${challengeSeverity}`,
        ].join("\n"),
        priority: challengeSeverity === "high" ? "high" : "medium",
      });
    }

    onOpenChange(false);
    setActivitiesSummary("");
    setSuccesses("");
    setChallenges("");
    setRequestedSupport("");
    setChallengeSeverity("medium");
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[95vh]">
        <DrawerHeader>
          <DrawerTitle>Monthly Program Report</DrawerTitle>
          <DrawerDescription>Capture the monthly activity summary and support needs.</DrawerDescription>
        </DrawerHeader>

        <div className="px-6 pb-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>NGO</Label>
              <Select value={ngoId} onValueChange={setNgoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select NGO" />
                </SelectTrigger>
                <SelectContent>
                  {ngos?.map((ngo) => (
                    <SelectItem key={ngo.id} value={ngo.id}>
                      {ngo.common_name || ngo.legal_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Month</Label>
              <Select value={reportMonth} onValueChange={setReportMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value.toString()}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Year</Label>
              <Input type="number" value={reportYear} onChange={(event) => setReportYear(event.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Activities Summary</Label>
            <Textarea value={activitiesSummary} onChange={(event) => setActivitiesSummary(event.target.value)} rows={3} />
          </div>

          <div className="space-y-2">
            <Label>Successes</Label>
            <Textarea value={successes} onChange={(event) => setSuccesses(event.target.value)} rows={3} />
          </div>

          <div className="space-y-2">
            <Label>Challenges</Label>
            <Textarea value={challenges} onChange={(event) => setChallenges(event.target.value)} rows={3} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Requested Support</Label>
              <Textarea value={requestedSupport} onChange={(event) => setRequestedSupport(event.target.value)} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Challenge Severity</Label>
              <Select value={challengeSeverity} onValueChange={setChallengeSeverity}>
                <SelectTrigger>
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                High challenges or support requests will create a follow-up work item.
              </p>
            </div>
          </div>
        </div>

        <DrawerFooter className="px-6 pb-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || isWorkItemPending || !ngoId}>
            Save Report
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
