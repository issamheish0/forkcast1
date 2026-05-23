import React, { useState, useEffect } from "react";
import { View, Pressable, Alert } from "react-native";
import {
  Gift,
  Utensils,
  MessageSquare,
  Edit3,
  Check,
  X,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useColorScheme } from "@/lib/useColorScheme";
import { colors } from "@/constants/colors";
import { supabase } from "@/config/supabase";

interface EditableBookingFieldsProps {
  bookingId: string;
  currentValues: {
    occasion?: string | null;
    special_requests?: string | null;
    dietary_notes?: string[] | null;
  };
  onUpdate: (updatedFields: {
    occasion?: string | null;
    special_requests?: string | null;
    dietary_notes?: string[] | null;
  }) => void;
  canEdit: boolean;
  showTitle?: boolean;
  withTopBorder?: boolean;
}

/**
 * Formats dietary restriction text for display
 * Converts snake_case to Title Case (e.g., "lactose_free" -> "Lactose Free")
 */
const formatDietaryRestriction = (restriction: string): string => {
  return restriction
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

export const EditableBookingFields: React.FC<EditableBookingFieldsProps> = ({
  bookingId,
  currentValues,
  onUpdate,
  canEdit,
  showTitle = true,
  withTopBorder = false,
}) => {
  const { colorScheme } = useColorScheme();
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editValues, setEditValues] = useState(currentValues);

  useEffect(() => {
    setEditValues(currentValues);
  }, [currentValues]);

  const handleSave = async () => {
    if (!canEdit) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("bookings")
        .update({
          occasion: editValues.occasion || null,
          special_requests: editValues.special_requests || null,
          dietary_notes: editValues.dietary_notes || null,
        })
        .eq("id", bookingId);

      if (error) throw error;

      onUpdate(editValues);
      setIsEditing(false);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Alert.alert("Success", "Booking details updated successfully");
    } catch (error) {
      console.error("Error updating booking fields:", error);
      Alert.alert(
        "Error",
        "Failed to update booking details. Please try again.",
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    setEditValues(currentValues);
    setIsEditing(false);
  };

  const handleDietaryNotesChange = (value: string) => {
    const notes = value
      .split(",")
      .map((note) => note.trim())
      .filter((note) => note.length > 0);
    setEditValues({
      ...editValues,
      dietary_notes: notes.length > 0 ? notes : null,
    });
  };

  const hasAnyData =
    currentValues.occasion ||
    currentValues.special_requests ||
    (currentValues.dietary_notes && currentValues.dietary_notes.length > 0);

  const formattedSections = [
    {
      key: "occasion",
      icon: Gift,
      label: "Occasion",
      value: currentValues.occasion?.trim() || null,
    },
    {
      key: "dietary",
      icon: Utensils,
      label: "Dietary Notes",
      value:
        currentValues.dietary_notes && currentValues.dietary_notes.length > 0
          ? currentValues.dietary_notes.map(formatDietaryRestriction).join(", ")
          : null,
    },
    {
      key: "requests",
      icon: MessageSquare,
      label: "Special Requests",
      value: currentValues.special_requests?.trim() || null,
    },
  ].filter((section) => section.value);

  if (!hasAnyData && !canEdit) {
    return null; // Don't show anything if no data and can't edit
  }

  return (
    <View>
      {showTitle ? (
        <View className="flex-row items-center justify-between mb-3">
          <Text className="font-semibold text-foreground">
            Additional Information
          </Text>

          {canEdit && !isEditing && (
            <Pressable
              onPress={() => setIsEditing(true)}
              className="flex-row items-center gap-1 px-3 py-1.5 rounded-full bg-primary/10"
            >
              <Edit3 size={14} color={colors[colorScheme].primary} />
              <Text className="text-xs font-medium text-primary">Edit</Text>
            </Pressable>
          )}
        </View>
      ) : canEdit && !isEditing ? (
        <View className="flex-row justify-end mb-3">
          <Pressable
            onPress={() => setIsEditing(true)}
            className="flex-row items-center gap-1 px-3 py-1.5 rounded-full bg-primary/10"
          >
            <Edit3 size={14} color={colors[colorScheme].primary} />
            <Text className="text-xs font-medium text-primary">Edit</Text>
          </Pressable>
        </View>
      ) : null}

      {isEditing ? (
        <View className="space-y-4 bg-background rounded-lg p-4 border border-border">
          {/* Occasion */}
          <View>
            <Text className="text-sm font-medium mb-2 text-muted-foreground">
              Occasion (optional)
            </Text>
            <Input
              value={editValues.occasion || ""}
              onChangeText={(text) =>
                setEditValues({ ...editValues, occasion: text })
              }
              placeholder="e.g., Birthday, Anniversary, Business meeting"
              className="mb-0"
            />
          </View>

          {/* Dietary Notes */}
          <View>
            <Text className="text-sm font-medium mb-2 text-muted-foreground">
              Dietary Notes (optional)
            </Text>
            <Input
              value={editValues.dietary_notes?.join(", ") || ""}
              onChangeText={handleDietaryNotesChange}
              placeholder="e.g., Vegetarian, Gluten-free, Nut allergy"
              className="mb-0"
            />
            <Text className="text-xs text-muted-foreground mt-1">
              Separate multiple dietary requirements with commas
            </Text>
          </View>

          {/* Special Requests */}
          <View>
            <Text className="text-sm font-medium mb-2 text-muted-foreground">
              Special Requests (optional)
            </Text>
            <Input
              value={editValues.special_requests || ""}
              onChangeText={(text) =>
                setEditValues({ ...editValues, special_requests: text })
              }
              placeholder="Any special requests for your visit"
              multiline
              numberOfLines={3}
              className="mb-0"
            />
          </View>

          {/* Action Buttons */}
          <View className="flex-row gap-2 pt-2">
            <Button
              variant="outline"
              onPress={handleCancel}
              disabled={isUpdating}
              className="flex-1"
            >
              <View className="flex-row items-center gap-2">
                <X size={16} color={colors[colorScheme].mutedForeground} />
                <Text>Cancel</Text>
              </View>
            </Button>

            <Button
              onPress={handleSave}
              disabled={isUpdating}
              className="flex-1"
            >
              <View className="flex-row items-center gap-2">
                <Check size={16} color="white" />
                <Text>{isUpdating ? "Saving..." : "Save"}</Text>
              </View>
            </Button>
          </View>
        </View>
      ) : (
        <View>
          {formattedSections.map((section, index) => {
            const IconComponent = section.icon;

            return (
              <View key={section.key} className={index > 0 ? "mt-4" : ""}>
                <View className="flex-row items-start gap-3">
                  <View className="bg-primary/10 rounded-full p-2">
                    <IconComponent
                      size={18}
                      color={colors[colorScheme].primary}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-muted-foreground mb-1">
                      {section.label.toUpperCase()}
                    </Text>
                    <Text className="text-sm font-medium text-foreground">
                      {section.value}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}

          {/* Show placeholder when no data and can edit */}
          {!hasAnyData && canEdit && (
            <View className="py-4 px-3 mt-3 bg-muted/30 rounded-lg border border-dashed border-muted-foreground/30">
              <Text className="text-center text-muted-foreground text-sm">
                No additional information added yet
              </Text>
              <Text className="text-center text-muted-foreground text-xs mt-1">
                Tap Edit to add occasion, dietary notes, or special requests
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};
