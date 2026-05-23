import React, { useRef } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Search as SearchIcon } from "lucide-react-native";

import { cn } from "@/lib/utils";
import { useColorScheme } from "@/lib/useColorScheme";

interface HomeSearchBarProps {
  onPress: () => void;
  className?: string;
}

export const HomeSearchBar: React.FC<HomeSearchBarProps> = ({
  onPress,
  className,
}) => {
  const inputRef = useRef<TextInput>(null);
  const { colorScheme } = useColorScheme();
  const placeholderColor = colorScheme === "dark" ? "#aaaaaa" : "#666666";
  const inputTextColor = colorScheme === "dark" ? "#f4f4f5" : "#1f1f1f";
  const iconColor = colorScheme === "dark" ? "#f4f4f5" : "#000000";

  const handlePress = () => {
    inputRef.current?.blur();
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      className={cn(
        "flex-row items-center rounded-full py-2 border border-border active:opacity-75 w-full",
        className,
      )}
    >
      <View className="ml-4 w-9 h-9 rounded-full items-center justify-center shrink-0">
        <SearchIcon size={18} color={iconColor} />
      </View>
      <TextInput
        ref={inputRef}
        placeholder="Search restaurants, cuisines..."
        placeholderTextColor={placeholderColor}
        editable={false}
        pointerEvents="none"
        focusable={false}
        style={{
          marginLeft: 12,
          flex: 1,
          minWidth: 0,
          paddingRight: 16,
          fontSize: 15,
          fontWeight: "500",
          color: inputTextColor,
        }}
      />
    </Pressable>
  );
};
