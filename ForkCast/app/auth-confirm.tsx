import React, { useEffect } from "react";
import { View, ActivityIndicator, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { supabase } from "@/config/supabase";
import { H1, P } from "@/components/ui/typography";
import { SafeAreaView } from "@/components/safe-area-view";

export default function AuthConfirm() {
  const router = useRouter();
  const { message } = useLocalSearchParams<{ message?: string }>();

  useEffect(() => {
    // When the user is redirected back to the app, the session is automatically updated.
    // We can then navigate them to the main part of the app.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        router.replace("/(protected)/(tabs)");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  return (
    <SafeAreaView className="flex-1 bg-background p-4">
      <View className="flex-1 justify-center items-center gap-4">
        <H1>Confirming your account</H1>
        <P className="text-muted-foreground text-center">
          {message ||
            "Please wait while we confirm your account. You will be redirected shortly."}
        </P>
        <ActivityIndicator size="large" />
      </View>
    </SafeAreaView>
  );
}
