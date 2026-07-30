import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { sortAlphabetically } from '@/utils/sort'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Globe, Unlink, UserPlus } from 'lucide-react'
import { toast } from 'sonner'

type ClientPortalRow = {
  id: string
  name: string
  company: string | null
  user_id: string | null
}

export function ClientSettingsPage() {
  const [clients, setClients] = useState<ClientPortalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [isPortalModalOpen, setIsPortalModalOpen] = useState(false)
  const [portalForm, setPortalForm] = useState({ email: '', password: '', clientId: '' })
  const [portalLoading, setPortalLoading] = useState(false)

  const fetchClients = async () => {
    setLoading(true)
    const { data, error } = await (supabase as any)
      .from('clients')
      .select('id, name, company, user_id')
      .eq('status', 'active')
      .order('name')
    if (error) toast.error(error.message)
    setClients(sortAlphabetically((data || []) as ClientPortalRow[], client => client.name))
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

  const handleUnlinkPortalUser = async (clientId: string) => {
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
        <Button
          onClick={() => setIsPortalModalOpen(true)}
          className="bg-gold font-bold text-black hover:bg-gold/90"
        >
          <UserPlus className="mr-2 h-4 w-4" /> Create Portal Account
        </Button>
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
            {clients.map(client => (
              <TableRow key={client.id}>
                <TableCell className="font-bold">{client.name}</TableCell>
                <TableCell className="text-muted-foreground">{client.company}</TableCell>
                <TableCell>
                  {client.user_id ? (
                    <Badge className="border-green-200 bg-green-100 font-bold text-green-700">✓ Active</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">No access</Badge>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {client.user_id ? `${window.location.origin}/portal` : '-'}
                </TableCell>
                <TableCell className="text-right">
                  {client.user_id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleUnlinkPortalUser(client.id)}
                      className="gap-1.5 text-xs text-red-500 hover:bg-red-50 hover:text-red-700"
                    >
                      <Unlink className="h-3.5 w-3.5" /> Remove
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
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
    </div>
  )
}
