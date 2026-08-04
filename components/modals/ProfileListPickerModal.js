// components/modals/ProfileListPickerModal.js
//
// "Listemden aktar" seçicisi: profildeki listeleri poster önizlemesiyle
// gösterir, seçileni composer'a verir. Yalnız OKUR — aktarma kararını ve
// yazmayı çağıran taraf yapar.
//
// Boş listeler gösterilir ama seçilemez: kullanıcının "listem neden yok"
// diye aramasını önlemek, listeyi gizlemekten daha yardımcı.

import React, { useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "@context/ThemeContext";
import { useLanguage } from "@context/LanguageContext";
import { useProfileStats } from "@context/ProfileStatsContext";
import { useImageQualitySettings } from "@context/AppSettingsContext";
import { i18nText } from "@utils/i18nText";
import { getListAccent, getListIcon } from "@utils/listAppearance";
import { sortItemsByListOrder } from "@utils/listOrder";
import { MAX_SHARED_LIST_ITEMS } from "@utils/listShare";

const PREVIEW_COUNT = 4;

export default function ProfileListPickerModal({ visible, onClose, onSelect }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  // ProfileStatsContext bu değeri `lists` adıyla yayınlıyor (içeriği
  // displayLists): öntanımlı dört liste + kullanıcının özel listeleri.
  //
  // `|| {}` bir güvenlik ağı: context createContext() ile VARSAYILANSIZ
  // kurulmuş, sağlayıcı ağaçta yoksa useProfileStats() undefined döner ve
  // doğrudan destructuring TÜM sayfayı çökertir — kullanıcıya "bomboş sayfa"
  // olarak görünür. Böyle bir durumda çökmek yerine sebebi yazan boş durum
  // gösterilir.
  const { lists: profileLists, isLoading } = useProfileStats() || {};
  const { getTmdbUrl } = useImageQualitySettings();

  const lists = useMemo(() => {
    const labels = t?.profileScreen?.ProfileLists || {};
    const nameFor = (key) =>
      ({
        watchedMovies: labels.watchedMovies,
        watchedTv: labels.watchedTvSeries,
        favorites: labels.favorite,
        watchList: labels.watchList,
      })[key] || key;

    return (profileLists || [])
      .filter(([, items]) => Array.isArray(items))
      .map(([key, items]) => ({
        key,
        label: nameFor(key),
        // Kullanıcının profilde gördüğü sıra neyse paylaşıma da o gitsin.
        items: sortItemsByListOrder(items),
        accent: getListAccent(key),
        icon: getListIcon(key),
      }));
  }, [profileLists, t]);

  const hasAnyItem = useMemo(() => lists.some((list) => list.items.length > 0), [lists]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.secondary, borderColor: theme.border },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: theme.border }]} />

          <View style={styles.header}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.title, { color: theme.text.primary }]}>
                {i18nText("autoI18n.listemden_aktar", "Listemden aktar")}
              </Text>
              <Text style={[styles.subtitle, { color: theme.text.muted }]}>
                {i18nText(
                  "autoI18n.listemden_aktar_secim",
                  "Paylaşmak istediğin listeyi seç",
                )}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: theme.primary }]}
            >
              <Ionicons name="close" size={19} color={theme.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Tavan bilgilendirmesi: sayı MAX_SHARED_LIST_ITEMS'tan okunuyor,
              sabit değişirse metin kendiliğinden düzelir. */}
          <View
            style={[
              styles.infoRow,
              { backgroundColor: `${theme.accent}12`, borderColor: `${theme.accent}30` },
            ]}
          >
            <Ionicons name="information-circle-outline" size={14} color={theme.accent} />
            <Text style={[styles.infoText, { color: theme.text.secondary }]}>
              {i18nText(
                "autoI18n.liste_aktarim_tavani",
                "Bir listeden en fazla ilk {{count}} içerik aktarılır.",
                { count: MAX_SHARED_LIST_ITEMS },
              )}
            </Text>
          </View>

          <FlatList
            data={lists}
            keyExtractor={(list) => list.key}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.empty}>
                {isLoading ? (
                  <ActivityIndicator size="small" color={theme.accent} />
                ) : (
                  <Ionicons name="albums-outline" size={30} color={theme.text.muted} />
                )}
                <Text style={[styles.emptyText, { color: theme.text.muted }]}>
                  {isLoading
                    ? i18nText("autoI18n.listeler_yukleniyor", "Listeler yükleniyor…")
                    : i18nText(
                        "autoI18n.paylasilacak_liste_yok",
                        "Henüz paylaşabileceğin bir liste yok.",
                      )}
                </Text>
              </View>
            }
            ListFooterComponent={
              // Hepsi boşsa sayfa "bozuk" değil, sadece içerik yok — bunu
              // söylemek, dört soluk satıra bakıp sebebini aramaktan iyi.
              hasAnyItem || lists.length === 0 ? null : (
                <View style={styles.empty}>
                  <Text style={[styles.emptyText, { color: theme.text.muted }]}>
                    {i18nText(
                      "autoI18n.listelerin_bos",
                      "Listelerin şu an boş. Bir film ya da diziyi listene ekledikten sonra buradan paylaşabilirsin.",
                    )}
                  </Text>
                </View>
              )
            }
            renderItem={({ item: list }) => {
              const empty = list.items.length === 0;
              // Tavanı yalnız AŞAN listede uyar: genel bilgi başlıkta zaten
              // duruyor, her satıra tekrarlamak gürültü olurdu.
              const truncated = list.items.length > MAX_SHARED_LIST_ITEMS;
              return (
                <TouchableOpacity
                  disabled={empty}
                  activeOpacity={0.85}
                  onPress={() => onSelect?.(list)}
                  style={[
                    styles.row,
                    {
                      backgroundColor: theme.primary,
                      borderColor: empty ? theme.border : `${list.accent}44`,
                      opacity: empty ? 0.5 : 1,
                    },
                  ]}
                >
                  <View style={styles.rowTop}>
                    <View
                      style={[styles.iconWrap, { backgroundColor: `${list.accent}22` }]}
                    >
                      <Ionicons name={list.icon} size={16} color={list.accent} />
                    </View>
                    <Text
                      numberOfLines={1}
                      style={[styles.rowTitle, { color: theme.text.primary }]}
                    >
                      {list.label}
                    </Text>
                    <Text style={[styles.rowCount, { color: theme.text.muted }]}>
                      {empty
                        ? i18nText("autoI18n.bos_liste", "boş")
                        : list.items.length}
                    </Text>
                    {!empty && (
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={theme.text.muted}
                      />
                    )}
                  </View>

                  {truncated && (
                    <Text style={[styles.rowNote, { color: theme.accent }]} numberOfLines={1}>
                      {i18nText(
                        "autoI18n.ilk_n_icerik_aktarilir",
                        "İlk {{count}} içerik aktarılır",
                        { count: MAX_SHARED_LIST_ITEMS },
                      )}
                    </Text>
                  )}

                  {!empty && (
                    <View style={styles.posterRow}>
                      {list.items.slice(0, PREVIEW_COUNT).map((entry) => (
                        <View
                          key={`${entry.type}_${entry.id}`}
                          style={[styles.poster, { backgroundColor: theme.border }]}
                        >
                          {entry.imagePath ? (
                            <Image
                              source={{ uri: getTmdbUrl(entry.imagePath, "poster", 200) }}
                              style={StyleSheet.absoluteFill}
                              contentFit="cover"
                            />
                          ) : (
                            <Ionicons
                              name="film-outline"
                              size={16}
                              color={theme.text.muted}
                            />
                          )}
                        </View>
                      ))}
                      {list.items.length > PREVIEW_COUNT && (
                        <View
                          style={[
                            styles.poster,
                            styles.posterMore,
                            { backgroundColor: theme.secondary, borderColor: theme.border },
                          ]}
                        >
                          <Text style={[styles.posterMoreText, { color: theme.text.secondary }]}>
                            +{list.items.length - PREVIEW_COUNT}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.58)" },
  sheet: {
    maxHeight: "80%",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
  },
  handle: { width: 42, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 14 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 6 },
  title: { fontSize: 18, fontWeight: "900" },
  subtitle: { fontSize: 11.5, marginTop: 3 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 12,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  infoText: { flex: 1, fontSize: 11, fontWeight: "600", lineHeight: 15 },
  listContent: { paddingTop: 12, paddingBottom: 8, gap: 10 },
  row: { borderRadius: 16, borderWidth: 1, padding: 11 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 9 },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: "800" },
  rowCount: { fontSize: 12, fontWeight: "800" },
  rowNote: { fontSize: 10, fontWeight: "800", marginTop: 6 },
  posterRow: { flexDirection: "row", gap: 6, marginTop: 10 },
  poster: {
    width: 38,
    height: 54,
    borderRadius: 8,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  posterMore: { borderWidth: StyleSheet.hairlineWidth },
  posterMoreText: { fontSize: 11, fontWeight: "800" },
  empty: { alignItems: "center", gap: 10, paddingVertical: 40 },
  emptyText: { fontSize: 12.5, textAlign: "center", maxWidth: 240 },
});
