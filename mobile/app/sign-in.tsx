import { Link, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/context/auth-provider";

export default function SignIn() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      await signIn({ email: email.trim(), password });
      router.replace("/(protected)/(tabs)");
    } catch (e: any) {
      setError(e?.message ?? "Sign in failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView contentContainerClassName="grow p-6">
          <Text className="text-3xl font-bold text-foreground">Welcome back</Text>
          <Text className="mt-2 text-muted-foreground">Sign in to continue.</Text>

          <View className="mt-8 gap-4">
            <View>
              <Text className="mb-1 text-sm text-foreground">Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                placeholder="you@example.com"
                className="rounded-xl border border-border bg-card px-4 py-3 text-foreground"
              />
            </View>
            <View>
              <Text className="mb-1 text-sm text-foreground">Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
                placeholder="••••••••"
                className="rounded-xl border border-border bg-card px-4 py-3 text-foreground"
              />
            </View>
            {error && <Text className="text-destructive">{error}</Text>}
          </View>

          <Pressable
            onPress={onSubmit}
            disabled={loading}
            className="mt-8 items-center rounded-2xl bg-primary py-4"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-base font-semibold text-primary-foreground">Sign in</Text>
            )}
          </Pressable>

          <View className="mt-6 flex-row justify-center gap-1">
            <Text className="text-muted-foreground">Don't have an account?</Text>
            <Link href="/sign-up" className="text-primary font-semibold">
              Sign up
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
