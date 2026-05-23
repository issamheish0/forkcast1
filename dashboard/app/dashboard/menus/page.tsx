import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { MenusClient } from "./menus-client";

export default async function MenusPage() {
  const supabase = await getServerSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/sign-in");
  const user = session.user;

  const { data: restaurants } = await supabase
    .from("restaurants")
    .select("id, name")
    .eq("owner_id", user.id);

  const restaurant = restaurants?.[0] ?? null;

  const { data: menus } = restaurant
    ? await supabase
        .from("menus")
        .select("*, menu_items(*)")
        .eq("restaurant_id", restaurant.id)
        .order("position")
    : { data: [] };

  return (
    <MenusClient
      restaurantId={restaurant?.id ?? null}
      initialMenus={(menus as any[]) ?? []}
    />
  );
}
