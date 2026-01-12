import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { GlobalSearch } from "@/components/common/GlobalSearch";
import { Bell, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MainLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function MainLayout({ children, title, subtitle, actions }: MainLayoutProps) {
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
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
            </Button>
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
