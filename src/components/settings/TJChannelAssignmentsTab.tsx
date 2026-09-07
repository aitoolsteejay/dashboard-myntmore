import React, { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Loader2, Plus, Archive } from 'lucide-react'
import { sortAlphabetically } from '@/utils/sort'
import type { Database } from '@/integrations/supabase/types'

type TjCustomMetricRow = Database['myntmore']['Tables']['tj_custom_metrics']['Row']
type TjCustomMetricInsert = Database['myntmore']['Tables']['tj_custom_metrics']['Insert']
type TjMetricType = 'number' | 'percentage' | 'textarea'

const CHANNELS = [
  { key: 'instagram',           label: 'Instagram',            icon: '📱' },
  { key: 'youtube',             label: 'YouTube',              icon: '▶️' },
  { key: 'email_newsletter',    label: 'Email Newsletter',     icon: '✉️' },
  { key: 'video_pipeline',      label: 'Video Pipeline',       icon: '🎬' },
]

const NEW_METRIC_DEFAULTS = { name: '', type: 'number' as TjMetricType, unit: '', hasTarget: false }

export function TJChannelAssignmentsTab() {
  const { user } = useAuth()
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [team, setTeam] = useState<{ id: string; full_name: string | null }[]>([])
  const [loading, setLoading] = useState(true)
  const [savingChannel, setSavingChannel] = useState<string | null>(null)

  const [customMetrics, setCustomMetrics] = useState<TjCustomMetricRow[]>([])
  const [addDialogChannel, setAddDialogChannel] = useState<string | null>(null)
  const [newMetric, setNewMetric] = useState(NEW_METRIC_DEFAULTS)
  const [savingNewMetric, setSavingNewMetric] = useState(false)

  const loadCustomMetrics = async () => {
    const { data } = await supabase
      .from('tj_custom_metrics')
      .select('*')
      .eq('archived', false)
      .order('sort_order', { ascending: true })
    setCustomMetrics(data ?? [])
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)

      // Fetch assignments
      const { data: assignmentsData } = await supabase
        .from('tj_channel_assignments')
        .select('channel, owner_id')

      const assignmentMap: Record<string, string> = {}
      assignmentsData?.forEach(a => {
        assignmentMap[a.channel] = a.owner_id ?? ''
      })
      setAssignments(assignmentMap)

      // Fetch team members
      const { data: teamData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .order('full_name')

      if (teamData) {
        setTeam(sortAlphabetically(teamData, member => member.full_name))
      }

      await loadCustomMetrics()

      setLoading(false)
    }

    loadData()
  }, [])

  const handleOwnerChange = (channelKey: string, ownerId: string) => {
    setAssignments(prev => ({ ...prev, [channelKey]: ownerId === 'unassigned' ? '' : ownerId }))
  }

  const saveAssignment = async (channel: string) => {
    if (!user) return
    setSavingChannel(channel)

    const ownerId = assignments[channel]

    const { error } = await supabase
      .from('tj_channel_assignments')
      .upsert({
        channel,
        owner_id: ownerId || null,
        updated_by: user.id,
        updated_at: new Date().toISOString()
      }, { onConflict: 'channel' })

    if (error) {
      toast.error('Failed to save assignment.')
      console.error(error)
    } else {
      toast.success('Assignment saved.')
    }

    setSavingChannel(null)
  }

  const handleAddCustomMetric = async () => {
    if (!addDialogChannel || !newMetric.name.trim()) return
    setSavingNewMetric(true)
    try {
      const insert: TjCustomMetricInsert = {
        channel: addDialogChannel,
        name: newMetric.name.trim(),
        type: newMetric.type,
        unit: newMetric.unit.trim() || null,
        has_target: newMetric.type === 'textarea' ? false : newMetric.hasTarget,
        created_by: user?.id,
      }
      const { data, error } = await supabase.from('tj_custom_metrics').insert(insert).select('*').single()
      if (error) throw error

      setCustomMetrics(prev => [...prev, data as TjCustomMetricRow])
      toast.success(`"${insert.name}" added to ${CHANNELS.find(c => c.key === addDialogChannel)?.label}`)
      setNewMetric(NEW_METRIC_DEFAULTS)
      setAddDialogChannel(null)
    } catch (error: any) {
      toast.error('Failed to add custom metric: ' + error.message)
    } finally {
      setSavingNewMetric(false)
    }
  }

  const handleArchiveCustomMetric = async (metric: TjCustomMetricRow) => {
    if (!confirm(`Archive "${metric.name}"? Past data stays intact, but it will disappear from data entry, the dashboard, targets, and exports.`)) return
    const { error } = await supabase.from('tj_custom_metrics').update({ archived: true }).eq('id', metric.id)
    if (error) {
      toast.error('Failed to archive: ' + error.message)
      return
    }
    setCustomMetrics(prev => prev.filter(m => m.id !== metric.id))
    toast.success(`"${metric.name}" archived`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-sm font-black tracking-widest uppercase">TJ Personal Brand - Channel Assignments</h3>
        <p className="text-sm text-muted-foreground">
          Assign a team member responsible for each channel. They will be shown as the owner in Monday Mode and the TJ Personal Brand page.
        </p>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="font-bold">Channel</TableHead>
              <TableHead className="font-bold w-[300px]">Assigned To</TableHead>
              <TableHead className="font-bold text-right w-[150px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {CHANNELS.map(ch => (
              <TableRow key={ch.key}>
                <TableCell>
                  <div className="flex items-center gap-2 font-medium">
                    <span>{ch.icon}</span>
                    <span>{ch.label}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Select
                    value={assignments[ch.key] || 'unassigned'}
                    onValueChange={(val) => handleOwnerChange(ch.key, val)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select team member" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">
                        <span className="text-muted-foreground italic">Unassigned</span>
                      </SelectItem>
                      {team.map(member => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.full_name || 'Unnamed team member'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => saveAssignment(ch.key)}
                    disabled={savingChannel === ch.key}
                  >
                    {savingChannel === ch.key ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-1">
        <h3 className="text-sm font-black tracking-widest uppercase">Custom Metrics</h3>
        <p className="text-sm text-muted-foreground">
          Add a field specific to TJ Personal Brand — it will show up in data entry, the dashboard, targets, and exports with no code change.
        </p>
      </div>

      <div className="space-y-4">
        {CHANNELS.map(ch => {
          const channelMetrics = customMetrics.filter(m => m.channel === ch.key)
          return (
            <div key={ch.key} className="rounded-xl border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <span>{ch.icon}</span>
                  <span>{ch.label}</span>
                </div>
                <Dialog
                  open={addDialogChannel === ch.key}
                  onOpenChange={(open) => { setAddDialogChannel(open ? ch.key : null); if (!open) setNewMetric(NEW_METRIC_DEFAULTS) }}
                >
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-1.5">
                      <Plus className="w-3.5 h-3.5" /> Add Custom Metric
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add a custom metric for {ch.label}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                      <div className="space-y-1.5">
                        <Label>Name</Label>
                        <Input
                          value={newMetric.name}
                          onChange={(e) => setNewMetric(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="e.g. Trial Reel Count"
                          autoFocus
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>Type</Label>
                          <Select
                            value={newMetric.type}
                            onValueChange={(value: TjMetricType) => setNewMetric(prev => ({ ...prev, type: value, hasTarget: value === 'textarea' ? false : prev.hasTarget }))}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="number">Number</SelectItem>
                              <SelectItem value="percentage">Percentage</SelectItem>
                              <SelectItem value="textarea">Text note</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Unit (optional)</Label>
                          <Input
                            value={newMetric.unit}
                            onChange={(e) => setNewMetric(prev => ({ ...prev, unit: e.target.value }))}
                            placeholder="e.g. hrs"
                          />
                        </div>
                      </div>
                      {newMetric.type !== 'textarea' && (
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={newMetric.hasTarget}
                            onCheckedChange={(checked) => setNewMetric(prev => ({ ...prev, hasTarget: checked === true }))}
                          />
                          Supports weekly/monthly targets
                        </label>
                      )}
                    </div>
                    <DialogFooter>
                      <Button onClick={handleAddCustomMetric} disabled={savingNewMetric || !newMetric.name.trim()}>
                        {savingNewMetric ? 'Adding…' : 'Add Metric'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              {channelMetrics.length === 0 ? (
                <div className="px-4 py-4 text-sm text-muted-foreground italic">No custom metrics yet.</div>
              ) : (
                <div className="divide-y">
                  {channelMetrics.map(m => (
                    <div key={m.id} className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{m.name}</span>
                        <Badge variant="outline" className="text-[10px] font-mono px-1 py-0">{m.metric_key}</Badge>
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">{m.type}</Badge>
                        {m.has_target && <Badge className="text-[10px] px-1 py-0 bg-gold/20 text-gold-900 border-gold/40">Target</Badge>}
                      </div>
                      <button
                        title="Archive this custom metric"
                        onClick={() => handleArchiveCustomMetric(m)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
