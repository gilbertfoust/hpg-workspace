import { useMemo, useState } from "react";
import { format } from "date-fns";
import { MainLayout } from "@/components/layout/MainLayout";
import { KPICard } from "@/components/common/KPICard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNGOs } from "@/hooks/useNGOs";
import { useProgramActivities } from "@/hooks/useProgramActivities";
import { ProgramActivityDrawer } from "@/components/program/ProgramActivityDrawer";
import { ProgramMonthlyReportDrawer } from "@/components/program/ProgramMonthlyReportDrawer";
import { ProgramEvidencePackDrawer } from "@/components/program/ProgramEvidencePackDrawer";
import { FilePlus, FolderOpen } from "lucide-react";

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

export default function ProgramDashboard() {
  const now = new Date();
  const [selectedNgoId, setSelectedNgoId] = useState("all");
  const [selectedBundle, setSelectedBundle] = useState("all");
  const [selectedCountry, setSelectedCountry] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState((now.getMonth() + 1).toString());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear().toString());
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  const { data: ngos } = useNGOs();

  const startDate = useMemo(() => {
    return new Date(Number(selectedYear), Number(selectedMonth) - 1, 1).toISOString();
  }, [selectedMonth, selectedYear]);

  const endDate = useMemo(() => {
    return new Date(Number(selectedYear), Number(selectedMonth), 0).toISOString();
  }, [selectedMonth, selectedYear]);

  const { data: activities = [], isLoading } = useProgramActivities({
    ngo_id: selectedNgoId !== "all" ? selectedNgoId : undefined,
    startDate,
    endDate,
  });

  const ngoMap = useMemo(() => {
    const map = new Map<string, string>();
    ngos?.forEach((ngo) => {
      map.set(ngo.id, ngo.common_name || ngo.legal_name);
    });
    return map;
  }, [ngos]);

  const bundleOptions = useMemo(() => {
    const bundles = new Set<string>();
    ngos?.forEach((ngo) => {
      if (ngo.bundle) bundles.add(ngo.bundle);
    });
    return Array.from(bundles);
  }, [ngos]);

  const countryOptions = useMemo(() => {
    const countries = new Set<string>();
    ngos?.forEach((ngo) => {
      if (ngo.country) countries.add(ngo.country);
    });
    return Array.from(countries);
  }, [ngos]);

  const filteredActivities = useMemo(() => {
    return activities.filter((activity) => {
      const ngo = ngos?.find((item) => item.id === activity.ngo_id);
      if (selectedBundle !== "all" && ngo?.bundle !== selectedBundle) {
        return false;
      }
      if (selectedCountry !== "all" && ngo?.country !== selectedCountry) {
        return false;
      }
      return true;
    });
  }, [activities, ngos, selectedBundle, selectedCountry]);

  const selectedActivity = filteredActivities.find((activity) => activity.id === selectedActivityId) || null;

  const activityTypeCounts = useMemo(() => {
    return filteredActivities.reduce<Record<string, number>>((acc, activity) => {
      const key = activity.activity_type || "Other";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [filteredActivities]);

  const totalParticipants = useMemo(() => {
    return filteredActivities.reduce((sum, activity) => sum + (activity.participants_count || 0), 0);
  }, [filteredActivities]);

  const topActivityType = useMemo(() => {
    return Object.entries(activityTypeCounts).reduce(
      (top, [type, count]) => (count > top.count ? { type, count } : top),
      { type: "-", count: 0 }
    ).type;
  }, [activityTypeCounts]);

  const evidenceNgoName = selectedNgoId !== "all" ? ngoMap.get(selectedNgoId) || null : null;

  return (
    <MainLayout
      title="Program Dashboard"
      subtitle="Track monthly activities, evidence, and program follow-ups"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setEvidenceOpen(true)} disabled={selectedNgoId === "all"}>
            <FolderOpen className="w-4 h-4 mr-2" />
            Evidence Pack
          </Button>
          <Button onClick={() => setReportOpen(true)}>
            <FilePlus className="w-4 h-4 mr-2" />
            New Monthly Report
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-4">
          <KPICard title="Activities this month" value={filteredActivities.length} />
          <KPICard title="Total participants" value={totalParticipants} />
          <KPICard
            title="Most common type"
            value={topActivityType}
            subtitle="By activity type"
          />
          <KPICard title="Distinct NGOs" value={new Set(filteredActivities.map((activity) => activity.ngo_id)).size} />
        </div>

        <div className="rounded-lg border bg-card p-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">NGO</label>
              <Select value={selectedNgoId} onValueChange={setSelectedNgoId}>
                <SelectTrigger>
                  <SelectValue placeholder="All NGOs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All NGOs</SelectItem>
                  {ngos?.map((ngo) => (
                    <SelectItem key={ngo.id} value={ngo.id}>
                      {ngo.common_name || ngo.legal_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Bundle</label>
              <Select value={selectedBundle} onValueChange={setSelectedBundle}>
                <SelectTrigger>
                  <SelectValue placeholder="All bundles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All bundles</SelectItem>
                  {bundleOptions.map((bundle) => (
                    <SelectItem key={bundle} value={bundle}>
                      {bundle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Country</label>
              <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                <SelectTrigger>
                  <SelectValue placeholder="All countries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All countries</SelectItem>
                  {countryOptions.map((country) => (
                    <SelectItem key={country} value={country}>
                      {country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Month</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
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
              <label className="text-sm font-medium">Year</label>
              <Input type="number" value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {Object.entries(activityTypeCounts).map(([type, count]) => (
              <Badge key={type} variant="secondary">
                {type} • {count}
              </Badge>
            ))}
          </div>
        </div>

        <div className="rounded-lg border bg-card">
          <div className="flex items-center justify-between p-4 border-b">
            <div>
              <h2 className="text-lg font-semibold">Program Activities</h2>
              <p className="text-sm text-muted-foreground">Monthly program activity reporting per NGO.</p>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>NGO</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Participants</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Loading activities...
                  </TableCell>
                </TableRow>
              ) : filteredActivities.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No activities found for this period.
                  </TableCell>
                </TableRow>
              ) : (
                filteredActivities.map((activity) => (
                  <TableRow
                    key={activity.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => setSelectedActivityId(activity.id)}
                  >
                    <TableCell>{ngoMap.get(activity.ngo_id || "") || "-"}</TableCell>
                    <TableCell>{format(new Date(activity.activity_date), "PPP")}</TableCell>
                    <TableCell className="font-medium">{activity.title}</TableCell>
                    <TableCell>{activity.activity_type || "-"}</TableCell>
                    <TableCell>{activity.participants_count ?? 0}</TableCell>
                    <TableCell>{activity.location || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{activity.status || "Pending"}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <ProgramActivityDrawer
        activity={selectedActivity}
        ngoName={selectedActivity?.ngo_id ? ngoMap.get(selectedActivity.ngo_id) || null : null}
        open={!!selectedActivityId}
        onOpenChange={(open) => !open && setSelectedActivityId(null)}
      />

      <ProgramMonthlyReportDrawer
        open={reportOpen}
        onOpenChange={setReportOpen}
        defaultNgoId={selectedNgoId !== "all" ? selectedNgoId : undefined}
        defaultMonth={Number(selectedMonth)}
        defaultYear={Number(selectedYear)}
      />

      <ProgramEvidencePackDrawer
        ngoId={selectedNgoId !== "all" ? selectedNgoId : null}
        ngoName={evidenceNgoName}
        month={Number(selectedMonth)}
        year={Number(selectedYear)}
        open={evidenceOpen}
        onOpenChange={setEvidenceOpen}
      />
    </MainLayout>
  );
}
