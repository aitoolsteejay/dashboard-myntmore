import { SaveStatus } from '../../hooks/useAutoSave'
import { AlertTriangle, CheckCircle2, Cloud, Loader2 } from 'lucide-react'
import { Button } from './button'
import { cn } from '@/lib/utils'

interface SaveIndicatorProps {
  status: SaveStatus
  lastSaved: Date | null
  onRetry?: () => void
}

export function SaveIndicator({ status, lastSaved, onRetry }: SaveIndicatorProps) {
  const formatTime = (d: Date) => {
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <div role="status" aria-live="polite" className={cn("inline-flex min-h-8 items-center gap-2 rounded-lg border px-2.5 py-1 text-xs font-semibold", status === 'error' ? "border-red-200 bg-red-50 text-red-700" : status === 'saved' ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-border bg-muted/40 text-muted-foreground")}>
      {status === 'pending' && <><Cloud className="h-3.5 w-3.5" /><span>Unsaved changes</span></>}
      {status === 'saving' && <><Loader2 className="h-3.5 w-3.5 animate-spin text-gold" /><span>Saving…</span></>}
      {status === 'saved' && lastSaved && (
        <>
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Saved at {formatTime(lastSaved)}</span>
        </>
      )}
      {status === 'error' && (
        <>
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Save failed</span>
          {onRetry && <Button type="button" variant="ghost" size="sm" onClick={onRetry} className="h-6 px-2 text-xs font-black text-red-700 hover:bg-red-100 hover:text-red-800">Retry</Button>}
        </>
      )}
      {status === 'idle' && (
        <><Cloud className="h-3.5 w-3.5" /><span>Auto-save on</span></>
      )}
    </div>
  )
}
