import React, { useState } from "react";
import { View, Pressable, ActivityIndicator, Alert } from "react-native";
import { Camera, X } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";

import { Platform } from "react-native";
import { Text } from "@/components/ui/text";
import { Muted } from "@/components/ui/typography";
import { Image } from "@/components/image";
import { supabase } from "@/config/supabase";
import {
  validateImageStrict,
  buildSecureStoragePath,
  MAX_IMAGE_SIZE,
} from "@/utils/imageUpload";

interface ReviewPhotoUploaderProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  maxPhotos?: number;
  userId?: string;
  bookingId?: string;
}

export const ReviewPhotoUploader: React.FC<ReviewPhotoUploaderProps> = ({
  photos,
  onPhotosChange,
  maxPhotos = 5,
  userId,
  bookingId,
}) => {
  const [uploading, setUploading] = useState(false);

  const handlePhotoUpload = async () => {
    if (photos.length >= maxPhotos) {
      Alert.alert(
        "Limit Reached",
        `You can only upload up to ${maxPhotos} photos`,
      );
      return;
    }

    try {
      // Android 13+ uses the system Photo Picker — no READ_MEDIA_IMAGES needed.
      if (Platform.OS !== "android" || Platform.Version < 33) {
        const permissionResult =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permissionResult.granted) {
          Alert.alert(
            "Permission Required",
            "Please allow access to your photo library to upload photos.",
          );
          return;
        }
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        base64: false,
        exif: false,
        allowsEditing: false,
        selectionLimit: maxPhotos - photos.length,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      setUploading(true);

      // Upload each photo
      const uploadPromises = result.assets.map(async (asset) => {
        const validation = await validateImageStrict(asset, MAX_IMAGE_SIZE);
        if (!validation.valid || !validation.mime) {
          throw new Error(
            validation.error ??
              "Invalid image. Please choose JPEG, PNG, or WebP.",
          );
        }

        const fileName = buildSecureStoragePath(
          `reviews/${userId}/${bookingId}`,
          validation.mime,
        );

        try {
          // Convert image URI to blob for upload
          const response = await fetch(asset.uri);
          const blob = await response.blob();

          const { error, data } = await supabase.storage
            .from("review-photos")
            .upload(fileName, blob, {
              contentType: validation.mime,
              upsert: false,
            });

          if (error) {
            console.error("Upload error:", error);
            throw new Error(`Failed to upload photo: ${error.message}`);
          }

          // Get public URL
          const { data: urlData } = supabase.storage
            .from("review-photos")
            .getPublicUrl(fileName);

          if (!urlData?.publicUrl) {
            throw new Error("Failed to get photo URL");
          }

          return urlData.publicUrl;
        } catch (uploadError) {
          console.error("Individual upload failed:", uploadError);
          throw uploadError;
        }
      });

      // Process uploads with error handling
      const results = await Promise.allSettled(uploadPromises);
      const successfulUploads: string[] = [];
      const failedUploads: string[] = [];

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          successfulUploads.push(result.value);
        } else {
          failedUploads.push(`Photo ${index + 1}`);
          console.error("Upload failed:", result.reason);
        }
      });

      if (successfulUploads.length > 0) {
        onPhotosChange([...photos, ...successfulUploads]);
      }

      if (failedUploads.length > 0) {
        Alert.alert(
          "Upload Issues",
          `${failedUploads.length} photo(s) failed to upload. Please try again.\n\nFailed: ${failedUploads.join(", ")}`,
          [{ text: "OK" }],
        );
      }
    } catch (error) {
      console.error("Photo upload error:", error);
      Alert.alert(
        "Upload Failed",
        "Failed to upload photos. Please check your connection and try again.",
        [{ text: "OK" }],
      );
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (index: number) => {
    const newPhotos = photos.filter((_, i) => i !== index);
    onPhotosChange(newPhotos);
  };

  return (
    <View>
      <View className="flex-row items-center justify-between mb-3">
        <Text className="font-medium">Add Photos</Text>
        <Text className="text-sm text-muted-foreground">
          {photos.length}/{maxPhotos}
        </Text>
      </View>

      <View className="flex-row flex-wrap gap-3">
        {photos.map((photo, index) => (
          <View key={index} className="relative">
            <Image
              {...({
                source: { uri: photo },
                optimizationPreset: "thumbnail",
                className: "w-20 h-20 rounded-lg",
                contentFit: "cover",
              } as any)}
            />
            <Pressable
              onPress={() => removePhoto(index)}
              className="absolute -top-2 -right-2 bg-destructive rounded-full p-1"
              hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
            >
              <X size={14} color="#fff" />
            </Pressable>
          </View>
        ))}

        {photos.length < maxPhotos && (
          <Pressable
            onPress={handlePhotoUpload}
            disabled={uploading}
            className="w-20 h-20 bg-muted rounded-lg items-center justify-center border-2 border-dashed border-border"
          >
            {uploading ? (
              <ActivityIndicator size="small" />
            ) : (
              <>
                <Camera size={24} color="#666" />
                <Text className="text-xs mt-1 text-center">Add Photo</Text>
              </>
            )}
          </Pressable>
        )}
      </View>

      <Muted className="text-xs mt-2">
        Photos help others see what to expect • {photos.length}/{maxPhotos}{" "}
        photos
      </Muted>
    </View>
  );
};
