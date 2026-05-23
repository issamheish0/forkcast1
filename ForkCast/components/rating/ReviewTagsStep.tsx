import React from "react";
import { ScrollView, View, Pressable, Alert } from "react-native";
import * as Haptics from "expo-haptics";

import { Text } from "@/components/ui/text";
import { H3 } from "@/components/ui/typography";

interface ReviewTagsStepProps {
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  positiveTagOptions: string[];
  negativeTagOptions: string[];
  maxTags?: number;
}

export const ReviewTagsStep: React.FC<ReviewTagsStepProps> = ({
  selectedTags,
  onTagsChange,
  positiveTagOptions,
  negativeTagOptions,
  maxTags = 10,
}) => {
  const handleTagPress = (tag: string) => {
    if (selectedTags.includes(tag)) {
      const newTags = selectedTags.filter((t) => t !== tag);
      onTagsChange(newTags);
    } else {
      if (selectedTags.length >= maxTags) {
        Alert.alert("Tag Limit", `You can select up to ${maxTags} tags`);
        return;
      }
      const newTags = [...selectedTags, tag];
      onTagsChange(newTags);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const TagButton: React.FC<{ tag: string; isPositive: boolean }> = ({
    tag,
    isPositive,
  }) => {
    const isSelected = selectedTags.includes(tag);
    const colorClasses = isPositive
      ? isSelected
        ? "bg-green-100 dark:bg-green-900/20 border-green-500"
        : "bg-background border-border"
      : isSelected
        ? "bg-red-100 dark:bg-red-900/20 border-red-500"
        : "bg-background border-border";

    const textClasses = isPositive
      ? isSelected
        ? "text-green-800 dark:text-green-200 font-medium"
        : ""
      : isSelected
        ? "text-red-800 dark:text-red-200 font-medium"
        : "";

    return (
      <Pressable
        onPress={() => handleTagPress(tag)}
        className={`px-4 py-2 rounded-full border ${colorClasses}`}
      >
        <Text className={`text-sm ${textClasses}`}>{tag}</Text>
      </Pressable>
    );
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} className="py-4">
      <View>
        <H3 className="mb-4">What was great?</H3>
        <View className="flex-row flex-wrap gap-2 mb-6">
          {positiveTagOptions.map((tag) => (
            <TagButton key={tag} tag={tag} isPositive={true} />
          ))}
        </View>

        <H3 className="mb-4">Any issues?</H3>
        <View className="flex-row flex-wrap gap-2">
          {negativeTagOptions.map((tag) => (
            <TagButton key={tag} tag={tag} isPositive={false} />
          ))}
        </View>

        <View className="mt-6 p-3 bg-primary/10 rounded-lg">
          <Text className="text-sm text-primary font-medium">
            Selected tags: {selectedTags.length}/{maxTags}
          </Text>
          {selectedTags.length === 0 && (
            <Text className="text-xs text-muted-foreground mt-1">
              Tags are optional - skip this step if you prefer
            </Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
};
