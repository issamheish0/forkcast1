// app/page.tsx
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
    return
  }

  // Super-admin check — always takes priority
  const { data: adminData } = await supabase
    .from("rbs_admins")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle()

  if (adminData) {
    redirect("/super-admin")
    return
  }

  redirect("/bookings")
}
