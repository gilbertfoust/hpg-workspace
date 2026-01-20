import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  ListChecks,
  ClipboardList,
  FileText,
  FolderOpen,
  Calendar,
  AlertTriangle,
  Layers,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronRight,
  Users,
  Briefcase,
  DollarSign,
  Scale,
  Megaphone,
  MessageSquare,
  GraduationCap,
  Wrench,
  Monitor,
  Handshake,
  UserPlus,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}

const NavItem = ({ to, icon, label, badge }: NavItemProps) => {
  const location = useLocation();
  const isActive = location.pathname === to || location.pathname.startsWith(to + "/");

  return (
    <NavLink
      to={to}
      className={cn(
        "nav-item group",
        isActive && "active"
      )}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="bg-sidebar-primary text-sidebar-primary-foreground text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </NavLink>
  );
};

interface ModuleSection {
  title: string;
  items: { to: string; icon: React.ReactNode; label: string }[];
}

const modulesSections: ModuleSection[] = [
  {
    title: "Core Operations",
    items: [
      { to: "/ngo-coordination", icon: <Users className="w-4 h-4" />, label: "NGO Coordination" },
      { to: "/modules/administration", icon: <Briefcase className="w-4 h-4" />, label: "Administration" },
      { to: "/modules/operations", icon: <Wrench className="w-4 h-4" />, label: "Operations" },
    ],
  },
  {
    title: "Programs",
    items: [
      { to: "/modules/program", icon: <GraduationCap className="w-4 h-4" />, label: "Program" },
      { to: "/modules/curriculum", icon: <FileText className="w-4 h-4" />, label: "Curriculum" },
    ],
  },
  {
    title: "Development",
    items: [
      { to: "/development", icon: <DollarSign className="w-4 h-4" />, label: "Development" },
      { to: "/partnerships", icon: <Handshake className="w-4 h-4" />, label: "Partnerships" },
      { to: "/modules/marketing", icon: <Megaphone className="w-4 h-4" />, label: "Marketing" },
      { to: "/modules/communications", icon: <MessageSquare className="w-4 h-4" />, label: "Communications" },
    ],
  },
  {
    title: "Support",
    items: [
      { to: "/modules/hr", icon: <UserPlus className="w-4 h-4" />, label: "HR" },
      { to: "/it", icon: <Monitor className="w-4 h-4" />, label: "IT" },
      { to: "/modules/finance", icon: <DollarSign className="w-4 h-4" />, label: "Finance" },
      { to: "/modules/legal", icon: <Scale className="w-4 h-4" />, label: "Legal" },
    ],
  },
];

export function AppSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedModules, setExpandedModules] = useState(false);
  const { user, signOut } = useAuth();
  const { data: userRole } = useUserRole();
  const canAccessAdminConfig = userRole?.role === 'super_admin' || userRole?.role === 'admin_pm';

  const userInitials = user?.user_metadata?.full_name
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || user?.email?.slice(0, 2).toUpperCase() || 'U';

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const roleLabel = userRole?.role?.replace('_', ' ') || 'Staff';

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <>
      {/* Mobile overlay */}
      {!isCollapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsCollapsed(true)}
        />
      )}

      {/* Mobile toggle button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-3 left-3 z-50 lg:hidden"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        {isCollapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
      </Button>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen bg-sidebar transition-all duration-300",
          isCollapsed ? "-translate-x-full lg:translate-x-0 lg:w-16" : "w-64",
          "lg:relative lg:translate-x-0"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo / Header */}
          <div className="flex items-center gap-3 px-4 py-4 border-b border-sidebar-border">
            <img
              src="https://img1.wsimg.com/isteam/ip/8d5502d6-d937-4d80-bd56-8074053e4d77/Humanity%20Pathways%20Global.jpg/:/rs=h:175,m"
              alt="Humanity Pathways Global"
              className={cn(
                "w-auto max-w-full object-contain",
                isCollapsed ? "h-8" : "h-10 max-w-[180px]"
              )}
            />
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:flex text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4 rotate-90" />}
            </Button>
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1 py-4">
            <nav className="px-2 space-y-1">
              {/* Main Navigation */}
              <NavItem to="/dashboard" icon={<LayoutDashboard className="w-4 h-4" />} label={isCollapsed ? "" : "Dashboard"} />
              <NavItem to="/my-queue" icon={<ListChecks className="w-4 h-4" />} label={isCollapsed ? "" : "My Queue"} />
              <NavItem to="/dept-queue" icon={<Users className="w-4 h-4" />} label={isCollapsed ? "" : "Dept Queue"} />
              <NavItem to="/ngos" icon={<Building2 className="w-4 h-4" />} label={isCollapsed ? "" : "NGOs"} />
              <NavItem to="/ngo-missing-items" icon={<AlertTriangle className="w-4 h-4" />} label={isCollapsed ? "" : "NGO Missing Items"} />
              <NavItem to="/work-items" icon={<ClipboardList className="w-4 h-4" />} label={isCollapsed ? "" : "Work Items"} badge={12} />
              <NavItem to="/forms" icon={<FileText className="w-4 h-4" />} label={isCollapsed ? "" : "Forms"} />
              <NavItem to="/documents" icon={<FolderOpen className="w-4 h-4" />} label={isCollapsed ? "" : "Documents"} />
              <NavItem to="/calendar" icon={<Calendar className="w-4 h-4" />} label={isCollapsed ? "" : "Calendar"} />
              <NavItem to="/hr" icon={<UserPlus className="w-4 h-4" />} label={isCollapsed ? "" : "HR"} />

              {!isCollapsed && (
                <div className="pt-4">
                  <p className="nav-section-title">Executive</p>
                  <div className="space-y-1">
                    <NavItem to="/reports" icon={<BarChart3 className="w-4 h-4" />} label="Reports" />
                  </div>
                </div>
              )}

              {/* Modules Section */}
              {!isCollapsed && (
                <div className="pt-4">
                  <button
                    onClick={() => setExpandedModules(!expandedModules)}
                    className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold uppercase tracking-wider text-sidebar-muted hover:text-sidebar-foreground"
                  >
                    <span className="flex items-center gap-2">
                      <Layers className="w-4 h-4" />
                      Modules
                    </span>
                    <ChevronDown className={cn("w-4 h-4 transition-transform", expandedModules && "rotate-180")} />
                  </button>

                  {expandedModules && (
                    <div className="mt-2 space-y-4 animate-fade-in">
                      {modulesSections.map((section) => (
                        <div key={section.title}>
                          <p className="nav-section-title">{section.title}</p>
                          <div className="space-y-1">
                            {section.items.map((item) => (
                              <NavItem key={item.to} {...item} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Footer Navigation */}
              <div className="pt-4 mt-4 border-t border-sidebar-border">
                {isCollapsed && (
                  <NavItem to="/reports" icon={<BarChart3 className="w-4 h-4" />} label="" />
                )}
                <NavItem to="/admin" icon={<Settings className="w-4 h-4" />} label={isCollapsed ? "" : "Admin"} />
                {canAccessAdminConfig && (
                  <NavItem
                    to="/admin/config"
                    icon={<Settings className="w-4 h-4" />}
                    label={isCollapsed ? "" : "Admin / Config"}
                  />
                )}
              </div>
            </nav>
          </ScrollArea>

          {/* User section */}
          {!isCollapsed && (
            <div className="p-4 border-t border-sidebar-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center">
                  <span className="text-xs font-medium text-sidebar-foreground">{userInitials}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-sidebar-foreground truncate">{displayName}</p>
                  <p className="text-xs text-sidebar-muted truncate capitalize">{roleLabel}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent"
                  onClick={handleSignOut}
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
