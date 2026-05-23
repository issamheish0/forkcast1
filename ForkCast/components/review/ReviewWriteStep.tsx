import React from "react";
import { ScrollView, View, KeyboardAvoidingView, Platform } from "react-native";
import { UseFormReturn } from "react-hook-form";

import { Text } from "@/components/ui/text";
import { Form, FormField, FormTextarea } from "@/components/ui/form";
import { ReviewPhotoUploader } from "./ReviewPhotoUploader";

interface ReviewWriteStepProps {
  form: UseFormReturn<any>;
  comment?: string; // Optional
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  userId?: string;
  bookingId?: string;
}

export const ReviewWriteStep: React.FC<ReviewWriteStepProps> = ({
  form,
  comment,
  photos,
  onPhotosChange,
  userId,
  bookingId,
}) => {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
    >
      <ScrollView showsVerticalScrollIndicator={false} className="py-4">
        <Form {...form}>
          <FormField
            control={form.control}
            name="comment"
            render={({ field }) => (
              <FormTextarea
                label="Write Your Review"
                placeholder="Share details about your experience - what you ordered, what you loved, service quality, atmosphere..."
                numberOfLines={6}
                maxLength={1000}
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
        </Form>

        {/* Character Count */}
        <View className="flex-row justify-between items-center mt-2">
          <Text className="text-xs text-muted-foreground">
            {comment?.length || 0}/1000 characters
          </Text>
          <Text className="text-xs text-muted-foreground">
            Optional - Share more details if you&apos;d like
          </Text>
        </View>

        {/* Photo Upload Section */}
        <View className="mt-6">
          <ReviewPhotoUploader
            photos={photos}
            onPhotosChange={onPhotosChange}
            userId={userId}
            bookingId={bookingId}
          />
        </View>

        {/* Review Tips */}
        <View className="bg-primary/10 p-4 rounded-lg mt-6">
          <Text className="font-medium mb-2">💡 Tips for helpful reviews:</Text>
          <View className="gap-1">
            <Text className="text-sm">• Mention specific dishes you tried</Text>
            <Text className="text-sm">
              • Describe the atmosphere and service
            </Text>
            <Text className="text-sm">
              • Share what made it special or needs improvement
            </Text>
            <Text className="text-sm">• Be honest and constructive</Text>
            <Text className="text-sm">
              • Include photos of your food and the venue
            </Text>
          </View>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
};
