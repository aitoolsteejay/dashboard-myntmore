import type { Database } from '@/integrations/supabase/types'

// Table row types
export type Client = Database['myntmore']['Tables']['clients']['Row']
export type WeeklyData = Database['myntmore']['Tables']['weekly_data']['Row']
export type Profile = Database['myntmore']['Tables']['profiles']['Row']
// Named MetricTarget to avoid conflict with lucide-react's Target icon
export type MetricTarget = Database['myntmore']['Tables']['targets']['Row']
export type HealthScore = Database['myntmore']['Tables']['client_health_scores']['Row']
export type Actionable = Database['myntmore']['Tables']['actionables']['Row']
export type Campaign = Database['myntmore']['Tables']['campaigns']['Row']
export type CampaignWeeklyData = Database['myntmore']['Tables']['campaign_weekly_data']['Row']
export type ContextNote = Database['myntmore']['Tables']['client_context_notes']['Row']
export type HighScore = Database['myntmore']['Tables']['high_scores']['Row']
export type HotLead = Database['myntmore']['Tables']['hot_leads']['Row']
export type MyntmoreProcess = Database['myntmore']['Tables']['myntmore_processes']['Row']
export type ProcessUpdate = Database['myntmore']['Tables']['process_weekly_updates']['Row']
export type SalesWeeklyData = Database['myntmore']['Tables']['sales_weekly_data']['Row']
export type TjWeeklyData = Database['myntmore']['Tables']['tj_weekly_data']['Row']
export type MmWeeklyData = Database['myntmore']['Tables']['mm_weekly_data']['Row']
export type ClientAlert = Database['myntmore']['Tables']['client_alerts']['Row']
export type ClientNotification = Database['myntmore']['Tables']['client_notifications']['Row']
export type ClientSettings = Database['myntmore']['Tables']['client_settings']['Row']

// Joined/extended row types (Supabase selects with joins return these shapes)
export type ContextNoteWithAuthor = ContextNote & { author: Pick<Profile, 'full_name'> | null }
export type ProcessWithOwner = MyntmoreProcess & { owner: Pick<Profile, 'full_name'> | null }
export type ActionableRow = Actionable & {
  assignee?: Pick<Profile, 'id' | 'full_name'> | null
  clients?: Pick<Client, 'id' | 'name'> | null
}
export type ClientAlertRow = ClientAlert & {
  clients?: { name: string; company: string | null } | null
}
export type ClientWithManagers = Client & {
  content_manager?: Pick<Profile, 'full_name'> | null
  leadgen_manager?: Pick<Profile, 'full_name'> | null
}

// Dashboard notification shape (computed client-side)
export interface AppNotification {
  id: string
  type: 'birthday' | 'anniversary' | 'happiness_low' | 'happiness_drop'
  clientId: string
  clientName: string
  message: string
  daysUntil?: number
  severity: 'info' | 'warning' | 'critical'
}

// Partial weekly_data row (used in month-summary queries that select only a subset of columns)
export type WeeklyDataSummary = Pick<WeeklyData, 'week_start' | 'week_label' | 'content_metrics' | 'leadgen_metrics' | 'client_id' | 'content_submitted_at' | 'leadgen_submitted_at'>

// Json field as a typed record (Supabase stores these as objects in practice)
export type JsonRecord = Record<string, unknown>
