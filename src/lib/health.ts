import { supabase } from "@/integrations/supabase/client"

export function calculateHealthScore(
  contentMetrics: Record<string, any>,
  leadgenMetrics: Record<string, any>,
  targets: Record<string, any>,
  options: {
    contentEnabled?: boolean
    leadgenEnabled?: boolean
    activeContentMetrics?: string[] | null
    activeLeadgenMetrics?: string[] | null
  } = {},
): { score: number; breakdown: Record<string, number> } {

  const get = (metrics: any, id: string) => 
    Number(metrics?.[id]?.value ?? 0)
  
  const target = (id: string) => 
    Number(targets?.[id] ?? 0)
  
  const pct = (actual: number, tgt: number) => 
    tgt > 0 ? Math.min((actual / tgt) * 100, 100) : 0

  const contentEnabled = options.contentEnabled ?? true
  const leadgenEnabled = options.leadgenEnabled ?? true
  const contentActive = (id: string) =>
    contentEnabled && (options.activeContentMetrics == null || options.activeContentMetrics.includes(id))
  const leadgenActive = (id: string) =>
    leadgenEnabled && (options.activeLeadgenMetrics == null || options.activeLeadgenMetrics.includes(id))

  const acceptanceRate = get(leadgenMetrics, 'L12')
  const positiveReplies = get(leadgenMetrics, 'L15')
  const positiveTarget = target('L15')
  const meetings = get(leadgenMetrics, 'L24')
  const meetingsTarget = target('L24')
  const posts = get(contentMetrics, 'C09')
  const postsTarget = target('C09')
  const impressions = get(contentMetrics, 'C10')
  const impressionsTarget = target('C10')
  const happiness = get(leadgenMetrics, 'L30')

  const components = [
    { key: 'acceptanceRate', enabled: leadgenActive('L12'), weight: 20, achievement: Math.min(acceptanceRate, 100) },
    { key: 'positiveReplies', enabled: leadgenActive('L15'), weight: 25, achievement: pct(positiveReplies, positiveTarget) },
    { key: 'meetingsBooked', enabled: leadgenActive('L24'), weight: 20, achievement: pct(meetings, meetingsTarget) },
    { key: 'postsPublished', enabled: contentActive('C09'), weight: 15, achievement: pct(posts, postsTarget) },
    { key: 'impressions', enabled: contentActive('C10'), weight: 10, achievement: pct(impressions, impressionsTarget) },
    { key: 'happiness', enabled: leadgenActive('L30'), weight: 10, achievement: Math.min((happiness / 10) * 100, 100) },
  ]
  const enabledComponents = components.filter(component => component.enabled)
  const totalWeight = enabledComponents.reduce((sum, component) => sum + component.weight, 0)
  const weightedTotal = enabledComponents.reduce(
    (sum, component) => sum + component.achievement * component.weight,
    0,
  )
  const score = totalWeight > 0 ? Math.round(weightedTotal / totalWeight) : 0
  const breakdown = Object.fromEntries(components.map(component => [
    component.key,
    component.enabled && totalWeight > 0
      ? Math.round((component.achievement * component.weight) / totalWeight)
      : 0,
  ]))

  return {
    score,
    breakdown,
  }
}

export async function updateClientHealth(
  clientId: string,
  weekStart: string,
  contentMetrics: Record<string, any>,
  leadgenMetrics: Record<string, any>
) {
  try {
    // 1. Fetch weekly targets for this client and week
    // Targets are stored with period = weekStart (YYYY-MM-DD), NOT week-number format
    const { data: targetsData } = await supabase
      .from('targets')
      .select('metric_id, target_value')
      .eq('client_id', clientId)
      .eq('target_type', 'weekly')
      .eq('period', weekStart)

    const targets: Record<string, number> = {}
    targetsData?.forEach(t => targets[t.metric_id] = t.target_value ?? 0)

    // 2. Calculate score
    const { data: settings } = await supabase
      .from('client_settings')
      .select('content_enabled, leadgen_enabled, active_content_metrics, active_leadgen_metrics')
      .eq('client_id', clientId)
      .maybeSingle()

    const { score, breakdown } = calculateHealthScore(contentMetrics, leadgenMetrics, targets, {
      contentEnabled: settings?.content_enabled ?? true,
      leadgenEnabled: settings?.leadgen_enabled ?? true,
      activeContentMetrics: settings?.active_content_metrics,
      activeLeadgenMetrics: settings?.active_leadgen_metrics,
    })

    // 3. Fetch previous score
    const { data: prev } = await supabase
      .from('client_health_scores')
      .select('health_score')
      .eq('client_id', clientId)
      .lt('week_start', weekStart)
      .order('week_start', { ascending: false })
      .limit(1)
      .maybeSingle()

    // 4. Upsert score
    const { error } = await supabase
      .from('client_health_scores')
      .upsert({
        client_id: clientId,
        week_start: weekStart,
        health_score: score,
        previous_score: prev?.health_score || null,
        score_breakdown: breakdown,
        updated_at: new Date().toISOString()
      }, { onConflict: 'client_id,week_start' })

    if (error) throw error
    
    // 5. Update Streaks
    const streaks = await calculateStreaks(clientId, weekStart)
    if (streaks) {
        await supabase
            .from('client_health_scores')
            .update({
                on_track_streak: streaks.onTrackStreak,
                posts_on_target_streak: streaks.postsStreak
            })
            .eq('client_id', clientId)
            .eq('week_start', weekStart)
    }

    // 6. Check Happiness Alerts
    if (settings?.leadgen_enabled ?? true) {
      await checkHappinessAlert(clientId, weekStart)
    }

    return { score, prevScore: prev?.health_score }
  } catch (err) {
    console.error("Health calculation failed", err)
    return null
  }
}

export async function calculateStreaks(clientId: string, weekStart: string) {
  try {
    // Get last 12 weeks of health scores
    const { data: history } = await supabase
        .from('client_health_scores')
        .select('week_start, health_score')
        .eq('client_id', clientId)
        .lte('week_start', weekStart)
        .order('week_start', { ascending: false })
        .limit(12)

    // On Track streak = consecutive weeks with health_score >= 70
    let onTrackStreak = 0
    for (const week of history || []) {
        if (Number(week.health_score) >= 70) onTrackStreak++
        else break
    }

    // Posts on target streak - consecutive weeks where C09 actual >= C09 weekly target
    const { data: weeklyData } = await supabase
        .from('weekly_data')
        .select('week_start, content_metrics')
        .eq('client_id', clientId)
        .lte('week_start', weekStart)
        .order('week_start', { ascending: false })
        .limit(12)

    const { data: weeklyTargets } = await supabase
        .from('targets')
        .select('period, target_value')
        .eq('client_id', clientId)
        .eq('metric_id', 'C09')
        .eq('target_type', 'weekly')

    let postsStreak = 0
    for (const week of weeklyData ?? []) {
        const postsActual = (week.content_metrics as any)?.C09?.value ?? 0
        // Targets are stored with period = week_start (YYYY-MM-DD)
        const target = weeklyTargets?.find(t => t.period === week.week_start)?.target_value ?? 0
        if (target > 0 && postsActual >= target) postsStreak++
        else break
    }

    return { onTrackStreak, postsStreak }
  } catch (err) {
    console.error("Streak calculation failed", err)
    return null
  }
}

export async function checkHappinessAlert(clientId: string, currentWeekStart: string) {
  try {
    const { data: recentWeeks } = await supabase
      .from('weekly_data')
      .select('week_start, leadgen_metrics')
      .eq('client_id', clientId)
      .lte('week_start', currentWeekStart)
      .order('week_start', { ascending: false })
      .limit(3)

    // Only include weeks that actually have a happiness value entered
    const scores = (recentWeeks
      ?.map(w => {
        const raw = (w.leadgen_metrics as any)?.L30?.value
        if (raw === null || raw === undefined || raw === '') return null
        const n = Number(raw)
        return isNaN(n) ? null : n
      })
      .filter((v): v is number => v !== null)) ?? []

    if (scores.length < 2) return null

    const [thisWeek, lastWeek, weekBefore] = scores

    let alert: any = null

    // Alert condition 1: below 6 for 2+ consecutive weeks
    if (thisWeek < 6 && lastWeek < 6) {
        alert = {
            alert_type: 'consecutive_low_happiness',
            alert_message: `Happiness Index has been below 6 for 2+ weeks (${lastWeek} → ${thisWeek}). Recommend check-in call.`,
            severity: 'high'
        }
    } else if (lastWeek - thisWeek >= 3) {
        // Alert condition 2: single week drop of 3+ points
        alert = {
            alert_type: 'happiness_drop',
            alert_message: `Happiness Index dropped sharply from ${lastWeek} to ${thisWeek} this week.`,
            severity: 'medium'
        }
    }

    if (alert) {
        await supabase.from('client_alerts').upsert({
            client_id: clientId,
            week_start: currentWeekStart,
            ...alert,
            is_resolved: false
        }, { onConflict: 'client_id,alert_type,week_start' })
    }
  } catch (err) {
    console.error("Happiness alert check failed", err)
  }
}
