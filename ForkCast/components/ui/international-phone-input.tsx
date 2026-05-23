import React from "react";
import { View } from "react-native";
import PhoneInput, {
  ICountry,
  isValidPhoneNumber,
} from "react-native-international-phone-number";
import { ICountryCca2 } from "react-native-country-select";
import { Text } from "@/components/ui/text";
import { useColorScheme } from "@/lib/useColorScheme";

interface InternationalPhoneInputProps {
  value: string;
  onChangePhoneNumber: (phoneNumber: string) => void;
  selectedCountry: ICountry | null;
  onChangeSelectedCountry: (country: ICountry) => void;
  error?: string;
  label?: string;
  description?: string;
  defaultCountry?: ICountryCca2;
  disabled?: boolean;
}

export function InternationalPhoneInput({
  value,
  onChangePhoneNumber,
  selectedCountry,
  onChangeSelectedCountry,
  error,
  label = "Phone Number",
  description,
  defaultCountry = "LB", // Lebanon as default
  disabled = false,
}: InternationalPhoneInputProps): React.ReactElement {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  // List of countries to hide (Israel)
  const hiddenCountries: ICountryCca2[] = ["IL"];

  // Popular countries to show at the top (Lebanon, UAE, Saudi Arabia, USA, UK, France)
  const popularCountries: ICountryCca2[] = ["LB", "AE", "SA", "US", "GB", "FR"];

  return (
    <View>
      {label && (
        <Text className="text-sm font-medium mb-2 text-foreground">
          {label}
        </Text>
      )}
      <PhoneInput
        value={value}
        onChangePhoneNumber={onChangePhoneNumber}
        selectedCountry={selectedCountry}
        onChangeSelectedCountry={onChangeSelectedCountry}
        placeholder="Phone number"
        defaultCountry={defaultCountry}
        hiddenCountries={hiddenCountries}
        popularCountries={popularCountries}
        language="eng"
        theme={isDark ? "dark" : "light"}
        phoneInputStyles={{
          container: {
            backgroundColor: isDark ? "#1f2937" : "#f3f4f6",
            borderWidth: 2,
            borderColor: error ? "#ef4444" : isDark ? "#374151" : "#e5e7eb",
            borderRadius: 8,
            paddingHorizontal: 12,
            height: 56,
            opacity: disabled ? 0.6 : 1,
          },
          flagContainer: {
            paddingRight: 8,
            backgroundColor: "transparent",
          },
          flag: {
            fontSize: 24,
          },
          caret: {
            color: disabled ? "transparent" : isDark ? "#D1D5DB" : "#6B7280",
            fontSize: 16,
          },
          divider: {
            backgroundColor: isDark ? "#4B5563" : "#D1D5DB",
            width: 1,
            marginHorizontal: 8,
          },
          callingCode: {
            color: isDark ? "#E5E7EB" : "#374151",
            fontSize: 16,
            fontWeight: "500",
          },
          input: {
            color: isDark ? "#F9FAFB" : "#111827",
            fontSize: 16,
            flex: 1,
          },
        }}
        modalStyles={{
          backdrop: {
            backgroundColor: "rgba(0, 0, 0, 0.6)",
          },
          container: {
            backgroundColor: isDark ? "#1f2937" : "#ffffff",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            shadowColor: "#000",
            shadowOffset: {
              width: 0,
              height: -2,
            },
            shadowOpacity: 0.25,
            shadowRadius: 10,
            elevation: 5,
          },
          content: {
            paddingVertical: 20,
            backgroundColor: isDark ? "#1f2937" : "#ffffff",
          },
          dragHandleContainer: {
            paddingVertical: 8,
            alignItems: "center" as const,
            backgroundColor: isDark ? "#1f2937" : "#ffffff",
          },
          dragHandleIndicator: {
            width: 40,
            height: 4,
            backgroundColor: isDark ? "#6B7280" : "#D1D5DB",
            borderRadius: 2,
          },
          searchContainer: {
            paddingHorizontal: 16,
            paddingBottom: 16,
            paddingTop: 8,
            backgroundColor: isDark ? "#1f2937" : "#ffffff",
          },
          searchInput: {
            backgroundColor: isDark ? "#374151" : "#f3f4f6",
            borderWidth: 1,
            borderColor: isDark ? "#4B5563" : "#e5e7eb",
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 12,
            fontSize: 16,
            color: isDark ? "#F9FAFB" : "#111827",
          },
          list: {
            paddingHorizontal: 16,
            backgroundColor: isDark ? "#1f2937" : "#ffffff",
          },
          countryItem: {
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: isDark
              ? "rgba(255, 255, 255, 0.1)"
              : "rgba(0, 0, 0, 0.05)",
            backgroundColor: isDark ? "#1f2937" : "#ffffff",
          },
          flag: {
            fontSize: 28,
            marginRight: 12,
          },
          countryInfo: {
            flex: 1,
          },
          callingCode: {
            color: isDark ? "#D1D5DB" : "#4B5563",
            fontSize: 14,
            fontWeight: "600",
          },
          countryName: {
            color: isDark ? "#F9FAFB" : "#111827",
            fontSize: 16,
            marginBottom: 2,
          },
          sectionTitle: {
            color: isDark ? "#D1D5DB" : "#4B5563",
            fontSize: 13,
            fontWeight: "600",
            textTransform: "uppercase" as const,
            letterSpacing: 0.5,
            paddingHorizontal: 16,
            paddingVertical: 8,
            backgroundColor: isDark ? "#111827" : "#f3f4f6",
          },
          closeButton: {
            backgroundColor: "#792339",
            marginHorizontal: 16,
            marginTop: 12,
            marginBottom: 20,
            borderRadius: 12,
            paddingVertical: 14,
            shadowColor: "#792339",
            shadowOffset: {
              width: 0,
              height: 2,
            },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            elevation: 5,
          },
          closeButtonText: {
            color: "#ffffff",
            fontSize: 16,
            fontWeight: "700",
            textAlign: "center" as const,
            letterSpacing: 0.5,
          },
          // Country not found styles
          countryNotFoundContainer: {
            padding: 24,
            alignItems: "center" as const,
            backgroundColor: isDark ? "#1f2937" : "#ffffff",
          },
          countryNotFoundMessage: {
            color: isDark ? "#9CA3AF" : "#6B7280",
            fontSize: 16,
            textAlign: "center" as const,
          },
          // Alphabet filter styles for dark mode
          alphabetContainer: {
            backgroundColor: isDark ? "#374151" : "#f3f4f6",
            borderRadius: 8,
            marginRight: 4,
            paddingVertical: 4,
          },
          alphabetLetter: {
            paddingVertical: 2,
            paddingHorizontal: 6,
          },
          alphabetLetterText: {
            color: isDark ? "#E5E7EB" : "#374151",
            fontSize: 11,
            fontWeight: "600",
          },
          alphabetLetterActive: {
            backgroundColor: isDark ? "#792339" : "#792339",
            borderRadius: 4,
          },
          alphabetLetterDisabled: {
            opacity: 0.3,
          },
          alphabetLetterTextActive: {
            color: "#ffffff",
            fontWeight: "700",
          },
          alphabetLetterTextDisabled: {
            color: isDark ? "#6B7280" : "#9CA3AF",
          },
        }}
        phoneInputPlaceholderTextColor={isDark ? "#6B7280" : "#9CA3AF"}
        modalSearchInputPlaceholder="Search countries..."
        modalSearchInputPlaceholderTextColor={isDark ? "#9CA3AF" : "#6B7280"}
        modalSearchInputSelectionColor={isDark ? "#792339" : "#792339"}
        modalNotFoundCountryMessage="No country found"
        modalPopularCountriesTitle="Popular"
        modalAllCountriesTitle="All Countries"
        showModalScrollIndicator={false}
        showModalAlphabetFilter={true}
        allowFontScaling={true}
      />
      {description && !error && (
        <Text className="text-xs text-muted-foreground mt-1">
          {description}
        </Text>
      )}
      {error && (
        <Text className="text-xs text-red-600 dark:text-red-400 mt-1">
          {error}
        </Text>
      )}
    </View>
  );
}

export { isValidPhoneNumber, type ICountry, type ICountryCca2 };
