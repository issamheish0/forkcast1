import React from "react";
import { View } from "react-native";
import { LucideIcon } from "lucide-react-native";
import { H3, Muted } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon: Icon,
  title,
  subtitle,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center py-16 px-8">
      <View className="w-16 h-16 rounded-full bg-secondary/50 dark:bg-secondary/15 items-center justify-center mb-4">
        <Icon size={28} className="text-muted-foreground" strokeWidth={1.5} />
      </View>
      <H3 className="text-center text-lg">{title}</H3>
      {subtitle && (
        <Muted className="mt-1.5 text-center leading-5">{subtitle}</Muted>
      )}
      {actionLabel && onAction && (
        <Button variant="default" onPress={onAction} className="mt-5">
          <Text>{actionLabel}</Text>
        </Button>
      )}
    </View>
  );
}
