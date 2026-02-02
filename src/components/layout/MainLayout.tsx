import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { GlobalSearch } from "@/components/common/GlobalSearch";
import { Bell, HelpCircle, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useUpcomingReminders, useMarkReminderSeen } from "@/hooks/useReminders";
import { format } from "date-fns";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

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
  const { signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    const { error } = await signOut();
    
    if (error) {
      toast({
        variant: "destructive",
        title: "Sign out failed",
        description: error.message || "Unable to sign out. Please try again.",
      });
    } else {
      toast({
        title: "Signed out",
        description: "You have been successfully signed out.",
      });
      // Navigate to auth page
      const base = import.meta.env.BASE_URL || "/";
      navigate(`${base}auth`, { replace: true });
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-background relative overflow-hidden">
      {/* Background Globe Watermark */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <svg
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] text-blue-400 opacity-90"
          viewBox="0 0 200 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Globe circle */}
          <circle cx="100" cy="100" r="95" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.3" />
          
          {/* Latitude lines */}
          <ellipse cx="100" cy="100" rx="95" ry="30" stroke="currentColor" strokeWidth="0.8" fill="none" opacity="0.25" />
          <ellipse cx="100" cy="100" rx="95" ry="50" stroke="currentColor" strokeWidth="0.8" fill="none" opacity="0.25" />
          <ellipse cx="100" cy="100" rx="95" ry="70" stroke="currentColor" strokeWidth="0.8" fill="none" opacity="0.25" />
          <ellipse cx="100" cy="100" rx="30" ry="95" stroke="currentColor" strokeWidth="0.8" fill="none" opacity="0.25" />
          <ellipse cx="100" cy="100" rx="50" ry="95" stroke="currentColor" strokeWidth="0.8" fill="none" opacity="0.25" />
          <ellipse cx="100" cy="100" rx="70" ry="95" stroke="currentColor" strokeWidth="0.8" fill="none" opacity="0.25" />
          
          {/* Longitude lines */}
          <path d="M 100 5 Q 100 50, 100 100 Q 100 150, 100 195" stroke="currentColor" strokeWidth="0.8" fill="none" opacity="0.25" />
          <path d="M 5 100 Q 50 100, 100 100 Q 150 100, 195 100" stroke="currentColor" strokeWidth="0.8" fill="none" opacity="0.25" />
          <path d="M 30 5 Q 50 50, 70 100 Q 50 150, 30 195" stroke="currentColor" strokeWidth="0.8" fill="none" opacity="0.2" />
          <path d="M 170 5 Q 150 50, 130 100 Q 150 150, 170 195" stroke="currentColor" strokeWidth="0.8" fill="none" opacity="0.2" />
          
          {/* North America - More detailed */}
          <path d="M 15 25 Q 18 22, 22 25 Q 25 28, 28 32 Q 30 35, 32 38 Q 35 42, 38 45 Q 40 48, 42 50 Q 40 52, 38 54 Q 35 56, 32 58 Q 30 60, 28 62 Q 25 64, 22 66 Q 20 68, 18 70 Q 15 72, 15 75 Q 12 72, 10 68 Q 8 64, 8 60 Q 8 55, 10 50 Q 12 45, 15 40 Q 15 35, 15 30 Q 15 28, 15 25 Z" fill="currentColor" opacity="0.2" />
          <path d="M 22 25 Q 25 28, 28 30 Q 30 32, 32 35 Q 35 38, 38 40 Q 40 42, 42 45 Q 40 47, 38 48 Q 35 50, 32 52 Q 30 54, 28 56 Q 25 58, 22 60 Q 20 58, 18 55 Q 15 52, 15 48 Q 15 45, 18 42 Q 20 38, 22 35 Q 22 30, 22 25 Z" fill="currentColor" opacity="0.2" />
          
          {/* South America - More detailed */}
          <path d="M 28 65 Q 30 68, 32 70 Q 35 72, 38 75 Q 40 78, 42 80 Q 40 82, 38 85 Q 35 88, 32 90 Q 30 92, 28 95 Q 25 98, 22 100 Q 20 98, 18 95 Q 15 92, 15 88 Q 15 85, 18 82 Q 20 78, 22 75 Q 25 72, 28 70 Q 28 68, 28 65 Z" fill="currentColor" opacity="0.2" />
          <path d="M 32 75 Q 35 78, 38 80 Q 40 82, 42 85 Q 40 88, 38 90 Q 35 92, 32 95 Q 30 92, 28 90 Q 25 88, 25 85 Q 25 82, 28 80 Q 30 78, 32 75 Z" fill="currentColor" opacity="0.2" />
          
          {/* Europe - More detailed */}
          <path d="M 48 30 Q 50 32, 52 35 Q 55 38, 58 40 Q 60 42, 62 45 Q 60 48, 58 50 Q 55 52, 52 55 Q 50 58, 48 60 Q 45 58, 42 55 Q 40 52, 40 48 Q 40 45, 42 42 Q 45 38, 48 35 Q 48 32, 48 30 Z" fill="currentColor" opacity="0.2" />
          <path d="M 52 35 Q 55 38, 58 40 Q 60 42, 62 45 Q 60 47, 58 48 Q 55 50, 52 52 Q 50 50, 48 48 Q 45 45, 45 42 Q 45 40, 48 38 Q 50 36, 52 35 Z" fill="currentColor" opacity="0.2" />
          
          {/* Africa - More detailed */}
          <path d="M 52 62 Q 55 65, 58 68 Q 60 70, 62 72 Q 65 75, 68 78 Q 70 80, 72 82 Q 70 85, 68 88 Q 65 90, 62 92 Q 60 95, 58 98 Q 55 100, 52 102 Q 50 100, 48 98 Q 45 95, 45 92 Q 45 88, 48 85 Q 50 82, 52 80 Q 52 75, 52 70 Q 52 65, 52 62 Z" fill="currentColor" opacity="0.2" />
          <path d="M 58 68 Q 60 70, 62 72 Q 65 75, 68 78 Q 70 80, 72 82 Q 70 84, 68 86 Q 65 88, 62 90 Q 60 88, 58 86 Q 55 84, 55 82 Q 55 80, 58 78 Q 60 75, 58 72 Q 58 70, 58 68 Z" fill="currentColor" opacity="0.2" />
          
          {/* Asia - More detailed and complex */}
          <path d="M 65 25 Q 68 28, 72 30 Q 75 32, 78 35 Q 80 38, 82 40 Q 85 42, 88 45 Q 90 48, 92 50 Q 90 52, 88 55 Q 85 58, 82 60 Q 80 62, 78 65 Q 75 68, 72 70 Q 68 72, 65 75 Q 62 72, 60 68 Q 58 65, 58 60 Q 58 55, 60 50 Q 62 45, 65 40 Q 65 35, 65 30 Q 65 28, 65 25 Z" fill="currentColor" opacity="0.2" />
          <path d="M 72 30 Q 75 32, 78 35 Q 80 38, 82 40 Q 85 42, 88 45 Q 90 47, 88 48 Q 85 50, 82 52 Q 80 50, 78 48 Q 75 45, 72 42 Q 70 40, 70 38 Q 70 35, 72 32 Q 72 30, 72 30 Z" fill="currentColor" opacity="0.2" />
          <path d="M 78 50 Q 80 52, 82 55 Q 85 58, 88 60 Q 90 62, 92 65 Q 90 68, 88 70 Q 85 72, 82 75 Q 80 72, 78 70 Q 75 68, 75 65 Q 75 62, 78 60 Q 78 55, 78 50 Z" fill="currentColor" opacity="0.2" />
          
          {/* Middle East / India */}
          <path d="M 75 50 Q 78 52, 80 55 Q 82 58, 82 60 Q 80 62, 78 65 Q 75 62, 75 60 Q 75 58, 75 55 Q 75 52, 75 50 Z" fill="currentColor" opacity="0.2" />
          
          {/* Australia - More detailed */}
          <path d="M 95 115 Q 98 118, 102 120 Q 105 122, 108 125 Q 110 128, 112 130 Q 110 132, 108 135 Q 105 137, 102 140 Q 98 142, 95 145 Q 92 142, 90 140 Q 88 137, 88 135 Q 88 132, 90 130 Q 92 128, 95 125 Q 95 122, 95 120 Q 95 118, 95 115 Z" fill="currentColor" opacity="0.2" />
          <path d="M 102 120 Q 105 122, 108 125 Q 110 127, 112 130 Q 110 131, 108 132 Q 105 133, 102 135 Q 100 133, 98 132 Q 95 130, 95 128 Q 95 126, 98 124 Q 100 122, 102 120 Z" fill="currentColor" opacity="0.2" />
          
          {/* Additional detail islands */}
          <path d="M 25 45 Q 26 46, 27 47 Q 26 48, 25 47 Q 24 46, 25 45 Z" fill="currentColor" opacity="0.15" />
          <path d="M 35 55 Q 36 56, 37 57 Q 36 58, 35 57 Q 34 56, 35 55 Z" fill="currentColor" opacity="0.15" />
          <path d="M 85 55 Q 86 56, 87 57 Q 86 58, 85 57 Q 84 56, 85 55 Z" fill="currentColor" opacity="0.15" />
          <path d="M 105 125 Q 106 126, 107 127 Q 106 128, 105 127 Q 104 126, 105 125 Z" fill="currentColor" opacity="0.15" />
        </svg>
      </div>
      
      <AppSidebar />
      
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
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
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleSignOut}
              className="gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Log out</span>
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
