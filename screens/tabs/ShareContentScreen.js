import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  RefreshControl,
  Animated,
  Pressable,
  ActivityIndicator,
  Modal,
  Share,
} from "react-native";
import { Image } from "expo-image";
import AppIcon from "../../components/AppIcon";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { useProfileUi } from "../../context/ProfileUiContext";
import { usePosts } from "../../context/PostsContext";
import {
  useApiSettings,
  useImageQualitySettings,
} from "../../context/AppSettingsContext";
import CreatePostModal from "@components/modals/CreatePostModal";
import PostCommentSheetModal from "@components/modals/PostCommentSheetModal";
import StaggerItem from "@components/StaggerItem";
import BackButton from "@components/BackButton";
import RatingStars from "../../components/RatingStars";
import { getAvatarSource } from "../../utils/avatars";
import { i18nText } from "../../utils/i18nText";
import { appAlert } from "@components/AppAlert";
import { toast } from "@components/AppToast";
import { reportPost } from "../../services/postsService";
import axios from "axios";

const { width } = Dimensions.get("window");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const POST_TYPES = { ALL: "all", REVIEW: "review", LIST: "list", FOLLOWING: "following" };

const formatTimeAgo = (timestamp, ago) => {
  if (!timestamp) return "";
  const diffMs = Date.now() - timestamp;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return ago.now;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} ${ago.minute}`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ${ago.hour}`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d} ${ago.day}`;
  const w = Math.floor(d / 7);
  return `${w} ${ago.week}`;
};

// ─── Memoized Components ──────────────────────────────────────────────────────

const TrendingRail = memo(function TrendingRail({ theme, label, data, onPressItem }) {
  const renderItem = useCallback(
    ({ item, index }) => (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => onPressItem?.(item)}
        style={[trStyles.card, { borderColor: theme.border }]}
      >
        <Image
          source={{ uri: item.poster }}
          style={trStyles.poster}
          contentFit="cover"
          recyclingKey={`trending-${item.id}`}
          cachePolicy="memory-disk"
          transition={120}
        />
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.85)"]}
          style={trStyles.gradient}
        />
        <View style={trStyles.rankBadge}>
          <Text style={trStyles.rankText}>#{index + 1}</Text>
        </View>
        <Text style={trStyles.title} numberOfLines={1}>
          {item.title}
        </Text>
      </TouchableOpacity>
    ),
    [theme.border, onPressItem],
  );

  if (!data || data.length === 0) return null;

  return (
    <View style={trStyles.container}>
      <View style={trStyles.headerRow}>
        <AppIcon family="MaterialCommunityIcons" name="fire" size={18} color="#FF8A00" />
        <Text style={[trStyles.headerLabel, { color: theme.text.primary }]}>
          {label}
        </Text>
      </View>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={data}
        keyExtractor={(it) => String(it.id)}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
      />
    </View>
  );
});

const FilterChips = memo(function FilterChips({ theme, t, active, onChange }) {
  const items = [
    { key: POST_TYPES.ALL, label: t.filters.all, icon: "apps-outline" },
    { key: POST_TYPES.REVIEW, label: t.filters.reviews, icon: "star-outline" },
    { key: POST_TYPES.LIST, label: t.filters.lists, icon: "list-outline" },
    {
      key: POST_TYPES.FOLLOWING,
      label: t.filters.following,
      icon: "people-outline",
    },
  ];
  return (
    <View style={chipStyles.container}>
      {items.map((item) => {
        const isActive = active === item.key;
        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            style={({ pressed }) => [
              chipStyles.chip,
              {
                backgroundColor: isActive ? theme.accent : theme.secondary,
                borderColor: isActive ? theme.accent : theme.border,
                transform: [{ scale: pressed ? 0.96 : 1 }],
              },
            ]}
          >
            <AppIcon
              family="Ionicons"
              name={item.icon}
              size={14}
              color={isActive ? "#fff" : theme.text.secondary}
            />
            <Text
              style={[
                chipStyles.label,
                {
                  color: isActive ? "#fff" : theme.text.secondary,
                  fontWeight: isActive ? "700" : "600",
                },
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});

const LikeButton = memo(function LikeButton({ liked, count, onPress, theme }) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = useCallback(() => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.3, useNativeDriver: true, friction: 4 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 4 }),
    ]).start();
    onPress();
  }, [onPress, scale]);

  return (
    <TouchableOpacity
      style={postStyles.actionBtn}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <AppIcon
          family="Ionicons"
          name={liked ? "heart" : "heart-outline"}
          size={19}
          color={liked ? "#FF5A5F" : theme.text.secondary}
        />
      </Animated.View>
      <Text
        style={[
          postStyles.actionText,
          { color: liked ? "#FF5A5F" : theme.text.secondary },
        ]}
      >
        {count}
      </Text>
    </TouchableOpacity>
  );
});

const PostCard = memo(function PostCard({
  post,
  theme,
  t,
  currentUid,
  onLike,
  onBookmark,
  onComment,
  onEdit,
  onDelete,
  onPressAuthor,
  onShare,
  onReport,
}) {
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const showSpoiler = post.hasSpoiler && !spoilerRevealed;
  const isOwner = currentUid && post.authorId === currentUid;

  const accentColor =
    post.type === "list"
      ? theme.colors?.green || "#3ddc84"
      : theme.colors?.blue || "#4a7cf6";

  const timeText = formatTimeAgo(post._createdAtMs || 0, t.timeAgo);

  // Avatar çözümleme önceliği:
  //   1) authorAvatarIndex (Firestore'da tutulan sayı) → local require()
  //   2) Legacy authorAvatar (URL string veya require sonucu) → fallback
  //   3) Hiçbiri yoksa default
  const avatarSrc =
    typeof post.authorAvatarIndex === "number"
      ? getAvatarSource(post.authorAvatarIndex)
      : typeof post.authorAvatar === "string"
        ? { uri: post.authorAvatar }
        : post.authorAvatar || getAvatarSource(0);

  return (
    <View
      style={[
        postStyles.card,
        {
          backgroundColor: theme.secondary,
          borderColor: theme.border,
          borderLeftColor: accentColor,
        },
      ]}
    >
      {/* Header */}
      <View style={postStyles.header}>
        <TouchableOpacity
          style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
          activeOpacity={0.7}
          onPress={() => onPressAuthor?.(post)}
        >
          {avatarSrc ? (
            <Image source={avatarSrc} style={postStyles.avatar} />
          ) : (
            <View
              style={[
                postStyles.avatar,
                {
                  backgroundColor: theme.border,
                  justifyContent: "center",
                  alignItems: "center",
                },
              ]}
            >
              <AppIcon family="Ionicons" name="person" size={17} color={theme.text.muted} />
            </View>
          )}
          <View style={{ flex: 1, marginLeft: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
              <Text
                style={[postStyles.userName, { color: theme.text.primary }]}
                numberOfLines={1}
              >
                {post.authorName || i18nText("autoI18n.kullanici", "Kullanıcı")}
              </Text>
            <View
              style={[
                postStyles.badge,
                {
                  backgroundColor: accentColor + "22",
                  borderColor: accentColor + "55",
                },
              ]}
            >
              <Text style={[postStyles.badgeText, { color: accentColor }]}>
                {post.type === "list" ? t.badges.list : t.badges.review}
              </Text>
            </View>
            {post.hasSpoiler && (
              <View
                style={[
                  postStyles.badge,
                  {
                    backgroundColor: "rgba(240,79,79,0.12)",
                    borderColor: "rgba(240,79,79,0.4)",
                    marginLeft: 6,
                  },
                ]}
              >
                <Text style={[postStyles.badgeText, { color: "#f04f4f" }]}>
                  {t.badges.spoiler}
                </Text>
              </View>
            )}
          </View>
          <Text style={[postStyles.time, { color: theme.text.muted }]}>
            {timeText}
          </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity hitSlop={8} onPress={() => setMenuOpen(true)}>
          <AppIcon
            family="MaterialCommunityIcons"
            name="dots-vertical"
            size={18}
            color={theme.text.muted}
          />
        </TouchableOpacity>
      </View>

      {/* Action menu sheet */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable
          style={menuStyles.backdrop}
          onPress={() => setMenuOpen(false)}
        >
          <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
          <View
            style={[
              menuStyles.sheet,
              { backgroundColor: theme.secondary, borderColor: theme.border },
            ]}
          >
            <View
              style={[menuStyles.handle, { backgroundColor: theme.border }]}
            />

            {/* İçerik önizleme (sohbet ekranı stili minyatür) */}
            <View
              style={[
                menuStyles.previewCard,
                { backgroundColor: theme.primary, borderColor: theme.border },
              ]}
            >
              {(() => {
                const posters = (post.mediaList || [])
                  .filter((m) => m?.poster)
                  .slice(0, 3);
                if (posters.length === 0) {
                  return (
                    <View
                      style={[
                        menuStyles.previewPoster,
                        {
                          backgroundColor: theme.border,
                          alignItems: "center",
                          justifyContent: "center",
                        },
                      ]}
                    >
                      <AppIcon
                        family="Ionicons"
                        name="film-outline"
                        size={20}
                        color={theme.text.muted}
                      />
                    </View>
                  );
                }
                // Birden çok poster → arka arkaya yığılmış göster.
                return (
                  <View
                    style={[
                      menuStyles.previewStack,
                      { width: 52 + (posters.length - 1) * 16 },
                    ]}
                  >
                    {posters.map((m, i) => (
                      <Image
                        key={`${m.id}-${i}`}
                        source={{ uri: m.poster }}
                        style={[
                          menuStyles.previewPoster,
                          menuStyles.previewStackItem,
                          {
                            left: i * 16,
                            zIndex: posters.length - i,
                            borderColor: theme.secondary,
                          },
                        ]}
                        contentFit="cover"
                      />
                    ))}
                  </View>
                );
              })()}
              <View style={menuStyles.previewTextCol}>
                <View
                  style={[
                    menuStyles.previewBadge,
                    {
                      backgroundColor: accentColor + "22",
                      borderColor: accentColor + "55",
                    },
                  ]}
                >
                  <Text style={[menuStyles.previewBadgeText, { color: accentColor }]}>
                    {post.type === "list" ? t.badges.list : t.badges.review}
                  </Text>
                </View>
                <Text
                  style={[menuStyles.previewTitle, { color: theme.text.primary }]}
                  numberOfLines={1}
                >
                  {post.title}
                </Text>
                {post.content ? (
                  <Text
                    style={[menuStyles.previewContent, { color: theme.text.secondary }]}
                    numberOfLines={2}
                  >
                    {post.content}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Aksiyonlar — yan yana */}
            {isOwner ? (
              <View style={menuStyles.actionRow}>
                <Pressable
                  style={[
                    menuStyles.actionHalf,
                    { backgroundColor: theme.primary, borderColor: theme.border },
                  ]}
                  onPress={() => {
                    setMenuOpen(false);
                    onEdit?.(post);
                  }}
                >
                  <View
                    style={[
                      menuStyles.actionIconBox,
                      { backgroundColor: (theme.colors?.blue || "#4a7cf6") + "22" },
                    ]}
                  >
                    <AppIcon
                      family="Ionicons"
                      name="create-outline"
                      size={20}
                      color={theme.colors?.blue || "#4a7cf6"}
                    />
                  </View>
                  <Text
                    style={[menuStyles.actionHalfText, { color: theme.text.primary }]}
                  >
                    {t.menu.edit}
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    menuStyles.actionHalf,
                    { backgroundColor: theme.primary, borderColor: theme.border },
                  ]}
                  onPress={() => {
                    setMenuOpen(false);
                    setConfirmDelete(true);
                  }}
                >
                  <View
                    style={[
                      menuStyles.actionIconBox,
                      { backgroundColor: "rgba(240,79,79,0.15)" },
                    ]}
                  >
                    <AppIcon family="Ionicons" name="trash-outline" size={20} color="#f04f4f" />
                  </View>
                  <Text style={[menuStyles.actionHalfText, { color: "#f04f4f" }]}>
                    {t.menu.delete}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={[
                  menuStyles.actionFull,
                  { backgroundColor: theme.primary, borderColor: theme.border },
                ]}
                onPress={() => {
                  setMenuOpen(false);
                  onReport?.(post);
                }}
              >
                <View
                  style={[
                    menuStyles.actionIconBox,
                    { backgroundColor: theme.secondary },
                  ]}
                >
                  <AppIcon family="Ionicons" name="flag-outline" size={20} color={theme.text.primary} />
                </View>
                <Text style={[menuStyles.actionHalfText, { color: theme.text.primary }]}>
                  {t.menu.report}
                </Text>
              </Pressable>
            )}

            <Pressable style={menuStyles.cancelRow} onPress={() => setMenuOpen(false)}>
              <Text style={[menuStyles.itemText, { color: theme.text.muted }]}>
                {t.menu.cancel}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        visible={confirmDelete}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmDelete(false)}
      >
        <View style={menuStyles.backdrop}>
          <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
          <View
            style={[
              menuStyles.dialog,
              { backgroundColor: theme.secondary, borderColor: theme.border },
            ]}
          >
            <View style={menuStyles.dialogIconWrap}>
              <AppIcon family="Ionicons" name="alert-circle" size={36} color="#f04f4f" />
            </View>
            <Text
              style={[menuStyles.dialogTitle, { color: theme.text.primary }]}
            >
              {t.deleteConfirm.title}
            </Text>
            <Text
              style={[menuStyles.dialogMsg, { color: theme.text.secondary }]}
            >
              {t.deleteConfirm.message}
            </Text>
            <View style={menuStyles.dialogActions}>
              <Pressable
                style={[
                  menuStyles.dialogBtn,
                  { backgroundColor: theme.primary, borderColor: theme.border },
                ]}
                onPress={() => setConfirmDelete(false)}
              >
                <Text
                  style={[menuStyles.dialogBtnText, { color: theme.text.primary }]}
                >
                  {t.deleteConfirm.cancel}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  menuStyles.dialogBtn,
                  { backgroundColor: "#f04f4f", borderColor: "#f04f4f" },
                ]}
                onPress={() => {
                  setConfirmDelete(false);
                  onDelete?.(post.id);
                }}
              >
                <Text style={[menuStyles.dialogBtnText, { color: "#fff" }]}>
                  {t.deleteConfirm.confirm}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Spoiler göster/gizle (post üstünde) */}
      {post.hasSpoiler && (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setSpoilerRevealed((v) => !v)}
          style={[
            postStyles.spoilerToggle,
            {
              borderColor: "rgba(240,79,79,0.4)",
              backgroundColor: "rgba(240,79,79,0.08)",
            },
          ]}
        >
          <AppIcon
            family="Ionicons"
            name={spoilerRevealed ? "eye-off-outline" : "eye-outline"}
            size={15}
            color="#f04f4f"
          />
          <Text style={postStyles.spoilerToggleText}>
            {spoilerRevealed
              ? t.spoiler?.hide || i18nText("autoI18n.spoileri_gizle", "Spoiler'ı gizle")
              : t.spoiler?.show || i18nText("autoI18n.spoileri_goster", "Spoiler'ı göster")}
          </Text>
        </TouchableOpacity>
      )}

      {/* Body */}
      {post.type === "review" && post.mediaList?.length > 0 ? (
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ alignItems: "center" }}>
            <View
              style={[
                postStyles.mediaCard,
                { borderColor: theme.border },
              ]}
            >
              <Image
                source={{ uri: post.mediaList[0].poster }}
                style={postStyles.mediaPoster}
                contentFit="cover"
              />
            </View>
            {post.userRating > 0 && (
              <View
                style={[
                  postStyles.ratingPill,
                  {
                    backgroundColor: theme.primary,
                    borderColor: theme.border,
                  },
                ]}
              >
                <RatingStars rating={post.userRating} max={5} size={11} />
                <Text
                  style={[
                    postStyles.ratingNumber,
                    { color: theme.text.primary },
                  ]}
                >
                  {post.userRating}
                </Text>
              </View>
            )}
          </View>

          <View style={{ flex: 1 }}>
            <Text
              style={[postStyles.title, { color: theme.text.primary }]}
              numberOfLines={2}
            >
              {post.title}
            </Text>
            {showSpoiler ? (
              // Spoiler kart — content yerine geçer, kayma/taşma yok
              <Pressable
                onPress={() => setSpoilerRevealed(true)}
                style={[
                  postStyles.spoilerCard,
                  {
                    backgroundColor: theme.primary,
                    borderColor: "rgba(240,79,79,0.4)",
                  },
                ]}
              >
                <AppIcon family="Ionicons" name="eye-off" size={20} color="#f04f4f" />
                <Text
                  style={[
                    postStyles.spoilerCardText,
                    { color: theme.text.primary },
                  ]}
                  numberOfLines={2}
                >
                  {t.spoiler.hidden}
                </Text>
                <View
                  style={[
                    postStyles.spoilerCardBtn,
                    { backgroundColor: "rgba(240,79,79,0.18)" },
                  ]}
                >
                  <Text style={postStyles.spoilerCardBtnText}>
                    {t.spoiler.reveal}
                  </Text>
                </View>
              </Pressable>
            ) : (
              <Text
                style={[postStyles.content, { color: theme.text.secondary }]}
              >
                {post.content}
              </Text>
            )}
          </View>
        </View>
      ) : (
        <>
          <Text style={[postStyles.title, { color: theme.text.primary }]}>
            {post.title}
          </Text>
          {showSpoiler ? (
            // Liste için spoiler — içerik ve posterler gizlenir
            <Pressable
              onPress={() => setSpoilerRevealed(true)}
              style={[
                postStyles.spoilerCard,
                {
                  backgroundColor: theme.primary,
                  borderColor: "rgba(240,79,79,0.4)",
                },
              ]}
            >
              <AppIcon family="Ionicons" name="eye-off" size={20} color="#f04f4f" />
              <Text
                style={[postStyles.spoilerCardText, { color: theme.text.primary }]}
                numberOfLines={2}
              >
                {t.spoiler.hidden}
              </Text>
              <View
                style={[
                  postStyles.spoilerCardBtn,
                  { backgroundColor: "rgba(240,79,79,0.18)" },
                ]}
              >
                <Text style={postStyles.spoilerCardBtnText}>{t.spoiler.reveal}</Text>
              </View>
            </Pressable>
          ) : (
            <>
              <Text style={[postStyles.content, { color: theme.text.secondary }]}>
                {post.content}
              </Text>
              {post.userRating > 0 && (
                <View
                  style={[
                    postStyles.listRatingPill,
                    { backgroundColor: theme.primary, borderColor: theme.border },
                  ]}
                >
                  <RatingStars rating={post.userRating} max={5} size={12} />
                  <Text
                    style={[postStyles.ratingNumber, { color: theme.text.primary }]}
                  >
                    {post.userRating}
                  </Text>
                </View>
              )}
              {!post.mediaList || post.mediaList.length === 0 ? null : post
                  .mediaList.length === 1 ? (
                <View
                  style={[postStyles.mediaCardWide, { borderColor: theme.border }]}
                >
                  <Image
                    source={{ uri: post.mediaList[0].poster }}
                    style={postStyles.mediaPosterWide}
                    contentFit="cover"
                  />
                </View>
              ) : (
                <FlatList
                  horizontal
                  data={post.mediaList}
                  keyExtractor={(m) => String(m.id)}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{
                    gap: 10,
                    paddingVertical: 6,
                    paddingRight: 12,
                  }}
                  renderItem={({ item }) => (
                    <View
                      style={[postStyles.mediaCard, { borderColor: theme.border }]}
                    >
                      <Image
                        source={{ uri: item.poster }}
                        style={postStyles.mediaPoster}
                        contentFit="cover"
                      />
                      {item.year ? (
                        <View style={postStyles.mediaYear}>
                          <Text style={postStyles.mediaYearText}>{item.year}</Text>
                        </View>
                      ) : null}
                    </View>
                  )}
                />
              )}
            </>
          )}
        </>
      )}

      {/* Actions */}
      <View style={[postStyles.actions, { borderTopColor: theme.border }]}>
        <LikeButton
          liked={!!post.likedByMe}
          count={post.likesCount || 0}
          onPress={() => onLike(post.id)}
          theme={theme}
        />
        <TouchableOpacity
          style={postStyles.actionBtn}
          activeOpacity={0.7}
          onPress={() => onComment?.(post)}
        >
          <AppIcon
            family="Ionicons"
            name="chatbubble-outline"
            size={18}
            color={theme.text.secondary}
          />
          <Text
            style={[postStyles.actionText, { color: theme.text.secondary }]}
          >
            {post.commentsCount || 0}
          </Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={postStyles.actionBtn}
          activeOpacity={0.7}
          onPress={() => onBookmark(post.id)}
        >
          <AppIcon
            family="Feather"
            name="bookmark"
            size={18}
            color={post.bookmarkedByMe ? theme.accent : theme.text.secondary}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={postStyles.actionBtn}
          activeOpacity={0.7}
          onPress={() => onShare?.(post)}
        >
          <AppIcon
            family="Ionicons"
            name="share-social-outline"
            size={18}
            color={theme.text.secondary}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
});

const EmptyState = memo(function EmptyState({ theme, t }) {
  return (
    <View style={emptyStyles.container}>
      <View
        style={[
          emptyStyles.iconWrap,
          {
            backgroundColor: theme.secondary,
            borderColor: theme.border,
          },
        ]}
      >
        <AppIcon
          family="MaterialCommunityIcons"
          name="comment-text-multiple-outline"
          size={42}
          color={theme.text.muted}
        />
      </View>
      <Text style={[emptyStyles.title, { color: theme.text.primary }]}>
        {t.empty.title}
      </Text>
      <Text style={[emptyStyles.subtitle, { color: theme.text.secondary }]}>
        {t.empty.subtitle}
      </Text>
    </View>
  );
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ShareContentScreen() {
  const { theme } = useTheme();
  const { t, language } = useLanguage();
  const ts = t.shareScreen;
  const { user } = useAuth();
  const { avatar } = useProfileUi();
  const { API_KEY } = useApiSettings();
  const { getTmdbUrl } = useImageQualitySettings();
  const navigation = useNavigation();

  // Gerçek trend içerikler (film + dizi)
  const [trending, setTrending] = useState([]);

  useEffect(() => {
    let active = true;
    const lang = language === "tr" ? "tr-TR" : "en-US";
    (async () => {
      try {
        const res = await axios.get(
          "https://api.themoviedb.org/3/trending/all/week",
          {
            params: { language: lang },
            headers: { accept: "application/json", Authorization: API_KEY },
          },
        );
        if (!active) return;
        const items = (res.data?.results || [])
          .filter(
            (r) =>
              (r.media_type === "movie" || r.media_type === "tv") &&
              r.poster_path,
          )
          .slice(0, 15)
          .map((r) => ({
            id: r.id,
            media_type: r.media_type,
            title: r.title || r.name || "",
            poster: getTmdbUrl(r.poster_path, "poster", 300),
          }));
        setTrending(items);
      } catch (e) {
        if (__DEV__) console.warn("[Trending] fetch:", e?.message);
      }
    })();
    return () => {
      active = false;
    };
  }, [API_KEY, language]);

  const onPressTrending = useCallback(
    (item) => {
      if (item.media_type === "tv") {
        navigation.navigate("TvShowsDetails", { id: item.id });
      } else {
        navigation.navigate("MovieDetails", { id: item.id });
      }
    },
    [navigation],
  );

  const {
    posts,
    filter,
    setFilter,
    loading,
    loadingMore,
    refreshing,
    hasMore,
    likedIds,
    bookmarkIds,
    loadMore,
    refresh,
    toggleLike,
    toggleBookmark,
    submitPost,
    deletePost,
    editPost,
  } = usePosts();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingPost, setEditingPost] = useState(null); // null = create, obj = edit
  const [commentPost, setCommentPost] = useState(null); // yorum modalı açık post

  // Her post'a "ben beğendim/kaydettim mi?" bayrağını burada bind et.
  const enrichedPosts = useMemo(
    () =>
      posts.map((p) => ({
        ...p,
        likedByMe: likedIds.has(p.id),
        bookmarkedByMe: bookmarkIds.has(p.id),
      })),
    [posts, likedIds, bookmarkIds],
  );

  const handleSubmitPost = useCallback(
    async (payload) => {
      // Sonucu döndür: CreatePostModal truthy alınca handleClose() çağırır
      // (formu sıfırlar + onClose → handleCloseModal ile editingPost temizlenir).
      if (editingPost) {
        const ok = await editPost(editingPost.id, payload); // mevcut gönderiyi güncelle
        return ok ? true : null;
      }
      const id = await submitPost(payload);
      return id || null;
    },
    [editingPost, editPost, submitPost],
  );

  const handleEditRequest = useCallback((post) => {
    setEditingPost(post);
    setModalVisible(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
    setEditingPost(null);
  }, []);

  const handleOpenComments = useCallback((post) => {
    setCommentPost(post);
  }, []);

  const handleOpenProfile = useCallback(
    (post) => {
      if (!post?.authorId) return;
      // Kendi postun → yönlendirme yok. Sadece başkasının profiline git.
      if (post.authorId === user?.uid) return;
      navigation.navigate("FriendProfileScreen", {
        friendUid: post.authorId,
        friendName: post.authorName || "",
      });
    },
    [navigation, user?.uid],
  );

  const handleCloseComments = useCallback(() => {
    setCommentPost(null);
  }, []);

  // Gönderiyi cihazın native paylaşım sayfasıyla paylaş (başlık + içerik).
  const handleSharePost = useCallback(async (post) => {
    if (!post) return;
    try {
      const lines = [post.title, post.content].filter(Boolean);
      await Share.share({
        message:
          lines.join("\n\n") ||
          i18nText("autoI18n.bir_paylasima_goz_at", "Bir paylaşıma göz at"),
      });
    } catch (e) {
      if (__DEV__) console.warn("[Share] post:", e?.message);
    }
  }, []);

  // Başkasının gönderisini şikayet et (onay → PostReports'a yaz).
  const handleReportPost = useCallback(
    (post) => {
      if (!post?.id) return;
      if (!user?.uid) {
        toast.warning(i18nText("autoI18n.sikayet_icin_giris_yap", "Şikayet için giriş yap"));
        return;
      }
      appAlert(
        i18nText("autoI18n.gonderiyi_sikayet_et", "Gönderiyi şikayet et"),
        i18nText("autoI18n.bu_gonderiyi_uygunsuz_olarak_bildirmek_istiyor_musun", "Bu gönderiyi uygunsuz olarak bildirmek istiyor musun?"),
        [
          { text: i18nText("autoI18n.vazgec", "Vazgeç"), style: "cancel" },
          {
            text: i18nText("autoI18n.sikayet_et", "Şikayet et"),
            style: "destructive",
            onPress: async () => {
              try {
                await reportPost(post.id, user.uid, {
                  postAuthorId: post.authorId || null,
                });
                toast.success(
                  i18nText("autoI18n.sikayetin_alindi", "Şikayetin alındı"),
                  i18nText("autoI18n.inceleyecegiz_tesekkurler", "İnceleyeceğiz, teşekkürler."),
                );
              } catch (e) {
                toast.error(i18nText("autoI18n.sikayet_gonderilemedi", "Şikayet gönderilemedi"));
              }
            },
          },
        ],
      );
    },
    [user?.uid],
  );

  const greeting = useMemo(() => {
    const name = user?.displayName?.split(" ")[0] || "";
    return name ? `${ts.welcome}, ${name}` : ts.welcome;
  }, [user?.displayName, ts.welcome]);

  const renderHeader = useCallback(
    () => (
      <View>
        {/* Greeting */}
        <View style={mainStyles.greetingRow}>
          <BackButton absolute={false} style={{ marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={[mainStyles.greeting, { color: theme.text.primary }]}>
              {greeting}
            </Text>
            <Text style={[mainStyles.greetingSub, { color: theme.text.secondary }]}>
              {ts.subtitle}
            </Text>
          </View>
          {avatar ? (
            <Image source={avatar} style={mainStyles.headerAvatar} />
          ) : (
            <View
              style={[
                mainStyles.headerAvatar,
                {
                  backgroundColor: theme.secondary,
                  justifyContent: "center",
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: theme.border,
                },
              ]}
            >
              <AppIcon family="Ionicons" name="person" size={22} color={theme.text.muted} />
            </View>
          )}
        </View>

        {/* Create post composer */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setModalVisible(true)}
          style={mainStyles.composerWrap}
        >
          <LinearGradient
            colors={[
              theme.colors?.blue || "#4c669f",
              theme.colors?.primary || "#3b5998",
              theme.colors?.darkBlue || "#192f6a",
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={mainStyles.composer}
          >
            {avatar ? (
              <Image source={avatar} style={mainStyles.composerAvatar} />
            ) : (
              <View
                style={[
                  mainStyles.composerAvatar,
                  { backgroundColor: "rgba(255,255,255,0.18)" },
                ]}
              >
                <AppIcon family="Ionicons" name="person" size={18} color="#fff" />
              </View>
            )}
            <Text style={mainStyles.composerText}>{ts.createPostPlaceholder}</Text>
            <View style={mainStyles.composerActions}>
              <AppIcon family="Ionicons" name="image-outline" size={20} color="#fff" />
              <View style={mainStyles.composerPlus}>
                <AppIcon family="Ionicons" name="add" size={20} color="#fff" />
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Postlarım butonu */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.navigate("MyPostsScreen")}
          style={[
            mainStyles.myPostsBtn,
            { backgroundColor: theme.secondary, borderColor: theme.border },
          ]}
        >
          <View
            style={[
              mainStyles.myPostsIcon,
              { backgroundColor: (theme.colors?.blue || "#4a7cf6") + "22" },
            ]}
          >
            <AppIcon
              family="Ionicons"
              name="albums-outline"
              size={18}
              color={theme.colors?.blue || "#4a7cf6"}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[mainStyles.myPostsText, { color: theme.text.primary }]}>
              {ts.myPosts || i18nText("autoI18n.postlarim", "Postlarım")}
            </Text>
            <Text style={[mainStyles.myPostsSub, { color: theme.text.secondary }]}>
              {ts.myPostsSub || i18nText("autoI18n.paylastigin_gonderileri_gor", "Paylaştığın gönderileri gör")}
            </Text>
          </View>
          <AppIcon
            family="Ionicons"
            name="chevron-forward"
            size={20}
            color={theme.text.muted}
          />
        </TouchableOpacity>

        {/* Trending Rail */}
        <TrendingRail
          theme={theme}
          label={ts.trending}
          data={trending}
          onPressItem={onPressTrending}
        />

        {/* Filter Chips */}
        <FilterChips theme={theme} t={ts} active={filter} onChange={setFilter} />
      </View>
    ),
    [theme, ts, greeting, avatar, filter, navigation, trending, onPressTrending],
  );

  const renderItem = useCallback(
    ({ item, index }) => (
      <StaggerItem index={index}>
        <PostCard
          post={item}
          theme={theme}
          t={ts}
          currentUid={user?.uid}
          onLike={toggleLike}
          onBookmark={toggleBookmark}
          onComment={handleOpenComments}
          onEdit={handleEditRequest}
          onDelete={deletePost}
          onPressAuthor={handleOpenProfile}
          onShare={handleSharePost}
          onReport={handleReportPost}
        />
      </StaggerItem>
    ),
    [theme, ts, user?.uid, toggleLike, toggleBookmark, handleOpenComments, handleOpenProfile, handleEditRequest, deletePost, handleSharePost, handleReportPost],
  );

  const listFooter = useMemo(() => {
    if (loadingMore) {
      return (
        <View style={{ paddingVertical: 24 }}>
          <ActivityIndicator color={theme.text.muted} />
        </View>
      );
    }
    if (!hasMore && enrichedPosts.length > 0) {
      return <View style={{ paddingVertical: 24 }} />;
    }
    return null;
  }, [loadingMore, hasMore, enrichedPosts.length, theme.text.muted]);

  const listEmpty = useMemo(() => {
    // İlk yüklemede skeleton/loading göster, sonra empty state.
    if (loading) {
      return (
        <View style={{ paddingVertical: 60, alignItems: "center" }}>
          <ActivityIndicator color={theme.text.muted} />
        </View>
      );
    }
    return <EmptyState theme={theme} t={ts} />;
  }, [loading, theme, ts]);

  return (
    <SafeAreaView
      style={[mainStyles.container, { backgroundColor: theme.primary }]}
      edges={["top"]}
    >
      <FlatList
        data={enrichedPosts}
        keyExtractor={(p) => p.id}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={listFooter}
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={theme.text.muted}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        removeClippedSubviews
        initialNumToRender={3}
        maxToRenderPerBatch={4}
        windowSize={7}
      />

      <CreatePostModal
        visible={modalVisible}
        onClose={handleCloseModal}
        onSubmit={handleSubmitPost}
        editingPost={editingPost}
      />

      <Modal
        animationType="none"
        transparent
        visible={commentPost != null}
        onRequestClose={handleCloseComments}
        statusBarTranslucent
      >
        <PostCommentSheetModal
          visible={commentPost != null}
          post={commentPost}
          onClose={handleCloseComments}
        />
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const mainStyles = StyleSheet.create({
  container: { flex: 1 },
  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 14,
  },
  greeting: { fontSize: 22, fontWeight: "800" },
  greetingSub: { fontSize: 13, marginTop: 2 },
  headerAvatar: { width: 44, height: 44, borderRadius: 22, marginLeft: 12 },
  composerWrap: { paddingHorizontal: 16, marginBottom: 20 },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  composerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.35)",
  },
  composerText: { flex: 1, color: "#fff", fontSize: 15, fontWeight: "600" },
  composerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  myPostsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 20,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  myPostsIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  myPostsText: { fontSize: 15, fontWeight: "700" },
  myPostsSub: { fontSize: 12, marginTop: 1 },
  composerPlus: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.22)",
    justifyContent: "center",
    alignItems: "center",
  },
});

const trStyles = StyleSheet.create({
  container: { marginBottom: 18 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  headerLabel: { fontSize: 15, fontWeight: "700" },
  card: {
    width: 110,
    height: 160,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
  },
  poster: { width: "100%", height: "100%" },
  gradient: { position: "absolute", left: 0, right: 0, bottom: 0, height: "55%" },
  rankBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  rankText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  title: {
    position: "absolute",
    bottom: 8,
    left: 8,
    right: 8,
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
});

const chipStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
  },
  label: { fontSize: 13 },
});

const postStyles = StyleSheet.create({
  card: {
    marginHorizontal: 14,
    marginBottom: 10,
    borderRadius: 16,
    padding: 13,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 2,
  },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  avatar: { width: 34, height: 34, borderRadius: 17 },
  userName: { fontSize: 13.5, fontWeight: "700", maxWidth: width * 0.4 },
  badge: {
    marginLeft: 7,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badgeText: { fontSize: 8.5, fontWeight: "800", letterSpacing: 0.4 },
  time: { fontSize: 10.5, marginTop: 2 },
  title: { fontSize: 14.5, fontWeight: "700", marginBottom: 4 },
  content: { fontSize: 13, lineHeight: 18.5, marginBottom: 10 },
  mediaCard: {
    width: 78,
    height: 117,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  mediaPoster: { width: "100%", height: "100%" },
  mediaCardWide: {
    height: 150,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    marginBottom: 10,
  },
  mediaPosterWide: { width: "100%", height: "100%" },
  mediaYear: {
    position: "absolute",
    bottom: 6,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 6,
  },
  mediaYearText: { fontSize: 10, color: "#fff", fontWeight: "600" },
  ratingPill: {
    position: "absolute",
    bottom: -10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  ratingNumber: { fontSize: 11, fontWeight: "700", marginLeft: 2 },
  // Liste için inline puan rozeti (review'deki absolute pill'den farklı)
  listRatingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
  },
  // Post üstündeki spoiler göster/gizle toggle
  spoilerToggle: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
  },
  spoilerToggleText: { color: "#f04f4f", fontSize: 11.5, fontWeight: "700" },
  // Spoiler kart — content yerine geçen self-contained kart (taşma/kayma yok)
  spoilerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  spoilerCardText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
  spoilerCardBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  spoilerCardBtnText: {
    color: "#f04f4f",
    fontSize: 11,
    fontWeight: "700",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 9,
    marginTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 14,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  actionText: { fontSize: 12, fontWeight: "600" },
});

const menuStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    paddingBottom: 30,
    paddingTop: 12,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 3,
    marginBottom: 16,
    opacity: 0.5,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  itemText: { fontSize: 16, fontWeight: "600" },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 20 },

  // İçerik önizleme kartı
  previewCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 14,
  },
  previewPoster: {
    width: 52,
    height: 78,
    borderRadius: 9,
    flexShrink: 0,
  },
  previewStack: { height: 78, flexShrink: 0, position: "relative" },
  previewStackItem: { position: "absolute", top: 0, borderWidth: 1.5 },
  previewTextCol: { flex: 1, gap: 5 },
  previewBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  previewBadgeText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.4 },
  previewTitle: { fontSize: 14, fontWeight: "700" },
  previewContent: { fontSize: 12, lineHeight: 17 },

  // Yan yana aksiyonlar
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 6,
  },
  actionHalf: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  actionFull: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginBottom: 6,
  },
  actionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  actionHalfText: { fontSize: 15, fontWeight: "700" },
  cancelRow: { paddingVertical: 14, alignItems: "center", marginTop: 6 },

  dialog: {
    margin: 24,
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    alignSelf: "center",
    maxWidth: 360,
    width: "85%",
    alignItems: "center",
    marginTop: "auto",
    marginBottom: "auto",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 24,
  },
  dialogIconWrap: { 
    marginBottom: 16,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(240,79,79,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  dialogTitle: {
    fontSize: 19,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  dialogMsg: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  dialogActions: { flexDirection: "row", gap: 12, width: "100%" },
  dialogBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  dialogBtnText: { fontSize: 15, fontWeight: "700" },
});

const emptyStyles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingHorizontal: 32,
    paddingTop: 30,
    paddingBottom: 60,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    marginBottom: 18,
  },
  title: { fontSize: 17, fontWeight: "700", marginBottom: 6 },
  subtitle: { fontSize: 13, textAlign: "center", lineHeight: 20 },
});
