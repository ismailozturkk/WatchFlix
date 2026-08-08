// screens/tabs/profile/FriendProfileScreen.js
//
// Arkadaş profil ekranı: kullanıcı bilgileri (avatar, isim, bio, online durumu,
// sayaçlar, katılım tarihi) + izleme istatistikleri (film/dizi süreleri, tür
// analizi) + paylaşmayı seçtiği listeler (Users/{uid}.listVisible haritası).
// privacy.profile / privacy.lists / privacy.onlineStatus ayarlarına saygı duyar.
//
// Veri kaynakları:
//   Users/{uid}                        → profil + privacy + listVisible
//   Presence/{uid}                     → canlı online/son görülme
//   Lists/{uid}                        → eski format listeler + özel listeler
//   Lists/{uid}/watchedMovies          → yeni format filmler (tek seferlik)
//   Lists/{uid}/watchedTv              → yeni format diziler (tek seferlik)

import React, { useState, useEffect, useMemo, useCallback, memo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image as RNImage,
  Modal,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { doc, collection, onSnapshot, getDocs } from "firebase/firestore";
import { SafeAreaView } from "react-native-safe-area-context";
import BottomSheetModal from "@components/common/BottomSheetModal";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import Feather from "@expo/vector-icons/Feather";
import { db } from "../../../firebase";
import { useTheme } from "../../../context/ThemeContext";
import { useFriends } from "../../../context/FriendsContext";
import { useProfileUi } from "../../../context/ProfileUiContext";
import { useImageQualitySettings } from "../../../context/AppSettingsContext";
import { useLanguage } from "../../../context/LanguageContext";
import { DEFAULT_PRIVACY } from "../../../services/userService";
import {
  subscribeToUserPresence,
  isOnlineVisible,
  formatLastSeen,
} from "../../../services/presenceService";
import ScreenDecor from "../../../components/ScreenDecor";
import BackButton from "../../../components/BackButton";
import { i18nText } from "../../../utils/i18nText";


const PROTECTED_LISTS = ["watchedMovies", "watchedTv", "watchList", "favorites"];

const LIST_META = {
  watchedMovies: { icon: "movie-outline", iconLib: "mci", color: "#29b864", label: i18nText("autoI18n.izlenen_filmler", "İzlenen Filmler") },
  watchedTv:     { icon: "tv",            iconLib: "feather", color: "#29b864", label: i18nText("autoI18n.izlenen_diziler", "İzlenen Diziler") },
  favorites:     { icon: "heart",         iconLib: "ion", color: "#e33",     label: i18nText("autoI18n.favoriler", "Favoriler") },
  watchList:     { icon: "bookmark",      iconLib: "ion", color: "#64b4ff",  label: i18nText("autoI18n.izlenecekler", "İzlenecekler") },
};

const ListIcon = ({ name, iconLib, color, size = 15 }) => {
  if (iconLib === "mci") return <MaterialCommunityIcons name={name} size={size} color={color} />;
  if (iconLib === "feather") return <Feather name={name} size={size} color={color} />;
  return <Ionicons name={name} size={size} color={color} />;
};

// ── Süre formatı: 12345dk → "8 gün 13 sa" / "3 sa 25 dk" / "45 dk" ──────────
const formatDuration = (totalMinutes) => {
  if (!totalMinutes) return "0 dk";
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const mins = totalMinutes % 60;
  if (days > 0) {
    return i18nText("autoI18n.duration_days_hours", "{{days}} gün {{hours}} sa", { days, hours });
  }
  if (hours > 0) {
    return i18nText("autoI18n.duration_hours_minutes", "{{hours}} sa {{minutes}} dk", { hours, minutes: mins });
  }
  return i18nText("autoI18n.duration_minutes", "{{minutes}} dk", { minutes: mins });
};

// ── Katılım tarihi: Timestamp → "Mart 2026" ─────────────────────────────────
const formatMemberSince = (ts, language) => {
  const ms = ts?.toMillis?.();
  if (!ms) return null;
  return new Intl.DateTimeFormat(language === "tr" ? "tr-TR" : "en-US", { month: "long", year: "numeric" }).format(new Date(ms));
};

const ProfileMetricPill = ({ icon, label, value, color, theme }) => (
  <View
    style={[
      styles.profileMetricPill,
      {
        backgroundColor: theme.primary ?? "#111",
        borderColor: theme.border ?? "rgba(255,255,255,0.08)",
      },
    ]}
  >
    <View style={[styles.profileMetricIcon, { backgroundColor: color + "1F" }]}>
      <Ionicons name={icon} size={14} color={color} />
    </View>
    <Text
      allowFontScaling={false}
      numberOfLines={1}
      style={[styles.profileMetricValue, { color: theme.text?.primary ?? "#fff" }]}
    >
      {value}
    </Text>
    <Text
      allowFontScaling={false}
      numberOfLines={1}
      style={[styles.profileMetricLabel, { color: theme.text?.muted ?? "#666" }]}
    >
      {label}
    </Text>
  </View>
);

const WatchMetricTile = ({ icon, iconLib, label, value, detail, color, theme }) => (
  <View
    style={[
      styles.watchMetricTile,
      {
        backgroundColor: theme.secondary,
        borderColor: theme.border ?? "rgba(255,255,255,0.08)",
      },
    ]}
  >
    <ListIcon name={icon} iconLib={iconLib} color={color} size={16} />
    <View style={{ marginLeft: 8, flex: 1, justifyContent: "center" }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4 }}>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[styles.watchMetricValue, { color: theme.text?.primary ?? "#fff" }]}
        >
          {value}
        </Text>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[styles.watchMetricLabel, { color: theme.text?.secondary ?? "#aaa", marginBottom: 1 }]}
        >
          {label}
        </Text>
      </View>
      {detail ? (
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[styles.watchMetricDetail, { color: theme.text?.muted ?? "#666" }]}
        >
          {detail}
        </Text>
      ) : null}
    </View>
  </View>
);



const SharedListGridCard = memo(function SharedListGridCard({
  listName,
  items,
  theme,
  getTmdbUrl,
  compact = false,
  onPress,
  style,
}) {
  const meta = LIST_META[listName];
  const accentColor = meta?.color ?? theme.colors?.orange ?? theme.accent;
  const posterItems = [items?.[0], items?.[1], items?.[2]];
  const Container = onPress ? TouchableOpacity : View;
  const containerProps = onPress ? { activeOpacity: 0.88, onPress } : {};

  const renderPosterSlot = (item, idx, extraStyle) => (
    <View
      key={`${listName}-poster-${idx}`}
      style={[
        styles.sharedPosterSlot,
        compact && styles.sharedPosterSlotCompact,
        extraStyle,
        { backgroundColor: theme.primary ?? "#111" },
      ]}
    >
      {item?.imagePath ? (
        <Image
          source={{ uri: getTmdbUrl(item.imagePath, "poster", compact ? 154 : 200) }}
          style={styles.sharedPosterImage}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={`shared-${listName}-${item.type}-${item.id}-${idx}`}
        />
      ) : (
        <Ionicons name="image-outline" size={compact ? 14 : 17} color={theme.text?.muted ?? "#555"} />
      )}
    </View>
  );

  return (
    <Container
      {...containerProps}
      style={[
        styles.sharedListGridCard,
        compact && styles.sharedListGridCardCompact,
        style,
        {
          backgroundColor: theme.secondary,
          borderColor: theme.border ?? "rgba(255,255,255,0.08)",
        },
      ]}
    >
      <View style={[styles.sharedPosterStrip, compact && styles.sharedPosterStripCompact]}>
        {renderPosterSlot(posterItems[0], 0, styles.sharedPosterMainSlot)}
        <View style={styles.sharedPosterSideColumn}>
          {renderPosterSlot(posterItems[1], 1)}
          {renderPosterSlot(posterItems[2], 2)}
        </View>
      </View>

      <View style={styles.sharedListInfoRow}>
        <View style={[styles.sharedListIcon, { backgroundColor: accentColor + "20" }]}>
          {meta ? (
            <ListIcon name={meta.icon} iconLib={meta.iconLib} color={accentColor} size={compact ? 12 : 14} />
          ) : (
            <Ionicons name="grid" size={compact ? 12 : 14} color={accentColor} />
          )}
        </View>
        <Text
          allowFontScaling={false}
          numberOfLines={2}
          style={[
            styles.sharedListName,
            compact && styles.sharedListNameCompact,
            { color: theme.text?.primary ?? "#fff" },
          ]}
        >
          {meta?.label ?? listName}
        </Text>
      </View>

      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[styles.sharedListCount, { color: theme.text?.muted ?? "#666" }]}
      >
        {i18nText("autoI18n.item_count", "{{count}} içerik", { count: items?.length ?? 0 })}
      </Text>
    </Container>
  );
});

const SharedListMediaCard = memo(function SharedListMediaCard({ item, theme, getTmdbUrl, onPress }) {
  const isMovie = item?.type === "movie";
  const title = item?.name || item?.title || item?.originalName || item?.original_title || item?.id || "";

  return (
    <TouchableOpacity
      activeOpacity={0.86}
      onPress={onPress}
      style={[
        styles.sharedMediaPoster,
        {
          backgroundColor: theme.secondary ?? "#111",
          borderColor: theme.border ?? "rgba(255,255,255,0.08)",
          borderWidth: 1,
        },
      ]}
    >
      {item?.imagePath ? (
        <Image
          source={{ uri: getTmdbUrl(item.imagePath, "poster", 200) }}
          style={styles.sharedMediaPosterImg}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={`shared-media-${item.type}-${item.id}`}
        />
      ) : (
        <Ionicons name="image-outline" size={32} color={theme.text?.muted ?? "#555"} />
      )}
      
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.7)", "rgba(0,0,0,0.95)"]}
        locations={[0, 0.6, 1]}
        style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 60, paddingHorizontal: 6, paddingBottom: 8, justifyContent: "flex-end", alignItems: "center" }}
      >
        <Text
          allowFontScaling={false}
          numberOfLines={2}
          style={{ fontSize: 11, lineHeight: 14, fontWeight: "800", color: "#fff", textAlign: "center" }}
        >
          {title}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );
});

// ── Ana ekran ────────────────────────────────────────────────────────────────
export default function FriendProfileScreen({ route, navigation }) {
  const { friendUid, friendName } = route.params || {};
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { avatars } = useProfileUi();
  const { getTmdbUrl } = useImageQualitySettings();
  const { width: windowWidth } = useWindowDimensions();
  const {
    isFriend,
    hasIncomingFrom,
    hasOutgoingTo,
    sendRequest,
    acceptRequest,
    cancelRequest,
    removeFriend,
  } = useFriends();

  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [presence, setPresence] = useState(null);
  const [allLists, setAllLists] = useState(null);
  // Yeni format alt koleksiyonlar — null: henüz çekilmedi
  const [subMovies, setSubMovies] = useState(null);
  const [subShows, setSubShows] = useState(null);
  const [selectedSharedList, setSelectedSharedList] = useState(null);
  const [unfriendModalVisible, setUnfriendModalVisible] = useState(false);

  const friend = isFriend(friendUid);
  const incoming = hasIncomingFrom(friendUid);
  const outgoing = hasOutgoingTo(friendUid);

  // ── Profil dinleyicisi ────────────────────────────────────────────────────
  useEffect(() => {
    if (!friendUid) return;
    const unsub = onSnapshot(
      doc(db, "Users", friendUid),
      (snap) => {
        setProfile(snap.exists() ? snap.data() : null);
        setProfileLoading(false);
      },
      () => setProfileLoading(false),
    );
    return () => unsub();
  }, [friendUid]);

  // ── Presence dinleyicisi (ayrı koleksiyon — Users dokümanı stabil kalır) ──
  useEffect(() => {
    if (!friendUid) return;
    const unsub = subscribeToUserPresence(friendUid, setPresence);
    return () => unsub();
  }, [friendUid]);

  // ── Gizlilik kuralları ────────────────────────────────────────────────────
  const privacy = profile?.privacy || DEFAULT_PRIVACY;
  const canViewProfile =
    privacy.profile === "public" || (privacy.profile === "friends" && friend);
  const canViewLists =
    canViewProfile &&
    (privacy.lists === "public" || (privacy.lists === "friends" && friend));
  const online = isOnlineVisible(presence, privacy, { viewerIsFriend: friend });
  const showPresenceText =
    privacy.onlineStatus === "everyone" ||
    (privacy.onlineStatus === "friends" && friend);

  // ── Liste dinleyicisi (yalnız izin varsa açılır) ──────────────────────────
  useEffect(() => {
    if (!friendUid || !canViewLists) {
      setAllLists(null);
      return;
    }
    const unsub = onSnapshot(doc(db, "Lists", friendUid), (snap) => {
      setAllLists(snap.exists() ? snap.data() : {});
    });
    return () => unsub();
  }, [friendUid, canViewLists]);

  // ── Yeni format alt koleksiyonlar — tek seferlik okuma (listener pahalı) ─
  useEffect(() => {
    if (!friendUid || !canViewLists) {
      setSubMovies(null);
      setSubShows(null);
      return;
    }
    let cancelled = false;
    const fetchSubs = async () => {
      const [movSnap, tvSnap] = await Promise.all([
        getDocs(collection(db, "Lists", friendUid, "watchedMovies")).catch(() => null),
        getDocs(collection(db, "Lists", friendUid, "watchedTv")).catch(() => null),
      ]);
      if (cancelled) return;
      setSubMovies(
        movSnap ? movSnap.docs.map((d) => ({ ...d.data(), id: d.data().id ?? d.id })) : [],
      );
      setSubShows(
        tvSnap ? tvSnap.docs.map((d) => ({ ...d.data(), id: d.data().id ?? d.id })) : [],
      );
    };
    fetchSubs();
    return () => {
      cancelled = true;
    };
  }, [friendUid, canViewLists]);

  // ── İzleme istatistikleri — yeni + eski format birleşimi ─────────────────
  // (ProfileStatsContext ile aynı merge mantığı: subcollection öncelikli,
  //  root-doc array'inde olup subcollection'da olmayanlar eklenir.)
  const stats = useMemo(() => {
    if (!canViewLists || allLists === null || subMovies === null || subShows === null)
      return null;

    const mergeById = (subItems, legacyItems) => {
      const subIds = new Set(subItems.map((i) => i.id));
      return [...subItems, ...legacyItems.filter((i) => !subIds.has(i.id))];
    };

    // Filmler
    const movies = mergeById(
      subMovies,
      (allLists.watchedMovies || []).filter((m) => m.type === "movie"),
    );
    const movieMinutes = movies.reduce((acc, m) => acc + (m.minutes || 0), 0);

    // Diziler — denormalized sayaçlar varsa onları, yoksa seasons array'ini kullan
    const shows = mergeById(subShows, allLists.watchedTv || []);
    const seasonCount = shows.reduce(
      (acc, s) => acc + (s.watchedSeasonCount ?? s.seasons?.length ?? 0),
      0,
    );
    const episodeCount = shows.reduce(
      (acc, s) =>
        acc +
        (s.watchedEpisodeCount ??
          s.seasons?.reduce((sa, se) => sa + (se.episodes?.length || 0), 0) ??
          0),
      0,
    );
    const tvMinutes = shows.reduce(
      (acc, s) =>
        acc +
        (s.totalMinutes ??
          s.seasons?.reduce(
            (sa, se) => sa + (se.episodes?.reduce((ea, e) => ea + (e.episodeMinutes || 0), 0) || 0),
            0,
          ) ??
          0),
      0,
    );

    // Tür analizi: film başına 1, dizi başına izlenen bölüm sayısı kadar ağırlık
    const genreCounts = {};
    movies.forEach((m) =>
      (m.genres || []).forEach((g) => {
        if (g) genreCounts[g] = (genreCounts[g] || 0) + 1;
      }),
    );
    shows.forEach((s) => {
      const weight =
        s.watchedEpisodeCount ??
        s.seasons?.reduce((sa, se) => sa + (se.episodes?.length || 0), 0) ??
        1;
      (s.genres || []).forEach((g) => {
        if (g) genreCounts[g] = (genreCounts[g] || 0) + weight;
      });
    });
    const topGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      movieCount: movies.length,
      movieMinutes,
      showCount: shows.length,
      seasonCount,
      episodeCount,
      tvMinutes,
      totalMinutes: movieMinutes + tvMinutes,
      topGenres,
    };
  }, [canViewLists, allLists, subMovies, subShows]);

  // ── Görünür listeler: listVisible haritası + sabit liste sıralaması ──────
  const visibleLists = useMemo(() => {
    if (!allLists || !profile) return [];
    const rawVisible = profile.listVisible;
    // Legacy array formatı da desteklenir (FriendsListScreen ile aynı mantık)
    const visibleNames = Array.isArray(rawVisible)
      ? rawVisible.filter((m) => Object.values(m)[0] === true).map((m) => Object.keys(m)[0])
      : Object.entries(rawVisible || {}).filter(([, v]) => v === true).map(([k]) => k);

    const entries = Object.entries(allLists).filter(
      ([name, items]) => visibleNames.includes(name) && Array.isArray(items),
    );
    return [
      ...PROTECTED_LISTS.map((n) => entries.find(([ln]) => ln === n)).filter(Boolean),
      ...entries
        .filter(([ln]) => !PROTECTED_LISTS.includes(ln))
        .sort((a, b) => a[0].localeCompare(b[0], language === "tr" ? "tr" : "en")),
    ];
  }, [allLists, profile, language]);

  const totalItems = useMemo(
    () => visibleLists.reduce((acc, [, items]) => acc + items.length, 0),
    [visibleLists],
  );
  const sharedListCardWidth = useMemo(
    () => Math.max(96, Math.floor((windowWidth - 32 - 28 - 18) / 3)),
    [windowWidth],
  );

  // ── İlişki butonu ─────────────────────────────────────────────────────────
  const confirmUnfriend = useCallback(() => setUnfriendModalVisible(true), []);
  const handleRemoveFriend = useCallback(() => {
    setUnfriendModalVisible(false);
    removeFriend(friendUid);
  }, [friendUid, removeFriend]);

  const relationship = friend
    ? { label: i18nText("autoI18n.arkadassiniz", "Arkadaşsınız"), icon: "checkmark-circle", color: theme.colors?.green ?? "#29b864", onPress: confirmUnfriend }
    : outgoing
      ? { label: i18nText("autoI18n.istek_gonderildi", "İstek Gönderildi"), icon: "time-outline", color: "#ff9650", onPress: () => cancelRequest(friendUid) }
      : incoming
        ? { label: i18nText("autoI18n.istegi_kabul_et", "İsteği Kabul Et"), icon: "person-add", color: theme.accent, onPress: () => acceptRequest(friendUid) }
        : { label: i18nText("autoI18n.arkadas_ekle", "Arkadaş Ekle"), icon: "person-add-outline", color: theme.accent, onPress: () => sendRequest(friendUid) };

  const displayName = profile?.displayName || friendName || "";
  const lastSeenText = formatLastSeen(presence);
  const memberSince = formatMemberSince(profile?.createdAt, language);
  const selectedListName = selectedSharedList?.[0] ?? "";
  const selectedListItems = selectedSharedList?.[1] ?? [];
  const selectedListMeta = LIST_META[selectedListName];
  const selectedListTitle = selectedListMeta?.label ?? selectedListName;

  // ── Yükleniyor / bulunamadı ───────────────────────────────────────────────
  if (profileLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.center, { backgroundColor: theme.primary }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </SafeAreaView>
    );
  }
  if (!profile) {
    return (
      <SafeAreaView style={[styles.container, styles.center, { backgroundColor: theme.primary }]}>
        <Ionicons name="person-outline" size={52} color={theme.text?.muted ?? "#444"} />
        <Text style={[styles.emptyText, { color: theme.text?.secondary ?? "#aaa" }]}>{i18nText("autoI18n.kullanici_bulunamadi", "Kullanıcı bulunamadı")}</Text>
        <BackButton />
      </SafeAreaView>
    );
  }

  const green = theme.colors?.green ?? "#29b864";
  const blue = theme.colors?.blue ?? "#64b4ff";
  const orange = theme.colors?.orange ?? "#ff9650";
  const movieShare = stats?.totalMinutes ? Math.round((stats.movieMinutes / stats.totalMinutes) * 100) : 0;
  const tvShare = stats?.totalMinutes ? 100 - movieShare : 0;
  const topGenreMax = stats?.topGenres?.[0]?.[1] || 1;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.primary }]}>
      <ScreenDecor iconOpacity={0.3} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ── Üst bilgi kartı ──────────────────────────────────────────────── */}
        <View style={[styles.headerCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          <LinearGradient
            pointerEvents="none"
            colors={[theme.accent + "24", "transparent"]}
            style={styles.headerGlow}
          />

          <View style={styles.profileTopRow}>
            <View style={styles.avatarBlock}>
              <View style={[styles.avatarWrapper, { borderColor: theme.accent + "66" }]}>
                {avatars?.[profile.avatarIndex] ? (
                  <RNImage source={avatars[profile.avatarIndex]} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: theme.primary }]}>
                    <Ionicons name="person" size={34} color={theme.text?.muted ?? "#555"} />
                  </View>
                )}
              </View>
              {online && <View style={[styles.onlineDot, { borderColor: theme.secondary }]} />}
            </View>

            <View style={styles.profileIdentity}>
              <Text
                allowFontScaling={false}
                // Kullanıcının kendi yazdığı ad — ProfileScreen'deki eşiyle
                // aynı gerekçeyle başlık fontuna girmez (bkz. utils/typographyRoles.js).
                fontRole="body"
                style={[styles.displayName, { color: theme.text?.primary ?? "#fff" }]}
                numberOfLines={2}
              >
                {displayName || i18nText("autoI18n.isimsiz_kullanici", "İsimsiz kullanıcı")}
              </Text>
              <View style={styles.identityMetaRow}>
                {profile.username ? (
                  <Text
                    allowFontScaling={false}
                    style={[styles.username, { color: theme.text?.secondary ?? "#aaa" }]}
                    numberOfLines={1}
                  >
                    @{profile.username}
                  </Text>
                ) : null}

                {showPresenceText && (
                  <View style={styles.presenceInline}>
                    <View style={[styles.presenceTinyDot, { backgroundColor: online ? green : (theme.text?.muted ?? "#666") }]} />
                    <Text
                      allowFontScaling={false}
                      numberOfLines={1}
                      style={[styles.presenceText, { color: online ? green : (theme.text?.muted ?? "#666") }]}
                    >
                      {online
                        ? i18nText("autoI18n.cevrimici", "Çevrimiçi")
                        : lastSeenText
                          ? lastSeenText
                          : i18nText("autoI18n.cevrimdisi", "Çevrimdışı")}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.compactActionsRow}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={relationship.onPress}
                  style={[
                    styles.compactActionBtn,
                    {
                      backgroundColor: relationship.color + "1A",
                      borderColor: relationship.color + "44",
                    },
                  ]}
                >
                  <Ionicons name={relationship.icon} size={14} color={relationship.color} />
                  <Text
                    allowFontScaling={false}
                    numberOfLines={1}
                    style={[styles.compactActionText, { color: relationship.color }]}
                  >
                    {relationship.label}
                  </Text>
                </TouchableOpacity>

                {friend && (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() =>
                      navigation.navigate("ChatScreen", { friendUid, friendName: displayName })
                    }
                    style={[styles.compactMessageBtn, { backgroundColor: theme.accent }]}
                    accessibilityLabel={i18nText("autoI18n.mesaj_2", "Mesaj")}
                  >
                    <Ionicons name="chatbubble-ellipses" size={15} color="#fff" />
                    <Text allowFontScaling={false} style={styles.compactMessageText}>
                      {i18nText("autoI18n.mesaj_2", "Mesaj")}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          {canViewProfile && profile.bio ? (
            <View style={[styles.bioBlock, { borderColor: theme.border ?? "rgba(255,255,255,0.08)" }]}>
              <Ionicons name="chatbox-ellipses-outline" size={14} color={theme.accent} />
              <Text style={[styles.bio, { color: theme.text?.secondary ?? "#aaa" }]} numberOfLines={2}>
                {profile.bio}
              </Text>
            </View>
          ) : null}

          {canViewProfile && memberSince && (
            <View style={styles.profileMetaRow}>
              <View
                style={[
                  styles.memberSinceRow,
                  {
                    backgroundColor: theme.primary ?? "#111",
                    borderColor: theme.border ?? "rgba(255,255,255,0.08)",
                  },
                ]}
              >
                <Ionicons name="calendar-outline" size={12} color={theme.text?.muted ?? "#666"} />
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={[styles.memberSinceText, { color: theme.text?.muted ?? "#666" }]}
                >
                  {memberSince} {i18nText("autoI18n.tarihinden_beri_uye", "tarihinden beri üye")}
                </Text>
              </View>
            </View>
          )}

          {canViewProfile && (
            <View style={styles.profileStatsGrid}>
              <ProfileMetricPill
                icon="people-outline"
                label={i18nText("autoI18n.arkadas", "Arkadaş")}
                value={profile.friendsCount ?? 0}
                color={green}
                theme={theme}
              />
              <ProfileMetricPill
                icon="newspaper-outline"
                label={i18nText("autoI18n.gonderi", "Gönderi")}
                value={profile.postsCount ?? 0}
                color={orange}
                theme={theme}
              />
              <ProfileMetricPill
                icon="albums-outline"
                label={i18nText("autoI18n.icerik", "İçerik")}
                value={canViewLists ? totalItems : "-"}
                color={blue}
                theme={theme}
              />
            </View>
          )}

        </View>

        {/* ── İçerik: gizlilik kilitleri / istatistik + listeler ───────────── */}
        {!canViewProfile ? (
          <View style={styles.lockBox}>
            <Ionicons name="lock-closed-outline" size={40} color={theme.text?.muted ?? "#555"} />
            <Text style={[styles.lockText, { color: theme.text?.secondary ?? "#aaa" }]}>{i18nText("autoI18n.bu_profil_gizli", "Bu profil gizli")}</Text>
          </View>
        ) : !canViewLists ? (
          <View style={styles.lockBox}>
            <Ionicons name="lock-closed-outline" size={40} color={theme.text?.muted ?? "#555"} />
            <Text style={[styles.lockText, { color: theme.text?.secondary ?? "#aaa" }]}>{i18nText("autoI18n.izleme_verileri", "İzleme verileri")} {privacy.lists === "friends" ? i18nText("autoI18n.yalnizca_arkadaslara_acik", "yalnızca arkadaşlara açık") : i18nText("autoI18n.gizli", "gizli")}
            </Text>
          </View>
        ) : (
          <>
            {/* ── İzleme İstatistikleri ───────────────────────────────────── */}
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionAccent, { backgroundColor: theme.accent }]} />
              <Text allowFontScaling={false} style={[styles.sectionTitle, { color: theme.text?.primary ?? "#fff" }]}>{i18nText("autoI18n.izleme_istatistikleri", "İzleme İstatistikleri")}</Text>
            </View>

            {stats === null ? (
              <ActivityIndicator size="small" color={theme.accent} style={{ marginVertical: 24 }} />
            ) : (
              <>
                <View style={[styles.watchSummaryCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
                  <View style={styles.watchSummaryTop}>
                    <View style={[styles.watchSummaryIcon, { backgroundColor: theme.accent + "20" }]}>
                      <Ionicons name="time-outline" size={22} color={theme.accent} />
                    </View>
                    <View style={styles.watchSummaryCopy}>
                      <Text allowFontScaling={false} style={[styles.watchSummaryLabel, { color: theme.text?.muted ?? "#666" }]}>
                        {i18nText("autoI18n.toplam_izleme_suresi", "Toplam izleme süresi")}
                      </Text>
                      <Text allowFontScaling={false} numberOfLines={1} fontRole="numeric" style={[styles.watchSummaryValue, { color: theme.text?.primary ?? "#fff" }]}>
                        {formatDuration(stats.totalMinutes)}
                      </Text>
                    </View>
                    <View style={[styles.watchMinuteBadge, { backgroundColor: theme.primary ?? "#111", borderColor: theme.border ?? "rgba(255,255,255,0.08)" }]}>
                      <Text allowFontScaling={false} numberOfLines={1} style={[styles.watchMinuteBadgeText, { color: theme.text?.secondary ?? "#aaa" }]}>
                        {stats.totalMinutes.toLocaleString(language === "tr" ? "tr-TR" : "en-US")} {i18nText("autoI18n.dakika", "dk")}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.watchSplitLabels}>
                    <View style={styles.watchSplitItem}>
                      <View style={[styles.watchSplitDot, { backgroundColor: blue }]} />
                      <Text allowFontScaling={false} numberOfLines={1} style={[styles.watchSplitText, { color: theme.text?.secondary ?? "#aaa" }]}>
                        {i18nText("autoI18n.film", "Film")} {movieShare}%
                      </Text>
                    </View>
                    <View style={styles.watchSplitItem}>
                      <View style={[styles.watchSplitDot, { backgroundColor: green }]} />
                      <Text allowFontScaling={false} numberOfLines={1} style={[styles.watchSplitText, { color: theme.text?.secondary ?? "#aaa" }]}>
                        {i18nText("autoI18n.dizi", "Dizi")} {tvShare}%
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.watchBarTrack, { backgroundColor: theme.primary ?? "#111" }]}>
                    <View style={[styles.watchBarMovie, { width: `${movieShare}%`, backgroundColor: blue }]} />
                    <View style={[styles.watchBarTv, { width: `${tvShare}%`, backgroundColor: green }]} />
                  </View>
                </View>

                <View style={styles.watchMetricGrid}>
                  <WatchMetricTile
                    icon="movie-outline"
                    iconLib="mci"
                    label={i18nText("autoI18n.film", "Film")}
                    value={stats.movieCount}
                    detail={formatDuration(stats.movieMinutes)}
                    color={blue}
                    theme={theme}
                  />
                  <WatchMetricTile
                    icon="tv"
                    iconLib="feather"
                    label={i18nText("autoI18n.dizi", "Dizi")}
                    value={stats.showCount}
                    detail={formatDuration(stats.tvMinutes)}
                    color={green}
                    theme={theme}
                  />
                  <WatchMetricTile
                    icon="layers-outline"
                    iconLib="ion"
                    label={i18nText("autoI18n.sezon", "Sezon")}
                    value={stats.seasonCount}
                    detail={i18nText("autoI18n.izlenen", "İzlenen")}
                    color={orange}
                    theme={theme}
                  />
                  <WatchMetricTile
                    icon="play-circle-outline"
                    iconLib="ion"
                    label={i18nText("autoI18n.bolum_2", "Bölüm")}
                    value={stats.episodeCount}
                    detail={i18nText("autoI18n.toplam", "Toplam")}
                    color={theme.accent}
                    theme={theme}
                  />
                </View>

                {stats.topGenres.length > 0 && (
                  <View style={[styles.genresBlock, { backgroundColor: theme.secondary, borderColor: theme.border ?? "rgba(255,255,255,0.08)" }]}>
                    <View style={styles.genresHeader}>
                      <Text allowFontScaling={false} style={[styles.genresTitle, { color: theme.text?.primary ?? "#fff" }]}>{i18nText("autoI18n.en_cok_izlenen_turler", "En Çok İzlenen Türler")}</Text>
                      <Ionicons name="stats-chart-outline" size={15} color={orange} />
                    </View>
                    {(() => {
                      const totalTopCount = stats.topGenres.reduce((acc, [, c]) => acc + c, 0);
                      const chartColors = [
                        orange,
                        blue,
                        green,
                        theme.accent ?? "#8847ff",
                        "#e4ae39",
                      ];
                      return (
                        <View style={{ marginTop: 6 }}>
                          <View style={{ flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden", backgroundColor: theme.primary ?? "#111" }}>
                            {stats.topGenres.map(([genre, count], idx) => {
                              const pct = (count / Math.max(totalTopCount, 1)) * 100;
                              return (
                                <View key={genre} style={{ width: `${pct}%`, backgroundColor: chartColors[idx % chartColors.length] }} />
                              );
                            })}
                          </View>
                          <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 14, gap: 12 }}>
                            {stats.topGenres.map(([genre, count], idx) => (
                              <View key={genre} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                                <Text allowFontScaling={false} style={{ color: chartColors[idx % chartColors.length], fontSize: 12, fontWeight: "800" }}>{idx + 1}.</Text>
                                <Text allowFontScaling={false} style={{ color: theme.text?.primary ?? "#fff", fontSize: 11.5, fontWeight: "600" }}>{genre}</Text>
                                <Text allowFontScaling={false} style={{ color: theme.text?.muted ?? "#666", fontSize: 11, fontWeight: "700" }}>{count}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      );
                    })()}
                  </View>
                )}
              </>
            )}

            {/* ── Paylaşılan Listeler ─────────────────────────────────────── */}
            {allLists === null ? (
              <ActivityIndicator size="small" color={theme.accent} style={{ marginTop: 30 }} />
            ) : visibleLists.length === 0 ? (
              <View style={styles.lockBox}>
                <Ionicons name="albums-outline" size={40} color={theme.text?.muted ?? "#555"} />
                <Text style={[styles.lockText, { color: theme.text?.secondary ?? "#aaa" }]}>{i18nText("autoI18n.paylasilan_liste_yok", "Paylaşılan liste yok")}</Text>
              </View>
            ) : (
              <>
                <View style={styles.sharedListsPanel}>
                  <View style={styles.sharedListsPanelHeader}>
                    <View style={styles.sharedListsTitleWrap}>
                      <View style={[styles.sectionAccent, { backgroundColor: theme.accent }]} />
                      <View style={styles.sharedListsTitleText}>
                        <Text allowFontScaling={false} style={[styles.sectionTitle, { color: theme.text?.primary ?? "#fff" }]}>
                          {i18nText("autoI18n.paylasilan_listeler", "Paylaşılan Listeler")}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.openListsButton, { backgroundColor: theme.primary ?? "#111", borderColor: theme.border ?? "rgba(255,255,255,0.08)" }]}>
                      <Text allowFontScaling={false} style={[styles.openListsButtonText, { color: theme.text?.secondary ?? "#aaa" }]}>
                        {visibleLists.length}
                      </Text>
                      <Ionicons name="grid-outline" size={14} color={theme.accent} />
                    </View>
                  </View>

                  <FlatList
                    horizontal
                    data={visibleLists}
                    keyExtractor={([listName]) => listName}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.sharedListsPreviewContent}
                    renderItem={({ item: [listName, items] }) => (
                      <SharedListGridCard
                        listName={listName}
                        items={items}
                        theme={theme}
                        getTmdbUrl={getTmdbUrl}
                        onPress={() => setSelectedSharedList([listName, items])}
                        style={{ width: sharedListCardWidth, flex: 0 }}
                      />
                    )}
                  />

                </View>
              </>
            )}
          </>
        )}
      </ScrollView>

      <BottomSheetModal
        visible={!!selectedSharedList}
        onClose={() => setSelectedSharedList(null)}
        intensity={35}
        dimColor="rgba(0,0,0,0.4)"
        sheetStyle={[
          styles.listModalSheet,
          {
            backgroundColor: theme.secondary,
            borderColor: theme.border ?? "rgba(255,255,255,0.08)",
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            padding: 15,
            paddingBottom: 0,
            borderBottomWidth: 0,
          },
        ]}
      >
            <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: theme.text?.muted ?? "#666", alignSelf: "center", marginBottom: 20 }} />
            <View style={[styles.modalHeaderRow, { marginBottom: 20 }]}>
              <View style={styles.modalTitleGroup}>
                <Text allowFontScaling={false} style={[styles.modalTitle, { color: theme.text?.primary ?? "#fff", fontSize: 22 }]}>
                  {selectedListTitle}
                </Text>
                <Text allowFontScaling={false} style={[styles.modalSubtitle, { color: theme.accent ?? "#aaa", fontSize: 13, fontWeight: "800", marginTop: 4 }]}>
                  {i18nText("autoI18n.item_count", "{{count}} içerik", { count: selectedListItems.length })}
                </Text>
              </View>
              <Pressable
                onPress={() => setSelectedSharedList(null)}
                hitSlop={10}
                style={[styles.modalCloseBtn, { backgroundColor: theme.primary ?? "#111", borderColor: theme.border ?? "rgba(255,255,255,0.08)", borderRadius: 18, width: 44, height: 44 }]}
              >
                <Ionicons name="close" size={22} color={theme.text?.primary ?? "#fff"} />
              </Pressable>
            </View>

            {selectedListItems.length === 0 ? (
              <View style={styles.modalEmptyState}>
                <Ionicons name="albums-outline" size={34} color={theme.text?.muted ?? "#555"} />
                <Text style={[styles.lockText, { color: theme.text?.secondary ?? "#aaa" }]}>
                  {i18nText("autoI18n.bu_liste_bos_2", "Bu liste boş")}
                </Text>
              </View>
            ) : (
              <FlatList
                data={selectedListItems}
                keyExtractor={(item, index) => `${item?.type ?? "item"}-${item?.id ?? index}`}
                numColumns={3}
                showsVerticalScrollIndicator={false}
                columnWrapperStyle={styles.sharedListsModalRow}
                contentContainerStyle={styles.sharedListsModalContent}
                renderItem={({ item }) => (
                  <View style={styles.sharedListModalCell}>
                    <SharedListMediaCard
                      item={item}
                      theme={theme}
                      getTmdbUrl={getTmdbUrl}
                      onPress={() => {
                        if (!item?.id) return;
                        setSelectedSharedList(null);
                        navigation.navigate(
                          item?.type === "movie" ? "MovieDetails" : "TvShowsDetails",
                          { id: item?.id },
                        );
                      }}
                    />
                  </View>
                )}
              />
            )}
      </BottomSheetModal>

      <Modal
        visible={unfriendModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setUnfriendModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setUnfriendModalVisible(false)} />
          <View
            style={[
              styles.confirmDialog,
              {
                backgroundColor: theme.secondary,
                borderColor: theme.border ?? "rgba(255,255,255,0.08)",
              },
            ]}
          >
            <View style={[styles.confirmIconWrap, { backgroundColor: "#ef444422" }]}>
              <Ionicons name="person-remove-outline" size={28} color="#ef4444" />
            </View>
            <Text allowFontScaling={false} style={[styles.confirmTitle, { color: theme.text?.primary ?? "#fff" }]}>
              {i18nText("autoI18n.arkadasliktan_cikar", "Arkadaşlıktan çıkar")}
            </Text>
            <Text style={[styles.confirmMessage, { color: theme.text?.secondary ?? "#aaa" }]}>
              {i18nText("autoI18n.confirm_unfriend_user", "{{name}} arkadaş listenden çıkarılsın mı?", {
                name: displayName || i18nText("autoI18n.bu_kullanici", "Bu kullanıcı"),
              })}
            </Text>

            <View style={styles.confirmActions}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setUnfriendModalVisible(false)}
                style={[styles.confirmBtn, { backgroundColor: theme.primary ?? "#111", borderColor: theme.border ?? "rgba(255,255,255,0.08)" }]}
              >
                <Text allowFontScaling={false} numberOfLines={1} style={[styles.confirmBtnText, { color: theme.text?.primary ?? "#fff" }]}>
                  {i18nText("autoI18n.iptal", "İptal")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleRemoveFriend}
                style={[styles.confirmBtn, styles.confirmDangerBtn]}
              >
                <Ionicons name="person-remove-outline" size={15} color="#fff" />
                <Text allowFontScaling={false} numberOfLines={1} style={[styles.confirmBtnText, { color: "#fff" }]}>
                  {i18nText("autoI18n.cikar", "Çıkar")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <BackButton />
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: "center", alignItems: "center", gap: 14 },
  // paddingTop: şeffaf header'daki geri butonunun kartla çakışmaması için
  scrollContent: { paddingHorizontal: 16, paddingTop: 44, paddingBottom: 40 },
  emptyText: { fontSize: 14, textAlign: "center" },

  // ── Üst kart ───────────────────────────────────────────────────────────────
  headerCard: {
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "stretch",
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 16,
    overflow: "hidden",
  },
  headerGlow: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 92,
  },
  profileTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarBlock: { position: "relative" },
  avatarWrapper: {
    width: 68,
    height: 68,
    borderRadius: 23,
    borderWidth: 2,
    overflow: "hidden",
  },
  avatar: { width: "100%", height: "100%", borderRadius: 21 },
  avatarPlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  onlineDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#29b864",
    borderWidth: 2.5,
  },
  profileIdentity: {
    flex: 1,
    minWidth: 0,
  },
  displayName: { fontSize: 18, fontWeight: "800", letterSpacing: -0.2, lineHeight: 22 },
  identityMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
    minWidth: 0,
  },
  username: { fontSize: 12, flexShrink: 1 },
  presenceInline: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 },
  presenceTinyDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  presenceText: { fontSize: 10.5, fontWeight: "700", flexShrink: 1 },
  compactActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 8,
  },
  compactActionBtn: {
    flex: 1,
    minWidth: 0,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  compactActionText: { fontSize: 10.5, fontWeight: "800", flexShrink: 1 },
  compactMessageBtn: {
    height: 32,
    borderRadius: 10,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  compactMessageText: { color: "#fff", fontSize: 10.5, fontWeight: "800" },
  bioBlock: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    marginTop: 11,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  bio: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  profileMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 9,
  },
  memberSinceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 11,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    maxWidth: "100%",
  },
  memberSinceText: { fontSize: 10.5, fontWeight: "700", flexShrink: 1 },

  profileStatsGrid: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
    marginTop: 11,
  },
  profileMetricPill: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 15,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  profileMetricIcon: {
    width: 26,
    height: 26,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  profileMetricValue: { fontSize: 16, fontWeight: "900" },
  profileMetricLabel: { fontSize: 10.5, fontWeight: "700", marginTop: 2 },

  // ── Bölüm başlıkları ───────────────────────────────────────────────────────
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  sectionAccent: { width: 4, height: 18, borderRadius: 2 },
  sectionTitle: { fontSize: 17, fontWeight: "800", letterSpacing: 0, flex: 1 },

  // ── İstatistikler ──────────────────────────────────────────────────────────
  watchSummaryCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 15,
    marginBottom: 12,
  },
  watchSummaryTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  watchSummaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  watchSummaryCopy: {
    flex: 1,
    minWidth: 0,
  },
  watchSummaryLabel: { fontSize: 11.5, fontWeight: "700", marginBottom: 2 },
  watchSummaryValue: { fontSize: 21, fontWeight: "900", letterSpacing: 0 },
  watchMinuteBadge: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 6,
    maxWidth: 96,
  },
  watchMinuteBadgeText: { fontSize: 11, fontWeight: "800" },
  watchSplitLabels: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 14,
  },
  watchSplitItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  watchSplitDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  watchSplitText: { fontSize: 11.5, fontWeight: "700", flexShrink: 1 },
  watchBarTrack: {
    height: 9,
    borderRadius: 10,
    overflow: "hidden",
    flexDirection: "row",
    marginTop: 8,
  },
  watchBarMovie: { height: "100%" },
  watchBarTv: { height: "100%" },
  watchMetricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
  },
  watchMetricTile: {
    width: "48%",
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  watchMetricValue: { fontSize: 16, fontWeight: "900" },
  watchMetricLabel: { fontSize: 11, fontWeight: "700" },
  watchMetricDetail: { fontSize: 10, fontWeight: "600", marginTop: 2 },

  genresBlock: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 22,
  },
  genresHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 12,
  },
  genresTitle: { fontSize: 14, fontWeight: "800" },


  // ── Listeler ──────────────────────────────────────────────────────────────
  sharedListsPanel: {
    marginBottom: 16,
  },
  sharedListsPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },
  sharedListsTitleWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sharedListsTitleText: {
    flex: 1,
    minWidth: 0,
  },
  sharedListsSubtitle: { fontSize: 11.5, fontWeight: "700", marginTop: 2 },
  openListsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  openListsButtonText: { fontSize: 12, fontWeight: "900" },
  sharedListsPreviewContent: {
    gap: 9,
    paddingRight: 2,
  },
  sharedListGridCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: 15,
    borderWidth: 1,
    padding: 8,
  },
  sharedListGridCardCompact: {
    borderRadius: 13,
    padding: 6,
  },
  sharedPosterStrip: {
    height: 86,
    flexDirection: "row",
    gap: 3,
    marginBottom: 8,
  },
  sharedPosterStripCompact: {
    height: 64,
    marginBottom: 6,
  },
  sharedPosterSlot: {
    flex: 1,
    borderRadius: 8,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  sharedPosterMainSlot: {
    flex: 1.35,
  },
  sharedPosterSideColumn: {
    flex: 0.72,
    gap: 3,
  },
  sharedPosterSlotCompact: {
    borderRadius: 7,
  },
  sharedPosterImage: { width: "100%", height: "100%" },
  sharedListInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  sharedListIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  sharedListName: {
    flex: 1,
    minWidth: 0,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: "800",
  },
  sharedListNameCompact: {
    fontSize: 10,
    lineHeight: 13,
  },
  sharedListCount: {
    fontSize: 10,
    fontWeight: "700",
    marginTop: 5,
  },
  sharedListsHintRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  sharedListsHintText: { fontSize: 12, fontWeight: "800", flexShrink: 1 },
  sharedMediaPoster: {
    width: "100%",
    aspectRatio: 2 / 3,
    borderRadius: 13,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  sharedMediaPosterImg: { width: "100%", height: "100%" },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  listModalSheet: {
    width: "100%",
    maxHeight: "85%",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 24,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  modalTitleGroup: {
    flex: 1,
    minWidth: 0,
  },
  modalTitle: { fontSize: 18, fontWeight: "900", letterSpacing: 0 },
  modalSubtitle: { fontSize: 12, fontWeight: "700", marginTop: 3 },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sharedListsModalContent: {
    paddingBottom: 4,
    gap: 10,
  },
  sharedListsModalRow: {
    justifyContent: "flex-start",
    gap: "2.3%",
  },
  sharedListModalCell: {
    width: "31.8%",
  },
  modalEmptyState: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 180,
  },
  confirmDialog: {
    width: "100%",
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    alignItems: "center",
  },
  confirmIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 13,
  },
  confirmTitle: { fontSize: 18, fontWeight: "900", textAlign: "center" },
  confirmMessage: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 8,
  },
  confirmActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 18,
    alignSelf: "stretch",
  },
  confirmBtn: {
    flex: 1,
    minWidth: 0,
    minHeight: 46,
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 10,
  },
  confirmDangerBtn: {
    backgroundColor: "#ef4444",
    borderColor: "#ef4444",
  },
  confirmBtnText: { fontSize: 13, fontWeight: "900", flexShrink: 1, textAlign: "center" },

  lockBox: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 36,
  },
  lockText: { fontSize: 13.5, textAlign: "center" },
});
