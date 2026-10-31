// components/chat/ChatHeader.js
//
// Sohbet ekranı üst başlığı (1-1 ve grup). Eskiden ChatScreen içinde düz bir
// satırdı; ayrı bileşen olarak şunları taşıyor:
//   • yuvarlak "tonal" geri / bilgi butonları; geri butonunda DİĞER sohbetlerin
//     okunmamış sayısı (bu sohbet kendini zaten sıfırlıyor)
//   • avatar halkası
//   • alt satır: 1-1'de arkadaşın @kullanıcı adı, grupta üye adları
//   • güvenli alan üstüne göre dolgu (sabit 42/52px yerine) ve alt köşelerde
//     yumuşak yuvarlama
// Çevrimiçi / Sohbette / yazıyor / son görülme göstergeleri 1 Kas 2026'da kaldırıldı
// (kullanıcı kararı: bu uygulamada gerek yok).

import React, { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import GlassIconButton from "@components/common/GlassIconButton";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@context/ThemeContext";
import { useLanguage } from "@context/LanguageContext";
import { useUnreadMessages } from "@context/UnreadMessagesContext";
import { i18nText } from "@utils/i18nText";
import { formatBadge } from "../../utils/friendsBarModel";
import { alpha } from "../../theme/colors";

const AVATAR_SIZE = 44;
const RING_SIZE = AVATAR_SIZE + 8;
// Ambiyans açıkken başlık yüzünün opaklığı: lekeler görünsün ama ad/durum metni
// ve cam düğmeler okunur kalsın.
const TRANSLUCENT_ALPHA = 0.72;

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
  // 1-1 alt satırı: arkadaşın kullanıcı adı (@ eklenir). Yoksa alt satır boş kalır.
  username,
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
  useLanguage(); // dil değişince alt satır yeniden çevrilsin
  const insets = useSafeAreaInsets();
  const { unreadMessages } = useUnreadMessages();

  const textPrimary = theme.text?.primary || "#fff";
  const textMuted = theme.text?.muted || "rgba(255,255,255,0.5)";
  const tonalBg = alpha(textPrimary, 0.08);
  const accent = theme.accent || "#6C63FF";
  const surface = theme.secondary || "#1b1b24";

  let subtitle = "";
  if (isGroup) {
    const names = (memberNames || []).filter(Boolean);
    if (names.length === 0) {
      subtitle = i18nText("autoI18n.n_uye", "{{n}} üye", { n: memberCount });
    } else {
      const shown = names.slice(0, 3).join(", ");
      const rest = Math.max(0, memberCount - 1 - Math.min(3, names.length));
      subtitle = rest > 0 ? `${shown} +${rest}` : shown;
    }
  } else if (username) {
    subtitle = `@${username}`;
  }

  const ringColor = isGroup
    ? alpha(groupColor || accent, 0.55)
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
          <View style={styles.avatarWrap}>
            <View style={[styles.ring, { borderColor: ringColor }]}>{avatar}</View>
          </View>

          <View style={styles.info}>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.name, { color: textPrimary }]}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[styles.status, { color: textMuted }]}
              >
                {subtitle}
              </Text>
            ) : null}
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

  info: { flex: 1, minWidth: 0 },
  name: { fontSize: 16.5, fontWeight: "800", letterSpacing: 0.1 },
  status: { fontSize: 12, fontWeight: "600", marginTop: 2 },
});

// ChatScreen avatarı başlığın halkasına tam oturacak boyutta çizer.
export const CHAT_HEADER_AVATAR_SIZE = AVATAR_SIZE;
