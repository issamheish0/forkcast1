// app/(protected)/profile/edit.tsx
import React, { useState, useCallback, useEffect } from "react";
import {
  ScrollView,
  View,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import {
  Camera,
  User,
  Mail,
  ChevronLeft,
  Save,
  AlertCircle,
  Calendar,
  ArrowLeft,
  Phone,
  Shield,
} from "lucide-react-native";
import { BackHeader } from "@/components/ui/back-header";
import * as ImagePicker from "expo-image-picker";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H2, P, Muted } from "@/components/ui/typography";
import { Form, FormField, FormInput } from "@/components/ui/form";
import { Image } from "@/components/image";
import { supabase } from "@/config/supabase";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { useVerifyPhoneModal } from "@/context/verify-phone-modal-context";
import {
  formatDDMMYYYYInput,
  isValidDDMMYYYYFormat,
  convertDDMMYYYYToYYYYMMDD,
  convertYYYYMMDDToDDMMYYYY,
  formatDateToDDMMYYYY,
} from "@/utils/birthday";
import { InternationalPhoneInput } from "@/components/ui/international-phone-input";
import {
  getCountryByPhoneNumber,
  type ICountry,
} from "react-native-international-phone-number";
import {
  validateImageStrict,
  buildSecureStoragePath,
  MAX_IMAGE_SIZE,
} from "@/utils/imageUpload";

// Form Schema
const profileEditSchema = z.object({
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
  email: z.string().email("Please enter a valid email address").toLowerCase(),
  phone_number: z.string().optional(),
  date_of_birth: z
    .string()
    .optional()
    .refine((date) => {
      if (!date) return true; // Optional field
      return isValidDDMMYYYYFormat(date);
    }, "Please enter a valid date in DD-MM-YYYY format.")
    .refine((date) => {
      if (!date) return true; // Optional field
      // Convert DD-MM-YYYY to YYYY-MM-DD for validation
      const yyyymmddFormat = convertDDMMYYYYToYYYYMMDD(date);
      const parsedDate = new Date(yyyymmddFormat);
      const today = new Date();
      const age = today.getFullYear() - parsedDate.getFullYear();
      const monthDiff = today.getMonth() - parsedDate.getMonth();
      const dayDiff = today.getDate() - parsedDate.getDate();

      // Check if date is valid and person is at least 13 years old
      return (
        !isNaN(parsedDate.getTime()) &&
        (age > 13 ||
          (age === 13 && (monthDiff > 0 || (monthDiff === 0 && dayDiff >= 0))))
      );
    }, "You must be at least 13 years old."),
});

type ProfileEditFormData = z.infer<typeof profileEditSchema>;

export default function ProfileEditScreen() {
  const { profile, user, updateProfile, refreshProfile } = useAuth();
  const { openVerifyPhoneModal } = useVerifyPhoneModal();
  const { colorScheme } = useColorScheme();
  const router = useRouter();

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || "");

  // Phone number state for international input (read-only)
  const [selectedCountry, setSelectedCountry] = useState<ICountry | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string>("");

  // 3. Form Setup with Current Values
  const splitName = useCallback((fullName: string) => {
    const nameParts = (fullName || "").trim().split(/\s+/);
    return {
      first_name: nameParts[0] || "",
      last_name: nameParts.slice(1).join(" ") || "",
    };
  }, []);

  // Use database fields if available, otherwise fall back to splitting full_name
  const firstName =
    profile?.first_name || splitName(profile?.full_name || "").first_name;
  const lastName =
    profile?.last_name || splitName(profile?.full_name || "").last_name;

  const form = useForm<ProfileEditFormData>({
    resolver: zodResolver(profileEditSchema),
    defaultValues: {
      first_name: firstName,
      last_name: lastName,
      email: user?.email || "",
      phone_number: profile?.phone_number || "",
      date_of_birth: profile?.date_of_birth
        ? convertYYYYMMDDToDDMMYYYY(profile.date_of_birth)
        : "",
    },
  });

  useFocusEffect(
    useCallback(() => {
      void refreshProfile();
    }, [refreshProfile]),
  );

  useEffect(() => {
    const first =
      profile?.first_name || splitName(profile?.full_name || "").first_name;
    const last =
      profile?.last_name || splitName(profile?.full_name || "").last_name;
    form.reset({
      first_name: first,
      last_name: last,
      email: user?.email || "",
      phone_number: profile?.phone_number || "",
      date_of_birth: profile?.date_of_birth
        ? convertYYYYMMDDToDDMMYYYY(profile.date_of_birth)
        : "",
    });
  }, [
    profile?.first_name,
    profile?.last_name,
    profile?.full_name,
    profile?.phone_number,
    profile?.date_of_birth,
    user?.email,
  ]);

  // Helper to get calling code from country object
  const getCallingCode = useCallback(
    (country: ICountry, phoneNumber: string) => {
      if (!country.idd) return "";
      const root = country.idd.root;
      if (!country.idd.suffixes || country.idd.suffixes.length === 0)
        return root;

      // Check which suffix matches the phone number
      for (const suffix of country.idd.suffixes) {
        const fullCode = `${root}${suffix}`;
        if (phoneNumber.startsWith(fullCode)) {
          return fullCode;
        }
      }

      // Default to first one if no match
      return `${root}${country.idd.suffixes[0]}`;
    },
    [],
  );

  // Parse the phone number to extract country code and number
  useEffect(() => {
    if (profile?.phone_number) {
      const phoneStr = profile.phone_number;
      const detectedCountry = getCountryByPhoneNumber(phoneStr);

      if (detectedCountry) {
        setSelectedCountry(detectedCountry);

        const fullCallingCode = getCallingCode(detectedCountry, phoneStr);
        const callingCodeNoPlus = fullCallingCode.replace("+", "");

        // Check if the number starts with fullCallingCode
        if (phoneStr.startsWith(fullCallingCode)) {
          setPhoneNumber(phoneStr.substring(fullCallingCode.length));
        } else if (phoneStr.startsWith(`+${callingCodeNoPlus}`)) {
          setPhoneNumber(phoneStr.substring(callingCodeNoPlus.length + 1));
        } else {
          // Fallback: just show the number as is if we can't cleanly strip the code
          setPhoneNumber(phoneStr.replace(fullCallingCode, ""));
        }
      } else {
        // Fallback logic if detection fails
        if (phoneStr.startsWith("+961")) {
          setPhoneNumber(phoneStr.substring(4));
        } else {
          setPhoneNumber(phoneStr);
        }
      }
    }
  }, [profile?.phone_number, getCallingCode]);

  // 4. Avatar Upload Handler
  const handleAvatarUpload = useCallback(async () => {
    // Android 13+ uses the system Photo Picker — no READ_MEDIA_IMAGES needed.
    if (Platform.OS !== "android" || Platform.Version < 33) {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(
          "Permission Required",
          "Please allow access to your photo library to change your profile picture.",
        );
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    setUploadingAvatar(true);

    try {
      const file = result.assets[0];

      const validation = await validateImageStrict(file, MAX_IMAGE_SIZE);
      if (!validation.valid || !validation.mime || !validation.extension) {
        Alert.alert(
          "Invalid image",
          validation.error ?? "Please choose a JPEG, PNG, or WebP image.",
        );
        return;
      }

      const filePath = buildSecureStoragePath("avatars", validation.mime);
      const fileName = filePath.split("/").pop() as string;

      const formData = new FormData();
      formData.append("file", {
        uri: file.uri,
        name: fileName,
        type: validation.mime,
      } as any);

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, formData, {
          contentType: validation.mime,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      setAvatarUrl(publicUrl.publicUrl);
    } catch (error) {
      console.error("Error uploading avatar:", error);
      Alert.alert("Error", "Failed to upload profile picture");
    } finally {
      setUploadingAvatar(false);
    }
  }, [profile?.id]);

  // 5. Profile Update Handler
  const handleSaveProfile = useCallback(
    async (data: ProfileEditFormData) => {
      setSavingProfile(true);

      try {
        // Note: Email is now locked and cannot be changed for security purposes

        // 5.1 Combine first and last name into full name for database
        const full_name =
          `${data.first_name.trim()} ${data.last_name.trim()}`.trim();

        // 5.2 Update profile with both individual fields AND computed full_name
        await updateProfile({
          first_name: data.first_name.trim(),
          last_name: data.last_name.trim(),
          full_name,
          date_of_birth: data.date_of_birth
            ? convertDDMMYYYYToYYYYMMDD(data.date_of_birth)
            : data.date_of_birth,
          avatar_url: avatarUrl,
        });

        Alert.alert("Success", "Your profile has been updated successfully", [
          { text: "OK", onPress: () => router.back() },
        ]);
      } catch (error: any) {
        console.error("Error updating profile:", error);
        Alert.alert("Error", error.message || "Failed to update profile");
      } finally {
        setSavingProfile(false);
      }
    },
    [avatarUrl, updateProfile, router],
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <BackHeader title="Edit Profile" />

        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View className="flex-1">
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
              {/* Avatar Section */}
              <View className="items-center py-6">
                <Pressable
                  onPress={handleAvatarUpload}
                  disabled={uploadingAvatar}
                >
                  <View className="relative">
                    <Image
                      source={
                        avatarUrl
                          ? { uri: avatarUrl }
                          : require("@/assets/default-avatar.jpeg")
                      }
                      className="w-32 h-32 rounded-full"
                      contentFit="cover"
                      optimizationPreset="thumbnail"
                    />
                    {uploadingAvatar && (
                      <View className="absolute inset-0 bg-black/50 rounded-full items-center justify-center">
                        <ActivityIndicator size="small" color="white" />
                      </View>
                    )}
                    <View className="absolute bottom-0 right-0 bg-primary rounded-full p-3">
                      <Camera size={20} color="white" />
                    </View>
                  </View>
                </Pressable>
                <Pressable onPress={handleAvatarUpload} className="mt-3">
                  <Text className="text-primary font-medium">Change Photo</Text>
                </Pressable>
              </View>

              {/* Form Fields */}
              <View className="px-4 pb-6">
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
                          {...field}
                        />
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <View>
                          <FormInput
                            label="Email Address"
                            placeholder="Email cannot be changed"
                            description="Your email address is locked and cannot be modified for security purposes"
                            autoCapitalize="none"
                            autoComplete="email"
                            keyboardType="email-address"
                            editable={false}
                            style={{ opacity: 0.6 }}
                            {...field}
                          />
                        </View>
                      )}
                    />

                    {/* Phone Number - Read Only with International Display */}
                    {profile?.phone_number ? (
                      <View className="gap-2">
                        <View className="relative">
                          <InternationalPhoneInput
                            value={phoneNumber}
                            onChangePhoneNumber={() => {}}
                            selectedCountry={selectedCountry}
                            onChangeSelectedCountry={() => {}}
                            label="Phone Number"
                            description="Phone number cannot be changed once set for security purposes"
                            defaultCountry="LB"
                            disabled={true}
                          />
                          <View
                            className="absolute bottom-0 left-0 right-0 top-6 bg-transparent"
                            pointerEvents="box-only"
                          />
                        </View>
                        {!profile.phone_verified && (
                          <Button
                            variant="outline"
                            size="lg"
                            onPress={openVerifyPhoneModal}
                          >
                            <Shield size={18} color="#792339" />
                            <Text className="ml-2">Verify phone number</Text>
                          </Button>
                        )}
                      </View>
                    ) : (
                      <View className="gap-2">
                        <Text className="text-sm font-medium text-foreground">
                          Phone Number
                        </Text>
                        <View className="bg-muted/50 p-4 rounded-lg border border-border">
                          <View className="flex-row items-center gap-2">
                            <Phone size={16} color="#666" />
                            <Text className="text-sm text-muted-foreground">
                              No phone number set
                            </Text>
                          </View>
                        </View>
                        <Text className="text-xs text-muted-foreground">
                          Phone number can be added during sign up or profile
                          completion
                        </Text>
                      </View>
                    )}

                    <FormField
                      control={form.control}
                      name="date_of_birth"
                      render={({ field }) => (
                        <View>
                          <FormInput
                            label="Date of Birth"
                            placeholder="DD-MM-YYYY"
                            description="Must be at least 13 years old"
                            keyboardType="numeric"
                            {...field}
                            value={field.value ?? ""}
                            onChangeText={(value) => {
                              const formattedValue = formatDDMMYYYYInput(value);
                              field.onChange(formattedValue);
                            }}
                          />
                        </View>
                      )}
                    />
                  </View>
                </Form>
              </View>

              {/* Account Info */}
              <View className="bg-muted/30 p-4 rounded-lg mb-4">
                <View className="flex-row items-center gap-2 mb-2">
                  <AlertCircle size={16} color="#666" />
                  <Text className="font-medium">Account Information</Text>
                </View>
                <Text className="text-sm text-muted-foreground">
                  Member since{" "}
                  {profile?.created_at
                    ? formatDateToDDMMYYYY(new Date(profile.created_at))
                    : "N/A"}
                </Text>
              </View>
            </ScrollView>

            {/* Save Button */}
            <View className="p-4 flex border-t border-border">
              <Button
                onPress={form.handleSubmit(handleSaveProfile)}
                disabled={savingProfile || !form.formState.isDirty}
              >
                {savingProfile ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <View className="flex-row items-center justify-center gap-2">
                    <Save size={20} color="white" />
                    <Text>Save Changes</Text>
                  </View>
                )}
              </Button>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
