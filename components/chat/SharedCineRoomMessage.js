// components/chat/SharedCineRoomMessage.js
//
// Sohbette/grupta paylaşılan CineSwipe ODA DAVETİ balonunun gövdesi (mesaj kind:
// "cineRoomShare", bkz. utils/chatShare.js): "Birlikte ne izlesek?" başlığı, kuran
// kişi, büyük harfli 6 haneli oda kodu ve "Odaya katıl" düğmesi.
//
// "Odaya katıl" CineSwipe'ı çift mod + `inviteCode` ile açar; ekran kodu kutuya
// HAZIR yazar ama katılmayı alıcıya bırakır (katılmak oda hakkı/bildirim doğurabilir).
// Oda süre dolunca silinir: ekran kendi hata mesajını da gösterir.
//
// YANIT DURUMU mesajda (utils/chatInvites.cineInviteView; Profil'deki önemli davetler
// çubuğundan verilen yanıt da aynı mesaja yazılır):
//   • alıcı   : yanıtsızsa [Reddet] [Odaya katıl] (katılmak = kabul); kabul ettiyse
//               "Kabul ettin" + "Odaya dön"; reddettiyse "Reddettin", düğme yok
//   • gönderen: "Yanıt bekleniyor" → "Kabul edildi" / "Reddedildi" (grupta sayılar)
//   • iki taraf: oda bitince "Tamamlandı" + ortak eşleşme sayısı (`done`, odanın
//               içinden yazılır); yanıtsız davet 24 saatte "Süresi doldu"
//
// Gönderen kendi davetinde düğme görmez (zaten odada).
// Sırayla oda (`share.async`): kart "24 saat içinde katıl" çipini taşır.

import React, { memo, useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { cineInviteView } from "../../utils/chatInvites";
import { getCineInviteCopy } from "../../utils/cineInviteCopy";
import { i18nText } from "../../utils/i18nText";
import { DuelStatusChip } from "./DuelVersus";
import InviteActions from "./InviteActions";
import { sharePalette } from "./shareKit";

// CineSwipe'ın kimlik rengi (Hub kartıyla aynı gül).
const ROSE = "#E11D48";

/** "749215" → "749 215" (okunaklı; yapıştırma tarafı boşluklu da kabul eder). */
export const formatRoomCode = (code) => `${String(code).slice(0, 3)} ${String(code).slice(3)}`;

// Durum hapı: gönderen her zaman görür, alıcı yalnız bir yanıt / sonuç varken.
function chipOf(view, { isOutgoing, isGroup, copy }) {
  switch (view.phase) {
    case "done":
      return { tone: "done", label: copy.statusDone };
    case "expired":
      return { tone: "expired", label: copy.statusExpired };
    case "accepted":
      if (!isOutgoing) return { tone: "accepted", label: copy.statusYouAccepted };
      return { tone: "accepted", label: isGroup ? copy.acceptedBy(view.acceptedCount) : copy.statusAccepted };
    case "declined":
      if (!isOutgoing) return { tone: "declined", label: copy.statusYouDeclined };
      return { tone: "declined", label: isGroup ? copy.declinedBy(view.declinedCount) : copy.statusDeclined };
    default:
      return isOutgoing ? { tone: "waiting", label: copy.statusWaiting } : null;
  }
}

function SharedCineRoomMessage({
  share,
  isOutgoing = false,
  isGroup = false,
  viewerUid,
  accepts,
  declines,
  done,
  sentAt,
  onOpen,
  onAnswer,
}) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const copy = getCineInviteCopy(language);
  const palette = useMemo(
    () => sharePalette({ theme, isOutgoing, accent: ROSE }),
    [theme, isOutgoing],
  );
  const view = cineInviteView({ isOutgoing, viewerUid, accepts, declines, done, sentAt });
  const chip = chipOf(view, { isOutgoing, isGroup, copy });
  const canJoin = !isOutgoing && typeof onOpen === "function" && (view.phase === "pending" || view.phase === "accepted");
  const joinLabel = i18nText("autoI18n.paylas_cine_katil", "Odaya katıl");
  // Katılmak = kabul: yanıt bir kez yazılır, ardından "Odaya dön" yalnız odayı açar.
  const join = () => {
    if (view.mine !== "accepted") onAnswer?.("accepted");
    onOpen();
  };
  const decline = () => onAnswer?.("declined");
  const resultText =
    view.phase === "done" && view.matches !== null
      ? view.matches > 0
        ? copy.matches(view.matches)
        : copy.noMatches
      : null;

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

      {chip ? <DuelStatusChip tone={chip.tone} label={chip.label} palette={palette} isOutgoing={isOutgoing} /> : null}

      <Text style={[styles.invite, { color: palette.secondary }]} numberOfLines={2}>
        {invitation}
      </Text>

      {share.async && (view.phase === "pending" || view.phase === "accepted") ? (
        <View style={[styles.asyncChip, { backgroundColor: palette.surface, borderColor: palette.surfaceBorder }]}>
          <Ionicons name="time-outline" size={13} color={palette.tileInk} />
          <Text allowFontScaling={false} style={[styles.asyncText, { color: palette.secondary }]} numberOfLines={1}>
            {i18nText("autoI18n.paylas_cine_sirayla", "Sırayla · 24 saat içinde katıl")}
          </Text>
        </View>
      ) : null}

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

      {resultText ? (
        <Text style={[styles.note, { color: palette.secondary }]} numberOfLines={2}>
          {resultText}
        </Text>
      ) : null}

      {!isOutgoing && view.phase === "expired" ? (
        <Text style={[styles.note, { color: palette.muted }]} numberOfLines={2}>
          {copy.expired}
        </Text>
      ) : null}

      {canJoin ? (
        <InviteActions
          palette={palette}
          accept={
            view.mine === "accepted"
              ? { label: copy.rejoin, icon: "enter-outline", onPress: join }
              : { label: joinLabel, icon: "enter-outline", onPress: join }
          }
          decline={
            view.mine === null && typeof onAnswer === "function"
              ? { label: copy.decline, a11y: copy.declineA11y, onPress: decline }
              : null
          }
        />
      ) : null}
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

  asyncChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    marginTop: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  asyncText: { fontSize: 11, fontWeight: "800", flexShrink: 1 },

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

  note: { fontSize: 12, fontWeight: "700", lineHeight: 16, marginTop: 10 },
});
