import React, { useState, useCallback } from "react";
import { View, Pressable, Linking, Modal, Platform } from "react-native";
import { Menu, FileText, X, ExternalLink } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { H3, Muted } from "@/components/ui/typography";
import { useColorScheme } from "@/lib/useColorScheme";
import { getThemedColors } from "@/lib/utils";
import { Database } from "@/types/supabase";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"] & {
  menu_urls?: string[] | null;
};

interface MenuTabProps {
  restaurant: Restaurant;
}

const getMenuName = (url: string, index: number): string => {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split("/").pop();
    if (filename) {
      const name = decodeURIComponent(filename)
        .replace(/\.[^/.]+$/, "")
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase());
      if (name.length > 0 && name.length < 50) {
        return name;
      }
    }
  } catch {}
  return `Menu ${index + 1}`;
};

export const MenuTab = ({ restaurant }: MenuTabProps) => {
  const { colorScheme } = useColorScheme();
  const themedColors = getThemedColors(colorScheme);
  const isDark = colorScheme === "dark";
  const [showMenuModal, setShowMenuModal] = useState(false);

  const menuUrls: string[] = [];
  if (restaurant.menu_urls && Array.isArray(restaurant.menu_urls)) {
    const urls = restaurant.menu_urls
      .filter((m: any) => m && (typeof m === 'string' ? m : m.url))
      .map((m: any) => typeof m === 'string' ? m : m.url);
    menuUrls.push(...urls);
  }
  const hasMenus = menuUrls.length > 0;
  const hasMultipleMenus = menuUrls.length > 1;

  const handleMenuPress = useCallback(() => {
    if (hasMultipleMenus) {
      setShowMenuModal(true);
    } else if (menuUrls.length === 1) {
      Linking.openURL(menuUrls[0]).catch(() => {});
    }
  }, [hasMultipleMenus, menuUrls]);

  const handleOpenMenu = useCallback((url: string) => {
    setShowMenuModal(false);
    Linking.openURL(url).catch(() => {});
  }, []);

  return (
    <View className="px-4 mb-6">
      <H3 className="mb-3">Menu</H3>
      {hasMenus ? (
        <>
          <Pressable
            onPress={handleMenuPress}
            className="bg-card p-6 rounded-2xl items-center shadow-md border border-border active:opacity-90"
            style={{ elevation: 4 }}
          >
            <View className="w-14 h-14 rounded-full bg-primary/10 items-center justify-center mb-2 shadow-sm">
              <Menu size={36} color={themedColors.primary} />
            </View>
            <Text className="mt-1 font-semibold text-lg text-foreground">
              {hasMultipleMenus ? "View Menus" : "View Full Menu"}
            </Text>
            <Muted className="text-sm mt-1">
              {hasMultipleMenus
                ? `${menuUrls.length} menus available`
                : "Opens in browser"}
            </Muted>
          </Pressable>

          {/* Menu Selection Modal */}
          <Modal
            visible={showMenuModal}
            transparent
            animationType="slide"
            onRequestClose={() => setShowMenuModal(false)}
          >
            <View className="flex-1 justify-end bg-black/40">
              <View
                className={`rounded-t-3xl ${isDark ? "bg-zinc-900" : "bg-white"} max-h-[60%] shadow-2xl border-t border-border mx-0 pb-4" style={{ minHeight: 280, marginHorizontal: 0 }}`}
              >
                {/* Modal Header */}
                <View className="flex-row items-center justify-between px-6 py-5 border-b border-border">
                  <Text className="text-lg font-bold text-foreground">
                    Select a Menu
                  </Text>
                  <Pressable
                    onPress={() => setShowMenuModal(false)}
                    className="p-2 rounded-full active:bg-muted"
                  >
                    <X size={24} color={themedColors.foreground} />
                  </Pressable>
                </View>

                {/* Menu List */}
                <View className="px-4 py-4">
                  {menuUrls.map((url, index) => (
                    <Pressable
                      key={`menu-${index}`}
                      onPress={() => handleOpenMenu(url)}
                      className="flex-row items-center p-4 mb-3 rounded-xl bg-muted border border-border active:bg-primary/10"
                      style={{
                        shadowColor: themedColors.primary,
                        shadowOpacity: 0.08,
                        shadowRadius: 2,
                      }}
                    >
                      <View className="w-11 h-11 rounded-full bg-primary/20 items-center justify-center mr-4">
                        <FileText size={22} color={themedColors.primary} />
                      </View>
                      <View className="flex-1">
                        <Text className="font-semibold text-foreground text-base">
                          {getMenuName(url, index)}
                        </Text>
                        <Text className="text-xs text-muted-foreground mt-0.5">
                          Tap to open PDF
                        </Text>
                      </View>
                      <ExternalLink
                        size={18}
                        color={themedColors.mutedForeground}
                      />
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          </Modal>
        </>
      ) : (
        <View className="bg-muted p-6 rounded-2xl items-center border border-border shadow-sm">
          <Text className="text-4xl mb-3">😞</Text>
          <Text className="text-center font-medium text-foreground">
            Oops, this restaurant did not upload a menu.
          </Text>
        </View>
      )}
    </View>
  );
};
