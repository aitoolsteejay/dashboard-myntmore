import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/lib/auth"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { 
  History,
  Check,
  Save,
  Loader2,
  Linkedin,
  Instagram,
  Globe,
  PlusCircle,
  TrendingUp
} from "lucide-react"
import {
  MM_LINKEDIN_METRICS,
  MM_INSTAGRAM_METRICS,
  MM_WEBSITE_METRICS,
  MM_OTHER_METRICS,
  MM_ADS_METRICS,
  CompanyMetric
} from "@/data/company_metrics"
import { BackButton } from "@/components/ui/BackButton"
import { getWeekOptions } from "@/utils/weekUtils"
import { useWorkspace } from "@/lib/workspace"
import { useAutoSave } from "@/hooks/useAutoSave"
import { SaveIndicator } from "@/components/ui/SaveIndicator"

export function MMContentPage({ embedded }: { embedded?: boolean } = {}) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('linkedin')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const weekOptions = useMemo(() => getWeekOptions(12), [])
  const { selectedWeek, setSelectedWeek } = useWorkspace()
  const { triggerSave, flushPendingSave, retrySave, saveStatus, lastSaved } = useAutoSave({
    table: 'mm_weekly_data',
    matchColumns: { week_start: selectedWeek },
    debounceMs: 1500,
    onSaveError: message => toast.error(`MM Content save failed: ${message}`),
  })

  const [formData, setFormData] = useState<any>({
    linkedin: {},
    instagram: {},
    website: {},
    quora: {},
    reddit: {},
    ads: {}
  })
  const fetchRequestRef = React.useRef(0)

  const handleWeekChange = async (week: string) => {
    const saved = await flushPendingSave()
    if (!saved) {
      toast.error('Could not save the current week. Retry before switching weeks.')
      return
    }
    setSelectedWeek(week)
  }

  useEffect(() => {
    fetchWeeklyData()
  }, [selectedWeek])

  const fetchWeeklyData = async () => {
    const requestId = ++fetchRequestRef.current
    const requestedWeek = selectedWeek
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('mm_weekly_data')
        .select('*')
        .eq('week_start', requestedWeek)
        .maybeSingle()

      if (error) throw error
      if (requestId !== fetchRequestRef.current) return

      if (data) {
        const row = data as any
        setFormData({
          linkedin: row.linkedin || {},
          instagram: row.instagram || {},
          website: row.website || {},
          quora: row.quora || {},
          reddit: row.reddit || {},
          ads: row.ads || {}
        })
      } else {
        setFormData({
          linkedin: {},
          instagram: {},
          website: {},
          quora: {},
          reddit: {},
          ads: {}
        })
      }
    } catch (error: any) {
      if (requestId === fetchRequestRef.current) toast.error(error.message)
    } finally {
      if (requestId === fetchRequestRef.current) setLoading(false)
    }
  }

  const updateMetric = (section: string, id: string, field: 'value' | 'target', value: any) => {
    if (!selectedWeek) {
      toast.error('Please select a week first.')
      return
    }
    setFormData((prev: any) => {
      const updatedSection = {
        ...prev[section],
        [id]: { ...(prev[section][id] || {}), [field]: value }
      }
      if (section === 'linkedin' && field === 'value' && (id === 'MML10' || id === 'MML11' || id === 'MML01')) {
        // Presence check (has either split field actually been entered?), not a
        // truthy check — `0 || 0` is falsy and would wrongly fall back to a
        // stale MML02, the same class of bug the ClientPortalPage/dashboard/
        // export/mmHighScores versions of this exact fallback already avoid.
        const inNetworkRaw = updatedSection.MML10?.value
        const outOfNetworkRaw = updatedSection.MML11?.value
        const hasSplit = (inNetworkRaw !== undefined && inNetworkRaw !== '') || (outOfNetworkRaw !== undefined && outOfNetworkRaw !== '')
        const inNetwork = Number(inNetworkRaw || 0)
        const outOfNetwork = Number(outOfNetworkRaw || 0)
        const total = hasSplit ? inNetwork + outOfNetwork : Number(updatedSection.MML02?.value || 0)
        updatedSection.MML02 = { ...(updatedSection.MML02 || {}), value: total }
        // MML12 ("Avg Impressions Per Post") is otherwise only ever computed
        // live at render time and never actually saved — persist it too so a
        // future reader that trusts the stored field (instead of recomputing,
        // the way every current reader carefully does) doesn't see a stale blank.
        const posts = Number(updatedSection.MML01?.value || 0)
        const avg = posts > 0 ? Math.round((total / posts) * 100) / 100 : 0
        updatedSection.MML12 = { ...(updatedSection.MML12 || {}), value: avg }
      }
      const updated = { ...prev, [section]: updatedSection }

      const weekInfo = weekOptions.find(w => w.weekStart === selectedWeek)

      triggerSave({
        week_end: weekInfo?.weekEnd || '',
        week_label: weekInfo?.label || '',
        [section]: updatedSection,
        submitted_by: user?.id
      })

      return updated
    })
  }

  const renderMetricCard = (section: string, metric: CompanyMetric) => {
    const data = formData[section][metric.id] || { value: '', target: '' }
    const isLinkedInAuto = section === 'linkedin' && (metric.id === 'MML02' || metric.id === 'MML12')
    // Presence check, not a truthy check — a real, entered "0" for both split
    // fields must not fall back to a stale/legacy MML02 (see updateMetric's
    // matching fix above for the full explanation).
    const inNetworkRaw = formData.linkedin.MML10?.value
    const outOfNetworkRaw = formData.linkedin.MML11?.value
    const hasSplit = (inNetworkRaw !== undefined && inNetworkRaw !== '') || (outOfNetworkRaw !== undefined && outOfNetworkRaw !== '')
    const inNetwork = Number(inNetworkRaw || 0)
    const outOfNetwork = Number(outOfNetworkRaw || 0)
    const storedTotal = Number(formData.linkedin.MML02?.value || 0)
    const totalImpressions = hasSplit ? inNetwork + outOfNetwork : storedTotal
    const posts = Number(formData.linkedin.MML01?.value || 0)
    const autoValue = metric.id === 'MML02'
      ? totalImpressions
      : posts > 0 ? Math.round((totalImpressions / posts) * 100) / 100 : 0
    
    return (
      <Card key={metric.id} className="border-2 border-border/50">
        <CardContent className="p-4 space-y-3">
          <Label className="text-[10px] font-black uppercase text-muted-foreground">{metric.name}</Label>
          <div className="relative">
            {isLinkedInAuto ? (
              <div className="flex h-12 items-center justify-end rounded-md border border-gold/20 bg-gold-soft px-3 text-2xl font-black">{autoValue.toLocaleString('en-IN')}</div>
            ) : (
            <Input 
              type="number" 
              value={data.value} 
              onChange={e => updateMetric(section, metric.id, 'value', e.target.value)}
              className="h-12 text-2xl font-black pr-8"
            />
            )}
            {(metric.unit || metric.type === 'percentage') && <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">{metric.unit || '%'}</span>}
          </div>
          {metric.hasTarget && (
            <div className="flex gap-2 pt-2 border-t border-border/30">
              <div className="flex-1 space-y-1">
                <Label className="text-[9px] uppercase font-bold opacity-50">Target</Label>
                <Input 
                  type="number" 
                  value={data.target} 
                  onChange={e => updateMetric(section, metric.id, 'target', e.target.value)}
                  className="h-8 text-xs font-bold"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        {!embedded && <BackButton to="/dashboard" label="Back to Dashboard" />}
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-tight text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-full">
            <Globe className="w-3 h-3 text-gold" />
            <span>MM Company Content</span>
            <span className="text-foreground ml-2">Brand & Digital Presence</span>
        </div>
      </div>

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-6 rounded-xl border shadow-sm">
        <div>
          <h1 className="text-3xl font-black tracking-tight">MM COMPANY CONTENT</h1>
          <p className="text-muted-foreground font-medium">Tracking Myntmore's brand growth and traffic.</p>
        </div>
        <div className="flex flex-col gap-1 min-w-[240px]">
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
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/50 p-1 h-auto grid grid-cols-5 max-w-3xl">
          <TabsTrigger value="linkedin" className="py-2.5 font-bold data-[state=active]:bg-gold data-[state=active]:text-black gap-2">
            <Linkedin className="w-4 h-4" /> LinkedIn
          </TabsTrigger>
          <TabsTrigger value="instagram" className="py-2.5 font-bold data-[state=active]:bg-gold data-[state=active]:text-black gap-2">
            <Instagram className="w-4 h-4" /> Instagram
          </TabsTrigger>
          <TabsTrigger value="website" className="py-2.5 font-bold data-[state=active]:bg-gold data-[state=active]:text-black gap-2">
            <Globe className="w-4 h-4" /> Website
          </TabsTrigger>
          <TabsTrigger value="other" className="py-2.5 font-bold data-[state=active]:bg-gold data-[state=active]:text-black gap-2">
            <PlusCircle className="w-4 h-4" /> Other Channels
          </TabsTrigger>
          <TabsTrigger value="ads" className="py-2.5 font-bold data-[state=active]:bg-gold data-[state=active]:text-black gap-2">
            <TrendingUp className="w-4 h-4" /> Ads
          </TabsTrigger>
        </TabsList>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-gold" />
            <p className="text-muted-foreground font-medium">Fetching company records...</p>
          </div>
        ) : (
          <div className="space-y-8">
            <TabsContent value="linkedin" className="mt-0">
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {MM_LINKEDIN_METRICS.map(m => renderMetricCard('linkedin', m))}
                </div>
            </TabsContent>
            <TabsContent value="instagram" className="mt-0">
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {MM_INSTAGRAM_METRICS.map(m => renderMetricCard('instagram', m))}
                </div>
            </TabsContent>
            <TabsContent value="website" className="mt-0">
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {MM_WEBSITE_METRICS.map(m => renderMetricCard('website', m))}
                </div>
            </TabsContent>
            <TabsContent value="other" className="mt-0 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Looked up by id, not array position — MM_OTHER_METRICS reordering
                        or growing used to silently reassign a metric to the wrong
                        channel's formData bucket (e.g. Medium's data landing in
                        `formData.reddit`) since these used to be indexed [0]/[1]/[2]. */}
                    {renderMetricCard('quora', MM_OTHER_METRICS.find(m => m.id === 'MMO01')!)}
                    {renderMetricCard('reddit', MM_OTHER_METRICS.find(m => m.id === 'MMO05')!)}
                    {renderMetricCard('quora', MM_OTHER_METRICS.find(m => m.id === 'MMO06')!)}
                </div>
            </TabsContent>
            <TabsContent value="ads" className="mt-0 space-y-6">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 border-b pb-1">Google Ads</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {MM_ADS_METRICS.filter(m => ['MMA01','MMA03','MMA04','MMA09','MMA11'].includes(m.id)).map(m => renderMetricCard('ads', m))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 border-b pb-1">Meta Ads</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {MM_ADS_METRICS.filter(m => ['MMA06','MMA10','MMA12'].includes(m.id)).map(m => renderMetricCard('ads', m))}
                  </div>
                </div>
            </TabsContent>

            <div className="flex justify-end gap-3 py-6 border-t">
              <div className="flex items-center">
                <SaveIndicator status={saveStatus} lastSaved={lastSaved} onRetry={retrySave} />
              </div>
            </div>
          </div>
        )}
      </Tabs>
    </div>
  )
}
