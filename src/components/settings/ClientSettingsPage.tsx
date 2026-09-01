import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/lib/auth'
import { sortAlphabetically } from '@/utils/sort'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Globe, KeyRound, Link2, RefreshCw, Unlink, UserPlus } from 'lucide-react'
import { toast } from 'sonner'

type ClientPortalRow = {
  id: string
  name: string
  company: string | null
  user_id: string | null
}

type InternalProfile = {
  id: string
  email: string | null
  full_name: string | null
  department: string | null
}

export function ClientSettingsPage() {
  const { isAdmin } = useAuth()
  const [clients, setClients] = useState<ClientPortalRow[]>([])
  const [internalProfiles, setInternalProfiles] = useState<InternalProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [isPortalModalOpen, setIsPortalModalOpen] = useState(false)
  const [portalForm, setPortalForm] = useState({ email: '', password: '', clientId: '' })
  const [portalLoading, setPortalLoading] = useState(false)
  const [resetClient, setResetClient] = useState<ClientPortalRow | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false)
  const [linkClientId, setLinkClientId] = useState('')
  const [linkUserId, setLinkUserId] = useState('')
  const [linkLoading, setLinkLoading] = useState(false)

  const fetchClients = async () => {
    setLoading(true)
    const [clientsResult, profilesResult] = await Promise.all([
      (supabase as any)
        .from('clients')
        .select('id, name, company, user_id')
        .eq('status', 'active')
        .order('name'),
      supabase
        .from('profiles')
        .select('id, email, full_name, department')
        .order('full_name'),
    ])
    if (clientsResult.error) toast.error(clientsResult.error.message)
    if (profilesResult.error) toast.error(profilesResult.error.message)
    setClients(sortAlphabetically((clientsResult.data || []) as ClientPortalRow[], client => client.name))
    setInternalProfiles(sortAlphabetically(
      ((profilesResult.data || []) as InternalProfile[]).filter(profile => profile.department?.toLowerCase() !== 'client'),
      profile => profile.full_name || profile.email || '',
    ))
    setLoading(false)
  }

  useEffect(() => {
    fetchClients()
  }, [])

  const handleCreatePortalUser = async () => {
    if (!portalForm.email || !portalForm.password || !portalForm.clientId) {
      toast.error('Email, password and client are required.')
      return
    }
    if (portalForm.password.length < 8) {
      toast.error('Password must be at least 8 characters.')
      return
    }

    setPortalLoading(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const { data, error } = await supabase.functions.invoke('create-portal-user', {
        body: {
          email: portalForm.email,
          password: portalForm.password,
          clientId: portalForm.clientId,
        },
        headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)

      toast.success('Portal account created and linked!')
      setIsPortalModalOpen(false)
      setPortalForm({ email: '', password: '', clientId: '' })
      await fetchClients()
    } catch (error: any) {
      toast.error('Failed: ' + error.message)
    } finally {
      setPortalLoading(false)
    }
  }

  const openCreateLogin = (client?: ClientPortalRow) => {
    setPortalForm({ email: '', password: '', clientId: client?.id || '' })
    setIsPortalModalOpen(true)
  }

  const openResetPassword = (client: ClientPortalRow) => {
    setResetClient(client)
    setNewPassword('')
  }

  const openLinkTeamMember = (client?: ClientPortalRow) => {
    setLinkClientId(client?.id || '')
    setLinkUserId('')
    setIsLinkModalOpen(true)
  }

  const handleLinkTeamMember = async () => {
    // Linking/unlinking portal access is admin-only by intent, but the RLS
    // policy underneath (is_internal_user()) currently grants this write to
    // any internal team member — this client-side gate is a stopgap until
    // that policy is narrowed. Defense-in-depth, not the real boundary.
    if (!isAdmin) {
      toast.error('Only admins can manage portal account linking.')
      return
    }
    if (!linkClientId || !linkUserId) {
      toast.error('Select a client and an internal team member.')
      return
    }
    const client = clients.find(item => item.id === linkClientId)
    const profile = internalProfiles.find(item => item.id === linkUserId)
    if (!client || client.user_id || !profile) {
      toast.error('This client or team member is no longer available for linking.')
      return
    }

    setLinkLoading(true)
    try {
      const { data, error } = await (supabase as any)
        .from('clients')
        .update({ user_id: linkUserId })
        .eq('id', linkClientId)
        .is('user_id', null)
        .select('id')
      if (error) throw error
      if (!data?.length) throw new Error('The client was linked by someone else. Refresh and try again.')

      toast.success(`${profile.full_name || profile.email} can now use both the internal dashboard and ${client.name}'s client portal.`)
      setIsLinkModalOpen(false)
      setLinkClientId('')
      setLinkUserId('')
      await fetchClients()
    } catch (error: any) {
      toast.error('Failed to link team member: ' + error.message)
    } finally {
      setLinkLoading(false)
    }
  }

  const handleResetPassword = async () => {
    if (!resetClient?.user_id) return
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters.')
      return
    }

    setResetLoading(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const { data, error } = await supabase.functions.invoke('create-portal-user', {
        body: {
          action: 'reset_password',
          userId: resetClient.user_id,
          newPassword,
        },
        headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)

      toast.success(`Password updated for ${resetClient.name}.`)
      setResetClient(null)
      setNewPassword('')
    } catch (error: any) {
      toast.error('Failed to reset password: ' + error.message)
    } finally {
      setResetLoading(false)
    }
  }

  const handleUnlinkPortalUser = async (clientId: string) => {
    if (!isAdmin) {
      toast.error('Only admins can manage portal account linking.')
      return
    }
    if (!window.confirm('Remove portal access for this client?')) return
    const { error } = await (supabase as any)
      .from('clients')
      .update({ user_id: null })
      .eq('id', clientId)
    if (error) {
      toast.error('Failed to remove portal access: ' + error.message)
      return
    }
    toast.success('Portal access removed.')
    await fetchClients()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <Globe className="h-5 w-5 text-gold" /> Client Portal Access
          </h2>
          <p className="mt-0.5 text-sm font-medium text-muted-foreground">
            Manage client login credentials and portal access.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => openLinkTeamMember()} className="font-bold">
            <Link2 className="mr-2 h-4 w-4" /> Link Team Member
          </Button>
          <Button
            onClick={() => openCreateLogin()}
            className="bg-gold font-bold text-black hover:bg-gold/90"
          >
            <UserPlus className="mr-2 h-4 w-4" /> Create Portal Account
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader className="bg-muted/20">
            <TableRow>
              <TableHead className="font-bold">Client</TableHead>
              <TableHead className="font-bold">Company</TableHead>
              <TableHead className="font-bold">Portal Access</TableHead>
              <TableHead className="font-bold">Login URL</TableHead>
              <TableHead className="text-right font-bold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map(client => {
              const linkedProfile = client.user_id ? internalProfiles.find(profile => profile.id === client.user_id) : null
              return <TableRow key={client.id}>
                <TableCell className="font-bold">{client.name}</TableCell>
                <TableCell className="text-muted-foreground">{client.company}</TableCell>
                <TableCell>
                  {client.user_id ? (
                    <Badge className="border-green-200 bg-green-100 font-bold text-green-700">
                      {linkedProfile ? '✓ Team linked' : '✓ Active'}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">No access</Badge>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {client.user_id ? `${window.location.origin}/portal` : '-'}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    {client.user_id ? (
                      <>
                        {!linkedProfile && <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openResetPassword(client)}
                            className="gap-1.5 text-xs text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                          >
                            <KeyRound className="h-3.5 w-3.5" /> Reset Password
                          </Button>}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUnlinkPortalUser(client.id)}
                          className="gap-1.5 text-xs text-red-500 hover:bg-red-50 hover:text-red-700"
                        >
                          <Unlink className="h-3.5 w-3.5" /> Remove
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openLinkTeamMember(client)}
                          className="gap-1.5 text-xs font-bold text-foreground hover:bg-muted"
                        >
                          <Link2 className="h-3.5 w-3.5" /> Link Team Member
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openCreateLogin(client)}
                          className="gap-1.5 text-xs font-bold text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                        >
                          <UserPlus className="h-3.5 w-3.5" /> Create Login
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            })}
            {!loading && clients.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center italic text-muted-foreground">
                  No active clients found.
                </TableCell>
              </TableRow>
            )}
            {loading && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Loading clients…
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isLinkModalOpen} onOpenChange={open => {
        setIsLinkModalOpen(open)
        if (!open) {
          setLinkClientId('')
          setLinkUserId('')
        }
      }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-black">
              <Link2 className="h-5 w-5 text-gold" /> Link Existing Team Member
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="font-bold">Client *</Label>
              <Select value={linkClientId} onValueChange={setLinkClientId}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {clients.filter(client => !client.user_id).map(client => (
                    <SelectItem key={client.id} value={client.id}>{client.name} - {client.company}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="font-bold">Internal team member *</Label>
              <Select value={linkUserId} onValueChange={setLinkUserId}>
                <SelectTrigger><SelectValue placeholder="Select existing account" /></SelectTrigger>
                <SelectContent>
                  {internalProfiles
                    .filter(profile => !clients.some(client => client.user_id === profile.id))
                    .map(profile => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.full_name || 'Unnamed'}{profile.email ? ` - ${profile.email}` : ''}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg border border-gold/20 bg-gold/10 p-3 text-xs text-muted-foreground">
              This adds client-portal access to the existing login. The team member's internal role, password and profile stay unchanged.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLinkModalOpen(false)}>Cancel</Button>
            <Button onClick={handleLinkTeamMember} disabled={linkLoading || !linkUserId} className="bg-gold font-black text-black">
              {linkLoading ? 'Linking...' : 'Link Existing Account →'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPortalModalOpen} onOpenChange={setIsPortalModalOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-black">
              <Globe className="h-5 w-5 text-gold" /> Create Client Portal Account
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="font-bold">Client *</Label>
              <Select
                value={portalForm.clientId}
                onValueChange={clientId => setPortalForm(current => ({ ...current, clientId }))}
              >
                <SelectTrigger><SelectValue placeholder="Select client to link" /></SelectTrigger>
                <SelectContent>
                  {clients.filter(client => !client.user_id).map(client => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name} - {client.company}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Only clients without existing portal access are shown.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="font-bold">Login Email *</Label>
              <Input
                type="email"
                placeholder="client@company.com"
                value={portalForm.email}
                onChange={event => setPortalForm(current => ({ ...current, email: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-bold">
                Password * <span className="font-normal text-muted-foreground">(min 8 chars)</span>
              </Label>
              <Input
                type="password"
                placeholder="Set a strong password"
                value={portalForm.password}
                onChange={event => setPortalForm(current => ({ ...current, password: event.target.value }))}
              />
            </div>
            <div className="rounded-lg border border-gold/20 bg-gold/10 p-3 text-xs text-muted-foreground">
              <p className="mb-1 font-bold text-foreground">Share with your client:</p>
              <p>URL: <span className="font-mono font-bold">{window.location.origin}/portal</span></p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPortalModalOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreatePortalUser}
              disabled={portalLoading}
              className="bg-gold font-black text-black"
            >
              {portalLoading ? 'Creating...' : 'Create & Link Account →'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(resetClient)} onOpenChange={open => !open && setResetClient(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-amber-500" /> Reset Client Password
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Set a new portal password for{' '}
              <span className="font-bold text-foreground">{resetClient?.name}</span>.
            </p>
            <div className="space-y-1.5">
              <Label className="font-bold">New Password</Label>
              <Input
                type="password"
                placeholder="Minimum 8 characters"
                value={newPassword}
                onChange={event => setNewPassword(event.target.value)}
                onKeyDown={event => event.key === 'Enter' && handleResetPassword()}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetClient(null)}>Cancel</Button>
            <Button
              onClick={handleResetPassword}
              disabled={resetLoading || newPassword.length < 8}
              className="gap-2 bg-amber-500 font-bold text-white hover:bg-amber-600"
            >
              {resetLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Set Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
