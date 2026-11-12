// components/friends/FriendProfileSections.js
//
// Arkadaş profil ekranının (screens/tabs/profile/FriendProfileScreen.js) görsel
// parçaları. Ekran veriyi ve mantığı yönetir (Firestore dinleyicileri, gizlilik,
// liste modalı); burası yalnız ÇİZER. Hepsi sunum bileşeni: veri hazır gelir.
//
// Tasarım dili (friendsTokens + PillButton ile aynı set):
//   • Ortalanmış büyük "hero" — halkalı avatar, durum çipi, rozetler, bio. Üstte
//     kaydırmayla yukarı kayıp solan accent gradyanı; kartın çerçevesi yok.
//   • Üst çubukta isim tekrarı yok: isim yalnız hero'da büyük durur, aşağı
//     kaydırınca üst çubuğa süzülür.
//   • Sayaçlar tek parça şerit, istatistikler kendi renkli ikon karoları ve
//     çubuklarıyla: her şey aynı yüzey/yarıçap ritminde.

import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import Feather from "@expo/vector-icons/Feather";
import BackButton from "@components/BackButton";
import ProfileAvatarHalo from "@components/profile/ProfileAvatarHalo";
import GlassIconButton from "@components/common/GlassIconButton";
import IdentityBadgesRow from "@components/badges/IdentityBadgesRow";
import SocialLinksRow from "@components/profile/SocialLinksRow";
import SocialLinksEditRow from "@components/profile/SocialLinksEditRow";
import { hasAnySocialLinks, normalizeSocialLinks } from "@utils/socialLinks";
import { useTheme } from "@context/ThemeContext";
import { alpha } from "@theme/colors";
import PillButton from "./PillButton";
import GlassBox from "../common/GlassBox";
import ProfileBannerBackdrop from "@components/profile/ProfileBannerBackdrop";

// Backdrop'un kaydırmayla sönme / yukarı kayma mesafesi.
const BACKDROP_HEIGHT = 340;
const BACKDROP_FADE_AT = 260;
// Üst çubuk başlığı hero'daki isim ekrandan çıkarken belirir.
const TITLE_FADE_FROM = 96;
const TITLE_FADE_TO = 150;

const ListIcon = ({ name, iconLib, color, size = 16 }) => {
  if (iconLib === "mci") return <MaterialCommunityIcons name={name} size={size} color={color} />;
  if (iconLib === "feather") return <Feather name={name} size={size} color={color} />;
  return <Ionicons name={name} size={size} color={color} />;
};

// ── Arka plan gradyanı ───────────────────────────────────────────────────────
// Ekranın en üstünden (durum çubuğu dahil) başlar; kaydırınca yarı hızda yukarı
// kayıp söner. `scrollY` native sürücüyle bağlı: JS iş parçacığına yük bindirmez.
// `banner` (utils/profileBanner.js) verilirse accent degradenin yerine sahne
// görseli çizilir: kaydırınca yakınlaşıp çok yavaş kayar, çekince esner
// (components/profile/ProfileBannerBackdrop).
export function ProfileBackdrop({ scrollY, banner = null, width }) {
  const { theme } = useTheme();
  if (banner) {
    return <ProfileBannerBackdrop banner={banner} scrollY={scrollY} width={width} />;
  }
  const motion = scrollY
    ? {
        opacity: scrollY.interpolate({
          inputRange: [0, BACKDROP_FADE_AT],
          outputRange: [1, 0],
          extrapolate: "clamp",
        }),
        transform: [
          {
            translateY: scrollY.interpolate({
              inputRange: [0, BACKDROP_FADE_AT],
              outputRange: [0, -70],
              extrapolate: "clamp",
            }),
          },
        ],
      }
    : null;

  return (
    <Animated.View pointerEvents="none" style={[styles.backdrop, motion]}>
      <LinearGradient
        colors={[alpha(theme.accent, 0.34), alpha(theme.accent, 0.1), alpha(theme.accent, 0)]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

// ── Üst çubuk ────────────────────────────────────────────────────────────────
// Geri · (kaydırınca beliren isim) · ⋯. `scrollY` verilmezse başlık hep görünür
// (yükleniyor / bulunamadı durumlarında hero yok, isim üst çubukta kalmalı).
export function ProfileTopBar({ title, scrollY, onMore, moreLabel, leading = null, trailing = null }) {
  const { theme } = useTheme();
  const titleOpacity = scrollY
    ? scrollY.interpolate({
        inputRange: [TITLE_FADE_FROM, TITLE_FADE_TO],
        outputRange: [0, 1],
        extrapolate: "clamp",
      })
    : 1;

  return (
    <View style={styles.topBar}>
      {leading || <BackButton absolute={false} />}
      <Animated.View style={[styles.topTitleWrap, { opacity: titleOpacity }]}>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[styles.topTitle, { color: theme.text?.primary ?? "#fff" }]}
        >
          {title}
        </Text>
      </Animated.View>
      {trailing ? (
        trailing
      ) : onMore ? (
        <GlassIconButton
          icon="ellipsis-horizontal"
          iconSize={18}
          size={40}
          fallbackRadius={12}
          color={theme.text?.primary ?? "#fff"}
          accessibilityLabel={moreLabel}
          onPress={onMore}
        />
      ) : (
        <View style={styles.topButton} />
      )}
    </View>
  );
}

// ── Düzenleme alanı ──────────────────────────────────────────────────────────
// Profil düzenleme modunda ad / kullanıcı adı / hakkında için cam alan: üstte
// küçük etiket + sayaç, altta yazı. Odakta accent çerçeve; `tone` "error" ise
// kırmızı, "success" ise yeşil çerçeve ve sağda durum simgesi.
const FIELD_STATUS_ICON = { success: "checkmark-circle", error: "alert-circle", muted: "time-outline" };

function ProfileEditField({ icon, label, value, max, prefix = null, tone = null, multiline = false, inputStyle, inputProps }) {
  const { theme } = useTheme();
  const [focused, setFocused] = useState(false);
  const accent = theme.accent;
  const red = theme.colors?.red ?? "#e5484d";
  const green = theme.colors?.green ?? "#29b864";
  const muted = theme.text?.muted ?? "#777";
  const toneColor = tone === "error" ? red : tone === "success" ? green : null;
  const length = String(value ?? "").length;
  const nearMax = max && length >= max * 0.9;
  return (
    <GlassBox
      role="field"
      focused={focused}
      accent={toneColor ?? accent}
      style={[
        styles.field,
        {
          backgroundColor: focused ? alpha(accent, 0.07) : theme.secondary,
          borderColor: toneColor ?? (focused ? accent : theme.border),
        },
      ]}
    >
      <View style={styles.fieldHead}>
        <Ionicons name={icon} size={13} color={focused ? accent : muted} />
        <Text allowFontScaling={false} numberOfLines={1} style={[styles.fieldLabel, { color: focused ? accent : muted }]}>
          {label}
        </Text>
        {tone && FIELD_STATUS_ICON[tone] ? (
          <Ionicons name={FIELD_STATUS_ICON[tone]} size={15} color={toneColor ?? muted} />
        ) : max ? (
          <Text
            allowFontScaling={false}
            style={[styles.fieldCounter, { color: nearMax ? red : alpha(muted, focused ? 1 : 0.7) }]}
          >
            {length}/{max}
          </Text>
        ) : null}
      </View>
      <View style={styles.fieldBody}>
        {prefix ? (
          <Text allowFontScaling={false} style={[styles.fieldPrefix, { color: focused ? accent : muted }]}>
            {prefix}
          </Text>
        ) : null}
        <TextInput
          {...inputProps}
          value={value}
          maxLength={max}
          multiline={multiline}
          allowFontScaling={false}
          placeholderTextColor={alpha(muted, 0.8)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            styles.fieldInput,
            multiline && styles.fieldInputMultiline,
            { color: theme.text?.primary ?? "#fff" },
            inputStyle,
          ]}
        />
      </View>
    </GlassBox>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────────────
export const ProfileHero = memo(function ProfileHero({
  avatarIndex,
  photoURL,
  onAvatarPress,
  onAvatarLongPress,
  name,
  username,
  badges,
  avatarProgress,
  streak,
  language,
  bio,
  socialLinks,
  memberSince,
  // Düzenleme modu (kendi profil önizlemesi): verilirse ad / kullanıcı adı / hakkında
  // etiketli cam alanlardan oluşan bir forma döner (ProfileEditField), sosyal şerit
  // düzenleme hâline geçer.
  // { name, onChangeName, namePlaceholder, nameLabel, nameMax, username, onChangeUsername,
  //   usernamePlaceholder, usernameLabel, usernameMax, usernameHint: {text, tone},
  //   bio, onChangeBio, bioPlaceholder, bioMax, socialDraft, socialInvalid,
  //   onChangeSocial, avatarHint }
  editor = null,
}) {
  const { theme } = useTheme();
  const enter = useRef(new Animated.Value(0)).current;
  const hintColor =
    editor?.usernameHint?.tone === "success"
      ? theme.colors?.green ?? "#29b864"
      : editor?.usernameHint?.tone === "error"
        ? theme.colors?.red ?? "#e5484d"
        : theme.text?.muted ?? "#666";
  // Başkasının yazdığı veri: her seferinde temizlenir (bilinmeyen/geçersiz atılır).
  const links = useMemo(() => normalizeSocialLinks(socialLinks), [socialLinks]);

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 420, useNativeDriver: true }).start();
  }, [enter]);

  return (
    <Animated.View
      style={[
        styles.hero,
        {
          opacity: enter,
          transform: [
            { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
          ],
        },
      ]}
    >
      <View style={styles.avatarWrap}>
        <ProfileAvatarHalo
          avatarIndex={avatarIndex}
          photoURL={photoURL}
          isCustomPhoto={avatarIndex === -1}
          progress={avatarProgress?.progress ?? 0}
          ringColor={avatarProgress?.borderColor ?? theme.accent}
          ringColor2={avatarProgress?.borderColor2 ?? theme.accent}
          ringHidden={!avatarProgress}
          backgroundColor={theme.primary}
          onPress={onAvatarPress}
          onLongPress={onAvatarLongPress}
        />
        {/* Düzenleme modunda avatara dokununca seçici açılır: köşede küçük kalem. */}
        {editor ? (
          <View
            pointerEvents="none"
            accessibilityLabel={editor.avatarHint}
            style={[styles.avatarEditDot, { backgroundColor: theme.accent, borderColor: theme.primary }]}
          >
            <Ionicons name="pencil" size={13} color="#fff" />
          </View>
        ) : null}
      </View>

      {editor ? (
        // Düzenleme: ad / kullanıcı adı / hakkında tek form yığınında, cam alanlar.
        <View style={styles.editStack}>
          <ProfileEditField
            icon="person-outline"
            label={editor.nameLabel ?? editor.namePlaceholder}
            value={editor.name}
            max={editor.nameMax}
            inputStyle={styles.fieldInputName}
            inputProps={{
              testID: "profile-edit-name",
              onChangeText: editor.onChangeName,
              placeholder: editor.namePlaceholder,
              fontRole: "body",
              returnKeyType: "done",
              accessibilityLabel: editor.nameLabel ?? editor.namePlaceholder,
            }}
          />
          <ProfileEditField
            icon="at-outline"
            label={editor.usernameLabel}
            value={editor.username}
            max={editor.usernameMax}
            prefix="@"
            tone={editor.usernameHint?.tone ?? null}
            inputProps={{
              testID: "profile-edit-username",
              onChangeText: editor.onChangeUsername,
              placeholder: editor.usernamePlaceholder,
              autoCapitalize: "none",
              autoCorrect: false,
              autoComplete: "off",
              accessibilityLabel: editor.usernameLabel,
            }}
          />
          {editor.usernameHint ? (
            <Text
              testID="profile-edit-username-hint"
              allowFontScaling={false}
              numberOfLines={2}
              style={[styles.usernameHint, { color: hintColor }]}
            >
              {editor.usernameHint.text}
            </Text>
          ) : null}
          <ProfileEditField
            icon="chatbubble-ellipses-outline"
            label={editor.bioLabel ?? editor.bioPlaceholder}
            value={editor.bio}
            max={editor.bioMax}
            multiline
            inputProps={{
              testID: "profile-edit-bio",
              onChangeText: editor.onChangeBio,
              placeholder: editor.bioPlaceholder,
              accessibilityLabel: editor.bioLabel ?? editor.bioPlaceholder,
            }}
          />
        </View>
      ) : (
        <Text
          allowFontScaling={false}
          // Kullanıcının kendi yazdığı ad — ProfileScreen'deki eşiyle aynı
          // gerekçeyle başlık fontuna girmez (bkz. utils/typographyRoles.js).
          fontRole="body"
          numberOfLines={2}
          style={[styles.name, { color: theme.text?.primary ?? "#fff" }]}
        >
          {name}
        </Text>
      )}

      {!editor && username ? (
        <View style={styles.identityRow}>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.username, { color: theme.text?.secondary ?? "#aaa" }]}
          >
            @{username}
          </Text>
        </View>
      ) : null}

      <IdentityBadgesRow
        badges={badges}
        theme={theme}
        language={language}
        style={styles.badgesRow}
      />

      {!editor && streak ? <View style={styles.streakRow}>{streak}</View> : null}

      {!editor && bio ? (
        <Text
          numberOfLines={3}
          style={[styles.bio, { color: theme.text?.secondary ?? "#aaa" }]}
        >
          {bio}
        </Text>
      ) : null}

      {editor ? (
        <SocialLinksEditRow
          draft={editor.socialDraft}
          invalid={editor.socialInvalid}
          onChange={editor.onChangeSocial}
          theme={theme}
          language={language}
          style={styles.socialRow}
        />
      ) : hasAnySocialLinks(links) ? (
        <SocialLinksRow
          links={links}
          theme={theme}
          language={language}
          style={styles.socialRow}
        />
      ) : null}

      {memberSince ? (
        <View style={[styles.memberSince, { borderColor: alpha(theme.border, 0.95) }]}>
          <Ionicons name="calendar-outline" size={12} color={theme.text?.muted ?? "#666"} />
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.memberSinceText, { color: theme.text?.muted ?? "#666" }]}
          >
            {memberSince}
          </Text>
        </View>
      ) : null}
    </Animated.View>
  );
});

// ── Sayaç şeridi ─────────────────────────────────────────────────────────────
// items: [{ key, icon, label, value, color }]. Tek kap, aralarında ince ayraç
// (profil ekranındaki FriendsActionBar 7 Kas'ta renkli ayrı hücrelere geçti;
// bu şerit tek kap + ayraç düzeninde kaldı).
export const ProfileStatStrip = memo(function ProfileStatStrip({ items }) {
  const { theme } = useTheme();
  return (
    <GlassBox role="card"
      style={[
        styles.statStrip,
        { backgroundColor: theme.secondary, borderColor: theme.border },
      ]}
    >
      {items.map((item, index) => (
        <React.Fragment key={item.key}>
          {index > 0 ? (
            <View style={[styles.statDivider, { backgroundColor: alpha(theme.border, 0.8) }]} />
          ) : null}
          <View
            style={styles.statCell}
            accessible
            accessibilityLabel={`${item.label}: ${item.value}`}
          >
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              fontRole="numeric"
              style={[styles.statValue, { color: theme.text?.primary ?? "#fff" }]}
            >
              {item.value}
            </Text>
            <View style={styles.statLabelRow}>
              <Ionicons name={item.icon} size={12} color={item.color} />
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[styles.statLabel, { color: theme.text?.muted ?? "#666" }]}
              >
                {item.label}
              </Text>
            </View>
          </View>
        </React.Fragment>
      ))}
    </GlassBox>
  );
});

// ── Bölüm başlığı ────────────────────────────────────────────────────────────
export function SectionHeader({ title, trailing }) {
  const { theme } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionBar, { backgroundColor: theme.accent }]} />
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[styles.sectionTitle, { color: theme.text?.primary ?? "#fff" }]}
      >
        {title}
      </Text>
      {trailing || null}
    </View>
  );
}

// Başlığın sağındaki küçük sayı çipi (ör. "5 ⊞").
export function CountChip({ value, icon }) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.countChip,
        { backgroundColor: alpha(theme.accent, 0.14) },
      ]}
    >
      <Text allowFontScaling={false} style={[styles.countChipText, { color: theme.accent }]}>
        {value}
      </Text>
      {icon ? <Ionicons name={icon} size={13} color={theme.accent} /> : null}
    </View>
  );
}

// ── İzleme istatistikleri: tek kompakt kart ─────────────────────────────────
// Eskiden üç ayrı kart (toplam süre, 2×2 karolar, tür çubukları) ≈ 700 px
// tutuyordu; artık tek kart üç bölüm: (1) toplam süre + film/dizi dağılımı,
// (2) dört sayaç tek şeritte, (3) en çok izlenen türler çip olarak.
//
//   movie / tv : { label, minutes, share, color, durationLabel }
//   metrics    : [{ key, icon, iconLib, label, value, color }]
//   genres     : [[ad, adet], ...] azalan sırada; `genreColors` sıraya göre döner.
export const WatchStatsCard = memo(function WatchStatsCard({
  caption,
  totalLabel,
  minutesLabel,
  movie,
  tv,
  metrics,
  genresTitle,
  genres,
  genreColors,
}) {
  const { theme } = useTheme();
  const hasSplit = movie.minutes + tv.minutes > 0;
  const divider = { backgroundColor: alpha(theme.border, 0.9) };

  return (
    <GlassBox role="card"
      style={[
        styles.statsCard,
        { backgroundColor: theme.secondary, borderColor: theme.border },
      ]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={[alpha(theme.accent, 0.16), alpha(theme.accent, 0)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* (1) Toplam süre + film/dizi dağılımı */}
      <View style={styles.statsTotal}>
        <View style={styles.statsTotalTop}>
          <View style={styles.statsTotalCopy}>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.statsCaption, { color: theme.text?.secondary ?? "#aaa" }]}
            >
              {caption}
            </Text>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              fontRole="numeric"
              style={[styles.statsTotalValue, { color: theme.text?.primary ?? "#fff" }]}
            >
              {totalLabel}
            </Text>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.statsMinutes, { color: theme.text?.muted ?? "#666" }]}
            >
              {minutesLabel}
            </Text>
          </View>
          <View style={[styles.statsClock, { backgroundColor: alpha(theme.accent, 0.16) }]}>
            <Ionicons name="time-outline" size={24} color={theme.accent} />
          </View>
        </View>

        <View style={[styles.splitTrack, { backgroundColor: theme.primary ?? "#111" }]}>
          {hasSplit && movie.minutes > 0 ? (
            <View style={[styles.splitSegment, { flexGrow: movie.minutes, backgroundColor: movie.color }]} />
          ) : null}
          {hasSplit && tv.minutes > 0 ? (
            <View style={[styles.splitSegment, { flexGrow: tv.minutes, backgroundColor: tv.color }]} />
          ) : null}
        </View>

        <View style={styles.splitLegend}>
          {[movie, tv].map((part) => (
            <View key={part.label} style={styles.splitItem}>
              <View style={[styles.splitDot, { backgroundColor: part.color }]} />
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[styles.splitLabel, { color: theme.text?.primary ?? "#fff" }]}
              >
                {part.label}
              </Text>
              {/* Dar ekranda kırpılan TEK parça süre: etiket ve yüzde hep okunur. */}
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[styles.splitDuration, { color: theme.text?.muted ?? "#666" }]}
              >
                {part.durationLabel || ""}
              </Text>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[styles.splitShare, { color: part.color }]}
              >
                {part.share}%
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* (2) Yapım sayıları önde, ayrıntı sayıları altta */}
      <View style={[styles.statsDivider, divider]} />
      <View style={styles.metricBlock}>
        <View style={styles.metricFeatureRow}>
          {metrics.slice(0, 2).map((item) => (
            <View
              key={item.key}
              style={[styles.metricFeature, { backgroundColor: alpha(item.color, 0.1) }]}
              accessible
              accessibilityLabel={`${item.label}: ${item.value}`}
            >
              <View style={styles.metricFeatureTop}>
                <Text numberOfLines={1} style={[styles.metricFeatureLabel, { color: theme.text.secondary }]}>
                  {item.label}
                </Text>
                <ListIcon name={item.icon} iconLib={item.iconLib} color={item.color} size={17} />
              </View>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                fontRole="numeric"
                style={[styles.metricFeatureValue, { color: theme.text.primary }]}
              >
                {item.value}
              </Text>
              <View style={[styles.metricFeatureRule, { backgroundColor: item.color }]} />
            </View>
          ))}
        </View>
        <View style={[styles.metricDetailRow, { borderTopColor: alpha(theme.border, 0.8) }]}>
          {metrics.slice(2).map((item) => (
            <View key={item.key} style={styles.metricDetail} accessible accessibilityLabel={`${item.label}: ${item.value}`}>
              <ListIcon name={item.icon} iconLib={item.iconLib} color={item.color} size={14} />
              <Text numberOfLines={1} style={[styles.metricDetailLabel, { color: theme.text.secondary }]}>{item.label}</Text>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                fontRole="numeric"
                style={[styles.metricDetailValue, { color: theme.text.primary }]}
              >
                {item.value}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* (3) En çok izlenen türler */}
      {genres.length > 0 ? (
        <>
          <View style={[styles.statsDivider, divider]} />
          <View style={styles.genresBlock}>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.genresTitle, { color: theme.text?.secondary ?? "#aaa" }]}
            >
              {genresTitle}
            </Text>
            <View style={styles.genreChips}>
              {genres.map(([genre, count], index) => {
                const color = genreColors[index % genreColors.length];
                return (
                  <View
                    key={genre}
                    style={[
                      styles.genreChip,
                      {
                        backgroundColor: alpha(color, index === 0 ? 0.22 : 0.13),
                        borderColor: alpha(color, index === 0 ? 0.55 : 0),
                      },
                    ]}
                  >
                    <Text
                      allowFontScaling={false}
                      numberOfLines={1}
                      style={[styles.genreChipName, { color: theme.text?.primary ?? "#fff" }]}
                    >
                      {genre}
                    </Text>
                    <Text allowFontScaling={false} style={[styles.genreChipCount, { color }]}>
                      {count}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </>
      ) : null}
    </GlassBox>
  );
});

// ── Bildirim kartı (gizli profil / paylaşılan liste yok) ─────────────────────
export const ProfileNoticeCard = memo(function ProfileNoticeCard({ icon, title }) {
  const { theme } = useTheme();
  return (
    <GlassBox role="card"
      style={[
        styles.notice,
        { backgroundColor: theme.secondary, borderColor: theme.border },
      ]}
    >
      <View style={[styles.noticeMedallion, { backgroundColor: alpha(theme.accent, 0.13) }]}>
        <Ionicons name={icon} size={26} color={theme.accent} />
      </View>
      <Text
        allowFontScaling={false}
        style={[styles.noticeText, { color: theme.text?.secondary ?? "#aaa" }]}
      >
        {title}
      </Text>
    </GlassBox>
  );
});

// ── Önizleme şeridi (kendi profilin, arkadaş gözünden) ───────────────────────
// Ekranın gerçek bir arkadaş profili olmadığını söyler; sağdaki düğme görünenleri
// belirleyen ayarlara götürür. Hero'nun opaklıkla giren kabının DIŞINDA durur.
export const ProfilePreviewBanner = memo(function ProfilePreviewBanner({
  title,
  subtitle,
  actionLabel,
  onAction,
  icon = "eye-outline",
  actionIcon = "lock-closed-outline",
}) {
  const { theme } = useTheme();
  return (
    <GlassBox role="card"
      style={[
        styles.previewBanner,
        { backgroundColor: alpha(theme.accent, 0.1), borderColor: alpha(theme.accent, 0.28) },
      ]}
    >
      <View style={[styles.previewMedallion, { backgroundColor: alpha(theme.accent, 0.16) }]}>
        <Ionicons name={icon} size={18} color={theme.accent} />
      </View>
      <View style={styles.previewTexts}>
        <Text
          allowFontScaling={false}
          numberOfLines={2}
          style={[styles.previewTitle, { color: theme.text?.primary ?? "#fff" }]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            allowFontScaling={false}
            numberOfLines={3}
            style={[styles.previewSubtitle, { color: theme.text?.secondary ?? "#aaa" }]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <PillButton
          label={actionLabel}
          icon={actionIcon}
          size="sm"
          variant="soft"
          onPress={onAction}
        />
      ) : null}
    </GlassBox>
  );
});

const styles = StyleSheet.create({
  // ── Arka plan + üst çubuk ──────────────────────────────────────────────────
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: BACKDROP_HEIGHT,
  },
  topBar: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
    zIndex: 2,
  },
  topTitleWrap: { flex: 1, minWidth: 0 },
  topTitle: { fontSize: 17, fontWeight: "800", textAlign: "center" },
  // BackButton ile aynı ölçü/köşe: iki uç dengeli, başlık tam ortada kalsın.
  topButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Hero ───────────────────────────────────────────────────────────────────
  hero: { alignItems: "center", marginTop: 6, marginBottom: 20 },
  avatarWrap: { alignSelf: "center" },
  name: {
    marginTop: 14,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
    lineHeight: 31,
    textAlign: "center",
    paddingHorizontal: 12,
  },
  identityRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
    paddingHorizontal: 12,
  },
  username: { fontSize: 14, fontWeight: "600", flexShrink: 1 },
  // Düzenleme modu: aynı yazı stili, altında ince vurgu çizgisi (alanın yazılabilir olduğu okunsun).
  avatarEditDot: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  usernameHint: { marginTop: -4, fontSize: 12, fontWeight: "700", paddingHorizontal: 6 },
  // Düzenleme formu (ProfileEditField).
  editStack: { alignSelf: "stretch", gap: 10, marginTop: 18 },
  field: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10 },
  fieldHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  fieldLabel: { flex: 1, fontSize: 11, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" },
  fieldCounter: { fontSize: 11, fontWeight: "700", fontVariant: ["tabular-nums"] },
  fieldBody: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  fieldPrefix: { fontSize: 16, fontWeight: "700", marginRight: 2 },
  fieldInput: { flex: 1, fontSize: 16, fontWeight: "600", paddingVertical: 2, paddingHorizontal: 0 },
  fieldInputName: { fontSize: 20, fontWeight: "800", letterSpacing: -0.3 },
  fieldInputMultiline: { minHeight: 44, maxHeight: 120, lineHeight: 21, textAlignVertical: "top" },
  badgesRow: { justifyContent: "center", marginTop: 8, marginBottom: 0 },
  streakRow: { marginTop: 12, alignItems: "center" },
  bio: {
    marginTop: 12,
    maxWidth: 330,
    paddingHorizontal: 8,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  socialRow: { justifyContent: "center", marginTop: 14, paddingHorizontal: 12 },
  memberSince: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 14,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 5,
    maxWidth: "100%",
  },
  memberSinceText: { fontSize: 12, fontWeight: "700" },

  // ── Sayaç şeridi ───────────────────────────────────────────────────────────
  statStrip: {
    flexDirection: "row",
    alignItems: "stretch",
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 14,
  },
  statCell: { flex: 1, minWidth: 0, alignItems: "center", gap: 4, paddingHorizontal: 6 },
  statDivider: { width: StyleSheet.hairlineWidth * 2, marginVertical: 4 },
  statValue: { fontSize: 21, fontWeight: "900", letterSpacing: -0.3 },
  statLabelRow: { flexDirection: "row", alignItems: "center", gap: 4, maxWidth: "100%" },
  statLabel: { fontSize: 11.5, fontWeight: "700", flexShrink: 1 },

  // ── Bölüm başlığı ──────────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 26,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  sectionBar: { width: 4, height: 18, borderRadius: 2 },
  sectionTitle: { flex: 1, fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  countChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  countChipText: { fontSize: 12.5, fontWeight: "900" },

  // ── İzleme istatistikleri kartı ────────────────────────────────────────────
  statsCard: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 6,
  },
  statsTotal: { padding: 16 },
  statsTotalTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  statsTotalCopy: { flex: 1, minWidth: 0 },
  statsCaption: { fontSize: 12.5, fontWeight: "700" },
  statsTotalValue: { fontSize: 30, fontWeight: "900", letterSpacing: -0.8, marginTop: 1 },
  statsMinutes: { fontSize: 12, fontWeight: "700" },
  statsClock: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  splitTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    flexDirection: "row",
    gap: 3,
    marginTop: 14,
  },
  splitSegment: { flexBasis: 0, height: "100%", borderRadius: 4 },
  splitLegend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 10,
  },
  splitItem: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 6 },
  splitDot: { width: 8, height: 8, borderRadius: 4 },
  splitLabel: { flexShrink: 0, fontSize: 12.5, fontWeight: "800" },
  splitDuration: { flexShrink: 1, flexGrow: 1, fontSize: 12, fontWeight: "700" },
  splitShare: { flexShrink: 0, fontSize: 12.5, fontWeight: "900" },
  statsDivider: { height: StyleSheet.hairlineWidth * 2, marginHorizontal: 16 },

  // ── Yapım sayıları ve ayrıntılar ──────────────────────────────────────────
  metricBlock: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 5 },
  metricFeatureRow: { flexDirection: "row", gap: 8 },
  metricFeature: {
    flex: 1,
    minWidth: 0,
    height: 88,
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingTop: 10,
    paddingBottom: 8,
    overflow: "hidden",
    justifyContent: "space-between",
  },
  metricFeatureTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
  metricFeatureLabel: { flex: 1, fontSize: 12, fontWeight: "750" },
  metricFeatureValue: { fontSize: 29, fontWeight: "900", letterSpacing: -0.8 },
  metricFeatureRule: { position: "absolute", bottom: 0, left: 13, width: 31, height: 2, borderRadius: 2 },
  metricDetailRow: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, marginTop: 11, paddingTop: 5 },
  metricDetail: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 8 },
  metricDetailLabel: { flex: 1, minWidth: 0, fontSize: 11.5, fontWeight: "700" },
  metricDetailValue: { maxWidth: "40%", fontSize: 16, fontWeight: "850", textAlign: "right" },

  // ── Türler ─────────────────────────────────────────────────────────────────
  genresBlock: { padding: 16, paddingTop: 13 },
  genresTitle: { fontSize: 12.5, fontWeight: "800", marginBottom: 10 },
  genreChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  genreChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 6,
    maxWidth: "100%",
  },
  genreChipName: { fontSize: 12.5, fontWeight: "700", flexShrink: 1 },
  genreChipCount: { fontSize: 12, fontWeight: "900" },

  // ── Bildirim kartı ─────────────────────────────────────────────────────────
  notice: {
    alignItems: "center",
    gap: 12,
    borderRadius: 22,
    borderWidth: 1,
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginTop: 28,
  },
  noticeMedallion: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  noticeText: { fontSize: 14, fontWeight: "700", textAlign: "center", lineHeight: 20 },

  // ── Önizleme şeridi ────────────────────────────────────────────────────────
  previewBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  previewMedallion: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  previewTexts: { flex: 1, minWidth: 0, gap: 2 },
  previewTitle: { fontSize: 14, fontWeight: "800", letterSpacing: -0.1 },
  previewSubtitle: { fontSize: 12, fontWeight: "600", lineHeight: 16 },
});
