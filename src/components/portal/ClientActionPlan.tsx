import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, Clock3, Loader2, MessageSquareText, Users } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { assertClientRows } from '@/utils/clientScope'

type ClientActionPlanProps = { clientId: string; canManageInternally: boolean }

const statusLabels: Record<string, string> = { open: 'Open', in_progress: 'In Progress', done: 'Done', carried_forward: 'Carried Forward' }
const clientStatus = (status: string | null) => ['open', 'in_progress', 'done'].includes(status || '') ? status! : 'open'
const formatDate = (date: string | null) => date ? new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'No due date'

export function ClientActionPlan({ clientId, canManageInternally }: ClientActionPlanProps) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, { status: string; comment: string }>>({})

  const loadActions = async () => {
    setLoading(true)
    const { data, error } = await (supabase as any).from('actionables')
      .select('id, client_id, title, description, due_date, status, responsibility, client_comment, client_updated_at, campaign_id, campaigns(name)')
      .eq('client_id', clientId)
      .eq('client_visible', true)
      .order('due_date', { ascending: true, nullsFirst: false })
    if (error) toast.error('Could not load the action plan: ' + error.message)
    let next: any[] = []
    try {
      next = assertClientRows(data, clientId, 'client action plan')
    } catch (scopeError: any) {
      toast.error(scopeError.message)
    }
    setItems(next)
    setDrafts(Object.fromEntries(next.map((item: any) => [item.id, { status: clientStatus(item.status), comment: item.client_comment || '' }])))
    setLoading(false)
  }

  useEffect(() => { void loadActions() }, [clientId])

  const grouped = useMemo(() => ({
    myntmore: items.filter(item => item.responsibility !== 'client'),
    client: items.filter(item => item.responsibility === 'client'),
  }), [items])

  const saveClientUpdate = async (item: any) => {
    const draft = drafts[item.id]
    if (!draft) return
    setSavingId(item.id)
    const result = canManageInternally
      ? await (supabase as any).from('actionables').update({ status: draft.status, client_comment: draft.comment.trim() || null, client_updated_at: new Date().toISOString() }).eq('id', item.id).eq('client_id', clientId).eq('client_visible', true).eq('responsibility', 'client')
      : await (supabase as any).rpc('client_update_actionable', { target_actionable_id: item.id, next_status: draft.status, next_comment: draft.comment })
    setSavingId(null)
    if (result.error) { toast.error('Could not update the action: ' + result.error.message); return }
    toast.success('Action updated')
    await loadActions()
  }

  if (loading) return <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin text-gold" />Loading action plan…</div>

  const renderGroup = (responsibility: 'myntmore' | 'client', title: string, description: string) => {
    const groupItems = grouped[responsibility]
    return <section className="space-y-3"><div><h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider"><Users className="h-4 w-4 text-gold" />{title}</h2><p className="mt-1 text-xs text-muted-foreground">{description}</p></div>{groupItems.length ? <div className="grid gap-3">{groupItems.map(item => {
      const draft = drafts[item.id] || { status: clientStatus(item.status), comment: item.client_comment || '' }
      const overdue = item.due_date && item.status !== 'done' && item.due_date < new Date().toISOString().slice(0, 10)
      return <Card key={item.id} className={cn('shadow-sm', overdue && 'border-red-200')}><CardContent className="p-5"><div className="flex flex-col justify-between gap-4 md:flex-row md:items-start"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-black">{item.title}</h3><Badge variant="outline">{statusLabels[item.status] || item.status}</Badge>{overdue && <Badge className="bg-red-50 text-red-700">Overdue</Badge>}</div>{item.description && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{item.description}</p>}<div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatDate(item.due_date)}</span>{item.campaigns?.name && <span>Campaign: <strong>{item.campaigns.name}</strong></span>}</div></div>{responsibility === 'myntmore' && <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">{item.status === 'done' ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Clock3 className="h-4 w-4 text-gold" />}{statusLabels[item.status] || 'Open'}</div>}</div>{responsibility === 'client' && <div className="mt-4 grid gap-3 border-t pt-4 md:grid-cols-[190px_1fr_auto] md:items-end"><div><p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</p><Select value={draft.status} onValueChange={status => setDrafts(current => ({ ...current, [item.id]: { ...draft, status } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">Open</SelectItem><SelectItem value="in_progress">In Progress</SelectItem><SelectItem value="done">Done</SelectItem></SelectContent></Select></div><div><p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Your update</p><Textarea value={draft.comment} onChange={event => setDrafts(current => ({ ...current, [item.id]: { ...draft, comment: event.target.value } }))} placeholder="Add a note or update…" className="min-h-10" /></div><Button onClick={() => saveClientUpdate(item)} disabled={savingId === item.id} className="bg-gold font-black text-black hover:bg-gold/90">{savingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Update'}</Button></div>}</CardContent></Card>
    })}</div> : <div className="rounded-xl border border-dashed bg-white py-10 text-center text-sm text-muted-foreground"><CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-green-500" />No actions currently assigned.</div>}</section>
  }

  return <div className="space-y-8">{renderGroup('client', 'Your Actions', 'Items that need input or completion from your team.')}{renderGroup('myntmore', 'Myntmore Actions', 'Work currently owned by the Myntmore team.')}{items.length === 0 && <Card><CardContent className="flex flex-col items-center py-16 text-center"><MessageSquareText className="mb-3 h-8 w-8 text-gold" /><p className="font-black">Your action plan is clear</p><p className="mt-1 text-sm text-muted-foreground">New client-visible actions will appear here.</p></CardContent></Card>}</div>
}
