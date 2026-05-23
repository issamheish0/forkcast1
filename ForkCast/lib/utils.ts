import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { colors } from "@/constants/colors";

export function cn(...inputs: ClassValue[]) {
  const filteredInputs = inputs.filter((input) => input != null);
  return twMerge(clsx(filteredInputs));
}

/**
 * Get themed colors based on current color scheme
 * This helps migrate from hard-coded colors to theme-aware colors
 */
export function getThemedColors(
  colorScheme: "light" | "dark" = "light",
): typeof colors.light {
  return colors[colorScheme];
}

/**
 * Get a themed color value for inline styles
 * Usage: getThemedColor('primary', colorScheme)
 */
export function getThemedColor(
  colorName: keyof typeof colors.light,
  colorScheme: "light" | "dark" = "light",
): string {
  return colors[colorScheme][colorName] || colors[colorScheme].foreground;
}

/**
 * Get icon color based on theme
 * Replaces hard-coded "#fff" and "#000" patterns
 */
export function getIconColor(_textColorOrScheme: string, colorScheme?: "light" | "dark" | null): string {
  return colors[colorScheme ?? 'light'].foreground;
}

/**
 * Get activity indicator color based on theme
 */
export function getActivityIndicatorColor(
  colorScheme: "light" | "dark" = "light",
): string {
  return colors[colorScheme].foreground;
}

/**
 * Get refresh control tint color based on theme
 */
export function getRefreshControlColor(
  colorScheme: "light" | "dark" = "light",
): string {
  return colors[colorScheme].foreground;
}
