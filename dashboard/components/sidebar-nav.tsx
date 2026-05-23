"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Overview", exact: true },
  { href: "/dashboard/bookings", label: "Bookings" },
  { href: "/dashboard/analytics", label: "Analytics" },
  { href: "/dashboard/customers", label: "Customers" },
  { href: "/dashboard/menus", label: "Menus" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="mt-8 flex flex-col gap-1">
      {LINKS.map(({ href, label, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={
              active
                ? "rounded-lg px-3 py-2 text-sm font-semibold bg-secondary text-primary"
                : "rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary"
            }
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
