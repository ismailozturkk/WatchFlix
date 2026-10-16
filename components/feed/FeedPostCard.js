// components/feed/FeedPostCard.js
//
// Paylaşım akışındaki TEK gönderi kartı (ShareContentScreen). Eskiden ekranın
// içindeydi; ekran 2000 satırı aşınca kart, menü ve onay penceresi buraya
// taşındı. Davranış aynı (spoiler, beğeni, yer imi, düzenle/sil/bildir, liste
// kaydet) — değişen yalnız görünüm: yumuşak yüzeyli kart, tipe göre vurgu
// rengi, İNCELEME'de büyütülmüş poster, anket/sohbet/liste için ayrı gövdeler.
//
// Kullanıcının yazdığı metinlerde (başlık, içerik) `fontRole="body"` var:
// kalın+büyük stil başlık fontuna sokardı, oysa bu dekoratif başlık değil,
// kullanıcı metni (bkz. utils/typographyRoles.js, PollMessage ile aynı kural).

import React, { memo, useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Animated,
  LayoutAnimation,
  Pressable,
  Modal,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "../AppIcon";
import ModalBlurBackdrop from "../common/ModalBlurBackdrop";
import RatingStars from "../RatingStars";
import PollMessage from "../chat/PollMessage";
import UserAvatar from "../common/UserAvatar";
import ClampedText, { ReadMoreToggle } from "./ClampedText";
import { alpha } from "../../theme/colors";
import { i18nText } from "../../utils/i18nText";
import { formatTimeAgo } from "../../utils/postTime";
import { postTypeMeta } from "./postTypeMeta";

// İNCELEME posteri: eski 86×129'dan büyütüldü (2:3 oranı korunur).
const REVIEW_POSTER_W = 118;
const REVIEW_POSTER_H = 177;
const LIST_POSTER_W = 96;
const LIST_POSTER_H = 144;

// Uzun metin kısaltma sınırları ("Devamını oku" ile açılır). MAX_CONTENT 2000
// karakter: sınırsız bırakılan tek bir paylaşım akışta ekranın birkaç katını
// kaplıyordu. İnceleme metni poster yanındaki dar sütunda; başlık ve içerik
// toplamı posterin yüksekliğine (177) yaklaşacak şekilde seçildi.
const REVIEW_TITLE_LINES = 3;
const REVIEW_CONTENT_LINES = 4;
const TITLE_LINES = 2;
const CONTENT_LINES = 4;
const QUOTE_LINES = 7;

// Spoiler'lı postlarda posterler bulanıklaştırılır; "Spoiler'ı göster/gizle"
// ile blur açılıp kapanır. Küçük ve geniş posterler için ayrı yarıçap.
const SPOILER_BLUR = 16;
const SPOILER_BLUR_WIDE = 22;
const SPOILER_RED = "#f04f4f";
const LIKE_RED = "#FF5A5F";

// ─── Aksiyon düğmeleri ───────────────────────────────────────────────────────

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
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: liked }}
      onPress={handlePress}
      style={[
        st.pill,
        {
          backgroundColor: liked ? alpha(LIKE_RED, 0.13) : theme.primary,
          borderColor: liked ? alpha(LIKE_RED, 0.4) : theme.border,
        },
      ]}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <AppIcon
          family="Ionicons"
          name={liked ? "heart" : "heart-outline"}
          size={18}
          color={liked ? LIKE_RED : theme.text.secondary}
        />
      </Animated.View>
      {count > 0 && (
        <Text style={[st.pillText, { color: liked ? LIKE_RED : theme.text.secondary }]}>
          {count}
        </Text>
      )}
    </Pressable>
  );
});

// ─── Menü + silme onayı ──────────────────────────────────────────────────────

function PostMenuSheet({
  visible,
  onClose,
  post,
  isOwner,
  theme,
  t,
  accentColor,
  typeLabel,
  onEdit,
  onAskDelete,
  onReport,
}) {
  const posters = (post.mediaList || []).filter((m) => m?.poster).slice(0, 3);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={menuStyles.backdrop} onPress={onClose}>
        <ModalBlurBackdrop intensity={25} />
        <View
          style={[
            menuStyles.sheet,
            { backgroundColor: theme.secondary, borderColor: theme.border },
          ]}
        >
          <View style={[menuStyles.handle, { backgroundColor: theme.border }]} />

          {/* İçerik önizleme (sohbet ekranı stili minyatür) */}
          <View
            style={[
              menuStyles.previewCard,
              { backgroundColor: theme.primary, borderColor: theme.border },
            ]}
          >
            {posters.length === 0 ? (
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
            ) : (
              // Birden çok poster → arka arkaya yığılmış göster.
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
            )}
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
                  {typeLabel}
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
                  onClose();
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
                <Text style={[menuStyles.actionHalfText, { color: theme.text.primary }]}>
                  {t.menu.edit}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  menuStyles.actionHalf,
                  { backgroundColor: theme.primary, borderColor: theme.border },
                ]}
                onPress={() => {
                  onClose();
                  onAskDelete();
                }}
              >
                <View
                  style={[
                    menuStyles.actionIconBox,
                    { backgroundColor: "rgba(240,79,79,0.15)" },
                  ]}
                >
                  <AppIcon family="Ionicons" name="trash-outline" size={20} color={SPOILER_RED} />
                </View>
                <Text style={[menuStyles.actionHalfText, { color: SPOILER_RED }]}>
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
                onClose();
                onReport?.(post);
              }}
            >
              <View
                style={[menuStyles.actionIconBox, { backgroundColor: theme.secondary }]}
              >
                <AppIcon
                  family="Ionicons"
                  name="flag-outline"
                  size={20}
                  color={theme.text.primary}
                />
              </View>
              <Text style={[menuStyles.actionHalfText, { color: theme.text.primary }]}>
                {t.menu.report}
              </Text>
            </Pressable>
          )}

          <Pressable style={menuStyles.cancelRow} onPress={onClose}>
            <Text style={[menuStyles.itemText, { color: theme.text.muted }]}>
              {t.menu.cancel}
            </Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

function DeleteConfirmDialog({ visible, onClose, onConfirm, theme, t }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={menuStyles.backdrop}>
        <ModalBlurBackdrop intensity={25} />
        <View
          style={[
            menuStyles.dialog,
            { backgroundColor: theme.secondary, borderColor: theme.border },
          ]}
        >
          <View style={menuStyles.dialogIconWrap}>
            <AppIcon family="Ionicons" name="alert-circle" size={36} color={SPOILER_RED} />
          </View>
          <Text style={[menuStyles.dialogTitle, { color: theme.text.primary }]}>
            {t.deleteConfirm.title}
          </Text>
          <Text style={[menuStyles.dialogMsg, { color: theme.text.secondary }]}>
            {t.deleteConfirm.message}
          </Text>
          <View style={menuStyles.dialogActions}>
            <Pressable
              style={[
                menuStyles.dialogBtn,
                { backgroundColor: theme.primary, borderColor: theme.border },
              ]}
              onPress={onClose}
            >
              <Text style={[menuStyles.dialogBtnText, { color: theme.text.primary }]}>
                {t.deleteConfirm.cancel}
              </Text>
            </Pressable>
            <Pressable
              style={[
                menuStyles.dialogBtn,
                { backgroundColor: SPOILER_RED, borderColor: SPOILER_RED },
              ]}
              onPress={onConfirm}
            >
              <Text style={[menuStyles.dialogBtnText, { color: "#fff" }]}>
                {t.deleteConfirm.confirm}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Spoiler kartı (content yerine geçer, kayma/taşma yok) ───────────────────

function SpoilerCard({ theme, t, onReveal, compact = false }) {
  return (
    <Pressable
      onPress={onReveal}
      style={[
        st.spoilerCard,
        compact && st.spoilerCardCompact,
        {
          backgroundColor: alpha(SPOILER_RED, 0.07),
          borderColor: alpha(SPOILER_RED, 0.35),
        },
      ]}
    >
      <View style={st.spoilerIcon}>
        <AppIcon family="Ionicons" name="eye-off" size={18} color={SPOILER_RED} />
      </View>
      <Text
        style={[st.spoilerCardText, { color: theme.text.primary }]}
        numberOfLines={compact ? 3 : 2}
      >
        {t.spoiler.hidden}
      </Text>
      <View style={st.spoilerCardBtn}>
        <Text style={st.spoilerCardBtnText}>{t.spoiler.reveal}</Text>
      </View>
    </Pressable>
  );
}

// ─── Kart ────────────────────────────────────────────────────────────────────

const FeedPostCard = memo(function FeedPostCard({
  post,
  theme,
  t,
  currentUid,
  currentUserAvatar,
  onLike,
  onBookmark,
  onComment,
  onEdit,
  onDelete,
  onPressAuthor,
  onReport,
  onVote,
  onSaveList,
  onSend,
  getTmdbUrl,
  postListPosterLayout,
}) {
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const showSpoiler = post.hasSpoiler && !spoilerRevealed;
  const isOwner = currentUid && (post.authorId === currentUid || post.userId === currentUid);

  const meta = postTypeMeta(post.type, theme.colors);
  const accentColor = meta.color;
  const timeText = formatTimeAgo(post._createdAtMs || 0, t.timeAgo);

  const joinedListPosters = post.type === "list" && postListPosterLayout === "joined";
  const mediaCount = post.mediaList?.length || 0;

  // Anket sorusu eski/eksik veride boş olabilir; başlık aynı metni taşıdığı
  // için ona düşülür (composer soruyu başlıktan üretiyor).
  const poll = useMemo(
    () =>
      post.type === "poll" && post.poll
        ? { ...post.poll, question: post.poll.question || post.title }
        : null,
    [post.type, post.poll, post.title],
  );

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const askDelete = useCallback(() => setConfirmDelete(true), []);
  const closeDelete = useCallback(() => setConfirmDelete(false), []);
  const confirmDeletePost = useCallback(() => {
    setConfirmDelete(false);
    onDelete?.(post.id);
  }, [onDelete, post.id]);
  const revealSpoiler = useCallback(() => setSpoilerRevealed(true), []);

  // Uzun başlık/içerik: tek düğme ikisini birlikte açar. Düğme yalnız bir
  // parça gerçekten kesildiyse çıkar (kısa postlarda hiç görünmez).
  const [textOpen, setTextOpen] = useState(false);
  const [titleCut, setTitleCut] = useState(false);
  const [contentCut, setContentCut] = useState(false);
  const canExpandText = titleCut || contentCut;
  const toggleText = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTextOpen((open) => !open);
  }, []);
  const readMore = canExpandText ? (
    <ReadMoreToggle
      expanded={textOpen}
      onPress={toggleText}
      color={accentColor}
      style={st.readMore}
    />
  ) : null;

  // ── Liste posterleri (yatay şerit, kart kenarlarına taşar) ────────────────
  const listStrip =
    mediaCount === 0 ? null : mediaCount === 1 ? (
      <View style={[st.wideCard, { borderColor: theme.border }]}>
        <Image
          source={{ uri: post.mediaList[0].poster }}
          style={st.fill}
          contentFit="cover"
          blurRadius={showSpoiler ? SPOILER_BLUR_WIDE : 0}
        />
      </View>
    ) : (
      <FlatList
        horizontal
        data={post.mediaList}
        keyExtractor={(m, i) => `${m.id}-${i}`}
        showsHorizontalScrollIndicator={false}
        style={st.stripBleed}
        contentContainerStyle={{
          gap: joinedListPosters ? 0 : 10,
          paddingVertical: 6,
          paddingHorizontal: 16,
        }}
        renderItem={({ item, index }) => (
          <View
            style={[
              st.listPoster,
              { borderColor: theme.border },
              joinedListPosters && {
                borderWidth: 0,
                borderTopLeftRadius: index === 0 ? 14 : 0,
                borderBottomLeftRadius: index === 0 ? 14 : 0,
                borderTopRightRadius: index === mediaCount - 1 ? 14 : 0,
                borderBottomRightRadius: index === mediaCount - 1 ? 14 : 0,
              },
            ]}
          >
            <Image
              source={{ uri: item.poster }}
              style={st.fill}
              contentFit="cover"
              blurRadius={showSpoiler ? SPOILER_BLUR : 0}
            />
            {post.ranked && (
              <View style={[st.rankNum, { backgroundColor: accentColor }]}>
                <Text style={st.rankNumText}>{index + 1}</Text>
              </View>
            )}
            {item.year ? (
              <View style={st.mediaYear}>
                <Text style={st.mediaYearText}>{item.year}</Text>
              </View>
            ) : null}
          </View>
        )}
      />
    );

  // ── Gövde ─────────────────────────────────────────────────────────────────
  let body;
  if (poll) {
    body = (
      <View
        style={[
          st.pollWrap,
          { backgroundColor: theme.primary, borderColor: theme.border },
        ]}
      >
        <PollMessage
          poll={poll}
          currentUid={currentUid}
          accent={accentColor}
          getTmdbUrl={getTmdbUrl}
          onVote={(optId) => onVote?.(post.id, optId)}
          variant="feed"
          theme={theme}
        />
      </View>
    );
  } else if (post.type === "review" && mediaCount > 0) {
    const first = post.mediaList[0];
    const mediaLabel = [first.title, first.year].filter(Boolean).join(" · ");
    body = (
      <View style={st.reviewRow}>
        <View
          style={[
            st.posterShadow,
            { shadowColor: "#000", backgroundColor: theme.between },
          ]}
        >
          <View style={[st.reviewPoster, { borderColor: theme.border }]}>
            {first.poster ? (
              <Image
                source={{ uri: first.poster }}
                style={st.fill}
                contentFit="cover"
                transition={120}
                blurRadius={showSpoiler ? SPOILER_BLUR : 0}
              />
            ) : (
              <View style={[st.fill, st.center]}>
                <AppIcon
                  family="Ionicons"
                  name="film-outline"
                  size={28}
                  color={theme.text.muted}
                />
              </View>
            )}
            {post.userRating > 0 && (
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.8)"]}
                style={st.posterScrim}
                pointerEvents="none"
              >
                <View style={st.posterRating}>
                  <RatingStars rating={post.userRating} max={5} size={10} />
                  <Text style={st.posterRatingNum}>{post.userRating}</Text>
                </View>
              </LinearGradient>
            )}
          </View>
        </View>

        <View style={st.reviewCopy}>
          {mediaLabel ? (
            <View style={st.mediaMeta}>
              <AppIcon
                family="Ionicons"
                name={first.type === "tv" ? "tv-outline" : "film-outline"}
                size={12}
                color={accentColor}
              />
              <Text style={[st.mediaMetaText, { color: accentColor }]} numberOfLines={1}>
                {mediaLabel}
              </Text>
            </View>
          ) : null}
          <ClampedText
            text={post.title}
            lines={REVIEW_TITLE_LINES}
            expanded={textOpen}
            onOverflowChange={setTitleCut}
            style={[st.reviewTitle, { color: theme.text.primary }]}
          />
          {showSpoiler ? (
            <SpoilerCard theme={theme} t={t} onReveal={revealSpoiler} compact />
          ) : (
            <ClampedText
              text={post.content}
              lines={REVIEW_CONTENT_LINES}
              expanded={textOpen}
              onOverflowChange={setContentCut}
              style={[st.content, { color: theme.text.secondary }]}
            />
          )}
          {readMore}
        </View>
      </View>
    );
  } else {
    // list / text (ve medyasız eski review kayıtları)
    const isText = post.type === "text";
    body = (
      <>
        {(!showSpoiler || post.type !== "list") && (
          <ClampedText
            text={post.title}
            lines={TITLE_LINES}
            expanded={textOpen}
            onOverflowChange={setTitleCut}
            style={[st.title, { color: theme.text.primary }]}
          />
        )}
        {showSpoiler ? (
          <>
            <SpoilerCard theme={theme} t={t} onReveal={revealSpoiler} />
            {readMore}
            {post.type === "list" && listStrip}
          </>
        ) : (
          <>
            {isText ? (
              <View
                style={[
                  st.quote,
                  {
                    backgroundColor: alpha(accentColor, 0.07),
                    borderLeftColor: accentColor,
                  },
                ]}
              >
                <ClampedText
                  text={post.content}
                  lines={QUOTE_LINES}
                  expanded={textOpen}
                  onOverflowChange={setContentCut}
                  style={[st.quoteText, { color: theme.text.primary }]}
                />
              </View>
            ) : (
              <ClampedText
                text={post.content}
                lines={CONTENT_LINES}
                expanded={textOpen}
                onOverflowChange={setContentCut}
                style={[st.content, { color: theme.text.secondary }]}
              />
            )}
            {readMore}
            {(post.type === "list" || post.userRating > 0) && (
              <View style={st.chipRow}>
                {post.type === "list" && mediaCount > 0 && (
                  <View
                    style={[
                      st.infoChip,
                      {
                        backgroundColor: alpha(accentColor, 0.12),
                        borderColor: alpha(accentColor, 0.3),
                      },
                    ]}
                  >
                    <AppIcon family="Ionicons" name="albums-outline" size={13} color={accentColor} />
                    <Text style={[st.infoChipText, { color: accentColor }]}>
                      {i18nText("autoI18n.n_icerik", "{{n}} içerik", { n: mediaCount })}
                    </Text>
                  </View>
                )}
                {post.userRating > 0 && (
                  <View
                    style={[
                      st.infoChip,
                      { backgroundColor: theme.primary, borderColor: theme.border },
                    ]}
                  >
                    <RatingStars rating={post.userRating} max={5} size={12} />
                    <Text style={[st.infoChipText, { color: theme.text.primary }]}>
                      {post.userRating}
                    </Text>
                  </View>
                )}
              </View>
            )}
            {post.type === "list" && listStrip}
          </>
        )}
      </>
    );
  }

  return (
    <View
      style={[
        st.shadow,
        { shadowColor: theme.shadow || "#000", backgroundColor: theme.secondary },
      ]}
    >
      <View
        style={[
          st.card,
          { backgroundColor: theme.secondary, borderColor: theme.border },
        ]}
      >
        {/* Tip rengiyle üstten yumuşak ışık — kartı tipine göre ayırır */}
        <LinearGradient
          colors={[alpha(accentColor, 0.14), alpha(accentColor, 0)]}
          style={st.wash}
          pointerEvents="none"
        />

        {/* Kullanıcı + zaman + tip + menü */}
        <View style={st.header}>
          <Pressable
            style={st.identity}
            onPress={() => onPressAuthor?.(post)}
            accessibilityRole="button"
          >
            {isOwner && currentUserAvatar ? (
              <UserAvatar
                source={currentUserAvatar}
                size={40}
                borderWidth={2}
                borderColor={alpha(accentColor, 0.5)}
              />
            ) : (
              <UserAvatar
                avatarIndex={post.authorAvatarIndex}
                photoURL={
                  post.authorPhotoURL ||
                  (typeof post.authorAvatar === "string" ? post.authorAvatar : null)
                }
                isCustomPhoto
                size={40}
                borderWidth={2}
                borderColor={alpha(accentColor, 0.5)}
              />
            )}
            <View style={st.identityText}>
              <Text style={[st.userName, { color: theme.text.primary }]} numberOfLines={1}>
                {post.authorName || i18nText("autoI18n.kullanici", "Kullanıcı")}
              </Text>
              <View style={st.subRow}>
                {timeText ? (
                  <Text style={[st.time, { color: theme.text.muted }]} numberOfLines={1}>
                    {timeText}
                  </Text>
                ) : null}
                {post.hasSpoiler && (
                  <View style={st.spoilerBadge}>
                    <AppIcon family="Ionicons" name="eye-off" size={9} color={SPOILER_RED} />
                    <Text style={st.spoilerBadgeText}>{t.badges.spoiler}</Text>
                  </View>
                )}
              </View>
            </View>
          </Pressable>

          <View
            style={[
              st.typeBadge,
              {
                backgroundColor: alpha(accentColor, 0.13),
                borderColor: alpha(accentColor, 0.32),
              },
            ]}
          >
            <AppIcon family="Ionicons" name={meta.icon} size={11} color={accentColor} />
            <Text style={[st.typeBadgeText, { color: accentColor }]}>{meta.label}</Text>
          </View>

          <Pressable
            style={st.menuButton}
            hitSlop={8}
            accessibilityRole="button"
            onPress={() => setMenuOpen(true)}
          >
            <AppIcon family="Feather" name="more-horizontal" size={19} color={theme.text.muted} />
          </Pressable>
        </View>

        <PostMenuSheet
          visible={menuOpen}
          onClose={closeMenu}
          post={post}
          isOwner={!!isOwner}
          theme={theme}
          t={t}
          accentColor={accentColor}
          typeLabel={meta.label}
          onEdit={onEdit}
          onAskDelete={askDelete}
          onReport={onReport}
        />
        <DeleteConfirmDialog
          visible={confirmDelete}
          onClose={closeDelete}
          onConfirm={confirmDeletePost}
          theme={theme}
          t={t}
        />

        {/* Spoiler göster/gizle (post üstünde) */}
        {post.hasSpoiler && (
          <Pressable
            onPress={() => setSpoilerRevealed((v) => !v)}
            style={[
              st.spoilerToggle,
              {
                borderColor: alpha(SPOILER_RED, 0.4),
                backgroundColor: alpha(SPOILER_RED, 0.08),
              },
            ]}
          >
            <AppIcon
              family="Ionicons"
              name={spoilerRevealed ? "eye-off-outline" : "eye-outline"}
              size={15}
              color={SPOILER_RED}
            />
            <Text style={st.spoilerToggleText}>
              {spoilerRevealed
                ? t.spoiler?.hide || i18nText("autoI18n.spoileri_gizle", "Spoiler'ı gizle")
                : t.spoiler?.show || i18nText("autoI18n.spoileri_goster", "Spoiler'ı göster")}
            </Text>
          </Pressable>
        )}

        {body}

        {/* Aksiyonlar */}
        <View style={[st.actions, { borderTopColor: theme.border }]}>
          <View style={st.actionsLeft}>
            <LikeButton
              liked={!!post.likedByMe}
              count={post.likesCount || 0}
              onPress={() => onLike(post.id)}
              theme={theme}
            />
            {/* Yorum: post'ta yorum varsa dolu ikon (renk nötr kalır) */}
            <Pressable
              accessibilityRole="button"
              style={[st.pill, { backgroundColor: theme.primary, borderColor: theme.border }]}
              onPress={() => onComment?.(post)}
            >
              <AppIcon
                family="Ionicons"
                name={post.commentsCount > 0 ? "chatbubble" : "chatbubble-outline"}
                size={17}
                color={theme.text.secondary}
              />
              {post.commentsCount > 0 && (
                <Text style={[st.pillText, { color: theme.text.secondary }]}>
                  {post.commentsCount}
                </Text>
              )}
            </Pressable>
          </View>

          <View style={st.actionsRight}>
            {/* Listeyi kaydet — yalnız liste paylaşımlarında. Yer imi post'u
                saklar, bu ise içeriği kendi listene KOPYALAR; ikisi ayrı iş. */}
            {post.type === "list" && mediaCount > 0 && (
              <Pressable
                style={[
                  st.pill,
                  st.saveListBtn,
                  {
                    backgroundColor: alpha(accentColor, 0.1),
                    borderColor: alpha(accentColor, 0.4),
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={i18nText("autoI18n.listeyi_kaydet", "Listeyi kaydet")}
                onPress={() => onSaveList?.(post)}
              >
                <AppIcon family="Ionicons" name="albums-outline" size={16} color={accentColor} />
                <Text style={[st.saveListText, { color: accentColor }]} numberOfLines={1}>
                  {i18nText("autoI18n.listeyi_kaydet", "Listeyi kaydet")}
                </Text>
              </Pressable>
            )}
            {/* Sohbete gönder: gönderiyi arkadaşa/gruba zengin kart olarak yollar
                (utils/chatShare.js). Yalnız herkese açık gönderide — "takipçilere
                özel" içeriği sohbete gömmek yetkisiz kişilere sızdırırdı. */}
            {onSend && (post.visibility || "public") === "public" && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={i18nText("autoI18n.sohbete_gonder", "Sohbete gönder")}
                style={[
                  st.pill,
                  st.iconPill,
                  { backgroundColor: theme.primary, borderColor: theme.border },
                ]}
                onPress={() => onSend(post)}
              >
                <AppIcon family="Ionicons" name="paper-plane-outline" size={17} color={theme.text.secondary} />
              </Pressable>
            )}
            {/* Kaydet: kaydedildiyse dolu + accent (Feather'da dolu varyant yok) */}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: !!post.bookmarkedByMe }}
              style={[
                st.pill,
                st.iconPill,
                {
                  backgroundColor: post.bookmarkedByMe
                    ? alpha(theme.accent, 0.14)
                    : theme.primary,
                  borderColor: post.bookmarkedByMe
                    ? alpha(theme.accent, 0.45)
                    : theme.border,
                },
              ]}
              onPress={() => onBookmark(post.id)}
            >
              <AppIcon
                family="Ionicons"
                name={post.bookmarkedByMe ? "bookmark" : "bookmark-outline"}
                size={17}
                color={post.bookmarkedByMe ? theme.accent : theme.text.secondary}
              />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
});

export default FeedPostCard;

// ─── Stiller ─────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  fill: { width: "100%", height: "100%" },
  center: { alignItems: "center", justifyContent: "center" },

  // iOS gölgesi overflow:hidden ile kırpılır → gölge dış sarmalayıcıda.
  shadow: {
    marginHorizontal: 14,
    marginBottom: 14,
    borderRadius: 24,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  card: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
  },
  wash: { position: "absolute", left: 0, right: 0, top: 0, height: 150 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  identity: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  identityText: { flex: 1, minWidth: 0 },
  userName: { fontSize: 14.5, fontWeight: "800" },
  subRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 1 },
  time: { fontSize: 12, fontWeight: "500" },
  spoilerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
    backgroundColor: "rgba(240,79,79,0.12)",
  },
  spoilerBadgeText: { color: SPOILER_RED, fontSize: 8.5, fontWeight: "900", letterSpacing: 0.4 },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  typeBadgeText: { fontSize: 9.5, fontWeight: "900", letterSpacing: 0.4 },
  menuButton: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },

  title: { fontSize: 17, lineHeight: 23, fontWeight: "800", marginBottom: 8, letterSpacing: -0.2 },
  content: { fontSize: 14.5, lineHeight: 22, marginBottom: 12 },

  // ── İnceleme: büyük poster + metin ──
  reviewRow: { flexDirection: "row", gap: 14, marginBottom: 12 },
  posterShadow: {
    width: REVIEW_POSTER_W,
    height: REVIEW_POSTER_H,
    borderRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 6,
  },
  reviewPoster: {
    width: "100%",
    height: "100%",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  posterScrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 28,
    paddingBottom: 8,
    paddingHorizontal: 8,
    justifyContent: "flex-end",
  },
  posterRating: { flexDirection: "row", alignItems: "center", gap: 5 },
  posterRatingNum: { color: "#fff", fontSize: 11.5, fontWeight: "800" },
  reviewCopy: { flex: 1, minWidth: 0 },
  mediaMeta: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 6 },
  mediaMetaText: { flexShrink: 1, fontSize: 11.5, fontWeight: "800" },
  reviewTitle: { fontSize: 18, lineHeight: 24, fontWeight: "800", marginBottom: 8, letterSpacing: -0.2 },
  // "Devamını oku": üstündeki metin/panel zaten 12 pt alt boşluk taşıyor;
  // düğme metne yakın dursun, altındaki öğeyle de nefes payı kalsın.
  readMore: { marginTop: -6, marginBottom: 10 },

  // ── Sohbet: alıntı paneli ──
  quote: {
    borderLeftWidth: 3,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  quoteText: { fontSize: 14.5, lineHeight: 22 },

  // ── Liste ──
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  infoChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  infoChipText: { fontSize: 11.5, fontWeight: "800" },
  stripBleed: { marginHorizontal: -16, marginBottom: 6 },
  listPoster: {
    width: LIST_POSTER_W,
    height: LIST_POSTER_H,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  wideCard: {
    height: 200,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    marginBottom: 12,
  },
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
  // Sıralı liste poster numarası (#1, #2...)
  rankNum: {
    position: "absolute",
    top: 6,
    left: 6,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  rankNumText: { color: "#fff", fontSize: 11.5, fontWeight: "900" },

  // ── Anket ──
  pollWrap: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    marginBottom: 12,
  },

  // ── Spoiler ──
  spoilerToggle: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  spoilerToggleText: { color: SPOILER_RED, fontSize: 11.5, fontWeight: "700" },
  spoilerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  // Review'de metin poster yanındaki dar sütunda: ikon+metin+düğme yan yana
  // sığmaz → dikey dizilir.
  spoilerCardCompact: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 8,
  },
  spoilerIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: "rgba(240,79,79,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  spoilerCardText: { flex: 1, fontSize: 12, fontWeight: "600", lineHeight: 16 },
  spoilerCardBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(240,79,79,0.18)",
  },
  spoilerCardBtnText: { color: SPOILER_RED, fontSize: 11, fontWeight: "700" },

  // ── Aksiyonlar ──
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionsLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  actionsRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 36,
    minWidth: 40,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pillText: { fontSize: 12.5, fontWeight: "800" },
  iconPill: { paddingHorizontal: 0, width: 40 },
  // Liste kaydetme aksiyonu: kendi rengiyle öne çıkar, dar ekranda daralır.
  saveListBtn: { flexShrink: 1, maxWidth: 165, gap: 5 },
  saveListText: { flexShrink: 1, fontSize: 11.5, fontWeight: "800" },
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
  itemText: { fontSize: 16, fontWeight: "600" },

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
