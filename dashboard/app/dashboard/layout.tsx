import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  // Fetch the restaurant(s) the user owns or is staff of
  const { data: ownedRestaurants } = await supabase
    .from("restaurants")
    .select("id, name")
    .eq("owner_id", user.id);

  const restaurant = ownedRestaurants?.[0] ?? null;

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 flex-col border-r border-border bg-card p-6 md:flex">
        <Link href="/dashboard" className="text-xl font-bold text-primary">
          ForkCast
        </Link>
        <nav className="mt-8 flex flex-col gap-1">
          <NavLink href="/dashboard">Overview</NavLink>
          <NavLink href="/dashboard/bookings">Bookings</NavLink>
          <NavLink href="/dashboard/settings">Settings</NavLink>
        </nav>

        <div className="mt-auto pt-6">
          <div className="rounded-lg bg-secondary p-3">
            <p className="text-xs text-muted-foreground">Restaurant</p>
            <p className="truncate text-sm font-semibold text-foreground">
              {restaurant?.name ?? "Not set up"}
            </p>
          </div>
          <div className="mt-3 rounded-lg p-3">
            <p className="truncate text-sm text-foreground">{profile?.full_name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            <SignOutButton />
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary"
    >
      {children}
    </Link>
  );
}
