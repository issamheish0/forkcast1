// app/(dashboard)/profile/page.tsx
"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { useRestaurantContext } from "@/lib/contexts/restaurant-context"
import { strongPasswordSchema } from "@/lib/validators/password"
import { checkPasswordBreach } from "@/lib/validators/password-breach"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "react-hot-toast"
import { 
  User, 
  Mail, 
  Phone, 
  Shield, 
  KeyRound,
  Building,
  Edit,
  Save,
  LogOut
} from "lucide-react"

const profileSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone_number: z.string().optional(),
})

const passwordSchema = z.object({
  currentPassword: z.string(),
  newPassword: strongPasswordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

type ProfileFormData = z.infer<typeof profileSchema>
type PasswordFormData = z.infer<typeof passwordSchema>

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  const { currentRestaurant } = useRestaurantContext()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [userData, setUserData] = useState<any>(null)
  const [allStaffData, setAllStaffData] = useState<any[]>([])
  const [profileData, setProfileData] = useState<any>(null)

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: "",
      email: "",
      phone_number: "",
    },
  })

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  })

  const fetchUserData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/login")
        return
      }

      setUserData(user)

      // Get profile data
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()

      if (profile) {
        setProfileData(profile)
        profileForm.reset({
          full_name: profile.full_name || "",
          email: user.email || "",
          phone_number: profile.phone_number || "",
        })
      }

      // Get all staff data with restaurant info (for multi-restaurant users)
      const { data: staffRecords } = await supabase
        .from("restaurant_staff")
        .select(`
          *,
          restaurant:restaurants(*)
        `)
        .eq("user_id", user.id)
        .eq("is_active", true)

      setAllStaffData(staffRecords || [])
    } catch (error) {
      console.error("Error fetching user data:", error)
    } finally {
      setLoading(false)
    }
  }, [supabase, router, profileForm])

  useEffect(() => {
    fetchUserData()
  }, [fetchUserData])

  // Compute current staff data based on selected restaurant
  const staffData = currentRestaurant
    ? allStaffData.find(staff => staff.restaurant_id === currentRestaurant.restaurant.id)
    : allStaffData[0] // Fallback to first restaurant if no restaurant selected

  const handleProfileUpdate = async (data: ProfileFormData) => {
    try {
      setSaving(true)

      // Update auth email if changed
      if (data.email !== userData?.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: data.email,
        })
        if (emailError) throw emailError
        
        toast.success("Email update requested. Please check your email to confirm the change.")
      }

      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: data.full_name,
          phone_number: data.phone_number,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userData.id)

      if (profileError) throw profileError

      toast.success("Profile updated successfully")
      await fetchUserData() // Refresh data
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile")
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async (data: PasswordFormData) => {
    try {
      setChangingPassword(true)

      const breach = await checkPasswordBreach(data.newPassword)
      if (!breach.ok) {
        const reason = (breach as any).reason
        passwordForm.setError("newPassword", { type: "manual", message: reason })
        throw new Error(reason)
      }

      // First verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userData.email,
        password: data.currentPassword,
      })

      if (signInError) {
        throw new Error("Current password is incorrect")
      }

      // Update password
      const { error } = await supabase.auth.updateUser({
        password: data.newPassword,
      })

      if (error) throw error

      toast.success("Password changed successfully")
      setShowPasswordDialog(false)
      passwordForm.reset()
    } catch (error: any) {
      toast.error(error.message || "Failed to change password")
    } finally {
      setChangingPassword(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      router.push("/login")
    } catch (error) {
      toast.error("Failed to sign out")
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
  }

  const ROLE_LABELS = {
    owner: { label: "Owner", color: "destructive" },
    manager: { label: "Manager", color: "default" },
    staff: { label: "Staff", color: "secondary" },
    viewer: { label: "Viewer", color: "outline" },
  } as const

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Compact Header Bar */}
      <div className="flex-shrink-0 px-3 py-2 border-b bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-slate-500 flex items-center justify-center">
              <User className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">Profile</h1>
              <p className="text-xs text-muted-foreground">Personal info & settings</p>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">

      {/* Profile Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={profileData?.avatar_url} />
              <AvatarFallback>
                {getInitials(profileForm.getValues("full_name") || "U")}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-4">
              <div>
                <h3 className="text-lg font-semibold">
                  {profileForm.getValues("full_name")}
                </h3>
                <p className="text-sm text-muted-foreground text-sm">{profileForm.getValues("email")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge 
                  variant={ROLE_LABELS[staffData?.role as keyof typeof ROLE_LABELS]?.color || "default"}
                >
                  {ROLE_LABELS[staffData?.role as keyof typeof ROLE_LABELS]?.label || staffData?.role}
                </Badge>
                {staffData?.restaurant && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground text-sm"><Building className="h-4 w-4" />
                    {staffData.restaurant.name}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>
            Update your personal details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...profileForm}>
            <form onSubmit={profileForm.handleSubmit(handleProfileUpdate)} className="space-y-4">
              <FormField
                control={profileForm.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <div className="flex">
                        <User className="mr-2 h-4 w-4 mt-3 text-muted-foreground" />
                        <Input {...field} disabled={saving} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={profileForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <div className="flex">
                        <Mail className="mr-2 h-4 w-4 mt-3 text-muted-foreground" />
                        <Input {...field} type="email" disabled={saving} />
                      </div>
                    </FormControl>
                    <FormDescription>
                      Changing your email will require verification
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={profileForm.control}
                name="phone_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <div className="flex">
                        <Phone className="mr-2 h-4 w-4 mt-3 text-muted-foreground" />
                        <Input {...field} disabled={saving} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex justify-end">
                <Button type="submit" disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Account Security */}
      <Card>
        <CardHeader>
          <CardTitle>Account Security</CardTitle>
          <CardDescription>
            Manage your account security settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="font-medium">Password</p>
              <p className="text-sm text-muted-foreground text-sm">Secure your account with a strong password
              </p>
            </div>
            <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
              <Button
                variant="outline"
                onClick={() => setShowPasswordDialog(true)}
              >
                <KeyRound className="mr-2 h-4 w-4" />
                Change Password
              </Button>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Change Password</DialogTitle>
                  <DialogDescription>
                    Enter your current password and choose a new one
                  </DialogDescription>
                </DialogHeader>
                <Form {...passwordForm}>
                  <form onSubmit={passwordForm.handleSubmit(handlePasswordChange)} className="space-y-4">
                    <FormField
                      control={passwordForm.control}
                      name="currentPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Password</FormLabel>
                          <FormControl>
                            <Input {...field} type="password" disabled={changingPassword} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={passwordForm.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Password</FormLabel>
                          <FormControl>
                            <Input {...field} type="password" disabled={changingPassword} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={passwordForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm New Password</FormLabel>
                          <FormControl>
                            <Input {...field} type="password" disabled={changingPassword} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowPasswordDialog(false)
                          passwordForm.reset()
                        }}
                        disabled={changingPassword}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={changingPassword}>
                        {changingPassword ? "Changing..." : "Change Password"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="font-medium">Two-Factor Authentication</p>
              <p className="text-sm text-muted-foreground text-sm">Add an extra layer of security to your account
              </p>
            </div>
            <Badge variant="outline">Coming Soon</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Restaurant Information (if staff) */}
      {staffData && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Restaurant Information</CardTitle>
              <CardDescription>
                Your role and permissions at {staffData.restaurant?.name}
              </CardDescription>
            </div>
            {(staffData.role === 'owner' || staffData.role === 'manager') && (
              <Button
                variant="outline"
                onClick={() => router.push("/settings")}
                className="ml-4"
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit Restaurant
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Role</p>
                <p className="font-medium">{staffData.role}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <Badge variant={staffData.is_active ? "default" : "secondary"}>
                  {staffData.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
            {Array.isArray(staffData.permissions) && staffData.permissions.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Permissions</p>
                <div className="flex flex-wrap gap-2">
                  {staffData.permissions.includes("all") ? (
                    <Badge>All Permissions</Badge>
                  ) : (
                    staffData.permissions.map((permission: string) => (
                      <Badge key={permission} variant="outline">
                        {permission.replace(".", " ").replace(/_/g, " ")}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            )}
            
            {/* Restaurant Quick Info */}
            {staffData.restaurant && (
              <div className="pt-4 border-t">
                <div className="flex items-center gap-4">
                  {staffData.restaurant.main_image_url && (
                    <div className="flex-shrink-0">
                      <Avatar className="h-12 w-12 rounded-lg">
                        <AvatarImage 
                          src={staffData.restaurant.main_image_url} 
                          alt={`${staffData.restaurant.name} logo`}
                          className="object-cover"
                        />
                        <AvatarFallback className="rounded-lg">
                          <Building className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  )}
                  <div className="flex-1">
                    <h4 className="font-semibold">{staffData.restaurant.name}</h4>
                    <p className="text-sm text-muted-foreground text-sm">Restaurant Profile
                    </p>
                  </div>
                  {(staffData.role === 'owner' || staffData.role === 'manager') && (
                    <div className="text-xs text-muted-foreground text-sm">Click "Edit Restaurant" to manage images, details, and settings in Settings
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}

