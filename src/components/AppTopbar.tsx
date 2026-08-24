import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, CalendarDays, CheckSquare, Home, PenSquare, Plus, Search, Settings, Trophy, Users } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from "@/components/ui/command";
import { getPreviousWeekStart, getWeekOptions } from "@/utils/weekUtils";
import { useWorkspace } from "@/lib/workspace";
import { supabase } from "@/integrations/supabase/client";

const destinations = [
  { label: "Dashboard", to: "/dashboard", icon: Home },
  { label: "Clients", to: "/clients", icon: Users },
  { label: "Data Entry", to: "/data-entry", icon: PenSquare },
  { label: "Actionables", to: "/actionables", icon: CheckSquare },
  { label: "Monthly Targets", to: "/monthly-targets", icon: CalendarDays },
  { label: "Client Leaderboard", to: "/client-leaderboard", icon: Trophy },
  { label: "Settings", to: "/settings", icon: Settings },
] as const;

export function AppTopbar({ pageLabel }: { pageLabel: string }) {
  const navigate = useNavigate();
  const { selectedWeek, setSelectedWeek } = useWorkspace();
  const [commandOpen, setCommandOpen] = useState(false);
  const [attention, setAttention] = useState({ alerts: 0, tasks: 0, milestones: 0 });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(open => !open);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.from("client_alerts").select("id", { count: "exact", head: true }).eq("is_resolved", false),
      supabase.from("actionables").select("id", { count: "exact", head: true }).neq("status", "done").lt("due_date", new Date().toISOString().slice(0, 10)),
      supabase.from("client_notifications").select("id", { count: "exact", head: true }).eq("is_dismissed", false),
    ]).then(([alerts, tasks, milestones]) => {
      if (active) setAttention({ alerts: alerts.count || 0, tasks: tasks.count || 0, milestones: milestones.count || 0 });
    });
    return () => { active = false; };
  }, []);

  const attentionTotal = attention.alerts + attention.tasks + attention.milestones;

  const go = (to: string) => {
    setCommandOpen(false);
    navigate({ to });
  };

  return (
    <>
      <div className="sticky top-0 z-40 flex min-h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <SidebarTrigger aria-label="Toggle navigation" />
        <div className="min-w-0 flex-1">
          <span className="block truncate text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">{pageLabel}</span>
        </div>
        <Button variant="outline" className="hidden h-9 w-56 justify-start text-muted-foreground lg:flex" onClick={() => setCommandOpen(true)}>
          <Search className="mr-2 h-4 w-4" /> Search or jump to…
          <kbd className="ml-auto rounded border bg-muted px-1.5 text-[10px]">⌘K</kbd>
        </Button>
        <div className="flex items-center gap-2">
          <Select value={selectedWeek} onValueChange={setSelectedWeek}>
            <SelectTrigger className="h-9 w-10 justify-center gap-0 px-2 font-semibold sm:w-[185px] sm:justify-between sm:px-3" aria-label="Workspace week">
              <CalendarDays className="h-4 w-4 shrink-0 text-gold sm:mr-2" />
              <SelectValue className="hidden sm:block" />
            </SelectTrigger>
            <SelectContent>
              {getWeekOptions(16).map(week => (
                <SelectItem key={week.weekStart} value={week.weekStart}>
                  {week.label}{week.weekStart === getPreviousWeekStart() ? " · Last week" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedWeek !== getPreviousWeekStart() && <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">Past period</Badge>}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label={`Notifications${attentionTotal ? `, ${attentionTotal} need attention` : ''}`} className="relative"><Bell className="h-4 w-4" />{attentionTotal > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-background" />}</Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>Notification center</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="grid gap-2 p-2 text-sm">
              <Link to="/dashboard" className="flex items-center justify-between rounded-md p-2 hover:bg-muted"><span>Client alerts</span><Badge variant={attention.alerts ? "destructive" : "secondary"}>{attention.alerts}</Badge></Link>
              <Link to="/actionables" className="flex items-center justify-between rounded-md p-2 hover:bg-muted"><span>Overdue tasks</span><Badge variant={attention.tasks ? "destructive" : "secondary"}>{attention.tasks}</Badge></Link>
              <Link to="/dashboard" className="flex items-center justify-between rounded-md p-2 hover:bg-muted"><span>Milestones</span><Badge variant="secondary">{attention.milestones}</Badge></Link>
            </div>
            <DropdownMenuItem asChild><Link to="/dashboard">Open command center</Link></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button size="sm" className="bg-gold font-black text-black hover:bg-gold/90"><Plus className="mr-1 h-4 w-4" /><span className="hidden md:inline">Quick add</span></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild><Link to="/data-entry"><PenSquare className="mr-2 h-4 w-4" />Enter weekly data</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link to="/actionables"><CheckSquare className="mr-2 h-4 w-4" />Add an actionable</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link to="/clients"><Users className="mr-2 h-4 w-4" />Open client workspace</Link></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandInput placeholder="Search pages and actions…" />
        <CommandList>
          <CommandEmpty>No matching destination.</CommandEmpty>
          <CommandGroup heading="Navigate">
            {destinations.map(item => <CommandItem key={item.to} value={item.label} onSelect={() => go(item.to)}><item.icon />{item.label}</CommandItem>)}
          </CommandGroup>
          <CommandGroup heading="Quick actions">
            <CommandItem onSelect={() => go("/data-entry")}><PenSquare />Enter weekly data<CommandShortcut>⌘E</CommandShortcut></CommandItem>
            <CommandItem onSelect={() => go("/actionables")}><Plus />Create actionable</CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
