// screens/tabs/profile/FriendProfileScreen.js
//
// Arkadaş profil ekranı: kullanıcı bilgileri (avatar, isim, bio,
// sayaçlar, katılım tarihi) + izleme istatistikleri (film/dizi süreleri, tür
// analizi) + paylaşmayı seçtiği listeler (Users/{uid}.listVisible haritası).
// privacy.profile / privacy.lists ayarlarına saygı duyar. Çevrimiçi durumu / son görülme
// 1 Kas 2026'da kaldırıldı (kullanıcı kararı).
//
// Veri kaynakları:
//   Users/{uid}                        → profil + privacy + listVisible
//   Lists/{uid}                        → eski format listeler + özel listeler
//   Lists/{uid}/watchedMovies          → yeni format filmler (tek seferlik)
//   Lists/{uid}/watchedTv              → yeni format diziler (tek seferlik)

import { intlLocaleOf } from "../../../utils/appLanguages";
import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  FlatList,
  TouchableOpacity,
  Modal,
  Pressable,
  useWindowDimensions,
} from "react-native";
import LensLoader from "../../../components/LensLoader";
import { Image } from "expo-image";
import { doc, collection, onSnapshot, getDocs } from "firebase/firestore";
import { usePreventRemove } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
// Ekran kökü: Premium şeridi yüzerken üst boşluğu ona göre büyür.
import SafeAreaView from "@components/common/ScreenSafeAreaView";
import BottomSheetModal from "@components/common/BottomSheetModal";
import ConfirmSheet from "@components/common/ConfirmSheet";
import GlassCloseButton from "@components/common/GlassCloseButton";
import GlassIconButton from "@components/common/GlassIconButton";
import GlassPillButton from "@components/common/GlassPillButton";
import Ionicons from "@expo/vector-icons/Ionicons";
import { db } from "../../../firebase";
import Toast from "@components/AppToast";
import { useWindowSafeAreaInsets } from "../../../context/ScreenInsetsContext";
import { useTheme } from "../../../context/ThemeContext";
import { useAuth } from "../../../context/AuthContext";
import { getAvatarSource, isTmdbPhotoUrl } from "../../../utils/avatars";
import { normalizePhotoPerson } from "../../../utils/avatarPhotos";
import { readListCoverStyle } from "../../../utils/listCoverStyle";
import { useFriends } from "../../../context/FriendsContext";
import ReportReasonSheet from "../../../components/moderation/ReportReasonSheet";
import { reportUser } from "../../../services/reportService";
import { useProfileUi } from "../../../context/ProfileUiContext";
import {
  useImageQualitySettings,
  useListLayoutSettings,
} from "../../../context/AppSettingsContext";
import ListCovers from "../../../components/lists/ListCovers";
import { getRailCardWidth, RAIL_CARD_H, RAIL_COVER_H, RAIL_CARD_PADDING } from "./ProfileLists";
import { sortItemsByListOrder } from "../../../utils/listOrder";
import { getListAccent, getListIcon } from "../../../utils/listAppearance";
import { PosterActivityBadge } from "@components/PosterActivityBadge";
import { buildActivityFromRoot } from "../../../utils/mediaActivityIndex";
import { useLanguage } from "../../../context/LanguageContext";
import { DEFAULT_PRIVACY } from "../../../services/userService";
import { subscribeSocialLinks } from "../../../services/socialLinksService";
import { listsRootStamp, readFriendLists, writeFriendLists } from "../../../utils/friendListsCache";
import ScreenDecor from "../../../components/ScreenDecor";
import SaveSharedListModal from "../../../components/modals/SaveSharedListModal";
import AvatarPreviewModal from "../../../components/profile/AvatarPreviewModal";
import PillButton from "../../../components/friends/PillButton";
import {
  ProfileBackdrop,
  ProfileTopBar,
  ProfileHero,
  ProfileStatStrip,
  SectionHeader,
  CountChip,
  WatchStatsCard,
  ProfileNoticeCard,
  ProfilePreviewBanner,
} from "../../../components/friends/FriendProfileSections";
import RatingDistributionCard from "../../../components/profile/RatingDistributionCard";
import ProfileOptionsSheet from "../../../components/friends/ProfileOptionsSheet";
import * as Haptics from "../../../services/hapticsService";
import FavoritesShowcase from "../../../components/favorites/FavoritesShowcase";
import { FriendBadgeShowcase } from "../../../components/badges/BadgeShowcaseCard";
import WatchBadgeDetailModal from "@components/badges/WatchBadgeDetailModal";
import { getFavoritesCopy } from "../../../utils/favoritesCopy";
import { hasAnyFavorites, readProfileFavorites } from "../../../utils/fourFavorites";
import { readProfileShowcaseBadges, resolveShowcaseBadges } from "../../../utils/badgeShowcase";
import { getBadgeShowcaseCopy } from "../../../utils/badgeShowcaseCopy";
import { Keys, get as getStored } from "../../../services/storage";
import { i18nText } from "../../../utils/i18nText";
import { getIdentityBadges } from "../../../components/badges/badgeCatalog";
import { PREMIUM_PLAN, resolveServerPlan } from "../../../utils/premium";
import { listItemToMedia } from "../../../utils/listShare";
import { useMediaQuickActions } from "../../../context/MediaQuickActionsContext";
import { useListStatusContext } from "../../../context/ListStatusContext";
import TasteMatchCard from "../../../components/friends/TasteMatchCard";
import { candidatesToDeckSource, computeTasteMatch, findTogetherCandidates } from "../../../utils/tasteMatch";
import { buildTasteMatchShare, chatParamsForShare } from "../../../utils/chatShare";
import { trackEvent, ANALYTICS_EVENTS } from "../../../services/analytics";
import { getTasteMatchCopy } from "../../../utils/tasteMatchCopy";
import { resolveProfileAccess, resolveProfileViewer } from "../../../utils/profileViewer";
import useOwnProfileEditor, { BIO_MAX, NAME_MAX, USERNAME_MAX } from "../../../hooks/useOwnProfileEditor";
import ProfileAvatarPickerModal from "../../../components/profile/ProfileAvatarPickerModal";
import ShowcaseBadgePickerSheet from "../../../components/badges/ShowcaseBadgePickerSheet";
import ProfileBannerPickerSheet from "../../../components/profile/ProfileBannerPickerSheet";
import { profileBannerSpacer } from "../../../components/profile/ProfileBannerBackdrop";
import { readProfileBanner } from "../../../utils/profileBanner";
import { getProfileBannerCopy } from "../../../utils/profileBannerCopy";
import { removeShowcaseBadge } from "../../../utils/badgeShowcase";
import { useWatchProgressContext } from "../../../context/WatchProgressContext";


import ModalToastHost from "@components/toast/ModalToastHost";
import GlassPressable from "../../../components/common/GlassPressable";
import GlassTouchable from "../../../components/common/GlassTouchable";
import usePosterUri from "../../../hooks/usePosterUri";
import { PosterChoicesScope } from "../../../context/PosterChoicesContext";
import { useUserPosterChoices } from "../../../context/PosterChoicesProvider";
import { localizeGenreName } from "../../../utils/genreDisplay";
const PROTECTED_LISTS = ["watchedMovies", "watchedTv", "watchList", "favorites"];
// Bu sayı ve üzeri içerikte liste modalı sabit yükseklik yerine ekranı
// kaplayacak şekilde büyür (bkz. FriendProfileScreen liste modalı).
const FULLSCREEN_LIST_THRESHOLD = 12;
// Kapak bölgesinin (hero üstündeki boşluk) yüksekliği: görüntüleme / düzenleme.
// Görüntülemede boşluk kapak boyundan hesaplanır (profileBannerSpacer); düzenlemede
// en az bu kadar ve görüntülemeden EDIT_EXTRA fazla açılır.
const BANNER_ZONE_VIEW_MIN = 84;
const BANNER_ZONE_EDIT = 176;
const BANNER_ZONE_EDIT_EXTRA = 56;
const BANNER_ZONE_EDIT_EMPTY = 112;
// Üst çubuğun boyu (ProfileTopBar minHeight 52): içerik bunun altından başlar.
const TOP_BAR_HEIGHT = 52;

// Subcollection (yeni format) öncelikli, root-doc array'inde (eski format)
// olup subcollection'da olmayanlar eklenir — ProfileStatsContext ile aynı mantık.
const mergeById = (subItems, legacyItems) => {
  const subIds = new Set((subItems || []).map((i) => i.id));
  return [...(subItems || []), ...(legacyItems || []).filter((i) => !subIds.has(i.id))];
};

// Etiketler çizim anında çözülür: modül yüklenirken dondurulursa dil değişince eski dilde kalır.
const buildListMeta = () => ({
  watchedMovies: { icon: "movie-outline", iconLib: "mci", color: "#29b864", label: i18nText("autoI18n.izlenen_filmler", "İzlenen Filmler") },
  watchedTv:     { icon: "tv",            iconLib: "feather", color: "#29b864", label: i18nText("autoI18n.izlenen_diziler", "İzlenen Diziler") },
  favorites:     { icon: "heart",         iconLib: "ion", color: "#e33",     label: i18nText("autoI18n.favoriler", "Favoriler") },
  watchList:     { icon: "bookmark",      iconLib: "ion", color: "#64b4ff",  label: i18nText("autoI18n.izlenecekler", "İzlenecekler") },
});

// ── Süre formatı: 12345dk → "8 gün 13 sa" / "3 sa 25 dk" / "45 dk" ──────────
const formatDuration = (totalMinutes) => {
  if (!totalMinutes) return i18nText("autoI18n.duration_minutes", "{{minutes}} dk", { minutes: 0 });
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
  return new Intl.DateTimeFormat(intlLocaleOf(language), { month: "long", year: "numeric" }).format(new Date(ms));
};

// Kapak düzeni (gridStyle/allCornersRounded) profil rayıyla (ProfileLists) ve
// Listelerim ekranıyla (ListsViewScreen) BİREBİR aynı çerçeveyi kullanır; burada
// düzen profil SAHİBİNİN "Liste Görünümü Seçin" tercihidir (utils/listCoverStyle).
const SharedListGridCard = memo(function SharedListGridCard({
  listName,
  items,
  theme,
  getTmdbUrl,
  gridStyle,
  allCornersRounded,
  direction,
  onPress,
  style,
  // Düzenleme modu: kart dokununca profilde göster/gizle arasında geçer; gizli
  // liste soluk çizilir, köşedeki göz işareti durumu söyler.
  editing = false,
  hidden = false,
}) {
  // This memoized card must update even when its list props stay unchanged.
  useLanguage();
  const meta = buildListMeta()[listName];
  const accent = getListAccent(listName, theme.secondary);
  const icon = getListIcon(listName);
  const displayName = meta?.label ?? listName;
  const orderedItems = useMemo(() => sortItemsByListOrder(items), [items]);
  const cardW = getRailCardWidth(gridStyle);
  const Container = onPress ? TouchableOpacity : View;
  const containerProps = onPress
    ? {
        activeOpacity: 0.8,
        onPress,
        ...(editing
          ? {
              accessibilityRole: "switch",
              accessibilityState: { checked: !hidden },
              accessibilityLabel: displayName,
            }
          : {}),
      }
    : {};

  return (
    <Container {...containerProps} style={[{ paddingBottom: 4 }, editing && hidden && styles.railCardHidden, style]}>
      <View
        pointerEvents="none"
        style={[styles.railCardBg, { width: cardW, backgroundColor: theme.secondary }]}
      />
      <View
        pointerEvents="none"
        style={[styles.railCardGlow, { backgroundColor: accent + "18", borderColor: accent + "25" }]}
      />
      <View style={[styles.railCard, { width: cardW }]}>
        <ListCovers
          items={orderedItems}
          gridStyle={gridStyle}
          allCornersRounded={allCornersRounded}
          direction={direction}
          width={cardW - RAIL_CARD_PADDING * 2}
          height={RAIL_COVER_H}
          getTmdbUrl={getTmdbUrl}
          theme={theme}
        />
        <View style={[styles.railDivider, { backgroundColor: accent + "30" }]} />
        <View style={styles.railCardFooter}>
          <View style={[styles.railIconDot, { backgroundColor: accent + "20" }]}>
            <Ionicons name={icon} size={12} color={accent} />
          </View>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.railCardName, { color: theme.text?.primary ?? "#fff" }]}
          >
            {displayName}
          </Text>
          <Text allowFontScaling={false} style={[styles.railCountBadge, { color: accent }]}>
            {orderedItems.length}
          </Text>
        </View>
      </View>
      {editing ? (
        <View
          pointerEvents="none"
          style={[
            styles.railVisibilityDot,
            {
              backgroundColor: hidden ? theme.secondary : theme.accent,
              borderColor: hidden ? (theme.border ?? "rgba(255,255,255,0.08)") : theme.accent,
            },
          ]}
        >
          <Ionicons name={hidden ? "eye-off-outline" : "eye"} size={14} color={hidden ? theme.text?.muted ?? "#666" : "#fff"} />
        </View>
      ) : null}
    </Container>
  );
});

const SharedListMediaCard = memo(function SharedListMediaCard({
  item,
  theme,
  getTmdbUrl,
  onPress,
  onLongPress,
  activity,
  showRating,
  showComment,
}) {
  // Profil sahibinin seçtiği afiş (ekran PosterChoicesScope ile sarılı).
  const posterUri = usePosterUri();
  return (
    <View>
      <TouchableOpacity
        activeOpacity={0.86}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={350}
        style={[
          styles.sharedMediaPoster,
          {
            backgroundColor: theme.secondary ?? "#111",
            borderColor: theme.border ?? "rgba(255,255,255,0.08)",
            borderWidth: 1,
          },
        ]}
      >
        {posterUri(item?.type, item?.id, item?.imagePath) ? (
          <Image
            source={{ uri: posterUri(item.type, item.id, item.imagePath) }}
            style={styles.sharedMediaPosterImg}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={`shared-media-${item.type}-${item.id}`}
          />
        ) : (
          <Ionicons name="image-outline" size={32} color={theme.text?.muted ?? "#555"} />
        )}
        {/* Arkadaşın bu içeriğe verdiği puan (yıldız) + yorum ikonu —
            posterin ÜZERİNDE, alt kısmına yaslı */}
        <PosterActivityBadge
          hasRating={activity?.hasRating}
          rating={activity?.rating}
          hasComment={activity?.hasComment}
          showRating={showRating}
          showComment={showComment}
          layout="overlay"
          corner="bottomLeft"
        />
      </TouchableOpacity>
    </View>
  );
});

// ── Ana ekran ────────────────────────────────────────────────────────────────
export default function FriendProfileScreen({ route, navigation }) {
  // preview: "friend" → kendi profilini bir arkadaşın gözünden önizleme
  // (Profil > avatarı basılı tut > "Profilini gör"); bkz. utils/profileViewer.js.
  const { friendUid, friendName, preview } = route.params || {};
  const { theme } = useTheme();
  const { user: currentUser } = useAuth();
  const { language } = useLanguage();
  const {
    gridStyle: myGridStyle,
    allCornersRounded: myCornersRounded,
    listLayoutDirections,
  } = useProfileUi();
  const { getTmdbUrl } = useImageQualitySettings();
  const { posterBadges } = useListLayoutSettings();
  const { openQuickActions } = useMediaQuickActions();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Liste sayfası pencere kenarına çizilir: şerit varken de gerçek üst boşluk.
  const windowInsets = useWindowSafeAreaInsets();
  // Kaydırma konumu: hero'daki isim üst çubuğa süzülür, arka plan gradyanı söner.
  // Native sürücüyle bağlı: kaydırırken JS iş parçacığı yorulmaz.
  const scrollY = useRef(new Animated.Value(0)).current;
  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
      }),
    [scrollY],
  );
  const {
    isFriend,
    hasIncomingFrom,
    hasOutgoingTo,
    sendRequest,
    acceptRequest,
    cancelRequest,
    removeFriend,
    block,
    unblock,
    isBlocked,
  } = useFriends();

  const [profile, setProfile] = useState(null);
  const [visibleSocialLinks, setVisibleSocialLinks] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [allLists, setAllLists] = useState(null);
  // Yeni format alt koleksiyonlar — null: henüz çekilmedi
  const [subMovies, setSubMovies] = useState(null);
  const [subShows, setSubShows] = useState(null);
  const [subFavorites, setSubFavorites] = useState(null);
  const [subWatchList, setSubWatchList] = useState(null);
  const [subCustomItems, setSubCustomItems] = useState(null);
  const [selectedSharedList, setSelectedSharedList] = useState(null);
  const [sharedListColumns, setSharedListColumns] = useState(3);
  const [pendingSaveListPost, setPendingSaveListPost] = useState(null);
  const [saveListPost, setSaveListPost] = useState(null);
  const [pendingQuickActions, setPendingQuickActions] = useState(null);
  const [unfriendModalVisible, setUnfriendModalVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  // "⋯" menüsü + engelleme onayı. Menü satırı başka bir Modal açar; iOS kapanmakta
  // olan Modal'ın üstüne ikincisini sunamaz → seçilen işi ref'te tutup menü
  // tamamen kalkınca (onDismissed) çalıştırıyoruz.
  const [menuVisible, setMenuVisible] = useState(false);
  const [blockConfirmVisible, setBlockConfirmVisible] = useState(false);
  // Onay sayfası kapanırken (≈260 ms) metni/ikonu değişmesin diye ayrı tutulur.
  const [blockConfirmUnblock, setBlockConfirmUnblock] = useState(false);
  const afterMenuRef = useRef(null);
  const [showAvatarPreview, setShowAvatarPreview] = useState(false);

  const friend = isFriend(friendUid);
  const blocked = isBlocked(friendUid);
  const incoming = hasIncomingFrom(friendUid);
  const outgoing = hasOutgoingTo(friendUid);
  // Kendi profilinde Mesaj / arkadaşlık / ⋯ / zevk uyumu yok. Önizlemede gizlilik
  // kuralları izleyiciyi ARKADAŞ sayar: "yalnız arkadaşlar" bölümleri de açılır.
  const { isSelf, previewAsFriend, viewerIsFriend } = resolveProfileViewer({
    viewerUid: currentUser?.uid,
    profileUid: friendUid,
    isFriend: friend,
    preview,
  });

  // ── Düzenleme modu (yalnız kendi profil önizlemende) ─────────────────────
  // Eski "Profili Düzenle" ekranının yerine: arkadaşın gördüğü düzen AYNEN durur,
  // üstteki kaleme basınca alanlar yerinde düzenlenir (hooks/useOwnProfileEditor).
  const canEdit = isSelf && previewAsFriend;
  const editor = useOwnProfileEditor({ enabled: canEdit });
  const editing = canEdit && editor.editing;
  const draft = editing ? editor.draft : null;
  const [avatarSheet, setAvatarSheet] = useState(false);
  const [badgeSheet, setBadgeSheet] = useState(false);
  const [bannerSheet, setBannerSheet] = useState(false);
  const [discardVisible, setDiscardVisible] = useState(false);
  // Kaydedilmemiş değişiklikle ekrandan çıkılırken (geri / kaydırma) onay sorulur;
  // onaylanınca bekletilen gezinme eylemi burada.
  const pendingLeaveRef = useRef(null);
  const ownKartlar = useWatchProgressContext()?.kartlar;
  // native-stack'te düz `beforeRemove` + preventDefault desteklenmiyor: kaydırarak
  // geri dönüşte ekran yerelde kalkıp JS durumunda kalıyordu ("removed natively
  // but didn't get removed from JS state"). usePreventRemove kaydırma hareketini
  // ve yerel geri menüsünü de kapatır; geri düğmesi/donanım geri onaya düşer.
  const preventLeave = editing && editor.dirty;
  usePreventRemove(preventLeave, ({ data }) => {
    pendingLeaveRef.current = data?.action ?? null;
    setDiscardVisible(true);
  });
  // Onaylanan çıkış, engel KALKTIKTAN sonra gönderilir (usePreventRemove engeli
  // efektte günceller; aynı karede dispatch yine engellenirdi).
  const [leaveAction, setLeaveAction] = useState(null);
  useEffect(() => {
    if (!leaveAction || preventLeave) return;
    setLeaveAction(null);
    navigation.dispatch(leaveAction);
  }, [leaveAction, preventLeave, navigation]);
  const requestCancelEdit = useCallback(() => {
    if (editor.dirty) {
      pendingLeaveRef.current = null;
      setDiscardVisible(true);
    } else {
      editor.cancel();
    }
  }, [editor]);
  const confirmDiscard = useCallback(() => {
    setDiscardVisible(false);
    const action = pendingLeaveRef.current;
    pendingLeaveRef.current = null;
    editor.cancel();
    if (action) setLeaveAction(action);
  }, [editor]);
  const startEdit = useCallback(() => {
    if (editor.start()) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [editor]);

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

  // Liste kapak düzeni: profil SAHİBİNİN seçtiği (Users/{uid}.listCoverStyle).
  // Alanı henüz yayınlanmamış (eski sürüm) profillerde bakanın kendi düzeni.
  const ownerCoverStyle = readListCoverStyle(profile);
  const gridStyle = ownerCoverStyle?.gridStyle ?? myGridStyle;
  const allCornersRounded = ownerCoverStyle ? ownerCoverStyle.rounded : myCornersRounded;
  const direction = ownerCoverStyle?.direction ?? listLayoutDirections?.[myGridStyle] ?? "right";

  // ── Gizlilik kuralları ────────────────────────────────────────────────────
  const privacy = { ...DEFAULT_PRIVACY, ...(profile?.privacy || {}) };
  // Profil belgesi gelmeden gizlilik BİLİNMİYOR: varsayılana ("herkese açık") düşüp
  // Lists/{uid} dinleyicisini açmak, listeleri kısıtlı her profilde kuraldan
  // permission-denied alırdı (belge gelince dinleyici kapanır ama hata çoktan düşmüştür).
  const { canViewProfile, canViewLists, canViewSocialLinks } =
    resolveProfileAccess(privacy, { viewerIsFriend, profileLoaded: profile != null });
  useEffect(() => {
    setVisibleSocialLinks(null);
    if (!friendUid || !canViewSocialLinks) return undefined;
    return subscribeSocialLinks(friendUid, (links) => setVisibleSocialLinks({ uid: friendUid, links }), () => setVisibleSocialLinks(null));
  }, [friendUid, canViewSocialLinks]);
  // Profil sahibinin özel afişleri: listeleri görebiliyorsan ve sahibin planı izin
  // veriyorsa TEK okuma (aynı koşul kuralda: PosterChoices okuması = canReadLists).
  const friendPosterChoices = useUserPosterChoices(friendUid, {
    entitlements: profile?.entitlements,
    canRead: canViewLists,
  });

  // ── Liste dinleyicisi (yalnız izin varsa açılır) ──────────────────────────
  useEffect(() => {
    if (!friendUid || !canViewLists) {
      setAllLists(null);
      return;
    }
    const unsub = onSnapshot(
      doc(db, "Lists", friendUid),
      (snap) => {
        setAllLists(snap.exists() ? snap.data() : {});
      },
      // Kural istemciden farklı karar verebilir (arkadaşlık yalnız bir tarafta kalmışsa
      // kural ARKADAŞIN friends alt koleksiyonuna bakar): listeler boş görünür.
      (err) => {
        if (__DEV__) console.warn("FriendProfile Lists:", err.message);
        setAllLists({});
      },
    );
    return () => unsub();
  }, [friendUid, canViewLists]);

  // Arkadaşın kendi puanladığı/yorum yaptığı içerikler — aynı `Lists/{uid}`
  // dokümanının `activityIndex`'i, kendi MediaActivityContext'imiz değil
  // (o yalnız OTURUM SAHİBİNİ bilir). Ek okuma yok: zaten dinlenen `allLists`'ten türer.
  const friendActivityIndex = useMemo(
    () => buildActivityFromRoot(allLists?.activityIndex),
    [allLists?.activityIndex],
  );
  const getFriendActivity = useCallback(
    (type, id) => friendActivityIndex?.[type]?.[id] ?? null,
    [friendActivityIndex],
  );

  // ── Yeni format alt koleksiyonlar — tek seferlik okuma (listener pahalı) ─
  // Öntanımlı dört liste + özel listeler artık kök dokümanda değil, kendi alt
  // koleksiyonlarında yaşıyor (bkz. listItemsService.js). Hepsi çekilmezse
  // arkadaş profilinde "boş" görünürler.
  // Cihaz önbelleği (utils/friendListsCache): kök belgenin damgası değişmediyse beş koleksiyon
  // yeniden OKUNMAZ — eskiden her profil açılışı arkadaşın tüm kütüphanesini okuyordu.
  const friendListsStamp = allLists ? listsRootStamp(allLists) : null;
  useEffect(() => {
    if (!friendUid || !canViewLists) {
      setSubMovies(null);
      setSubShows(null);
      setSubFavorites(null);
      setSubWatchList(null);
      setSubCustomItems(null);
      return;
    }
    // Kök belge gelmeden damga bilinmiyor: önbellek doğrulanamaz, okuma da ertelenir.
    if (friendListsStamp === null) return;
    const applyLists = (lists) => {
      setSubMovies(lists.movies);
      setSubShows(lists.shows);
      setSubFavorites(lists.favorites);
      setSubWatchList(lists.watchList);
      setSubCustomItems(lists.customItems);
    };
    const cached = readFriendLists(friendUid, friendListsStamp);
    if (cached) {
      applyLists(cached);
      return;
    }
    let cancelled = false;
    const fetchSubs = async () => {
      const [movSnap, tvSnap, favSnap, wlSnap, customSnap] = await Promise.all([
        getDocs(collection(db, "Lists", friendUid, "watchedMovies")).catch(() => null),
        getDocs(collection(db, "Lists", friendUid, "watchedTv")).catch(() => null),
        getDocs(collection(db, "Lists", friendUid, "favorites")).catch(() => null),
        getDocs(collection(db, "Lists", friendUid, "watchList")).catch(() => null),
        getDocs(collection(db, "Lists", friendUid, "customItems")).catch(() => null),
      ]);
      if (cancelled) return;
      const mapSnap = (snap) =>
        snap ? snap.docs.map((d) => ({ ...d.data(), id: d.data().id ?? d.id })) : [];
      const lists = {
        movies: mapSnap(movSnap),
        shows: mapSnap(tvSnap),
        favorites: mapSnap(favSnap),
        watchList: mapSnap(wlSnap),
        customItems: mapSnap(customSnap),
      };
      applyLists(lists);
      // Biri bile okunamadıysa (izin/ağ) eksik veri önbelleğe girmez.
      if (movSnap && tvSnap && favSnap && wlSnap && customSnap) {
        writeFriendLists(friendUid, friendListsStamp, lists);
      }
    };
    fetchSubs();
    return () => {
      cancelled = true;
    };
  }, [friendUid, canViewLists, friendListsStamp]);

  // ── İzleme istatistikleri — yeni + eski format birleşimi ─────────────────
  // (ProfileStatsContext ile aynı merge mantığı: subcollection öncelikli,
  //  root-doc array'inde olup subcollection'da olmayanlar eklenir.)
  const stats = useMemo(() => {
    if (!canViewLists || allLists === null || subMovies === null || subShows === null)
      return null;

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
      (m.genres || []).forEach((raw) => {
        const g = raw && localizeGenreName(raw, language);
        if (g) genreCounts[g] = (genreCounts[g] || 0) + 1;
      }),
    );
    shows.forEach((s) => {
      const weight =
        s.watchedEpisodeCount ??
        s.seasons?.reduce((sa, se) => sa + (se.episodes?.length || 0), 0) ??
        1;
      (s.genres || []).forEach((raw) => {
        const g = raw && localizeGenreName(raw, language);
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
  }, [canViewLists, allLists, subMovies, subShows, language]);

  // ── Görünür listeler: listVisible haritası + sabit liste sıralaması ──────
  // Dört öntanımlı liste VE özel listeler artık kendi alt koleksiyonlarında
  // yaşıyor; kök dokümandaki eski array'lerle birleştirip TÜM listeleri
  // (boş olmayan + görünür işaretlenmiş) burada topluyoruz.
  // Düzenleme modunda TÜM dolu listeler çizilir (gizliler soluk), görünürlük taslaktan.
  const draftListVisible = draft?.listVisible ?? null;
  const visibleLists = useMemo(() => {
    if (!allLists || !profile) return [];
    const rawVisible = draftListVisible ?? profile.listVisible;
    // Legacy array formatı da desteklenir (FriendsListScreen ile aynı mantık)
    const visibleNames = Array.isArray(rawVisible)
      ? rawVisible.filter((m) => Object.values(m)[0] === true).map((m) => Object.keys(m)[0])
      : Object.entries(rawVisible || {}).filter(([, v]) => v === true).map(([k]) => k);

    const predefinedEntries = [
      ["favorites", mergeById(subFavorites, allLists.favorites || [])],
      ["watchList", mergeById(subWatchList, allLists.watchList || [])],
      [
        "watchedMovies",
        mergeById(subMovies, (allLists.watchedMovies || []).filter((m) => m.type === "movie")),
      ],
      ["watchedTv", mergeById(subShows, allLists.watchedTv || [])],
    ];

    // Özel listeler — kayıt defteri (customLists) + customItems alt koleksiyonu
    // (içeri aktarma akışının yazdığı yeni format).
    const registry = Array.isArray(allLists.customLists) ? allLists.customLists : [];
    const itemsByListId = new Map();
    (subCustomItems || []).forEach((item) => {
      if (!item.listId) return;
      if (!itemsByListId.has(item.listId)) itemsByListId.set(item.listId, []);
      itemsByListId.get(item.listId).push(item);
    });
    const registeredNames = new Set(registry.map((r) => r.name));
    const customEntries = registry.map((r) => [r.name, itemsByListId.get(r.listId) || []]);

    // Eski format özel listeler — kök dokümanda doğrudan array olarak duran,
    // henüz customItems'a taşınmamış listeler (bkz. listItemsService.js).
    const legacyCustomEntries = Object.entries(allLists).filter(
      ([name, items]) =>
        !PROTECTED_LISTS.includes(name) &&
        name !== "customLists" &&
        !registeredNames.has(name) &&
        Array.isArray(items),
    );

    const entries = [...predefinedEntries, ...customEntries, ...legacyCustomEntries].filter(
      ([name, items]) =>
        (draftListVisible || visibleNames.includes(name)) && Array.isArray(items) && items.length > 0,
    );
    return [
      ...PROTECTED_LISTS.map((n) => entries.find(([ln]) => ln === n)).filter(Boolean),
      ...entries
        .filter(([ln]) => !PROTECTED_LISTS.includes(ln))
        .sort((a, b) => a[0].localeCompare(b[0], intlLocaleOf(language))),
    ];
  }, [allLists, profile, draftListVisible, language, subMovies, subShows, subFavorites, subWatchList, subCustomItems]);

  const isListHiddenInDraft = useCallback(
    (name) => !!draftListVisible && draftListVisible[name] !== true,
    [draftListVisible],
  );
  // Sayaç arkadaşın gördüğünü sayar: düzenleme sırasında gizli listeler hariç.
  const totalItems = useMemo(
    () =>
      visibleLists
        .filter(([name]) => !isListHiddenInDraft(name))
        .reduce((acc, [, items]) => acc + items.length, 0),
    [visibleLists, isListHiddenInDraft],
  );

  // ── Zevk uyumu + birlikte izleyelim ───────────────────────────────────────
  // Arkadaşın bir listesi YALNIZ `listVisible`ta açıksa hesaba girer; kapalı olan `null` gider (bilinmiyor,
  // boş değil). Veri tamamen inene kadar (alt koleksiyonlar) hesap yapılmaz. Bkz. utils/tasteMatch.js.
  const myLists = useListStatusContext() || {};
  const friendSide = useMemo(() => {
    if (
      !canViewLists || !profile || !allLists ||
      subMovies === null || subShows === null || subFavorites === null || subWatchList === null
    ) {
      return null;
    }
    const raw = profile.listVisible;
    const shared = new Set(
      Array.isArray(raw)
        ? raw.filter((m) => Object.values(m)[0] === true).map((m) => Object.keys(m)[0])
        : Object.entries(raw || {}).filter(([, v]) => v === true).map(([k]) => k),
    );
    return {
      watchedMovies: shared.has("watchedMovies")
        ? mergeById(subMovies, (allLists.watchedMovies || []).filter((m) => m.type === "movie"))
        : null,
      watchedShows: shared.has("watchedTv") ? mergeById(subShows, allLists.watchedTv || []) : null,
      watchList: shared.has("watchList") ? mergeById(subWatchList, allLists.watchList || []) : null,
      favorites: shared.has("favorites") ? mergeById(subFavorites, allLists.favorites || []) : null,
      ratings: allLists.activityIndex?.ratings || {},
    };
  }, [canViewLists, profile, allLists, subMovies, subShows, subFavorites, subWatchList]);
  const mySide = useMemo(
    () => ({
      watchedMovies: myLists.watchedMoviesItems || [],
      watchedShows: Object.values(myLists.watchedTvMap || {}),
      watchList: myLists.watchListItems || [],
      favorites: myLists.favoritesItems || [],
      ratings: myLists.activityIndex?.ratings || {},
    }),
    [myLists.watchedMoviesItems, myLists.watchedTvMap, myLists.watchListItems, myLists.favoritesItems, myLists.activityIndex],
  );
  const tasteReady = !!friendSide && !myLists.loading && !!myLists.watchedTvLoaded;
  const tasteMatch = useMemo(() => (tasteReady ? computeTasteMatch(mySide, friendSide) : null), [tasteReady, mySide, friendSide]);
  const together = useMemo(() => (tasteReady ? findTogetherCandidates(mySide, friendSide) : null), [tasteReady, mySide, friendSide]);

  const inviteToRoom = useCallback(() => {
    if (!together?.candidates.length || !friendUid) return;
    const deck = candidatesToDeckSource(together.candidates);
    if (!deck.length) return;
    trackEvent(ANALYTICS_EVENTS.TOGETHER_ROOM_STARTED, {
      candidates: deck.length,
      both: together.counts.both,
      score: tasteMatch?.score ?? -1,
    });
    navigation.navigate("CineSwipeScreen", {
      initialMode: "duo",
      together: {
        deck,
        friend: {
          uid: friendUid,
          name: profile?.displayName || friendName || "",
          avatarIndex: profile?.avatarIndex,
        },
      },
    });
  }, [together, friendUid, tasteMatch, profile?.displayName, profile?.avatarIndex, friendName, navigation]);

  // Uyum kartını arkadaşın sohbetine gönderir: ChatScreen mesajı kendisi yazar (initialShare kalıbı).
  const shareTasteMatch = useCallback(() => {
    if (!friendUid) return;
    const name = profile?.displayName || friendName || "";
    const share = buildTasteMatchShare(tasteMatch, { host: currentUser?.displayName || "", friend: name });
    const params = chatParamsForShare({ uid: friendUid, name, avatarIndex: profile?.avatarIndex }, share);
    if (!params) return;
    trackEvent(ANALYTICS_EVENTS.TASTE_MATCH_SHARED, { score: tasteMatch.score });
    navigation.navigate("ChatScreen", params);
  }, [friendUid, tasteMatch, profile?.displayName, profile?.avatarIndex, friendName, currentUser?.displayName, navigation]);
  // ── Moderasyon: şikâyet + engelle ─────────────────────────────────────────
  const submitUserReport = useCallback(
    async (reason) => {
      setReportVisible(false);
      if (!currentUser?.uid) return;
      try {
        await reportUser({
          targetUserId: friendUid,
          reporterId: currentUser.uid,
          displayName: profile?.displayName || friendName || "",
          reason,
        });
        Toast.show({
          type: "success",
          text1: i18nText("autoI18n.sikayetin_alindi", "Şikayetin alındı"),
        });
      } catch {
        Toast.show({
          type: "error",
          text1: i18nText("autoI18n.sikayet_gonderilemedi", "Şikayet gönderilemedi"),
        });
      }
    },
    [currentUser?.uid, friendUid, profile?.displayName, friendName],
  );

  const openModerationMenu = useCallback(() => {
    // Bayat bir iş (menü açılıp vazgeçilen) sonraki açılışta tetiklenmesin.
    afterMenuRef.current = null;
    setMenuVisible(true);
  }, []);

  const closeMenu = useCallback(() => setMenuVisible(false), []);
  const chooseFromMenu = useCallback((next) => {
    afterMenuRef.current = next;
    setMenuVisible(false);
  }, []);
  const handleMenuDismissed = useCallback(() => {
    const next = afterMenuRef.current;
    afterMenuRef.current = null;
    next?.();
  }, []);

  // Engelliyken tek anlamlı eylem engeli kaldırmak; şikâyet yolu yine açık
  // kalıyor (engellemek bildirmenin yerine geçmez).
  const chooseReport = useCallback(
    () => chooseFromMenu(() => setReportVisible(true)),
    [chooseFromMenu],
  );
  const chooseBlockToggle = useCallback(
    () =>
      chooseFromMenu(() => {
        setBlockConfirmUnblock(blocked);
        setBlockConfirmVisible(true);
      }),
    [chooseFromMenu, blocked],
  );
  const confirmBlockToggle = useCallback(() => {
    setBlockConfirmVisible(false);
    if (blockConfirmUnblock) unblock(friendUid);
    else block(friendUid);
  }, [blockConfirmUnblock, block, unblock, friendUid]);

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
  // Dört favori profil belgesinde (Users/{uid}.fourFavorites) — ek okuma yok,
  // zaten dinlenen belgeden gelir. Görünürlüğü profilin kendisiyle aynı
  // (canViewProfile): gizli profilde favoriler de gizli.
  const profileFavorites = useMemo(() => readProfileFavorites(profile), [profile]);
  // Kullanıcının vitrine seçtiği en fazla 6 rozet (Users/{uid}.showcaseBadges).
  const [selectedShowcaseBadge, setSelectedShowcaseBadge] = useState(null);
  const draftShowcase = draft?.showcase ?? null;
  const profileShowcaseBadges = useMemo(() => {
    if (draftShowcase) return resolveShowcaseBadges(draftShowcase, ownKartlar);
    const remoteIds = readProfileShowcaseBadges(profile);
    if (remoteIds.length > 0) return resolveShowcaseBadges(remoteIds);
    // Önizleme arkadaşın gördüğünü gösterir: o yalnız buluttaki seçimi okur.
    if (isSelf && !previewAsFriend && friendUid) {
      const localIds = getStored(Keys.showcaseBadges, { uid: friendUid });
      return resolveShowcaseBadges(localIds);
    }
    return [];
  }, [draftShowcase, ownKartlar, profile, isSelf, previewAsFriend, friendUid]);
  // Kimlik rozetleri arkadaşın SUNUCU alanlarından: istemci ne
  // entitlements'ı ne badges'ı yazabilir (firestore.rules), yani sahte rozet
  // gösterilemez.
  const friendPlan = resolveServerPlan(profile?.entitlements);
  const identityBadges = getIdentityBadges({
    founder: Boolean(profile?.badges?.founder),
    isPremium: friendPlan !== PREMIUM_PLAN.FREE,
    isUnlimited: friendPlan === PREMIUM_PLAN.UNLIMITED,
  });
  const memberSince = formatMemberSince(profile?.createdAt, language);
  const selectedListName = selectedSharedList?.[0] ?? "";
  const selectedListItems = selectedSharedList?.[1] ?? [];
  const selectedListMeta = buildListMeta()[selectedListName];
  const selectedListTitle = selectedListMeta?.label ?? selectedListName;
  const isFullScreenList = selectedListItems.length >= FULLSCREEN_LIST_THRESHOLD;

  // Aynı anda iki native Modal sunmak iOS'ta arada boş kare/presentation
  // yarışına yol açıyor. Liste sayfasının 260 ms çıkışını tamamlatıp ortak
  // kaydet sayfasını ondan sonra açıyoruz.
  useEffect(() => {
    if (!pendingSaveListPost || selectedSharedList) return undefined;
    const timer = setTimeout(() => {
      setSaveListPost(pendingSaveListPost);
      setPendingSaveListPost(null);
    }, 300);
    return () => clearTimeout(timer);
  }, [pendingSaveListPost, selectedSharedList]);

  // Posterde basılı tutma: ana ekrandaki hızlı eylem sayfasının aynısı. İki
  // native Modal'ı üst üste açmamak için (yukarıdaki gerekçe) önce liste sayfası
  // kapanır, çıkışı bitince hızlı eylem sayfası açılır. Kullanıcı sayfadan
  // yalnızca vazgeçerse (detaya/puana geçmeden) liste sayfası geri açılır;
  // aksi hâlde bakmak için basılı tutan kişi listedeki yerini kaybederdi.
  useEffect(() => {
    if (!pendingQuickActions || selectedSharedList) return undefined;
    const { item, mediaType, list } = pendingQuickActions;
    const timer = setTimeout(() => {
      setPendingQuickActions(null);
      openQuickActions({
        item,
        mediaType,
        navigation,
        onDismiss: () => setTimeout(() => setSelectedSharedList(list), 300),
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [pendingQuickActions, selectedSharedList, openQuickActions, navigation]);

  const openMediaQuickActions = useCallback(
    (item) => {
      if (!item?.id || !selectedSharedList) return;
      // Eski kayıtlarda `type` olmayabiliyor; izlenen diziler alt koleksiyonundan
      // geliyor (bkz. listItemToMedia'daki aynı geri dönüş).
      const mediaType =
        item.type === "movie" || item.type === "tv"
          ? item.type
          : selectedSharedList[0] === "watchedTv"
            ? "tv"
            : "movie";
      setPendingQuickActions({ item, mediaType, list: selectedSharedList });
      setSelectedSharedList(null);
    },
    [selectedSharedList],
  );

  const openSaveList = useCallback(() => {
    if (!selectedListName || selectedListItems.length === 0) return;
    const mediaList = selectedListItems
      .map((item) =>
        listItemToMedia(item, {
          fallbackType: selectedListName === "watchedTv" ? "tv" : "movie",
        }),
      )
      .filter(Boolean);
    if (mediaList.length === 0) return;
    // Kimden alındığı isimde kalsın — aynı liste adını birden çok arkadaştan
    // kaydedince hangisinin hangisi olduğu karışmasın.
    const sourceName = displayName || profile?.username || friendName || "";
    setPendingSaveListPost({
      id: `friend-list-${friendUid}-${selectedListName}`,
      title: sourceName ? `${selectedListTitle} (${sourceName})` : selectedListTitle,
      mediaList,
    });
    setSelectedSharedList(null);
  }, [
    friendUid,
    selectedListItems,
    selectedListName,
    selectedListTitle,
    displayName,
    profile?.username,
    friendName,
  ]);

  // ── Yükleniyor / bulunamadı ───────────────────────────────────────────────
  // ── Kapak bölgesi yüksekliği ──────────────────────────────────────────────
  // Düzenleme açılınca içerik aşağı kayar, kapak görseli daha çok görünür;
  // kapanınca yumuşakça geri gelir. Yalnız düzenleme GEÇİŞİ canlandırılır —
  // profil yüklenince / kapak değişince yükseklik doğrudan oturur (zıplama yok).
  const zoneHasBanner = !!(draft ? draft.banner : readProfileBanner(profile));
  // İçerik SafeAreaView içinde: güvenli alan + üst çubuğun altından başlar.
  const zoneView = profileBannerSpacer({
    width: windowWidth,
    topInset: insets.top,
    contentTop: insets.top + TOP_BAR_HEIGHT,
    min: BANNER_ZONE_VIEW_MIN,
  });
  const zoneTarget = editing
    ? zoneHasBanner
      ? Math.max(BANNER_ZONE_EDIT, zoneView + BANNER_ZONE_EDIT_EXTRA)
      : BANNER_ZONE_EDIT_EMPTY
    : zoneHasBanner
      ? zoneView
      : 0;
  const bannerZone = useRef(new Animated.Value(zoneTarget)).current;
  const zoneEditingRef = useRef(editing);
  useEffect(() => {
    const toggled = zoneEditingRef.current !== editing;
    zoneEditingRef.current = editing;
    if (!toggled) {
      bannerZone.setValue(zoneTarget);
      return undefined;
    }
    const anim = Animated.timing(bannerZone, {
      toValue: zoneTarget,
      duration: 380,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: false, // yükseklik: yerleşim özelliği
    });
    anim.start();
    return () => anim.stop();
  }, [bannerZone, editing, zoneTarget]);

  if (profileLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.primary }]}>
        <ProfileTopBar title={friendName || i18nText("profile", "Profil")} />
        <View style={styles.centerContent}>
          <LensLoader size="screen" color={theme.accent} />
        </View>
      </SafeAreaView>
    );
  }
  if (!profile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.primary }]}>
        <ProfileTopBar title={friendName || i18nText("profile", "Profil")} />
        <View style={styles.centerContent}>
          <Ionicons name="person-outline" size={52} color={theme.text?.muted ?? "#444"} />
          <Text style={[styles.emptyText, { color: theme.text?.secondary ?? "#aaa" }]}>{i18nText("autoI18n.kullanici_bulunamadi", "Kullanıcı bulunamadı")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const green = theme.colors?.green ?? "#29b864";
  const blue = theme.colors?.blue ?? "#64b4ff";
  const orange = theme.colors?.orange ?? "#ff9650";
  const movieShare = stats?.totalMinutes ? Math.round((stats.movieMinutes / stats.totalMinutes) * 100) : 0;
  const tvShare = stats?.totalMinutes ? 100 - movieShare : 0;
  const genreColors = [orange, blue, green, theme.accent ?? "#8847ff", "#e4ae39"];
  // Profil kapağı: düzenlemede taslak, değilse kayıtlı alan (herkese görünür — avatar gibi).
  const profileBanner = draft ? draft.banner || null : readProfileBanner(profile);
  const bannerCopy = getProfileBannerCopy(language);

  return (
    <PosterChoicesScope choices={friendPosterChoices}>
    <SafeAreaView style={[styles.container, { backgroundColor: theme.primary }]}>
      <ProfileBackdrop scrollY={scrollY} banner={profileBanner} width={windowWidth} />
      <ScreenDecor scope="profile" iconOpacity={0.3} />
      <ProfileTopBar
        title={displayName || profile.username || friendName}
        scrollY={scrollY}
        onMore={isSelf ? undefined : openModerationMenu}
        moreLabel={i18nText("autoI18n.secenekler", "Seçenekler")}
        // Düzenleme modunda sol uç "Vazgeç" (×), sağ uç "Kaydet" (✓).
        leading={
          editing ? (
            <GlassIconButton
              testID="profile-edit-cancel"
              icon="close"
              iconSize={20}
              size={40}
              fallbackRadius={12}
              color={theme.text?.primary ?? "#fff"}
              accessibilityLabel={i18nText("autoI18n.vazgec", "Vazgeç")}
              onPress={requestCancelEdit}
              disabled={editor.saving}
            />
          ) : null
        }
        trailing={
          editing ? (
            <GlassIconButton
              testID="profile-edit-save"
              icon="checkmark"
              iconSize={21}
              size={40}
              fallbackRadius={12}
              color="#fff"
              tint={theme.accent}
              fallbackStyle={{ backgroundColor: theme.accent, opacity: editor.canSave || !editor.dirty ? 1 : 0.5 }}
              accessibilityLabel={i18nText("autoI18n.kaydet", "Kaydet")}
              accessibilityState={{ busy: editor.saving, disabled: editor.saving }}
              onPress={editor.save}
              disabled={editor.saving}
            >
              {editor.saving ? <LensLoader tone="mono" size="small" color="#fff" /> : null}
            </GlassIconButton>
          ) : canEdit ? (
            // Önizleme: eski geniş şerit yerine küçük "Gizlilik" hapı, kalemin yanında.
            <View style={styles.previewActions}>
              <GlassPillButton
                label={i18nText("autoI18n.gizlilik", "Gizlilik")}
                icon="lock-closed-outline"
                iconSize={15}
                height={40}
                paddingHorizontal={12}
                gap={5}
                fontSize={13}
                fallbackRadius={12}
                color={theme.text?.primary ?? "#fff"}
                fallbackStyle={{ backgroundColor: theme.secondary, borderColor: theme.border, borderWidth: 1 }}
                accessibilityLabel={i18nText(
                  "autoI18n.profil_onizleme_aciklama",
                  "Neyin görüneceğini gizlilik ayarlarından seçebilirsin.",
                )}
                onPress={() => navigation.navigate("PrivacySettingsScreen")}
              />
              <GlassIconButton
                testID="profile-edit-start"
                icon="pencil"
                iconSize={18}
                size={40}
                fallbackRadius={12}
                color={theme.accent}
                accessibilityLabel={i18nText("autoI18n.profili_duzenle", "Profili Düzenle")}
                onPress={startEdit}
              />
            </View>
          ) : null
        }
      />

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
      >
        {/* ── Kapak (banner): sahne görünsün diye hero biraz aşağıda başlar ── */}
        <Animated.View
          style={[styles.bannerZone, { height: bannerZone }]}
          accessible={!editing && !!profileBanner}
          accessibilityLabel={profileBanner ? bannerCopy.bannerLabel(profileBanner.title) : undefined}
        >
          {editing ? (
            <View style={styles.bannerEditRow}>
              <GlassPillButton
                label={profileBanner ? bannerCopy.change : bannerCopy.add}
                icon="image-outline"
                iconSize={16}
                height={38}
                paddingHorizontal={14}
                gap={6}
                fontSize={13}
                fallbackRadius={19}
                color={theme.text?.primary ?? "#fff"}
                fallbackStyle={{ backgroundColor: theme.secondary, borderColor: theme.border, borderWidth: 1 }}
                accessibilityLabel={profileBanner ? bannerCopy.change : bannerCopy.add}
                onPress={() => setBannerSheet(true)}
              />
              {profileBanner ? (
                <GlassPillButton
                  label={bannerCopy.remove}
                  icon="trash-outline"
                  iconSize={15}
                  height={38}
                  paddingHorizontal={14}
                  gap={6}
                  fontSize={13}
                  fallbackRadius={19}
                  color={theme.colors?.red ?? "#e5484d"}
                  fallbackStyle={{ backgroundColor: theme.secondary, borderColor: theme.border, borderWidth: 1 }}
                  accessibilityLabel={bannerCopy.remove}
                  onPress={() => editor.setBanner(null)}
                />
              ) : null}
            </View>
          ) : null}
        </Animated.View>

        {/* ── Hero: avatar, ad, durum, rozetler, bio ───────────────────────── */}
        <ProfileHero
          avatarIndex={draft ? draft.avatar?.avatarIndex : profile.avatarIndex}
          photoURL={draft ? draft.avatar?.photoURL : profile.photoURL}
          onAvatarPress={() => (editing ? setAvatarSheet(true) : setShowAvatarPreview(true))}
          onAvatarLongPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setShowAvatarPreview(true);
          }}
          name={displayName || i18nText("autoI18n.isimsiz_kullanici", "İsimsiz kullanıcı")}
          username={profile.username}
          badges={identityBadges}
          language={language}
          bio={canViewProfile ? profile.bio : null}
          socialLinks={canViewSocialLinks ? (visibleSocialLinks?.uid === friendUid ? (visibleSocialLinks.links ?? profile.socialLinks) : profile.socialLinks) : null}
          memberSince={
            canViewProfile && memberSince
              ? i18nText("autoI18n.uye_tarihi_cumle", "{{date}} tarihinden beri üye", {
                  date: memberSince,
                })
              : null
          }
          editor={
            draft
              ? {
                  name: draft.displayName,
                  onChangeName: editor.setDisplayName,
                  namePlaceholder: i18nText("autoI18n.adin", "Adın"),
                  nameLabel: i18nText("autoI18n.isim", "İsim"),
                  bioLabel: i18nText("autoI18n.hakkinda", "Hakkında"),
                  nameMax: NAME_MAX,
                  username: draft.username,
                  onChangeUsername: editor.setUsername,
                  usernamePlaceholder: i18nText("autoI18n.kullanici_adi_ornegi", "kullanici_adi"),
                  usernameLabel: i18nText("autoI18n.kullanici_adi_2", "Kullanıcı adı"),
                  usernameMax: USERNAME_MAX,
                  usernameHint: editor.usernameHint,
                  bio: draft.bio,
                  onChangeBio: editor.setBio,
                  bioPlaceholder: i18nText("autoI18n.kendinden_bahset", "Kendinden bahset…"),
                  bioMax: BIO_MAX,
                  socialDraft: draft.social,
                  socialInvalid: editor.socialInvalid,
                  onChangeSocial: editor.setSocial,
                  avatarHint: i18nText("autoI18n.avatari_degistir", "Avatarı değiştir"),
                }
              : null
          }
        />

        {/* ── Düzenleme modu şeridi: hero'nun ALTINDA — üstte kapak (banner) ──── */}
        {/* görselinin üstüne binmesin. Salt önizlemede gizlilik üst çubukta. */}
        {previewAsFriend && editing ? (
            <ProfilePreviewBanner
              icon="pencil"
              title={i18nText("autoI18n.profil_duzenleme_modu_baslik", "Düzenleme modu")}
              subtitle={i18nText(
                "autoI18n.profil_duzenleme_modu_aciklama",
                "Değiştirmek istediğin yere dokun. ✓ ile kaydedince arkadaşların böyle görecek.",
              )}
              actionLabel={i18nText("autoI18n.hesap", "Hesap")}
              actionIcon="person-circle-outline"
              onAction={() => navigation.navigate("EditProfileScreen")}
            />
        ) : null}

        {/* ── Eylemler: etiketli, tam genişlik ─────────────────────────────── */}
        {!isSelf && (
          <View style={styles.actionRow}>
            {friend && (
              <PillButton
                label={i18nText("autoI18n.mesaj_2", "Mesaj")}
                icon="chatbubble-ellipses"
                variant="primary"
                onPress={() =>
                  navigation.navigate("ChatScreen", { friendUid, friendName: displayName })
                }
                style={styles.actionButton}
              />
            )}
            <PillButton
              label={relationship.label}
              icon={relationship.icon}
              variant={friend || outgoing ? "soft" : "primary"}
              tone={relationship.color}
              onPress={relationship.onPress}
              style={styles.actionButton}
            />
          </View>
        )}

        {canViewProfile && (
          <ProfileStatStrip
            items={[
              {
                key: "friends",
                icon: "people-outline",
                label: i18nText("autoI18n.arkadas", "Arkadaş"),
                value: profile.friendsCount ?? 0,
                color: green,
              },
              {
                key: "posts",
                icon: "newspaper-outline",
                label: i18nText("autoI18n.gonderi", "Gönderi"),
                value: Math.max(0, profile.postsCount ?? 0),
                color: orange,
              },
              {
                key: "items",
                icon: "albums-outline",
                label: i18nText("autoI18n.icerik", "İçerik"),
                value: canViewLists ? totalItems : "-",
                color: blue,
              },
            ]}
          />
        )}

        {/* ── Vitrin rozetleri: en fazla 6 rozet (varsa) ──────────────────── */}
        {/* Düzenleme modunda boş da olsa çizilir: dört yuva, boşlarda "+". */}
        {(editing || (canViewProfile && profileShowcaseBadges.length > 0)) && (
          <>
            <SectionHeader
              title={getBadgeShowcaseCopy(language).profileTitle}
            />
            <FriendBadgeShowcase
              badges={profileShowcaseBadges}
              onPressBadge={editing ? () => setBadgeSheet(true) : setSelectedShowcaseBadge}
              editing={editing}
              onRemoveBadge={(badge) => editor.setShowcase(removeShowcaseBadge(draft?.showcase, badge))}
              onPressEmpty={() => setBadgeSheet(true)}
            />
          </>
        )}

        {/* ── Favori seçimleri: film / dizi / oyuncu (varsa) ───────────────── */}
        {(editing || (canViewProfile && hasAnyFavorites(profileFavorites))) && (
          <>
            <SectionHeader title={getFavoritesCopy(language).profile.title} />
            <FavoritesShowcase
              favorites={draft ? draft.favorites : profileFavorites}
              navigation={navigation}
              editing={editing}
              onChange={editor.setFavorites}
            />
          </>
        )}

        {/* ── İçerik: gizlilik kilitleri / istatistik + listeler ───────────── */}
        {!canViewProfile ? (
          <ProfileNoticeCard
            icon="lock-closed-outline"
            title={i18nText("autoI18n.bu_profil_gizli", "Bu profil gizli")}
          />
        ) : !canViewLists ? (
          <ProfileNoticeCard
            icon="lock-closed-outline"
            title={`${i18nText("autoI18n.izleme_verileri", "İzleme verileri")} ${
              privacy.lists === "friends"
                ? i18nText("autoI18n.yalnizca_arkadaslara_acik", "yalnızca arkadaşlara açık")
                : i18nText("autoI18n.gizli", "gizli")
            }`}
          />
        ) : (
          <>
            {/* ── İzleme İstatistikleri ───────────────────────────────────── */}
            <SectionHeader title={i18nText("autoI18n.izleme_istatistikleri", "İzleme İstatistikleri")} />

            {stats === null ? (
              <LensLoader size="medium" color={theme.accent} style={{ marginVertical: 24 }} />
            ) : (
              <>
                <WatchStatsCard
                  caption={i18nText("autoI18n.toplam_izleme_suresi", "Toplam izleme süresi")}
                  totalLabel={formatDuration(stats.totalMinutes)}
                  minutesLabel={`${stats.totalMinutes.toLocaleString(intlLocaleOf(language))} ${i18nText("autoI18n.dakika", "dk")}`}
                  movie={{
                    label: i18nText("autoI18n.film", "Film"),
                    minutes: stats.movieMinutes,
                    share: movieShare,
                    color: blue,
                    durationLabel: formatDuration(stats.movieMinutes),
                  }}
                  tv={{
                    label: i18nText("autoI18n.dizi", "Dizi"),
                    minutes: stats.tvMinutes,
                    share: tvShare,
                    color: green,
                    durationLabel: formatDuration(stats.tvMinutes),
                  }}
                  metrics={[
                    {
                      key: "movie",
                      icon: "movie-outline",
                      iconLib: "mci",
                      label: i18nText("autoI18n.film", "Film"),
                      value: stats.movieCount.toLocaleString(intlLocaleOf(language)),
                      color: blue,
                    },
                    {
                      key: "tv",
                      icon: "tv",
                      iconLib: "feather",
                      label: i18nText("autoI18n.dizi", "Dizi"),
                      value: stats.showCount.toLocaleString(intlLocaleOf(language)),
                      color: green,
                    },
                    {
                      key: "season",
                      icon: "layers-outline",
                      iconLib: "ion",
                      label: i18nText("autoI18n.sezon", "Sezon"),
                      value: stats.seasonCount.toLocaleString(intlLocaleOf(language)),
                      color: orange,
                    },
                    {
                      key: "episode",
                      icon: "play-circle-outline",
                      iconLib: "ion",
                      label: i18nText("autoI18n.bolum_2", "Bölüm"),
                      value: stats.episodeCount.toLocaleString(intlLocaleOf(language)),
                      color: theme.accent,
                    },
                  ]}
                  genresTitle={i18nText("autoI18n.en_cok_izlenen_turler", "En Çok İzlenen Türler")}
                  genres={stats.topGenres}
                  genreColors={genreColors}
                />
              </>
            )}

            {/* ── Puan dağılımı: aynı Lists belgesinden (ek okuma yok); puan yoksa gizli ── */}
            <RatingDistributionCard
              ratings={allLists?.activityIndex?.ratings}
              hideWhenEmpty
              style={styles.ratingSpread}
            />

            {/* ── Zevk uyumu + birlikte izleyelim (kendi profilinde yok) ──────── */}
            {tasteMatch && together && !isSelf ? (
              <>
                <SectionHeader title={getTasteMatchCopy(language).title} />
                <TasteMatchCard
                  match={tasteMatch}
                  together={together}
                  friendName={profile?.displayName || friendName || ""}
                  friendListHidden={friendSide?.watchList === null}
                  noWatchedVisible={friendSide?.watchedMovies === null && friendSide?.watchedShows === null}
                  canInvite={friend}
                  onInvite={inviteToRoom}
                  onShareMatch={shareTasteMatch}
                />
              </>
            ) : null}

            {/* ── Paylaşılan Listeler ─────────────────────────────────────── */}
            {allLists === null ? (
              <LensLoader size="medium" color={theme.accent} style={{ marginTop: 30 }} />
            ) : visibleLists.length === 0 ? (
              <ProfileNoticeCard
                icon="albums-outline"
                title={i18nText("autoI18n.paylasilan_liste_yok", "Paylaşılan liste yok")}
              />
            ) : (
              <>
                <SectionHeader
                  title={i18nText("autoI18n.listeler", "Listeler")}
                  trailing={
                    <CountChip
                      value={visibleLists.filter(([name]) => !isListHiddenInDraft(name)).length}
                      icon="grid-outline"
                    />
                  }
                />
                {editing ? (
                  <Text allowFontScaling={false} style={[styles.editListHint, { color: theme.text?.muted ?? "#666" }]}>
                    {i18nText(
                      "autoI18n.profil_duzenleme_liste_ipucu",
                      "Profilde göstermek ya da gizlemek için listeye dokun.",
                    )}
                  </Text>
                ) : null}

                <FlatList
                  horizontal
                  data={visibleLists}
                  keyExtractor={([listName]) => listName}
                  showsHorizontalScrollIndicator={false}
                  style={styles.sharedListsRail}
                  contentContainerStyle={styles.sharedListsPreviewContent}
                  extraData={draftListVisible}
                  renderItem={({ item: [listName, items] }) => (
                    <SharedListGridCard
                      listName={listName}
                      items={items}
                      theme={theme}
                      getTmdbUrl={getTmdbUrl}
                      gridStyle={gridStyle}
                      allCornersRounded={allCornersRounded}
                      direction={direction}
                      editing={editing}
                      hidden={isListHiddenInDraft(listName)}
                      onPress={() =>
                        editing ? editor.toggleList(listName) : setSelectedSharedList([listName, items])
                      }
                    />
                  )}
                />
              </>
            )}
          </>
        )}
      </Animated.ScrollView>

      <BottomSheetModal
        visible={!!selectedSharedList}
        onClose={() => setSelectedSharedList(null)}
        intensity={35}
        dimColor="rgba(0,0,0,0.4)"
        sheetStyle={[
          styles.listModalSheet,
          isFullScreenList && {
            height: Math.round(windowHeight - windowInsets.top - 12),
            maxHeight: Math.round(windowHeight - windowInsets.top - 12),
          },
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
            <View style={[styles.modalHeaderRow, { marginBottom: 16 }]}>
              <View style={styles.modalTitleGroup}>
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={[styles.modalTitle, { color: theme.text?.primary ?? "#fff", fontSize: 22 }]}
                >
                  {selectedListTitle}
                </Text>
                <Text allowFontScaling={false} style={[styles.modalSubtitle, { color: theme.accent ?? "#aaa", fontSize: 13, fontWeight: "800", marginTop: 4 }]}>
                  {i18nText("autoI18n.item_count", "{{count}} içerik", { count: selectedListItems.length })}
                </Text>
              </View>
              <View style={styles.listModalHeaderActions}>
                {/* Kendi listeni kendine kopyalamanın anlamı yok (önizleme dahil). */}
                {!isSelf && (
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
                    onPress={openSaveList}
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
                  {[3, 4].map((columns) => {
                    const active = sharedListColumns === columns;
                    return (
                      <GlassPressable
                        key={columns}
                        onPress={() => setSharedListColumns(columns)}
                        accessibilityRole="button"
                        accessibilityLabel={
                          columns === 3
                            ? i18nText("autoI18n.uclu_dizilim", "3'lü")
                            : i18nText("autoI18n.dortlu_dizilim", "4'lü")
                        }
                        style={[
                          styles.columnSelectorButton,
                          active && { backgroundColor: `${theme.accent}22` },
                        ]}
                      >
                        <Text
                          allowFontScaling={false}
                          style={[
                            styles.columnSelectorText,
                            { color: active ? theme.accent : theme.text?.muted ?? "#666" },
                          ]}
                        >
                          {columns}
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
                  onPress={() => setSelectedSharedList(null)}
                />
              </View>
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
                key={`shared-list-${sharedListColumns}`}
                style={isFullScreenList ? styles.sharedListsModalListGrow : undefined}
                data={selectedListItems}
                keyExtractor={(item, index) => `${item?.type ?? "item"}-${item?.id ?? index}`}
                numColumns={sharedListColumns}
                showsVerticalScrollIndicator={false}
                columnWrapperStyle={styles.sharedListsModalRow}
                contentContainerStyle={[
                  styles.sharedListsModalContent,
                  { paddingBottom: Math.max(insets.bottom + 24, 40) },
                ]}
                renderItem={({ item }) => (
                  <View
                    style={[
                      styles.sharedListModalCell,
                      { width: sharedListColumns === 4 ? "23.2%" : "31.8%" },
                    ]}
                  >
                    <SharedListMediaCard
                      item={item}
                      theme={theme}
                      getTmdbUrl={getTmdbUrl}
                      activity={getFriendActivity(item?.type, item?.id)}
                      showRating={posterBadges?.rated !== false}
                      showComment={posterBadges?.commented !== false}
                      onPress={() => {
                        if (!item?.id) return;
                        setSelectedSharedList(null);
                        navigation.navigate(
                          item?.type === "movie" ? "MovieDetails" : "TvShowsDetails",
                          { id: item?.id },
                        );
                      }}
                      onLongPress={() => openMediaQuickActions(item)}
                    />
                  </View>
                )}
              />
            )}
      </BottomSheetModal>

      {canEdit ? (
        <>
          {/* Avatar seçici: seçim yalnız taslağa yazılır, ✓ ile kalıcı olur. */}
          <ProfileAvatarPickerModal
            visible={avatarSheet && editing}
            selected={draft?.avatar}
            saving={false}
            onSelect={(choice) => {
              editor.setAvatar(choice);
              setAvatarSheet(false);
            }}
            onClose={() => setAvatarSheet(false)}
          />
          <ProfileBannerPickerSheet
            visible={bannerSheet && editing}
            current={draft?.banner || null}
            favorites={draft?.favorites || profileFavorites}
            onSelect={editor.setBanner}
            onClose={() => setBannerSheet(false)}
          />
          <ShowcaseBadgePickerSheet
            visible={badgeSheet && editing}
            value={draft?.showcase}
            onChange={editor.setShowcase}
            onClose={() => setBadgeSheet(false)}
          />
          <ConfirmSheet
            visible={discardVisible}
            onClose={() => {
              pendingLeaveRef.current = null;
              setDiscardVisible(false);
            }}
            onConfirm={confirmDiscard}
            tone="danger"
            icon="trash-outline"
            title={i18nText("autoI18n.degisiklikler_kaydedilmedi", "Değişiklikler kaydedilmedi")}
            message={i18nText(
              "autoI18n.degisiklikler_kaydedilmedi_metin",
              "Düzenleme modundan çıkarsan yaptığın değişiklikler silinir.",
            )}
            confirmLabel={i18nText("autoI18n.degisiklikleri_at", "Değişiklikleri at")}
            cancelLabel={i18nText("autoI18n.duzenlemeye_don", "Düzenlemeye dön")}
          />
        </>
      ) : null}

      <SaveSharedListModal
        visible={!!saveListPost}
        post={saveListPost}
        onClose={() => setSaveListPost(null)}
        onSaved={() => setSaveListPost(null)}
      />

      <ProfileOptionsSheet
        visible={menuVisible}
        onClose={closeMenu}
        onDismissed={handleMenuDismissed}
        name={displayName || profile.username || friendName}
        username={profile.username}
        avatarIndex={profile.avatarIndex}
        photoURL={profile.photoURL}
        blocked={blocked}
        onReport={chooseReport}
        onToggleBlock={chooseBlockToggle}
      />

      <ConfirmSheet
        visible={blockConfirmVisible}
        onClose={() => setBlockConfirmVisible(false)}
        onConfirm={confirmBlockToggle}
        tone={blockConfirmUnblock ? "accent" : "danger"}
        icon={blockConfirmUnblock ? "lock-open-outline" : "ban-outline"}
        title={
          blockConfirmUnblock
            ? i18nText("autoI18n.engeli_kaldir", "Engeli kaldır")
            : i18nText("autoI18n.kullaniciyi_engelle", "Kullanıcıyı engelle")
        }
        message={
          blockConfirmUnblock
            ? i18nText(
                "autoI18n.engeli_kaldir_onay_metni",
                "Bu kullanıcının gönderilerini ve mesajlarını yeniden görebileceksin.",
              )
            : i18nText(
                "autoI18n.engelle_onay_metni",
                "Gönderilerini, yorumlarını ve mesajlarını görmezsin. Arkadaşsanız arkadaşlık da kalkar.",
              )
        }
        confirmLabel={
          blockConfirmUnblock
            ? i18nText("autoI18n.engeli_kaldir", "Engeli kaldır")
            : i18nText("autoI18n.engelle", "Engelle")
        }
        cancelLabel={i18nText("autoI18n.iptal", "İptal")}
      />

      <ReportReasonSheet
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        onSelect={submitUserReport}
        subtitle={i18nText(
          "autoI18n.sikayet_hedefi_kullanici",
          "{{name}} adlı kullanıcı bildiriliyor.",
          { name: profile?.displayName || friendName || "" },
        )}
      />

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
              <GlassTouchable
                activeOpacity={0.85}
                onPress={() => setUnfriendModalVisible(false)}
                style={[styles.confirmBtn, { backgroundColor: theme.primary ?? "#111", borderColor: theme.border ?? "rgba(255,255,255,0.08)" }]}
              >
                <Text allowFontScaling={false} numberOfLines={1} style={[styles.confirmBtnText, { color: theme.text?.primary ?? "#fff" }]}>
                  {i18nText("autoI18n.iptal", "İptal")}
                </Text>
              </GlassTouchable>
              <GlassTouchable
                activeOpacity={0.85}
                onPress={handleRemoveFriend}
                style={[styles.confirmBtn, styles.confirmDangerBtn]}
              >
                <Ionicons name="person-remove-outline" size={15} color="#fff" />
                <Text allowFontScaling={false} numberOfLines={1} style={[styles.confirmBtnText, { color: "#fff" }]}>
                  {i18nText("autoI18n.cikar", "Çıkar")}
                </Text>
              </GlassTouchable>
            </View>
          </View>
        </View>
        <ModalToastHost visible={unfriendModalVisible} />
      </Modal>

      <AvatarPreviewModal
        visible={showAvatarPreview}
        onClose={() => setShowAvatarPreview(false)}
        source={getAvatarSource(profile.avatarIndex, profile.photoURL)}
        isCustomPhoto={profile.avatarIndex === -1}
        // Avatar bir oyuncu/yönetmen fotoğrafıysa kimin olduğu + kişi sayfası.
        person={
          profile.avatarIndex === -1 && isTmdbPhotoUrl(profile.photoURL)
            ? normalizePhotoPerson(profile.photoPerson)
            : null
        }
        onPersonPress={(person) => navigation.navigate("ActorViewScreen", { personId: person.id })}
        displayName={displayName || profile.username || friendName}
        username={profile.username}
      />

      <WatchBadgeDetailModal
        badge={selectedShowcaseBadge}
        visible={!!selectedShowcaseBadge}
        onClose={() => setSelectedShowcaseBadge(null)}
        readOnly
      />
    </SafeAreaView>
    </PosterChoicesScope>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  previewActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  // Kapak bölgesi: düğmeler alt kenarda; büyürken alttan açılır (taşan kırpılır).
  bannerZone: { overflow: "hidden", justifyContent: "flex-end" },
  bannerEditRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
  },
  // Düzenleme modu: gizli liste soluk, köşede göz işareti.
  railCardHidden: { opacity: 0.45 },
  railVisibilityDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  editListHint: { fontSize: 12.5, fontWeight: "700", marginTop: -4, marginBottom: 10, paddingHorizontal: 2 },
  container: { flex: 1 },
  ratingSpread: { marginTop: 10 },
  centerContent: { flex: 1, justifyContent: "center", alignItems: "center", gap: 14 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40 },
  emptyText: { fontSize: 14, textAlign: "center" },

  // ── Eylem satırı (Mesaj / ilişki durumu): etiketli, eşit genişlikte ───────
  actionRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  actionButton: { flex: 1, minWidth: 0 },

  // ── Listeler ──────────────────────────────────────────────────────────────
  // Ray ekranın kenarına kadar uzanır (kaydırma içeriğinin 16 px dolgusunu
  // negatif kenar boşluğu geri alır), ilk kart yine içerikle hizalı başlar.
  sharedListsRail: { marginHorizontal: -16 },
  sharedListsPreviewContent: {
    gap: 9,
    paddingHorizontal: 16,
  },
  // ── Liste kartı — ProfileLists (profil rayı) ile BİREBİR aynı çerçeve ────
  railCardBg: {
    position: "absolute",
    top: 0,
    left: 0,
    height: RAIL_CARD_H,
    borderRadius: 20,
  },
  railCardGlow: {
    position: "absolute",
    top: 4,
    left: 4,
    right: 4,
    bottom: 0,
    borderRadius: 20,
    borderWidth: 1,
  },
  railCard: {
    height: RAIL_CARD_H,
    borderRadius: 20,
    overflow: "hidden",
    padding: RAIL_CARD_PADDING,
    alignItems: "center",
    gap: 2,
  },
  railDivider: {
    height: 1,
    alignSelf: "stretch",
    marginHorizontal: 4,
    marginTop: 7,
    marginBottom: 5,
  },
  railCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    gap: 6,
  },
  railIconDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  railCardName: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: -0.2,
    flexShrink: 1,
    maxWidth: 120,
  },
  railCountBadge: {
    fontSize: 12,
    fontWeight: "800",
    marginLeft: "auto",
  },
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
  listModalHeaderActions: {
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
  columnSelectorButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  columnSelectorText: { fontSize: 13, fontWeight: "900" },
  sharedListsModalContent: {
    gap: 10,
  },
  sharedListsModalListGrow: {
    flex: 1,
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

  lockText: { fontSize: 13.5, textAlign: "center" },
});
