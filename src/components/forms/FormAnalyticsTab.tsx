import { useFormAnalytics } from "@/hooks/useFormAnalytics";
import { KPICard } from "@/components/common/KPICard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { FileText, CheckCircle, Clock, Trophy } from "lucide-react";

const MODULE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(210, 70%, 55%)",
  "hsl(150, 60%, 45%)",
  "hsl(30, 80%, 55%)",
  "hsl(280, 60%, 55%)",
  "hsl(0, 65%, 55%)",
  "hsl(180, 50%, 45%)",
  "hsl(60, 70%, 45%)",
  "hsl(330, 60%, 50%)",
];

export function FormAnalyticsTab() {
  const { data, isLoading } = useFormAnalytics();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  if (!data || data.totalSubmissions === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No submissions yet. Analytics will appear once forms are submitted.</p>
        </CardContent>
      </Card>
    );
  }

  const moduleChartData = Object.entries(data.perModule).map(([name, value]) => ({
    name: name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
    value,
  }));

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Submissions"
          value={data.totalSubmissions}
          icon={<FileText className="w-5 h-5" />}
        />
        <KPICard
          title="Avg Completion Rate"
          value={`${data.avgCompletionRate}%`}
          icon={<CheckCircle className="w-5 h-5" />}
          variant={data.avgCompletionRate >= 50 ? "success" : "warning"}
        />
        <KPICard
          title="Avg Time to Submit"
          value={data.avgHoursToComplete !== null ? `${data.avgHoursToComplete}h` : "—"}
          icon={<Clock className="w-5 h-5" />}
        />
        <KPICard
          title="Most Active Form"
          value={data.mostActiveTemplate}
          icon={<Trophy className="w-5 h-5" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Per-template table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Submissions by Template</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Template</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                  <TableHead>Completion</TableHead>
                  <TableHead className="text-right">Avg Hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.perTemplate.map((t) => (
                  <TableRow key={t.templateId}>
                    <TableCell className="font-medium">{t.templateName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {t.module.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{t.total}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={t.completionRate} className="h-2 w-16" />
                        <span className="text-xs text-muted-foreground">{t.completionRate}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {t.avgHoursToSubmit !== null ? `${t.avgHoursToSubmit}h` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Module pie chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By Module</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={moduleChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                >
                  {moduleChartData.map((_, i) => (
                    <Cell key={i} fill={MODULE_COLORS[i % MODULE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
