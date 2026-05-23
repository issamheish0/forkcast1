// components/restaurant/TabNavigation.tsx
import React from "react";
import { View, Pressable, ScrollView } from "react-native";
import { Text } from "@/components/ui/text";

interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface TabNavigationProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  tabs?: Tab[];
}

export const TabNavigation: React.FC<TabNavigationProps> = ({
  activeTab,
  onTabChange,
  tabs = [
    { id: "overview", label: "Overview" },
    { id: "menu", label: "Menu" },
    { id: "reviews", label: "Reviews" },
  ],
}) => {
  return (
    <View className="bg-background border-b border-border">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        <View className="flex-row">
          {tabs.map((tab) => (
            <Pressable
              key={tab.id}
              onPress={() => onTabChange(tab.id)}
              className={`py-3 px-4 border-b-2 ${
                activeTab === tab.id ? "border-primary" : "border-transparent"
              }`}
            >
              <Text
                className={`font-semibold ${
                  activeTab === tab.id
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <Text className="text-xs"> ({tab.count})</Text>
                )}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};
