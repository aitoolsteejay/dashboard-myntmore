import { useEffect, useMemo, useState } from "react";
import {
  ArchiveRestore,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Clock3,
  ListChecks,
  Loader2,
  Plus,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { getPreviousWeekStart, getWeekLabel, getWeekOptions } from "@/utils/weekUtils";
import { sortAlphabetically } from "@/utils/sort";

type Process = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  owner_id: string | null;
  status: string | null;
  priority: string | null;
  created_at: string | null;
  completed_at: string | null;
  owner?: { full_name: string } | null;
};

type ProcessUpdate = {
  id: string;
  process_id: string | null;
  week_start: string;
  week_label: string | null;
  update_text: string;
};

type ProfileOption = { id: string; full_name: string | null };
type ProcessForm = { title: string; description: string; category: string; owner_id: string; priority: string };

const EMPTY_PROCESS: ProcessForm = {
  title: "",
  description: "",
  category: "",
  owner_id: "",
  priority: "medium",
};

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

const priorityStyles: Record<string, string> = {
  high: "border-red-200 bg-red-50 text-red-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  low: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

function ProcessStat({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof ListChecks; tone: string }) {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-black leading-none">{value}</div>
          <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProcessesPage({ embedded }: { embedded?: boolean } = {}) {
  const { user, isAdmin } = useAuth();
  const weekOptions = useMemo(() => getWeekOptions(12), []);
  const [activeTab, setActiveTab] = useState<"active" | "completed">("active");
  const [selectedWeek, setSelectedWeek] = useState(getPreviousWeekStart());
  const [processes, setProcesses] = useState<Process[]>([]);
  const [updates, setUpdates] = useState<ProcessUpdate[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newProcess, setNewProcess] = useState<ProcessForm>(EMPTY_PROCESS);
  const [creating, setCreating] = useState(false);
  const [updateText, setUpdateText] = useState<Record<string, string>>({});
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [{ data: processData, error: processError }, { data: updateData, error: updateError }, { data: profileData, error: profileError }] = await Promise.all([
        supabase.from("myntmore_processes").select("*, owner:profiles!owner_id(full_name)").order("created_at", { ascending: false }),
        supabase.from("process_weekly_updates").select("*").order("week_start", { ascending: false }),
        supabase.from("profiles").select("id, full_name, department"),
      ]);
      if (processError) throw processError;
      if (updateError) throw updateError;
      if (profileError) throw profileError;

      setProcesses((processData || []) as Process[]);
      const loadedUpdates = (updateData || []) as ProcessUpdate[];
      setUpdates(loadedUpdates);
      setProfiles(sortAlphabetically((profileData || []).filter(profile => profile.department !== "client"), profile => profile.full_name));
      const selectedUpdates: Record<string, string> = {};
      for (const update of loadedUpdates) {
        if (update.week_start === selectedWeek && update.process_id) selectedUpdates[update.process_id] = update.update_text;
      }
      setUpdateText(selectedUpdates);
      setDirtyIds(new Set());
    } catch (error: any) {
      toast.error("Could not load processes: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const selectedUpdates: Record<string, string> = {};
    for (const update of updates) {
      if (update.week_start === selectedWeek && update.process_id) selectedUpdates[update.process_id] = update.update_text;
    }
    setUpdateText(selectedUpdates);
    setDirtyIds(new Set());
  }, [selectedWeek]);

  const updatesByProcess = useMemo(() => {
    const map = new Map<string, ProcessUpdate[]>();
    for (const update of updates) {
      if (!update.process_id) continue;
      const list = map.get(update.process_id) || [];
      list.push(update);
      map.set(update.process_id, list);
    }
    return map;
  }, [updates]);

  const categories = useMemo(
    () => Array.from(new Set(processes.map(process => process.category).filter((value): value is string => Boolean(value)))).sort(),
    [processes],
  );

  const filteredProcesses = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return processes
      .filter(process => (process.status || "active") === activeTab)
      .filter(process => categoryFilter === "all" || process.category === categoryFilter)
      .filter(process => ownerFilter === "all" || process.owner_id === ownerFilter)
      .filter(process => priorityFilter === "all" || (process.priority || "medium") === priorityFilter)
      .filter(process => !normalizedSearch || `${process.title} ${process.description || ""} ${process.category || ""} ${process.owner?.full_name || ""}`.toLocaleLowerCase().includes(normalizedSearch))
      .sort((a, b) => (PRIORITY_ORDER[a.priority || "medium"] ?? 1) - (PRIORITY_ORDER[b.priority || "medium"] ?? 1) || a.title.localeCompare(b.title));
  }, [activeTab, categoryFilter, ownerFilter, priorityFilter, processes, search]);

  const activeProcesses = processes.filter(process => (process.status || "active") === "active");
  const updatedCount = activeProcesses.filter(process => updates.some(update => update.process_id === process.id && update.week_start === selectedWeek)).length;
  const pendingCount = Math.max(activeProcesses.length - updatedCount, 0);
  const completedCount = processes.filter(process => process.status === "completed").length;

  const handleCreateProcess = async () => {
    if (!newProcess.title.trim() || !newProcess.owner_id) {
      toast.error("Title and owner are required.");
      return;
    }
    setCreating(true);
    const { error } = await supabase.from("myntmore_processes").insert({
      title: newProcess.title.trim(),
      description: newProcess.description.trim() || null,
      category: newProcess.category.trim() || "General",
      owner_id: newProcess.owner_id,
      priority: newProcess.priority,
      status: "active",
      created_by: user?.id,
    });
    setCreating(false);
    if (error) {
      toast.error("Could not create process: " + error.message);
      return;
    }
    toast.success("Process created");
    setShowNewModal(false);
    setNewProcess(EMPTY_PROCESS);
    await fetchData();
  };

  const handleUpdateChange = (processId: string, value: string) => {
    setUpdateText(current => ({ ...current, [processId]: value }));
    setDirtyIds(current => new Set(current).add(processId));
  };

  const saveUpdate = async (processId: string, showToast = true) => {
    const text = updateText[processId]?.trim() || "";
    if (!text) {
      if (showToast) toast.error("Update text cannot be empty.");
      return false;
    }
    setSavingIds(current => new Set(current).add(processId));
    const existing = updates.find(update => update.process_id === processId && update.week_start === selectedWeek);
    const weekLabel = weekOptions.find(week => week.weekStart === selectedWeek)?.label || getWeekLabel(selectedWeek);
    const { data, error } = existing
      ? await supabase.from("process_weekly_updates").update({ update_text: text, week_label: weekLabel, submitted_by: user?.id }).eq("id", existing.id).select().single()
      : await supabase.from("process_weekly_updates").insert({ process_id: processId, week_start: selectedWeek, week_label: weekLabel, update_text: text, submitted_by: user?.id }).select().single();

    setSavingIds(current => {
      const next = new Set(current);
      next.delete(processId);
      return next;
    });
    if (error) {
      if (showToast) toast.error("Could not save update: " + error.message);
      return false;
    }
    setUpdates(current => [data as ProcessUpdate, ...current.filter(update => update.id !== data.id)]);
    setDirtyIds(current => {
      const next = new Set(current);
      next.delete(processId);
      return next;
    });
    if (showToast) toast.success("Weekly update saved");
    return true;
  };

  const handleSaveAll = async () => {
    const ids = Array.from(dirtyIds).filter(id => updateText[id]?.trim());
    if (ids.length === 0) {
      toast("No unsaved updates.");
      return;
    }
    const results = await Promise.all(ids.map(id => saveUpdate(id, false)));
    const saved = results.filter(Boolean).length;
    if (saved === ids.length) toast.success(`${saved} update${saved === 1 ? "" : "s"} saved`);
    else toast.error(`${ids.length - saved} update${ids.length - saved === 1 ? "" : "s"} could not be saved`);
  };

  const handleStatusChange = async (process: Process, status: "active" | "completed") => {
    const action = status === "completed" ? "complete" : "reopen";
    if (!window.confirm(`${action === "complete" ? "Mark" : "Reopen"} “${process.title}”${action === "complete" ? " as complete" : ""}?`)) return;
    const { error } = await supabase.from("myntmore_processes").update({
      status,
      completed_at: status === "completed" ? new Date().toISOString() : null,
      completed_by: status === "completed" ? user?.id : null,
    }).eq("id", process.id);
    if (error) {
      toast.error(`Could not ${action} process: ${error.message}`);
      return;
    }
    toast.success(status === "completed" ? "Process completed" : "Process reopened");
    await fetchData();
  };

  const handleDelete = async (process: Process) => {
    if (!window.confirm(`Permanently delete “${process.title}”?`)) return;
    const { error } = await supabase.from("myntmore_processes").delete().eq("id", process.id);
    if (error) {
      toast.error("Could not delete process: " + error.message);
      return;
    }
    toast.success("Process deleted");
    await fetchData();
  };

  const toggleExpanded = (processId: string) => {
    setExpandedIds(current => {
      const next = new Set(current);
      if (next.has(processId)) next.delete(processId);
      else next.add(processId);
      return next;
    });
  };

  return (
    <div className={`${embedded ? "p-0" : "p-6 lg:p-8"} mx-auto max-w-7xl space-y-6`}>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-gold">
            <ListChecks className="h-4 w-4" /> Operations workspace
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tight">Myntmore Processes</h1>
          <p className="mt-1 text-sm text-muted-foreground">Own the work, record weekly progress, and keep every recurring process moving.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeTab === "active" && (
            <Button variant="outline" onClick={handleSaveAll} disabled={dirtyIds.size === 0 || savingIds.size > 0} className="font-bold">
              {savingIds.size > 0 ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Save all updates {dirtyIds.size > 0 ? `(${dirtyIds.size})` : ""}
            </Button>
          )}
          {isAdmin && (
            <Button onClick={() => setShowNewModal(true)} className="bg-gold font-black text-black hover:bg-gold/90">
              <Plus className="mr-2 h-4 w-4" /> New Process
            </Button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ProcessStat label="Active processes" value={activeProcesses.length} icon={ListChecks} tone="bg-blue-50 text-blue-600" />
        <ProcessStat label="Updated this week" value={updatedCount} icon={CheckCircle2} tone="bg-emerald-50 text-emerald-600" />
        <ProcessStat label="Awaiting update" value={pendingCount} icon={Clock3} tone="bg-amber-50 text-amber-600" />
        <ProcessStat label="Completed" value={completedCount} icon={Check} tone="bg-slate-100 text-slate-600" />
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="inline-flex w-fit rounded-lg bg-muted p-1">
              <button onClick={() => setActiveTab("active")} className={`rounded-md px-4 py-2 text-xs font-black uppercase tracking-wider ${activeTab === "active" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>
                Active <span className="ml-1 opacity-60">{activeProcesses.length}</span>
              </button>
              <button onClick={() => setActiveTab("completed")} className={`rounded-md px-4 py-2 text-xs font-black uppercase tracking-wider ${activeTab === "completed" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>
                Completed <span className="ml-1 opacity-60">{completedCount}</span>
              </button>
            </div>
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search processes, owners or categories…" className="pl-9" />
            </div>
            {activeTab === "active" && (
              <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                <SelectTrigger className="w-full font-bold xl:w-[230px]"><CalendarDays className="mr-2 h-4 w-4 text-gold" /><SelectValue /></SelectTrigger>
                <SelectContent>{weekOptions.map(week => <SelectItem key={week.weekStart} value={week.weekStart}>{week.label}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger><SelectValue placeholder="All categories" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All categories</SelectItem>{categories.map(category => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={ownerFilter} onValueChange={setOwnerFilter}>
              <SelectTrigger><SelectValue placeholder="All owners" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All owners</SelectItem>{profiles.map(profile => <SelectItem key={profile.id} value={profile.id}>{profile.full_name || "Unnamed member"}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger><SelectValue placeholder="All priorities" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All priorities</SelectItem><SelectItem value="high">High priority</SelectItem><SelectItem value="medium">Medium priority</SelectItem><SelectItem value="low">Low priority</SelectItem></SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center gap-3 py-20 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin text-gold" /> Loading processes…</div>
      ) : filteredProcesses.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed py-16 text-center">
          <ListChecks className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="font-bold">No matching {activeTab} processes</p>
          <p className="mt-1 text-sm text-muted-foreground">Adjust the filters or create a new process.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {filteredProcesses.map(process => {
            const priority = process.priority || "medium";
            const processUpdates = updatesByProcess.get(process.id) || [];
            const selectedUpdate = processUpdates.find(update => update.week_start === selectedWeek);
            const latestPreviousUpdate = processUpdates.find(update => update.week_start < selectedWeek);
            const isDirty = dirtyIds.has(process.id);
            const isSaving = savingIds.has(process.id);
            const expanded = expandedIds.has(process.id);

            return (
              <Card key={process.id} className={`overflow-hidden border-border/70 shadow-sm transition-shadow hover:shadow-md ${isDirty ? "ring-1 ring-gold" : ""}`}>
                <CardContent className="p-0">
                  <div className="space-y-3 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={`text-[10px] font-black uppercase ${priorityStyles[priority] || priorityStyles.medium}`}>{priority}</Badge>
                          <Badge variant="secondary" className="text-[10px] font-bold">{process.category || "General"}</Badge>
                          {selectedUpdate && <Badge className="border-emerald-200 bg-emerald-100 text-[10px] font-bold text-emerald-700">Updated</Badge>}
                          {isDirty && <Badge className="border-amber-200 bg-amber-100 text-[10px] font-bold text-amber-700">Unsaved</Badge>}
                        </div>
                        <h2 className="text-lg font-black leading-tight">{process.title}</h2>
                      </div>
                      <button onClick={() => toggleExpanded(process.id)} aria-label={expanded ? `Collapse ${process.title}` : `Expand ${process.title}`} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground"><UserRound className="h-3.5 w-3.5" /><span>Owned by <strong className="text-foreground">{process.owner?.full_name || "Unassigned"}</strong></span></div>
                    {process.description && <p className={`text-sm leading-relaxed text-muted-foreground ${expanded ? "" : "line-clamp-2"}`}>{process.description}</p>}
                  </div>

                  {activeTab === "active" ? (
                    <div className="space-y-3 border-t bg-muted/20 p-5">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor={`update-${process.id}`} className="text-xs font-black uppercase tracking-wider">Weekly update</Label>
                        <span className="text-[10px] font-semibold text-muted-foreground">{weekOptions.find(week => week.weekStart === selectedWeek)?.label}</span>
                      </div>
                      <Textarea id={`update-${process.id}`} value={updateText[process.id] || ""} onChange={event => handleUpdateChange(process.id, event.target.value)} placeholder="What moved forward? What is blocked? What happens next?" className="min-h-[110px] resize-y bg-background" />
                      {expanded && latestPreviousUpdate && (
                        <div className="rounded-lg border bg-background p-3 text-xs">
                          <div className="mb-1 font-black uppercase tracking-wider text-muted-foreground">Previous update · {latestPreviousUpdate.week_label || getWeekLabel(latestPreviousUpdate.week_start)}</div>
                          <p className="whitespace-pre-wrap leading-relaxed">{latestPreviousUpdate.update_text}</p>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Button size="sm" onClick={() => saveUpdate(process.id)} disabled={!isDirty || !updateText[process.id]?.trim() || isSaving} className="bg-gold font-black text-black hover:bg-gold/90">
                          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />} Save update
                        </Button>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => handleStatusChange(process, "completed")} className="text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"><CheckCircle2 className="mr-1.5 h-4 w-4" /> Complete</Button>
                          {isAdmin && <Button size="icon" variant="ghost" onClick={() => handleDelete(process)} aria-label={`Delete ${process.title}`} className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-4 w-4" /></Button>}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/20 p-4">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Completed {process.completed_at ? new Date(process.completed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "previously"}</div>
                      <div className="flex gap-1"><Button size="sm" variant="outline" onClick={() => handleStatusChange(process, "active")}><ArchiveRestore className="mr-1.5 h-4 w-4" /> Reopen</Button>{isAdmin && <Button size="icon" variant="ghost" onClick={() => handleDelete(process)} aria-label={`Delete ${process.title}`} className="h-8 w-8 text-red-500"><Trash2 className="h-4 w-4" /></Button>}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showNewModal} onOpenChange={setShowNewModal}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-xl font-black"><CircleAlert className="h-5 w-5 text-gold" /> Create a Process</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5"><Label htmlFor="process-title">Process title *</Label><Input id="process-title" value={newProcess.title} onChange={event => setNewProcess(current => ({ ...current, title: event.target.value }))} placeholder="e.g. Publish the weekly newsletter" autoFocus /></div>
            <div className="grid gap-1.5"><Label htmlFor="process-description">Definition and outcome</Label><Textarea id="process-description" value={newProcess.description} onChange={event => setNewProcess(current => ({ ...current, description: event.target.value }))} placeholder="Describe what done looks like, key steps, and expected outcome." className="min-h-[100px]" /></div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5"><Label htmlFor="process-category">Category</Label><Input id="process-category" value={newProcess.category} onChange={event => setNewProcess(current => ({ ...current, category: event.target.value }))} placeholder="Operations" /></div>
              <div className="grid gap-1.5"><Label>Priority</Label><Select value={newProcess.priority} onValueChange={priority => setNewProcess(current => ({ ...current, priority }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="high">High</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem></SelectContent></Select></div>
            </div>
            <div className="grid gap-1.5"><Label>Owner *</Label><Select value={newProcess.owner_id} onValueChange={owner_id => setNewProcess(current => ({ ...current, owner_id }))}><SelectTrigger><SelectValue placeholder="Select an owner" /></SelectTrigger><SelectContent>{profiles.map(profile => <SelectItem key={profile.id} value={profile.id}>{profile.full_name || "Unnamed member"}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowNewModal(false)}>Cancel</Button><Button onClick={handleCreateProcess} disabled={creating} className="bg-gold font-black text-black hover:bg-gold/90">{creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create Process</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
