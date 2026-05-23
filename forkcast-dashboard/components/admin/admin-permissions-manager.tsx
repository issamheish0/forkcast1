'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
import { Users, Edit, Trash2, Plus, Shield, Loader2, Search } from 'lucide-react'
import { AdminPermissions } from '@/hooks/use-admin-permissions'

interface Admin {
  id: number
  user_id: string
  role: 'super_admin' | 'admin' | 'support'
  created_at?: string
  admin_permissions?: AdminPermissions | null
  profiles?: {
    id: string
    full_name: string | null
    email: string | null
  } | null
}

const AVAILABLE_SECTIONS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'restaurants', label: 'Restaurants' },
  { key: 'restaurant_groups', label: 'Restaurant Groups' },
  { key: 'users', label: 'Users' },
  { key: 'restaurant_staff', label: 'Restaurant Staff' },
  { key: 'menu', label: 'Menu Management' },
  { key: 'banners', label: 'Banners' },
  { key: 'bookings', label: 'Bookings' },
  { key: 'availability', label: 'Availability' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'reports', label: 'Reports' },
  { key: 'ad_analytics', label: 'Ad Analytics' },
  { key: 'events', label: 'Events' },
  { key: 'punch_cards', label: 'Punch Cards' },
  { key: 'special_offers', label: 'Special Offers' },
  { key: 'settings', label: 'Settings' },
  { key: 'audit_logs', label: 'Audit Logs' },
  { key: 'onboarding', label: 'Onboard Restaurant' },
]

const BOOKING_FIELDS = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'notes', label: 'Notes' },
  { key: 'preferred_section', label: 'Preferred Section' },
]

const BOOKING_ACTIONS = [
  { key: 'can_accept_decline', label: 'Accept/Decline Bookings' },
]

export function AdminPermissionsManager() {
  const [admins, setAdmins] = useState<Admin[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null)
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [adminToDelete, setAdminToDelete] = useState<Admin | null>(null)
  const [saving, setSaving] = useState(false)

  // Permission form state
  const [allowedSections, setAllowedSections] = useState<string[]>([])
  const [bookingFieldVisibility, setBookingFieldVisibility] = useState<Record<string, boolean>>({
    name: true,
    email: true,
    phone: true,
    notes: true,
    preferred_section: true,
  })
  const [bookingActions, setBookingActions] = useState<Record<string, boolean>>({
    can_accept_decline: true,
  })

  useEffect(() => {
    fetchAdmins()
  }, [])

  const fetchAdmins = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/permissions')
      if (!response.ok) {
        throw new Error('Failed to fetch admins')
      }
      const data = await response.json()
      setAdmins(data.admins || [])
    } catch (error: any) {
      console.error('Error fetching admins:', error)
      toast.error(error.message || 'Failed to fetch admins')
    } finally {
      setLoading(false)
    }
  }

  const openPermissionsDialog = (admin: Admin) => {
    setSelectedAdmin(admin)
    
    // Load existing permissions or set defaults
    if (admin.admin_permissions) {
      setAllowedSections(admin.admin_permissions.allowed_sections || [])
      setBookingFieldVisibility(admin.admin_permissions.booking_field_visibility || {
        name: true,
        email: true,
        phone: true,
        notes: true,
        preferred_section: true,
      })
      setBookingActions(admin.admin_permissions.booking_actions || {
        can_accept_decline: true,
      })
    } else {
      // Default: no access
      setAllowedSections([])
      setBookingFieldVisibility({
        name: false,
        email: false,
        phone: false,
        notes: false,
        preferred_section: false,
      })
      setBookingActions({
        can_accept_decline: false,
      })
    }
    
    setPermissionsDialogOpen(true)
  }

  const handleSavePermissions = async () => {
    if (!selectedAdmin) return

    try {
      setSaving(true)
      const response = await fetch('/api/admin/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_id: selectedAdmin.id,
          allowed_sections: allowedSections,
          booking_field_visibility: bookingFieldVisibility,
          booking_actions: bookingActions,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save permissions')
      }

      toast.success('Permissions updated successfully')
      setPermissionsDialogOpen(false)
      fetchAdmins()
    } catch (error: any) {
      console.error('Error saving permissions:', error)
      toast.error(error.message || 'Failed to save permissions')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAdmin = async () => {
    if (!adminToDelete) return

    try {
      const response = await fetch(`/api/admin/admins?admin_id=${adminToDelete.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete admin')
      }

      toast.success('Admin removed successfully')
      setDeleteDialogOpen(false)
      setAdminToDelete(null)
      fetchAdmins()
    } catch (error: any) {
      console.error('Error deleting admin:', error)
      toast.error(error.message || 'Failed to delete admin')
    }
  }

  const toggleSection = (sectionKey: string) => {
    setAllowedSections(prev => {
      if (prev.includes(sectionKey)) {
        return prev.filter(s => s !== sectionKey)
      } else {
        return [...prev, sectionKey]
      }
    })
  }

  const toggleField = (fieldKey: string) => {
    setBookingFieldVisibility(prev => ({
      ...prev,
      [fieldKey]: !prev[fieldKey],
    }))
  }

  const toggleAction = (actionKey: string) => {
    setBookingActions(prev => ({
      ...prev,
      [actionKey]: !prev[actionKey],
    }))
  }

  const filteredAdmins = admins.filter(admin => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      admin.profiles?.email?.toLowerCase().includes(query) ||
      admin.profiles?.full_name?.toLowerCase().includes(query) ||
      admin.role.toLowerCase().includes(query)
    )
  })

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Admin Permissions Management
              </CardTitle>
              <CardDescription>
                Control what each admin can see and do in the admin panel
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search admins by name, email, or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 motion-safe:animate-spin text-gray-400" />
            </div>
          ) : filteredAdmins.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              {searchQuery ? 'No admins found matching your search' : 'No admins found'}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAdmins.map((admin) => (
                <div
                  key={admin.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center">
                      <span className="text-white font-medium">
                        {admin.profiles?.full_name?.charAt(0).toUpperCase() ||
                          admin.profiles?.email?.charAt(0).toUpperCase() ||
                          'A'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">
                          {admin.profiles?.full_name || 'Unknown User'}
                        </p>
                        <Badge variant={admin.role === 'super_admin' ? 'default' : 'secondary'}>
                          {admin.role.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500 truncate">
                        {admin.profiles?.email || 'No email'}
                      </p>
                      {admin.admin_permissions && (
                        <p className="text-xs text-gray-400 mt-1">
                          {admin.admin_permissions.allowed_sections.length} section(s) allowed
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {admin.role !== 'super_admin' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openPermissionsDialog(admin)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Permissions
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setAdminToDelete(admin)
                            setDeleteDialogOpen(true)
                          }}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {admin.role === 'super_admin' && (
                      <Badge variant="outline" className="text-xs">
                        Full Access
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Permissions Dialog */}
      <Dialog open={permissionsDialogOpen} onOpenChange={setPermissionsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Manage Permissions: {selectedAdmin?.profiles?.full_name || selectedAdmin?.profiles?.email}
            </DialogTitle>
            <DialogDescription>
              Control which sections this admin can access and which booking fields they can see
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Allowed Sections */}
            <div>
              <Label className="text-base font-semibold mb-3 block">Allowed Sections</Label>
              <div className="grid grid-cols-2 gap-3">
                {AVAILABLE_SECTIONS.map((section) => (
                  <div key={section.key} className="flex items-center space-x-2">
                    <Checkbox
                      id={`section-${section.key}`}
                      checked={allowedSections.includes(section.key)}
                      onCheckedChange={() => toggleSection(section.key)}
                    />
                    <Label
                      htmlFor={`section-${section.key}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {section.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Booking Field Visibility */}
            <div>
              <Label className="text-base font-semibold mb-3 block">Booking Field Visibility</Label>
              <div className="space-y-2">
                {BOOKING_FIELDS.map((field) => (
                  <div key={field.key} className="flex items-center space-x-2">
                    <Checkbox
                      id={`field-${field.key}`}
                      checked={bookingFieldVisibility[field.key] === true}
                      onCheckedChange={() => toggleField(field.key)}
                    />
                    <Label
                      htmlFor={`field-${field.key}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {field.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Booking Actions */}
            <div>
              <Label className="text-base font-semibold mb-3 block">Booking Actions</Label>
              <div className="space-y-2">
                {BOOKING_ACTIONS.map((action) => (
                  <div key={action.key} className="flex items-center space-x-2">
                    <Checkbox
                      id={`action-${action.key}`}
                      checked={bookingActions[action.key] === true}
                      onCheckedChange={() => toggleAction(action.key)}
                    />
                    <Label
                      htmlFor={`action-${action.key}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {action.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPermissionsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePermissions} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />}
              Save Permissions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Admin?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{' '}
              <strong>{adminToDelete?.profiles?.full_name || adminToDelete?.profiles?.email}</strong>{' '}
              as an admin? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAdmin}
              className="bg-red-600 hover:bg-red-700"
            >
              Remove Admin
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
