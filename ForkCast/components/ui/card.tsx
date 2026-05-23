import React from "react";
import { View, ViewProps } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useColorScheme } from "@/lib/useColorScheme";
import { getThemedColors } from "@/lib/utils";

interface CardProps extends ViewProps {
  children: React.ReactNode;
  gradient?: boolean;
  variant?: "default" | "subtle" | "elevated";
  noPadding?: boolean;
}

function CardComponent({
  children,
  style,
  gradient = true,
  variant = "default",
  noPadding = false,
  ...props
}: CardProps) {
  const { colorScheme } = useColorScheme();
  const themedColors = getThemedColors(colorScheme);

  // Convert HSL to rgba for better gradient control
  const hslToRgba = (hsl: string, alpha: number = 1): string => {
    const match = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (!match) return `rgba(255, 255, 255, ${alpha})`;

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
      r = g = b = l;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha})`;
  };

  if (!gradient) {
    return (
      <View
        style={[
          {
            borderRadius: 12,
            shadowColor: colorScheme === "dark" ? "#000" : "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: colorScheme === "dark" ? 0.4 : 0.08,
            shadowRadius: 4,
            elevation: 3,
          },
          style,
        ]}
        className={props.className}
        {...props}
      >
        {children}
      </View>
    );
  }

  const gradientColors: readonly [string, string] = [
    hslToRgba(themedColors.cardGradientFrom, 1),
    hslToRgba(themedColors.cardGradientTo, 1),
  ] as const;

  const getGradientProps = () => {
    switch (variant) {
      case "subtle":
        return {
          colors: gradientColors,
          start: { x: 0, y: 0 },
          end: { x: 1, y: 0.3 },
        };
      case "elevated":
        return {
          colors: [
            gradientColors[0],
            gradientColors[1],
            gradientColors[0],
          ] as const,
          start: { x: 0, y: 0 },
          end: { x: 1, y: 1 },
        };
      default:
        return {
          colors: gradientColors,
          start: { x: 0, y: 0 },
          end: { x: 0.3, y: 1 },
        };
    }
  };

  return (
    <View
      style={[
        {
          borderRadius: 12,
          overflow: "hidden",
          shadowColor: colorScheme === "dark" ? "#000" : themedColors.primary,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: colorScheme === "dark" ? 0.3 : 0.06,
          shadowRadius: 6,
          elevation: 4,
        },
        style,
      ]}
      {...props}
    >
      <LinearGradient
        {...getGradientProps()}
        style={{ flex: 1, padding: noPadding ? 0 : 16 }}
      >
        {children}
      </LinearGradient>
    </View>
  );
}

// Memoize to prevent re-renders in lists
export const Card = React.memo(CardComponent);
