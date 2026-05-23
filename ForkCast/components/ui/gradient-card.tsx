import React from "react";
import { View, ViewProps } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useColorScheme } from "@/lib/useColorScheme";
import { getThemedColors, cn } from "@/lib/utils";

interface GradientCardProps extends ViewProps {
  children: React.ReactNode;
  variant?: "default" | "subtle" | "elevated";
  className?: string;
}

export function GradientCard({
  children,
  variant = "default",
  className,
  ...props
}: GradientCardProps) {
  const { colorScheme } = useColorScheme();
  const themedColors = getThemedColors(colorScheme);

  // Convert HSL to hex for LinearGradient
  const hslToHex = (hsl: string): string => {
    // Extract HSL values from string like "hsl(25, 60%, 98%)"
    const match = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (!match) return "#ffffff";

    const h = parseInt(match[1]) / 360;
    const s = parseInt(match[2]) / 100;
    const l = parseInt(match[3]) / 100;

    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    let r, g, b;
    if (s === 0) {
      r = g = b = l; // achromatic
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    const toHex = (c: number) => {
      const hex = Math.round(c * 255).toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  const gradientFromHex = hslToHex(themedColors.cardGradientFrom);
  const gradientToHex = hslToHex(themedColors.cardGradientTo);

  const getGradientProps = () => {
    const defaultFrom = gradientFromHex || "#000000";
    const defaultTo = gradientToHex || "#333333";

    switch (variant) {
      case "subtle":
        return {
          colors: [defaultFrom, defaultTo] as const,
          start: { x: 0, y: 0 },
          end: { x: 1, y: 1 },
          locations: [0, 1] as const,
        };
      case "elevated":
        return {
          colors: [defaultFrom, defaultTo, defaultFrom] as const,
          start: { x: 0, y: 0 },
          end: { x: 1, y: 1 },
          locations: [0, 0.5, 1] as const,
        };
      default:
        return {
          colors: [defaultFrom, defaultTo] as const,
          start: { x: 0, y: 0 },
          end: { x: 0, y: 1 },
          locations: [0, 1] as const,
        };
    }
  };

  return (
    <View
      className={cn(
        "rounded-lg overflow-hidden border border-border",
        className,
      )}
      {...props}
    >
      <LinearGradient {...getGradientProps()} style={{ flex: 1 }}>
        <View className="flex-1 p-4">{children}</View>
      </LinearGradient>
    </View>
  );
}

// Alternative simpler gradient card using CSS-like approach
export function SimpleGradientCard({
  children,
  className,
  ...props
}: GradientCardProps) {
  const { colorScheme } = useColorScheme();
  const themedColors = getThemedColors(colorScheme);

  const gradientFromHex = themedColors.cardGradientFrom
    .replace("hsl(", "")
    .replace(")", "")
    .split(",")
    .map((v) => v.trim());
  const gradientToHex = themedColors.cardGradientTo
    .replace("hsl(", "")
    .replace(")", "")
    .split(",")
    .map((v) => v.trim());

  return (
    <View
      className={cn(
        "rounded-lg border border-border overflow-hidden",
        className,
      )}
      style={{
        backgroundColor: themedColors.card,
        // Add a subtle shadow effect for depth
        shadowColor: colorScheme === "dark" ? "#000" : "#792339",
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: colorScheme === "dark" ? 0.3 : 0.1,
        shadowRadius: 4,
        elevation: 3,
      }}
      {...props}
    >
      <LinearGradient
        colors={[
          themedColors.cardGradientFrom.replace(/hsl\(([^)]+)\)/, (_, hsl) => {
            const [h, s, l] = hsl.split(",").map((v: string) => v.trim());
            return `hsla(${h}, ${s}, ${l}, 0.8)`;
          }),
          themedColors.cardGradientTo.replace(/hsl\(([^)]+)\)/, (_, hsl) => {
            const [h, s, l] = hsl.split(",").map((v: string) => v.trim());
            return `hsla(${h}, ${s}, ${l}, 0.9)`;
          }),
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1 }}
      >
        <View className="flex-1">{children}</View>
      </LinearGradient>
    </View>
  );
}
