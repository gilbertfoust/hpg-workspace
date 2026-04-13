import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Calendar as CalendarIcon,
  Clock,
  Building2,
  User,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { StatusChip } from "@/components/common/StatusChip";
import { PriorityBadge } from "@/components/common/PriorityBadge";
import { useWorkItems, WorkItem } from "@/hooks/useWorkItems";
import { useNGOs } from "@/hooks/useNGOs";
import { addDays, isSameDay, isAfter, isBefore, parseISO, startOfDay } from "date-fns";

const statusMap: Record<string, string> = {
  draft: "draft",
  not_started: "not-started",
  in_progress: "in-progress",
  waiting_on_ngo: "waiting-ngo",
  waiting_on_hpg: "waiting-hpg",
  submitted: "submitted",
  under_review: "under-review",
  approved: "approved",
  rejected: "rejected",
  complete: "complete",
  canceled: "canceled",
};

const priorityMap: Record<string, string> = {
  low: "Low",
  medium: "Med",
  high: "High",
  urgent: "High",
};

export default function CalendarPage() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const { data: allItems } = useWorkItems();
  const { data: ngos } = useNGOs();

  const ngoMap = useMemo(() => {
    const m = new Map<string, string>();
    ngos?.forEach((n) => m.set(n.id, n.common_name || n.legal_name));
    return m;
  }, [ngos]);

  // Only items with due dates
  const itemsWithDates = useMemo(
    () => (allItems || []).filter((i) => !!i.due_date),
    [allItems]
  );

  // Dates that have events (for calendar highlights)
  const eventDates = useMemo(
    () => itemsWithDates.map((i) => parseISO(i.due_date!)),
    [itemsWithDates]
  );

  const today = startOfDay(new Date());

  // Events for selected date
  const selectedDateEvents = useMemo(
    () =>
      date
        ? itemsWithDates.filter((i) => isSameDay(parseISO(i.due_date!), date))
        : [],
    [itemsWithDates, date]
  );

  // Upcoming 14 days
  const upcomingEvents = useMemo(() => {
    const twoWeeks = addDays(today, 14);
    return itemsWithDates
      .filter((i) => {
        const d = parseISO(i.due_date!);
        return (isAfter(d, today) || isSameDay(d, today)) && isBefore(d, twoWeeks);
      })
      .sort((a, b) => parseISO(a.due_date!).getTime() - parseISO(b.due_date!).getTime());
  }, [itemsWithDates, today]);

  const isOverdue = (item: WorkItem) => {
    if (!item.due_date) return false;
    return isBefore(parseISO(item.due_date), today) && item.status !== "complete" && item.status !== "canceled";
  };

  return (
    <MainLayout
      title="Calendar"
      subtitle="View deadlines and scheduled work items"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Work Item Deadlines</CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="w-full"
              modifiers={{
                hasEvent: eventDates,
              }}
              modifiersStyles={{
                hasEvent: {
                  fontWeight: "bold",
                  backgroundColor: "hsl(var(--primary) / 0.1)",
                  color: "hsl(var(--primary))",
                },
              }}
            />
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Selected date events */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <CalendarIcon className="w-4 h-4" />
                {date?.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedDateEvents.length > 0 ? (
                <div className="space-y-3">
                  {selectedDateEvents.map((item) => (
                    <div
                      key={item.id}
                      className={`p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors ${
                        isOverdue(item) ? "bg-destructive/5 border border-destructive/20" : "bg-muted/50"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-sm">{item.title}</h4>
                        <PriorityBadge priority={(priorityMap[item.priority || "medium"] || "Med") as any} />
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        {item.ngo_id && (
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3 h-3" />
                            {ngoMap.get(item.ngo_id) || "Unknown NGO"}
                          </div>
                        )}
                        {item.module && (
                          <div className="flex items-center gap-1.5">
                            <User className="w-3 h-3" />
                            {item.module.replace(/_/g, " ")}
                          </div>
                        )}
                      </div>
                      <div className="mt-2">
                        <StatusChip status={(statusMap[item.status] || item.status) as any} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No items due on this date
                </p>
              )}
            </CardContent>
          </Card>

          {/* Upcoming deadlines */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Upcoming (14 days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingEvents.length > 0 ? (
                <div className="space-y-3">
                  {upcomingEvents.map((item) => {
                    const d = parseISO(item.due_date!);
                    return (
                      <div
                        key={item.id}
                        className="flex items-start gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer transition-colors"
                      >
                        <div className="text-center min-w-[40px]">
                          <div className={`text-lg font-semibold ${isOverdue(item) ? "text-destructive" : "text-primary"}`}>
                            {d.getDate()}
                          </div>
                          <div className="text-xs text-muted-foreground uppercase">
                            {d.toLocaleDateString("en-US", { weekday: "short" })}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.title}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {item.ngo_id ? ngoMap.get(item.ngo_id) || "NGO" : item.module?.replace(/_/g, " ") || ""}
                          </p>
                        </div>
                        <PriorityBadge priority={(priorityMap[item.priority || "medium"] || "Med") as any} showIcon={false} />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No upcoming deadlines
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
