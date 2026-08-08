import { Image } from "expo-image";
import React, { useState, useEffect, useCallback, memo, useMemo, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Animated,
  StyleSheet,
  Dimensions
} from "react-native";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  doc,
  updateDoc,
  deleteDoc,
  deleteField,
  increment,
} from "firebase/firestore";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useUserProfile } from "../context/UserProfileContext";
import { getUserProfile } from "../services/userService";
import { clampAvatarIndex, getAvatarSource } from "../utils/avatars";
import { alpha } from "../theme/colors";
import AdaptiveBlurView from "./common/AdaptiveBlurView";
import { MaterialCommunityIcons, Ionicons, Feather } from "@expo/vector-icons";
import * as Haptics from "@services/hapticsService";
import LottieView from "lottie-react-native";
import appAlert from "./AppAlert";
import Toast from "react-native-toast-message";
import { i18nText } from "../utils/i18nText";
import {
  ALL_SCOPE_FILTER,
  normalizeScope,
  scopeKey,
  scopeWriteFields,
  filterForScope,
  scopeForFilter,
  scopeMatchesFilter,
  filterAllowsShowLevelSources,
  isAllFilter,
  summarizeScopes,
} from "../utils/commentScope";
import CommentScopeBar from "./comments/CommentScopeBar";
import CommentScopeSheet from "./comments/CommentScopeSheet";
import CommentScopeBadge, { scopeVisual } from "./comments/CommentScopeBadge";
import { scopeLong } from "./comments/scopeTexts";
import ScreenDecor from "./ScreenDecor";


const { height: SCREEN_H } = Dimensions.get("window");

const resolveTmdbAvatar = (path) => {
  if (!path) return null;
  if (path.startsWith("/http")) return path.slice(1);
  if (path.startsWith("http")) return path;
  return `https://image.tmdb.org/t/p/w185${path}`;
};

const getFeedTimestamp = (item) => {
  if (item.source === "tmdb") {
    return new Date(item.created_at || item.updated_at || 0).getTime() || 0;
  }
  if (typeof item.timestamp?.toMillis === "function") return item.timestamp.toMillis();
  return (item.timestamp?.seconds || 0) * 1000;
};

// Kısa göreli zaman: 4d (dakika), 2s (saat), 3g (gün), 1h (hafta), 1y (yıl).
// Sosyal medya deseni — kullanıcı adının yanında gösterilir.
const shortTimeAgo = (ms) => {
  if (!ms) return i18nText("autoI18n.simdi", "şimdi");
  const mins = Math.floor((Date.now() - ms) / 60000);
  if (mins < 1) return i18nText("autoI18n.simdi", "şimdi");
  if (mins < 60) return `${mins}d`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}s`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}g`;
  const weeks = Math.floor(days / 7);
  if (weeks < 52) return `${weeks}h`;
  return `${Math.floor(days / 365)}y`;
};

const TmdbReviewItem = memo(({ item, theme }) => {
  const styles = getStyles(theme);
  const [expanded, setExpanded] = useState(false);
  const avatarUri = resolveTmdbAvatar(item.author_details?.avatar_path);
  const author =
    item.author_details?.name ||
    item.author ||
    item.author_details?.username ||
    i18nText("autoI18n.tmdb_kullanicisi", "TMDB kullanıcısı");
  const rating = Number(item.author_details?.rating);
  const canExpand = (item.content || "").length > 220;

  return (
    <View style={styles.threadItemContainer}>
      <View style={styles.threadAvatarColumn}>
        <View style={styles.avatarFrame}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={[styles.avatar, styles.roundAvatar]} />
          ) : (
            <View style={[styles.avatar, styles.tmdbAvatarPlaceholder]}>
              <Ionicons name="person" size={17} color={theme.accent} />
            </View>
          )}
        </View>
      </View>

      <View style={styles.threadBody}>
        <View style={styles.threadHeader}>
          <View style={styles.usernameRow}>
            <Text allowFontScaling={false} style={styles.username} numberOfLines={1}>
              {author}
            </Text>
            <View style={[styles.sourceBadge, styles.tmdbSourceBadge]}>
              <Text allowFontScaling={false} style={[styles.sourceBadgeText, styles.tmdbSourceBadgeText]}>
                TMDB
              </Text>
            </View>
            <Text allowFontScaling={false} style={styles.timestamp}>
              {shortTimeAgo(getFeedTimestamp(item))}
            </Text>
          </View>
          {Number.isFinite(rating) && rating > 0 && (
            <View style={styles.tmdbRatingBadge}>
              <Ionicons name="star" size={12} color="#FFD54F" />
              <Text allowFontScaling={false} style={styles.tmdbRatingText}>
                {rating.toFixed(1)}
              </Text>
            </View>
          )}
        </View>

        <Text
          allowFontScaling={false}
          style={styles.commentText}
          numberOfLines={expanded ? undefined : 5}
        >
          {item.content}
        </Text>

        {canExpand && (
          <TouchableOpacity style={styles.readMoreButton} onPress={() => setExpanded((value) => !value)}>
            <Text allowFontScaling={false} style={styles.readMoreText}>
              {expanded
                ? i18nText("autoI18n.daha_az", "Daha az")
                : i18nText("autoI18n.devamini_oku", "Devamını oku")}
            </Text>
            <Ionicons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={14}
              color={theme.accent}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

// ── Yorum Satırı Bileşeni ──────────────────────────────────
const CommentItem = memo(
  ({
    item,
    currentUser,
    contextId,
    replies = [],
    toggleReplyVisibility,
    handleLikeToggle,
    isReply = false,
    isLastReply = false,
    setCommentInputState,
    handleDeleteComment,
    handleDeleteReply,
    isVisible,
    theme,
    avatarIndex, // yazarın güncel avatarı (uid → Users doc'tan); null ise legacy fallback
    // Dizi yorumlarında "Topluluk" rozetinin yerini kapsam rozeti alır
    // (S2·B5); kapsam bilgisi kaynak bilgisinden çok daha ayırt edicidir.
    scopeEnabled = false,
    showSourceBadge = true,
    onScopePress,
  }) => {
    const styles = getStyles(theme);
    const [showSpoiler, setShowSpoiler] = useState(false);
    const scaleAnim = useRef(new Animated.Value(1)).current;

    // Yeni likedBy map formatı, eski likes array'ine fallback.
    // currentUser oturum düşüşünde null olabilir — render crash'lemesin.
    const isLiked =
      item.likedBy?.[currentUser?.uid] ??
      item.likes?.includes(currentUser?.uid) ??
      false;
    const likeCount = item.likeCount ?? item.likes?.length ?? 0;

    const onLikePress = () => {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (e) {}
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.2,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          useNativeDriver: true,
        }),
      ]).start();
      handleLikeToggle(item.id, isLiked);
    };

    // Show the reply count: prefer server-tracked field, fall back to loaded list length
    const totalReplies = Math.max(0, item.replyCount ?? 0) || replies.length;

    const isOwn = item.userId === currentUser?.uid;

    // Kendi yorumu: "..." menüsü → Düzenle / Sil (satır içi ikonlar yerine)
    const openOwnMenu = () => {
      appAlert(
        i18nText("autoI18n.yorum_secenekleri", "Yorum seçenekleri"),
        undefined,
        [
          {
            text: i18nText("autoI18n.duzenle", "Düzenle"),
            onPress: () =>
              setCommentInputState({
                text: item.text,
                isSpoiler: item.isSpoiler,
                parentId: isReply ? item.parentId : null,
                editId: item.id,
                isReply: isReply,
                replieName: item.username,
                replieText: item.text,
                // Düzenlemede kapsam korunur; üst seviye yorumda hedef
                // seçiciyle değiştirilebilir (yanıtta üst yorumdan gelir).
                editScope: isReply ? null : normalizeScope(item),
                parentScope: isReply ? normalizeScope(item) : null,
              }),
          },
          {
            text: i18nText("autoI18n.sil", "Sil"),
            style: "destructive",
            onPress: () =>
              isReply
                ? handleDeleteReply(item.parentId, item.id)
                : handleDeleteComment(item.id),
          },
          { text: i18nText("autoI18n.iptal", "İptal"), style: "cancel" },
        ],
      );
    };

    const startReply = () =>
      setCommentInputState((p) => ({
        ...p,
        parentId: item.id,
        isReply: true,
        replieName: item.username,
        replieText: item.text,
        editId: null,
        // Yanıt, üst yorumun kapsamını devralır — bir bölüm yorumuna verilen
        // yanıt da o bölümün altında kalsın.
        parentScope: normalizeScope(item),
      }));

    return (
      <View style={[styles.threadItemContainer, isReply && styles.threadReplyItem]}>
        {/* Yanıt bağlantısı: üst satırdan avatara kıvrılan çizgi (+ ara yanıtlar
            için düz devam çizgisi) — ekran görüntüsündeki iplik görünümü */}
        {isReply && <View pointerEvents="none" style={styles.replyElbow} />}
        {isReply && !isLastReply && (
          <View pointerEvents="none" style={styles.replyTrunk} />
        )}

        <View style={styles.threadAvatarColumn}>
          <View style={[styles.avatarFrame, isReply && styles.replyAvatarFrame]}>
            {avatarIndex != null ? (
              // Güncel avatar sistemi: avatarIndex → local asset
              <Image
                source={getAvatarSource(avatarIndex)}
                style={[
                  styles.avatar,
                  styles.roundAvatar,
                  isReply && styles.replyAvatar,
                ]}
              />
            ) : item.avatar ? (
              // Legacy: yorumda saklanan photoURL (profil henüz yüklenmediyse)
              <Image
                source={{ uri: item.avatar }}
                style={[
                  styles.avatar,
                  styles.roundAvatar,
                  isReply && styles.replyAvatar,
                ]}
              />
            ) : (
              <View
                style={[
                  styles.avatar,
                  styles.avatarFallback,
                  isReply && styles.replyAvatar,
                ]}
              >
                <Feather
                  name="user"
                  size={isReply ? 14 : 18}
                  color={theme.text.secondary}
                />
              </View>
            )}
          </View>
          {/* Yanıtlar açıkken ilk yanıta inen gövde çizgisi */}
          {!isReply && totalReplies > 0 && isVisible && (
            <View style={styles.threadLine} />
          )}
        </View>

        <View style={[styles.threadBody, isReply && styles.replyBody]}>
          {/* Başlık: kullanıcı adı + kısa zaman aynı satırda, sağda "..." */}
          <View style={styles.threadHeader}>
            <View style={styles.usernameRow}>
              <Text allowFontScaling={false} style={styles.username} numberOfLines={1}>
                {item.username}
              </Text>
              {!isReply && scopeEnabled && (
                <CommentScopeBadge
                  scope={item}
                  theme={theme}
                  onPress={onScopePress ? () => onScopePress(item) : undefined}
                />
              )}
              {!isReply && showSourceBadge && (
                <View style={styles.sourceBadge}>
                  <Text allowFontScaling={false} style={styles.sourceBadgeText}>
                    {i18nText("autoI18n.topluluk", "Topluluk")}
                  </Text>
                </View>
              )}
              <Text allowFontScaling={false} style={styles.timestamp}>
                {shortTimeAgo(getFeedTimestamp(item))}
              </Text>
            </View>

            {isOwn && (
              <TouchableOpacity
                onPress={openOwnMenu}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather
                  name="more-horizontal"
                  size={16}
                  color={theme.text.muted}
                />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.threadContentBody}>
            {item.isSpoiler && !showSpoiler ? (
              <TouchableOpacity
                onPress={() => setShowSpoiler(true)}
                style={styles.spoilerCover}
              >
                <AdaptiveBlurView intensity={25} tint="dark" style={styles.spoilerBlur}>
                  <Ionicons
                    name="eye-off"
                    size={16}
                    color={theme.text.secondary}
                  />
                  <Text allowFontScaling={false} style={styles.spoilerText}>{i18nText("autoI18n.spoiler_icerigi_gor", "Spoiler içeriği gör")}</Text>
                </AdaptiveBlurView>
              </TouchableOpacity>
            ) : (
              <View style={styles.commentContentWrapper}>
                <Text allowFontScaling={false} style={styles.commentText}>
                  {item.text}
                </Text>
                {item.isSpoiler && (
                  <TouchableOpacity
                    onPress={() => setShowSpoiler(false)}
                    style={styles.eyeIconSmall}
                  >
                    <Ionicons name="eye" size={14} color={theme.accent} />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* Eylem satırı: kalp + sayı, yanıt balonu + sayı (ikon ağırlıklı) */}
          <View style={styles.threadActionsRow}>
            <TouchableOpacity onPress={onLikePress} style={styles.actionButton}>
              <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                <MaterialCommunityIcons
                  name={isLiked ? "heart" : "heart-outline"}
                  size={20}
                  color={isLiked ? theme.colors.red : theme.text.secondary}
                />
              </Animated.View>
              {likeCount > 0 && (
                <Text
                  allowFontScaling={false}
                  style={[styles.actionLabel, isLiked && { color: theme.colors.red }]}
                >
                  {likeCount}
                </Text>
              )}
            </TouchableOpacity>

            {!isReply && (
              <TouchableOpacity onPress={startReply} style={styles.actionButton}>
                <Ionicons
                  name="chatbubble-outline"
                  size={18}
                  color={theme.text.secondary}
                />
                {totalReplies > 0 && (
                  <Text allowFontScaling={false} style={styles.actionLabel}>
                    {totalReplies}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Yanıtları gör/gizle bağlantısı (IG deseni: "— Yanıtları gör (N)") */}
          {!isReply && totalReplies > 0 && (
            <TouchableOpacity
              onPress={() => toggleReplyVisibility(item.id)}
              style={styles.repliesToggle}
            >
              <View style={styles.repliesToggleLine} />
              <Text allowFontScaling={false} style={styles.repliesToggleText}>
                {isVisible
                  ? i18nText("autoI18n.yanitlari_gizle", "Yanıtları gizle")
                  : i18nText("autoI18n.yanitlari_gor", "Yanıtları gör ({{count}})", {
                      count: totalReplies,
                    })}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  },
);

// Boş girdi durumu — sıfırlamalar tek yerden.
const EMPTY_INPUT = {
  text: "",
  isSpoiler: false,
  parentId: null,
  editId: null,
  isReply: false,
  replieName: null,
  replieText: null,
  parentScope: null,
  editScope: null,
};

// ── Ana Bileşen ───────────────────────────────────────────
// collectionName: "MovieComment" (film) | "TvComment" (dizi).
//
// DİZİLERDE KAPSAM: yorumlar yine tek koleksiyonda durur, ama her yorum
// dizinin geneline / bir sezona / bir bölüme referans verebilir
// (utils/commentScope.js). Bu sayede kullanıcı bölüm sayfasına girmeden ana
// yorum ekranından hedef seçip yazabilir, üstteki filtreyle de yalnız o kısmın
// yorumlarını görebilir.
//
// Props:
//   seasons      → TMDB sezon listesi (details.seasons). Verilirse kapsam UI'ı açılır.
//   initialScope → ekran açılırken hedeflenecek kapsam (sezon/bölüm sayfasından)
const Comment = ({
  contextId,
  collectionName = "MovieComment",
  mediaTitle = "",
  mediaPoster = null,
  tmdbReviews = [],
  seasons = null,
  initialScope = null,
}) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const { user: currentUser } = useAuth();
  const { avatarIndex: myAvatarIndex } = useUserProfile();
  const [comments, setComments] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [sourceFilter, setSourceFilter] = useState("all");
  const [repliesMap, setRepliesMap] = useState({});
  const [replyVisibility, setReplyVisibility] = useState({});
  const [commentInputState, setCommentInputState] = useState({ ...EMPTY_INPUT });

  const isTv = collectionName === "TvComment";
  const scopeEnabled = isTv;

  // Aktif kapsam filtresi (üst çubuk) + yeni yorumun hedefi (girdi çubuğu).
  // Ekran bir sezon/bölüm sayfasından açıldıysa ikisi de oraya kilitlenir.
  const bootScope = useMemo(
    () => (scopeEnabled && initialScope ? normalizeScope(initialScope) : null),
    // initialScope her render'da yeni nesne olabilir; kimliği anahtarla sabitle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scopeEnabled, initialScope ? scopeKey(initialScope) : null],
  );
  const [scopeFilter, setScopeFilter] = useState(() =>
    bootScope ? filterForScope(bootScope) : { ...ALL_SCOPE_FILTER },
  );
  const [targetScope, setTargetScope] = useState(
    () => bootScope || normalizeScope(null),
  );
  const [scopeSheet, setScopeSheet] = useState({ visible: false, mode: "filter" });

  // One ref per comment — stores its active onSnapshot unsubscribe fn
  const replyUnsubsRef = useRef({});

  // ── Yazarların GÜNCEL avatarları (uid → avatarIndex) ─────────────────────
  // Yorumlar eskiden photoURL saklıyordu; artık profil avatar sistemi
  // (avatarIndex → local asset) kullanılır. Yazar başına tek getDoc,
  // bileşen açık kaldığı sürece cache'lenir — avatar değiştiren kullanıcı
  // eski yorumlarında da güncel avatarıyla görünür.
  const [authorAvatars, setAuthorAvatars] = useState({});
  const avatarFetchRef = useRef(new Set());
  useEffect(() => {
    const uids = new Set();
    comments.forEach((c) => c.userId && uids.add(c.userId));
    Object.values(repliesMap).forEach((reps) =>
      (reps || []).forEach((r) => r.userId && uids.add(r.userId)),
    );
    const missing = [...uids].filter((uid) => !avatarFetchRef.current.has(uid));
    if (missing.length === 0) return;
    missing.forEach((uid) => avatarFetchRef.current.add(uid));
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        missing.map(async (uid) => {
          try {
            const profile = await getUserProfile(uid);
            return [uid, clampAvatarIndex(profile?.avatarIndex)];
          } catch {
            avatarFetchRef.current.delete(uid); // sonraki snapshot'ta tekrar dene
            return null;
          }
        }),
      );
      if (cancelled) return;
      setAuthorAvatars((prev) => {
        const next = { ...prev };
        entries.forEach((entry) => {
          if (entry) next[entry[0]] = entry[1];
        });
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [comments, repliesMap]);

  const normalizedTmdbReviews = useMemo(
    () =>
      (Array.isArray(tmdbReviews) ? tmdbReviews : [])
        .filter((review) => review?.content)
        .map((review, index) => ({
          ...review,
          source: "tmdb",
          feedId: `tmdb:${review.id || index}`,
        })),
    [tmdbReviews],
  );

  // ── Kapsam (dizi / sezon / bölüm) ─────────────────────────────────────────
  // Sayaç ağacı: filtre çipleri ve kapsam sayfası bunu okur.
  const scopeSummary = useMemo(
    () => (scopeEnabled ? summarizeScopes(comments) : null),
    [scopeEnabled, comments],
  );

  // TMDB sezon listesi + yalnız yorumlarda görünen sezonların birleşimi
  // (dizi güncellenmiş, sezon kaldırılmış olabilir — yorum kaybolmasın).
  const seasonOptions = useMemo(() => {
    if (!scopeEnabled) return [];
    const map = new Map();
    (Array.isArray(seasons) ? seasons : []).forEach((season) => {
      const seasonNumber = Number(season?.season_number ?? season?.seasonNumber);
      if (!Number.isFinite(seasonNumber)) return;
      map.set(seasonNumber, {
        seasonNumber,
        name: season?.name || "",
        episodeCount: Number(season?.episode_count ?? season?.episodeCount) || 0,
      });
    });
    (scopeSummary?.seasons || []).forEach((bucket) => {
      if (map.has(bucket.seasonNumber)) return;
      map.set(bucket.seasonNumber, {
        seasonNumber: bucket.seasonNumber,
        name: bucket.title || "",
        episodeCount: 0,
      });
    });
    return [...map.values()].sort((a, b) => a.seasonNumber - b.seasonNumber);
  }, [scopeEnabled, seasons, scopeSummary]);

  // Başka bir içeriğe geçildiğinde (veya sayfa farklı bir kapsamla açıldığında)
  // filtre/hedef sıfırlanmalı — önceki dizinin sezonu üzerinde kalmasın.
  useEffect(() => {
    setScopeFilter(bootScope ? filterForScope(bootScope) : { ...ALL_SCOPE_FILTER });
    setTargetScope(bootScope || normalizeScope(null));
    setCommentInputState({ ...EMPTY_INPUT });
  }, [contextId, collectionName, bootScope]);

  // TMDB incelemeleri dizinin GENELİNE aittir; sezon/bölüm süzgecinde gösterilmez.
  const tmdbVisible = !scopeEnabled || filterAllowsShowLevelSources(scopeFilter);

  const scopedComments = useMemo(
    () =>
      scopeEnabled && !isAllFilter(scopeFilter)
        ? comments.filter((comment) => scopeMatchesFilter(comment, scopeFilter))
        : comments,
    [scopeEnabled, comments, scopeFilter],
  );

  const visibleTmdbReviews = tmdbVisible ? normalizedTmdbReviews : [];

  const feedItems = useMemo(() => {
    const communityItems = scopedComments.map((comment) => ({
      ...comment,
      source: "community",
      feedId: `community:${comment.id}`,
    }));

    if (sourceFilter === "community") return communityItems;
    if (sourceFilter === "tmdb") return visibleTmdbReviews;

    return [...communityItems, ...visibleTmdbReviews].sort((a, b) => {
      const timeDiff = getFeedTimestamp(b) - getFeedTimestamp(a);
      if (timeDiff !== 0) return timeDiff;
      return a.source === "community" ? -1 : 1;
    });
  }, [scopedComments, visibleTmdbReviews, sourceFilter]);

  const sourceFilters = [
    {
      key: "all",
      label: i18nText("autoI18n.tumu", "Tümü"),
      count: scopedComments.length + visibleTmdbReviews.length,
    },
    {
      key: "community",
      label: i18nText("autoI18n.topluluk", "Topluluk"),
      count: scopedComments.length,
    },
    { key: "tmdb", label: "TMDB", count: visibleTmdbReviews.length },
  ];

  // Kaynak süzgeci ancak süzecek TMDB incelemesi varken anlamlı — yoksa
  // "Tümü" ile "Topluluk" aynı listedir, satır yer kaplamasın.
  const showSourceFilter = normalizedTmdbReviews.length > 0;

  // TMDB seçiliyken kapsam daraltılırsa liste boş kalmasın: kaynağı geri al.
  useEffect(() => {
    if (!tmdbVisible && sourceFilter === "tmdb") setSourceFilter("all");
    if (!showSourceFilter && sourceFilter !== "all") setSourceFilter("all");
  }, [tmdbVisible, showSourceFilter, sourceFilter]);

  // Yanıt üst yorumun kapsamını devralır; düzenlemede yorumun kendi kapsamı
  // korunur; yeni üst seviye yorumda hedef seçicinin değeri kullanılır.
  const activeScope = commentInputState.isReply
    ? commentInputState.parentScope || normalizeScope(null)
    : commentInputState.editId
      ? commentInputState.editScope || targetScope
      : targetScope;
  const scopeLocked = commentInputState.isReply;

  const openScopeSheet = useCallback(
    (mode) => setScopeSheet({ visible: true, mode }),
    [],
  );
  const closeScopeSheet = useCallback(
    () => setScopeSheet((prev) => ({ ...prev, visible: false })),
    [],
  );

  const handleScopeFilterChange = useCallback((next) => {
    setScopeFilter(next);
    // Filtre değişince yeni yorumun hedefi de oraya kayar: bir sezonu süzüp
    // doğrudan o sezona yazmak tek dokunuş olsun.
    setTargetScope(scopeForFilter(next));
  }, []);

  const handleScopeSheetSelect = useCallback(
    (selection) => {
      if (scopeSheet.mode === "filter") {
        handleScopeFilterChange(selection);
        return;
      }
      const scope = normalizeScope(selection);
      setTargetScope(scope);
      // Düzenlenen üst seviye yorumun kapsamı da değişsin.
      setCommentInputState((prev) =>
        prev.editId && !prev.isReply ? { ...prev, editScope: scope } : prev,
      );
    },
    [scopeSheet.mode, handleScopeFilterChange],
  );

  // ── Comments listener ────────────────────────────────────
  useEffect(() => {
    if (!contextId) return;
    const cid = contextId.toString();
    const q = query(
      collection(db, collectionName, cid, "comments"),
      orderBy("timestamp", "desc"),
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const loaded = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setComments(loaded);
    });
    return () => unsub();
  }, [contextId, collectionName]);

  // ── Cleanup all reply subscriptions on unmount ───────────
  useEffect(() => {
    return () => {
      Object.values(replyUnsubsRef.current).forEach((u) => u());
      replyUnsubsRef.current = {};
    };
  }, []);

  // ── Lazy reply subscription: open on expand, close on collapse ──
  const toggleReplyVisibility = useCallback(
    (id) => {
      setReplyVisibility((prev) => {
        const willBeVisible = !prev[id];

        if (willBeVisible && !replyUnsubsRef.current[id]) {
          const cid = contextId.toString();
          const rq = query(
            collection(db, collectionName, cid, "comments", id, "replies"),
            orderBy("timestamp", "asc"),
          );
          replyUnsubsRef.current[id] = onSnapshot(rq, (snap) => {
            setRepliesMap((rm) => ({
              ...rm,
              [id]: snap.docs.map((d) => ({
                id: d.id,
                ...d.data(),
                parentId: id,
              })),
            }));
          });
        } else if (!willBeVisible && replyUnsubsRef.current[id]) {
          replyUnsubsRef.current[id]();
          delete replyUnsubsRef.current[id];
        }

        return { ...prev, [id]: willBeVisible };
      });
    },
    [contextId, collectionName],
  );

  // ── Add / Edit ───────────────────────────────────────────
  const handleAddOrEdit = async () => {
    const { text, isSpoiler, parentId, editId, isReply } = commentInputState;
    if (!text.trim() || isSending) return;
    setIsSending(true);
    const cid = contextId.toString();
    // Kapsam alanları YALNIZ dizide yazılır; filmde şema eskisi gibi kalır.
    const scopeFields = scopeEnabled ? scopeWriteFields(activeScope) : null;

    try {
      let newRef = null;
      if (editId) {
        const ref = isReply
          ? doc(db, collectionName, cid, "comments", parentId, "replies", editId)
          : doc(db, collectionName, cid, "comments", editId);
        await updateDoc(ref, {
          text: text.trim(),
          isSpoiler,
          // Yanıtın kapsamı üst yorumunkidir; üst seviye yorumda hedef
          // düzenleme sırasında değiştirilmiş olabilir.
          ...(scopeFields || {}),
        });
      } else if (isReply) {
        newRef = await addDoc(
          collection(db, collectionName, cid, "comments", parentId, "replies"),
          {
            userId:      currentUser.uid,
            username:    currentUser.displayName || "Anonim",
            avatar:      currentUser.photoURL,
            avatarIndex: clampAvatarIndex(myAvatarIndex),
            text:        text.trim(),
            isSpoiler,
            parentId,
            likeCount:   0,
            likedBy:     {},
            timestamp:   serverTimestamp(),
            ...(scopeFields || {}),
          },
        );
        // Increment replyCount on parent comment
        await updateDoc(doc(db, collectionName, cid, "comments", parentId), {
          replyCount: increment(1),
        });
      } else {
        newRef = await addDoc(
          collection(db, collectionName, cid, "comments"),
          {
            userId:      currentUser.uid,
            username:    currentUser.displayName || "Anonim",
            avatar:      currentUser.photoURL,
            avatarIndex: clampAvatarIndex(myAvatarIndex),
            text:        text.trim(),
            isSpoiler,
            parentId:    null,
            likeCount:   0,
            likedBy:     {},
            replyCount:  0,
            timestamp:   serverTimestamp(),
            ...(scopeFields || {}),
          },
        );
      }

      // Yeni yorum/yanıt eklendiyse: kullanıcının yorum sayacını artır VE
      // "Etkinliklerim → Yorumlarım" için denormalize kopya yaz (best-effort).
      // mirror doc id = yorum/yanıt id'si → silmede senkron kaldırılır.
      if (!editId && newRef) {
        updateDoc(doc(db, "Users", currentUser.uid), {
          mediaCommentCount: increment(1),
        }).catch(() => {});
        setDoc(doc(db, "Users", currentUser.uid, "myComments", newRef.id), {
          kind: collectionName === "TvComment" ? "tv" : "movie",
          targetId: cid,
          // Hesap silme purge'u yanıtın yolunu (comments/{parentId}/replies/{id})
          // YALNIZ buradan kurabilir; üst yorum id'si olmadan yanıt bulunamaz
          // (services/accountService.js → "media-comments" adımı).
          parentId: isReply ? parentId : null,
          text: text.trim(),
          title: mediaTitle || "",
          poster: mediaPoster || null,
          createdAt: serverTimestamp(),
          // "Etkinliklerim → Yorumlarım" satırındaki S2·B5 rozeti buradan gelir.
          ...(scopeFields || {}),
        }).catch(() => {});
      } else if (editId && scopeFields) {
        // Kapsam düzenlemede değişmiş olabilir — mirror'ı da hizala.
        updateDoc(doc(db, "Users", currentUser.uid, "myComments", editId), {
          text: text.trim(),
          ...scopeFields,
        }).catch(() => {});
      }

      // Yazılan yorum aktif süzgeçte görünmüyorsa (ör. "Tümü"yü gezerken S2·B5
      // hedefine yazmak) listeyi oraya kaydır — yorum kaybolmuş gibi durmasın.
      if (scopeFields && !scopeMatchesFilter(activeScope, scopeFilter)) {
        setScopeFilter(filterForScope(activeScope));
      }

      setCommentInputState({ ...EMPTY_INPUT });
    } catch (e) {
      // Örn. yanıt yazarken üst yorum silinmişse updateDoc "No document to
      // update" ile reddeder — catch olmadan unhandled rejection olur ve
      // kullanıcı hiçbir geri bildirim almazdı.
      Toast.show({
        type: "error",
        text1: i18nText("autoI18n.yorum_kaydedilemedi", "Yorum kaydedilemedi"),
      });
    } finally {
      setIsSending(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────
  const handleDelete = async (id, pid = null) => {
    const cid = contextId.toString();
    try {
      if (pid) {
        await deleteDoc(
          doc(db, collectionName, cid, "comments", pid, "replies", id),
        );
        // Decrement replyCount (guard against going below 0). Üst yorum bu
        // arada silinmiş olabilir — sayaç düşümü best-effort.
        await updateDoc(doc(db, collectionName, cid, "comments", pid), {
          replyCount: increment(-1),
        }).catch(() => {});
      } else {
        // Close any open reply subscription before deleting the comment
        if (replyUnsubsRef.current[id]) {
          replyUnsubsRef.current[id]();
          delete replyUnsubsRef.current[id];
        }
        await deleteDoc(doc(db, collectionName, cid, "comments", id));
      }
    } catch (e) {
      Toast.show({
        type: "error",
        text1: i18nText("autoI18n.islem_basarisiz", "İşlem başarısız"),
      });
      return;
    }
    // Kullanıcının yorum sayacını azalt + denormalize kopyayı kaldır (best-effort).
    updateDoc(doc(db, "Users", currentUser.uid), {
      mediaCommentCount: increment(-1),
    }).catch(() => {});
    deleteDoc(doc(db, "Users", currentUser.uid, "myComments", id)).catch(() => {});
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : null}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      style={styles.container}
    >
      {/* Arka plan dekoru (ikon deseni + kar) — içeriğin ARKASINDA */}
      <ScreenDecor iconOpacity={0.25} />
      {scopeEnabled && (
        <CommentScopeBar
          theme={theme}
          seasons={seasonOptions}
          summary={scopeSummary}
          value={scopeFilter}
          onChange={handleScopeFilterChange}
          onOpenPicker={() => openScopeSheet("filter")}
        />
      )}

      {showSourceFilter && (
        <View style={styles.sourceFilterRow}>
          {sourceFilters.map((filter) => {
            const selected = sourceFilter === filter.key;
            const disabled = filter.key === "tmdb" && !tmdbVisible;
            return (
              <TouchableOpacity
                key={filter.key}
                activeOpacity={0.8}
                disabled={disabled}
                onPress={() => setSourceFilter(filter.key)}
                style={[
                  styles.sourceFilterButton,
                  selected && styles.sourceFilterButtonActive,
                  disabled && styles.sourceFilterButtonDisabled,
                ]}
              >
                <Text
                  allowFontScaling={false}
                  style={[styles.sourceFilterText, selected && styles.sourceFilterTextActive]}
                >
                  {filter.label}
                </Text>
                <View style={[styles.sourceFilterCount, selected && styles.sourceFilterCountActive]}>
                  <Text
                    allowFontScaling={false}
                    style={[styles.sourceFilterCountText, selected && styles.sourceFilterCountTextActive]}
                  >
                    {filter.count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <FlatList
        style={styles.commentList}
        data={feedItems}
        keyExtractor={(item) => item.feedId}
        contentContainerStyle={[
          styles.listContent,
          scopeEnabled && styles.listContentScoped,
        ]}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={styles.feedSeparator} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="comment-text-multiple-outline"
              size={28}
              color={theme.text.muted}
            />
            <Text allowFontScaling={false} style={styles.emptyStateTitle}>
              {scopeEnabled && !isAllFilter(scopeFilter)
                ? i18nText("autoI18n.bu_kapsamda_yorum_yok", "Bu kısımda henüz yorum yok")
                : i18nText("autoI18n.henuz_yorum_yok", "Henüz yorum yok")}
            </Text>
            <Text allowFontScaling={false} style={styles.emptyStateText}>
              {sourceFilter === "tmdb"
                ? i18nText("autoI18n.tmdb_yorumu_bulunamadi", "Bu içerik için TMDB yorumu bulunamadı.")
                : scopeEnabled && !isAllFilter(scopeFilter)
                  ? i18nText(
                      "autoI18n.ilk_yorumu_bu_kisma_sen_yap",
                      "Aşağıdaki hedef {scope} olarak ayarlı — ilk yorumu sen yaz.",
                    ).replace(/\{\{?\s*scope\s*\}?\}/g, scopeLong(scopeForFilter(scopeFilter)))
                  : i18nText("autoI18n.ilk_yorumu_sen_yap", "İlk yorumu sen yap.")}
            </Text>
            {scopeEnabled && !isAllFilter(scopeFilter) && (
              <TouchableOpacity
                onPress={() => handleScopeFilterChange({ ...ALL_SCOPE_FILTER })}
                style={styles.emptyStateAction}
              >
                <Ionicons name="albums-outline" size={14} color={theme.accent} />
                <Text allowFontScaling={false} style={styles.emptyStateActionText}>
                  {i18nText("autoI18n.tum_yorumlari_gor", "Tüm yorumları gör")}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        }
        renderItem={({ item }) =>
          item.source === "tmdb" ? (
            <TmdbReviewItem item={item} theme={theme} />
          ) : (
          <View>
            <CommentItem
              item={item}
              currentUser={currentUser}
              contextId={contextId}
              theme={theme}
              avatarIndex={authorAvatars[item.userId] ?? item.avatarIndex ?? null}
              replies={repliesMap[item.id] || []}
              isVisible={replyVisibility[item.id]}
              toggleReplyVisibility={toggleReplyVisibility}
              scopeEnabled={scopeEnabled}
              showSourceBadge={showSourceFilter}
              onScopePress={(comment) =>
                handleScopeFilterChange(filterForScope(comment))
              }
              handleLikeToggle={(id, liked) => {
                if (!currentUser?.uid) return;
                const ref = doc(db, collectionName, contextId.toString(), "comments", id);
                // Yorum bu arada silinmiş olabilir — reddi yut (unhandled
                // rejection olmasın), snapshot listesi zaten güncellenir.
                if (liked) {
                  updateDoc(ref, {
                    likeCount: increment(-1),
                    [`likedBy.${currentUser.uid}`]: deleteField(),
                  }).catch(() => {});
                } else {
                  updateDoc(ref, {
                    likeCount: increment(1),
                    [`likedBy.${currentUser.uid}`]: true,
                  }).catch(() => {});
                }
              }}
              setCommentInputState={setCommentInputState}
              handleDeleteComment={(id) => handleDelete(id)}
              handleDeleteReply={(pid, id) => handleDelete(id, pid)}
            />
            {replyVisibility[item.id] &&
              repliesMap[item.id]?.map((rep, repIndex, repArr) => (
                <CommentItem
                  key={rep.id}
                  item={rep}
                  currentUser={currentUser}
                  isReply
                  isLastReply={repIndex === repArr.length - 1}
                  theme={theme}
                  avatarIndex={authorAvatars[rep.userId] ?? rep.avatarIndex ?? null}
                  setCommentInputState={setCommentInputState}
                  handleDeleteReply={(pid, id) => handleDelete(id, pid)}
                  handleLikeToggle={(id, liked) => {
                    if (!currentUser?.uid) return;
                    const ref = doc(
                      db, collectionName, contextId.toString(),
                      "comments", item.id, "replies", id,
                    );
                    if (liked) {
                      updateDoc(ref, {
                        likeCount: increment(-1),
                        [`likedBy.${currentUser.uid}`]: deleteField(),
                      }).catch(() => {});
                    } else {
                      updateDoc(ref, {
                        likeCount: increment(1),
                        [`likedBy.${currentUser.uid}`]: true,
                      }).catch(() => {});
                    }
                  }}
                />
              ))}
          </View>
          )
        }
      />

      {/* Input Section */}
      <View style={styles.inputWrapper}>
        {(commentInputState.isReply || commentInputState.editId) && (
          <View style={styles.activeModeIndicator}>
            <View style={styles.indicatorBadge}>
              <Text allowFontScaling={false} style={styles.indicatorText}>
                {commentInputState.editId
                  ? i18nText("autoI18n.duzenleniyor", "Düzenleniyor")
                  : i18nText("autoI18n.replying_to_user", "{{name}} kişisine yanıt", { name: commentInputState.replieName })}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setCommentInputState({ ...EMPTY_INPUT })}
            >
              <Ionicons name="close-circle" size={20} color={theme.colors.red} />
            </TouchableOpacity>
          </View>
        )}

        {/* Yorum hedefi — "her bölüme girmeden" buradan sezon/bölüm seçilir.
            Yanıtta üst yorumun kapsamı devralınır ve kilitli gösterilir. */}
        {scopeEnabled && (
          <TouchableOpacity
            activeOpacity={scopeLocked ? 1 : 0.8}
            disabled={scopeLocked}
            onPress={() => openScopeSheet("target")}
            style={[
              styles.targetPill,
              {
                borderColor: alpha(scopeVisual(activeScope, theme).color, 0.45),
                backgroundColor: alpha(scopeVisual(activeScope, theme).color, 0.12),
              },
            ]}
          >
            <Ionicons
              name={scopeVisual(activeScope, theme).icon}
              size={13}
              color={scopeVisual(activeScope, theme).color}
            />
            <Text allowFontScaling={false} style={styles.targetPillLabel}>
              {i18nText("autoI18n.hedef", "Hedef")}
            </Text>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={styles.targetPillValue}
            >
              {scopeLong(activeScope)}
            </Text>
            <Ionicons
              name={scopeLocked ? "lock-closed" : "chevron-down"}
              size={scopeLocked ? 11 : 14}
              color={theme.text.muted}
            />
          </TouchableOpacity>
        )}

        <View style={styles.inputRow}>
          {commentInputState.isSpoiler && (
            <Text
              allowFontScaling={false}
              style={[
                styles.spoilerBtnText,
                commentInputState.isSpoiler && { color: theme.colors.red },
              ]}
            >
              {i18nText("autoI18n.spoiler", "Spoiler")}
            </Text>
          )}
          <TextInput
            style={[
              styles.input,
              commentInputState.isSpoiler && styles.spoilerCoverInput,
            ]}
            placeholder={i18nText("autoI18n.yorum_yap", "Yorum yap...")}
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={commentInputState.text}
            onChangeText={(t) =>
              setCommentInputState((p) => ({ ...p, text: t }))
            }
            maxLength={500}
            multiline
          />

          <View style={styles.inputFooter}>
            <TouchableOpacity
              onPress={() =>
                setCommentInputState((p) => ({ ...p, isSpoiler: !p.isSpoiler }))
              }
              style={[
                styles.spoilerButton,
                commentInputState.isSpoiler && styles.spoilerActive,
              ]}
            >
              <MaterialCommunityIcons
                name="alert-decagram"
                size={16}
                color={
                  commentInputState.isSpoiler
                    ? theme.colors.red
                    : theme.text.muted
                }
              />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[
              styles.sendButton,
              !commentInputState.text.trim() && styles.disabledBtn,
            ]}
            onPress={handleAddOrEdit}
            disabled={isSending}
          >
            {isSending ? (
              <LottieView
                source={require("@lottie/loading15.json")}
                autoPlay
                loop
                style={{ width: 35, height: 35 }}
              />
            ) : (
              <Feather name="arrow-up" size={22} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {scopeEnabled && (
        <CommentScopeSheet
          visible={scopeSheet.visible}
          onClose={closeScopeSheet}
          mode={scopeSheet.mode}
          theme={theme}
          showId={contextId}
          seasons={seasonOptions}
          summary={scopeSummary}
          value={scopeSheet.mode === "filter" ? scopeFilter : activeScope}
          onSelect={handleScopeSheetSelect}
        />
      )}
    </KeyboardAvoidingView>
  );
};

const getStyles = (theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.primary },
    commentList: { flex: 1 },
    // gap: üst seviye öğeler (yorum blokları / TMDB incelemeleri) arası boşluk;
    // araya feedSeparator çizgisi girer (gap ayraç öncesi/sonrasına da uygulanır).
    listContent: { padding: 15, paddingBottom: 160, flexGrow: 1, gap: 10 },
    // Dizide girdi kutusunun üstünde bir de "Hedef" satırı var.
    listContentScoped: { paddingBottom: 205 },
    // Üst seviye yorumlar arasındaki ince ayraç çizgisi — ekran kenarından
    // kenarına uzanır (negatif margin, listContent padding'ini sıfırlar).
    feedSeparator: {
      height: StyleSheet.hairlineWidth,
      marginHorizontal: -15,
      backgroundColor: alpha(theme.border, 0.9),
    },

    sourceFilterRow: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 15,
      paddingTop: 12,
      paddingBottom: 4,
      backgroundColor: theme.primary,
    },
    sourceFilterButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.secondary,
    },
    sourceFilterButtonActive: {
      borderColor: alpha(theme.accent, 0.55),
      backgroundColor: alpha(theme.accent, 0.16),
    },
    // Sezon/bölüm süzgecinde TMDB incelemesi yoktur — çip sönük ve pasif.
    sourceFilterButtonDisabled: { opacity: 0.4 },
    sourceFilterText: { color: theme.text.muted, fontSize: 12, fontWeight: "700" },
    sourceFilterTextActive: { color: theme.text.primary },
    sourceFilterCount: {
      minWidth: 19,
      height: 19,
      paddingHorizontal: 5,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.primary,
    },
    sourceFilterCountActive: { backgroundColor: alpha(theme.accent, 0.3) },
    sourceFilterCountText: { color: theme.text.muted, fontSize: 10, fontWeight: "800" },
    sourceFilterCountTextActive: { color: theme.text.primary },

    itemContainer: {
      marginBottom: 18,
      backgroundColor: theme.primary,
      borderRadius: 20,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.border,
    },
    ownComment: {
      borderColor: alpha(theme.accent, 0.3),
      backgroundColor: alpha(theme.accent, 0.5),
      borderWidth: 1,
      borderLeftWidth: 3,
      borderLeftColor: theme.accent,
    },
    // ── Düz (flat) sosyal yorum düzeni — avatar solda, gövde sağda, kart yok ──
    // Dikey dolgu satırda değil GÖVDEDE tutulur; böylece avatar kolonu satırın
    // tam yüksekliğine uzanır ve iplik çizgisi (threadLine) satır sınırına
    // kadar iner → yanıtın kavis çizgisi (replyElbow, top:0) ile boşluksuz
    // birleşir.
    threadItemContainer: {
      flexDirection: "row",
      gap: 10,
    },
    threadReplyItem: {
      paddingLeft: 48,
    },
    threadAvatarColumn: {
      width: 38,
      alignItems: "center",
    },
    avatarFrame: {
      width: 38,
      height: 38,
      borderRadius: 19,
      marginTop: 10,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: alpha(theme.border, 0.9),
      backgroundColor: theme.secondary,
    },
    replyAvatarFrame: {
      width: 30,
      height: 30,
      borderRadius: 15,
      marginTop: 8,
    },
    replyAvatar: { width: 26, height: 26, borderRadius: 13 },
    avatarFallback: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.primary,
    },
    // Ana yorumun altındaki dikey iplik — yanıtlar açıkken görünür
    threadLine: {
      flex: 1,
      width: 1.5,
      marginTop: 6,
      borderRadius: 1,
      backgroundColor: alpha(theme.border, 0.95),
    },
    // Yanıt satırı: ipten avatara kıvrılan "L" çizgisi
    replyElbow: {
      position: "absolute",
      left: 19,
      top: 0,
      width: 33,
      height: 23,
      borderLeftWidth: 1.5,
      borderBottomWidth: 1.5,
      borderBottomLeftRadius: 14,
      borderColor: alpha(theme.border, 0.95),
    },
    // Ara yanıtlarda ip alttaki yanıta doğru düz devam eder
    replyTrunk: {
      position: "absolute",
      left: 19,
      top: 0,
      bottom: 0,
      width: 1.5,
      backgroundColor: alpha(theme.border, 0.95),
    },
    threadBody: {
      flex: 1,
      minWidth: 0,
      paddingVertical: 10,
    },
    replyBody: { paddingVertical: 8 },
    threadHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 3,
      gap: 8,
    },
    threadContentBody: { marginTop: 1, marginBottom: 2 },
    threadActionsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 22,
      marginTop: 8,
    },
    replyMargin: {
      marginLeft: 35,
      borderLeftWidth: 2,
      borderLeftColor: theme.accent,
    },

    itemHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    userInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
    userTextGroup: { flex: 1, minWidth: 0 },
    usernameRow: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    avatar: { width: 34, height: 34 },
    roundAvatar: { borderRadius: 17 },
    username: { color: theme.text.primary, fontSize: 14, fontWeight: "700", flexShrink: 1 },
    timestamp: { color: theme.text.muted, fontSize: 12, fontWeight: "500" },
    sourceBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 7,
      backgroundColor: alpha(theme.accent, 0.16),
    },
    sourceBadgeText: { color: theme.accent, fontSize: 8, fontWeight: "800" },
    tmdbSourceBadge: { backgroundColor: "rgba(1,180,228,0.14)" },
    tmdbSourceBadgeText: { color: "#01B4E4" },

    tmdbReviewContainer: {
      borderColor: "rgba(1,180,228,0.28)",
      borderLeftWidth: 3,
      borderLeftColor: "#01B4E4",
    },
    tmdbAvatarPlaceholder: {
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: alpha(theme.accent, 0.14),
    },
    tmdbRatingBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 7,
      paddingVertical: 4,
      borderRadius: 10,
      backgroundColor: "rgba(255,213,79,0.1)",
    },
    tmdbRatingText: { color: "#FFD54F", fontSize: 11, fontWeight: "800" },
    readMoreButton: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      marginTop: 10,
    },
    readMoreText: { color: theme.accent, fontSize: 12, fontWeight: "700" },

    contentBody: { marginVertical: 8 },
    commentText: { color: theme.text.primary, fontSize: 14, lineHeight: 20 },
    commentContentWrapper: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    eyeIconSmall: { padding: 4 },

    spoilerCover: { borderRadius: 12, overflow: "hidden" },
    spoilerBlur: {
      padding: 15,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    spoilerText: { color: theme.text.secondary, fontSize: 12, fontWeight: "600" },

    actionButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingVertical: 2,
    },
    actionLabel: { color: theme.text.secondary, fontSize: 12.5, fontWeight: "600" },
    // "— Yanıtları gör (N)" bağlantısı (IG deseni: kısa çizgi + metin)
    repliesToggle: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 10,
      paddingVertical: 2,
    },
    repliesToggleLine: {
      width: 26,
      height: 1,
      backgroundColor: theme.text.muted,
      opacity: 0.5,
    },
    repliesToggleText: { color: theme.text.muted, fontSize: 12, fontWeight: "700" },

    inputWrapper: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      padding: 15,
      borderTopWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.primary,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      justifyContent: "space-between",
    },
    input: {
      flex: 1,
      minHeight: 45,
      maxHeight: 100,
      backgroundColor: theme.secondary,
      borderRadius: 22,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 12,
      color: theme.text.primary,
    },
    spoilerCoverInput: {
      borderWidth: 1,
      borderColor: theme.notesColor.redBackground,
      overflow: "hidden",
    },

    sendButton: {
      width: 45,
      height: 45,
      borderRadius: 22.5,
      backgroundColor: theme.accent,
      justifyContent: "center",
      alignItems: "center",
    },
    disabledBtn: { backgroundColor: theme.secondaryt, opacity: 0.5 },

    inputFooter: { flexDirection: "row", justifyContent: "flex-start" },
    spoilerButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 24,
      backgroundColor: theme.secondary,
    },
    spoilerActive: { backgroundColor: alpha(theme.colors.red, 0.1) },
    spoilerBtnText: {
      position: "absolute",
      top: -10,
      left: 15,
      color: theme.text.muted,
      fontSize: 12,
      fontWeight: "600",
      zIndex: 1,
    },

    activeModeIndicator: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    indicatorBadge: {
      backgroundColor: alpha(theme.accent, 0.15),
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 8,
    },
    indicatorText: { color: theme.accent, fontSize: 11, fontWeight: "700" },

    // ── Yorum hedefi (dizi/sezon/bölüm) ──────────────────────────────────
    targetPill: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      maxWidth: "100%",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      marginBottom: 8,
      borderRadius: 14,
      borderWidth: 1,
    },
    targetPillLabel: {
      color: theme.text.muted,
      fontSize: 10.5,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    targetPillValue: {
      flexShrink: 1,
      color: theme.text.primary,
      fontSize: 12,
      fontWeight: "700",
    },

    emptyState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 32,
      paddingBottom: 80,
    },
    emptyStateTitle: {
      color: theme.text.primary,
      fontSize: 15,
      fontWeight: "700",
      marginTop: 10,
    },
    emptyStateText: {
      color: theme.text.muted,
      fontSize: 12,
      textAlign: "center",
      marginTop: 4,
    },
    emptyStateAction: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 14,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: alpha(theme.accent, 0.45),
      backgroundColor: alpha(theme.accent, 0.12),
    },
    emptyStateActionText: {
      color: theme.accent,
      fontSize: 12,
      fontWeight: "800",
    },
  });

export default Comment;
