import { supabase } from "@/integrations/supabase/client"

export type UpcomingNotification = {
  clientId: string
  notificationType: 'birthday' | 'work_anniversary'
  triggerDate: string // YYYY-MM-DD
  message: string
}

/**
 * Persists the currently-relevant notifications (computed elsewhere, see
 * DashboardPage.tsx's checkNotifications) into client_notifications, and
 * returns the set of (clientId, type, triggerDate) keys already dismissed —
 * so a dismissal survives a page refresh or another teammate's session
 * instead of only living in local component state.
 *
 * No unique(client_id, notification_type, trigger_date) constraint exists on
 * this table, so this can't use a plain upsert-with-onConflict (the old,
 * never-actually-runnable version of this file assumed one existed) — it
 * reads existing rows for these clients/types first and only inserts what's
 * missing.
 */
export async function syncClientNotifications(upcoming: UpcomingNotification[]): Promise<Set<string>> {
  const key = (clientId: string, type: string, date: string) => `${clientId}:${type}:${date}`
  const dismissed = new Set<string>()
  if (upcoming.length === 0) return dismissed

  const clientIds = [...new Set(upcoming.map(n => n.clientId))]
  const { data: existing, error } = await supabase
    .from('client_notifications')
    .select('client_id, notification_type, trigger_date, is_dismissed')
    .in('client_id', clientIds)
  if (error) {
    console.error('Failed to load client_notifications:', error)
    return dismissed
  }

  const existingKeys = new Set((existing ?? []).map(row => key(row.client_id ?? '', row.notification_type, row.trigger_date)))
  ;(existing ?? []).forEach(row => {
    if (row.is_dismissed) dismissed.add(key(row.client_id ?? '', row.notification_type, row.trigger_date))
  })

  const missing = upcoming.filter(n => !existingKeys.has(key(n.clientId, n.notificationType, n.triggerDate)))
  if (missing.length > 0) {
    const { error: insertError } = await supabase.from('client_notifications').insert(
      missing.map(n => ({
        client_id: n.clientId,
        notification_type: n.notificationType,
        trigger_date: n.triggerDate,
        message: n.message,
        is_dismissed: false,
      }))
    )
    if (insertError) console.error('Failed to persist client_notifications:', insertError)
  }

  return dismissed
}

export async function dismissClientNotification(clientId: string, notificationType: string, triggerDate: string): Promise<boolean> {
  const { error } = await supabase
    .from('client_notifications')
    .update({ is_dismissed: true })
    .eq('client_id', clientId)
    .eq('notification_type', notificationType)
    .eq('trigger_date', triggerDate)
  if (error) console.error('Failed to dismiss notification:', error)
  return !error
}
