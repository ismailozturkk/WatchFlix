// components/person/FollowedUpcomingRail.js
//
// Film / Dizi sekmesindeki "Takip ettiklerinin yaklaşanları" rafı: takip edilen oyuncu ve
// yönetmenlerin yayın tarihi BUGÜN ya da sonrası olan işleri, en yakın tarih önce.
//
// ÜÇ DURUM
//   • kimse takipte değil      → HİÇ çizilmez (ve ekran bu bileşeni bölüm listesine hiç eklemez,
//                                 yoksa boş bölüm "kaç bölüm gösterildi" sayacında yer tutardı)
//   • takipte var, yaklaşan yok → ince bir bilgi satırı: "Takip ettiklerinden yaklaşan yok · N kişi"
//                                 + "Takip ettiklerim". Satır bilerek kalır: yaklaşan yoksa yönetim
//                                 kapısı kaybolur, kişi takibi bırakmak için ancak kişi sayfasını arardı
//   • yaklaşan var             → poster rafı
//
// İZLENMİŞLER ELENİR (ListStatusContext indeksi, ek okuma yok): yaklaşan listesinde yayın günü
// bugün olan ve zaten izlenmiş bir yapım olabilir.
// YÜKLEME HATASI sessiz: raf çizilmez (FavoritesRecommendationRail ile aynı karar).
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import PosterImage from "../PosterImage";
import ListBadges from "../ListBadges";
import PaginatedRail from "../PaginatedRail";
import SeeAllHeader from "../SeeAllHeader";
import { RailSkeleton } from "../Skeleton";
import { CountdownBadge, ReleaseDateBadge, POSTER_BADGE_POS } from "../PosterInfoBadges";
import FollowedPeopleSheet from "./FollowedPeopleSheet";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { useApiSettings, useListLayoutSettings } from "../../context/AppSettingsContext";
import { useListStatusContext } from "../../context/ListStatusContext";
import { useMediaQuickActions } from "../../context/MediaQuickActionsContext";
import useFollowedPeople from "../../hooks/useFollowedPeople";
import useRailPosterStyle from "../../hooks/useRailPosterStyle";
import { trackEvent, ANALYTICS_EVENTS } from "../../services/analytics";
import { fetchFollowedUpcoming } from "../../services/followedUpcoming";
import { describePeople } from "../../utils/followedPeople";
import { getFollowedPeopleCopy } from "../../utils/followedPeopleCopy";

const VISIBLE_LIMIT = 24;

const UpcomingCard = memo(function UpcomingCard({ item, mediaType, navigation, onOpen }) {
  const { theme } = useTheme();
  const { posterBadges } = useListLayoutSettings();
  const rail = useRailPosterStyle();
  const { openQuickActions } = useMediaQuickActions();
  const scale = useRef(new Animated.Value(1)).current;
  const names = describePeople(item._people, { limit: 3 });

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      style={{ width: rail.itemWidth, height: rail.itemHeight }}
      accessibilityLabel={names}
      onPressIn={() => Animated.timing(scale, { toValue: 0.94, duration: 120, useNativeDriver: true }).start()}
      onPressOut={() => Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }).start()}
      onPress={() => {
        onOpen?.(item);
        navigation.push(mediaType === "movie" ? "MovieDetails" : "TvShowsDetails", { id: item.id });
      }}
      onLongPress={() => openQuickActions({ item, mediaType, navigation })}
      delayLongPress={350}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <PosterImage
          path={item.poster_path}
          type={mediaType}
          size={200}
          style={{
            width: rail.posterWidth,
            height: rail.posterHeight,
            borderRadius: rail.radius,
            backgroundColor: theme.secondary,
          }}
          cachePolicy="memory-disk"
          recyclingKey={`followed-upcoming-${mediaType}-${item.id}`}
          transition={120}
        />
        {posterBadges?.countdown !== false && (
          <CountdownBadge date={item._date} style={POSTER_BADGE_POS.topLeft} />
        )}
        {posterBadges?.releaseDate !== false && (
          <ReleaseDateBadge date={item._date} style={POSTER_BADGE_POS.topRight} />
        )}
        <ListBadges
          mediaId={item.id}
          mediaType={mediaType}
          theme={theme}
          style={styles.badges}
        />
      </Animated.View>
    </TouchableOpacity>
  );
});

export default function FollowedUpcomingRail({ mediaType, navigation }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { API_KEY } = useApiSettings();
  const { statusIndex } = useListStatusContext() || {};
  const copy = getFollowedPeopleCopy(language);
  const { people, count } = useFollowedPeople();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [state, setState] = useState({ status: "loading", items: [] });

  // Firestore değil MMKV: `people` her depo olayında yeni dizi üretir; efekti dizinin değil
  // KİMLİKLERİNİN anahtarına bağla (takip zamanı değişimi ağ isteklerini yeniden başlatmasın).
  const peopleKey = useMemo(
    () => people.map((person) => person.id).sort((a, b) => a - b).join("|"),
    [people],
  );

  useEffect(() => {
    if (!peopleKey || !API_KEY) {
      setState({ status: "empty", items: [] });
      return undefined;
    }
    let active = true;
    // Önceki liste varsa koru (yenilemede posterler yanıp sönmesin).
    setState((current) => (current.items.length ? current : { status: "loading", items: [] }));
    fetchFollowedUpcoming({ people, mediaType, apiKey: API_KEY, language, limit: 60 })
      .then((items) => {
        if (active) setState({ status: "ready", items });
      })
      .catch(() => {
        if (active) setState((current) => (current.items.length ? current : { status: "error", items: [] }));
      });
    return () => {
      active = false;
    };
    // `people` kimliği peopleKey'den türüyor (yukarıdaki not).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API_KEY, language, mediaType, peopleKey]);

  const visible = useMemo(() => {
    const seen = statusIndex?.[mediaType] || {};
    return state.items.filter((item) => !seen[item.id]?.isWatched).slice(0, VISIBLE_LIMIT);
  }, [mediaType, state.items, statusIndex]);

  const names = useMemo(() => {
    const seen = new Set();
    const ordered = [];
    for (const item of visible) {
      for (const name of item._people) {
        if (!seen.has(name)) {
          seen.add(name);
          ordered.push(name);
        }
      }
    }
    return describePeople(ordered, { limit: 2, more: copy.rail.more });
  }, [copy, visible]);

  const openSheet = useCallback(() => setSheetOpen(true), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  const handleOpen = useCallback(
    () => trackEvent(ANALYTICS_EVENTS.FOLLOWED_UPCOMING_OPENED, { media_type: mediaType }),
    [mediaType],
  );
  const renderItem = useCallback(
    ({ item }) => <UpcomingCard item={item} mediaType={mediaType} navigation={navigation} onOpen={handleOpen} />,
    [handleOpen, mediaType, navigation],
  );

  if (count === 0 || state.status === "empty" || state.status === "error") return null;

  const sheet = <FollowedPeopleSheet visible={sheetOpen} onClose={closeSheet} navigation={navigation} />;

  if (state.status === "ready" && visible.length === 0) {
    return (
      <View style={styles.section}>
        <Pressable
          onPress={openSheet}
          accessibilityRole="button"
          accessibilityLabel={copy.rail.manage}
          style={({ pressed }) => [
            styles.quiet,
            { backgroundColor: theme.secondary, borderColor: theme.border },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="notifications-outline" size={18} color={theme.accent} />
          <View style={styles.quietText}>
            <Text style={[styles.quietTitle, { color: theme.text.primary }]} numberOfLines={1}>
              {copy.rail.quietTitle}
            </Text>
            <Text style={[styles.quietBody, { color: theme.text.muted }]} numberOfLines={1}>
              {copy.rail.quietBody(count)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.text.muted} />
        </Pressable>
        {sheet}
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <SeeAllHeader title={copy.rail.title} style={styles.header} />
      <View style={styles.subtitleRow}>
        <Text allowFontScaling={false} style={[styles.subtitle, { color: theme.text.muted }]} numberOfLines={1}>
          {state.status === "loading" ? " " : names}
        </Text>
        <Pressable
          onPress={openSheet}
          hitSlop={10}
          accessibilityRole="button"
          style={({ pressed }) => [styles.manage, pressed && styles.pressed]}
        >
          <Text allowFontScaling={false} style={[styles.manageText, { color: theme.accent }]} numberOfLines={1}>
            {copy.rail.manage}
          </Text>
          <Ionicons name="chevron-forward" size={12} color={theme.accent} />
        </Pressable>
      </View>
      {state.status === "loading" ? (
        <RailSkeleton />
      ) : (
        <PaginatedRail
          data={visible}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.rail}
          initialNumToRender={3}
          maxToRenderPerBatch={3}
          windowSize={5}
        />
      )}
      {sheet}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingVertical: 10 },
  header: { marginBottom: 0 },
  subtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 15,
    marginTop: -4,
    marginBottom: 12,
  },
  subtitle: { flexShrink: 1, flexGrow: 1, fontSize: 11 },
  manage: { flexDirection: "row", alignItems: "center", gap: 2, flexShrink: 0 },
  manageText: { fontSize: 11, fontWeight: "700" },
  rail: { paddingHorizontal: 15 },
  badges: { position: "absolute", left: 2, bottom: 8 },
  quiet: {
    marginHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  quietText: { flexGrow: 1, flexShrink: 1, gap: 2 },
  quietTitle: { fontSize: 13, fontWeight: "700" },
  quietBody: { fontSize: 12 },
  pressed: { opacity: 0.75 },
});
