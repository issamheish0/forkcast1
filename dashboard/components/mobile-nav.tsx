"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";

const NAV_LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/bookings", label: "Bookings" },
  { href: "/dashboard/analytics", label: "Analytics" },
  { href: "/dashboard/customers", label: "Customers" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function MobileNav({
  restaurantName,
  userName,
  userEmail,
}: {
  restaurantName?: string | null;
  userName?: string | null;
  userEmail?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      {/* Top header bar — visible on mobile only */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card px-4 py-3 md:hidden">
        <Link href="/dashboard" className="text-lg font-bold text-primary">
          ForkCast
        </Link>
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="rounded-lg p-2 hover:bg-secondary"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card p-6 transition-transform duration-200 md:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className="text-xl font-bold text-primary"
            onClick={() => setOpen(false)}
          >
            ForkCast
          </Link>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="rounded-lg p-1.5 hover:bg-secondary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="mt-8 flex flex-col gap-1">
          {NAV_LINKS.map(({ href, label }) => {
            const isActive =
              href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-secondary"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-6">
          <div className="rounded-lg bg-secondary p-3">
            <p className="text-xs text-muted-foreground">Restaurant</p>
            <p className="truncate text-sm font-semibold text-foreground">
              {restaurantName ?? "Not set up"}
            </p>
          </div>
          <div className="mt-3 rounded-lg p-3">
            {userName && (
              <p className="truncate text-sm text-foreground">{userName}</p>
            )}
            {userEmail && (
              <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
            )}
            <SignOutButton />
          </div>
        </div>
      </div>
    </>
  );
}
