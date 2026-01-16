import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ChevronLeft, 
  ChevronRight,
  ListTodo
} from "lucide-react";
import { format, isSameDay, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { useWorkItems } from "@/hooks/useWorkItems";
import { PriorityBadge } from "@/components/common/PriorityBadge";

interface NGOCalendarTabProps {
  ngoId: string;
}

export function NGOCalendarTab({ ngoId }: NGOCalendarTabProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const { data: workItems, isLoading } = useWorkItems({ ngo_id: ngoId });

  // Get work items with due dates
  const itemsWithDates = useMemo(() => {
    return workItems?.filter(item => item.due_date) || [];
  }, [workItems]);

  // Get items for selected date
  const selectedDateItems = useMemo(() => {
    if (!selectedDate) return [];
    return itemsWithDates.filter(item => 
      item.due_date && isSameDay(new Date(item.due_date), selectedDate)
    );
  }, [selectedDate, itemsWithDates]);

  // Get dates that have items (for highlighting)
  const datesWithItems = useMemo(() => {
    return itemsWithDates.reduce((acc, item) => {
      if (item.due_date) {
        const dateKey = format(new Date(item.due_date), "yyyy-MM-dd");
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(item);
      }
      return acc;
    }, {} as Record<string, typeof itemsWithDates>);
  }, [itemsWithDates]);

  // Custom day rendering to show dots for items
  const modifiers = useMemo(() => {
    const hasTasks: Date[] = [];
    const hasOverdue: Date[] = [];
    const today = new Date();

    Object.entries(datesWithItems).forEach(([dateStr, items]) => {
      const date = new Date(dateStr);
      hasTasks.push(date);
      
      if (date < today && items.some(i => !['complete', 'canceled'].includes(i.status))) {
        hasOverdue.push(date);
      }
    });

    return { hasTasks, hasOverdue };
  }, [datesWithItems]);

  const modifiersStyles = {
    hasTasks: {
      fontWeight: 600,
    },
    hasOverdue: {
      color: "hsl(var(--destructive))",
    },
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Skeleton className="h-80" />
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Calendar */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-medium">Due Dates Calendar</CardTitle>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-medium min-w-[120px] text-center">
                {format(currentMonth, "MMMM yyyy")}
              </span>
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            month={currentMonth}
            onMonthChange={setCurrentMonth}
            modifiers={modifiers}
            modifiersStyles={modifiersStyles}
            className="rounded-md"
          />
          <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span>Has tasks</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-destructive" />
              <span>Overdue</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selected Date Details */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium">
            {selectedDate ? format(selectedDate, "MMMM d, yyyy") : "Select a date"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedDateItems.length > 0 ? (
            <div className="space-y-3">
              {selectedDateItems.map((item) => (
                <div 
                  key={item.id} 
                  className="p-3 rounded-lg border hover:border-primary/30 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{item.title}</p>
                      <p className="text-xs text-muted-foreground capitalize mt-1">
                        {item.module.replace(/_/g, " ")}
                      </p>
                    </div>
                    <PriorityBadge priority={item.priority} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <ListTodo className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {selectedDate ? "No tasks due on this date" : "Select a date to view tasks"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
