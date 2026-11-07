// components/reminders/ReleasedReminderSheet.js
//
// Profil > Hatırlatıcılar: "Yayınlandı" kartındaki çöp düğmesinin seçim sayfası.
// Yayınlanmış hatırlatıcı üç yoldan kapatılır (yazma: utils/reminderReleasedActions):
//   İzlendi olarak işaretle · İzleme listesine ekle · Yalnız sil
//
// DİKKAT: BottomSheetModal kapanırken ≈260 ms daha çizilir. Çağıran taraf `target`ı
// kapanışta SIFIRLAMAMALI (başlık boşalıp zıplar) — yalnız `visible`ı düşürmeli.

import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import BottomSheetModal from "@components/common/BottomSheetModal";
import { useTheme } from "@context/ThemeContext";
import usePosterUri from "@hooks/usePosterUri";
import { alpha } from "@theme/colors";
import { i18nText } from "@utils/i18nText";

const DANGER = "#e5484d";
const SUCCESS = "#30a46c";

function ActionRow({ icon, label, hint, tone, onPress, last }) {
  const { theme } = useTheme();
  const color = tone || theme.accent;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={({ pressed }) => [
        styles.action,
        !last && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: alpha(theme.border, 0.6),
        },
        pressed && { backgroundColor: alpha(theme.text?.primary ?? "#fff", 0.06) },
      ]}
    >
      <View style={[styles.actionIcon, { backgroundColor: alpha(color, 0.15) }]}>
        <Ionicons name={icon} size={19} color={color} />
      </View>
      <View style={styles.actionCopy}>
        <Text
          allowFontScaling={false}
          style={[
            styles.actionLabel,
            { color: tone === DANGER ? DANGER : theme.text?.primary ?? "#fff" },
          ]}
        >
          {label}
        </Text>
        {hint ? (
          <Text
            allowFontScaling={false}
            numberOfLines={2}
            style={[styles.actionHint, { color: theme.text?.muted ?? "#888" }]}
          >
            {hint}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * @param {object}   p.target   { kind: "movie"|"tv", reminder } — dizi için bölüm belgesi
 * @param {Function} p.onSelect (action: "watched"|"watchlist"|"delete") => void
 */
export default function ReleasedReminderSheet({ visible, target, onClose, onSelect }) {
  const { theme } = useTheme();
  const posterUri = usePosterUri();
  const kind = target?.kind === "tv" ? "tv" : "movie";
  const reminder = target?.reminder || {};
  const isTv = kind === "tv";
  const title = isTv ? reminder.showName : reminder.movieName;
  const subtitle = isTv
    ? `S${reminder.seasonNumber ?? "?"} · ${reminder.episodeNumber ?? "?"}${i18nText("autoI18n.bolum_3", ". Bölüm")}`
    : i18nText("autoI18n.yayinlandi", "Yayınlandı");
  const poster = isTv
    ? posterUri("tv", reminder.showId, reminder.seasonPosterPath || reminder.showPosterPath)
    : posterUri("movie", reminder.movieId, reminder.posterPath);

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      dimColor="rgba(0,0,0,0.42)"
      sheetStyle={[styles.sheet, { backgroundColor: theme.primary, borderColor: theme.border }]}
    >
      <View style={[styles.handle, { backgroundColor: theme.border }]} />

      {target ? (
        <View style={styles.header}>
          {poster ? (
            <Image source={{ uri: poster }} style={styles.poster} resizeMode="cover" />
          ) : (
            <View style={[styles.poster, { backgroundColor: theme.secondary }]} />
          )}
          <View style={styles.headerCopy}>
            <Text
              allowFontScaling={false}
              numberOfLines={2}
              style={[styles.title, { color: theme.text?.primary ?? "#fff" }]}
            >
              {title}
            </Text>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.subtitle, { color: theme.text?.muted ?? "#888" }]}
            >
              {subtitle}
            </Text>
          </View>
        </View>
      ) : null}

      <View
        style={[
          styles.group,
          { backgroundColor: theme.secondary, borderColor: alpha(theme.border, 0.7) },
        ]}
      >
        <ActionRow
          icon="checkmark-done-circle"
          tone={SUCCESS}
          label={i18nText("autoI18n.izlendi_olarak_isaretle", "İzlendi olarak işaretle")}
          hint={
            isTv
              ? i18nText("autoI18n.hatirlatici_izlendi_ipucu_bolum", "Bölüm bugünün tarihiyle izlenenlere eklenir, hatırlatma kaldırılır")
              : i18nText("autoI18n.hatirlatici_izlendi_ipucu_film", "Film bugünün tarihiyle izlenenlere eklenir, hatırlatma kaldırılır")
          }
          onPress={() => onSelect?.("watched")}
        />
        <ActionRow
          icon="bookmark"
          label={i18nText("autoI18n.sil_ve_izleme_listesine_ekle", "Sil ve izleme listesine ekle")}
          hint={
            isTv
              ? i18nText("autoI18n.hatirlatici_liste_ipucu_dizi", "Dizi İzleme Listesi'ne eklenir, hatırlatma kaldırılır")
              : i18nText("autoI18n.hatirlatici_liste_ipucu_film", "Film İzleme Listesi'ne eklenir, hatırlatma kaldırılır")
          }
          onPress={() => onSelect?.("watchlist")}
        />
        <ActionRow
          icon="trash"
          tone={DANGER}
          label={i18nText("autoI18n.yalniz_sil", "Yalnız sil")}
          hint={i18nText("autoI18n.hatirlatici_sil_ipucu", "Hatırlatma kaldırılır, listelerine dokunulmaz")}
          onPress={() => onSelect?.("delete")}
          last
        />
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 28,
  },
  handle: { width: 42, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 },
  poster: { width: 44, height: 66, borderRadius: 8 },
  headerCopy: { flex: 1, minWidth: 0, gap: 3 },
  title: { fontSize: 17, fontWeight: "800", letterSpacing: -0.2 },
  subtitle: { fontSize: 13.5 },
  group: { borderRadius: 20, borderWidth: 1, overflow: "hidden" },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionCopy: { flex: 1, minWidth: 0, gap: 2 },
  actionLabel: { fontSize: 15.5, fontWeight: "700" },
  actionHint: { fontSize: 12.5, lineHeight: 16 },
});
