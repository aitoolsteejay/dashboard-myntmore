import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Clock3,
  Edit2,
  GripVertical,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  Search,
  Trash2,
  UserRound,
  UsersRound,
} from "lucide-react";
import { DndContext, DragEndEvent, KeyboardSensor, PointerSensor, closestCorners, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/integrations/supabase/client";
import { sortAlphabetically } from "@/utils/sort";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BackButton } from "@/components/ui/BackButton";
import { getCurrentWeekStart } from "@/utils/weekUtils";
import type { Actionable, Client, Profile } from "@/types";

type ActionableRow = Actionable & {
  is_carried_forward: boolean;
  clients?: { name: string; company: string | null } | null;
  assignee?: { full_name: string | null } | null;
};
type ClientSummary = Pick<Client, "id" | "name">;
type ProfileSummary = Pick<Profile, "id" | "full_name">;
type FormState = { title: string; client_id: string; assignee_id: string; due_date: string; description: string; status: string };

const EMPTY_FORM: FormState = { title: "", client_id: "", assignee_id: "", due_date: "", description: "", status: "open" };

const COLUMNS = [
  { id: "open", title: "Open", description: "Ready to be picked up", color: "bg-blue-500", soft: "bg-blue-50 text-blue-700", icon: CircleDot },
  { id: "in_progress", title: "In Progress", description: "Actively being worked on", color: "bg-amber-400", soft: "bg-amber-50 text-amber-700", icon: Clock3 },
  { id: "done", title: "Done", description: "Completed work", color: "bg-emerald-500", soft: "bg-emerald-50 text-emerald-700", icon: CheckCircle2 },
  { id: "carried_forward", title: "Carried Forward", description: "Moved from an earlier week", color: "bg-orange-500", soft: "bg-orange-50 text-orange-700", icon: AlertTriangle },
] as const;

function formatDate(value: string | null) {
  if (!value) return "No due date";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function isOverdue(actionable: ActionableRow) {
  return Boolean(actionable.due_date && actionable.status !== "done" && actionable.due_date < new Date().toISOString().slice(0, 10));
}

function statusForColumn(actionable: ActionableRow) {
  return actionable.is_carried_forward ? "carried_forward" : actionable.status || "open";
}

function SummaryCard({ label, value, icon: Icon, className }: { label: string; value: number; icon: typeof CircleDot; className: string }) {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", className)}><Icon className="h-5 w-5" /></div>
        <div><div className="text-2xl font-black leading-none">{value}</div><div className="mt-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</div></div>
      </CardContent>
    </Card>
  );
}

function SortableActionableCard({ actionable, expanded, onToggle, onEdit, onDelete }: {
  actionable: ActionableRow;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: actionable.id });
  const overdue = isOverdue(actionable);
  return (
    <Card ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.55 : 1 }} className={cn("group border-border/70 bg-background shadow-sm transition-shadow hover:shadow-md", actionable.is_carried_forward && "border-l-4 border-l-orange-500")}>
      <CardContent className="p-0">
        <div className="flex items-start gap-2 p-3.5">
          <button type="button" {...attributes} {...listeners} aria-label={`Drag ${actionable.title}`} className="mt-0.5 cursor-grab rounded p-1 text-muted-foreground/50 hover:bg-muted hover:text-muted-foreground active:cursor-grabbing"><GripVertical className="h-4 w-4" /></button>
          <button type="button" onClick={onToggle} aria-expanded={expanded} className="min-w-0 flex-1 text-left">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-black leading-snug">{actionable.title}</h4>
              <ChevronDown className={cn("mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant="outline" className="max-w-full truncate text-[9px] font-bold">{actionable.clients?.name || "Internal"}</Badge>
              {overdue && <Badge className="border-red-200 bg-red-50 text-[9px] font-black text-red-700">Overdue</Badge>}
              {actionable.is_carried_forward && <Badge className="border-orange-200 bg-orange-50 text-[9px] font-black text-orange-700">Carried</Badge>}
            </div>
            <div className="mt-3 grid gap-1.5 text-[11px] font-medium text-muted-foreground">
              <span className="flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" />{actionable.assignee?.full_name || "Unassigned"}</span>
              <span className={cn("flex items-center gap-1.5", overdue && "font-bold text-red-600")}><CalendarDays className="h-3.5 w-3.5" />{formatDate(actionable.due_date)}</span>
            </div>
          </button>
        </div>
        {expanded && (
          <div className="space-y-3 border-t bg-muted/20 p-3.5">
            <div><div className="mb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Notes</div><p className="whitespace-pre-wrap text-xs leading-relaxed">{actionable.description || "No additional notes."}</p></div>
            <div className="flex items-center justify-between gap-2 border-t pt-2">
              <span className="text-[10px] font-medium text-muted-foreground">Week {actionable.week_start ? formatDate(actionable.week_start) : "not set"}</span>
              <div className="flex gap-1"><Button variant="ghost" size="sm" onClick={onEdit} className="h-7 px-2 text-xs"><Edit2 className="mr-1 h-3 w-3" />Edit</Button><Button variant="ghost" size="icon" onClick={onDelete} aria-label={`Delete ${actionable.title}`} className="h-7 w-7 text-red-500 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /></Button></div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BoardColumn({ column, items, expandedIds, onToggle, onEdit, onDelete }: {
  column: typeof COLUMNS[number];
  items: ActionableRow[];
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onEdit: (actionable: ActionableRow) => void;
  onDelete: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const Icon = column.icon;
  return (
    <div ref={setNodeRef} className={cn("flex min-h-[380px] flex-col rounded-xl border bg-muted/20 transition-colors", isOver && "border-gold bg-gold/5 ring-1 ring-gold")}>
      <div className="rounded-t-xl border-b bg-background/80 p-4">
        <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><div className={cn("flex h-7 w-7 items-center justify-center rounded-lg", column.soft)}><Icon className="h-4 w-4" /></div><h3 className="text-xs font-black uppercase tracking-widest">{column.title}</h3></div><Badge variant="secondary" className="font-black">{items.length}</Badge></div>
        <p className="mt-1 pl-9 text-[10px] text-muted-foreground">{column.description}</p>
      </div>
      <SortableContext items={items.map(item => item.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 space-y-3 p-3">
          {items.map(item => <SortableActionableCard key={item.id} actionable={item} expanded={expandedIds.has(item.id)} onToggle={() => onToggle(item.id)} onEdit={() => onEdit(item)} onDelete={() => onDelete(item.id)} />)}
          {items.length === 0 && <div className="flex min-h-[150px] flex-col items-center justify-center rounded-lg border border-dashed bg-background/40 px-4 text-center"><Icon className="mb-2 h-6 w-6 text-muted-foreground/30" /><p className="text-xs font-bold text-muted-foreground">No tasks here</p><p className="mt-1 text-[10px] text-muted-foreground/70">Drag a task into this column</p></div>}
        </div>
      </SortableContext>
    </div>
  );
}

export function ActionablesPage() {
  const { user } = useAuth();
  const [scope, setScope] = useState<"mine" | "team">("mine");
  const [view, setView] = useState<"board" | "list">("board");
  const [actionables, setActionables] = useState<ActionableRow[]>([]);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterClient, setFilterClient] = useState("all");
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingActionable, setEditingActionable] = useState<ActionableRow | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const currentWeekStart = useMemo(() => getCurrentWeekStart(), []);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const fetchData = async () => {
    setLoading(true);
    try {
      const [{ data: actionsData, error: actionsError }, { data: clientsData, error: clientsError }, { data: profilesData, error: profilesError }] = await Promise.all([
        supabase.from("actionables").select("*, clients(name, company), assignee:profiles!assignee_id(full_name), assigner:profiles!assigner_id(full_name)").order("created_at", { ascending: false }),
        supabase.from("clients").select("id, name").eq("status", "active"),
        supabase.from("profiles").select("id, full_name, department"),
      ]);
      if (actionsError) throw actionsError;
      if (clientsError) throw clientsError;
      if (profilesError) throw profilesError;
      setActionables((actionsData || []).map(actionable => ({ ...actionable, is_carried_forward: actionable.status === "carried_forward" || (actionable.status === "open" && Boolean(actionable.week_start) && actionable.week_start! < currentWeekStart) })) as ActionableRow[]);
      setClients(sortAlphabetically(clientsData || [], client => client.name));
      setProfiles(sortAlphabetically((profilesData || []).filter(profile => profile.department !== "client"), profile => profile.full_name));
    } catch (error: any) {
      toast.error("Could not load actionables: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [currentWeekStart]);

  const scopedActionables = useMemo(
    () => scope === "mine" ? actionables.filter(actionable => actionable.assignee_id === user?.id) : actionables,
    [actionables, scope, user?.id],
  );

  const filteredActionables = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return scopedActionables.filter(actionable => {
      const matchesSearch = !query || `${actionable.title} ${actionable.description || ""} ${actionable.clients?.name || "Internal"} ${actionable.assignee?.full_name || ""}`.toLocaleLowerCase().includes(query);
      return matchesSearch && (filterClient === "all" || actionable.client_id === filterClient) && (filterAssignee === "all" || actionable.assignee_id === filterAssignee) && (filterStatus === "all" || statusForColumn(actionable) === filterStatus);
    });
  }, [filterAssignee, filterClient, filterStatus, scopedActionables, search]);

  const itemsByColumn = useMemo(() => Object.fromEntries(COLUMNS.map(column => [column.id, filteredActionables.filter(actionable => statusForColumn(actionable) === column.id)])) as Record<string, ActionableRow[]>, [filteredActionables]);
  const openCount = scopedActionables.filter(actionable => statusForColumn(actionable) === "open").length;
  const progressCount = scopedActionables.filter(actionable => statusForColumn(actionable) === "in_progress").length;
  const overdueCount = scopedActionables.filter(isOverdue).length;
  const doneCount = scopedActionables.filter(actionable => statusForColumn(actionable) === "done").length;

  const openCreate = () => { setEditingActionable(null); setForm({ ...EMPTY_FORM, assignee_id: scope === "mine" ? user?.id || "" : "" }); setIsModalOpen(true); };
  const changeScope = (nextScope: "mine" | "team") => { setScope(nextScope); setFilterAssignee("all"); };
  const openEdit = (actionable: ActionableRow) => { setEditingActionable(actionable); setForm({ title: actionable.title, client_id: actionable.client_id || "", assignee_id: actionable.assignee_id || "", due_date: actionable.due_date || "", description: actionable.description || "", status: statusForColumn(actionable) }); setIsModalOpen(true); };
  const toggleExpanded = (id: string) => setExpandedIds(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const overItem = actionables.find(item => item.id === overId);
    const targetStatus = COLUMNS.some(column => column.id === overId)
      ? overId
      : overItem
        ? statusForColumn(overItem)
        : null;
    const activeItem = actionables.find(item => item.id === activeId);
    if (!activeItem || !targetStatus || statusForColumn(activeItem) === targetStatus) return;
    const update = { status: targetStatus, ...(targetStatus === "open" ? { week_start: currentWeekStart } : {}) };
    const previous = actionables;
    setActionables(current => current.map(item => item.id === activeId ? { ...item, ...update, is_carried_forward: targetStatus === "carried_forward" } : item));
    const { error } = await supabase.from("actionables").update(update).eq("id", activeId);
    if (error) { setActionables(previous); toast.error("Could not move task: " + error.message); return; }
    toast.success(`Moved to ${COLUMNS.find(column => column.id === targetStatus)?.title}`);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.assignee_id) { toast.error("Title and assignee are required."); return; }
    setSaving(true);
    const payload = { ...form, title: form.title.trim(), client_id: form.client_id || null, due_date: form.due_date || null, description: form.description.trim() || null, assigner_id: editingActionable?.assigner_id || user?.id, week_start: editingActionable?.week_start || currentWeekStart };
    const { error } = editingActionable ? await supabase.from("actionables").update(payload).eq("id", editingActionable.id) : await supabase.from("actionables").insert(payload);
    setSaving(false);
    if (error) { toast.error("Could not save actionable: " + error.message); return; }
    toast.success(editingActionable ? "Actionable updated" : "Actionable created");
    setIsModalOpen(false);
    await fetchData();
  };

  const handleDelete = async (id: string) => {
    const actionable = actionables.find(item => item.id === id);
    if (!window.confirm(`Delete “${actionable?.title || "this actionable"}”?`)) return;
    const { error } = await supabase.from("actionables").delete().eq("id", id);
    if (error) { toast.error("Could not delete actionable: " + error.message); return; }
    setActionables(current => current.filter(item => item.id !== id));
    toast.success("Actionable deleted");
  };

  return (
    <div className="mx-auto max-w-[1700px] space-y-6 p-6 lg:p-8">
      <BackButton to="/dashboard" label="Back to Dashboard" />
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-gold"><CheckCircle2 className="h-4 w-4" />Execution workspace</div><h1 className="text-3xl font-black tracking-tight">Actionables</h1><p className="mt-1 text-sm text-muted-foreground">Plan, assign and move client work forward from one place.</p></div>
        <div className="flex flex-wrap gap-2"><div className="flex rounded-lg bg-muted p-1"><Button variant={view === "board" ? "secondary" : "ghost"} size="sm" onClick={() => setView("board")} className="h-8"><LayoutGrid className="mr-2 h-4 w-4" />Board</Button><Button variant={view === "list" ? "secondary" : "ghost"} size="sm" onClick={() => setView("list")} className="h-8"><List className="mr-2 h-4 w-4" />List</Button></div><Button onClick={openCreate} className="bg-gold font-black text-black hover:bg-gold/90"><Plus className="mr-2 h-4 w-4" />Add Actionable</Button></div>
      </header>

      <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/20 p-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-xl border bg-background p-1.5 shadow-sm">
          <Button variant="ghost" aria-pressed={scope === "mine"} onClick={() => changeScope("mine")} className={cn("flex-1 border border-transparent font-bold transition-all sm:min-w-44", scope === "mine" ? "border-gold bg-gold text-black shadow-md hover:bg-gold/90 hover:text-black" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><UserRound className="mr-2 h-4 w-4" />My Tasks{scope === "mine" && <CheckCircle2 className="ml-2 h-4 w-4" />}</Button>
          <Button variant="ghost" aria-pressed={scope === "team"} onClick={() => changeScope("team")} className={cn("flex-1 border border-transparent font-bold transition-all sm:min-w-44", scope === "team" ? "border-gold bg-gold text-black shadow-md hover:bg-gold/90 hover:text-black" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><UsersRound className="mr-2 h-4 w-4" />Team Tasks{scope === "team" && <CheckCircle2 className="ml-2 h-4 w-4" />}</Button>
        </div>
        <p className="px-2 text-xs font-medium text-muted-foreground">{scope === "mine" ? "Your personal queue — tasks assigned to you." : "The complete execution board across all team members."}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><SummaryCard label="Open" value={openCount} icon={CircleDot} className="bg-blue-50 text-blue-600" /><SummaryCard label="In progress" value={progressCount} icon={Clock3} className="bg-amber-50 text-amber-600" /><SummaryCard label="Overdue" value={overdueCount} icon={AlertTriangle} className="bg-red-50 text-red-600" /><SummaryCard label="Completed" value={doneCount} icon={CheckCircle2} className="bg-emerald-50 text-emerald-600" /></div>

      <Card className="border-border/60 shadow-sm"><CardContent className={cn("grid gap-3 p-4", scope === "team" ? "lg:grid-cols-[minmax(280px,1fr)_220px_220px_190px]" : "lg:grid-cols-[minmax(280px,1fr)_220px_190px]")}><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search title, notes, client or assignee…" className="pl-9" value={search} onChange={event => setSearch(event.target.value)} /></div><Select value={filterClient} onValueChange={setFilterClient}><SelectTrigger><SelectValue placeholder="All Clients" /></SelectTrigger><SelectContent><SelectItem value="all">All clients</SelectItem>{clients.map(client => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent></Select>{scope === "team" && <Select value={filterAssignee} onValueChange={setFilterAssignee}><SelectTrigger><SelectValue placeholder="All Assignees" /></SelectTrigger><SelectContent><SelectItem value="all">All assignees</SelectItem>{profiles.map(profile => <SelectItem key={profile.id} value={profile.id}>{profile.full_name || "Unnamed member"}</SelectItem>)}</SelectContent></Select>}<Select value={filterStatus} onValueChange={setFilterStatus}><SelectTrigger><SelectValue placeholder="All Statuses" /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{COLUMNS.map(column => <SelectItem key={column.id} value={column.id}>{column.title}</SelectItem>)}</SelectContent></Select></CardContent></Card>

      {loading ? <div className="flex items-center justify-center gap-3 py-24 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin text-gold" />Loading actionables…</div> : view === "board" ? (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}><div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">{COLUMNS.map(column => <BoardColumn key={column.id} column={column} items={itemsByColumn[column.id] || []} expandedIds={expandedIds} onToggle={toggleExpanded} onEdit={openEdit} onDelete={handleDelete} />)}</div></DndContext>
      ) : (
        <Card className="overflow-hidden"><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Actionable</TableHead><TableHead>Client</TableHead><TableHead>Assignee</TableHead><TableHead>Due date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{filteredActionables.map(actionable => { const status = statusForColumn(actionable); const column = COLUMNS.find(item => item.id === status); return <TableRow key={actionable.id}><TableCell><div className="font-bold">{actionable.title}</div>{actionable.description && <div className="mt-1 max-w-md truncate text-xs text-muted-foreground">{actionable.description}</div>}</TableCell><TableCell>{actionable.clients?.name || "Internal"}</TableCell><TableCell>{actionable.assignee?.full_name || "Unassigned"}</TableCell><TableCell className={cn(isOverdue(actionable) && "font-bold text-red-600")}>{formatDate(actionable.due_date)}</TableCell><TableCell><Badge className={cn("border-0", column?.soft)}>{column?.title || status}</Badge></TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => openEdit(actionable)} aria-label={`Edit ${actionable.title}`}><Edit2 className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => handleDelete(actionable.id)} aria-label={`Delete ${actionable.title}`} className="text-red-500"><Trash2 className="h-4 w-4" /></Button></TableCell></TableRow>; })}{filteredActionables.length === 0 && <TableRow><TableCell colSpan={6} className="py-16 text-center text-muted-foreground">No actionables match these filters.</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}><DialogContent className="sm:max-w-[560px]"><DialogHeader><DialogTitle className="text-xl font-black">{editingActionable ? "Edit Actionable" : "Create an Actionable"}</DialogTitle></DialogHeader><div className="grid gap-4 py-2"><div className="grid gap-1.5"><Label htmlFor="actionable-title">Title *</Label><Input id="actionable-title" value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} placeholder="What needs to get done?" autoFocus /></div><div className="grid gap-1.5"><Label htmlFor="actionable-notes">Context and expected outcome</Label><Textarea id="actionable-notes" value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} placeholder="Add the context, deliverable or next step." className="min-h-[100px]" /></div><div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-1.5"><Label>Client</Label><Select value={form.client_id || "none"} onValueChange={value => setForm(current => ({ ...current, client_id: value === "none" ? "" : value }))}><SelectTrigger><SelectValue placeholder="Internal" /></SelectTrigger><SelectContent><SelectItem value="none">Internal</SelectItem>{clients.map(client => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-1.5"><Label>Assignee *</Label><Select value={form.assignee_id} onValueChange={assignee_id => setForm(current => ({ ...current, assignee_id }))}><SelectTrigger><SelectValue placeholder="Select a member" /></SelectTrigger><SelectContent>{profiles.map(profile => <SelectItem key={profile.id} value={profile.id}>{profile.full_name || "Unnamed member"}</SelectItem>)}</SelectContent></Select></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-1.5"><Label htmlFor="actionable-due">Due date</Label><Input id="actionable-due" type="date" value={form.due_date} onChange={event => setForm(current => ({ ...current, due_date: event.target.value }))} /></div><div className="grid gap-1.5"><Label>Status</Label><Select value={form.status} onValueChange={status => setForm(current => ({ ...current, status }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{COLUMNS.map(column => <SelectItem key={column.id} value={column.id}>{column.title}</SelectItem>)}</SelectContent></Select></div></div></div><DialogFooter><Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button><Button onClick={handleSave} disabled={saving} className="bg-gold font-black text-black hover:bg-gold/90">{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingActionable ? "Save Changes" : "Create Actionable"}</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
