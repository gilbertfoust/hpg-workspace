import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  Building2,
  User,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { StatusChip } from "@/components/common/StatusChip";
import { PriorityBadge } from "@/components/common/PriorityBadge";

// Mock events
const mockEvents = [
  {
    id: "1",
    title: "Q4 Financial Report Due",
    date: new Date(2026, 0, 15),
    ngo: "Detroit Community Foundation",
    owner: "Jane Smith",
    status: "waiting-ngo" as const,
    priority: "high" as const,
  },
  {
    id: "2",
    title: "Onboarding Deadline",
    date: new Date(2026, 0, 18),
    ngo: "Chicago Youth Initiative",
    owner: "John Doe",
    status: "in-progress" as const,
    priority: "medium" as const,
  },
  {
    id: "3",
    title: "Grant Application Deadline",
    date: new Date(2026, 0, 14),
    ngo: "Mexican Education Alliance",
    owner: "Maria Garcia",
    status: "under-review" as const,
    priority: "high" as const,
  },
  {
    id: "4",
    title: "Annual Compliance Filing",
    date: new Date(2026, 0, 31),
    ngo: "African Youth Network",
    owner: "Sarah Johnson",
    status: "submitted" as const,
    priority: "high" as const,
  },
];

export default function CalendarPage() {
  const [date, setDate] = useState<Date | undefined>(new Date(2026, 0, 12));
  const [viewMode, setViewMode] = useState("month");

  // Get events for selected date
  const selectedDateEvents = mockEvents.filter(
    (event) =>
      date &&
      event.date.getDate() === date.getDate() &&
      event.date.getMonth() === date.getMonth() &&
      event.date.getFullYear() === date.getFullYear()
  );

  // Upcoming events (next 14 days)
  const upcomingEvents = mockEvents
    .filter((event) => {
      const today = new Date(2026, 0, 12);
      const twoWeeksLater = new Date(today);
      twoWeeksLater.setDate(today.getDate() + 14);
      return event.date >= today && event.date <= twoWeeksLater;
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  return (
    <MainLayout
      title="Calendar"
      subtitle="View deadlines and scheduled work items"
      actions={
        <Select value={viewMode} onValueChange={setViewMode}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Month</SelectItem>
            <SelectItem value="week">Week</SelectItem>
            <SelectItem value="day">Day</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium">January 2026</CardTitle>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="w-full"
              modifiers={{
                hasEvent: mockEvents.map((e) => e.date),
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
                  {selectedDateEvents.map((event) => (
                    <div
                      key={event.id}
                      className="p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-sm">{event.title}</h4>
                        <PriorityBadge priority={event.priority} />
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3 h-3" />
                          {event.ngo}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <User className="w-3 h-3" />
                          {event.owner}
                        </div>
                      </div>
                      <div className="mt-2">
                        <StatusChip status={event.status} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No events on this date
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
              <div className="space-y-3">
                {upcomingEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <div className="text-center min-w-[40px]">
                      <div className="text-lg font-semibold text-primary">
                        {event.date.getDate()}
                      </div>
                      <div className="text-xs text-muted-foreground uppercase">
                        {event.date.toLocaleDateString("en-US", { weekday: "short" })}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{event.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {event.ngo}
                      </p>
                    </div>
                    <PriorityBadge priority={event.priority} showIcon={false} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
