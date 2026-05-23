"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const OPTIONS = [7, 14, 30] as const;

export function RangeTabs({ current }: { current: number }) {
  const router = useRouter();
  const params = useSearchParams();

  return (
    <div className="inline-flex rounded-lg border border-border bg-card p-1 gap-1">
      {OPTIONS.map((d) => (
        <button
          key={d}
          onClick={() => {
            const p = new URLSearchParams(params.toString());
            p.set("days", String(d));
            router.push(`/dashboard/analytics?${p.toString()}`);
          }}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            current === d
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {d}d
        </button>
      ))}
    </div>
  );
}
