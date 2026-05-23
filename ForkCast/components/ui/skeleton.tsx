import React from "react";
import { View } from "react-native";
import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: {
  className?: string;
  [key: string]: any;
}) {
  return (
    <View
      className={cn("rounded-md bg-gray-200 dark:bg-gray-800", className)}
      {...props}
    />
  );
}

export { Skeleton };
