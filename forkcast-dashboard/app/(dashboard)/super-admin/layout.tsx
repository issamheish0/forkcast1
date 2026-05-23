// Server-side guard for super-admin routes
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Check if user is a super admin
  const { data: adminData } = await supabase
    .from("rbs_admins")
    .select("id, role")
    .eq("user_id", user.id)
    .maybeSingle()

  // Redirect if not a super admin
  if (!adminData || adminData.role !== "super_admin") {
    redirect("/bookings?error=super_admin_required")
  }

  return <>{children}</>
}
