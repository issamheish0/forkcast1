import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, LogOut } from "lucide-react-native";
import { useAuth } from "@/context/auth-provider";

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, user, signOut } = useAuth();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-row items-center gap-3 px-4 py-4">
        <Pressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-secondary"
          hitSlop={8}
        >
          <ArrowLeft size={20} color="#5A1E32" />
        </Pressable>
        <Text className="text-xl font-bold text-foreground">Profile</Text>
      </View>

      <View className="p-6">
        <View className="items-center py-6">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-secondary">
            <Text className="text-2xl font-bold text-primary">
              {profile?.full_name?.charAt(0).toUpperCase() ?? "?"}
            </Text>
          </View>
          <Text className="mt-3 text-xl font-bold text-foreground">
            {profile?.full_name ?? "—"}
          </Text>
          <Text className="text-muted-foreground">{user?.email}</Text>
        </View>

        <View className="mt-4 rounded-2xl border border-border bg-card divide-y divide-border">
          <Row label="Full name" value={profile?.full_name ?? "—"} />
          <Row label="Email" value={user?.email ?? "—"} />
          <Row label="Phone" value={profile?.phone_number ?? "Not set"} />
        </View>

        <Pressable
          onPress={async () => {
            await signOut();
          }}
          className="mt-8 flex-row items-center justify-center gap-2 rounded-2xl border border-destructive py-4"
        >
          <LogOut size={18} color="#DC2626" />
          <Text className="font-semibold text-destructive">Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between px-4 py-3">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Text className="text-sm font-medium text-foreground">{value}</Text>
    </View>
  );
}
