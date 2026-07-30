import { redirect } from '@tanstack/react-router'
import { supabase } from '@/integrations/supabase/client'

// Blocks client-role users (and signed-out users) from internal/admin pages.
// A user who is *both* an admin and linked to a client record (e.g. a team member
// who is also one of the agency's own clients) is allowed through here — they can
// use the "View as client" link to switch to their portal instead of being forced
// into it.
export async function requireAdmin({ location }: { location: { href: string } }) {
  let { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    // getSession() can briefly return null right after a reload or a token
    // refresh, before Supabase finishes rehydrating the session from
    // storage. Give it one chance to refresh before bouncing to login -
    // otherwise a real session can flash a login screen on top of the
    // already-rendered authenticated sidebar.
    const { data } = await supabase.auth.refreshSession()
    session = data.session
  }
  if (!session) {
    throw redirect({ to: '/login', search: { redirect: location.href } })
  }

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', session.user.id)
    .maybeSingle()

  if (roleData?.role !== 'admin') {
    throw redirect({ to: '/dashboard' })
  }
}

// Allows both admins and internal team members into the operational dashboard.
// Client portal accounts also carry the "member" enum, so role alone cannot
// distinguish them. Their profile department is explicitly set to "client".
export async function requireInternalUser({ location }: { location: { href: string } }) {
  let { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    const { data } = await supabase.auth.refreshSession()
    session = data.session
  }
  if (!session) {
    throw redirect({ to: '/login', search: { redirect: location.href } })
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('department')
    .eq('id', session.user.id)
    .maybeSingle()

  if (profileError || !profile || profile.department === 'client') {
    throw redirect({ to: '/portal' })
  }
}
