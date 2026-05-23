// Stub: PDF Viewer — not implemented in ForkCastApp
import React from "react";
import { View, Text } from "react-native";

interface PDFViewerProps {
  uri?: string;
  [key: string]: any;
}

export function PDFViewer({ uri }: PDFViewerProps) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>PDF viewer not available.</Text>
    </View>
  );
}
