import React, { useCallback, useRef } from "react";
import { FlatList, View, ActivityIndicator } from "react-native";
import { useTheme } from "../context/ThemeContext";

/**
 * Yatay, sonsuz-kaydırmalı poster listesi — tüm bölümlerin (Bests, Genres,
 * Upcoming, AiringToday, OnTheAir…) ortak listesi.
 *
 * Alttaki sayfa-değiştirme butonlarının yerini alır: liste sonuna yaklaşınca
 * `onLoadMore` çağrılır ve yeni sayfa MEVCUT verinin SONUNA eklenir. Veri
 * append edildiği (key'ler sabit) için kaydırma pozisyonu bozulmaz — kullanıcı
 * kaydırmaya devam ederken sonraki sayfa araya sorunsuz girer.
 *
 * Props:
 *  - data, renderItem, keyExtractor : standart FlatList
 *  - onLoadMore   : sona yaklaşınca çağrılır (sonraki sayfayı append eder)
 *  - loadingMore  : sonraki sayfa yükleniyor → sonda spinner
 *  - hasMore      : daha fazla sayfa var mı (yoksa onLoadMore tetiklenmez)
 *  - contentContainerStyle ve diğer FlatList prop'ları geçirilebilir
 */
export default function PaginatedRail({
  data,
  renderItem,
  keyExtractor,
  onLoadMore,
  loadingMore = false,
  hasMore = false,
  contentContainerStyle,
  onEndReachedThreshold = 0.4,
  ...rest
}) {
  const { theme } = useTheme();
  // onEndReached'in mount'ta / her render'da gereksiz tetiklenmesini engeller:
  // yalnızca gerçek bir kaydırma jesti (momentum) sonrası bir kez çalışır.
  const canTrigger = useRef(false);

  const handleEndReached = useCallback(() => {
    if (!canTrigger.current) return;
    canTrigger.current = false;
    if (hasMore && !loadingMore) onLoadMore?.();
  }, [hasMore, loadingMore, onLoadMore]);

  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      horizontal
      showsHorizontalScrollIndicator={false}
      onMomentumScrollBegin={() => {
        canTrigger.current = true;
      }}
      onEndReached={handleEndReached}
      onEndReachedThreshold={onEndReachedThreshold}
      ListFooterComponent={
        loadingMore ? (
          <View
            style={{
              width: 56,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <ActivityIndicator size="small" color={theme.accent} />
          </View>
        ) : null
      }
      removeClippedSubviews
      contentContainerStyle={contentContainerStyle}
      {...rest}
    />
  );
}
