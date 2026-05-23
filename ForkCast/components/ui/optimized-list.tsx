// components/ui/optimized-list.tsx
import React, { useCallback, useMemo, useRef } from "react";
import { FlatList, ViewToken, FlatListProps } from "react-native";
import { imageCache } from "@/utils/imageCache";
import { useDebounce } from "use-debounce";

interface OptimizedListProps<T> {
  data: T[];
  renderItem: (props: any) => React.ReactElement | null;
  keyExtractor: (item: T, index: number) => string;
  onEndReached?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  listProps?: Partial<FlatListProps<T>>;
  ListHeaderComponent?: React.ComponentType<any> | React.ReactElement | null;
  ListFooterComponent?: React.ComponentType<any> | React.ReactElement | null;
  ListEmptyComponent?: React.ComponentType<any> | React.ReactElement | null;
  contentContainerStyle?: any;
  showsVerticalScrollIndicator?: boolean;
}

export function OptimizedList<T>({
  data,
  renderItem,
  keyExtractor,
  onEndReached,
  onRefresh,
  refreshing,
  listProps,
  ListHeaderComponent,
  ListFooterComponent,
  ListEmptyComponent,
  contentContainerStyle,
  showsVerticalScrollIndicator,
}: OptimizedListProps<T>) {
  const viewabilityConfig = useRef({
    minimumViewTime: 50,
    viewAreaCoveragePercentThreshold: 50,
  }).current;

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      // Preload images for visible items
      viewableItems.forEach((token) => {
        if (token.item.image_url) {
          imageCache.getCachedImage(token.item.image_url);
        }
      });
    },
    [],
  );

  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      onRefresh={onRefresh}
      refreshing={refreshing}
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      updateCellsBatchingPeriod={50}
      windowSize={10}
      initialNumToRender={10}
      viewabilityConfig={viewabilityConfig}
      onViewableItemsChanged={onViewableItemsChanged}
      getItemLayout={(data, index) => ({
        length: 120, // Fixed height for performance
        offset: 120 * index,
        index,
      })}
      ListHeaderComponent={ListHeaderComponent}
      ListFooterComponent={ListFooterComponent}
      ListEmptyComponent={ListEmptyComponent}
      contentContainerStyle={contentContainerStyle}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      {...(listProps as object)}
    />
  );
}
