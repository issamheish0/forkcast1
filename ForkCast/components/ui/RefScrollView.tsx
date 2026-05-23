/** @jsxImportSource react */
import React from "react";
import { ScrollView, ScrollViewProps } from "react-native";

export const RefScrollView = React.forwardRef<ScrollView, ScrollViewProps>(
  (props, ref) => <ScrollView {...props} ref={ref} />
);
