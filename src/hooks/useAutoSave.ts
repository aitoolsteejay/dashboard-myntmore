import { useEffect, useRef, useCallback, useState } from 'react'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabase } from '../integrations/supabase/client'

// Cached token so the beforeunload handler (synchronous) can attach auth headers.
let cachedAccessToken: string | null = null
supabase.auth.getSession().then(({ data }) => {
  cachedAccessToken = data.session?.access_token ?? null
})
supabase.auth.onAuthStateChange((_event, session) => {
  cachedAccessToken = session?.access_token ?? null
})

interface AutoSaveOptions {
  table: string
  matchColumns: Record<string, string>
  debounceMs?: number
  onSaveSuccess?: (cols: Record<string, string>) => void
  onSaveError?: (err: string) => void
  saveFn?: (payload: Record<string, any>) => Promise<void>
}

type ScopedSave = {
  data: Record<string, any>
  cols: Record<string, string>
}

type SaveWaiter = (saved: boolean) => void

type QueuedSave = ScopedSave & {
  waiters: SaveWaiter[]
}

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

const scopeKey = (cols: Record<string, string>) => JSON.stringify(cols)

export function useAutoSave(options: AutoSaveOptions) {
  const { table, matchColumns, debounceMs = 1500 } = options
  const currentScopeKey = scopeKey(matchColumns)

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef<ScopedSave | null>(null)
  const failedSaveRef = useRef<ScopedSave | null>(null)
  const isSavingRef = useRef(false)
  const activeSaveRef = useRef<ScopedSave | null>(null)
  const queuedSaveRef = useRef<QueuedSave | null>(null)
  const latestSavePromiseRef = useRef<{ key: string; promise: Promise<boolean> } | null>(null)
  const mountedRef = useRef(true)
  const matchColumnsRef = useRef(matchColumns)
  const currentScopeKeyRef = useRef(currentScopeKey)
  const callbacksRef = useRef({
    onSaveSuccess: options.onSaveSuccess,
    onSaveError: options.onSaveError,
    saveFn: options.saveFn,
  })

  matchColumnsRef.current = matchColumns
  currentScopeKeyRef.current = currentScopeKey
  callbacksRef.current = {
    onSaveSuccess: options.onSaveSuccess,
    onSaveError: options.onSaveError,
    saveFn: options.saveFn,
  }

  const isCurrentScope = useCallback((cols: Record<string, string>) => (
    scopeKey(cols) === currentScopeKeyRef.current
  ), [])

  const performSave = useCallback(async (request: QueuedSave): Promise<void> => {
    isSavingRef.current = true
    activeSaveRef.current = { data: request.data, cols: request.cols }
    if (mountedRef.current && isCurrentScope(request.cols)) setSaveStatus('saving')

    let saved = false
    try {
      const payload = { ...request.cols, ...request.data }
      const { saveFn, onSaveSuccess } = callbacksRef.current

      if (saveFn) {
        await saveFn(payload)
      } else {
        const { error } = await (supabase as any)
          .from(table)
          .upsert(payload, {
            onConflict: Object.keys(request.cols).join(','),
            ignoreDuplicates: false,
          })
        if (error) throw error
      }

      saved = true
      failedSaveRef.current = null
      if (mountedRef.current && isCurrentScope(request.cols)) {
        setSaveStatus('saved')
        setLastSaved(new Date())
      }
      onSaveSuccess?.(request.cols)
    } catch (error: any) {
      failedSaveRef.current = { data: request.data, cols: request.cols }
      if (mountedRef.current && isCurrentScope(request.cols)) setSaveStatus('error')
      callbacksRef.current.onSaveError?.(error.message)
      console.error('Auto-save failed:', error)
    } finally {
      request.waiters.forEach(resolve => resolve(saved))
      isSavingRef.current = false
      activeSaveRef.current = null

      const queued = queuedSaveRef.current
      queuedSaveRef.current = null
      if (queued) void performSave(queued)
    }
  }, [isCurrentScope, table])

  const enqueueSave = useCallback((request: ScopedSave): Promise<boolean> => {
    if (Object.values(request.cols).some(value => !value)) {
      console.warn('Auto-save skipped: missing match column values', request.cols)
      if (mountedRef.current && isCurrentScope(request.cols)) setSaveStatus('error')
      return Promise.resolve(false)
    }
    const promise = new Promise<boolean>(resolve => {
      if (isSavingRef.current) {
        if (queuedSaveRef.current) {
          queuedSaveRef.current = {
            ...request,
            waiters: [...queuedSaveRef.current.waiters, resolve],
          }
        } else {
          queuedSaveRef.current = { ...request, waiters: [resolve] }
        }
        return
      }

      void performSave({ ...request, waiters: [resolve] })
    })
    latestSavePromiseRef.current = { key: scopeKey(request.cols), promise }
    return promise
  }, [isCurrentScope, performSave])

  const flushPendingSave = useCallback(async (): Promise<boolean> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const pending = pendingRef.current
    pendingRef.current = null
    if (!pending) {
      const latest = latestSavePromiseRef.current
      if (latest?.key === currentScopeKeyRef.current && (isSavingRef.current || queuedSaveRef.current)) {
        return latest.promise
      }
      return true
    }
    return enqueueSave(pending)
  }, [enqueueSave])

  const triggerSave = useCallback((data: Record<string, any>) => {
    const request = { data, cols: { ...matchColumnsRef.current } }
    pendingRef.current = request
    setSaveStatus('pending')

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      if (pendingRef.current === request) pendingRef.current = null
      void enqueueSave(request)
    }, debounceMs)
  }, [debounceMs, enqueueSave])

  const saveNow = useCallback((data: Record<string, any>): Promise<boolean> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    pendingRef.current = null
    return enqueueSave({ data, cols: { ...matchColumnsRef.current } })
  }, [enqueueSave])

  const retrySave = useCallback(() => {
    if (!failedSaveRef.current) return
    void enqueueSave(failedSaveRef.current)
  }, [enqueueSave])

  const cancelPendingAutoSave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    pendingRef.current = null
  }, [])

  // A context change must not relabel an old request as the new context's save.
  useEffect(() => {
    setSaveStatus('idle')
    setLastSaved(null)
  }, [currentScopeKey])

  // Full page closes/reloads cannot await React cleanup. Send the pending request
  // with the exact scope captured when the edit was made and the real conflict key.
  useEffect(() => {
    const handleUnload = () => {
      const pending = pendingRef.current
        ?? (queuedSaveRef.current
          ? { data: queuedSaveRef.current.data, cols: queuedSaveRef.current.cols }
          : null)
        ?? activeSaveRef.current
        ?? failedSaveRef.current
      if (!pending || !cachedAccessToken) return
      const conflictTarget = Object.keys(pending.cols).join(',')
      const url = `${SUPABASE_URL}/rest/v1/${table}?on_conflict=${encodeURIComponent(conflictTarget)}`
      const payload = JSON.stringify({
        ...pending.cols,
        ...pending.data,
        updated_at: new Date().toISOString(),
      })
      void fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${cachedAccessToken}`,
          'Content-Profile': 'myntmore',
          Prefer: 'resolution=merge-duplicates',
        },
        body: payload,
        keepalive: true,
      })
    }

    window.addEventListener('beforeunload', handleUnload)
    return () => window.removeEventListener('beforeunload', handleUnload)
  }, [table])

  // SPA navigation does not fire beforeunload. Start the correctly-scoped save
  // during unmount and suppress state updates after the component is gone.
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      void flushPendingSave()
    }
  }, [flushPendingSave])

  return {
    triggerSave,
    saveNow,
    flushPendingSave,
    retrySave,
    saveStatus,
    lastSaved,
    cancelPendingAutoSave,
  }
}
