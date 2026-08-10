import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/lib/auth"
import { ALL_METRICS, CONTENT_METRICS, LEADGEN_METRICS, Metric } from "@/data/metrics"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { toast } from "sonner"
import { Check, Save, Loader2, ArrowLeft, ChevronRight, MessageSquare, Pin, ScrollText, History, Target, Trophy } from "lucide-react"
import { Label } from "@/components/ui/label"
import { useNavigate } from '@tanstack/react-router'
import { updateClientHealth } from '@/lib/health'
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { MetricCard } from "@/components/MetricCard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { BackButton } from "@/components/ui/BackButton"
import { getWeekEnd, getWeekLabel, getWeekOptions, isLastWeekOfMonth } from "@/utils/weekUtils"
import { readMetric, formatMetricValue } from "@/utils/dataUtils"
import { detectAndUpdateHighScores } from '@/utils/highScores'
import { formatWeekDate } from '@/utils/dateUtils'
import { syncAllCampaignTotals } from '@/utils/campaignSync'
import { calcRateCapped, fmtRate } from '@/utils/readMetric'
import { SaveIndicator } from '../ui/SaveIndicator'
import { useAutoSave, SaveStatus } from '../../hooks/useAutoSave'
import { EditCampaignModal } from '../monday/EditCampaignModal'
import type { WeeklyData, HighScore, MetricTarget, Campaign, CampaignWeeklyData, ContextNoteWithAuthor, ClientSettings } from '@/types'
import { sortAlphabetically } from '@/utils/sort'
import { useWorkspace } from '@/lib/workspace'
import { parseWaalaxyExport, type WaalaxyImportSummary } from '@/utils/waalaxyImport'

type ClientSummary = { id: string; name: string; company: string | null }

function CampaignWaalaxyImport({
  campaignId,
  weekStart,
  onImported,
}: {
  campaignId: string
  weekStart: string
  onImported: (summary: WaalaxyImportSummary) => void
}) {
  const [summary, setSummary] = useState<WaalaxyImportSummary | null>(null)
  const weekEnd = getWeekEnd(weekStart)
  const inputId = `waalaxy-import-${campaignId}-${weekStart}`

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const imported = parseWaalaxyExport(await file.text(), weekStart, weekEnd)
      onImported(imported)
      setSummary(imported)
      toast.success(`Waalaxy CSV imported for ${weekStart} to ${weekEnd}. Autosaving campaign data…`)
    } catch (error) {
      setSummary(null)
      toast.error(error instanceof Error ? error.message : 'Could not import the Waalaxy CSV.')
    } finally {
      event.target.value = ''
    }
  }

  return (
    <div className="rounded-lg border border-gold/35 bg-gold/5 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Label htmlFor={inputId} className="text-xs font-black uppercase tracking-wider">Import from Waalaxy CSV</Label>
          <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-muted-foreground">
            Prefills Requests Sent, Accepted and Answered, then autosaves. All values remain editable and later changes autosave too.
          </p>
        </div>
        <Input id={inputId} type="file" accept=".csv,text/csv" onChange={handleFile} className="h-9 max-w-xs bg-background text-xs file:mr-3 file:border-0 file:bg-transparent file:font-bold" />
      </div>
      {summary && (
        <div role="status" className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-medium text-emerald-800">
          Imported {weekStart}–{weekEnd}: <strong>{summary.conn_requests_sent}</strong> sent, <strong>{summary.accepted}</strong> accepted and <strong>{summary.answered}</strong> answered from {summary.totalRows} prospects
          {summary.skippedRows ? ` · ${summary.skippedRows} blank rows skipped` : ''}. Autosaving now; review or edit below.
        </div>
      )}
    </div>
  )
}

interface LeadGenCampaignEntryProps {
  selectedClientId: string | null
  selectedWeek: string
  weekOptions: { weekStart: string; weekEnd: string; label: string }[]
  weeklyData: WeeklyData | null
  activeTab: 'content' | 'leadgen'
  campaigns: Campaign[]
  setCampaigns: (campaigns: Campaign[]) => void
  campaignWeeklyData: CampaignWeeklyData[]
  formData: Record<string, any>
  handleMetricChange: (metricId: string, field: 'value' | 'target' | 'note', value: any) => void
  user: { id: string } | null | undefined
  contentSaveStatus: SaveStatus
  fetchData: () => Promise<void>
  toggleCampaignStatus: (campaignId: string, currentStatus: string) => Promise<void>
  deleteCampaign: (campaignId: string, name: string) => Promise<void>
  showInactive: boolean
  setShowInactive: (v: boolean) => void
  setEditingCampaign: (c: Campaign | null) => void
  registerCampaignSave: (handler: (() => Promise<void>) | null) => void
}

function LeadGenCampaignEntry({
  selectedClientId, selectedWeek, weekOptions, weeklyData, activeTab,
  campaigns, setCampaigns, campaignWeeklyData, formData, handleMetricChange,
  user, contentSaveStatus, fetchData, toggleCampaignStatus, deleteCampaign,
  showInactive, setShowInactive, setEditingCampaign, registerCampaignSave,
}: LeadGenCampaignEntryProps) {
    const [localCampaignData, setLocalCampaignData] = useState<Record<string, any>>({})
    const localCampaignDataRef = React.useRef(localCampaignData)
    useEffect(() => {
        localCampaignDataRef.current = localCampaignData
    }, [localCampaignData])
    const [showNewCampaignForm, setShowNewCampaignForm] = useState(false)
    const [newCampaign, setNewCampaign] = useState({ name: '', icp_description: '', message_narrative: '', started_date: new Date().toISOString().split('T')[0] })
    const [saveStatus, setSaveStatus] = useState<Record<string, 'saving' | 'saved' | 'error'>>({})
    const [leadGenMode, setLeadGenMode] = useState<'campaigns' | 'legacy'>('campaigns')
    const [calibrateOpen, setCalibrateOpen] = useState(false)
    const [calibrateCampaignId, setCalibrateCampaignId] = useState<string>('')
    const [calibrateWeeks, setCalibrateWeeks] = useState<any[]>([])
    const [selectedCalibrateWeeks, setSelectedCalibrateWeeks] = useState<string[]>([])
    const [calibrating, setCalibrating] = useState(false)
    const autosaveTimers = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({})
    const dirtyCampaignIds = React.useRef(new Set<string>())
    const campaignSaveQueues = React.useRef(new Map<string, Promise<boolean>>())
    const flushGroupedMetricsRef = React.useRef<() => void>(() => undefined)

    // Per-campaign week selection for inactive/completed campaigns
    const [inactiveCampaignWeekMap, setInactiveCampaignWeekMap] = useState<Record<string, string>>({}) // campaignId -> selected week
    const [inactiveCampaignAllData, setInactiveCampaignAllData] = useState<Record<string, any[]>>({}) // campaignId -> all weekly rows

    const loadInactiveCampaignHistory = async (campaignId: string) => {
      if (!selectedClientId) return
      if (inactiveCampaignAllData[campaignId]) return // already loaded
      const { data } = await supabase
        .from('campaign_weekly_data')
        .select('*')
        .eq('campaign_id', campaignId)
        .eq('client_id', selectedClientId)
        .order('week_start', { ascending: false })
      const rows = data || []
      setInactiveCampaignAllData(prev => ({ ...prev, [campaignId]: rows }))
      if (rows.length > 0 && !inactiveCampaignWeekMap[campaignId]) {
        const latestWeek = rows[0].week_start
        setInactiveCampaignWeekMap(prev => ({ ...prev, [campaignId]: latestWeek }))
        setLocalCampaignData(prev => ({
          ...prev,
          [campaignId]: {
            conn_requests_sent: rows[0].conn_requests_sent ?? '',
            accepted: rows[0].accepted ?? '',
            answered: rows[0].answered ?? '',
            positive_replies: rows[0].positive_replies ?? '',
            negative_replies: rows[0].negative_replies ?? '',
            meetings_booked: rows[0].meetings_booked ?? '',
            notes: rows[0].notes ?? ''
          }
        }))
      }
    }

    const switchInactiveCampaignWeek = (campaignId: string, weekStart: string) => {
      setInactiveCampaignWeekMap(prev => ({ ...prev, [campaignId]: weekStart }))
      const rows = inactiveCampaignAllData[campaignId] || []
      const row = rows.find((r: any) => r.week_start === weekStart)
      setLocalCampaignData(prev => ({
        ...prev,
        [campaignId]: row ? {
          conn_requests_sent: row.conn_requests_sent ?? '',
          accepted: row.accepted ?? '',
          answered: row.answered ?? '',
          positive_replies: row.positive_replies ?? '',
          negative_replies: row.negative_replies ?? '',
          meetings_booked: row.meetings_booked ?? '',
          notes: row.notes ?? ''
        } : { conn_requests_sent: '', accepted: '', answered: '', positive_replies: '', negative_replies: '', meetings_booked: '', notes: '' }
      }))
    }

    // Existing Connections / InMail Outreach fields are ordinary Lead Gen metrics
    // (L19/L20/L22/existing_connections_notes and L01/L02/L03/L04/L06) — they used to
    // have their own debounced read-modify-write straight to Supabase, entirely
    // separate from formData. That meant the next tab-level autosave (or simply
    // clicking Submit Week, which always rewrites the *whole* leadgen_metrics column
    // from formData) clobbered these fields back to their stale pre-edit values,
    // silently wiping out what was just typed — this is why the data kept vanishing.
    //
    // Local state below keeps typing responsive; a short pause after the last
    // keystroke syncs the value into formData via handleMetricChange, which is the
    // same save pipeline (queueTabSave/useAutoSave) every other metric on this page
    // already uses. formData is the single writer now, so there's nothing left to
    // race with. (We debounce rather than syncing on every keystroke just to avoid
    // an extra parent re-render per character typed.)
    const [existingConnSent, setExistingConnSent] = useState<string>('')
    const [existingConnReplied, setExistingConnReplied] = useState<string>('')
    const [existingConnHotLeads, setExistingConnHotLeads] = useState<string>('')
    const [existingConnNotes, setExistingConnNotes] = useState<string>('')
    const existingConnRef = React.useRef({ sent: '', replied: '', hotLeads: '', notes: '' })
    const existingConnSyncTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        existingConnRef.current = { sent: existingConnSent, replied: existingConnReplied, hotLeads: existingConnHotLeads, notes: existingConnNotes }
    }, [existingConnSent, existingConnReplied, existingConnHotLeads, existingConnNotes])

    useEffect(() => {
        setExistingConnSent(formData.L19?.value ?? '')
        setExistingConnReplied(formData.L20?.value ?? '')
        setExistingConnHotLeads(formData.L22?.value ?? '')
        setExistingConnNotes(formData.existing_connections_notes?.value ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [weeklyData])

    const flushExistingConn = () => {
        if (existingConnSyncTimer.current) clearTimeout(existingConnSyncTimer.current)
        existingConnSyncTimer.current = null
        const c = existingConnRef.current
        handleMetricChange('L19', 'value', c.sent)
        handleMetricChange('L20', 'value', c.replied)
        handleMetricChange('L22', 'value', c.hotLeads)
        handleMetricChange('existing_connections_notes', 'value', c.notes)
    }

    const handleExistingConnChange = (field: 'sent'|'replied'|'hotLeads'|'notes', val: string) => {
        if (field === 'sent') setExistingConnSent(val)
        if (field === 'replied') setExistingConnReplied(val)
        if (field === 'hotLeads') setExistingConnHotLeads(val)
        if (field === 'notes') setExistingConnNotes(val)
        existingConnRef.current = { ...existingConnRef.current, [field]: val }

        if (existingConnSyncTimer.current) clearTimeout(existingConnSyncTimer.current)
        existingConnSyncTimer.current = setTimeout(flushExistingConn, 600)
    }

    // InMail Outreach State — same pattern as Existing Connections above.
    const [inmailTargeted, setInmailTargeted] = useState<string>('')
    const [inmailSent, setInmailSent] = useState<string>('')
    const [inmailAccepted, setInmailAccepted] = useState<string>('')
    const [inmailDeclined, setInmailDeclined] = useState<string>('')
    const [inmailHotLeads, setInmailHotLeads] = useState<string>('')
    const inmailRef = React.useRef({ targeted: '', sent: '', accepted: '', declined: '', hotLeads: '' })
    const inmailSyncTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        inmailRef.current = { targeted: inmailTargeted, sent: inmailSent, accepted: inmailAccepted, declined: inmailDeclined, hotLeads: inmailHotLeads }
    }, [inmailTargeted, inmailSent, inmailAccepted, inmailDeclined, inmailHotLeads])

    useEffect(() => {
        setInmailTargeted(formData.L01?.value ?? '')
        setInmailSent(formData.L02?.value ?? '')
        setInmailAccepted(formData.L03?.value ?? '')
        setInmailDeclined(formData.L04?.value ?? '')
        setInmailHotLeads(formData.L06?.value ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [weeklyData])

    const flushInmail = () => {
        if (inmailSyncTimer.current) clearTimeout(inmailSyncTimer.current)
        inmailSyncTimer.current = null
        const c = inmailRef.current
        handleMetricChange('L01', 'value', c.targeted)
        handleMetricChange('L02', 'value', c.sent)
        handleMetricChange('L03', 'value', c.accepted)
        handleMetricChange('L04', 'value', c.declined)
        handleMetricChange('L06', 'value', c.hotLeads)
    }

    const handleInmailChange = (field: 'targeted'|'sent'|'accepted'|'declined'|'hotLeads', val: string) => {
        if (field === 'targeted') setInmailTargeted(val)
        if (field === 'sent') setInmailSent(val)
        if (field === 'accepted') setInmailAccepted(val)
        if (field === 'declined') setInmailDeclined(val)
        if (field === 'hotLeads') setInmailHotLeads(val)
        inmailRef.current = { ...inmailRef.current, [field]: val }

        if (inmailSyncTimer.current) clearTimeout(inmailSyncTimer.current)
        inmailSyncTimer.current = setTimeout(flushInmail, 600)
    }

    flushGroupedMetricsRef.current = () => {
      if (existingConnSyncTimer.current) flushExistingConn()
      if (inmailSyncTimer.current) flushInmail()
    }

    // Reset campaign save states when client or week changes
    useEffect(() => {
      setSaveStatus({})
      dirtyCampaignIds.current.clear()
    }, [selectedClientId, selectedWeek])

    // Read helper for legacy fields stored as { value } or raw
    const readLegacy = (id: string): any => {
      const f = (weeklyData?.leadgen_metrics as any)?.[id]
      if (f === null || f === undefined) return null
      if (typeof f === 'object' && 'value' in f) return f.value ?? null
      return f
    }

    const hasLegacyData = Boolean(
      weeklyData?.leadgen_metrics &&
      Object.keys(weeklyData.leadgen_metrics).length > 0 &&
      ['L10','L11','L13','L15','L16','L24'].some(id => {
        const v = readLegacy(id)
        return v !== null && v !== undefined && v !== '' && Number(v) > 0
      })
    )
    const hasCampaignRows = campaignWeeklyData.length > 0

    // Auto-select mode when week/data changes
    useEffect(() => {
      if (hasCampaignRows) setLeadGenMode('campaigns')
      else if (hasLegacyData) setLeadGenMode('legacy')
      else setLeadGenMode('campaigns')
    }, [hasCampaignRows, hasLegacyData, selectedWeek, selectedClientId])

    // When Lead Gen tab is selected and client + week are set, keep the rollup
    // numbers fresh. This is a passive view action (not a save), so it must never
    // mark the week as submitted -- leave markSubmitted at its default (false).
    useEffect(() => {
      if (activeTab === 'leadgen' && selectedClientId && selectedWeek) {
        syncAllCampaignTotals(selectedClientId, selectedWeek)
      }
    }, [activeTab, selectedClientId, selectedWeek])

    useEffect(() => {
        const initial: Record<string, any> = {}
        campaigns.forEach(c => {
            const data = campaignWeeklyData.find(w => w.campaign_id === c.id)
            initial[c.id] = {
                conn_requests_sent: data?.conn_requests_sent ?? '',
                accepted: data?.accepted ?? '',
                answered: data?.answered ?? '',
                positive_replies: data?.positive_replies ?? '',
                negative_replies: data?.negative_replies ?? '',
                meetings_booked: data?.meetings_booked ?? '',
                notes: data?.notes ?? ''
            }
        })
        setLocalCampaignData(initial)
    }, [campaigns, campaignWeeklyData])


    const handleCampaignChange = (campaignId: string, field: string, value: any) => {
        const updatedCampaignData = {
            ...localCampaignDataRef.current,
            [campaignId]: { ...localCampaignDataRef.current[campaignId], [field]: value }
        }
        localCampaignDataRef.current = updatedCampaignData
        setLocalCampaignData(updatedCampaignData)
        dirtyCampaignIds.current.add(campaignId)

        // Debounced autosave
        if (autosaveTimers.current[campaignId]) clearTimeout(autosaveTimers.current[campaignId])
        setSaveStatus(prev => ({ ...prev, [campaignId]: 'saving' }))
        autosaveTimers.current[campaignId] = setTimeout(() => {
          delete autosaveTimers.current[campaignId]
          void saveCampaignData(campaignId, true)
        }, 2000)
    }

    const applyCampaignImport = (campaignId: string, summary: WaalaxyImportSummary) => {
        const updatedCampaignData = {
            ...localCampaignDataRef.current,
            [campaignId]: {
                ...localCampaignDataRef.current[campaignId],
                conn_requests_sent: String(summary.conn_requests_sent),
                accepted: String(summary.accepted),
                answered: String(summary.answered),
            },
        }
        localCampaignDataRef.current = updatedCampaignData
        setLocalCampaignData(updatedCampaignData)
        dirtyCampaignIds.current.add(campaignId)
        if (autosaveTimers.current[campaignId]) clearTimeout(autosaveTimers.current[campaignId])
        setSaveStatus(previous => ({ ...previous, [campaignId]: 'saving' }))
        // CSV values use the same persistence path as manual edits. The short
        // debounce leaves time for an immediate correction while ensuring an
        // import is not lost if the user forgets the per-campaign Save button.
        autosaveTimers.current[campaignId] = setTimeout(() => {
          delete autosaveTimers.current[campaignId]
          void saveCampaignData(campaignId, true)
        }, 800)
    }

    const saveCampaignData = async (campaignId: string, silent = false): Promise<boolean> => {
        if (!selectedClientId || !campaigns.some(campaign => campaign.id === campaignId && campaign.client_id === selectedClientId)) {
            setSaveStatus(prev => ({ ...prev, [campaignId]: 'error' }))
            if (!silent) toast.error("Campaign no longer belongs to the selected client. Refresh and try again.")
            return false
        }
        const data = localCampaignDataRef.current[campaignId]
        if (!data) return true
        // Use the per-campaign selected week for inactive campaigns, otherwise the global selected week
        const effectiveWeek = inactiveCampaignWeekMap[campaignId] || selectedWeek
        const weekInfo = weekOptions.find(w => w.weekStart === effectiveWeek)
          || { weekEnd: '', label: effectiveWeek }
        const clientId = selectedClientId
        const dataSnapshot = { ...data }
        const queueKey = `${clientId}:${campaignId}:${effectiveWeek}`
        const previousSave = campaignSaveQueues.current.get(queueKey) ?? Promise.resolve(true)
        const currentSave = previousSave.catch(() => false).then(async () => {
          try {
            setSaveStatus(prev => ({ ...prev, [campaignId]: 'saving' }))
            const payload = {
                campaign_id: campaignId,
                client_id: clientId,
                week_start: effectiveWeek,
                week_end: weekInfo?.weekEnd ?? '',
                week_label: weekInfo?.label ?? '',
                conn_requests_sent: Number(dataSnapshot.conn_requests_sent) || 0,
                accepted: Number(dataSnapshot.accepted) || 0,
                answered: Number(dataSnapshot.answered) || 0,
                positive_replies: Number(dataSnapshot.positive_replies) || 0,
                negative_replies: Number(dataSnapshot.negative_replies) || 0,
                meetings_booked: Number(dataSnapshot.meetings_booked) || 0,
                notes: dataSnapshot.notes || '',
                submitted_by: user?.id
            }
            const { data: savedRow, error } = await supabase
                .from('campaign_weekly_data')
                .upsert(payload, { onConflict: 'campaign_id,week_start' })
                .select('campaign_id, client_id, week_start, conn_requests_sent, accepted, answered')
                .single()

            if (error) throw error

            const importedFieldsPersisted = savedRow
              && savedRow.campaign_id === campaignId
              && savedRow.client_id === clientId
              && savedRow.week_start === effectiveWeek
              && Number(savedRow.conn_requests_sent ?? 0) === payload.conn_requests_sent
              && Number(savedRow.accepted ?? 0) === payload.accepted
              && Number(savedRow.answered ?? 0) === payload.answered
            if (!importedFieldsPersisted) {
                throw new Error('Campaign save could not be verified. Please retry before leaving this page.')
            }

            const latestData = localCampaignDataRef.current[campaignId]
            const savedSnapshotIsLatest = latestData
              && ['conn_requests_sent', 'accepted', 'answered', 'positive_replies', 'negative_replies', 'meetings_booked', 'notes']
                .every(field => String(latestData[field] ?? '') === String(dataSnapshot[field] ?? ''))
            if (savedSnapshotIsLatest) {
              dirtyCampaignIds.current.delete(campaignId)
              if (autosaveTimers.current[campaignId]) clearTimeout(autosaveTimers.current[campaignId])
              delete autosaveTimers.current[campaignId]
              setSaveStatus(prev => ({ ...prev, [campaignId]: 'saved' }))
            }

            // A real campaign save just happened, so this week is genuinely submitted.
            try {
                await syncAllCampaignTotals(clientId, effectiveWeek, true)
            } catch (syncError) {
                // The campaign row is already verified above. Keep the primary save
                // successful and let the page-level save retry the aggregate sync.
                console.error('Campaign saved, but aggregate sync failed:', syncError)
                if (!silent) toast.warning('Campaign data saved, but weekly totals could not be refreshed yet.')
            }

            if (!silent) toast.success("Campaign data saved")
            return true
        } catch (error: any) {
            setSaveStatus(prev => ({ ...prev, [campaignId]: 'error' }))
            if (!silent) toast.error(error.message)
            else console.error('Autosave failed:', error.message)
            return false
          }
        })
        campaignSaveQueues.current.set(queueKey, currentSave)
        try {
          return await currentSave
        } finally {
          if (campaignSaveQueues.current.get(queueKey) === currentSave) {
            campaignSaveQueues.current.delete(queueKey)
          }
        }
    }

    const saveCampaignDataRef = React.useRef(saveCampaignData)
    saveCampaignDataRef.current = saveCampaignData

    // The page-level Save Draft / Submit Week buttons also flush any campaign
    // autosave that is still inside its debounce window.
    useEffect(() => {
      registerCampaignSave(async () => {
        // Move grouped local inputs into the parent's scoped autosave payload
        // before it flushes the shared hook during navigation/submission.
        flushGroupedMetricsRef.current()

        const campaignIds = Array.from(dirtyCampaignIds.current)
        if (campaignIds.length === 0) return

        const results = await Promise.all(
          campaignIds.map(campaignId => saveCampaignDataRef.current(campaignId, true)),
        )
        if (results.some(result => !result)) {
          throw new Error('One or more campaign entries could not be saved. Check the campaign marked “Save failed” and retry.')
        }
      })

      return () => registerCampaignSave(null)
    }, [registerCampaignSave])

    // Capture the callbacks for this exact client/week. Depending on the callback
    // identities made this cleanup run after every render, which launched duplicate
    // campaign writes whenever the saving indicator changed.
    useEffect(() => {
      return () => {
        if (existingConnSyncTimer.current) flushExistingConn()
        if (inmailSyncTimer.current) flushInmail()

        // Flush any pending campaign saves
        Object.keys(autosaveTimers.current).forEach(campaignId => {
          clearTimeout(autosaveTimers.current[campaignId])
          delete autosaveTimers.current[campaignId]
          void saveCampaignData(campaignId, true)
        })
      }
      // The callbacks intentionally belong to the client/week captured when this
      // effect was installed; adding them would reintroduce render-time flushing.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedClientId, selectedWeek])

    const handleCreateCampaign = async () => {
        if (!selectedClientId) return toast.error("Select a client first")
        if (!newCampaign.name) return toast.error("Campaign name is required")
        try {
            const { data, error } = await supabase
                .from('campaigns')
                .insert({
                    client_id: selectedClientId,
                    name: newCampaign.name,
                    icp_description: newCampaign.icp_description,
                    message_narrative: newCampaign.message_narrative,
                    started_date: newCampaign.started_date,
                    created_by: user?.id
                })
                .select()
                .single()

            if (error) throw error
            toast.success("Campaign created")
            setCampaigns(sortAlphabetically([...campaigns, data], campaign => campaign.name))
            setLocalCampaignData({ ...localCampaignData, [data.id]: { conn_requests_sent: '', accepted: '', answered: '', positive_replies: '', negative_replies: '', meetings_booked: '', notes: '' } })
            setShowNewCampaignForm(false)
            setNewCampaign({ name: '', icp_description: '', message_narrative: '', started_date: new Date().toISOString().split('T')[0] })
        } catch (error: any) {
            toast.error(error.message)
        }
    }

    const openCalibrate = async () => {
      if (!selectedClientId) return
      // Find all legacy weeks for this client that have no campaign data
      const { data: legacyWeeks } = await supabase
        .from('weekly_data')
        .select('week_start, week_label, leadgen_metrics')
        .eq('client_id', selectedClientId)
        .order('week_start', { ascending: false })

      const { data: cwd } = await supabase
        .from('campaign_weekly_data')
        .select('week_start')
        .eq('client_id', selectedClientId)

      const campaignWeekSet = new Set((cwd || []).map((r: any) => r.week_start))
      const eligible = (legacyWeeks || []).filter((w: any) => {
        const lm = w.leadgen_metrics || {}
        const hasAny = Object.keys(lm).length > 0
        return hasAny && !campaignWeekSet.has(w.week_start)
      })

      setCalibrateWeeks(eligible)
      setSelectedCalibrateWeeks(eligible.map((w: any) => w.week_start))
      setCalibrateCampaignId(campaigns[0]?.id || '')
      setCalibrateOpen(true)
    }

    const runCalibration = async () => {
      if (!calibrateCampaignId || selectedCalibrateWeeks.length === 0) {
        toast.error("Select a campaign and at least one week")
        return
      }
      if (!selectedClientId || !campaigns.some(campaign => campaign.id === calibrateCampaignId && campaign.client_id === selectedClientId)) {
        toast.error("The selected campaign does not belong to this client")
        return
      }
      setCalibrating(true)
      try {
        let migrated = 0, skipped = 0
        for (const weekStart of selectedCalibrateWeeks) {
          const { data: existing } = await supabase
            .from('campaign_weekly_data')
            .select('id')
            .eq('campaign_id', calibrateCampaignId)
            .eq('client_id', selectedClientId as string)
            .eq('week_start', weekStart)
            .maybeSingle()
          if (existing) { skipped++; continue }

          const { data: legacy } = await supabase
            .from('weekly_data')
            .select('leadgen_metrics, week_end, week_label')
            .eq('client_id', selectedClientId as string)
            .eq('week_start', weekStart)
            .maybeSingle()
          if (!legacy?.leadgen_metrics) { skipped++; continue }

          const lm = legacy.leadgen_metrics as Record<string, any>
          const read = (id: string) => {
            const f = lm[id]
            if (!f) return 0
            const v = typeof f === 'object' && 'value' in f ? f.value : f
            return Number(v) || 0
          }
          await supabase.from('campaign_weekly_data').insert({
            campaign_id: calibrateCampaignId,
            client_id: selectedClientId as string,
            week_start: weekStart,
            week_end: legacy.week_end,
            week_label: legacy.week_label,
            conn_requests_sent: read('L10'),
            accepted: read('L11'),
            answered: read('L13'),
            positive_replies: read('L15'),
            negative_replies: read('L16'),
            meetings_booked: read('L24'),
            existing_conn_sent: read('L19'),
            existing_conn_replied: read('L20'),
            notes: 'Calibrated from legacy data',
            submitted_by: user?.id
          })
          migrated++
        }
        toast.success(`Calibrated ${migrated} week${migrated !== 1 ? 's' : ''}${skipped ? ` (${skipped} skipped)` : ''}`)
        setCalibrateOpen(false)
        fetchData()
      } catch (e: any) {
        toast.error(e.message)
      } finally {
        setCalibrating(false)
      }
    }

    const totals = useMemo(() => {
        const t = { L10: 0, L11: 0, L13: 0, L15: 0, L16: 0, L24: 0 }
        campaigns.forEach(campaign => {
            // Browsing an inactive campaign's history replaces its local form with
            // that historical week. Weekly totals must remain tied to the globally
            // selected week instead of silently mixing values from different weeks.
            const campaignViewWeek = inactiveCampaignWeekMap[campaign.id] || selectedWeek
            const selectedWeekRow = campaignWeeklyData.find(row => row.campaign_id === campaign.id)
            const d: any = campaignViewWeek === selectedWeek
              ? localCampaignData[campaign.id]
              : selectedWeekRow
            if (!d) return
            t.L10 += Number(d.conn_requests_sent || 0)
            t.L11 += Number(d.accepted || 0)
            t.L13 += Number(d.answered || 0)
            t.L15 += Number(d.positive_replies || 0)
            t.L16 += Number(d.negative_replies || 0)
            t.L24 += Number(d.meetings_booked || 0)
        })
        return t
    }, [campaignWeeklyData, campaigns, inactiveCampaignWeekMap, localCampaignData, selectedWeek])

    const LegacyCard = () => {
      const legacyMetrics = [
        { label: 'Conn Req Sent', id: 'L10' },
        { label: 'Accepted', id: 'L11' },
        { label: 'Acceptance Rate', id: 'L12', calc: 'acc' as const },
        { label: 'Responded', id: 'L13' },
        { label: 'Response Rate', id: 'L14', calc: 'resp' as const },
        { label: 'Positive Replies', id: 'L15' },
        { label: 'Negative Replies', id: 'L16' },
        { label: 'Meetings Booked', id: 'L24' },
      ]
      const L10 = Number(readLegacy('L10')) || 0
      const L11 = Number(readLegacy('L11')) || 0
      const L13 = Number(readLegacy('L13')) || 0
      return (
        <Card className="border-gold/40 bg-gold/5">
          <CardHeader className="py-3 border-b border-gold/20">
            <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
              📋 Legacy Data - Pre-Campaign Format
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              This week's data was entered before campaign tracking was introduced. Shown as aggregate totals.
            </p>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
              {legacyMetrics.map(m => {
                let display: any = readLegacy(m.id)
                if (m.calc === 'acc') display = fmtRate(calcRateCapped(L11, L10))
                else if (m.calc === 'resp') display = fmtRate(calcRateCapped(L13, L11))
                else display = display === null || display === undefined || display === '' ? '-' : display
                return (
                  <div key={m.id} className="text-center">
                    <div className="text-[10px] text-muted-foreground uppercase font-bold">{m.label}</div>
                    <div className="text-lg font-black">{display}</div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )
    }

    const existingRespRate = fmtRate(calcRateCapped(Number(existingConnReplied), Number(existingConnSent)))
    const inmailAcceptRate = fmtRate(calcRateCapped(Number(inmailAccepted), Number(inmailSent)))

    return (
        <div className="space-y-6">
            {/* EXISTING CONNECTIONS */}
            <div className="bg-white border rounded-xl shadow-sm overflow-hidden mb-8">
                <div className="px-6 py-4 border-b bg-muted/10 flex justify-between items-center">
                    <div>
                        <h3 className="font-bold text-lg uppercase tracking-tight">Existing Connections</h3>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Client Level Outreach</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {contentSaveStatus === 'saving' && <span className="text-xs text-muted-foreground">Saving…</span>}
                        {contentSaveStatus === 'saved' && <span className="text-xs text-green-600 font-bold">✓ Saved</span>}
                        {contentSaveStatus === 'error' && <span className="text-xs text-red-600 font-bold">⚠ Error</span>}
                    </div>
                </div>
                <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Messages Sent</Label>
                                    <Input
                                        type="number"
                                        placeholder="-"
                                        value={existingConnSent}
                                        onChange={(e) => handleExistingConnChange('sent', e.target.value)}
                                        className="h-10"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Replies</Label>
                                    <Input
                                        type="number"
                                        placeholder="-"
                                        value={existingConnReplied}
                                        onChange={(e) => handleExistingConnChange('replied', e.target.value)}
                                        className="h-10"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Existing Connections Hot Leads</Label>
                                    <Input
                                        type="number"
                                        placeholder="-"
                                        value={existingConnHotLeads}
                                        onChange={(e) => handleExistingConnChange('hotLeads', e.target.value)}
                                        className="h-10"
                                    />
                                </div>
                            </div>
                            <div style={{ background: '#F9F9F9', border: '1px solid #E5E5E5', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', color: '#666', fontStyle: 'italic' }}>
                                Response Rate: <strong style={{ color: '#000' }}>{existingRespRate}</strong>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Notes</Label>
                            <Textarea 
                                placeholder="Notes about existing connections outreach..." 
                                value={existingConnNotes} 
                                onChange={(e: any) => handleExistingConnChange('notes', e.target.value)}
                                className="h-[120px] resize-none"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* INMAIL OUTREACH */}
            <div className="bg-white border rounded-xl shadow-sm overflow-hidden mb-8">
                <div className="px-6 py-4 border-b bg-muted/10 flex justify-between items-center">
                    <div>
                        <h3 className="font-bold text-lg uppercase tracking-tight">InMail Outreach</h3>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Client Level Outreach</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {contentSaveStatus === 'saving' && <span className="text-xs text-muted-foreground">Saving…</span>}
                        {contentSaveStatus === 'saved' && <span className="text-xs text-green-600 font-bold">✓ Saved</span>}
                        {contentSaveStatus === 'error' && <span className="text-xs text-red-600 font-bold">⚠ Error</span>}
                    </div>
                </div>
                <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">InMails Sent</Label>
                                    <Input
                                        type="number"
                                        placeholder="-"
                                        value={inmailSent}
                                        onChange={(e) => handleInmailChange('sent', e.target.value)}
                                        className="h-10"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">InMails Accepted</Label>
                                    <Input
                                        type="number"
                                        placeholder="-"
                                        value={inmailAccepted}
                                        onChange={(e) => handleInmailChange('accepted', e.target.value)}
                                        className="h-10"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">InMails Declined</Label>
                                    <Input
                                        type="number"
                                        placeholder="-"
                                        value={inmailDeclined}
                                        onChange={(e) => handleInmailChange('declined', e.target.value)}
                                        className="h-10"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">InMail Hot Leads</Label>
                                    <Input
                                        type="number"
                                        placeholder="-"
                                        value={inmailHotLeads}
                                        onChange={(e) => handleInmailChange('hotLeads', e.target.value)}
                                        className="h-10"
                                    />
                                </div>
                            </div>
                            <div style={{ background: '#F9F9F9', border: '1px solid #E5E5E5', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', color: '#666', fontStyle: 'italic' }}>
                                Acceptance Rate: <strong style={{ color: '#000' }}>{inmailAcceptRate}</strong>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">ICP Targeted</Label>
                            <Textarea
                                placeholder="Describe the ICP targeted for InMail outreach..."
                                value={inmailTargeted}
                                onChange={(e: any) => handleInmailChange('targeted', e.target.value)}
                                className="h-[120px] resize-none"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between border-b pb-4 flex-wrap gap-2">
                <h2 className="text-xl font-black tracking-tight uppercase">
                  {leadGenMode === 'legacy' ? 'Legacy Lead Gen Data' : 'Active Campaigns'}
                </h2>
                <div className="flex gap-2">
                  {hasLegacyData && (
                    <Button onClick={openCalibrate} variant="outline" size="sm" className="font-bold h-8">
                      📊 Calibrate Old Data
                    </Button>
                  )}
                  {leadGenMode === 'campaigns' && (
                    <Button onClick={() => setShowNewCampaignForm(true)} size="sm" className="bg-gold text-black hover:bg-gold/90 font-black h-8">
                      + Add New Campaign
                    </Button>
                  )}
                </div>
            </div>

            {leadGenMode === 'legacy' && (
              <>
                <LegacyCard />
                <div className="flex items-center gap-3">
                  <Button onClick={() => setLeadGenMode('campaigns')} className="bg-gold text-black hover:bg-gold/90 font-bold">
                    + Add Campaign Data for This Week
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    You can add campaigns alongside legacy data - they won't overwrite each other.
                  </span>
                </div>
              </>
            )}

            {leadGenMode === 'campaigns' && hasLegacyData && <LegacyCard />}

            {leadGenMode === 'campaigns' && (
              <>
                {showNewCampaignForm && (
                    <Card className="border-gold shadow-sm">
                        <CardHeader className="py-3 border-b bg-gold/5">
                            <CardTitle className="text-xs font-black uppercase tracking-widest">New Campaign Details</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold uppercase ml-1">Campaign Name*</Label>
                                    <Input value={newCampaign.name} onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })} placeholder="e.g. Corporate Gifting - Pune" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold uppercase ml-1">Started Date</Label>
                                    <Input type="date" value={newCampaign.started_date} onChange={(e) => setNewCampaign({ ...newCampaign, started_date: e.target.value })} />
                                </div>
                                <div className="space-y-1.5 md:col-span-2">
                                    <Label className="text-[10px] font-bold uppercase ml-1">ICP Description</Label>
                                    <Input value={newCampaign.icp_description} onChange={(e) => setNewCampaign({ ...newCampaign, icp_description: e.target.value })} placeholder="Target audience details..." />
                                </div>
                                <div className="space-y-1.5 md:col-span-2">
                                    <Label className="text-[10px] font-bold uppercase ml-1">Message Narrative</Label>
                                    <Input value={newCampaign.message_narrative} onChange={(e) => setNewCampaign({ ...newCampaign, message_narrative: e.target.value })} placeholder="Key message strategy..." />
                                </div>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <Button onClick={handleCreateCampaign} size="sm" className="bg-gold text-black font-bold h-9">Create Campaign</Button>
                                <Button onClick={() => setShowNewCampaignForm(false)} variant="ghost" size="sm" className="h-9">Cancel</Button>
                            </div>
                        </CardContent>
                    </Card>
                )}
                
                {(() => {
                  const activeCampaigns = campaigns.filter(c => c.status === 'active')
                  const inactiveCampaigns = campaigns.filter(c => c.status !== 'active')

                  return (
                    <div className="space-y-8">
                      <Accordion type="multiple" defaultValue={activeCampaigns.map(c => c.id)} className="space-y-4">
                          {activeCampaigns.map(campaign => {
                        const data = localCampaignData[campaign.id] || {}
                        const cs = Number(data.conn_requests_sent) || 0
                        const ac = Number(data.accepted) || 0
                        const an = Number(data.answered) || 0
                        const accRate = calcRateCapped(ac, cs)
                        const respRate = calcRateCapped(an, ac)
                        const status = saveStatus[campaign.id]

                        return (
                            <AccordionItem key={campaign.id} value={campaign.id} className="border rounded-lg bg-card overflow-hidden">
                                <AccordionTrigger className="px-4 py-3 hover:bg-muted/30 hover:no-underline">
                                    <div className="flex items-center gap-4 text-left flex-1">
                                        <div className="space-y-0.5 flex-1">
                                            <div className="flex items-center gap-2">
                                              <span className="font-bold text-lg">{campaign.name}</span>
                                              <button
                                                onClick={(e) => { e.stopPropagation(); setEditingCampaign(campaign) }}
                                                className="bg-white border border-gray-200 rounded px-2 py-0.5 text-[10px] font-bold shadow-sm"
                                              >
                                                ✏️ Edit
                                              </button>
                                              <button
                                                onClick={(e) => { e.stopPropagation(); toggleCampaignStatus(campaign.id, campaign.status ?? 'inactive') }}
                                                style={{
                                                  background: campaign.status === 'active' ? '#22C55E' : '#E5E5E5',
                                                  color: campaign.status === 'active' ? 'white' : '#666',
                                                  border: 'none', borderRadius: '20px',
                                                  padding: '3px 12px', fontSize: '12px', fontWeight: '600',
                                                  cursor: 'pointer'
                                                }}
                                              >
                                                {campaign.status === 'active' ? 'Active' : 'Inactive'}
                                              </button>
                                              <button
                                                onClick={(e) => { e.stopPropagation(); deleteCampaign(campaign.id, campaign.name) }}
                                                style={{
                                                  background: 'none', border: 'none',
                                                  color: '#EF4444', fontSize: '12px',
                                                  cursor: 'pointer', textDecoration: 'underline'
                                                }}
                                              >
                                                Delete
                                              </button>
                                              {status === 'saving' && <span className="text-[10px] text-muted-foreground">Saving…</span>}
                                              {status === 'saved' && <span className="text-[10px] text-green-600 font-bold">✓ Saved</span>}
                                              {status === 'error' && <span className="text-[10px] text-red-600 font-bold">⚠ Save failed</span>}
                                            </div>
                                            <div className="flex items-center gap-3">
                                              {campaign.started_date && (
                                                <span className="text-[10px] font-bold text-muted-foreground">
                                                  🚀 {new Date(campaign.started_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </span>
                                              )}
                                              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{campaign.icp_description || 'No ICP description'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="p-4 pt-0 border-t bg-muted/5">
                                    <div className="space-y-6 mt-4">
                                        <CampaignWaalaxyImport
                                          key={`${campaign.id}-${selectedWeek}`}
                                          campaignId={campaign.id}
                                          weekStart={selectedWeek}
                                          onImported={summary => applyCampaignImport(campaign.id, summary)}
                                        />
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Outreach</Label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="space-y-1">
                                                        <Label className="text-[9px] uppercase">Conn Sent</Label>
                                                        <Input type="number" placeholder="-" value={data.conn_requests_sent ?? ''} onChange={(e) => handleCampaignChange(campaign.id, 'conn_requests_sent', e.target.value)} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[9px] uppercase">Accepted</Label>
                                                        <Input type="number" placeholder="-" value={data.accepted ?? ''} onChange={(e) => handleCampaignChange(campaign.id, 'accepted', e.target.value)} />
                                                    </div>
                                                </div>
                                                <p className="text-[10px] font-bold text-gold">Acceptance Rate: {fmtRate(accRate)}</p>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Engagement</Label>
                                                <div className="grid grid-cols-3 gap-2">
                                                    <div className="space-y-1">
                                                        <Label className="text-[9px] uppercase">Answered</Label>
                                                        <Input type="number" placeholder="-" value={data.answered ?? ''} onChange={(e) => handleCampaignChange(campaign.id, 'answered', e.target.value)} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[9px] uppercase">Positive</Label>
                                                        <Input type="number" placeholder="-" value={data.positive_replies ?? ''} onChange={(e) => handleCampaignChange(campaign.id, 'positive_replies', e.target.value)} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[9px] uppercase">Negative</Label>
                                                        <Input type="number" placeholder="-" value={data.negative_replies ?? ''} onChange={(e) => handleCampaignChange(campaign.id, 'negative_replies', e.target.value)} />
                                                    </div>
                                                </div>
                                                <p className="text-[10px] font-bold text-gold">Response Rate: {fmtRate(respRate)}</p>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Results</Label>
                                                <div className="grid grid-cols-1 gap-2">
                                                    <div className="space-y-1">
                                                        <Label className="text-[9px] uppercase">Meetings</Label>
                                                        <Input type="number" placeholder="-" value={data.meetings_booked ?? ''} onChange={(e) => handleCampaignChange(campaign.id, 'meetings_booked', e.target.value)} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pt-2">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Notes</Label>
                                                <Input value={data.notes ?? ''} onChange={(e) => handleCampaignChange(campaign.id, 'notes', e.target.value)} placeholder="Campaign specific notes..." />
                                            </div>
                                        </div>

                                        <div className="pt-4 border-t flex justify-between items-center">
                                            <p className="text-[10px] italic text-muted-foreground">Message Narrative: {campaign.message_narrative || 'None'}</p>
                                            <Button onClick={() => saveCampaignData(campaign.id)} size="sm" className="bg-gold/10 text-gold hover:bg-gold/20 font-bold h-8">
                                                Save Campaign Data
                                            </Button>
                                        </div>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        )
                    })}
                </Accordion>

                {activeCampaigns.length === 0 && (
                    <div className="text-center py-12 border-2 border-dashed rounded-xl bg-muted/5">
                        <p className="text-muted-foreground font-medium">No active campaigns for this client.</p>
                        <Button onClick={() => setShowNewCampaignForm(true)} variant="link" className="text-gold font-bold mt-1">Create your first campaign →</Button>
                    </div>
                )}
                
                {inactiveCampaigns.length > 0 && (
                  <div>
                    <button
                      onClick={() => setShowInactive(!showInactive)}
                      style={{
                        background: 'none', border: '1px solid #E5E5E5',
                        borderRadius: '6px', padding: '8px 16px',
                        fontSize: '13px', color: '#999', cursor: 'pointer',
                        marginTop: '16px'
                      }}
                    >
                      {showInactive ? '▲ Hide' : '▼ Show'} Completed / Inactive Campaigns ({inactiveCampaigns.length})
                    </button>

                    {showInactive && (
                      <Accordion type="multiple" className="space-y-4 mt-4">
                        {inactiveCampaigns.map(campaign => {
                            const data = localCampaignData[campaign.id] || {}
                            const cs = Number(data.conn_requests_sent) || 0
                            const ac = Number(data.accepted) || 0
                            const an = Number(data.answered) || 0
                            const accRate = calcRateCapped(ac, cs)
                            const respRate = calcRateCapped(an, ac)
                            const status = saveStatus[campaign.id]
                            const campaignHistory = inactiveCampaignAllData[campaign.id] || []
                            const selectedInactiveWeek = inactiveCampaignWeekMap[campaign.id] || ''

                            return (
                                <AccordionItem key={campaign.id} value={campaign.id} className="border rounded-lg bg-card overflow-hidden">
                                    <AccordionTrigger className="px-4 py-3 hover:bg-muted/30 hover:no-underline" onClick={() => loadInactiveCampaignHistory(campaign.id)}>
                                        <div className="flex items-center gap-4 text-left flex-1">
                                            <div className="space-y-0.5 flex-1">
                                                <div className="flex items-center gap-2">
                                                  <span className="font-bold text-lg">{campaign.name}</span>
                                                  <button
                                                    onClick={(e) => { e.stopPropagation(); toggleCampaignStatus(campaign.id, campaign.status ?? 'inactive') }}
                                                    style={{
                                                      background: campaign.status === 'active' ? '#22C55E' : '#E5E5E5',
                                                      color: campaign.status === 'active' ? 'white' : '#666',
                                                      border: 'none', borderRadius: '20px',
                                                      padding: '3px 12px', fontSize: '12px', fontWeight: '600',
                                                      cursor: 'pointer'
                                                    }}
                                                  >
                                                    {campaign.status === 'active' ? 'Active' : campaign.status === 'completed' ? 'Completed' : 'Inactive'}
                                                  </button>
                                                  <button
                                                    onClick={(e) => { e.stopPropagation(); setEditingCampaign(campaign) }}
                                                    style={{
                                                      background: 'none', border: '1px solid #E5E5E5',
                                                      borderRadius: '6px', color: '#555', fontSize: '12px',
                                                      cursor: 'pointer', padding: '2px 10px'
                                                    }}
                                                  >
                                                    Edit
                                                  </button>
                                                  <button
                                                    onClick={(e) => { e.stopPropagation(); deleteCampaign(campaign.id, campaign.name) }}
                                                    style={{
                                                      background: 'none', border: 'none',
                                                      color: '#EF4444', fontSize: '12px',
                                                      cursor: 'pointer', textDecoration: 'underline'
                                                    }}
                                                  >
                                                    Delete
                                                  </button>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                  {campaign.started_date && (
                                                    <span className="text-[10px] font-bold text-muted-foreground">
                                                      🚀 {new Date(campaign.started_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </span>
                                                  )}
                                                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{campaign.icp_description || 'No ICP description'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="p-4 pt-0 border-t bg-muted/5">
                                        <div className="space-y-6 mt-4">
                                            {/* Week selector for inactive/completed campaigns */}
                                            <div className="flex items-center gap-3 flex-wrap">
                                              <span className="text-[10px] font-bold uppercase text-muted-foreground">Viewing Week:</span>
                                              {campaignHistory.length === 0 ? (
                                                <span className="text-xs text-muted-foreground italic">No data recorded yet — enter below to add.</span>
                                              ) : (
                                                <div className="flex gap-1.5 flex-wrap">
                                                  {campaignHistory.map((row: any) => (
                                                    <button
                                                      key={row.week_start}
                                                      onClick={() => switchInactiveCampaignWeek(campaign.id, row.week_start)}
                                                      className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-colors ${
                                                        selectedInactiveWeek === row.week_start
                                                          ? 'bg-gold text-black border-gold'
                                                          : 'bg-background border-border text-muted-foreground hover:border-gold hover:text-foreground'
                                                      }`}
                                                    >
                                                      {row.week_label || row.week_start}
                                                    </button>
                                                  ))}
                                                  <button
                                                    onClick={() => switchInactiveCampaignWeek(campaign.id, selectedWeek)}
                                                    className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-colors ${
                                                      selectedInactiveWeek === selectedWeek
                                                        ? 'bg-gold text-black border-gold'
                                                        : 'bg-background border-border text-muted-foreground hover:border-gold hover:text-foreground'
                                                    }`}
                                                  >
                                                    + New Entry ({selectedWeek})
                                                  </button>
                                                </div>
                                              )}
                                            </div>
                                            <CampaignWaalaxyImport
                                              key={`${campaign.id}-${selectedInactiveWeek || selectedWeek}`}
                                              campaignId={campaign.id}
                                              weekStart={selectedInactiveWeek || selectedWeek}
                                              onImported={summary => applyCampaignImport(campaign.id, summary)}
                                            />
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Outreach</Label>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div className="space-y-1">
                                                            <Label className="text-[9px] uppercase">Conn Sent</Label>
                                                            <Input type="number" placeholder="-" value={data.conn_requests_sent ?? ''} onChange={(e) => handleCampaignChange(campaign.id, 'conn_requests_sent', e.target.value)} />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-[9px] uppercase">Accepted</Label>
                                                            <Input type="number" placeholder="-" value={data.accepted ?? ''} onChange={(e) => handleCampaignChange(campaign.id, 'accepted', e.target.value)} />
                                                        </div>
                                                    </div>
                                                    <p className="text-[10px] font-bold text-gold">Acceptance Rate: {fmtRate(accRate)}</p>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Engagement</Label>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        <div className="space-y-1">
                                                            <Label className="text-[9px] uppercase">Answered</Label>
                                                            <Input type="number" placeholder="-" value={data.answered ?? ''} onChange={(e) => handleCampaignChange(campaign.id, 'answered', e.target.value)} />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-[9px] uppercase">Positive</Label>
                                                            <Input type="number" placeholder="-" value={data.positive_replies ?? ''} onChange={(e) => handleCampaignChange(campaign.id, 'positive_replies', e.target.value)} />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-[9px] uppercase">Negative</Label>
                                                            <Input type="number" placeholder="-" value={data.negative_replies ?? ''} onChange={(e) => handleCampaignChange(campaign.id, 'negative_replies', e.target.value)} />
                                                        </div>
                                                    </div>
                                                    <p className="text-[10px] font-bold text-gold">Response Rate: {fmtRate(respRate)}</p>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Results</Label>
                                                    <div className="grid grid-cols-1 gap-2">
                                                        <div className="space-y-1">
                                                            <Label className="text-[9px] uppercase">Meetings</Label>
                                                            <Input type="number" placeholder="-" value={data.meetings_booked ?? ''} onChange={(e) => handleCampaignChange(campaign.id, 'meetings_booked', e.target.value)} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="pt-2">
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Notes</Label>
                                                    <Input value={data.notes ?? ''} onChange={(e) => handleCampaignChange(campaign.id, 'notes', e.target.value)} placeholder="Campaign specific notes..." />
                                                </div>
                                            </div>
                                            <div className="pt-4 border-t flex justify-between items-center">
                                                <p className="text-[10px] italic text-muted-foreground">Message Narrative: {campaign.message_narrative || 'None'}</p>
                                                <Button onClick={() => saveCampaignData(campaign.id)} size="sm" className="bg-gold/10 text-gold hover:bg-gold/20 font-bold h-8">
                                                    Save Campaign Data
                                                </Button>
                                            </div>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            )
                        })}
                      </Accordion>
                    )}
                  </div>
                )}
                
                </div>
                );
                })()}

                <div className="bg-gold/10 border border-gold/20 p-6 rounded-xl space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-widest text-gold border-b border-gold/20 pb-2">Weekly Totals (All Campaigns)</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold uppercase text-muted-foreground">Conn Sent</p>
                            <p className="text-xl font-black">{totals.L10}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold uppercase text-muted-foreground">Accepted</p>
                            <p className="text-xl font-black">{totals.L11}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold uppercase text-muted-foreground">Acc Rate</p>
                            <p className="text-xl font-black text-gold">{fmtRate(calcRateCapped(totals.L11, totals.L10))}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold uppercase text-muted-foreground">Answered</p>
                            <p className="text-xl font-black">{totals.L13}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold uppercase text-muted-foreground">Resp Rate</p>
                            <p className="text-xl font-black text-gold">{fmtRate(calcRateCapped(totals.L13, totals.L11))}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold uppercase text-muted-foreground">Meetings</p>
                            <p className="text-xl font-black">{totals.L24}</p>
                        </div>
                    </div>
                </div>
              </>
            )}

            <Dialog open={calibrateOpen} onOpenChange={setCalibrateOpen}>
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle className="uppercase font-black tracking-tight">Calibrate Legacy Data to Campaigns</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label className="text-[10px] font-bold uppercase ml-1">Assign to campaign</Label>
                    <Select value={calibrateCampaignId} onValueChange={setCalibrateCampaignId}>
                      <SelectTrigger><SelectValue placeholder="Choose campaign" /></SelectTrigger>
                      <SelectContent>
                        {campaigns.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px] font-bold uppercase ml-1">Weeks ({selectedCalibrateWeeks.length} selected)</Label>
                    <div className="max-h-64 overflow-y-auto border rounded-md p-2 space-y-1">
                      {calibrateWeeks.length === 0 && (
                        <p className="text-xs text-muted-foreground p-2">No eligible legacy weeks found.</p>
                      )}
                      {calibrateWeeks.map((w: any) => (
                        <label key={w.week_start} className="flex items-center gap-2 text-xs p-1 hover:bg-muted/30 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedCalibrateWeeks.includes(w.week_start)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedCalibrateWeeks([...selectedCalibrateWeeks, w.week_start])
                              else setSelectedCalibrateWeeks(selectedCalibrateWeeks.filter(x => x !== w.week_start))
                            }}
                          />
                          <span className="font-medium">{w.week_label || w.week_start}</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">Weeks that already have campaign data for the selected campaign will be skipped.</p>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="ghost" onClick={() => setCalibrateOpen(false)}>Cancel</Button>
                    <Button onClick={runCalibration} disabled={calibrating} className="bg-gold text-black hover:bg-gold/90 font-bold">
                      {calibrating && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      Calibrate Selected Weeks →
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

        </div>
    )
  }


function formatWeekPeriod(dateStr: string) {
    const d = new Date(dateStr)
    const startOfYear = new Date(d.getFullYear(), 0, 1);
    const pastDaysOfYear = (d.getTime() - startOfYear.getTime()) / 86400000;
    const weekNumber = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`
}


export function DataEntryPage() {
  const { user, isAdmin } = useAuth()
  const showContentTab = true
  const showLeadGenTab = true
  const navigate = useNavigate()
  const weekOptions = useMemo(() => getWeekOptions(12), [])
  
  const { selectedWeek, setSelectedWeek } = useWorkspace()
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'content' | 'leadgen'>('content')
  
  const [clients, setClients] = useState<ClientSummary[]>([])
  const [clientSettings, setClientSettings] = useState<ClientSettings | null>(null)
  const [weeklyData, setWeeklyData] = useState<WeeklyData | null>(null)
  const [previousWeeklyData, setPreviousWeeklyData] = useState<WeeklyData | null>(null)
  const [highScores, setHighScores] = useState<HighScore[]>([])
  const [contextNotes, setContextNotes] = useState<ContextNoteWithAuthor[]>([])
  const [targets, setTargets] = useState<MetricTarget[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [campaignWeeklyData, setCampaignWeeklyData] = useState<CampaignWeeklyData[]>([])
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)
  
  const [weeklyTargets, setWeeklyTargets] = useState<Record<string, number>>({})
  const [monthlyTargets, setMonthlyTargets] = useState<Record<string, number>>({})
  
  const [showInactive, setShowInactive] = useState(false)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const formDataRef = React.useRef(formData)
  useEffect(() => {
    formDataRef.current = formData
  }, [formData])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const campaignSaveAllRef = React.useRef<(() => Promise<void>) | null>(null)
  const registerCampaignSave = React.useCallback((handler: (() => Promise<void>) | null) => {
    campaignSaveAllRef.current = handler
  }, [])

  // Tracks the currently-selected client/week so an in-flight fetchData() call can
  // tell, once its awaits resolve, whether the user has since switched to a
  // different client/week — and if so, discard its (now stale) results instead of
  // clobbering the newer selection's data.
  const selectionRef = React.useRef({ clientId: selectedClientId, week: selectedWeek })
  useEffect(() => {
    selectionRef.current = { clientId: selectedClientId, week: selectedWeek }
  }, [selectedClientId, selectedWeek])

  const {
    triggerSave: triggerContentSave,
    saveNow: saveContentNow,
    retrySave: retryContentSave,
    saveStatus: contentSaveStatus,
    lastSaved: contentLastSaved,
    flushPendingSave: flushContentAutoSave,
  } = useAutoSave({
    table: 'weekly_data',
    matchColumns: {
      client_id: selectedClientId || '',
      week_start: selectedWeek
    },
    debounceMs: 1500,
    onSaveSuccess: (savedCols) => {
      // Use the client/week that was actually just written, not whatever happens
      // to be selected right now — a queued flush can complete after the user has
      // already moved on to a different client.
      const clientId = savedCols?.client_id || selectedClientId
      const week = savedCols?.week_start || selectedWeek
      if (clientId && week) {
        const currentContent = activeTab === 'content' ? formDataRef.current : (weeklyData?.content_metrics || {})
        const currentLeadgen = activeTab === 'leadgen' ? formDataRef.current : (weeklyData?.leadgen_metrics || {})

        detectAndUpdateHighScores(
          clientId,
          week,
          currentContent as Record<string, unknown>,
          currentLeadgen as Record<string, unknown>
        ).catch(err => console.error('High score detection failed:', err))
      }
    }
  })

  const flushAllDataEntrySaves = async (): Promise<boolean> => {
    try {
      // The child first moves grouped fields into this hook and persists any
      // campaign rows. Then the shared hook flushes its resulting weekly payload.
      if (campaignSaveAllRef.current) await campaignSaveAllRef.current()
      return await flushContentAutoSave()
    } catch (error) {
      console.error('Could not flush Data Entry autosaves:', error)
      return false
    }
  }

  const buildMetricsPayload = (metrics: Metric[], source: Record<string, any>) => {
    const payload: Record<string, any> = {}
    metrics.forEach((metric) => {
      if (metric.type !== 'auto' || metric.id === 'C10') payload[metric.id] = source[metric.id] || {}
    })
    return payload
  }

  const queueTabSave = (
    source: Record<string, any>,
    tab: 'content' | 'leadgen',
    immediate = false,
  ) => {
    if (!selectedClientId || !selectedWeek) return

    const weekInfo = weekOptions.find(w => w.weekStart === selectedWeek)
    const payload = {
      week_end: weekInfo?.weekEnd || getWeekEnd(selectedWeek),
      week_label: weekInfo?.label || getWeekLabel(selectedWeek),
      ...(tab === 'content'
        ? {
            content_metrics: buildMetricsPayload(CONTENT_METRICS, source),
            content_submitted_at: new Date().toISOString(),
          }
        : {
            leadgen_metrics: buildMetricsPayload(LEADGEN_METRICS, source),
            leadgen_submitted_at: new Date().toISOString(),
          }),
    }

    if (immediate) saveContentNow(payload)
    else triggerContentSave(payload)
  }

  useEffect(() => {
    const fetchClients = async () => {
      // Always fetch all active clients for everyone
      const { data } = await supabase
        .from('clients')
        .select('id, name, company')
        .eq('status', 'active')
        .order('name')
      const sortedClients = sortAlphabetically(data || [], client => client.name)
      setClients(sortedClients)
      if (sortedClients.length > 0 && !selectedClientId) setSelectedClientId(sortedClients[0].id)
    }

    fetchClients()
  }, [])

  const fetchData = async () => {
    if (!selectedClientId || !selectedWeek) return
    const requestedClientId = selectedClientId
    const requestedWeek = selectedWeek
    const isStale = () =>
      selectionRef.current.clientId !== requestedClientId || selectionRef.current.week !== requestedWeek
    setLoading(true)
    try {
      const [
        { data: settings },
        { data: currentData },
        { data: prevData },
        { data: scores },
        { data: notesData },
        { data: targetsData },
        { data: campaignsData },
        { data: campaignWeeklyDataRes }
      ] = await Promise.all([
        supabase.from('client_settings').select('*').eq('client_id', selectedClientId).maybeSingle(),
        supabase.from('weekly_data').select('*').eq('client_id', selectedClientId).eq('week_start', selectedWeek).maybeSingle(),
        supabase.from('weekly_data').select('*').eq('client_id', selectedClientId).lt('week_start', selectedWeek).order('week_start', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('high_scores').select('*').eq('client_id', selectedClientId),
        supabase.from('client_context_notes').select(`*, author:profiles!created_by(full_name)`).eq('client_id', selectedClientId).order('is_pinned', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('targets').select('*').eq('client_id', selectedClientId),
        supabase.from('campaigns').select('*').eq('client_id', selectedClientId).order('created_at'),
        supabase.from('campaign_weekly_data').select('*').eq('client_id', selectedClientId).eq('week_start', selectedWeek)
      ])
      
      // Load weekly/monthly targets separately
      const month = selectedWeek.slice(0, 7)
      const { data: wTargets } = await supabase
        .from('targets')
        .select('metric_id, target_value')
        .eq('client_id', selectedClientId)
        .eq('target_type', 'weekly')
        .eq('period', selectedWeek)
      const { data: mTargets } = await supabase
        .from('targets')
        .select('metric_id, target_value')
        .eq('client_id', selectedClientId)
        .eq('target_type', 'monthly')
        .eq('period', month)
        
      // Bail out if the user switched client/week while these requests were in
      // flight — an older, slower response must never overwrite a newer selection.
      if (isStale()) return

      const wMap: Record<string, number> = {}
      wTargets?.forEach(t => { if (t.target_value !== null) wMap[t.metric_id] = t.target_value })
      const mMap: Record<string, number> = {}
      mTargets?.forEach(t => { if (t.target_value !== null) mMap[t.metric_id] = t.target_value })

      setWeeklyTargets(wMap)
      setMonthlyTargets(mMap)

      setClientSettings(settings)
      setWeeklyData(currentData)
      setPreviousWeeklyData(prevData)
      setHighScores(scores || [])
      setContextNotes(notesData || [])
      setTargets(targetsData || [])
      setCampaigns(sortAlphabetically(campaignsData || [], campaign => campaign.name))
      setCampaignWeeklyData(campaignWeeklyDataRes || [])

      // Pre-fill form
      const initialForm: Record<string, any> = {}
      ALL_METRICS.forEach(m => {
        const metrics = (m.category === 'content' ? currentData?.content_metrics : currentData?.leadgen_metrics) as Record<string, any> | null | undefined
        const val = metrics?.[m.id]
        const emptyValue = m.id === 'C36' || m.id === 'C37'
          ? ''
          : m.type === 'number' || m.type === 'slider'
            ? 0
            : m.type === 'boolean'
              ? false
              : ''
        const storedValue = val && typeof val === 'object' && 'value' in val ? val.value : val
        const storedTarget = val && typeof val === 'object' && 'target' in val ? val.target : undefined
        const storedNote = val && typeof val === 'object' && 'note' in val ? val.note : undefined
        initialForm[m.id] = {
          value: storedValue ?? emptyValue,
          target: storedTarget ?? (settings?.custom_targets as Record<string, any> | null)?.[m.id] ?? 0,
          note: storedNote ?? ''
        }
      })
      // Preserve legacy count-based splits by presenting them as percentage shares.
      const legacyIn = Number(initialForm.C36?.value || 0)
      const legacyOut = Number(initialForm.C37?.value || 0)
      const storedTotal = Number(initialForm.C10?.value || 0) || legacyIn + legacyOut
      if (storedTotal > 0 && (legacyIn > 100 || legacyOut > 100)) {
        initialForm.C36.value = Math.round((legacyIn / storedTotal) * 10000) / 100
        initialForm.C37.value = Math.round((legacyOut / storedTotal) * 10000) / 100
      }
      formDataRef.current = initialForm
      setFormData(initialForm)
    } catch (error: any) {
      if (!isStale()) toast.error(error.message)
    } finally {
      // Only the response matching the current selection should clear the
      // loading indicator — a stale one finishing later must not do it on
      // behalf of a still-in-flight newer request.
      if (!isStale()) setLoading(false)
    }
  }

  const handleTabChange = (tab: 'content' | 'leadgen') => {
    if (selectedClientId && selectedWeek) {
      queueTabSave(formDataRef.current, activeTab, true)
    }
    setActiveTab(tab)
  }

  const handleWeekChange = async (week: string) => {
    const saved = await flushAllDataEntrySaves()
    if (!saved) {
      toast.error('Could not save the current week. Retry before switching weeks.')
      return
    }
    formDataRef.current = {}
    setFormData({})
    setSelectedWeek(week)
  }

  const handleClientChange = async (clientId: string) => {
    const saved = await flushAllDataEntrySaves()
    if (!saved) {
      toast.error('Could not save the current client. Retry before switching clients.')
      return
    }
    formDataRef.current = {}
    setFormData({})
    setSelectedClientId(clientId)
  }

  useEffect(() => {
    fetchData()
  }, [selectedClientId, selectedWeek])

  // Fix 6: Real-time sync
  useEffect(() => {
    if (!selectedClientId || !selectedWeek) return

    const channel = supabase
      .channel(`weekly_data_${selectedClientId}_${selectedWeek}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'myntmore',
          table: 'weekly_data',
          filter: `client_id=eq.${selectedClientId}`
        },
        (payload) => {
          const updated = payload.new as any
          if (updated?.week_start !== selectedWeek) return
          // Never replace local edits while their debounced save is pending or in
          // flight. The save completion will leave the database as source of truth.
          if (contentSaveStatus === 'pending' || contentSaveStatus === 'saving') return
          // Refresh if:
          //  a) we have never saved (contentLastSaved is null) - catches campaign syncs
          //  b) the DB row is newer than our last save - catches team-member edits
          const isNewer = !contentLastSaved || updated.updated_at > contentLastSaved.toISOString()
          if (isNewer) {
            fetchData()
            if (contentLastSaved) {
              // Only show toast for team-member updates, not self-triggered syncs
              toast('↻ Data updated', { icon: 'ℹ️', duration: 3000 })
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedClientId, selectedWeek, contentLastSaved, contentSaveStatus])

  const saveFieldAtomic = async (
    _metricId: string,
    _value: any,
    _category: 'content_metrics' | 'leadgen_metrics'
  ) => {
    // No-op: the debounced upsert in triggerContentSave handles persistence.
    // Previously this called a non-existent RPC `merge_metric_field` which
    // caused every save to fail.
    return
  }

  const handleMetricChange = (metricId: string, field: 'value' | 'target' | 'note', value: any) => {
    let updatedFormData = {
      ...formDataRef.current,
      [metricId]: {
        ...formDataRef.current[metricId],
        [field]: value
      }
    }
    formDataRef.current = updatedFormData
    setFormData(updatedFormData)

    queueTabSave(updatedFormData, activeTab)
  }

  const handleSave = async (isSubmit = false, isAutoSave = false) => {
    if (!selectedClientId) {
      toast.error('Please select a client.')
      return
    }
    if (!selectedWeek) {
      toast.error('Please select a week.')
      return
    }
    if (!isAutoSave) setSaving(true)
    try {
      // Finish any debounced/in-flight write before the explicit save. Otherwise
      // an older autosave can complete last and overwrite the submitted values.
      const autosaveSucceeded = await flushAllDataEntrySaves()
      if (!autosaveSucceeded) {
        toast.error('Pending changes could not be saved. Retry before submitting the week.')
        return
      }

      const weekInfo = weekOptions.find(w => w.weekStart === selectedWeek)
      
      const currentFormData = formDataRef.current
      const contentMetrics = buildMetricsPayload(CONTENT_METRICS, currentFormData)
      const leadGenMetrics = buildMetricsPayload(LEADGEN_METRICS, currentFormData)

      const payload: any = {
        client_id: selectedClientId,
        week_start: selectedWeek,
        week_end: weekInfo?.weekEnd || getWeekEnd(selectedWeek),
        week_label: weekInfo?.label || getWeekLabel(selectedWeek),
      }

      // Every save (draft or submit) marks the data as submitted so it shows
      // on the dashboard immediately - there's no separate review/approval step.
      if (activeTab === 'content') {
        payload.content_metrics = contentMetrics
        payload.content_submitted_at = new Date().toISOString()
        payload.content_submitted_by = user?.id ?? null
      } else {
        payload.leadgen_metrics = leadGenMetrics
        payload.leadgen_submitted_at = new Date().toISOString()
        payload.leadgen_submitted_by = user?.id ?? null
      }

      const { error } = await supabase
        .from('weekly_data')
        .upsert(payload, { 
          onConflict: 'client_id,week_start',
          ignoreDuplicates: false
        })
      
      if (error) {
        console.error('Save error:', error)
        toast.error(`Save failed: ${error.message}`)
        return
      }

      // ALWAYS run high score detection and campaign totals sync safely after save
      const currentContent = activeTab === 'content' ? contentMetrics : (weeklyData?.content_metrics as Record<string, unknown> || {})
      const currentLeadgen = activeTab === 'leadgen' ? leadGenMetrics : (weeklyData?.leadgen_metrics as Record<string, unknown> || {})
      
      detectAndUpdateHighScores(selectedClientId, selectedWeek, currentContent, currentLeadgen)
        .then(newRecords => {
          if (isSubmit && newRecords.length > 0) {
            toast.success(`🏆 ${newRecords.length} new record${newRecords.length > 1 ? 's' : ''}! ${newRecords.slice(0, 2).join(', ')}${newRecords.length > 2 ? '...' : ''}`)
          }
        })
        .catch(e => console.warn('High score update failed:', e))

      // Save Draft/Submit Week just ran, so this is a genuine submission. Await
      // the rollup before refetching; otherwise the refetch can win the race and
      // briefly restore the stale pre-import totals in the UI.
      await syncAllCampaignTotals(selectedClientId, selectedWeek, true)
        .catch(e => {
          console.warn('Campaign sync failed:', e)
          toast.warning('Campaign entries were saved, but weekly totals could not be refreshed yet.')
        })

      const healthResult = await updateClientHealth(
        selectedClientId,
        selectedWeek,
        activeTab === 'content' ? contentMetrics : (weeklyData?.content_metrics as Record<string, unknown> || {}),
        activeTab === 'leadgen' ? leadGenMetrics : (weeklyData?.leadgen_metrics as Record<string, unknown> || {})
      ).catch(e => { console.warn('Health check failed:', e); return null; })

      if (isSubmit && healthResult) {
        const delta = healthResult.prevScore ? healthResult.score - healthResult.prevScore : 0
        toast(`Health Score: ${healthResult.score}${delta !== 0 ? ` (${delta > 0 ? '+' : ''}${delta})` : ''}`, {
          description: "Calculated based on weekly performance targets."
        })

        toast.success("Week submitted successfully!")
      } else {
        if (!isAutoSave) toast.success("Draft saved")
      }
      
      if (!isAutoSave) fetchData()
    } catch (error: any) {
      console.error('Unexpected error:', error)
      toast.error('Save failed: ' + (error?.message ?? 'Unknown error'))
    } finally {
      if (!isAutoSave) setSaving(false)
    }
  }

  const filteredMetrics = (metrics: Metric[]) => {
    if (!clientSettings) return metrics
    const activeIds = activeTab === 'content'
      ? clientSettings.active_content_metrics
      : clientSettings.active_leadgen_metrics
    // null means not yet configured — show all metrics
    if (activeIds === null || activeIds === undefined) return metrics
    const contentImpressionIds = new Set(['C10', 'C26', 'C36', 'C37'])
    const impressionsEnabled = activeTab === 'content' && activeIds.includes('C10')
    return metrics.filter(m => activeIds.includes(m.id) || (impressionsEnabled && contentImpressionIds.has(m.id)))
  }

  const contentEnabled = clientSettings?.content_enabled ?? true
  const leadgenEnabled = clientSettings?.leadgen_enabled ?? true

  useEffect(() => {
    if (!clientSettings) return
    if (activeTab === 'content' && !contentEnabled && leadgenEnabled) setActiveTab('leadgen')
    if (activeTab === 'leadgen' && !leadgenEnabled && contentEnabled) setActiveTab('content')
  }, [clientSettings, activeTab, contentEnabled, leadgenEnabled])

  const groupedMetrics = (metrics: Metric[]) => {
    const groups: Record<string, Metric[]> = {}
    const lastWeek = isLastWeekOfMonth(selectedWeek)
    metrics.forEach(m => {
      if (m.group === 'Delivery & Reporting' && !lastWeek) return
      if (!groups[m.group]) groups[m.group] = []
      groups[m.group].push(m)
    })
    return groups
  }

  const toggleCampaignStatus = async (campaignId: string, currentStatus: string) => {
    if (!selectedClientId) return
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
    await supabase
      .from('campaigns')
      .update({ status: newStatus })
      .eq('id', campaignId)
      .eq('client_id', selectedClientId)
    await fetchData()
  }

  const deleteCampaign = async (campaignId: string, name: string) => {
    if (!selectedClientId) return
    const confirmed = window.confirm(
      `Delete campaign "${name}"? This will also delete all weekly data for this campaign. This cannot be undone.`
    )
    if (!confirmed) return

    await supabase
      .from('campaign_weekly_data')
      .delete()
      .eq('campaign_id', campaignId)
      .eq('client_id', selectedClientId)

    await supabase
      .from('campaigns')
      .delete()
      .eq('id', campaignId)
      .eq('client_id', selectedClientId)

    toast.success(`Campaign "${name}" deleted.`)
    await fetchData()
  }


  const renderContentQualitative = () => (
    <div className="mt-8 border-t pt-8">
      <h2 className="text-xl font-black tracking-tight uppercase mb-4">Qualitative</h2>
      <div className="grid grid-cols-1 gap-4">
        {CONTENT_METRICS.filter(m => m.group === 'Qualitative').map(m => {
          const data = formData[m.id] || {}
          const score = highScores.find(s => s.metric_id === m.id)
          const prev = (previousWeeklyData?.content_metrics as Record<string, Record<string, unknown>>)?.[m.id]
          return (
            <MetricCard
              key={m.id}
              metric={m}
              value={data.value}
              target={data.target}
              weeklyTarget={weeklyTargets[m.id]}
              monthlyTarget={monthlyTargets[m.id]}
              previousValue={prev?.value as number | string | undefined}
              lifetimeHigh={score?.lifetime_high ?? undefined}
              lifetimeHighWeek={formatWeekDate(score?.achieved_week ?? undefined)}
              onChange={(v) => handleMetricChange(m.id, 'value', v)}
              onNoteChange={(n) => handleMetricChange(m.id, 'note', n)}
              note={data.note}
              allValues={Object.entries(formData).reduce((acc, [k, v]: [string, any]) => ({ ...acc, [k]: v.value }), {})}
            />
          )
        })}
      </div>
    </div>
  )

  const renderLeadgenQualitative = () => (
    <div className="mt-8 border-t pt-8">
      <h2 className="text-xl font-black tracking-tight uppercase mb-4">Qualitative</h2>
      <div className="grid grid-cols-1 gap-4">
        {LEADGEN_METRICS.filter(m => m.group === 'Qualitative').map(m => {
          const data = formData[m.id] || {}
          const score = highScores.find(s => s.metric_id === m.id)
          const prev = (previousWeeklyData?.leadgen_metrics as Record<string, Record<string, unknown>>)?.[m.id]
          return (
            <MetricCard
              key={m.id}
              metric={m}
              value={data.value}
              target={data.target}
              weeklyTarget={weeklyTargets[m.id]}
              monthlyTarget={monthlyTargets[m.id]}
              previousValue={prev?.value as number | string | undefined}
              lifetimeHigh={score?.lifetime_high ?? undefined}
              lifetimeHighWeek={formatWeekDate(score?.achieved_week ?? undefined)}
              onChange={(v) => handleMetricChange(m.id, 'value', v)}
              onNoteChange={(n) => handleMetricChange(m.id, 'note', n)}
              note={data.note}
              allValues={Object.entries(formData).reduce((acc, [k, v]: [string, any]) => ({ ...acc, [k]: v.value }), {})}
            />
          )
        })}
      </div>
    </div>
  )


  const renderMetrics = (metrics: Metric[]) => {
    const groups = groupedMetrics(filteredMetrics(metrics))
    return (
      <Accordion type="multiple" defaultValue={Object.keys(groups)} className="space-y-4">
        {Object.entries(groups).map(([group, groupMetrics]) => {
          const editable = groupMetrics.filter(metric => metric.type !== 'auto')
          const completed = editable.filter(metric => {
            const value = formData[metric.id]?.value
            return value !== '' && value !== null && value !== undefined
          }).length
          return (
          <AccordionItem key={group} value={group} className="border rounded-lg bg-card overflow-hidden">
            <AccordionTrigger className="px-4 py-3 hover:bg-muted/30 hover:no-underline">
              <span className="flex items-center gap-3 font-bold text-lg">{group}<Badge variant="outline" className={completed === editable.length ? "border-emerald-300 bg-emerald-50 text-emerald-700" : ""}>{completed}/{editable.length}</Badge></span>
            </AccordionTrigger>
            <AccordionContent className="p-4 pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
                {groupMetrics.map(m => {
                  const data = formData[m.id] || {}
                  const score = highScores.find(s => s.metric_id === m.id)
                  const prev = activeTab === 'content'
                    ? (previousWeeklyData?.content_metrics as Record<string, Record<string, unknown>>)?.[m.id]
                    : (previousWeeklyData?.leadgen_metrics as Record<string, Record<string, unknown>>)?.[m.id]

                  const val = data.value
                  const weekPeriod = formatWeekPeriod(selectedWeek)
                  
                  return (
                    <div key={m.id} id={`metric-${m.id}`} className="scroll-mt-44">
                    <MetricCard
                      metric={m}
                      value={val}
                      target={data.target}
                      weeklyTarget={weeklyTargets[m.id]}
                      monthlyTarget={monthlyTargets[m.id]}
                      previousValue={prev?.value as number | string | undefined}
                      lifetimeHigh={score?.lifetime_high ?? undefined}
                      lifetimeHighWeek={formatWeekDate(score?.achieved_week ?? undefined)}
                      onChange={(v) => handleMetricChange(m.id, 'value', v)}
                      onNoteChange={(n) => handleMetricChange(m.id, 'note', n)}
                      note={data.note}
                      allValues={Object.entries(formData).reduce((acc, [k, v]: [string, any]) => ({ ...acc, [k]: v.value }), {})}
                    /></div>
                  )
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        )})}
      </Accordion>
    )
  }

  const selectedClient = clients.find(c => c.id === selectedClientId)
  const selectedWeekInfo = weekOptions.find(w => w.weekStart === selectedWeek)
  const activeMetrics = filteredMetrics(activeTab === 'content' ? CONTENT_METRICS : LEADGEN_METRICS)
    .filter(metric => metric.type !== 'auto' && metric.group !== 'Qualitative')
  const completedMetrics = activeMetrics.filter(metric => {
    const value = formData[metric.id]?.value
    return value !== '' && value !== null && value !== undefined
  })
  const missingMetrics = activeMetrics.filter(metric => !completedMetrics.includes(metric))
  const completeness = activeMetrics.length ? Math.round((completedMetrics.length / activeMetrics.length) * 100) : 0
  const jumpToNextMissing = () => {
    const next = missingMetrics[0]
    if (!next) return
    document.getElementById(`metric-${next.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    window.setTimeout(() => document.querySelector<HTMLElement>(`#metric-${next.id} input, #metric-${next.id} textarea`)?.focus(), 450)
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden bg-muted/10">
      {/* Page Header */}
      <div className="p-6 md:py-4 md:px-8 border-b bg-background">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <button onClick={() => navigate({ to: '/' })} className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
              </button>
            </div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
              Data Entry
              {selectedClient && (
                <>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  <span className="text-gold">{selectedClient.name}</span>
                </>
              )}
            </h1>
          </div>
          {selectedClient && selectedWeekInfo && (
            <div className="flex flex-col items-end">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Current Week</span>
              <span className="font-bold">{selectedWeekInfo.label}</span>
            </div>
          )}
        </div>
      </div>

      {/* AutoSave Bar Sticky Below Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-2 flex justify-between items-center">
        <SaveIndicator status={contentSaveStatus} lastSaved={contentLastSaved} onRetry={retryContentSave} />
        <div className="flex gap-2">
          <Button
            onClick={() => handleSave(false, false)}
            disabled={saving}
            variant="outline"
            className="text-xs h-8"
          >
            {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
            Save Draft
          </Button>
          <Button
            onClick={() => handleSave(true, false)}
            disabled={saving}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-8"
          >
            {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
            Submit Week
          </Button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-background p-4 rounded-xl border shadow-sm mx-auto max-w-7xl">
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
          <div className="space-y-1.5 min-w-[240px]">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Select Week</Label>
            <Select value={selectedWeek} onValueChange={handleWeekChange}>
              <SelectTrigger className="bg-background font-bold h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {weekOptions.map(w => <SelectItem key={w.weekStart} value={w.weekStart}>{w.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 min-w-[240px]">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Select Client</Label>
            <Select value={selectedClientId || ""} onValueChange={handleClientChange}>
              <SelectTrigger className="bg-background font-bold h-11">
                <SelectValue placeholder="Choose client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name} - {c.company}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-4">
            <Sheet>
                <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="font-bold border-gold/30 hover:bg-gold-soft">
                    <Pin className="w-4 h-4 mr-2 text-gold" /> Context
                </Button>
                </SheetTrigger>
                <SheetContent className="w-[400px] sm:w-[540px]">
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-2"><ScrollText className="w-5 h-5 text-gold" /> Client Context & Notes</SheetTitle>
                </SheetHeader>
                <div className="mt-8 space-y-4">
                    {contextNotes.map(note => (
                    <div key={note.id} className={cn(
                        "p-4 rounded-lg border",
                        note.is_pinned ? "bg-gold/5 border-gold/30" : "bg-muted/30"
                    )}>
                        <p className="text-sm font-medium leading-relaxed mb-2">{note.content}</p>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase">
                        {note.author?.full_name} · {note.created_at ? new Date(note.created_at).toLocaleDateString() : ''}
                        </p>
                    </div>
                    ))}
                    {contextNotes.length === 0 && <p className="text-muted-foreground italic text-center py-12">No context notes found.</p>}
                </div>
                </SheetContent>
            </Sheet>
            <div className="flex gap-2">
                <Button onClick={() => handleSave(true)} disabled={saving || loading || (!contentEnabled && !leadgenEnabled)} className="bg-gold text-black hover:bg-gold/90 font-bold">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                    Submit Week
                </Button>
            </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v: any) => handleTabChange(v)} className="space-y-6">
        <TabsList className="bg-muted/50 p-1 h-auto grid grid-cols-2 max-w-md mx-auto">
          <TabsTrigger value="content" disabled={!contentEnabled} className="py-2.5 font-bold data-[state=active]:bg-gold data-[state=active]:text-black">
            Content
          </TabsTrigger>
          <TabsTrigger value="leadgen" disabled={!leadgenEnabled} className="py-2.5 font-bold data-[state=active]:bg-gold data-[state=active]:text-black">
            Lead Gen
          </TabsTrigger>
        </TabsList>

        {selectedClientId && !loading && (
          <div className="sticky top-12 z-10 mx-auto flex max-w-7xl flex-col gap-3 rounded-xl border bg-background/95 p-4 shadow-sm backdrop-blur md:flex-row md:items-center">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                <span className="font-black uppercase tracking-wider">{activeTab === 'content' ? 'Content' : 'Lead gen'} completeness</span>
                <span className={cn("font-bold", completeness === 100 ? "text-emerald-600" : "text-amber-700")}>{completedMetrics.length}/{activeMetrics.length} fields · {completeness}%</span>
              </div>
              <Progress value={completeness} className="h-2" />
            </div>
            <Button type="button" variant="outline" disabled={!missingMetrics.length} onClick={jumpToNextMissing} className="shrink-0">
              {missingMetrics.length ? `Next missing: ${missingMetrics[0].name}` : 'All fields complete'}
              {missingMetrics.length ? <ChevronRight className="ml-2 h-4 w-4" /> : <Check className="ml-2 h-4 w-4 text-emerald-600" />}
            </Button>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="w-10 h-10 animate-spin text-gold" />
            <p className="text-muted-foreground font-medium">Loading metrics data...</p>
          </div>
        ) : !contentEnabled && !leadgenEnabled ? (
          <div className="rounded-lg border border-dashed py-20 text-center text-muted-foreground">
            No services are enabled for this client. Enable Content or Lead Gen in Settings → Metric Fields.
          </div>
        ) : (
          <>
            <TabsContent value="content" forceMount>
              {renderMetrics(CONTENT_METRICS.filter(m => m.group !== 'Qualitative'))}
              {renderContentQualitative()}
            </TabsContent>
            <TabsContent value="leadgen" forceMount>
              <LeadGenCampaignEntry
                selectedClientId={selectedClientId}
                selectedWeek={selectedWeek}
                weekOptions={weekOptions}
                weeklyData={weeklyData}
                activeTab={activeTab}
                campaigns={campaigns}
                setCampaigns={setCampaigns}
                campaignWeeklyData={campaignWeeklyData}
                formData={formData}
                handleMetricChange={handleMetricChange}
                user={user}
                contentSaveStatus={contentSaveStatus}
                fetchData={fetchData}
                toggleCampaignStatus={toggleCampaignStatus}
                deleteCampaign={deleteCampaign}
                showInactive={showInactive}
                setShowInactive={setShowInactive}
                setEditingCampaign={setEditingCampaign}
                registerCampaignSave={registerCampaignSave}
              />
              {renderLeadgenQualitative()}
            </TabsContent>

          </>
        )}
      </Tabs>
      {editingCampaign && (
        <EditCampaignModal
          campaign={editingCampaign}
          onSave={() => fetchData()}
          onClose={() => setEditingCampaign(null)}
        />
      )}
    </div>
  </div>
  )
}
