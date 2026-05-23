// app/(dashboard)/staff/page.tsx
"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { restaurantAuth, type StaffMember, type Role } from "@/lib/restaurant-auth"
import { useRestaurantContext } from "@/lib/contexts/restaurant-context"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "react-hot-toast"
import {
  UserPlus,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Mail,
  Phone,
  Shield,
  Clock,
  CheckCircle2,
  AlertCircle,
  Users,
  Crown,
  Star,
  Coffee,
  Eye,
  Activity,
  Loader2,
  Settings,
  X
} from "lucide-react"

// Types
type User = {
  id: string
  email: string
  user_metadata: {
    full_name?: string
    phone_number?: string
  }
}

// Form schemas
const staffFormSchema = z.object({
  selectedUserId: z.string().min(1, "Please select a user"),
  role: z.enum(["manager", "staff", "viewer"]),
  permissions: z.array(z.string()).min(1, "Select at least one permission"),
})

type StaffFormData = z.infer<typeof staffFormSchema>

// Edit Staff form schema
const editStaffFormSchema = z.object({
  role: z.enum(["owner", "manager", "staff", "viewer"]),
  permissions: z.array(z.string()).min(1, "Select at least one permission"),
})

type EditStaffFormData = z.infer<typeof editStaffFormSchema>

// User search types
type SearchedUser = {
  id: string
  email: string
  full_name: string
  phone_number: string | null
  avatar_url: string | null
  isAlreadyStaff?: boolean
}

// Constants
const ROLES = [
  { 
    value: 'owner', 
    label: 'Owner', 
    description: 'Full access to all features',
    icon: Crown,
    color: 'bg-yellow-100 text-yellow-800'
  },
  { 
    value: 'manager', 
    label: 'Manager', 
    description: 'Manage bookings, menu, and staff',
    icon: Star,
    color: 'bg-purple-100 text-purple-800'
  },
  { 
    value: 'staff', 
    label: 'Staff', 
    description: 'Handle bookings and customers',
    icon: Coffee,
    color: 'bg-blue-100 text-blue-800'
  },
  { 
    value: 'viewer', 
    label: 'Viewer', 
    description: 'View-only access',
    icon: Eye,
    color: 'bg-gray-100 text-gray-800'
  }
]

const PERMISSIONS = [
  { 
    id: 'bookings.view', 
    label: 'View Bookings', 
    category: 'Bookings',
    description: 'See all restaurant bookings'
  },
  { 
    id: 'bookings.manage', 
    label: 'Manage Bookings', 
    category: 'Bookings',
    description: 'Create, edit, and cancel bookings'
  },
  { 
    id: 'menu.view', 
    label: 'View Menu', 
    category: 'Menu',
    description: 'See restaurant menu items'
  },
  { 
    id: 'menu.manage', 
    label: 'Manage Menu', 
    category: 'Menu',
    description: 'Add, edit, and remove menu items'
  },
  { 
    id: 'tables.view', 
    label: 'View Tables', 
    category: 'Tables',
    description: 'See table layout and availability'
  },
  { 
    id: 'tables.manage', 
    label: 'Manage Tables', 
    category: 'Tables',
    description: 'Edit table configuration'
  },
  { 
    id: 'customers.view', 
    label: 'View Customers', 
    category: 'Customers',
    description: 'See customer information'
  },
  { 
    id: 'customers.manage', 
    label: 'Manage VIP/Loyalty', 
    category: 'Customers',
    description: 'Manage customer VIP status and loyalty'
  },
  { 
    id: 'analytics.view', 
    label: 'View Analytics', 
    category: 'Analytics',
    description: 'Access restaurant analytics'
  },
  { 
    id: 'settings.view', 
    label: 'View Settings', 
    category: 'Settings',
    description: 'See restaurant settings'
  },
  { 
    id: 'settings.manage', 
    label: 'Manage Settings', 
    category: 'Settings',
    description: 'Change restaurant configuration'
  },
  { 
    id: 'staff.manage', 
    label: 'Manage Staff', 
    category: 'Staff',
    description: 'Add, edit, and remove staff members'
  },
  { 
    id: 'schedules.view', 
    label: 'View Schedules', 
    category: 'Schedules',
    description: 'View staff schedules and time clock'
  },
  { 
    id: 'schedules.manage', 
    label: 'Manage Schedules', 
    category: 'Schedules',
    description: 'Create and edit staff schedules'
  }
]

export default function StaffPage() {
  const router = useRouter()
  const supabase = createClient()
  const { currentRestaurant, isLoading: contextLoading } = useRestaurantContext()
  const restaurantId = currentRestaurant?.restaurant.id
  
  // State
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [currentStaff, setCurrentStaff] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isAddingStaff, setIsAddingStaff] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  
  // User search state
  const [emailSearch, setEmailSearch] = useState("")
  const [searchedUsers, setSearchedUsers] = useState<SearchedUser[]>([])
  const [selectedUser, setSelectedUser] = useState<SearchedUser | null>(null)
  const [isSearchingUsers, setIsSearchingUsers] = useState(false)

  // Edit staff state
  const [isEditingStaff, setIsEditingStaff] = useState(false)
  const [staffToEdit, setStaffToEdit] = useState<StaffMember | null>(null)

  // Form
  const form = useForm<StaffFormData>({
    resolver: zodResolver(staffFormSchema),
    defaultValues: {
      selectedUserId: "",
      role: "staff",
      permissions: restaurantAuth.getDefaultPermissions("staff"),
    },
  })

  const editForm = useForm<EditStaffFormData>({
    resolver: zodResolver(editStaffFormSchema),
    defaultValues: {
      role: "staff",
      permissions: restaurantAuth.getDefaultPermissions("staff"),
    },
  })

  // Watch role changes to update permissions
  const watchedRole = form.watch("role")
  useEffect(() => {
    if (watchedRole) {
      form.setValue("permissions", restaurantAuth.getDefaultPermissions(watchedRole))
    }
  }, [watchedRole, form])

  // Search users when email changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (emailSearch && emailSearch.trim().length >= 2 && !selectedUser) {
        searchUsers(emailSearch)
      } else if (emailSearch.trim().length < 2) {
        setSearchedUsers([])
      }
    }, 300) // Reduced delay for better responsiveness

    return () => clearTimeout(timer)
  }, [emailSearch, selectedUser, restaurantId])

  // Watch edit role changes to update permissions
  const editWatchedRole = editForm.watch("role")
  useEffect(() => {
    if (editWatchedRole && isEditingStaff) {
      editForm.setValue("permissions", restaurantAuth.getDefaultPermissions(editWatchedRole))
    }
  }, [editWatchedRole, editForm, isEditingStaff])

  // Check permissions on mount
  useEffect(() => {
    if (!contextLoading && currentRestaurant) {
      // For basic tier, allow staff with schedules.view permission to access staff page
      // For pro tier, require staff.manage permission
      const requiredPermission = currentRestaurant.restaurant.tier === 'basic'
        ? 'schedules.view'
        : 'staff.manage'

      const hasPermission = restaurantAuth.hasPermission(
        currentRestaurant.permissions,
        requiredPermission,
        currentRestaurant.role
      )

      if (!hasPermission) {
        toast.error("You don't have permission to manage staff")
        router.push('/bookings')
      }
    } else if (!contextLoading && !currentRestaurant) {
      router.push('/bookings')
    }
  }, [contextLoading, currentRestaurant, router])

  const loadInitialData = async () => {
    if (!restaurantId) return
    
    try {
      setLoading(true)

      // Get current user
      const { data: { user } }:any = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setCurrentUser(user)

      // Get current staff data for this restaurant
      const { data: staffData, error: staffError } = await supabase
        .from('restaurant_staff')
        .select(`
          id,
          role,
          permissions,
          restaurant_id
        `)
        .eq('user_id', user.id)
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .single()

      if (staffError || !staffData) {
        console.error('Staff query error:', staffError)
        console.log('Staff data result:', staffData)
        toast.error("You don't have access to manage staff")
        router.push('/bookings')
        return
      }

      setCurrentStaff(staffData)

      // Load staff members
      await loadStaffMembers(restaurantId)

    } catch (error) {
      console.error('Error loading initial data:', error)
      toast.error('Failed to load staff data')
    } finally {
      setLoading(false)
    }
  }

  // Load initial data when restaurant ID is available
  useEffect(() => {
    if (restaurantId) {
      loadInitialData()
    }
  }, [restaurantId])

  const loadStaffMembers = async (restaurantId: string) => {
    try {
      const staff = await restaurantAuth.getRestaurantStaff(restaurantId)
      setStaffMembers(staff)
    } catch (error) {
      console.error('Error loading staff members:', error)
      toast.error('Failed to load staff members')
    }
  }

  // Search for users using RPC to bypass RLS (20k+ rows cause statement timeout with direct queries)
  const searchUsers = async (query: string) => {
    const trimmed = query.trim()
    if (!trimmed || trimmed.length < 2) {
      setSearchedUsers([])
      return
    }

    try {
      setIsSearchingUsers(true)

      const { data, error } = await supabase.rpc('search_profiles_admin', { search_query: trimmed })
      if (error) throw error

      let validUsers: SearchedUser[] = (data || [])
        .filter((u: any) => u.id && u.email && u.full_name)
        .map((u: any) => ({
          id: u.id,
          email: u.email,
          full_name: u.full_name,
          phone_number: u.phone_number || null,
          avatar_url: null
        }))

      // Mark users already staff for this restaurant
      if (validUsers.length > 0 && restaurantId) {
        const userIds = validUsers.map(u => u.id)
        const { data: existingStaff, error: staffCheckError } = await supabase
          .from('restaurant_staff')
          .select('user_id')
          .eq('restaurant_id', restaurantId)
          .in('user_id', userIds)

        if (!staffCheckError && existingStaff) {
          const staffUserIds = new Set(existingStaff.map(s => s.user_id))
          validUsers = validUsers.map(u => ({ ...u, isAlreadyStaff: staffUserIds.has(u.id) }))
        }
      }

      setSearchedUsers(validUsers)
    } catch (error: any) {
      console.error('Error searching users:', error)
      toast.error(error.message || 'Failed to search users')
      setSearchedUsers([])
    } finally {
      setIsSearchingUsers(false)
    }
  }

  // Handle user selection
  const handleUserSelect = (user: SearchedUser) => {
    setSelectedUser(user)
    form.setValue('selectedUserId', user.id)
    setEmailSearch(user.email)
    setSearchedUsers([])
  }

  // Clear user selection
  const clearUserSelection = () => {
    setSelectedUser(null)
    setEmailSearch("")
    setSearchedUsers([])
    form.setValue('selectedUserId', "")
  }

  // Open Edit Staff dialog
  const handleOpenEdit = (staff: StaffMember) => {
    setStaffToEdit(staff)
    editForm.reset({
      role: staff.role,
      permissions: staff.permissions || [],
    })
    setIsEditingStaff(true)
  }

  // Close Edit Staff dialog
  const handleCloseEdit = () => {
    setIsEditingStaff(false)
    setStaffToEdit(null)
  }

  // Save edits
  const handleSaveEdit = async (data: EditStaffFormData) => {
    if (!currentUser || !staffToEdit || !restaurantId) return
    try {
      setLoading(true)
      await restaurantAuth.updateStaffMember(
        staffToEdit.id,
        {
          // Only pass columns that exist in restaurant_staff
          role: data.role as any,
          permissions: data.permissions as any,
        } as any,
        currentUser.id
      )
      toast.success("Staff member updated")
      handleCloseEdit()
      await loadStaffMembers(restaurantId)
    } catch (error: any) {
      console.error('Error updating staff:', error)
      toast.error(error.message || 'Failed to update staff')
    } finally {
      setLoading(false)
    }
  }

  // Add staff member
  const handleAddStaff = async (data: StaffFormData) => {
    if (!currentUser || !restaurantId || !selectedUser) return

    try {
      setLoading(true)
      
      await restaurantAuth.addExistingUserAsStaff(
        restaurantId,
        data.selectedUserId,
        data.role,
        data.permissions,
        currentUser.id
      )

      toast.success(`${selectedUser.full_name} added as staff member successfully`)
      setIsAddingStaff(false)
      form.reset()
      clearUserSelection()
      await loadStaffMembers(restaurantId)

    } catch (error: any) {
      console.error('Error adding staff:', error)
      toast.error(error.message || "Failed to add staff member")
    } finally {
      setLoading(false)
    }
  }

  // Toggle staff status
  const handleToggleStatus = async (staffId: string, currentStatus: boolean) => {
    if (!currentUser || !restaurantId) return

    try {
      await restaurantAuth.updateStaffMember(
        staffId,
        { is_active: !currentStatus },
        currentUser.id
      )

      toast.success(`Staff member ${!currentStatus ? 'activated' : 'deactivated'}`)
      await loadStaffMembers(restaurantId)

    } catch (error: any) {
      console.error('Error updating staff status:', error)
      toast.error(error.message || "Failed to update staff status")
    }
  }

  // Filter staff members
  const filteredStaff = useMemo(() => {
    return staffMembers.filter(staff => {
      const matchesSearch = !searchQuery || 
        staff.user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        staff.user.email.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesRole = roleFilter === 'all' || staff.role === roleFilter
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'active' && staff.is_active) ||
        (statusFilter === 'inactive' && !staff.is_active)
      
      return matchesSearch && matchesRole && matchesStatus
    })
  }, [staffMembers, searchQuery, roleFilter, statusFilter])

  // Staff statistics
  const stats = useMemo(() => {
    const total = staffMembers.length
    const active = staffMembers.filter(s => s.is_active).length
    const byRole = staffMembers.reduce((acc, staff) => {
      acc[staff.role] = (acc[staff.role] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return { total, active, inactive: total - active, byRole }
  }, [staffMembers])

  const StatsCard = ({ title, value, subtitle, icon: Icon }: {
    title: string
    value: string | number
    subtitle?: string
    icon: any
  }) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-xl font-bold">{value}</p>
            {subtitle && <p className="text-sm text-muted-foreground text-sm">{subtitle}</p>}
          </div>
          <div className="p-3 bg-primary/10 rounded-lg">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const RoleBadge = ({ role }: { role: string }) => {
    const roleConfig = ROLES.find(r => r.value === role)
    if (!roleConfig) return <Badge variant="secondary">{role}</Badge>

    return (
      <Badge variant="secondary" className={roleConfig.color}>
        <roleConfig.icon className="w-3 h-3 mr-1" />
        {roleConfig.label}
      </Badge>
    )
  }

  if (contextLoading || loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-6 w-6 motion-safe:animate-spin" />
      </div>
    )
  }

  if (!currentRestaurant || !restaurantId) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-gray-600">No restaurant selected.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Compact Header Bar */}
      <div className="flex-shrink-0 px-3 py-2 border-b bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-blue-500 flex items-center justify-center">
              <Users className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">Staff</h1>
              <p className="text-xs text-muted-foreground">{staffMembers.length} members</p>
            </div>
          </div>
          
          <Dialog open={isAddingStaff} onOpenChange={(open) => {
            setIsAddingStaff(open)
            if (!open) {
              clearUserSelection()
              form.reset()
            }
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 px-3 text-xs">
                <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                Add
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Staff Member</DialogTitle>
              <DialogDescription>
                Invite a new team member to your restaurant
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleAddStaff)} className="space-y-4">
                {/* User Search Section */}
                <div className="space-y-4">
                  <div>
                    <FormLabel>Search User by Email</FormLabel>
                    <div className="relative">
                      <Input
                        type="email"
                        placeholder="Enter email to search for existing users..."
                        value={emailSearch}
                        onChange={(e) => setEmailSearch(e.target.value)}
                        className="pr-20"
                      />
                      <div className="absolute right-2 top-2 flex items-center gap-1">
                        {isSearchingUsers && (
                          <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
                        )}
                        {emailSearch && emailSearch.trim().length >= 2 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0"
                            onClick={() => searchUsers(emailSearch)}
                            disabled={isSearchingUsers}
                          >
                            <Search className="h-3 w-3" />
                          </Button>
                        )}
                        {selectedUser && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0"
                            onClick={clearUserSelection}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {emailSearch && emailSearch.trim().length >= 2 && !isSearchingUsers && searchedUsers.length === 0 && !selectedUser && (
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>No users found. Try:</p>
                        <ul className="text-xs list-disc list-inside ml-2 space-y-1">
                          <li>Checking the email spelling</li>
                          <li>Searching by name instead</li>
                          <li>Using just the username part (before @)</li>
                          <li>Making sure the user has registered</li>
                        </ul>
                      </div>
                    )}
                    {emailSearch && emailSearch.trim().length < 2 && (
                      <p className="text-sm text-muted-foreground">
                        Enter at least 2 characters to search
                      </p>
                    )}
                  </div>

                  {/* Selected User Display */}
                  {selectedUser && (
                    <div className="p-4 border rounded-lg bg-muted/50">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-semibold">
                            {selectedUser.full_name.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium">{selectedUser.full_name}</h4>
                          <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                          {selectedUser.phone_number && (
                            <p className="text-sm text-muted-foreground">{selectedUser.phone_number}</p>
                          )}
                        </div>
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      </div>
                    </div>
                  )}

                  {/* Search Results */}
                  {searchedUsers.length > 0 && !selectedUser && (
                    <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg">
                      {searchedUsers.map((user) => (
                        <div
                          key={user.id}
                          className={`p-3 cursor-pointer hover:bg-muted/50 border-b last:border-b-0 ${
                            user.isAlreadyStaff ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                          onClick={() => !user.isAlreadyStaff && handleUserSelect(user)}
                        >
                          <div className="flex items-center space-x-3">
                            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-xs font-semibold">
                                {user.full_name.split(' ').map(n => n[0]).join('')}
                              </span>
                            </div>
                            <div className="flex-1">
                              <div className="font-medium">{user.full_name}</div>
                              <div className="text-sm text-muted-foreground">{user.email}</div>
                              {user.phone_number && (
                                <div className="text-sm text-muted-foreground">{user.phone_number}</div>
                              )}
                              {user.isAlreadyStaff && (
                                <div className="text-xs text-orange-600 font-medium">Already staff member</div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Hidden form field for selected user */}
                  <FormField
                    control={form.control}
                    name="selectedUserId"
                    render={() => (
                      <FormItem className="hidden">
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Role Selection */}
                {selectedUser && (
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ROLES.slice(1).map((role) => (
                              <SelectItem key={role.value} value={role.value}>
                                <div className="flex items-center space-x-2">
                                  <role.icon className="w-4 h-4" />
                                  <div>
                                    <div className="font-medium">{role.label}</div>
                                    <div className="text-sm text-muted-foreground">{role.description}</div>
                                  </div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Permissions Section */}
                {selectedUser && (
                  <FormField
                    control={form.control}
                    name="permissions"
                    render={() => (
                      <FormItem>
                        <div className="mb-4">
                          <FormLabel className="text-base">Permissions</FormLabel>
                          <FormDescription>
                            Select what this staff member can do
                          </FormDescription>
                        </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-64 overflow-y-auto border rounded-lg p-4">
                        {Object.entries(
                          PERMISSIONS.reduce((acc, permission) => {
                            if (!acc[permission.category]) acc[permission.category] = []
                            acc[permission.category].push(permission)
                            return acc
                          }, {} as Record<string, typeof PERMISSIONS>)
                        ).map(([category, permissions]) => (
                          <div key={category} className="space-y-3">
                            <h4 className="font-medium text-sm">{category}</h4>
                            <div className="space-y-3">
                              {permissions.map((permission) => (
                                <FormField
                                  key={permission.id}
                                  control={form.control}
                                  name="permissions"
                                  render={({ field }) => {
                                    return (
                                      <FormItem
                                        key={permission.id}
                                        className="flex flex-row items-start space-x-3 space-y-0"
                                      >
                                        <FormControl>
                                          <Checkbox
                                            checked={field.value?.includes(permission.id)}
                                            onCheckedChange={(checked) => {
                                              return checked
                                                ? field.onChange([...field.value, permission.id])
                                                : field.onChange(
                                                    field.value?.filter(
                                                      (value) => value !== permission.id
                                                    )
                                                  )
                                            }}
                                          />
                                        </FormControl>
                                        <div className="space-y-1 leading-none">
                                          <FormLabel className="text-sm font-normal">
                                            {permission.label}
                                          </FormLabel>
                                          <p className="text-xs text-muted-foreground text-sm">{permission.description}
                                          </p>
                                        </div>
                                      </FormItem>
                                    )
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                )}

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddingStaff(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading || !selectedUser}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Add Staff Member
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </div>

    {/* Quick Stats Pills */}
      <div className="flex-shrink-0 px-3 py-2 border-b">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <div className="px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium whitespace-nowrap">
            {stats.total} Total
          </div>
          <div className="px-3 py-1.5 rounded-full bg-green-100 text-green-700 text-xs font-medium whitespace-nowrap">
            {stats.active} Active
          </div>
          <div className="px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium whitespace-nowrap">
            {stats.byRole.manager || 0} Managers
          </div>
          <div className="px-3 py-1.5 rounded-full bg-purple-100 text-purple-700 text-xs font-medium whitespace-nowrap">
            {stats.byRole.staff || 0} Staff
          </div>
          <div className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 text-xs font-medium whitespace-nowrap">
            {stats.inactive} Inactive
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex-shrink-0 px-3 py-2 bg-card/30">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[140px]">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search staff..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-10 text-sm"
            />
          </div>
          
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-24 h-10 text-xs">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {ROLES.map((role) => (
                <SelectItem key={role.value} value={role.value}>
                  {role.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-24 h-10 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Staff List - Scrollable Area */}
      <div className="flex-1 overflow-y-auto">
        {filteredStaff.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Users className="h-10 w-10 text-muted-foreground mb-2" />
            <p className="text-sm font-medium">No staff found</p>
            <p className="text-xs text-muted-foreground">
              {searchQuery || roleFilter !== 'all' || statusFilter !== 'all'
                ? 'Try different filters'
                : 'Add your first team member'
              }
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredStaff.map((staff) => (
              <div key={staff.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors">
                {/* Avatar */}
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold">
                    {staff.user.full_name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{staff.user.full_name}</span>
                    <RoleBadge role={staff.role} />
                    <Badge 
                      variant={staff.is_active ? "default" : "secondary"}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {staff.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="truncate">{staff.user.email}</span>
                    {staff.last_login_at && (
                      <span className="flex items-center whitespace-nowrap">
                        <Clock className="h-3 w-3 mr-0.5" />
                        {new Date(staff.last_login_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleOpenEdit(staff)}
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleToggleStatus(staff.id, staff.is_active)}
                  >
                    {staff.is_active ? (
                      <X className="h-3.5 w-3.5 text-red-500" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Staff Dialog */}
      <Dialog open={isEditingStaff} onOpenChange={(open) => {
        setIsEditingStaff(open)
        if (!open) handleCloseEdit()
      }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Staff</DialogTitle>
            <DialogDescription>
              Update role and permissions for this staff member
            </DialogDescription>
          </DialogHeader>

          {staffToEdit && (
            <div className="space-y-4">
              <div className="p-3 border rounded-lg bg-muted/50">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <span className="text-sm font-semibold">
                      {staffToEdit.user.full_name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{staffToEdit.user.full_name}</div>
                    <div className="text-sm text-muted-foreground">{staffToEdit.user.email || 'No email'}</div>
                  </div>
                </div>
              </div>

              <Form {...editForm}>
                <form onSubmit={editForm.handleSubmit(handleSaveEdit)} className="space-y-4">
                  <FormField
                    control={editForm.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ROLES.map((role) => (
                              <SelectItem key={role.value} value={role.value}>
                                <div className="flex items-center space-x-2">
                                  <role.icon className="w-4 h-4" />
                                  <div>
                                    <div className="font-medium">{role.label}</div>
                                    <div className="text-sm text-muted-foreground">{role.description}</div>
                                  </div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="permissions"
                    render={() => (
                      <FormItem>
                        <div className="mb-2">
                          <FormLabel>Permissions</FormLabel>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-64 overflow-y-auto border rounded-lg p-4">
                          {Object.entries(
                            PERMISSIONS.reduce((acc, permission) => {
                              if (!acc[permission.category]) acc[permission.category] = []
                              acc[permission.category].push(permission)
                              return acc
                            }, {} as Record<string, typeof PERMISSIONS>)
                          ).map(([category, permissions]) => (
                            <div key={category} className="space-y-3">
                              <h4 className="font-medium text-sm">{category}</h4>
                              <div className="space-y-3">
                                {permissions.map((permission) => (
                                  <FormField
                                    key={permission.id}
                                    control={editForm.control}
                                    name="permissions"
                                    render={({ field }) => (
                                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                        <FormControl>
                                          <Checkbox
                                            checked={field.value?.includes(permission.id)}
                                            onCheckedChange={(checked) => {
                                              return checked
                                                ? field.onChange([...(field.value || []), permission.id])
                                                : field.onChange((field.value || []).filter((v: string) => v !== permission.id))
                                            }}
                                          />
                                        </FormControl>
                                        <div className="space-y-1 leading-none">
                                          <FormLabel className="text-sm font-normal">
                                            {permission.label}
                                          </FormLabel>
                                          <p className="text-xs text-muted-foreground">{permission.description}</p>
                                        </div>
                                      </FormItem>
                                    )}
                                  />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={handleCloseEdit}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Save Changes'
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

