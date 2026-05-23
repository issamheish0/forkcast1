import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: restaurants } = await supabase
    .from("restaurants")
    .select("*")
    .eq("owner_id", user.id);

  return (
    <SettingsClient
      userId={user.id}
      restaurant={restaurants?.[0] ?? null}
    />
  );
}
