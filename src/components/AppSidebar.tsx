import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import myntmoreLogo from "@/assets/myntmore-logo.png";
import {
  Home,
  Users,
  PenSquare,
  CheckSquare,
  Settings,
  LogOut,
  CalendarCheck,
  BarChart2,
  Trophy,
  ArrowLeftRight,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const groups = [
  {
    label: "Overview",
    items: [{ to: "/dashboard", label: "Dashboard", icon: Home, adminOnly: false }],
  },
  {
    label: "Client work",
    items: [
      { to: "/clients", label: "Clients", icon: Users, adminOnly: false },
      { to: "/data-entry", label: "Data Entry", icon: PenSquare, adminOnly: false },
      { to: "/actionables", label: "Actionables", icon: CheckSquare, adminOnly: false },
      { to: "/monthly-targets", label: "Monthly Targets", icon: CalendarCheck, adminOnly: false },
    ],
  },
  {
    label: "Insights",
    items: [
      { to: "/reports", label: "Reports", icon: BarChart2, adminOnly: false },
      { to: "/client-leaderboard", label: "Client Leaderboard", icon: Trophy, adminOnly: false },
    ],
  },
  {
    label: "Administration",
    items: [{ to: "/settings", label: "Settings", icon: Settings, adminOnly: true }],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { profile, isAdmin, clientRecord, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      navigate({ to: "/login", replace: true });
    } catch (error) {
      setSigningOut(false);
      toast.error(error instanceof Error ? error.message : "Could not sign out. Please try again.");
    }
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-3 px-2 py-3">
          <img src={myntmoreLogo} alt="Myntmore" className={`${collapsed ? "h-10 w-10" : "h-14 w-14"} object-contain`} />
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-bold">Myntmore</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Dashboard OS
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {groups.map(group => {
          const visibleItems = group.items.filter(item => !item.adminOnly || isAdmin);
          if (visibleItems.length === 0) return null;
          return (
          <SidebarGroup key={group.label} className="py-2">
            {!collapsed && <SidebarGroupLabel className="px-2 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground/70">{group.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
              {visibleItems.map((item) => {
                const active = path === item.to || path.startsWith(item.to + "/");
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                      <Link
                        to={item.to}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center gap-2 rounded-lg transition-colors ${
                          active
                            ? "border border-gold bg-gold text-black shadow-sm hover:bg-gold/90 hover:text-black"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.label}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t">
        {!collapsed && profile && (
          <div className="px-2 py-1 text-xs">
            <div className="font-semibold truncate">{profile.full_name}</div>
            <div className="text-muted-foreground truncate">
              {isAdmin ? "Admin" : profile.department || "Member"}
            </div>
          </div>
        )}
        {isAdmin && clientRecord && (
          <SidebarMenuButton asChild>
            <Link to="/portal" className="flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4" />
              {!collapsed && <span>View as client</span>}
            </Link>
          </SidebarMenuButton>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="justify-start"
          onClick={handleSignOut}
          disabled={signingOut}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">{signingOut ? "Signing out…" : "Sign out"}</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
