import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";
import { MobileNav } from "@/components/mobile-nav";
import { SidebarNav } from "@/components/sidebar-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await getServerSupabase();
  // getSession() decodes the JWT from the cookie locally — no network call.
  // The middleware already validates the token server-side on every request.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/sign-in");
  const user = session.user;

  const [profileResult, restaurantsResult] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase.from("restaurants").select("id, name").eq("owner_id", user.id),
  ]);

  const restaurant = restaurantsResult.data?.[0] ?? null;

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 flex-col border-r border-border bg-card p-6 md:flex">
        <Link href="/dashboard" className="text-xl font-bold text-primary">
          ForkCast
        </Link>
        <SidebarNav />

        <div className="mt-auto pt-6">
          <div className="rounded-lg bg-secondary p-3">
            <p className="text-xs text-muted-foreground">Restaurant</p>
            <p className="truncate text-sm font-semibold text-foreground">
              {restaurant?.name ?? "Not set up"}
            </p>
          </div>
          <div className="mt-3 rounded-lg p-3">
            <p className="truncate text-sm text-foreground">{profileResult.data?.full_name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            <SignOutButton />
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}
