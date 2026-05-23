import React from "react";
import { View } from "react-native";
import { H2, Muted } from "@/components/ui/typography";

interface PageHeaderProps {
  /** Main title of the page */
  title: string;
  /** Optional subtitle text */
  subtitle?: string;
  /** Optional action component(s) to render on the right side */
  actions?: React.ReactNode;
  /** Additional class names for custom styling */
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  className = "",
}: PageHeaderProps) {
  const hasActions = !!actions;

  return (
    <View className={`px-4 pt-4 pb-3 ${className}`}>
      {hasActions ? (
        // Layout for headers with actions (Social, Favorites)
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-1">
            <H2 className="text-2xl font-bold tracking-tight">{title}</H2>
            {subtitle && <Muted className="text-sm mt-0.5">{subtitle}</Muted>}
          </View>
          <View className="ml-4">{actions}</View>
        </View>
      ) : (
        // Simple layout for headers without actions (Bookings)
        <>
          <H2 className="text-2xl font-bold tracking-tight">{title}</H2>
          {subtitle && <Muted className="text-sm mt-1">{subtitle}</Muted>}
        </>
      )}
    </View>
  );
}
