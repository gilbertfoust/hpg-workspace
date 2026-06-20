import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar as CalendarIcon,
  Clock,
  Building2,
  User,
  Plus,
  Cake,
  GraduationCap,
  ShieldCheck,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { StatusChip } from "@/components/common/StatusChip";
import { PriorityBadge } from "@/components/common/PriorityBadge";
import { useWorkItems, WorkItem } from "@/hooks/useWorkItems";
import { useNGOs } from "@/hooks/useNGOs";
import { useOrgUnits } from "@/hooks/useOrgUnits";
import { useCalendarEvents, useCanManageCalendarEvents, type CalendarEvent } from "@/hooks/useCalendarEvents";
import { useUserRole } from "@/hooks/useUserRole";
import { CreateCalendarEventDialog } from "@/components/calendar/CreateCalendarEventDialog";
import { addDays, isSameDay, isAfter, isBefore, parseISO, startOfDay, format } from "date-fns";

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

const eventTypeIcon = (type: CalendarEvent["event_type"]) => {
  switch (type) {
    case "birthday":
      return <Cake className="w-4 h-4 text-pink-500" />;
    case "training":
      return <GraduationCap className="w-4 h-4 text-blue-500" />;
    case "compliance":
      return <ShieldCheck className="w-4 h-4 text-amber-500" />;
    default:
      return <CalendarIcon className="w-4 h-4 text-primary" />;
  }
};

export default function CalendarPage() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [createOpen, setCreateOpen] = useState(false);
  const { data: allItems } = useWorkItems();
  const { data: ngos } = useNGOs();
  const { data: orgUnits } = useOrgUnits();
  const { data: calendarEvents = [] } = useCalendarEvents();
  const { data: userRole } = useUserRole();
  const canManageEvents = useCanManageCalendarEvents(userRole?.role);

  const ngoMap = useMemo(() => {
    const m = new Map<string, string>();
    ngos?.forEach((n) => m.set(n.id, n.common_name || n.legal_name));
    return m;
  }, [ngos]);

  const deptMap = useMemo(() => {
    const m = new Map<string, string>();
    orgUnits?.forEach((unit) => {
      m.set(unit.id, `${unit.department_name}${unit.sub_department_name ? ` — ${unit.sub_department_name}` : ""}`);
    });
    return m;
  }, [orgUnits]);

  const itemsWithDates = useMemo(
    () => (allItems || []).filter((i) => !!i.due_date),
    [allItems]
  );

  const adminEventDates = useMemo(
    () => calendarEvents.map((event) => parseISO(event.starts_at)),
    [calendarEvents]
  );

  const eventDates = useMemo(
    () => [...itemsWithDates.map((i) => parseISO(i.due_date!)), ...adminEventDates],
    [itemsWithDates, adminEventDates]
  );

  const today = startOfDay(new Date());

  const selectedDateWorkItems = useMemo(
    () =>
      date
        ? itemsWithDates.filter((i) => isSameDay(parseISO(i.due_date!), date))
        : [],
    [itemsWithDates, date]
  );

  const selectedDateAdminEvents = useMemo(
    () =>
      date
        ? calendarEvents.filter((event) => isSameDay(parseISO(event.starts_at), date))
        : [],
    [calendarEvents, date]
  );

  const upcomingEvents = useMemo(() => {
    const twoWeeks = addDays(today, 14);
    const workDue = itemsWithDates
      .filter((i) => {
        const d = parseISO(i.due_date!);
        return (isAfter(d, today) || isSameDay(d, today)) && isBefore(d, twoWeeks);
      })
      .map((item) => ({ kind: "work_item" as const, date: parseISO(item.due_date!), item }));

    const adminDue = calendarEvents
      .filter((event) => {
        const d = parseISO(event.starts_at);
        return (isAfter(d, today) || isSameDay(d, today)) && isBefore(d, twoWeeks);
      })
      .map((event) => ({ kind: "calendar_event" as const, date: parseISO(event.starts_at), event }));

    return [...workDue, ...adminDue].sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [itemsWithDates, calendarEvents, today]);

  return (
    <MainLayout
      title="Calendar"
      subtitle="Work item due dates, admin events, and upcoming deadlines"
      actions={
        canManageEvents ? (
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Add event
          </Button>
        ) : undefined
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" />
              Select a date
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              modifiers={{ hasEvent: eventDates }}
              modifiersClassNames={{ hasEvent: "bg-primary/15 font-semibold" }}
              className="rounded-md border"
            />
            {calendarEvents.length === 0 && canManageEvents && (
              <p className="text-xs text-muted-foreground mt-3">
                Admin events require the calendar_events table. See docs/proposed-schemas/user-access-bundle-schemas.md.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {date ? format(date, "EEEE, MMMM d, yyyy") : "Selected date"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedDateAdminEvents.length === 0 && selectedDateWorkItems.length === 0 && (
                <p className="text-sm text-muted-foreground">No events scheduled for this date.</p>
              )}

              {selectedDateAdminEvents.map((event) => (
                <div key={event.id} className="flex items-start gap-3 p-3 rounded-lg border">
                  {eventTypeIcon(event.event_type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{event.title}</p>
                      <Badge variant="outline" className="capitalize">
                        {event.event_type.replace("_", " ")}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(parseISO(event.starts_at), "h:mm a")}
                      {event.ends_at ? ` – ${format(parseISO(event.ends_at), "h:mm a")}` : ""}
                    </p>
                    {event.description && (
                      <p className="text-sm text-muted-foreground mt-2">{event.description}</p>
                    )}
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                      {event.ngo_id && (
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {ngoMap.get(event.ngo_id) || "NGO"}
                        </span>
                      )}
                      {event.department_id && (
                        <span className="inline-flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {deptMap.get(event.department_id) || "Department"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {selectedDateWorkItems.map((item: WorkItem) => (
                <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg border">
                  <Clock className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{item.title}</p>
                      <StatusChip status={statusMap[item.status] || item.status} />
                      {item.priority && <PriorityBadge priority={priorityMap[item.priority] || item.priority} />}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                      {item.ngo_id && (
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {ngoMap.get(item.ngo_id) || "NGO"}
                        </span>
                      )}
                      <span className="capitalize">{item.module?.replace("_", " ") || "General"}</span>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upcoming (14 days)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing due in the next two weeks.</p>
              ) : (
                upcomingEvents.map((entry, index) =>
                  entry.kind === "calendar_event" ? (
                    <div key={`event-${entry.event.id}`} className="flex items-center justify-between gap-3 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        {eventTypeIcon(entry.event.event_type)}
                        <span className="truncate">{entry.event.title}</span>
                        <Badge variant="secondary" className="shrink-0 capitalize">
                          {entry.event.event_type}
                        </Badge>
                      </div>
                      <span className="text-muted-foreground shrink-0">{format(entry.date, "MMM d")}</span>
                    </div>
                  ) : (
                    <div key={`work-${entry.item.id}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate">{entry.item.title}</span>
                      <span className="text-muted-foreground shrink-0">{format(entry.date, "MMM d")}</span>
                    </div>
                  )
                )
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <CreateCalendarEventDialog open={createOpen} onOpenChange={setCreateOpen} />
    </MainLayout>
  );
}
