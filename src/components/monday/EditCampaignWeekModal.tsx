import React, { useState } from 'react'
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"
import { syncAllCampaignTotals } from "@/utils/campaignSync"
import { parseWaalaxyExport, type WaalaxyImportSummary } from "@/utils/waalaxyImport"

const FIELDS = [
  { key: 'conn_requests_sent',  label: 'Connection Requests Sent' },
  { key: 'accepted',            label: 'Accepted Invitations' },
  { key: 'answered',            label: 'Answered / Responded' },
  { key: 'positive_replies',    label: 'Positive Replies' },
  { key: 'negative_replies',    label: 'Negative Replies' },
  { key: 'hot_leads',           label: 'Hot Leads' },
  { key: 'meetings_booked',     label: 'Meetings Booked' },
  { key: 'existing_conn_sent',  label: 'Existing Conn Msgs Sent' },
  { key: 'existing_conn_replied', label: 'Existing Conn Replied' },
]

export function EditCampaignWeekModal({ campaign, weekData, weekStart, weekLabel, onSave, onClose }: {
  campaign: any
  weekData: any        // existing row or null
  weekStart: string
  weekLabel: string
  onSave: () => void
  onClose: () => void
}) {
  const init: Record<string, string> = {}
  FIELDS.forEach(f => { init[f.key] = weekData?.[f.key] != null ? String(weekData[f.key]) : '' })
  init.notes = weekData?.notes ?? ''

  const [form, setForm] = useState(init)
  const [saving, setSaving] = useState(false)
  const [importSummary, setImportSummary] = useState<WaalaxyImportSummary | null>(null)

  const weekEnd = weekData?.week_end ?? (() => {
    const d = new Date(`${weekStart}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + 6)
    return d.toISOString().split('T')[0]
  })()

  const handleWaalaxyImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const summary = parseWaalaxyExport(await file.text(), weekStart, weekEnd)
      setForm(current => ({
        ...current,
        conn_requests_sent: String(summary.conn_requests_sent),
        accepted: String(summary.accepted),
        answered: String(summary.answered),
      }))
      setImportSummary(summary)
      toast.success(`Waalaxy CSV imported for ${weekStart} to ${weekEnd}. Review the remaining fields, then click Save.`)
    } catch (error) {
      setImportSummary(null)
      toast.error(error instanceof Error ? error.message : 'Could not import the Waalaxy CSV.')
    } finally {
      event.target.value = ''
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload: Record<string, any> = {
        campaign_id: campaign.id,
        client_id: campaign.client_id,
        week_start: weekStart,
        week_end: weekEnd,
        week_label: weekLabel,
        notes: form.notes || null,
      }
      FIELDS.forEach(f => {
        const v = form[f.key]
        payload[f.key] = v !== '' && !isNaN(Number(v)) ? Number(v) : null
      })

      const { data: savedRow, error } = await supabase
        .from('campaign_weekly_data')
        .upsert(payload, { onConflict: 'campaign_id,week_start' })
        .select('campaign_id, client_id, week_start, conn_requests_sent, accepted, answered')
        .single()

      if (error) { toast.error('Save failed: ' + error.message); setSaving(false); return }

      const savedValuesMatch = savedRow
        && savedRow.campaign_id === campaign.id
        && savedRow.client_id === campaign.client_id
        && savedRow.week_start === weekStart
        && Number(savedRow.conn_requests_sent ?? 0) === Number(payload.conn_requests_sent ?? 0)
        && Number(savedRow.accepted ?? 0) === Number(payload.accepted ?? 0)
        && Number(savedRow.answered ?? 0) === Number(payload.answered ?? 0)
      if (!savedValuesMatch) {
        throw new Error('Campaign save could not be verified. Please retry before closing this window.')
      }

      // Re-sync campaign totals into weekly_data. This is a genuine user save, so
      // it's fine (and correct) for this to mark the week as submitted.
      try {
        await syncAllCampaignTotals(campaign.client_id, weekStart, true)
      } catch (syncError) {
        // The campaign row itself has been read back and verified. A rollup error
        // should not misreport that primary save as lost.
        console.error('Campaign saved, but aggregate sync failed:', syncError)
        toast.warning('Campaign data saved, but weekly totals could not be refreshed yet.')
      }

      toast.success('Campaign week data saved.')
      onSave()
      onClose()
    } catch (e: any) {
      toast.error(e.message ?? 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
    }}>
      <div style={{
        background: 'white', borderRadius: '12px', padding: '28px',
        width: '440px', maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ fontWeight: '800', fontSize: '17px', marginBottom: '4px' }}>
          Edit Campaign Week
        </div>
        <div style={{ fontSize: '12px', color: '#888', fontWeight: '600', marginBottom: '20px' }}>
          {campaign.name} · {weekLabel}
        </div>

        <div style={{
          marginBottom: '20px', padding: '14px', border: '1px solid #F2D27C',
          borderRadius: '9px', background: '#FFF9E9',
        }}>
          <label htmlFor="waalaxy-csv-import" style={{
            display: 'block', marginBottom: '5px', fontSize: '12px',
            fontWeight: '800', color: '#3F351C',
          }}>
            Import from Waalaxy CSV
          </label>
          <p style={{ margin: '0 0 10px', color: '#716442', fontSize: '11px', lineHeight: '1.45' }}>
            Fills Requests Sent, Accepted and Answered for this week. Positive/negative replies,
            hot leads and meetings booked still need manual review.
          </p>
          <input
            id="waalaxy-csv-import"
            type="file"
            accept=".csv,text/csv"
            onChange={handleWaalaxyImport}
            style={{
              display: 'block', width: '100%', fontSize: '12px', color: '#555',
              background: 'white', border: '1px solid #E5D7AF', borderRadius: '7px',
              padding: '7px', boxSizing: 'border-box',
            }}
          />
          {importSummary && (
            <div role="status" style={{
              marginTop: '10px', padding: '9px 10px', borderRadius: '7px',
              background: '#ECFDF3', border: '1px solid #B7E4C7',
              color: '#17653A', fontSize: '11px', lineHeight: '1.5',
            }}>
              <strong>Imported {weekStart} to {weekEnd}:</strong>{' '}
              {importSummary.conn_requests_sent} requests sent, {importSummary.accepted} accepted,
              {' '}{importSummary.answered} answered from {importSummary.totalRows} prospects
              {importSummary.skippedRows > 0 ? ` (${importSummary.skippedRows} blank rows skipped)` : ''}.
            </div>
          )}
        </div>

        {FIELDS.map(f => (
          <div key={f.key} style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '11px', fontWeight: '700', color: '#666', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {f.label}
            </label>
            <input
              type="number"
              min="0"
              value={form[f.key]}
              onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
              onWheel={e => e.currentTarget.blur()}
              placeholder="-"
              style={{
                width: '100%', padding: '7px 10px', border: '1px solid #E5E5E5',
                borderRadius: '7px', fontSize: '14px', boxSizing: 'border-box',
              }}
            />
          </div>
        ))}

        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '11px', fontWeight: '700', color: '#666', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Notes
          </label>
          <textarea
            value={form.notes}
            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            rows={2}
            placeholder="Optional notes..."
            style={{
              width: '100%', padding: '7px 10px', border: '1px solid #E5E5E5',
              borderRadius: '7px', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '9px 18px', border: '1px solid #E5E5E5', borderRadius: '8px',
              background: 'white', fontWeight: '600', cursor: 'pointer', fontSize: '13px',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '9px 22px', background: saving ? '#E5E5E5' : '#FFC947',
              border: 'none', borderRadius: '8px', fontWeight: '700',
              cursor: saving ? 'not-allowed' : 'pointer', fontSize: '13px',
            }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
