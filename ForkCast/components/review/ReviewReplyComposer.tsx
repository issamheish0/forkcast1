import React, { useState } from "react";
import { View, Pressable, TextInput, Keyboard } from "react-native";
import { Send, X } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { useColorScheme } from "@/lib/useColorScheme";
import { InputValidator } from "@/lib/security";

interface ReviewReplyComposerProps {
  onSubmit: (message: string) => Promise<boolean>;
  onCancel?: () => void;
  placeholder?: string;
  maxLength?: number;
  isSubmitting?: boolean;
  isVisible?: boolean;
}

export const ReviewReplyComposer = ({
  onSubmit,
  onCancel,
  placeholder = "Write your reply...",
  maxLength = 500,
  isSubmitting = false,
  isVisible = true,
}: ReviewReplyComposerProps) => {
  const { colorScheme } = useColorScheme();
  const [message, setMessage] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim() || isSubmitting) return;

    // Validate content for profanity and spam
    const validation = InputValidator.validateContent(message.trim(), {
      maxLength: maxLength,
      minLength: 1,
      checkProfanity: true,
      fieldName: "reply",
    });

    if (!validation.isValid) {
      // Show error alert for invalid content
      alert(validation.errors.join("\n"));
      return;
    }

    const success = await onSubmit(message.trim());
    if (success) {
      setMessage("");
      Keyboard.dismiss();
      if (onCancel) onCancel();
    }
  };

  const handleCancel = () => {
    setMessage("");
    Keyboard.dismiss();
    if (onCancel) onCancel();
  };

  if (!isVisible) return null;

  return (
    <View className="bg-card border border-border rounded-lg p-3 mt-3">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-2">
        <Text className="font-medium text-sm">Reply to this review</Text>
        {onCancel && (
          <Pressable onPress={handleCancel} className="p-1">
            <X size={16} color="#666" />
          </Pressable>
        )}
      </View>

      {/* Text Input */}
      <View
        className={`border rounded-lg p-3 ${
          isFocused
            ? "border-primary bg-background"
            : "border-border bg-muted/20"
        }`}
      >
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder={placeholder}
          placeholderTextColor={colorScheme === "dark" ? "#666" : "#999"}
          multiline
          numberOfLines={3}
          maxLength={maxLength}
          style={{
            color: colorScheme === "dark" ? "#fff" : "#000",
            fontSize: 14,
            lineHeight: 20,
            minHeight: 60,
            textAlignVertical: "top",
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          editable={!isSubmitting}
        />
      </View>

      {/* Character Count */}
      <View className="flex-row justify-between items-center mt-2">
        <Text className="text-xs text-muted-foreground">
          {message.length}/{maxLength} characters
        </Text>

        {/* Submit Button */}
        <Button
          onPress={handleSubmit}
          disabled={!message.trim() || isSubmitting}
          size="sm"
          className="flex-row items-center"
        >
          {isSubmitting ? (
            <Text className="text-white text-xs">Posting...</Text>
          ) : (
            <>
              <Send size={14} color="#fff" className="mr-1" />
              <Text className="text-white text-xs">Post Reply</Text>
            </>
          )}
        </Button>
      </View>

      {/* Guidelines */}
      <View className="mt-2 p-2 bg-muted/10 rounded">
        <Text className="text-xs text-muted-foreground">
          💡 <Text className="font-medium">Tip:</Text> A thoughtful reply can
          turn a negative experience into a positive one. Thank customers for
          their feedback and address their concerns professionally.
        </Text>
      </View>
    </View>
  );
};

interface ReviewReplyEditProps {
  currentMessage: string;
  onSave: (message: string) => Promise<boolean>;
  onCancel: () => void;
  maxLength?: number;
  isSubmitting?: boolean;
}

export const ReviewReplyEdit = ({
  currentMessage,
  onSave,
  onCancel,
  maxLength = 500,
  isSubmitting = false,
}: ReviewReplyEditProps) => {
  const { colorScheme } = useColorScheme();
  const [message, setMessage] = useState(currentMessage);
  const [isFocused, setIsFocused] = useState(false);

  const handleSave = async () => {
    if (!message.trim() || isSubmitting || message === currentMessage) return;

    // Validate content for profanity and spam
    const validation = InputValidator.validateContent(message.trim(), {
      maxLength: maxLength,
      minLength: 1,
      checkProfanity: true,
      fieldName: "reply",
    });

    if (!validation.isValid) {
      // Show error alert for invalid content
      alert(validation.errors.join("\n"));
      return;
    }

    const success = await onSave(message.trim());
    if (success) {
      onCancel(); // Close the edit mode
    }
  };

  const hasChanges = message.trim() !== currentMessage;

  return (
    <View className="bg-muted/20 border border-border rounded-lg p-3 mt-2">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-2">
        <Text className="font-medium text-sm">Edit reply</Text>
        <Pressable onPress={onCancel} className="p-1">
          <X size={16} color="#666" />
        </Pressable>
      </View>

      {/* Text Input */}
      <View
        className={`border rounded-lg p-3 ${
          isFocused
            ? "border-primary bg-background"
            : "border-border bg-background"
        }`}
      >
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="Edit your reply..."
          placeholderTextColor={colorScheme === "dark" ? "#666" : "#999"}
          multiline
          numberOfLines={3}
          maxLength={maxLength}
          style={{
            color: colorScheme === "dark" ? "#fff" : "#000",
            fontSize: 14,
            lineHeight: 20,
            minHeight: 60,
            textAlignVertical: "top",
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          editable={!isSubmitting}
          autoFocus
        />
      </View>

      {/* Character Count and Actions */}
      <View className="flex-row justify-between items-center mt-2">
        <Text className="text-xs text-muted-foreground">
          {message.length}/{maxLength} characters
        </Text>

        <View className="flex-row gap-2">
          <Button
            onPress={onCancel}
            variant="outline"
            size="sm"
            disabled={isSubmitting}
          >
            <Text className="text-xs">Cancel</Text>
          </Button>

          <Button
            onPress={handleSave}
            disabled={!hasChanges || !message.trim() || isSubmitting}
            size="sm"
          >
            <Text className="text-white text-xs">
              {isSubmitting ? "Saving..." : "Save"}
            </Text>
          </Button>
        </View>
      </View>
    </View>
  );
};
