// components/chat/SharedListMessage.js
//
// Sohbette/grupta paylaşılan LİSTE balonunun gövdesi (mesaj kind: "listShare",
// bkz. utils/chatShare.js).
//
// Görünüm: üstte ikon karolu liste adı + adet rozeti, altında ilk ÜÇ afiş; liste
// üçten uzunsa dördüncü yuvada, üst üste binmiş kartlardan oluşan bir YIĞIN ve
// üzerinde kalan adet ("+12") durur. Yığına (ya da başlığa) basınca listenin
// tamamı alt sayfada açılır (SharedListSheet — arkadaş profilindeki liste sayfası
// ile aynı görünüm); balon HİÇBİR ZAMAN uzamaz, bu yüzden uzun listeler sohbeti
// aşağı kaydırmaz. Yalnız GELEN balonda "Listeyi kaydet" düğmesi vardır.
//
// `source: "cineswipe"`: bir CineSwipe odasının ortak eşleşmeleri (oda bitince davetin geldiği sohbete
// yazılır, bkz. screens/cineswipe/CineSwipeScreen). Başlık iki kişinin adı; üst etiket, simge ve renk
// CineSwipe'ın (davet kartıyla aynı gül rengi).
//
// Gövde yazmaz ve gezinmez: dokunuşlar `onOpenItem` / `onOpenList` / `onSave`
// ile bildirilir, kararı ChatScreen verir.

import React, { memo, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../context/ThemeContext";
import { i18nText } from "../../utils/i18nText";
import { getListAccent, getListIcon, getSharedListAccent } from "../../utils/listAppearance";
import { formatMinutes, sumListMinutes } from "../../utils/mediaFacts";
import PosterStrip, { stripLayout } from "./PosterStrip";
import { sharePalette } from "./shareKit";

// CineSwipe'ın kimlik rengi (SharedCineRoomMessage ile aynı).
const CINE_ROSE = "#E11D48";

const DEFAULT_LABELS = {
  watchedMovies: () => i18nText("autoI18n.izlenen_filmler", "İzlenen Filmler"),
  watchedTv: () => i18nText("autoI18n.izlenen_diziler", "İzlenen Diziler"),
  favorites: () => i18nText("autoI18n.favoriler", "Favoriler"),
  watchList: () => i18nText("autoI18n.izlenecekler", "İzlenecekler"),
};

/** Öntanımlı listelerde ALICININ dilinde ad; özel listede gönderenin yazdığı ad. */
export function shareListTitle(share) {
  if (share?.listKey && DEFAULT_LABELS[share.listKey]) return DEFAULT_LABELS[share.listKey]();
  return share?.title || i18nText("autoI18n.n_icerik", "{{n}} içerik", { n: share?.total ?? 0 });
}

function SharedListMessage({
  share,
  isOutgoing = false,
  accent: propAccent,
  getTmdbUrl,
  onOpenItem,
  onOpenList,
  onSave,
}) {
  const { theme } = useTheme();

  const items = share?.items || [];
  const total = share?.total ?? items.length;
  const isShared = share?.source === "shared";
  const isCine = share?.source === "cineswipe";
  const listAccent = share?.listKey
    ? getListAccent(share.listKey)
    : isShared
      ? getSharedListAccent()
      : isCine
        ? CINE_ROSE
        : propAccent || theme.accent || "#6C63FF";
  const palette = useMemo(
    () => sharePalette({ theme, isOutgoing, accent: listAccent }),
    [theme, isOutgoing, listAccent],
  );

  const layout = useMemo(() => stripLayout(total), [total]);
  const durationLabels = useMemo(
    () => ({
      hourLabel: i18nText("autoI18n.saat_kisa_birim", "sa"),
      minuteLabel: i18nText("autoI18n.dakika_kisa_birim", "dk"),
    }),
    [],
  );
  // Süre toplamı yalnız TÜM öğelerin süresi biliniyorsa ve liste kırpılmadıysa
  // gösterilir; kısmi toplam ("12 sa" derken gerçekte 30 sa) yanıltıcı olurdu.
  const totalDuration = useMemo(() => {
    const sums = sumListMinutes(items);
    if (sums.unknown > 0 || total > items.length) return null;
    return formatMinutes(sums.total, durationLabels);
  }, [items, total, durationLabels]);

  const canOpen = typeof onOpenList === "function";
  const canSave = !isOutgoing && typeof onSave === "function";
  const countText = isCine
    ? i18nText("autoI18n.paylas_cine_n_eslesme", "{{n}} ortak eşleşme", { n: total })
    : i18nText("autoI18n.n_icerik", "{{n}} içerik", { n: total });
  const openLabel = i18nText("autoI18n.liste_paylas_listeyi_gor", "Listeyi gör");

  const HeaderWrap = canOpen ? TouchableOpacity : View;
  const headerProps = canOpen
    ? {
        activeOpacity: 0.8,
        onPress: onOpenList,
        accessibilityRole: "button",
        accessibilityLabel: openLabel,
      }
    : {};

  return (
    <View style={styles.wrap}>
      {/* Başlık: ikon karosu + ad + adet; basınca liste sayfası açılır */}
      <HeaderWrap {...headerProps} style={[styles.header, { width: layout.blockWidth }]}>
        <View style={[styles.headerTile, { backgroundColor: palette.tile }]}>
          <Ionicons
            name={isShared ? "people" : isCine ? "film" : getListIcon(share?.listKey)}
            size={15}
            color={palette.tileInk}
          />
        </View>
        <View style={styles.headerCopy}>
          <Text
            style={[styles.kicker, { color: palette.tileInk }]}
            numberOfLines={1}
            allowFontScaling={false}
          >
            {isShared
              ? i18nText("autoI18n.ortak_liste", "ORTAK LİSTE")
              : isCine
                ? i18nText("autoI18n.paylas_cine_eslesme_baslik", "CineSwipe eşleşmeleri")
                : i18nText("autoI18n.liste_2", "Liste")}
          </Text>
          <Text style={[styles.title, { color: palette.primary }]} numberOfLines={2}>
            {shareListTitle(share)}
          </Text>
        </View>
        <View style={[styles.countPill, { backgroundColor: palette.tile }]}>
          <Text allowFontScaling={false} style={[styles.countText, { color: palette.tileInk }]}>
            {total}
          </Text>
        </View>
        {canOpen && <Ionicons name="chevron-forward" size={16} color={palette.muted} />}
      </HeaderWrap>
      <Text
        allowFontScaling={false}
        style={[styles.meta, { color: palette.muted, width: layout.blockWidth }]}
        numberOfLines={1}
      >
        {[countText, totalDuration].filter(Boolean).join(" · ")}
      </Text>

      {/* İlk üç afiş + (liste uzunsa) yığın */}
      <PosterStrip
        items={items}
        total={total}
        layout={layout}
        palette={palette}
        getTmdbUrl={getTmdbUrl}
        onOpenItem={onOpenItem}
        onOpenAll={canOpen ? onOpenList : undefined}
        caption={openLabel}
      />

      {/* Eylem: yalnız gelen balonda; yüksekliği sabit */}
      {canSave && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onSave}
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          style={[styles.action, { width: layout.blockWidth, backgroundColor: palette.buttonBg }]}
          accessibilityRole="button"
          accessibilityLabel={i18nText("autoI18n.listeyi_kaydet", "Listeyi kaydet")}
        >
          <Ionicons name="bookmark-outline" size={15} color={palette.buttonInk} />
          <Text
            allowFontScaling={false}
            style={[styles.actionText, { color: palette.buttonInk }]}
            numberOfLines={1}
          >
            {i18nText("autoI18n.listeyi_kaydet", "Listeyi kaydet")}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default memo(SharedListMessage);

const styles = StyleSheet.create({
  wrap: { alignSelf: "flex-start", marginBottom: 2 },

  header: { flexDirection: "row", alignItems: "center", gap: 9 },
  headerTile: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: { flex: 1, minWidth: 0 },
  kicker: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  title: { fontSize: 15, fontWeight: "800", lineHeight: 19, marginTop: 1 },
  countPill: {
    minWidth: 26,
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: { fontSize: 12, fontWeight: "800" },
  meta: { fontSize: 11, fontWeight: "600", marginTop: 6, marginBottom: 14 },

  action: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 36,
    marginTop: 12,
    paddingHorizontal: 10,
    borderRadius: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  actionText: { fontSize: 12.5, fontWeight: "800", flexShrink: 1 },
});
