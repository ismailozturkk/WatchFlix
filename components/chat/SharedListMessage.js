// components/chat/SharedListMessage.js
//
// Sohbette/grupta paylaşılan LİSTE balonunun gövdesi (mesaj kind: "listShare",
// bkz. utils/chatShare.js).
//
// Görünüm: Kütüphane'deki liste kartının AYNISI — alıcının "Liste Görünümü Seçin"
// tercihi (ProfileUiContext.gridStyle + "Ayrı Köşeli Afişler") ile çizilen kapak
// bloğu (components/lists/ListCovers), altında ayırıcı ve ikon karolu ad + adet.
// Böylece paylaşılan liste, kişinin kendi listeleriyle aynı yüzle görünür. Karta
// basınca listenin tamamı alt sayfada açılır (SharedListSheet); balon HİÇBİR ZAMAN
// uzamaz (kapak en fazla 8 afiş gösterir), uzun listeler sohbeti aşağı kaydırmaz.
// Yalnız GELEN balonda "Listeyi kaydet" düğmesi vardır (CineSwipe eşleşmelerinde
// iki tarafta da).
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
import { useProfileUi } from "../../context/ProfileUiContext";
import ListCovers, { getNaturalCoverWidth } from "../lists/ListCovers";
import { sharePalette } from "./shareKit";

// CineSwipe'ın kimlik rengi (SharedCineRoomMessage ile aynı).
const CINE_ROSE = "#E11D48";

// Kart ölçüleri: kapak yüksekliği Kütüphane rayındakinden (112) biraz büyük; kapak
// GENİŞLİĞİ rayın oranlarıyla düzene göre değişir, kart genişliği ise SABİT — balon
// düzen değişince zıplamaz, kapak kartın ortasında durur.
const COVER_H = 128;
const CARD_PADDING = 10;
const CARD_W = 240;
const coverWidthFor = (gridStyle) => {
  if (gridStyle === 1) return Math.round((COVER_H * 184) / 112); // Büyük Kapaklar
  if (gridStyle === 2) return Math.round((COVER_H * 156) / 112); // Küçük Kapaklar
  return Math.min(getNaturalCoverWidth(gridStyle, COVER_H), CARD_W - CARD_PADDING * 2);
};

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

  // Kütüphane'deki seçili liste görünümü (sağlayıcı yoksa ListCovers'ın varsayılanı).
  const profileUi = useProfileUi();
  const gridStyle = profileUi?.gridStyle;
  const allCornersRounded = !!profileUi?.allCornersRounded;
  // Paylaşım öğesi → ListCovers'ın beklediği profil öğesi biçimi. `listOrder`
  // gönderenin sırasını korur (ListCovers kendi içinde listOrder'a göre dizer).
  const coverItems = useMemo(
    () =>
      items.map((item, index) => ({
        ...item,
        type: item.media_type,
        imagePath: item.poster_path,
        listOrder: index,
      })),
    [items],
  );
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
  // CineSwipe eşleşmeleri iki kişinin ortak listesi: gönderen de kaydedebilir.
  const canSave = (isCine || !isOutgoing) && typeof onSave === "function";
  const countText = isCine
    ? i18nText("autoI18n.paylas_cine_n_eslesme", "{{n}} ortak eşleşme", { n: total })
    : i18nText("autoI18n.n_icerik", "{{n}} içerik", { n: total });
  const openLabel = i18nText("autoI18n.liste_paylas_listeyi_gor", "Listeyi gör");

  // Kart her zaman basılabilir: liste sayfası yoksa ilk içerik açılır.
  const openCard = canOpen ? onOpenList : () => items[0] && onOpenItem?.(items[0]);
  const icon = isShared ? "people" : isCine ? "film" : getListIcon(share?.listKey);
  const kicker = isShared
    ? i18nText("autoI18n.ortak_liste", "ORTAK LİSTE")
    : isCine
      ? i18nText("autoI18n.paylas_cine_eslesme_baslik", "CineSwipe eşleşmeleri")
      : i18nText("autoI18n.liste_2", "Liste");

  return (
    <View style={styles.wrap}>
      {/* Kütüphane liste kartı: kapak bloğu + ayırıcı + ad/adet */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={openCard}
        accessibilityRole="button"
        accessibilityLabel={openLabel}
        style={[
          styles.card,
          { backgroundColor: palette.surface, borderColor: palette.surfaceBorder },
        ]}
      >
        <View style={styles.coverRow}>
          <ListCovers
            items={coverItems}
            gridStyle={gridStyle}
            allCornersRounded={allCornersRounded}
            width={coverWidthFor(gridStyle)}
            height={COVER_H}
            getTmdbUrl={getTmdbUrl}
            theme={theme}
          />
        </View>
        <View style={[styles.divider, { backgroundColor: palette.divider }]} />
        <View style={styles.footer}>
          <View style={[styles.headerTile, { backgroundColor: palette.tile }]}>
            <Ionicons name={icon} size={15} color={palette.tileInk} />
          </View>
          <View style={styles.headerCopy}>
            <Text
              style={[styles.kicker, { color: palette.tileInk }]}
              numberOfLines={1}
              allowFontScaling={false}
            >
              {kicker}
            </Text>
            <Text style={[styles.title, { color: palette.primary }]} numberOfLines={2}>
              {shareListTitle(share)}
            </Text>
            <Text allowFontScaling={false} style={[styles.meta, { color: palette.muted }]} numberOfLines={1}>
              {[countText, totalDuration].filter(Boolean).join(" · ")}
            </Text>
          </View>
          <View style={[styles.countPill, { backgroundColor: palette.tile }]}>
            <Text allowFontScaling={false} style={[styles.countText, { color: palette.tileInk }]}>
              {total}
            </Text>
          </View>
          {canOpen && <Ionicons name="chevron-forward" size={16} color={palette.muted} />}
        </View>
      </TouchableOpacity>

      {/* Eylem: gelen balonda (CineSwipe'ta iki tarafta); yüksekliği sabit */}
      {canSave && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onSave}
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          style={[styles.action, { backgroundColor: palette.buttonBg }]}
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
  wrap: { alignSelf: "flex-start", width: CARD_W, marginBottom: 2 },

  card: {
    width: CARD_W,
    padding: CARD_PADDING,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  coverRow: { alignItems: "center" },
  divider: { height: StyleSheet.hairlineWidth, marginTop: 10, marginBottom: 9 },
  footer: { flexDirection: "row", alignItems: "center", gap: 9 },
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
  meta: { fontSize: 11, fontWeight: "600", marginTop: 2 },

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
