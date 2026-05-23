import { Share } from "react-native";
import * as Clipboard from "expo-clipboard";

export type ShareOptions = {
  title?: string;
  message?: string;
  url?: string;
  [key: string]: any;
};

export function useShare() {
  const shareContent = async (content: {
    title?: string;
    message?: string;
    url?: string;
  }) => {
    try {
      await Share.share({
        title: content.title,
        message: content.message || content.url || "",
        url: content.url,
      });
    } catch (error) {
      console.warn("Share error:", error);
    }
  };

  const shareGeneric = async (..._args: any[]): Promise<boolean> => false;
  const copyToClipboard = async (text: string, _message?: string) => {
    try {
      await Clipboard.setStringAsync(text);
    } catch {}
  };
  const shareBooking = async (..._args: any[]): Promise<boolean> => false;
  const shareRestaurantMenu = async (..._args: any[]) => {};
  const getShareableLink = (..._args: any[]): string => "";

  return { shareContent, shareBooking, shareRestaurantMenu, getShareableLink, shareGeneric, copyToClipboard };
}
