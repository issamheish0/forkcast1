import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  ActivityIndicator,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as z from "zod";

import { SafeAreaView } from "@/components/safe-area-view";
import { Form, FormField, FormInput } from "@/components/ui/form";
import { Text } from "@/components/ui/text";
import { H1, P } from "@/components/ui/typography";
import { useAuth } from "@/context/supabase-provider";
import { useColorScheme } from "@/lib/useColorScheme";
import SignUpScreenSkeleton from "@/components/skeletons/SignUpScreenSkeleton";
import {
  formatDDMMYYYYInput,
  isValidDDMMYYYYFormat,
  convertDDMMYYYYToYYYYMMDD,
} from "@/utils/birthday";
import {
  InternationalPhoneInput,
  isValidPhoneNumber,
  type ICountry,
} from "@/components/ui/international-phone-input";
import type { ICountryCca2 } from "react-native-country-select";
import parsePhoneNumberFromString, {
  type CountryCode,
} from "libphonenumber-js";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";
import { passwordFieldSchema, PASSWORD_MIN_LENGTH } from "@/lib/validators/password";

const formSchema = z
  .object({
    first_name: z
      .string()
      .min(1, "First name is required")
      .max(25, "First name must be less than 25 characters")
      .regex(/^[a-zA-Z\s\u0600-\u06FF]+$/, "Please enter a valid first name"),
    last_name: z
      .string()
      .min(1, "Last name is required")
      .max(25, "Last name must be less than 25 characters")
      .regex(/^[a-zA-Z\s\u0600-\u06FF]+$/, "Please enter a valid last name"),
    email: z
      .string()
      .email("Please enter a valid email address.")
      .toLowerCase(),
    phoneNumber: z.string().min(1, "Phone number is required"),
    dateOfBirth: z
      .string()
      .min(1, "Please enter your date of birth.")
      .refine((date) => {
        return isValidDDMMYYYYFormat(date);
      }, "Please enter a valid date in DD-MM-YYYY format.")
      .refine((date) => {
        const yyyymmddFormat = convertDDMMYYYYToYYYYMMDD(date);
        const parsedDate = new Date(yyyymmddFormat);
        const today = new Date();
        const age = today.getFullYear() - parsedDate.getFullYear();
        const monthDiff = today.getMonth() - parsedDate.getMonth();
        const dayDiff = today.getDate() - parsedDate.getDate();

        return (
          !isNaN(parsedDate.getTime()) &&
          (age > 13 ||
            (age === 13 &&
              (monthDiff > 0 || (monthDiff === 0 && dayDiff >= 0))))
        );
      }, "You must be at least 13 years old to register."),
    password: passwordFieldSchema,
    confirmPassword: z
      .string()
      .min(PASSWORD_MIN_LENGTH, "Please confirm your password."),
    agreeToTerms: z.boolean().refine((val) => val === true, {
      message: "You must agree to the terms and conditions.",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match.",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof formSchema>;

export default function SignUp() {
  const { signUp } = useAuth();
  const { colorScheme } = useColorScheme();
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [passwordValue, setPasswordValue] = React.useState("");
  const [selectedCountry, setSelectedCountry] = React.useState<ICountry | null>(
    null,
  );
  const isDark = colorScheme === "dark";

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      phoneNumber: "",
      dateOfBirth: "",
      password: "",
      confirmPassword: "",
      agreeToTerms: false,
    },
  });

  async function onSubmit(data: FormData) {
    if (!data.agreeToTerms) {
      Alert.alert(
        "Terms Required",
        "You must agree to the Terms and Conditions and Privacy Policy to create an account.",
        [{ text: "OK", style: "default" }],
      );
      return;
    }

    if (!selectedCountry) {
      Alert.alert("Country Required", "Please select your country code.", [
        { text: "OK", style: "default" },
      ]);
      return;
    }

    if (!isValidPhoneNumber(data.phoneNumber, selectedCountry)) {
      Alert.alert(
        "Invalid Phone Number",
        "Please enter a valid phone number for the selected country.",
        [{ text: "OK", style: "default" }],
      );
      return;
    }

    try {
      setLoading(true);
      const dobForDatabase = convertDDMMYYYYToYYYYMMDD(data.dateOfBirth);
      const fullName =
        `${data.first_name.trim()} ${data.last_name.trim()}`.trim();

      const national = data.phoneNumber.replace(/^0+/, "").replace(/\s/g, "");
      const parsedPhone = parsePhoneNumberFromString(
        national,
        selectedCountry.cca2 as CountryCode,
      );
      const phoneE164 = parsedPhone?.format("E.164") ?? "";

      if (!phoneE164) {
        Alert.alert(
          "Invalid Phone Number",
          "Could not format your phone number. Please check and try again.",
          [{ text: "OK" }],
        );
        return;
      }

      await signUp(
        data.email,
        data.password,
        fullName,
        phoneE164,
        dobForDatabase,
        data.first_name.trim(),
        data.last_name.trim(),
      );

      form.reset();
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));

      let errorMessage = "An error occurred during sign up.";
      let errorTitle = "Sign Up Error";

      if (
        err.message?.toLowerCase().includes("already registered") ||
        err.message?.toLowerCase().includes("already exists") ||
        err.message?.toLowerCase().includes("email is already")
      ) {
        errorTitle = "Account Already Exists";
        errorMessage =
          "This email is already registered. Please sign in instead or use 'Forgot Password' if you need to reset your password.";

        Alert.alert(errorTitle, errorMessage, [
          {
            text: "Go to Sign In",
            onPress: () => router.replace("/sign-in"),
            style: "default",
          },
          {
            text: "Cancel",
            style: "cancel",
          },
        ]);
        return;
      } else if (
        err.message?.toLowerCase().includes("phone number") &&
        err.message?.toLowerCase().includes("associated")
      ) {
        errorTitle = "Phone Number Already Used";
        errorMessage =
          "This phone number is already associated with another account. Please use a different phone number or sign in to your existing account.";

        Alert.alert(errorTitle, errorMessage, [
          {
            text: "Go to Sign In",
            onPress: () => router.replace("/sign-in"),
            style: "default",
          },
          {
            text: "Use Different Number",
            style: "cancel",
          },
        ]);
        return;
      } else if (err.message?.toLowerCase().includes("weak password")) {
        errorMessage = "Please choose a stronger password.";
      } else if (err.message?.toLowerCase().includes("invalid email")) {
        errorMessage = "Please enter a valid email address.";
      } else if (
        err.message?.toLowerCase().includes("rate limit") ||
        err.message?.toLowerCase().includes("too many")
      ) {
        errorTitle = "Too Many Attempts";
        errorMessage =
          "Too many registration attempts. Please wait a few minutes and try again.";
      } else if (
        err.message?.toLowerCase().includes("database error saving new user")
      ) {
        errorTitle = "Phone Number Already Used";
        errorMessage =
          "This phone number is already associated with another account. Please use a different phone number or sign in to your existing account.";
      } else if (err.message?.toLowerCase().includes("network")) {
        errorTitle = "Connection Error";
        errorMessage =
          "Unable to connect. Please check your internet connection and try again.";
      } else {
        errorMessage = err.message || errorMessage;
      }

      Alert.alert(errorTitle, errorMessage);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <SignUpScreenSkeleton />;
  }

  return (
    <SafeAreaView className="flex-1 bg-primary" edges={["top", "bottom"]}>
      {/* Fixed Header */}
      <View className="p-4 pb-2">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-4 p-2"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={isDark ? "#fff" : "#000"}
            />
          </TouchableOpacity>
          <View className="flex-1">
            <H1 className="self-start text-white">Create Account</H1>
            <P className="text-white/90 mt-2">
              Join thousands discovering great restaurants in Lebanon
            </P>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior="padding"
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16 }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <View className="flex-1 gap-4">
            <Form {...form}>
              <View className="gap-4">
                <FormField
                  control={form.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormInput
                      label="First Name"
                      placeholder="John"
                      autoCapitalize="words"
                      autoComplete="given-name"
                      autoCorrect={false}
                      className="bg-gray-100 dark:bg-gray-800"
                      {...field}
                    />
                  )}
                />
                <FormField
                  control={form.control}
                  name="last_name"
                  render={({ field }) => (
                    <FormInput
                      label="Last Name"
                      placeholder="Doe"
                      autoCapitalize="words"
                      autoComplete="family-name"
                      autoCorrect={false}
                      className="bg-gray-100 dark:bg-gray-800"
                      {...field}
                    />
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormInput
                      label="Email"
                      placeholder="john@example.com"
                      autoCapitalize="none"
                      autoComplete="email"
                      autoCorrect={false}
                      keyboardType="email-address"
                      className="bg-gray-100 dark:bg-gray-800"
                      {...field}
                    />
                  )}
                />
                {/* Phone Number with International Support */}
                <FormField
                  control={form.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <InternationalPhoneInput
                      value={field.value}
                      onChangePhoneNumber={field.onChange}
                      selectedCountry={selectedCountry}
                      onChangeSelectedCountry={setSelectedCountry}
                      label="Phone Number"
                      description="Enter your phone number (country code will be added automatically)"
                      defaultCountry={"LB" as ICountryCca2}
                      error={form.formState.errors.phoneNumber?.message}
                    />
                  )}
                />

                <FormField
                  control={form.control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormInput
                      label="Date of Birth"
                      placeholder="DD-MM-YYYY"
                      description="Must be at least 13 years old to register"
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="numeric"
                      className="bg-gray-100 dark:bg-gray-800"
                      {...field}
                      onChangeText={(value) => {
                        const formattedValue = formatDDMMYYYYInput(value);
                        field.onChange(formattedValue);
                      }}
                    />
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <View className="relative">
                      <FormInput
                        label="Password"
                        placeholder="Create a strong password"
                        description="At least 6 characters with uppercase and lowercase letters. Numbers and special characters are optional but recommended."
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="off"
                        textContentType="none"
                        secureTextEntry={!showPassword}
                        className="bg-gray-100 dark:bg-gray-800"
                        {...field}
                        onChangeText={(value) => {
                          field.onChange(value);
                          setPasswordValue(value);
                        }}
                      />
                      <TouchableOpacity
                        onPress={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-11 h-6 w-6 items-center justify-center"
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons
                          name={showPassword ? "eye-off" : "eye"}
                          size={20}
                          color={isDark ? "#9CA3AF" : "#6B7280"}
                        />
                      </TouchableOpacity>
                      <PasswordStrengthIndicator password={passwordValue} />
                    </View>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <View className="relative">
                      <FormInput
                        label="Confirm Password"
                        placeholder="Re-enter your password"
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="off"
                        textContentType="none"
                        secureTextEntry={!showConfirmPassword}
                        className="bg-gray-100 dark:bg-gray-800"
                        {...field}
                      />
                      <TouchableOpacity
                        onPress={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        className="absolute right-3 top-11 h-6 w-6 items-center justify-center"
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons
                          name={showConfirmPassword ? "eye-off" : "eye"}
                          size={20}
                          color={isDark ? "#9CA3AF" : "#6B7280"}
                        />
                      </TouchableOpacity>
                    </View>
                  )}
                />

                <FormField
                  control={form.control}
                  name="agreeToTerms"
                  render={({ field }) => (
                    <View className="flex-row items-start gap-2 px-1">
                      <TouchableOpacity
                        onPress={() => field.onChange(!field.value)}
                        className="h-4 w-4 rounded border items-center justify-center mt-1"
                        style={{
                          borderColor: isDark ? "#fff" : "#000",
                          backgroundColor: field.value
                            ? isDark
                              ? "#fff"
                              : "#000"
                            : "transparent",
                        }}
                      >
                        {field.value && (
                          <Ionicons
                            name="checkmark"
                            size={12}
                            color={isDark ? "#000" : "#fff"}
                          />
                        )}
                      </TouchableOpacity>
                      <Text className="flex-1 text-xs text-white/70 leading-4">
                        I agree to the{" "}
                        <Text
                          className="text-white/90 underline"
                          onPress={() => router.push("/legal/TERMS_OF_SERVICE")}
                        >
                          Terms and Conditions
                        </Text>{" "}
                        and{" "}
                        <Text
                          className="text-white/90 underline"
                          onPress={() => router.push("/legal/PRIVACY_POLICY")}
                        >
                          Privacy Policy
                        </Text>
                      </Text>
                    </View>
                  )}
                />
              </View>
            </Form>
          </View>

          <View className="gap-4 p-4">
            <TouchableOpacity
              onPress={form.handleSubmit(onSubmit)}
              disabled={form.formState.isSubmitting}
              className={`h-14 rounded-lg items-center justify-center ${
                form.formState.isSubmitting ? "opacity-50" : ""
              }`}
              activeOpacity={0.7}
              style={{
                backgroundColor: "#000",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.12)",
                shadowColor: "#000",
                shadowOpacity: 0.12,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 2 },
                elevation: 2,
              }}
            >
              {form.formState.isSubmitting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="font-medium text-white">Create Account</Text>
              )}
            </TouchableOpacity>

            <View className="flex-row items-center gap-2 justify-center">
              <Text className="text-white/80">Already have an account?</Text>
              <Text
                className="text-white font-medium"
                onPress={() => router.replace("/sign-in")}
              >
                Sign In
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
