// Creates a client-portal auth user and links it to a client row.
// Runs server-side only — the service role key never reaches the browser.
// Caller must be an authenticated admin (checked via user_roles).

import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      db: { schema: 'myntmore' },
    })
    const body = await req.json()

    // Invite acceptance is intentionally available before login. The random,
    // single-use invite token is validated server-side, and all provisioning is
    // performed with the service role. If any database step fails, the newly
    // created Auth account is removed so no half-created user is left behind.
    if (body.action === 'accept_invite') {
      const { token, password } = body
      if (!token || !password || password.length < 8) {
        return new Response(JSON.stringify({ error: 'A valid invite token and password of at least 8 characters are required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: invite, error: inviteError } = await admin
        .from('invites')
        .select('id, email, full_name, department, role, status')
        .eq('token', token)
        .eq('status', 'pending')
        .maybeSingle()
      if (inviteError) throw inviteError
      if (!invite) {
        return new Response(JSON.stringify({ error: 'This invitation is invalid or has already been used' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email: invite.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: invite.full_name, myntmore_access: true },
      })
      if (authError) throw authError
      const newUserId = authData.user.id

      const profileResult = await admin.from('profiles').upsert({
        id: newUserId,
        email: invite.email,
        full_name: invite.full_name,
        department: invite.department,
        invite_status: 'active',
      })
      const roleResult = await admin.from('user_roles').insert({
        user_id: newUserId,
        role: invite.role === 'admin' ? 'admin' : 'member',
      })
      const acceptedResult = await admin
        .from('invites')
        .update({ status: 'accepted' })
        .eq('id', invite.id)

      const provisioningError = profileResult.error || roleResult.error || acceptedResult.error
      if (provisioningError) {
        await admin.auth.admin.deleteUser(newUserId)
        throw provisioningError
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Client scoped to the caller's JWT — used only to verify who's calling.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser()
    if (callerErr || !caller) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const [{ data: roleRow }, { data: callerProfile }] = await Promise.all([
      admin
        .from('user_roles')
        .select('role')
        .eq('user_id', caller.id)
        .eq('role', 'admin')
        .maybeSingle(),
      admin
        .from('profiles')
        .select('disabled')
        .eq('id', caller.id)
        .maybeSingle(),
    ])
    if (!roleRow || callerProfile?.disabled) {
      return new Response(JSON.stringify({ error: 'Admin role required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (body.action === 'reset_password') {
      const { userId, newPassword } = body
      if (!userId || !newPassword || newPassword.length < 6) {
        return new Response(JSON.stringify({ error: 'userId and a password of at least 6 characters are required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const { error: resetErr } = await admin.auth.admin.updateUserById(userId, { password: newPassword })
      if (resetErr) throw resetErr
      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { email, password, clientId } = body
    if (!email || !password || !clientId) {
      return new Response(JSON.stringify({ error: 'email, password and clientId are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (password.length < 8) {
      return new Response(JSON.stringify({ error: 'Password must be at least 8 characters' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: clientRow } = await admin.from('clients').select('id, name').eq('id', clientId).maybeSingle()
    if (!clientRow) {
      return new Response(JSON.stringify({ error: 'Client not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { myntmore_access: true },
    })
    if (authErr) throw authErr
    const newUserId = authData.user.id

    const profileResult = await admin.from('profiles').upsert({
      id: newUserId, email, full_name: clientRow.name, department: 'client', invite_status: 'active',
    })
    const roleResult = await admin.from('user_roles').insert({ user_id: newUserId, role: 'member' })
    const clientResult = await admin.from('clients').update({ user_id: newUserId }).eq('id', clientId)

    const provisioningError = profileResult.error || roleResult.error || clientResult.error
    if (provisioningError) {
      await admin.auth.admin.deleteUser(newUserId)
      throw provisioningError
    }

    return new Response(JSON.stringify({ userId: newUserId }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
