import React from "react";
import { cn } from "@/lib/utils";
import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

// Note: Add this Checkbox component to your UI components
const Checkbox = ({ checked, onCheckedChange, className }: any) => {
  return (
    <Pressable
      onPress={() => onCheckedChange(!checked)}
      className={cn(
        "h-5 w-5 rounded border-2 border-primary items-center justify-center",
        checked && "bg-primary",
        className,
      )}
    >
      {checked && <Ionicons name="checkmark" size={14} color="white" />}
    </Pressable>
  );
};

export { Checkbox };
