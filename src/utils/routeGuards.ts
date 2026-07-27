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
    throw redirect({ to: '/portal' })
  }
}
