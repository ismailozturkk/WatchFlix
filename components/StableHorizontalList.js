import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView } from "react-native";

export default function StableHorizontalList({
  data = [],
  renderItem,
  keyExtractor,
  contentContainerStyle,
  showsHorizontalScrollIndicator = false,
  horizontal = true,
  ListEmptyComponent,
  initialNumToRender,
  maxToRenderPerBatch,
  updateCellsBatchingPeriod,
  windowSize,
  removeClippedSubviews,
  getItemLayout,
  ...scrollProps
}) {
  const items = Array.isArray(data) ? data : [];
  const firstBatch =
    typeof initialNumToRender === "number" && initialNumToRender > 0
      ? initialNumToRender
      : items.length;
  const batchSize =
    typeof maxToRenderPerBatch === "number" && maxToRenderPerBatch > 0
      ? maxToRenderPerBatch
      : Math.max(firstBatch, 1);
  const [renderCount, setRenderCount] = useState(() =>
    Math.min(firstBatch, items.length),
  );

  useEffect(() => {
    setRenderCount(Math.min(firstBatch, items.length));
  }, [firstBatch, items.length]);

  const revealNextBatch = useCallback(() => {
    setRenderCount((current) => {
      if (current >= items.length) return current;
      return Math.min(current + batchSize, items.length);
    });
  }, [batchSize, items.length]);

  const handleScroll = useCallback(
    (event) => {
      scrollProps.onScroll?.(event);

      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      const distanceFromEnd =
        contentSize.width - (contentOffset.x + layoutMeasurement.width);

      if (distanceFromEnd < layoutMeasurement.width * 0.75) {
        revealNextBatch();
      }
    },
    [revealNextBatch, scrollProps.onScroll],
  );

  const visibleItems = useMemo(
    () => items.slice(0, renderCount),
    [items, renderCount],
  );

  const renderEmpty = () => {
    if (!ListEmptyComponent) return null;
    return typeof ListEmptyComponent === "function" ? (
      <ListEmptyComponent />
    ) : (
      ListEmptyComponent
    );
  };

  return (
    <ScrollView
      horizontal={horizontal}
      showsHorizontalScrollIndicator={showsHorizontalScrollIndicator}
      contentContainerStyle={contentContainerStyle}
      {...scrollProps}
      onScroll={handleScroll}
      scrollEventThrottle={scrollProps.scrollEventThrottle ?? 80}
    >
      {items.length === 0
        ? renderEmpty()
        : visibleItems.map((item, index) => {
            const key = keyExtractor
              ? keyExtractor(item, index)
              : item?.id != null
                ? item.id.toString()
                : index.toString();
            return (
              <React.Fragment key={String(key)}>
                {renderItem?.({ item, index })}
              </React.Fragment>
            );
          })}
    </ScrollView>
  );
}
