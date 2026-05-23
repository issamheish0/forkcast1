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

export default function SignUp() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (!fullName || !email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await signUp({ email: email.trim(), password, fullName: fullName.trim() });
      router.replace("/(protected)/(tabs)");
    } catch (e: any) {
      setError(e?.message ?? "Sign up failed.");
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
          <Text className="text-3xl font-bold text-foreground">Create account</Text>
          <Text className="mt-2 text-muted-foreground">
            Get started in seconds. It's free.
          </Text>

          <View className="mt-8 gap-4">
            <View>
              <Text className="mb-1 text-sm text-foreground">Full name</Text>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="Jane Doe"
                className="rounded-xl border border-border bg-card px-4 py-3 text-foreground"
              />
            </View>
            <View>
              <Text className="mb-1 text-sm text-foreground">Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
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
                placeholder="At least 8 characters"
                className="rounded-xl border border-border bg-card px-4 py-3 text-foreground"
              />
            </View>
            <View>
              <Text className="mb-1 text-sm text-foreground">Confirm password</Text>
              <TextInput
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry
                placeholder="Re-enter your password"
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
              <Text className="text-base font-semibold text-primary-foreground">
                Create account
              </Text>
            )}
          </Pressable>

          <View className="mt-6 flex-row justify-center gap-1">
            <Text className="text-muted-foreground">Already have an account?</Text>
            <Link href="/sign-in" className="text-primary font-semibold">
              Sign in
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
