import React from "react";
import { View, Pressable } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Muted } from "@/components/ui/typography";
import { useColorScheme } from "@/lib/useColorScheme";

interface BookingHeaderProps {
  title: string;
  subtitle: string;
  onBack: () => void;
  className?: string;
}

export const BookingHeader: React.FC<BookingHeaderProps> = ({
  title,
  subtitle,
  onBack,
  className = "",
}) => {
  const { colorScheme } = useColorScheme();
  const iconColor = colorScheme === 'dark' ? '#fff' : '#374151';
  return (
    <View className={`px-4 py-3 border-b border-border ${className}`}>
      <View className="flex-row items-center justify-between">
        <Pressable onPress={onBack} className="p-2 -ml-2">
          <ChevronLeft size={24} color={iconColor} />
        </Pressable>
        <View className="flex-1 mx-4">
          <Text className="text-center font-semibold">{title}</Text>
          <Muted className="text-center text-sm">{subtitle}</Muted>
        </View>
        <View className="w-10" />
      </View>
    </View>
  );
};
