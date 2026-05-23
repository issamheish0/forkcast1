// app/(protected)/restaurant/menu/[restaurantId].tsx

import React, { useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Pressable,
  RefreshControl,
  TextInput,
  ScrollView,
  FlatList,
  findNodeHandle,
  UIManager,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "@/components/image";
import {
  Search,
  Clock,
  Flame,
  Leaf,
  Wheat,
  ChevronLeft,
  Share2,
} from "lucide-react-native";

import { SafeAreaView } from "@/components/safe-area-view";
import { Text } from "@/components/ui/text";
import { H1, H2, H3, P, Muted } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { useColorScheme } from "@/lib/useColorScheme";
import { useMenu } from "@/hooks/useMenu";
import { MenuItem } from "@/types/menu";
import { MenuScreenSkeleton } from "@/components/skeletons/MenuScreenSkeleton";
import { useShare } from "@/hooks/useShare";
import { ShareModal } from "@/components/ui/share-modal";
import { PDFViewer } from "@/components/pdf/PDFViewer";

const DIETARY_ICONS: Record<string, any> = {
  vegetarian: Leaf,
  vegan: Leaf,
  "gluten-free": Wheat,
  spicy: Flame,
};

export default function MenuScreen() {
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
  const listRef = useRef<FlatList>(null);
  const sectionYPositions = useRef<Record<string, number>>({});
  const categoryChipsRef = useRef<ScrollView>(null);
  const chipPositions = useRef<Record<string, number>>({});
  const isUserScroll = useRef(true);

  const { shareRestaurantMenu, getShareableLink } = useShare();

  const router = useRouter();
  const {
    restaurantId: restaurantIdParam,
    menuUrl: menuUrlParam,
    menuTitle: menuTitleParam,
  } = useLocalSearchParams<{
    restaurantId?: string | string[];
    menuUrl?: string | string[];
    menuTitle?: string | string[];
  }>();
  const restaurantId = Array.isArray(restaurantIdParam)
    ? restaurantIdParam[0]
    : restaurantIdParam || "";
  const directMenuUrl = Array.isArray(menuUrlParam)
    ? menuUrlParam[0]
    : menuUrlParam || "";
  const directMenuTitle = Array.isArray(menuTitleParam)
    ? menuTitleParam[0]
    : menuTitleParam || "";

  // Redirect if no restaurantId
  React.useEffect(() => {
    if (!restaurantId) {
      console.error("[MenuScreen] No restaurantId provided");
      router.replace("/");
    }
  }, [restaurantId, router]);

  const handleBack = useCallback(() => {
    if (router.canGoBack && router.canGoBack()) {
      router.back();
      return;
    }
    if (restaurantId) {
      router.replace({
        pathname: "/restaurant/[id]",
        params: { id: restaurantId },
      });
    } else {
      router.replace("/");
    }
  }, [router, restaurantId]);
  const { colorScheme } = useColorScheme();

  const {
    categories,
    loading,
    error,
    refreshing,
    filters,
    filteredItems,
    setFilters,
    refresh,
    featuredItems,
    restaurant,
  } = useMenu({ restaurantId });

  const handleOpenShare = useCallback(() => {
    setShowShareModal(true);
  }, []);

  const menuShareLink = useMemo(() => {
    if (!restaurantId) {
      return null;
    }

    return getShareableLink(`/restaurant/${restaurantId}/menu`);
  }, [getShareableLink, restaurantId]);

  // Prepare sections for SectionList - always show all categories
  const sections = useMemo(() => {
    if (filters.searchQuery) {
      return [
        {
          title: "Search Results",
          data: filteredItems,
        },
      ];
    }

    return categories
      .filter((cat) => cat.items && cat.items.length > 0)
      .map((cat) => ({
        title: cat.name,
        data: cat.items || [],
        description: cat.description,
      }));
  }, [categories, filteredItems, filters.searchQuery]);

  // Handle category button press - scroll to its section
  const handleCategoryPress = useCallback(
    (categoryId: string) => {
      const categoryName = categories.find((c) => c.id === categoryId)?.name;
      if (!categoryName) return;
      const y = sectionYPositions.current[categoryName];
      if (y == null || !listRef.current) return;

      // Walk the FlatList internals to find the native scroll view
      const flatList = listRef.current as any;
      const vlist = flatList._listRef;
      
      // Try to find ScrollView node by walking fiber tree from VirtualizedList
      let scrollNode: any = null;
      
      // Approach: get the stateNode of the ScrollView from the fiber
      const fiber = vlist?._reactInternals;
      if (fiber) {
        // BFS through fiber children to find a native ScrollView
        let queue = [fiber.child];
        let depth = 0;
        while (queue.length > 0 && depth < 20) {
          const node = queue.shift();
          if (!node) continue;
          depth++;
          
          // Check if this fiber's stateNode has scrollTo
          if (node.stateNode && typeof node.stateNode.scrollTo === 'function') {
            scrollNode = node.stateNode;
            break;
          }
          // Check if it's a native host component (ScrollView)
          if (node.stateNode && node.stateNode._nativeTag) {
            const type = node.type;
            if (typeof type === 'string' && type.toLowerCase().includes('scroll')) {
              scrollNode = node.stateNode;
              break;
            }
          }
          if (node.child) queue.push(node.child);
          if (node.sibling) queue.push(node.sibling);
        }
      }
      
  
      
      if (scrollNode && typeof scrollNode.scrollTo === 'function') {
        scrollNode.scrollTo({ y, animated: true });
      } else {
        // Fallback: try scrollToOffset anyway
        flatList.scrollToOffset({ offset: y, animated: true });
      }
      setSelectedCategoryId(categoryId);

      // Briefly disable scroll-based chip updates during programmatic scroll
      isUserScroll.current = false;
      setTimeout(() => { isUserScroll.current = true; }, 500);
    },
    [categories],
  );

  // Track scroll position and update active chip
  const handleListScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!isUserScroll.current) return;
      const scrollY = e.nativeEvent.contentOffset.y;
      const offset = 80; // trigger a bit before reaching section top

      let activeSection: string | null = null;
      let closestY = -Infinity;

      for (const [title, y] of Object.entries(sectionYPositions.current)) {
        if (y <= scrollY + offset && y > closestY) {
          closestY = y;
          activeSection = title;
        }
      }

      if (activeSection) {
        const category = categories.find((c) => c.name === activeSection);
        if (category) {
          setSelectedCategoryId(category.id);
          // Auto-scroll the chip bar to show active chip
          const chipX = chipPositions.current[category.id];
          if (chipX != null && categoryChipsRef.current) {
            categoryChipsRef.current.scrollTo({ x: Math.max(0, chipX - 40), animated: true });
          }
        }
      }
    },
    [categories],
  );

  // Check if we have any menu items
  const hasMenuItems = useMemo(() => {
    return categories.some((cat) => cat.items && cat.items.length > 0);
  }, [categories]);

  // Extract first URL from menu_urls array for PDF fallback
  const firstMenuUrl = useMemo(() => {
    if (!restaurant?.menu_urls || !Array.isArray(restaurant.menu_urls)) return null;
    const first = restaurant.menu_urls.find((m: any) => m && m.url);
    return first?.url || null;
  }, [restaurant?.menu_urls]);

  // Check if we should show PDF viewer - prioritize direct menu URL from params
  const shouldShowPDF = useMemo(() => {
    if (directMenuUrl) return true;
    return !loading && !hasMenuItems && firstMenuUrl;
  }, [loading, hasMenuItems, firstMenuUrl, directMenuUrl]);

  const pdfUrl = directMenuUrl || firstMenuUrl || "";
  const pdfTitle = directMenuTitle || "Menu";

  const renderMenuItemInline = useCallback(
    (item: MenuItem) => (
      <View key={item.id} className="bg-card p-4 mb-3 px-2 mt-6 mx-4 rounded-lg border border-border">
        <View className="flex-row">
          {item.image_url && (
            <Image
              source={{ uri: item.image_url }}
              className="w-24 h-24 rounded-lg mr-4"
              contentFit="cover"
              optimizationPreset="medium"
            />
          )}

          <View className="flex-1">
            <View className="flex-row justify-between items-start mb-1">
              <H3 className="flex-1 mr-2">{item.name}</H3>
              {item.price > 0 && (
                <Text className="text-lg font-semibold text-primary">
                  ${item.price.toFixed(2)}
                </Text>
              )}
            </View>

            {item.description && (
              <P className="text-muted-foreground mb-2 text-sm">
                {item.description}
              </P>
            )}

            <View className="flex-row flex-wrap gap-2">
              {(item.dietary_tags || []).map((tag) => {
                const Icon = DIETARY_ICONS[tag];
                return (
                  <View
                    key={tag}
                    className="flex-row items-center bg-primary/10 px-2 py-1 rounded-full"
                  >
                    {Icon && <Icon size={12} className="mr-1 text-primary" />}
                    <Text className="text-xs text-primary capitalize">
                      {tag.replace("-", " ")}
                    </Text>
                  </View>
                );
              })}

              {item.preparation_time && (
                <View className="flex-row items-center bg-muted px-2 py-1 rounded-full">
                  <Clock size={12} className="mr-1 text-muted-foreground" />
                  <Text className="text-xs text-muted-foreground">
                    {item.preparation_time} min
                  </Text>
                </View>
              )}
            </View>

            {!item.is_available && (
              <Text className="text-xs text-destructive mt-2">
                Currently unavailable
              </Text>
            )}
          </View>
        </View>
      </View>
    ),
    [],
  );

  const renderSectionHeader = useCallback(
    (section: { title: string; description?: string }) => (
      <View
        key={`header-${section.title}`}
        className="bg-background px-4 py-3 border-b border-border"
      >
        <H2 className="text-lg">{section.title}</H2>
        {section.description && (
          <Muted className="text-sm mt-1">{section.description}</Muted>
        )}
      </View>
    ),
    [],
  );

  if (loading) {
    return <MenuScreenSkeleton />;
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center p-4">
        <Text className="text-destructive text-center mb-4">{error}</Text>
        <Button onPress={refresh}>
          <Text>Try Again</Text>
        </Button>
      </SafeAreaView>
    );
  }

  // Show PDF viewer if no menu items but menu_url exists or direct URL provided
  if (shouldShowPDF && pdfUrl) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        {/* Streamlined Header */}
        <View className="px-4 py-3 border-b border-border bg-card">
          <View className="flex-row items-center gap-3">
            <Pressable onPress={handleBack} className="p-2 active:opacity-70">
              <ChevronLeft
                size={24}
                color={colorScheme === "dark" ? "#FFFFFF" : "#000000"}
              />
            </Pressable>
            <View className="flex-1">
              <H1 className="text-xl font-semibold">{pdfTitle}</H1>
              {restaurant?.name && (
                <Muted className="text-sm mt-0.5">{restaurant.name}</Muted>
              )}
            </View>
            <Pressable
              onPress={handleOpenShare}
              className="p-2 active:opacity-70"
            >
              <Share2
                size={22}
                color={colorScheme === "dark" ? "#a855f7" : "#2563eb"}
              />
            </Pressable>
          </View>
        </View>

        {/* PDF Viewer - Takes full remaining space */}
        <PDFViewer
          url={pdfUrl}
          title={pdfTitle}
          restaurantName={restaurant?.name}
          hideShare
        />

        {/* Share Modal */}
        <ShareModal
          visible={showShareModal}
          onClose={() => setShowShareModal(false)}
          title="Share Menu"
          description="Share this restaurant's menu PDF"
          shareOptions={{
            url: pdfUrl,
            title: `${restaurant?.name || "Restaurant"} Menu`,
            message: `Check out the menu for ${restaurant?.name || "this restaurant"}!`,
            subject: `${restaurant?.name || "Restaurant"} Menu`,
          }}
          showCopyLink={Boolean(pdfUrl)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header with Back + Search */}
      <View className="p-4 border-b border-border">
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={handleBack}
            className="bg-primary/10 p-2 rounded-lg flex-row items-center"
          >
            <ChevronLeft
              size={20}
              color={colorScheme === "dark" ? "#FFFFFF" : "#000000"}
            />
          </Pressable>
          <View className="flex-1 bg-muted rounded-lg px-3 py-2 flex-row items-center">
            <Search
              size={20}
              color={colorScheme === "dark" ? "#FFFFFF" : "#666666"}
            />
            <TextInput
              value={filters.searchQuery}
              onChangeText={(text) => setFilters({ searchQuery: text })}
              placeholder="Search menu items..."
              placeholderTextColor="#999"
              className="flex-1 text-foreground"
            />
          </View>
          <Pressable
            onPress={handleOpenShare}
            className="bg-primary/10 p-2 rounded-lg flex-row items-center justify-center"
          >
            <Share2
              size={20}
              color={colorScheme === "dark" ? "#a855f7" : "#2563eb"}
            />
          </Pressable>
        </View>
      </View>

      {/* Category Navigation Bar */}
      {categories.length > 0 && (
        <View className="border-b border-border">
          <ScrollView
            ref={categoryChipsRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingVertical: 12,
              gap: 8,
            }}
          >
            {categories
              .filter((cat) => cat.items && cat.items.length > 0)
              .map((category) => (
                <Pressable
                  key={category.id}
                  onPress={() => handleCategoryPress(category.id)}
                  onLayout={(e) => {
                    chipPositions.current[category.id] = e.nativeEvent.layout.x;
                  }}
                  className={`px-4 py-2 rounded-full border ${
                    selectedCategoryId === category.id
                      ? "bg-primary border-primary"
                      : "bg-card border-border"
                  }`}
                >
                  <Text
                    className={`font-medium ${
                      selectedCategoryId === category.id
                        ? "text-primary-foreground"
                        : "text-foreground"
                    }`}
                  >
                    {category.name}
                  </Text>
                </Pressable>
              ))}
          </ScrollView>
        </View>
      )}

      {/* All Menu Content */}
      <FlatList
        ref={listRef}
        data={[1]}
        keyExtractor={() => 'menu-content'}
        onScroll={handleListScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
        contentContainerStyle={{ paddingBottom: 20 }}
        renderItem={() => (
          <View>
            {/* Featured Items */}
            {featuredItems.length > 0 && !filters.searchQuery && (
              <View className="mb-4">
                <H2 className="px-4 py-2">Featured Items</H2>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
                >
                  {featuredItems.map((item) => (
                    <View key={item.id} className="w-48">
                      <Image
                        source={{
                          uri: item.image_url || "https://via.placeholder.com/200",
                        }}
                        className="w-full h-32 rounded-lg mb-2"
                        optimizationPreset="medium"
                        contentFit="cover"
                      />
                      <Text className="font-semibold" numberOfLines={1}>
                        {item.name}
                      </Text>
                      {item.price > 0 && (
                        <Text className="text-primary font-medium">
                          ${item.price.toFixed(2)}
                        </Text>
                      )}
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Menu Sections */}
            {sections.length === 0 ? (
              <View className="flex-1 items-center justify-center py-20 px-4">
                <Text className="text-6xl mb-4">🍽️</Text>
                <Text className="text-center text-lg font-medium text-foreground mb-2">
                  Good things take time
                </Text>
                <Text className="text-center text-muted-foreground">
                  Our menu is being carefully prepared. Please check back soon.
                </Text>
              </View>
            ) : (
              sections.map((section:any) => (
                <View
                  key={section.title}
                  onLayout={(e) => {
                    sectionYPositions.current[section.title] = e.nativeEvent.layout.y;
                  }}
                >
                  {renderSectionHeader(section)}
                  {section.data.map((item: MenuItem) => renderMenuItemInline(item))}
                </View>
              ))
            )}
          </View>
        )}
      />

      <ShareModal
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        title="Share Menu"
        description="Share this restaurant menu with friends"
        shareOptions={{
          url: menuShareLink ?? undefined,
          title: "Restaurant Menu",
          message: "Check out this restaurant menu on ForkCast!",
          subject: "Restaurant Menu - ForkCast",
        }}
        showCopyLink={Boolean(menuShareLink)}
        customActions={[
          {
            id: "share-menu-context",
            title: "Share Menu",
            description: "Use ForkCast's share format",
            icon: Share2,
            onPress: async () => {
              if (!restaurantId) {
                return;
              }

              await shareRestaurantMenu(restaurantId);
            },
          },
        ]}
      />
    </SafeAreaView>
  );
}


