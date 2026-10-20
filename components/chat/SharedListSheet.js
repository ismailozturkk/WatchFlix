// components/chat/SharedListSheet.js
//
// Sohbette paylaşılan bir listenin TAM görünümü: balondaki yığın karta
// (SharedListMessage) basınca açılan alt sayfa. Görünüm ve davranış arkadaş
// profilindeki liste sayfasıyla (screens/tabs/profile/FriendProfileScreen.js)
// aynıdır — başlık + adet, "Listeyi kaydet", 3'lü/4'lü sütun seçici, cam kapatma
// düğmesi ve afiş ızgarası; çok içerikli listede sayfa ekranı kaplar.
//
// Bu bileşen YAZMAZ ve gezinmez: afişe basınca `onOpenItem`, kaydet düğmesine
// basınca `onSave` çağrılır; çağıran (ChatScreen) sayfayı kapatıp devamını yapar
// (iOS iki Modal'ı üst üste sunamaz — bkz. components/common/BottomSheetModal.js).
//
// `share` kapanış animasyonu (≈260 ms) sırasında da çizilir; çağıran son değeri
// kendi tutmalı (kapanışta null'a çekmemeli).

import React, { memo, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomSheetModal from "../common/BottomSheetModal";
import GlassCloseButton from "../common/GlassCloseButton";
import GlassIconButton from "../common/GlassIconButton";
import { useTheme } from "../../context/ThemeContext";
import { i18nText } from "../../utils/i18nText";
import { shareListTitle } from "./SharedListMessage";
import { PosterEdge } from "./shareKit";
import GlassPressable from "../common/GlassPressable";

// Bu sayı ve üzeri içerikte sayfa sabit yükseklik yerine ekranı kaplar
// (FriendProfileScreen ile aynı eşik).
export const FULLSCREEN_LIST_THRESHOLD = 12;

const PosterCard = memo(function PosterCard({ item, theme, getTmdbUrl, onPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.86}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={item.title}
      style={[
        styles.poster,
        { backgroundColor: theme.primary ?? "#111" },
      ]}
    >
      {item.poster_path ? (
        <Image
          source={{ uri: getTmdbUrl(item.poster_path, "poster", 200) }}
          style={styles.posterImg}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={`shared-list-${item.media_type}-${item.id}`}
        />
      ) : (
        // Afişi olmayan yapım adıyla tanınsın.
        <View style={styles.posterFallback}>
          <Ionicons name="image-outline" size={26} color={theme.text?.muted ?? "#555"} />
          <Text
            numberOfLines={3}
            style={[styles.posterFallbackText, { color: theme.text?.secondary ?? "#aaa" }]}
          >
            {item.title}
          </Text>
        </View>
      )}
      {/* Kenar çizgisi görselin ÜSTÜNDE: çerçeve görseli kırpmaz (bkz. PosterEdge). */}
      <PosterEdge radius={13} color={theme.border ?? "rgba(255,255,255,0.08)"} />
    </TouchableOpacity>
  );
});

/**
 * @param {object}  props
 * @param {boolean} props.visible
 * @param {object|null} props.share      utils/chatShare liste gövdesi.
 * @param {() => void} props.onClose
 * @param {() => void} [props.onDismissed]  Sayfa tamamen kalktıktan sonra (ardından Modal açılacaksa).
 * @param {(item: object) => void} props.onOpenItem
 * @param {() => void} [props.onSave]       Verilmezse (kendi listem) kaydet düğmesi çıkmaz.
 * @param {(path: string, type: string, width: number) => string} props.getTmdbUrl
 */
export default function SharedListSheet({
  visible,
  share,
  onClose,
  onDismissed,
  onOpenItem,
  onSave,
  getTmdbUrl,
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [columns, setColumns] = useState(3);

  const items = share?.items || [];
  const total = share?.total ?? items.length;
  const fullScreen = items.length >= FULLSCREEN_LIST_THRESHOLD;
  const hidden = total - items.length;

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      onDismissed={onDismissed}
      intensity={35}
      dimColor="rgba(0,0,0,0.4)"
      sheetStyle={[
        styles.sheet,
        fullScreen && {
          height: Math.round(windowHeight - insets.top - 12),
          maxHeight: Math.round(windowHeight - insets.top - 12),
        },
        {
          backgroundColor: theme.secondary,
          borderColor: theme.border ?? "rgba(255,255,255,0.08)",
        },
      ]}
    >
      <View style={[styles.handle, { backgroundColor: theme.text?.muted ?? "#666" }]} />

      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[styles.title, { color: theme.text?.primary ?? "#fff" }]}
          >
            {shareListTitle(share)}
          </Text>
          <Text allowFontScaling={false} style={[styles.subtitle, { color: theme.accent ?? "#aaa" }]}>
            {i18nText("autoI18n.item_count", "{{count}} içerik", { count: total })}
          </Text>
        </View>

        <View style={styles.actions}>
          {typeof onSave === "function" && (
            <GlassIconButton
              icon="file-tray-full-outline"
              iconSize={18}
              size={38}
              fallbackRadius={13}
              color="#fff"
              tint={theme.accent}
              fallbackStyle={{ backgroundColor: theme.accent }}
              hitSlop={6}
              accessibilityLabel={i18nText("autoI18n.listeyi_kaydet", "Listeyi kaydet")}
              onPress={onSave}
            />
          )}

          <View
            style={[
              styles.columnSelector,
              {
                backgroundColor: theme.primary ?? "#111",
                borderColor: theme.border ?? "rgba(255,255,255,0.08)",
              },
            ]}
          >
            {[3, 4].map((count) => {
              const active = columns === count;
              return (
                <GlassPressable
                  key={count}
                  onPress={() => setColumns(count)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={
                    count === 3
                      ? i18nText("autoI18n.uclu_dizilim", "3'lü")
                      : i18nText("autoI18n.dortlu_dizilim", "4'lü")
                  }
                  style={[styles.columnButton, active && { backgroundColor: `${theme.accent}22` }]}
                >
                  <Text
                    allowFontScaling={false}
                    style={[
                      styles.columnText,
                      { color: active ? theme.accent : theme.text?.muted ?? "#666" },
                    ]}
                  >
                    {count}
                  </Text>
                </GlassPressable>
              );
            })}
          </View>

          <GlassCloseButton
            size={36}
            fallbackRadius={12}
            iconSize={21}
            color={theme.text?.primary ?? "#fff"}
            backgroundColor={theme.primary ?? "#111"}
            borderColor={theme.border ?? "rgba(255,255,255,0.08)"}
            onPress={onClose}
          />
        </View>
      </View>

      <FlatList
        key={`shared-list-${columns}`}
        style={fullScreen ? styles.listGrow : undefined}
        data={items}
        keyExtractor={(item, index) => `${item.media_type}-${item.id}-${index}`}
        numColumns={columns}
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 24, 40) }]}
        ListFooterComponent={
          hidden > 0 ? (
            <Text style={[styles.more, { color: theme.text?.muted ?? "#888" }]}>
              {i18nText("autoI18n.liste_paylas_n_daha", "+{{n}} içerik daha", { n: hidden })}
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={{ width: columns === 4 ? "23.2%" : "31.8%" }}>
            <PosterCard
              item={item}
              theme={theme}
              getTmdbUrl={getTmdbUrl}
              onPress={() => onOpenItem?.(item)}
            />
          </View>
        )}
      />
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    width: "100%",
    maxHeight: "85%",
    borderWidth: 1,
    borderBottomWidth: 0,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    padding: 15,
    paddingBottom: 0,
  },
  handle: { width: 44, height: 5, borderRadius: 3, alignSelf: "center", marginBottom: 20 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
  },
  titleGroup: { flex: 1, minWidth: 0 },
  title: { fontSize: 22, fontWeight: "900" },
  subtitle: { fontSize: 13, fontWeight: "800", marginTop: 4 },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 7,
    flexShrink: 0,
  },
  columnSelector: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 13,
    borderWidth: 1,
    padding: 2,
  },
  columnButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  columnText: { fontSize: 13, fontWeight: "900" },

  listGrow: { flex: 1 },
  content: { gap: 10 },
  row: { justifyContent: "flex-start", gap: "2.3%" },
  poster: {
    width: "100%",
    aspectRatio: 2 / 3,
    borderRadius: 13,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  posterImg: { width: "100%", height: "100%" },
  posterFallback: { alignItems: "center", justifyContent: "center", gap: 6, padding: 8 },
  posterFallbackText: { fontSize: 11, fontWeight: "700", textAlign: "center" },
  more: { fontSize: 12, fontWeight: "700", textAlign: "center", marginTop: 6 },
});
