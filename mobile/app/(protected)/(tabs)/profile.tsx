import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LogOut } from "lucide-react-native";
import { useAuth } from "@/context/auth-provider";

export default function Profile() {
  const { profile, user, signOut } = useAuth();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="p-6">
        <Text className="text-2xl font-bold text-foreground">Profile</Text>

        <View className="mt-6 rounded-2xl bg-card border border-border p-5">
          <Text className="text-lg font-semibold text-foreground">
            {profile?.full_name ?? "—"}
          </Text>
          <Text className="text-muted-foreground">{user?.email}</Text>
        </View>

        <Pressable
          onPress={signOut}
          className="mt-6 flex-row items-center justify-center gap-2 rounded-2xl border border-destructive py-4"
        >
          <LogOut size={18} color="#DC2626" />
          <Text className="font-semibold text-destructive">Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
