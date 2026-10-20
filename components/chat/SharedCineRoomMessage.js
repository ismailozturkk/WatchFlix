// components/chat/SharedCineRoomMessage.js
//
// Sohbette/grupta paylaşılan CineSwipe ODA DAVETİ balonunun gövdesi (mesaj kind:
// "cineRoomShare", bkz. utils/chatShare.js): "Birlikte ne izlesek?" başlığı, kuran
// kişi, büyük harfli 6 haneli oda kodu ve "Odaya katıl" düğmesi.
//
// Düğme CineSwipe'ı çift mod + `inviteCode` ile açar; ekran kodu kutuya HAZIR
// yazar ama katılmayı alıcıya bırakır (katılmak oda hakkı/bildirim doğurabilir).
// Davet GEÇİCİDİR (oda süre dolunca silinir): süresi dolmuş bir daveti ekran
// kendi hata mesajıyla bildirir, burada ayrıca denetlenmez.
//
// Gönderen kendi davetinde düğme görmez (zaten odada).

import React, { memo, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../context/ThemeContext";
import { i18nText } from "../../utils/i18nText";
import { sharePalette } from "./shareKit";

// CineSwipe'ın kimlik rengi (Hub kartıyla aynı gül).
const ROSE = "#E11D48";

/** "749215" → "749 215" (okunaklı; yapıştırma tarafı boşluklu da kabul eder). */
export const formatRoomCode = (code) => `${String(code).slice(0, 3)} ${String(code).slice(3)}`;

function SharedCineRoomMessage({ share, isOutgoing = false, onOpen }) {
  const { theme } = useTheme();
  const palette = useMemo(
    () => sharePalette({ theme, isOutgoing, accent: ROSE }),
    [theme, isOutgoing],
  );
  const canJoin = !isOutgoing && typeof onOpen === "function";
  const joinLabel = i18nText("autoI18n.paylas_cine_katil", "Odaya katıl");

  const invitation = share.host
    ? i18nText("autoI18n.paylas_cine_davet_metni", "{{name}} seni odaya çağırıyor", { name: share.host })
    : i18nText("autoI18n.paylas_cine_davet_anon", "Odaya davetlisin");

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={[styles.tile, { backgroundColor: palette.tile }]}>
          <Ionicons name="film" size={17} color={palette.tileInk} />
        </View>
        <View style={styles.headerCopy}>
          <Text
            allowFontScaling={false}
            style={[styles.kicker, { color: palette.tileInk }]}
            numberOfLines={1}
          >
            CINESWIPE
          </Text>
          <Text style={[styles.title, { color: palette.primary }]} numberOfLines={2}>
            {i18nText("autoI18n.paylas_cine_baslik", "Birlikte ne izlesek?")}
          </Text>
        </View>
      </View>

      <Text style={[styles.invite, { color: palette.secondary }]} numberOfLines={2}>
        {invitation}
      </Text>

      {/* Oda kodu: büyük, aralıklı, kutu içinde */}
      <View style={[styles.codeBox, { backgroundColor: palette.surface, borderColor: palette.surfaceBorder }]}>
        <Text allowFontScaling={false} style={[styles.codeLabel, { color: palette.muted }]}>
          {i18nText("autoI18n.paylas_cine_kod", "Oda kodu")}
        </Text>
        <Text
          allowFontScaling={false}
          style={[styles.code, { color: palette.primary }]}
          numberOfLines={1}
          accessibilityLabel={share.code.split("").join(" ")}
        >
          {formatRoomCode(share.code)}
        </Text>
        {share.count ? (
          <Text allowFontScaling={false} style={[styles.count, { color: palette.muted }]}>
            {i18nText("autoI18n.paylas_n_kart", "{{n}} kart", { n: share.count })}
          </Text>
        ) : null}
      </View>

      {canJoin && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onOpen}
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          style={[styles.action, { backgroundColor: palette.buttonBg }]}
          accessibilityRole="button"
          accessibilityLabel={joinLabel}
        >
          <Ionicons name="enter-outline" size={16} color={palette.buttonInk} />
          <Text
            allowFontScaling={false}
            style={[styles.actionText, { color: palette.buttonInk }]}
            numberOfLines={1}
          >
            {joinLabel}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default memo(SharedCineRoomMessage);

const styles = StyleSheet.create({
  wrap: { alignSelf: "flex-start", width: 240, marginBottom: 2 },

  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  tile: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, minWidth: 0 },
  kicker: { fontSize: 9.5, fontWeight: "800", letterSpacing: 0.8 },
  title: { fontSize: 16, fontWeight: "900", lineHeight: 20, marginTop: 1 },

  invite: { fontSize: 12.5, fontWeight: "600", lineHeight: 17, marginTop: 10 },

  codeBox: {
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  codeLabel: { fontSize: 10.5, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" },
  code: { fontSize: 30, fontWeight: "900", letterSpacing: 4, lineHeight: 38, marginTop: 2 },
  count: { fontSize: 11, fontWeight: "700", marginTop: 2 },

  action: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    height: 38,
    marginTop: 12,
    paddingHorizontal: 10,
    borderRadius: 19,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  actionText: { fontSize: 13, fontWeight: "800", flexShrink: 1 },
});
