import React, { useState } from "react";
import { View, Pressable, Alert } from "react-native";
import {
  MessageCircle,
  MoreVertical,
  Edit2,
  Trash2,
} from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Muted } from "@/components/ui/typography";
import { Image } from "@/components/image";
import { Database } from "@/types/supabase";
import { useAuth } from "@/context/supabase-provider";
import { formatDateLong } from "@/utils/birthday";

// Enhanced review reply type
type ReviewReply = Database["public"]["Tables"]["review_replies"]["Row"] & {
  replied_by_profile: {
    full_name: string;
    avatar_url?: string | null;
  };
  restaurant: {
    name: string;
    main_image_url?: string | null;
  };
};

interface ReviewReplyProps {
  reply: ReviewReply;
  onEdit?: (replyId: string, currentMessage: string) => void;
  onDelete?: (replyId: string) => void;
  isOwner?: boolean;
  variant?: "default" | "compact";
}

export const ReviewReply = ({
  reply,
  onEdit,
  onDelete,
  isOwner = false,
  variant = "default",
}: ReviewReplyProps) => {
  const { session } = useAuth();
  const [showActions, setShowActions] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const timeStr = date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${formatDateLong(date)} ${timeStr}`;
  };

  const handleEdit = () => {
    if (onEdit) {
      onEdit(reply.id, reply.reply_message);
    }
    setShowActions(false);
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Reply",
      "Are you sure you want to delete this reply? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            if (onDelete) {
              onDelete(reply.id);
            }
            setShowActions(false);
          },
        },
      ],
    );
  };

  const canModify = session?.user?.id === reply.replied_by;

  return (
    <View className="bg-muted/10 border-l-2 border-primary/30 rounded-lg p-3 ml-4 mt-2">
      {/* Header */}
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-row items-center flex-1">
          <MessageCircle size={14} color="#3b82f6" className="mr-2" />
          <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center mr-2">
            {reply.restaurant.main_image_url ? (
              <Image
                {...({
                  source: { uri: reply.restaurant.main_image_url },
                  optimizationPreset: "thumbnail",
                  className: "w-8 h-8 rounded-full",
                  contentFit: "cover",
                } as any)}
              />
            ) : (
              <Text className="text-primary font-semibold text-xs">
                {reply.restaurant.name?.charAt(0)?.toUpperCase()}
              </Text>
            )}
          </View>

          <View className="flex-1">
            <Text className="font-semibold text-xs text-primary">
              {reply.restaurant.name}
            </Text>
            <Muted className="text-xs">
              {formatDate(reply.created_at || "")}
              {reply.updated_at !== reply.created_at && (
                <Text className="text-muted-foreground"> • edited</Text>
              )}
            </Muted>
          </View>
        </View>

        {canModify && (onEdit || onDelete) && (
          <Pressable
            onPress={() => setShowActions(!showActions)}
            className="p-1"
          >
            <MoreVertical size={14} color="#666" />
          </Pressable>
        )}
      </View>

      {/* Reply Content */}
      <Text className="text-sm leading-5 ml-6">{reply.reply_message}</Text>

      {/* Actions Menu */}
      {showActions && canModify && (
        <View className="absolute right-2 top-8 bg-card border border-border rounded-lg shadow-lg z-10">
          {onEdit && (
            <Pressable
              onPress={handleEdit}
              className="flex-row items-center px-3 py-2 active:bg-muted/50"
            >
              <Edit2 size={14} color="#666" className="mr-2" />
              <Text className="text-sm">Edit</Text>
            </Pressable>
          )}
          {onDelete && (
            <Pressable
              onPress={handleDelete}
              className="flex-row items-center px-3 py-2 active:bg-muted/50"
            >
              <Trash2 size={14} color="#ef4444" className="mr-2" />
              <Text className="text-sm text-red-500">Delete</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
};

interface ReviewRepliesListProps {
  replies: ReviewReply[];
  onEditReply?: (replyId: string, currentMessage: string) => void;
  onDeleteReply?: (replyId: string) => void;
  loading?: boolean;
  variant?: "default" | "compact";
}

export const ReviewRepliesList = ({
  replies,
  onEditReply,
  onDeleteReply,
  loading = false,
  variant = "default",
}: ReviewRepliesListProps) => {
  if (loading) {
    return (
      <View className="ml-4 mt-2">
        <Text className="text-sm text-muted-foreground">
          Loading replies...
        </Text>
      </View>
    );
  }

  if (!replies || replies.length === 0) {
    return null;
  }

  return (
    <View className="mt-2">
      {replies.map((reply) => (
        <ReviewReply
          key={reply.id}
          reply={reply}
          onEdit={onEditReply}
          onDelete={onDeleteReply}
          isOwner={true} // For now, assume all replies are from restaurant owners
          variant={variant}
        />
      ))}
    </View>
  );
};
