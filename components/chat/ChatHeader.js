// components/chat/ChatHeader.js
//
// Sohbet ekranı üst başlığı (1-1 ve grup). Eskiden ChatScreen içinde düz bir
// satırdı; ayrı bileşen olarak şunları taşıyor:
//   • yuvarlak "tonal" geri / bilgi butonları; geri butonunda DİĞER sohbetlerin
//     okunmamış sayısı (bu sohbet kendini zaten sıfırlıyor)
//   • avatar halkası + durum noktası; çevrimiçiyken yayılan nabız
//   • canlı alt satır: "yazıyor…" (zıplayan noktalar) > Sohbette > Çevrimiçi >
//     Son görülme (profil ekranıyla aynı göreli biçim); grupta üye adları
//   • güvenli alan üstüne göre dolgu (sabit 42/52px yerine) ve alt köşelerde
//     yumuşak yuvarlama
// "Hareketi Azalt" açıkken nabız ve nokta zıplaması çizilmez.

import React, { memo, useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Reanimated, {
  Easing,
  FadeIn,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import GlassIconButton from "@components/common/GlassIconButton";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@context/ThemeContext";
import { useLanguage } from "@context/LanguageContext";
import { useUnreadMessages } from "@context/UnreadMessagesContext";
import { formatLastSeen } from "@services/presenceService";
import { i18nText } from "@utils/i18nText";
import useReduceMotion from "../../hooks/useReduceMotion";
import { formatBadge } from "../../utils/friendsBarModel";
import { alpha } from "../../theme/colors";

const ONLINE_COLOR = "#5EE8A0";
const IN_CHAT_COLOR = "#64B5F6";
const AVATAR_SIZE = 44;
const RING_SIZE = AVATAR_SIZE + 8;
const DOT_SIZE = 13;
// Ambiyans açıkken başlık yüzünün opaklığı: lekeler görünsün ama ad/durum metni
// ve cam düğmeler okunur kalsın.
const TRANSLUCENT_ALPHA = 0.72;

// ─── "yazıyor" noktaları ────────────────────────────────────────────────────
function TypingDot({ color, delay, animate }) {
  const v = useSharedValue(0);

  useEffect(() => {
    if (!animate) {
      v.value = 0;
      return undefined;
    }
    v.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 280, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 280, easing: Easing.in(Easing.quad) }),
          withTiming(0, { duration: 260 }),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(v);
  }, [animate, delay, v]);

  const animated = useAnimatedStyle(() => ({
    opacity: 0.4 + v.value * 0.6,
    transform: [{ translateY: -3 * v.value }],
  }));

  return <Reanimated.View style={[styles.dot, { backgroundColor: color }, animated]} />;
}

function TypingDots({ color, animate }) {
  return (
    <View style={styles.dots}>
      <TypingDot color={color} delay={0} animate={animate} />
      <TypingDot color={color} delay={140} animate={animate} />
      <TypingDot color={color} delay={280} animate={animate} />
    </View>
  );
}

// ─── Avatar + halka + durum noktası ─────────────────────────────────────────
function AvatarWithPresence({ children, ringColor, live, dotColor, surface, reduceMotion }) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!live || reduceMotion) {
      cancelAnimation(pulse);
      pulse.value = 0;
      return undefined;
    }
    pulse.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }),
      -1,
    );
    return () => cancelAnimation(pulse);
  }, [live, reduceMotion, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: (1 - pulse.value) * 0.5,
    transform: [{ scale: 1 + pulse.value * 0.32 }],
  }));

  return (
    <View style={styles.avatarWrap}>
      {live && !reduceMotion ? (
        <Reanimated.View
          pointerEvents="none"
          style={[styles.pulse, { borderColor: ringColor }, pulseStyle]}
        />
      ) : null}
      <View style={[styles.ring, { borderColor: ringColor }]}>{children}</View>
      {dotColor ? (
        <View
          style={[
            styles.statusDot,
            { backgroundColor: dotColor, borderColor: surface },
          ]}
        />
      ) : null}
    </View>
  );
}

// ─── Tonal yuvarlak buton ───────────────────────────────────────────────────
// iOS 26+: Liquid Glass daire; diğer yerlerde eski tonal daire. Okunmamış sayacı
// camın DIŞINDA (overlay) durur — cam, çocuklarını kendi şekline kırpar.
function RoundButton({ icon, onPress, label, tint, bg, badge, badgeColor, badgeBorder }) {
  return (
    <GlassIconButton
      icon={icon}
      color={tint}
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={6}
      fallbackRadius={20}
      fallbackStyle={{ backgroundColor: bg }}
      overlay={
        badge ? (
          <View
            pointerEvents="none"
            style={[
              styles.unread,
              { backgroundColor: badgeColor, borderColor: badgeBorder },
            ]}
          >
            <Text allowFontScaling={false} style={styles.unreadText}>
              {badge}
            </Text>
          </View>
        ) : null
      }
    />
  );
}

function ChatHeader({
  title,
  isGroup = false,
  avatar,
  // 1-1: { typing, inChat, online, presence }. Grup: yok.
  status,
  // Grup alt satırı için üye adları (kendin hariç) ve toplam üye sayısı.
  memberNames,
  memberCount = 0,
  groupColor,
  // Ambiyans arka planı açıkken true: başlık yarı saydam olur, ışık lekeleri
  // durum çubuğundan başlayarak arkasından görünür (düz opak bant kalmaz).
  translucent = false,
  onBack,
  onOpenInfo,
}) {
  const { theme } = useTheme();
  const { language } = useLanguage(); // dil değişince alt satır yeniden çevrilsin
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const { unreadMessages } = useUnreadMessages();

  const textPrimary = theme.text?.primary || "#fff";
  const textMuted = theme.text?.muted || "rgba(255,255,255,0.5)";
  const tonalBg = alpha(textPrimary, 0.08);
  const accent = theme.accent || "#6C63FF";
  const surface = theme.secondary || "#1b1b24";

  const typing = !isGroup && !!status?.typing;
  const inChat = !isGroup && !!status?.inChat;
  const online = !isGroup && !!status?.online;
  const live = inChat || online;

  let kind = "idle";
  if (typing) kind = "typing";
  else if (inChat) kind = "inChat";
  else if (online) kind = "online";

  const statusColor =
    kind === "typing" || kind === "inChat"
      ? IN_CHAT_COLOR
      : kind === "online"
        ? ONLINE_COLOR
        : textMuted;

  let subtitle;
  if (isGroup) {
    const names = (memberNames || []).filter(Boolean);
    if (names.length === 0) {
      subtitle = i18nText("autoI18n.n_uye", "{{n}} üye", { n: memberCount });
    } else {
      const shown = names.slice(0, 3).join(", ");
      const rest = Math.max(0, memberCount - 1 - Math.min(3, names.length));
      subtitle = rest > 0 ? `${shown} +${rest}` : shown;
    }
  } else if (kind === "typing") {
    subtitle = i18nText("autoI18n.chat_typing", "yazıyor");
  } else if (kind === "inChat") {
    subtitle = i18nText("autoI18n.sohbette", "Sohbette");
  } else if (kind === "online") {
    subtitle = i18nText("autoI18n.cevrimici", "Çevrimiçi");
  } else {
    subtitle = i18nText("autoI18n.last_seen_value", "Son görülme {{value}}", {
      value:
        formatLastSeen(status?.presence) ||
        i18nText("autoI18n.bilinmiyor", "bilinmiyor"),
    });
  }

  const ringColor = isGroup
    ? alpha(groupColor || accent, 0.55)
    : live
      ? statusColor
      : alpha(textPrimary, 0.14);

  const infoLabel = isGroup
    ? i18nText("autoI18n.grup_bilgilerini_ac", "Grup bilgilerini aç")
    : i18nText("autoI18n.arkadas_profilini_ac", "Arkadaş profilini aç");

  return (
    <View
      style={[
        styles.wrap,
        translucent && styles.wrapTranslucent,
        {
          paddingTop: Math.max(insets.top, 12) + 6,
          backgroundColor: translucent ? alpha(surface, TRANSLUCENT_ALPHA) : surface,
          borderBottomColor: theme.border || "rgba(255,255,255,0.06)",
        },
      ]}
    >
      <View style={styles.row}>
        <RoundButton
          icon="chevron-back"
          onPress={onBack}
          label={i18nText("autoI18n.geri", "Geri")}
          tint={textPrimary}
          bg={tonalBg}
          badge={formatBadge(unreadMessages)}
          badgeColor={accent}
          badgeBorder={surface}
        />

        <Pressable
          onPress={onOpenInfo}
          accessibilityRole="button"
          accessibilityLabel={infoLabel}
          style={({ pressed }) => [styles.identity, pressed && styles.pressed]}
        >
          <AvatarWithPresence
            ringColor={ringColor}
            live={live}
            dotColor={isGroup ? null : live ? statusColor : null}
            surface={surface}
            reduceMotion={reduceMotion}
          >
            {avatar}
          </AvatarWithPresence>

          <View style={styles.info}>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.name, { color: textPrimary }]}
            >
              {title}
            </Text>
            {/* key: durum değişince alt satır yumuşakça belirir */}
            <Reanimated.View
              key={`${language}-${kind}`}
              entering={FadeIn.duration(180)}
              style={styles.statusRow}
            >
              {kind === "typing" ? (
                <>
                  <Text
                    allowFontScaling={false}
                    numberOfLines={1}
                    style={[styles.status, { color: statusColor }]}
                  >
                    {subtitle}
                  </Text>
                  <TypingDots color={statusColor} animate={!reduceMotion} />
                </>
              ) : (
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={[styles.status, { color: isGroup ? textMuted : statusColor }]}
                >
                  {subtitle}
                </Text>
              )}
            </Reanimated.View>
          </View>
        </Pressable>

        <RoundButton
          icon={isGroup ? "people-circle-outline" : "person-circle-outline"}
          onPress={onOpenInfo}
          label={infoLabel}
          tint={textPrimary}
          bg={tonalBg}
        />
      </View>
    </View>
  );
}

export default memo(ChatHeader);

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: 12,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    zIndex: 5,
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
  },
  // Yarı saydam başlıkta gölge yok: iOS gölgeyi saydam yüzün ALTINDAN da çizer
  // (başlık içi kirli koyulaşır), Android'de elevation zaten kenarı keser.
  wrapTranslucent: {
    elevation: 0,
    shadowOpacity: 0,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.97 }] },

  unread: {
    position: "absolute",
    top: -4,
    right: -5,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadText: { color: "#fff", fontSize: 9.5, fontWeight: "800" },

  identity: { flex: 1, flexDirection: "row", alignItems: "center", minWidth: 0 },
  avatarWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  ring: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  pulse: {
    position: "absolute",
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 2,
  },
  statusDot: {
    position: "absolute",
    right: 1,
    bottom: 1,
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    borderWidth: 2.5,
  },

  info: { flex: 1, minWidth: 0 },
  name: { fontSize: 16.5, fontWeight: "800", letterSpacing: 0.1 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2, minHeight: 15 },
  status: { fontSize: 12, fontWeight: "600", flexShrink: 1 },
  dots: { flexDirection: "row", alignItems: "flex-end", gap: 2, height: 10, paddingBottom: 1 },
  dot: { width: 3.5, height: 3.5, borderRadius: 2 },
});

// ChatScreen avatarı başlığın halkasına tam oturacak boyutta çizer.
export const CHAT_HEADER_AVATAR_SIZE = AVATAR_SIZE;
