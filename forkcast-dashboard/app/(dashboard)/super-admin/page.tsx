'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'react-hot-toast'
import {
  Shield,
  Search,
  Loader2,
  Plus,
  Edit,
  Trash2,
  Crown,
  ShieldCheck,
  HeadsetIcon,
  RefreshCw,
  UserPlus,
  LogOut,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const AVAILABLE_SECTIONS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'bookings', label: 'Bookings' },
  { key: 'waitlist', label: 'Waiting List' },
  { key: 'floorplan', label: 'Floor Plan' },
  { key: 'floorsections', label: 'Floor Sections' },
  { key: 'sections', label: 'Sections' },
  { key: 'customers', label: 'Customers' },
  { key: 'events', label: 'Events' },
  { key: 'schedules', label: 'Schedules' },
  { key: 'special-offers', label: 'Special Offers' },
  { key: 'offers', label: 'Offers' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'analytics', label: 'Analytics' },
 
]

const BOOKING_FIELDS = [
  { key: 'name', label: 'Guest Name' },
  { key: 'email', label: 'Guest Email' },
  { key: 'phone', label: 'Guest Phone' },
  { key: 'notes', label: 'Booking Notes' },
]

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  super_admin: { label: 'Super Admin', color: 'bg-red-100 text-red-700 border-red-200', icon: Crown },
  admin: { label: 'Admin', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: ShieldCheck },
  support: { label: 'Support', color: 'bg-gray-100 text-gray-700 border-gray-200', icon: HeadsetIcon },
}

interface AdminEntry {
  id: string
  user_id: string
  role: 'super_admin' | 'admin' | 'support'
  email: string | null
  created_at: string
  permissions: {
    id: string
    allowed_sections: string[]
    booking_field_visibility: Record<string, boolean>
    booking_actions: Record<string, boolean>
  } | null
}

interface FoundUser {
  id: string
  email: string | null
  created_at: string
  admin: { id: string; role: string } | null
}

export default function SuperAdminPage() {
  const supabase = createClient()

  const [admins, setAdmins] = useState<AdminEntry[]>([])
  const [adminsLoading, setAdminsLoading] = useState(true)

  const [addOpen, setAddOpen] = useState(false)
  const [searchEmail, setSearchEmail] = useState('')
  const [searchResults, setSearchResults] = useState<FoundUser[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedUser, setSelectedUser] = useState<FoundUser | null>(null)
  const [newRole, setNewRole] = useState<string>('admin')
  const [addLoading, setAddLoading] = useState(false)
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [roleDialogOpen, setRoleDialogOpen] = useState(false)
  const [editingAdmin, setEditingAdmin] = useState<AdminEntry | null>(null)
  const [editRole, setEditRole] = useState('admin')
  const [roleLoading, setRoleLoading] = useState(false)

  const [permDialogOpen, setPermDialogOpen] = useState(false)
  const [permAdmin, setPermAdmin] = useState<AdminEntry | null>(null)
  const [allowedSections, setAllowedSections] = useState<string[]>([])
  const [bookingFieldVis, setBookingFieldVis] = useState<Record<string, boolean>>({})
  const [bookingActions, setBookingActions] = useState<Record<string, boolean>>({})
  const [permSaving, setPermSaving] = useState(false)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [adminToDelete, setAdminToDelete] = useState<AdminEntry | null>(null)

  const fetchAdmins = useCallback(async () => {
    setAdminsLoading(true)
    try {
      const res = await fetch('/api/super-admin/admins')
      if (!res.ok) throw new Error('Failed to load admins')
      const data = await res.json()
      setAdmins(data.admins || [])
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setAdminsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAdmins()
  }, [fetchAdmins])

  const handleSearchEmail = (value: string) => {
    setSearchEmail(value)
    setSelectedUser(null)
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    if (value.length < 3) { setSearchResults([]); return }
    searchDebounce.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await fetch(`/api/super-admin/users?email=${encodeURIComponent(value)}`)
        const data = await res.json()
        setSearchResults(data.users || [])
      } finally {
        setSearchLoading(false)
      }
    }, 400)
  }

  const handleAddAdmin = async () => {
    if (!selectedUser) return
    setAddLoading(true)
    try {
      const res = await fetch('/api/super-admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: selectedUser.id, role: newRole }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      toast.success(`${selectedUser.email} added as ${newRole.replace('_', ' ')}`)
      setAddOpen(false)
      setSearchEmail('')
      setSearchResults([])
      setSelectedUser(null)
      setNewRole('admin')
      fetchAdmins()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setAddLoading(false)
    }
  }

  const handleChangeRole = async () => {
    if (!editingAdmin) return
    setRoleLoading(true)
    try {
      const res = await fetch('/api/super-admin/admins', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_id: editingAdmin.id, role: editRole }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      toast.success('Role updated')
      setRoleDialogOpen(false)
      fetchAdmins()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setRoleLoading(false)
    }
  }

  const openPermDialog = (admin: AdminEntry) => {
    setPermAdmin(admin)
    if (admin.permissions) {
      setAllowedSections(admin.permissions.allowed_sections || [])
      setBookingFieldVis(admin.permissions.booking_field_visibility || {})
      setBookingActions(admin.permissions.booking_actions || {})
    } else {
      setAllowedSections([])
      setBookingFieldVis({ name: false, email: false, phone: false, notes: false })
      setBookingActions({ can_accept_decline: false })
    }
    setPermDialogOpen(true)
  }

  const handleSavePermissions = async () => {
    if (!permAdmin) return
    setPermSaving(true)
    try {
      const res = await fetch('/api/super-admin/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_id: permAdmin.id,
          allowed_sections: allowedSections,
          booking_field_visibility: bookingFieldVis,
          booking_actions: bookingActions,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      toast.success('Permissions saved')
      setPermDialogOpen(false)
      fetchAdmins()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setPermSaving(false)
    }
  }

  const handleDeleteAdmin = async () => {
    if (!adminToDelete) return
    try {
      const res = await fetch('/api/super-admin/admins', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_id: adminToDelete.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      toast.success('Admin removed')
      setDeleteOpen(false)
      fetchAdmins()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-red-600 flex items-center justify-center">
            <Crown className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Super Admin</h1>
            <p className="text-sm text-muted-foreground">Manage platform admins and their permissions</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchAdmins} disabled={adminsLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${adminsLoading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" /> Add Admin
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { window.location.href = '/logout' }}
            className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
          >
            <LogOut className="h-4 w-4 mr-2" /> Logout
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
        <strong>Platform Admins</strong> manage restaurants, users, and platform settings. Admins can also be linked to individual restaurants as staff via the restaurant-link API.
      </div>

      {adminsLoading && admins.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : adminsLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : admins.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Shield className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>No admins yet. Click "Add Admin" to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {admins.map((admin) => {
            const cfg = ROLE_CONFIG[admin.role]
            const RoleIcon = cfg?.icon ?? Shield

            return (
              <Card key={admin.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center border shrink-0 ${cfg?.color}`}>
                      <RoleIcon className="h-4 w-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{admin.email || admin.user_id}</p>
                      <p className="text-xs text-muted-foreground">
                        {admin.role === 'super_admin'
                          ? 'Full platform access'
                          : admin.permissions
                            ? admin.permissions.allowed_sections.includes('*')
                              ? 'All sections'
                              : `${admin.permissions.allowed_sections.length} section(s) permitted`
                            : 'No page permissions set'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className={cfg?.color}>
                        <RoleIcon className="h-3 w-3 mr-1" />
                        {cfg?.label ?? admin.role}
                      </Badge>

                      <Button size="sm" variant="outline" onClick={() => {
                        setEditingAdmin(admin); setEditRole(admin.role); setRoleDialogOpen(true)
                      }}>
                        <Edit className="h-3 w-3 mr-1" /> Role
                      </Button>

                      {admin.role !== 'super_admin' && (
                        <Button size="sm" variant="outline" onClick={() => openPermDialog(admin)}>
                          <Shield className="h-3 w-3 mr-1" /> Permissions
                        </Button>
                      )}

                      {admin.role !== 'super_admin' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          onClick={() => { setAdminToDelete(admin); setDeleteOpen(true) }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ADD ADMIN DIALOG */}
      <Dialog open={addOpen} onOpenChange={(o) => {
        setAddOpen(o)
        if (!o) { setSearchEmail(''); setSearchResults([]); setSelectedUser(null); setNewRole('admin') }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Admin</DialogTitle>
            <DialogDescription>Search for an existing user by email and assign them a platform role.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Search by email</Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="user@example.com"
                  value={searchEmail}
                  onChange={(e) => handleSearchEmail(e.target.value)}
                  autoFocus
                />
                {searchLoading && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
              </div>

              {searchResults.length > 0 && !selectedUser && (
                <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                  {searchResults.map(u => (
                    <button
                      key={u.id}
                      className="w-full text-left px-3 py-2 hover:bg-muted/50 flex items-center justify-between text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => { setSelectedUser(u); setSearchResults([]) }}
                      disabled={!!u.admin}
                    >
                      <span>{u.email}</span>
                      {u.admin && (
                        <Badge variant="outline" className={ROLE_CONFIG[u.admin.role]?.color ?? ''}>
                          Already {ROLE_CONFIG[u.admin.role]?.label ?? u.admin.role}
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {selectedUser && (
                <div className="flex items-center justify-between px-3 py-2 rounded-md border bg-muted/30 text-sm">
                  <span className="font-medium">{selectedUser.email}</span>
                  <Button size="sm" variant="ghost" className="h-5 w-5 p-0 text-muted-foreground" onClick={() => { setSelectedUser(null); setSearchResults([]) }}>�</Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin � access specific sections</SelectItem>
                  <SelectItem value="support">Support � limited read access</SelectItem>
                  <SelectItem value="super_admin">Super Admin � full platform access</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddAdmin} disabled={!selectedUser || addLoading}>
              {addLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Admin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CHANGE ROLE DIALOG */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription>{editingAdmin?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Role</Label>
            <Select value={editRole} onValueChange={setEditRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="support">Support</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleChangeRole} disabled={roleLoading}>
              {roleLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PERMISSIONS DIALOG */}
      <Dialog open={permDialogOpen} onOpenChange={setPermDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Page Permissions</DialogTitle>
            <DialogDescription>{permAdmin?.email} � select which dashboard sections they can access</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Dashboard Sections</Label>
                <Button variant="ghost" size="sm" onClick={() =>
                  setAllowedSections(
                    allowedSections.length === AVAILABLE_SECTIONS.length
                      ? []
                      : AVAILABLE_SECTIONS.map(s => s.key)
                  )
                }>
                  {allowedSections.length === AVAILABLE_SECTIONS.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {AVAILABLE_SECTIONS.map(s => (
                  <div key={s.key} className="flex items-center gap-2">
                    <Checkbox
                      id={`sec-${s.key}`}
                      checked={allowedSections.includes(s.key)}
                      onCheckedChange={(checked) => {
                        setAllowedSections(prev =>
                          checked ? [...prev, s.key] : prev.filter(x => x !== s.key)
                        )
                      }}
                    />
                    <label htmlFor={`sec-${s.key}`} className="text-sm cursor-pointer">{s.label}</label>
                  </div>
                ))}
              </div>
            </div>
            <Separator />
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Booking Field Visibility</Label>
              <div className="grid grid-cols-2 gap-2">
                {BOOKING_FIELDS.map(f => (
                  <div key={f.key} className="flex items-center gap-2">
                    <Checkbox
                      id={`bf-${f.key}`}
                      checked={bookingFieldVis[f.key] === true}
                      onCheckedChange={(checked) =>
                        setBookingFieldVis(prev => ({ ...prev, [f.key]: !!checked }))
                      }
                    />
                    <label htmlFor={`bf-${f.key}`} className="text-sm cursor-pointer">{f.label}</label>
                  </div>
                ))}
              </div>
            </div>
            <Separator />
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Booking Actions</Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="can-accept"
                  checked={bookingActions.can_accept_decline === true}
                  onCheckedChange={(checked) =>
                    setBookingActions(prev => ({ ...prev, can_accept_decline: !!checked }))
                  }
                />
                <label htmlFor="can-accept" className="text-sm cursor-pointer">Accept / Decline Bookings</label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSavePermissions} disabled={permSaving}>
              {permSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Permissions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* REMOVE ADMIN DIALOG */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Admin</AlertDialogTitle>
            <AlertDialogDescription>
              Remove admin access from <strong>{adminToDelete?.email}</strong>? They will lose all dashboard permissions. Their account is not deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAdmin}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
