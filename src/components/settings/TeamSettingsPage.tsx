import React, { useState, useEffect } from 'react'
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/lib/auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { UserPlus, Copy, Check, RefreshCw, Ban, Shield, Trash2, KeyRound, Globe, Link2, Unlink } from "lucide-react"
import { sortAlphabetically } from "@/utils/sort"

export function TeamSettingsPage() {
  const { user: currentUser } = useAuth()
  const [team, setTeam] = useState<any[]>([])
  const [invites, setInvites] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isResetModalOpen, setIsResetModalOpen] = useState(false)
  const [resetUser, setResetUser] = useState<any>(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [generatedLink, setGeneratedLink] = useState('')
  const [inviteeName, setInviteeName] = useState('')
  const [editingUser, setEditingUser] = useState<any>(null)
  const [editingName, setEditingName] = useState('')

  // Form State
  const [form, setForm] = useState({
    fullName: '',
    email: ''
  })

  // Client Portal state
  const [clients, setClients] = useState<any[]>([])
  const [isPortalModalOpen, setIsPortalModalOpen] = useState(false)
  const [portalForm, setPortalForm] = useState({ email: '', password: '', clientId: '' })
  const [portalLoading, setPortalLoading] = useState(false)

  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('id, name, company, user_id').eq('status', 'active').order('name')
    setClients(sortAlphabetically((data || []) as any[], client => client.name))
  }

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
      fetchClients()
      fetchData()
    } catch (e: any) {
      toast.error('Failed: ' + e.message)
    } finally {
      setPortalLoading(false)
    }
  }

  const handleUnlinkPortalUser = async (clientId: string) => {
    if (!confirm('Remove portal access for this client?')) return
    await supabase.from('clients').update({ user_id: null } as any).eq('id', clientId)
    toast.success('Portal access removed.')
    fetchClients()
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const [
        { data: profilesData },
        { data: rolesData },
        { data: assignmentsData },
        { data: invitesData },
        { data: portalClientsData },
      ] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('user_roles').select('*'),
        supabase.from('client_assignments').select('user_id'),
        supabase.from('invites').select('*').order('created_at', { ascending: false }),
        (supabase as any).from('clients').select('user_id').not('user_id', 'is', null),
      ])

      const portalUserIds = new Set(
        (portalClientsData || []).map((client: { user_id: string | null }) => client.user_id).filter(Boolean),
      )
      const enrichedTeam = (profilesData || [])
        .filter(profile => profile.department !== 'client' && !portalUserIds.has(profile.id))
        .map(p => {
        const role = rolesData?.find(r => r.user_id === p.id) as any
        const assignmentsCount = assignmentsData?.filter(a => a.user_id === p.id).length || 0
        return {
          ...p,
          role: role?.role || 'member',
          roleDisabled: role?.disabled || false,
          assignmentsCount
        }
        })

      setTeam(sortAlphabetically(enrichedTeam, member => member.full_name))
      setInvites(invitesData || [])
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    fetchClients()
  }, [])

  const handleInvite = async () => {
    if (!form.fullName || !form.email) {
      toast.error("Name and Email are required")
      return
    }

    try {
      const token = crypto.randomUUID()
      const { error } = await supabase.from('invites').insert({
        email: form.email,
        full_name: form.fullName,
        department: 'both',
        role: 'member',
        status: 'pending',
        token,
        invited_by: currentUser?.id
      })

      if (error) throw error

      const link = `${window.location.origin}/accept-invite?token=${token}`
      setGeneratedLink(link)
      setInviteeName(form.fullName)
      setIsInviteModalOpen(false)
      setIsLinkModalOpen(true)
      fetchData()
      setForm({ fullName: '', email: '' })
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(generatedLink)
    toast.success("Link copied to clipboard")
  }

  const handleMakeAdmin = (userId: string, userName: string) => {
    const confirmed = window.confirm(
      `Make ${userName} an admin? They will have full access to all data, settings, and team management.`
    )
    if (!confirmed) return
    promoteToAdmin(userId)
  }

  const promoteToAdmin = async (userId: string) => {
    const { error } = await supabase
      .from('user_roles')
      .update({ role: 'admin' })
      .eq('user_id', userId)

    if (error) {
      toast.error('Failed to promote user: ' + error.message)
      return
    }

    await fetchData()
    toast.success('User promoted to admin successfully.')
  }

  const handleRevokeAdmin = (userId: string, userName: string) => {
    const confirmed = window.confirm(
      `Revoke admin access for ${userName}? They will become a regular member and lose access to Settings.`
    )
    if (!confirmed) return
    revokeAdmin(userId)
  }

  const revokeAdmin = async (userId: string) => {
    const { error } = await supabase
      .from('user_roles')
      .update({ role: 'member' })
      .eq('user_id', userId)

    if (error) {
      toast.error('Failed to revoke admin: ' + error.message)
      return
    }

    await fetchData()
    toast.success('Admin access revoked.')
  }

  const handleToggleDisable = async (userId: string, currentDisabled: boolean) => {
    try {
      // Update both profiles and user_roles for redundancy
      await Promise.all([
        supabase.from('profiles').update({ disabled: !currentDisabled }).eq('id', userId),
        supabase.from('user_roles').update({ disabled: !currentDisabled } as any).eq('user_id', userId)
      ])
      
      toast.success(currentDisabled ? "Account enabled" : "Account disabled")
      fetchData()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const handleRevokeInvite = async (inviteId: string) => {
    if (!confirm("Revoke this invitation?")) return
    try {
      const { error } = await supabase.from('invites').delete().eq('id', inviteId)
      if (error) throw error
      toast.success("Invite revoked")
      fetchData()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const openResetModal = (user: any) => {
    setResetUser(user)
    setNewPassword('')
    setIsResetModalOpen(true)
  }

  const handleSetPassword = async () => {
    if (!resetUser) return
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    setResetLoading(true)
    const { data: sessionData } = await supabase.auth.getSession()
    const { data, error } = await supabase.functions.invoke('create-portal-user', {
      body: { action: 'reset_password', userId: resetUser.id, newPassword },
      headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
    })
    setResetLoading(false)
    if (error || data?.error) {
      toast.error('Failed to reset password: ' + (data?.error || error.message))
    } else {
      toast.success(`Password updated for ${resetUser.full_name}`)
      setIsResetModalOpen(false)
      setResetUser(null)
      setNewPassword('')
    }
  }

  const openEditModal = (user: any) => {
    setEditingUser(user)
    setEditingName(user.full_name || '')
    setIsEditModalOpen(true)
  }

  const handleSaveEditName = async () => {
    if (!editingName.trim()) {
      toast.error("Name cannot be empty")
      return
    }

    if (!editingUser) return

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: editingName.trim() })
        .eq('id', editingUser.id)

      if (error) throw error

      toast.success("Name updated successfully")
      setIsEditModalOpen(false)
      setEditingUser(null)
      setEditingName('')
      fetchData()
    } catch (error: any) {
      toast.error('Failed to update name: ' + error.message)
    }
  }

  const getStatusBadge = (user: any) => {
    if (user.disabled) return <Badge variant="secondary" className="bg-gray-100 text-gray-500 border-gray-200">Disabled</Badge>
    return <Badge variant="default" className="bg-status-on">Active</Badge>
  }

  const getDeptBadge = (dept: string, role: string) => {
    if (role === 'admin') return <Badge variant="outline" className="border-gold text-gold font-bold">Admin</Badge>
    return <Badge variant="outline" className="capitalize">{dept || 'Member'}</Badge>
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Team Members</h2>
          <p className="text-sm text-muted-foreground font-medium">Manage access and roles for your team.</p>
        </div>
        <Button onClick={() => setIsInviteModalOpen(true)} className="bg-gold text-black hover:bg-gold/90 font-bold">
          <UserPlus className="w-4 h-4 mr-2" /> Invite Member
        </Button>
      </div>

      <Card className="border-none shadow-none bg-transparent">
        <CardContent className="p-0">
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Clients Assigned</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {team.map(u => (
                  <TableRow key={u.id}>
                    <TableCell className="font-bold">{u.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      {u.role === 'admin' ? (
                        <span style={{
                          background: '#FFC947',
                          color: '#000',
                          padding: '3px 10px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '700'
                        }}>
                          Admin
                        </span>
                      ) : (
                        <span style={{
                          background: '#E5E5E5',
                          color: '#666',
                          padding: '3px 10px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '700'
                        }}>
                          Member
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{u.assignmentsCount} clients</TableCell>
                    <TableCell>{getStatusBadge(u)}</TableCell>
                    <TableCell className="text-right space-x-1">
                      {u.role === 'admin' ? (
                        <div className="inline-flex items-center">
                          <span style={{
                            background: '#FFC947',
                            color: '#000',
                            padding: '3px 10px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: '700'
                          }}>
                            Admin
                          </span>
                          {u.id !== currentUser?.id && (
                            <button
                              onClick={() => handleRevokeAdmin(u.id, u.full_name)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#EF4444',
                                fontSize: '12px',
                                cursor: 'pointer',
                                textDecoration: 'underline',
                                marginLeft: '8px'
                              }}
                            >
                              Revoke Admin
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => handleMakeAdmin(u.id, u.full_name)}
                          style={{
                            background: 'white',
                            border: '1px solid #E5E5E5',
                            borderRadius: '6px',
                            padding: '5px 12px',
                            fontSize: '13px',
                            cursor: 'pointer',
                            color: '#000'
                          }}
                        >
                          Make Admin
                        </button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-blue-600 hover:text-blue-700 font-medium"
                        onClick={() => openEditModal(u)}
                      >
                        ✏️ Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-amber-600 hover:text-amber-700 font-medium gap-1"
                        title="Set a new password for this user"
                        onClick={() => openResetModal(u)}
                      >
                        <KeyRound className="w-3.5 h-3.5" /> Reset Password
                      </Button>
                      <Button variant="ghost" size="icon" title={u.disabled ? "Enable" : "Disable"} onClick={() => handleToggleDisable(u.id, !!u.disabled)}>
                        {u.disabled ? <Check className="w-4 h-4 text-status-on" /> : <Ban className="w-4 h-4 text-destructive" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {invites.some(i => i.status === 'pending') && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Pending Invites</h3>
          <div className="rounded-lg border bg-muted/20">
            <Table>
              <TableBody>
                {invites.filter(i => i.status === 'pending').map(i => (
                  <TableRow key={i.id}>
                    <TableCell className="font-bold">{i.full_name}</TableCell>
                    <TableCell>{i.email}</TableCell>
                    <TableCell className="text-xs text-muted-foreground italic">Sent: {new Date(i.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="ghost" size="sm" className="text-gold font-bold" onClick={() => {
                        setGeneratedLink(`${window.location.origin}/accept-invite?token=${i.token}`)
                        setIsLinkModalOpen(true)
                      }}>Copy Link</Button>
                      <Button variant="ghost" size="icon" onClick={() => handleRevokeInvite(i.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Invite Team Member</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Full Name*</Label>
              <Input placeholder="e.g. Mithil Kothari" value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} />
            </div>
            <div className="grid gap-2">
              <Label>Email*</Label>
              <Input type="email" placeholder="email@myntmore.com" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleInvite} className="bg-gold text-black font-bold w-full h-12">
              Send Invite →
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Modal */}
      <Dialog open={isLinkModalOpen} onOpenChange={setIsLinkModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle className="flex items-center gap-2 font-bold text-status-on"><Check className="w-5 h-5" /> Invite Created</DialogTitle></DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">Share this link with <b>{inviteeName}</b>. They'll set their password when they open it.</p>
            <div className="p-3 bg-muted rounded-lg border flex items-center gap-2 overflow-hidden">
                <span className="text-xs font-mono truncate flex-1">{generatedLink}</span>
                <Button size="icon" variant="ghost" onClick={handleCopyLink} className="shrink-0"><Copy className="w-4 h-4" /></Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsLinkModalOpen(false)} className="w-full">Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Modal */}
      <Dialog open={isResetModalOpen} onOpenChange={setIsResetModalOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-500" /> Reset Password
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Set a new password for <span className="font-bold text-foreground">{resetUser?.full_name}</span> ({resetUser?.email})
            </p>
            <div className="grid gap-2">
              <Label>New Password</Label>
              <Input
                type="password"
                placeholder="Min. 6 characters"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSetPassword()}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResetModalOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSetPassword}
              disabled={resetLoading || newPassword.length < 6}
              className="bg-amber-500 hover:bg-amber-600 text-white font-bold gap-2"
            >
              {resetLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              Set Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Name Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Edit Team Member Name</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Full Name</Label>
              <Input
                placeholder="Enter full name"
                value={editingName}
                onChange={e => setEditingName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveEditName()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsEditModalOpen(false)} variant="outline">
              Cancel
            </Button>
            <Button onClick={handleSaveEditName} className="bg-gold text-black font-bold">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Client Portal Section ─── */}
      <div className="space-y-4 pt-4 border-t">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2"><Globe className="w-5 h-5 text-gold" /> Client Portal Access</h2>
            <p className="text-sm text-muted-foreground font-medium mt-0.5">Create login credentials so clients can view their campaign data.</p>
          </div>
          <Button onClick={() => setIsPortalModalOpen(true)} className="bg-gold text-black hover:bg-gold/90 font-bold">
            <UserPlus className="w-4 h-4 mr-2" /> Create Portal Account
          </Button>
        </div>

        <div className="rounded-lg border bg-card overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/20">
              <TableRow>
                <TableHead className="font-bold">Client</TableHead>
                <TableHead className="font-bold">Company</TableHead>
                <TableHead className="font-bold">Portal Access</TableHead>
                <TableHead className="font-bold">Login URL</TableHead>
                <TableHead className="font-bold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-bold">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.company}</TableCell>
                  <TableCell>
                    {(c as any).user_id
                      ? <Badge className="bg-green-100 text-green-700 border-green-200 font-bold">✓ Active</Badge>
                      : <Badge variant="outline" className="text-muted-foreground">No access</Badge>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {(c as any).user_id ? `${window.location.origin}/portal` : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    {(c as any).user_id && (
                      <Button variant="ghost" size="sm" onClick={() => handleUnlinkPortalUser(c.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 gap-1.5 text-xs">
                        <Unlink className="w-3.5 h-3.5" /> Remove
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {clients.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground italic">No active clients found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Create Portal User Modal */}
      <Dialog open={isPortalModalOpen} onOpenChange={setIsPortalModalOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black flex items-center gap-2">
              <Globe className="w-5 h-5 text-gold" /> Create Client Portal Account
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="font-bold">Client *</Label>
              <Select value={portalForm.clientId} onValueChange={v => setPortalForm(p => ({...p, clientId: v}))}>
                <SelectTrigger><SelectValue placeholder="Select client to link" /></SelectTrigger>
                <SelectContent>
                  {clients.filter(c => !(c as any).user_id).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name} - {c.company}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Only clients without existing portal access are shown.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="font-bold">Login Email *</Label>
              <Input type="email" placeholder="client@company.com" value={portalForm.email}
                onChange={e => setPortalForm(p => ({...p, email: e.target.value}))} />
            </div>
            <div className="space-y-1.5">
              <Label className="font-bold">Password * <span className="text-muted-foreground font-normal">(min 8 chars)</span></Label>
              <Input type="password" placeholder="Set a strong password" value={portalForm.password}
                onChange={e => setPortalForm(p => ({...p, password: e.target.value}))} />
            </div>
            <div className="p-3 bg-gold/10 border border-gold/20 rounded-lg text-xs text-muted-foreground">
              <p className="font-bold text-foreground mb-1">Share with your client:</p>
              <p>URL: <span className="font-mono font-bold">{window.location.origin}/portal</span></p>
              <p className="mt-0.5">They'll log in with the email and password you set above.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPortalModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreatePortalUser} disabled={portalLoading} className="bg-gold text-black font-black">
              {portalLoading ? 'Creating...' : 'Create & Link Account →'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
