import { useEffect, useRef, useCallback, useState } from 'react'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabase } from '../integrations/supabase/client'

// Cached token so the beforeunload handler (synchronous) can attach auth headers
let _cachedAccessToken: string | null = null
supabase.auth.getSession().then(({ data }) => {
  _cachedAccessToken = data.session?.access_token ?? null
})
supabase.auth.onAuthStateChange((_event, session) => {
  _cachedAccessToken = session?.access_token ?? null
})

interface AutoSaveOptions {
  table: string
  matchColumns: Record<string, string>  // e.g. { client_id: 'abc', week_start: '2026-05-11' }
  debounceMs?: number                   // default 1500ms
  onSaveSuccess?: (cols: Record<string, string>) => void
  onSaveError?: (err: string) => void
  saveFn?: (payload: Record<string, any>) => Promise<void> // Custom save logic (e.g. RPC)
}

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

export function useAutoSave(options: AutoSaveOptions) {
  const {
    table,
    matchColumns,
    debounceMs = 1500,
    onSaveSuccess,
    onSaveError,
    saveFn
  } = options

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [pendingData, setPendingData] = useState<Record<string, any> | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isSavingRef = useRef(false)
  const failedSaveRef = useRef<{ data: Record<string, any>; cols: Record<string, any> } | null>(null)
  // Carries the match columns (client_id/week_start) alongside the queued data so a
  // save that was in flight for one client can never flush another client's edits
  // into its own row once it completes. See save()'s finally block below.
  const pendingAfterSave = useRef<{ data: Record<string, any>; cols: Record<string, any> } | null>(null)

  // Reset save status when match columns change
  useEffect(() => {
    setSaveStatus('idle')
    setLastSaved(null)
  }, [JSON.stringify(matchColumns)])

  const save = useCallback(async (data: Record<string, any>, cols: Record<string, any> = matchColumns) => {
    // Guard: Ensure all cols have values (not empty, undefined or null)
    const hasMissingKeys = Object.entries(cols).some(([key, val]) => !val)
    if (hasMissingKeys) {
      console.warn('Auto-save skipped: missing match column values', cols)
      return
    }

    // If currently saving, queue the latest data (with the columns it belongs to) for after
    if (isSavingRef.current) {
      pendingAfterSave.current = { data, cols }
      return
    }

    isSavingRef.current = true
    setSaveStatus('saving')

    try {
      const payload: Record<string, any> = {
        ...cols,
        ...data,
      }

      if (saveFn) {
        await saveFn(payload)
      } else {
        // Use upsert with onConflict for atomicity
        const { error } = await (supabase as any)
          .from(table)
          .upsert(payload, {
            onConflict: Object.keys(cols).join(','),
            ignoreDuplicates: false  // always update
          })

        if (error) throw error
      }

      setSaveStatus('saved')
      setLastSaved(new Date())
      setPendingData(null)
      failedSaveRef.current = null
      onSaveSuccess?.(cols)

    } catch (err: any) {
      setSaveStatus('error')
      failedSaveRef.current = { data, cols }
      onSaveError?.(err.message)
      console.error('Auto-save failed:', err)
    } finally {
      isSavingRef.current = false

      // If data changed while we were saving, save again immediately — using the
      // columns that data was queued for, not whatever client/week is selected now.
      if (pendingAfterSave.current) {
        const next = pendingAfterSave.current
        pendingAfterSave.current = null
        setTimeout(() => save(next.data, next.cols), 100)
      }
    }
  }, [table, matchColumns, onSaveSuccess, onSaveError])

  // Debounced trigger - call this whenever form data changes
  const triggerSave = useCallback((data: Record<string, any>) => {
    setPendingData(data)
    setSaveStatus('pending')

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      save(data)
    }, debounceMs)
  }, [save, debounceMs])

  // Force immediate save (on blur, tab change, page unload)
  const saveNow = useCallback((data: Record<string, any>) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    save(data)
  }, [save])

  const retrySave = useCallback(() => {
    const failedSave = failedSaveRef.current
    if (!failedSave) return
    if (timerRef.current) clearTimeout(timerRef.current)
    save(failedSave.data, failedSave.cols)
  }, [save])

  // Cancel any pending auto-save timer
  const cancelPendingAutoSave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Save on page unload - uses fetch with keepalive (supports auth headers, unlike sendBeacon)
  useEffect(() => {
    const handleUnload = () => {
      if (!pendingData || !_cachedAccessToken) return
      const url = `${SUPABASE_URL}/rest/v1/${table}`
      const payload = JSON.stringify({
        ...matchColumns,
        ...pendingData,
        updated_at: new Date().toISOString()
      })
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${_cachedAccessToken}`,
          'Content-Profile': 'myntmore',
          'Prefer': 'resolution=merge-duplicates',
        },
        body: payload,
        keepalive: true,
      })
    }

    window.addEventListener('beforeunload', handleUnload)
    return () => window.removeEventListener('beforeunload', handleUnload)
  }, [pendingData, table, matchColumns])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return { triggerSave, saveNow, retrySave, saveStatus, lastSaved, cancelPendingAutoSave }
}
