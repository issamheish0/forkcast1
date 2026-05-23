import { Tabs, useRouter } from "expo-router";
import { CalendarDays, Heart, Home, Pressable, Search, User } from "lucide-react-native";
import { Pressable as RNPressable } from "react-native";

function ProfileButton() {
  const router = useRouter();
  return (
    <RNPressable
      onPress={() => router.push("/(protected)/profile")}
      style={{ marginRight: 16 }}
      hitSlop={8}
    >
      <User size={22} color="#5A1E32" />
    </RNPressable>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: "#FAF7F2" },
        headerShadowVisible: false,
        headerTitleStyle: { color: "#5A1E32", fontWeight: "700" },
        headerRight: () => <ProfileButton />,
        tabBarActiveTintColor: "#7A2342",
        tabBarInactiveTintColor: "#7A6A6E",
        tabBarStyle: { borderTopColor: "#E7DACD" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: ({ color, size }) => <Search color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: "Favorites",
          tabBarIcon: ({ color, size }) => <Heart color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: "Bookings",
          tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
