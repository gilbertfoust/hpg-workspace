import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { GlobalSearch } from "@/components/common/GlobalSearch";
import { Bell, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useUpcomingReminders, useMarkReminderSeen } from "@/hooks/useReminders";
import { format } from "date-fns";
import { Link } from "react-router-dom";

interface MainLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function MainLayout({ children, title, subtitle, actions }: MainLayoutProps) {
  const { data: upcomingReminders } = useUpcomingReminders({ hours: 48 });
  const markReminderSeen = useMarkReminderSeen();
  const reminderCount = upcomingReminders?.length ?? 0;

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header bar */}
        <header className="sticky top-0 z-30 flex items-center gap-4 px-6 py-3 bg-background/95 backdrop-blur border-b">
          <div className="flex-1 max-w-xl pl-12 lg:pl-0">
            <GlobalSearch />
          </div>
          
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="w-5 h-5 text-muted-foreground" />
                  {reminderCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[1.25rem] rounded-full bg-destructive px-1 text-[0.65rem] font-semibold leading-5 text-destructive-foreground text-center">
                      {reminderCount > 99 ? "99+" : reminderCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Reminders</p>
                  <span className="text-xs text-muted-foreground">Next 48 hours</span>
                </div>
                <div className="mt-3 space-y-2 max-h-72 overflow-y-auto">
                  {reminderCount === 0 && (
                    <p className="text-sm text-muted-foreground">
                      You're all caught up.
                    </p>
                  )}
                  {upcomingReminders?.map((reminder) => (
                    <Link
                      key={reminder.id}
                      to={`/work-items?workItemId=${reminder.work_item_id}`}
                      className="block rounded-md border border-border p-3 text-sm hover:bg-accent"
                      onClick={() => markReminderSeen.mutate(reminder.id)}
                    >
                      <p className="font-medium text-foreground">
                        {reminder.work_items?.title ?? "Work item reminder"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Reminder at {format(new Date(reminder.remind_at), "MMM d, h:mm a")}
                      </p>
                      {reminder.work_items?.due_date && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Due {format(new Date(reminder.work_items.due_date), "MMM d")}
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon">
              <HelpCircle className="w-5 h-5 text-muted-foreground" />
            </Button>
          </div>
        </header>

        {/* Page header */}
        {(title || actions) && (
          <div className="flex items-center justify-between px-6 py-4 border-b bg-card">
            <div>
              {title && <h1 className="text-xl font-semibold text-foreground">{title}</h1>}
              {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
