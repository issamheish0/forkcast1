"use client";

import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await getBrowserSupabase().auth.signOut();
        router.replace("/");
        router.refresh();
      }}
      className="mt-2 text-xs text-destructive hover:underline"
    >
      Sign out
    </button>
  );
}
