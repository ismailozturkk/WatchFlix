// components/friends/TasteMatchCard.js
//
// Arkadaş profilindeki "Zevk uyumu" kartı + "Birlikte izleyelim" bölümü. Hesap utils/tasteMatch.js'te (saf);
// burada yalnız sunum. Gizlilik kararı çağıranda: görünmeyen liste hesaba `null` gider, kart onu "veri yok" diye
// anlatır, sıfır sanmaz.
//
// DÜRÜST ÇIKTI: yeterli veri yoksa yüzde ÇİZİLMEZ (nedeni yazılır); bazı bileşenler eksikse "yaklaşık" notu
// düşer. Davet düğmesi yalnız arkadaşa ve adayı olan kullanıcıya görünür.
import React, { memo } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { useImageQualitySettings } from "../../context/AppSettingsContext";
import { alpha } from "../../theme/colors";
import { getTasteMatchCopy } from "../../utils/tasteMatchCopy";
import { MAX_CANDIDATES } from "../../utils/tasteMatch";

const THUMBS_SHOWN = 8;

function Row({ icon, text, color, muted }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={15} color={color} />
      <Text allowFontScaling={false} style={[styles.rowText, { color: muted }]}>
        {text}
      </Text>
    </View>
  );
}

/**
 * @param {object} props
 * @param {ReturnType<typeof import("../../utils/tasteMatch").computeTasteMatch>} props.match
 * @param {ReturnType<typeof import("../../utils/tasteMatch").findTogetherCandidates>} props.together
 * @param {string} props.friendName
 * @param {boolean} props.friendListHidden arkadaşın izleme listesi görünmüyor
 * @param {boolean} props.noWatchedVisible arkadaşın izlenen listeleri görünmüyor
 * @param {boolean} props.canInvite arkadaş mı?
 * @param {boolean} props.inviteBusy
 * @param {() => void} props.onInvite
 */
function TasteMatchCard({
  match,
  together,
  friendName,
  friendListHidden = false,
  noWatchedVisible = false,
  canInvite = false,
  inviteBusy = false,
  onInvite,
}) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { getTmdbUrl } = useImageQualitySettings();
  const copy = getTasteMatchCopy(language);
  const muted = theme.text?.secondary ?? "#aaa";
  const primary = theme.text?.primary ?? "#fff";
  const percent = match.ratings.agreement === null ? null : Math.round(match.ratings.agreement * 100);

  const candidates = together.candidates;
  const { both, mine, theirs } = together.counts;
  const introText = candidates.length === 0 ? copy.together.none : both > 0 ? copy.together.both(both) : copy.together.mixed(mine + theirs);

  return (
    <View style={[styles.card, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      {/* ── Zevk uyumu ── */}
      <View style={styles.head}>
        {match.score !== null ? (
          <View style={[styles.ring, { borderColor: theme.accent, backgroundColor: alpha(theme.accent, 0.13) }]}>
            <Text allowFontScaling={false} style={[styles.ringText, { color: primary }]}>
              %{match.score}
            </Text>
          </View>
        ) : (
          <View style={[styles.ring, { borderColor: theme.border }]}>
            <Ionicons name="help" size={22} color={muted} />
          </View>
        )}
        <View style={styles.headText}>
          <Text allowFontScaling={false} style={[styles.title, { color: primary }]}>
            {match.tier ? copy.tiers[match.tier] : copy.title}
          </Text>
          {match.state === "limited" ? (
            <Text allowFontScaling={false} style={[styles.sub, { color: muted }]}>
              {copy.limited}
            </Text>
          ) : null}
          {match.state === "no-data" ? (
            <Text style={[styles.sub, { color: muted }]}>
              {noWatchedVisible ? copy.noData.hidden(friendName) : copy.noData.notEnough}
            </Text>
          ) : null}
        </View>
      </View>

      {match.state !== "no-data" ? (
        <View style={styles.rows}>
          <Row icon="checkmark-done-outline" color={theme.accent} muted={muted} text={copy.rows.overlap(match.watched.overlap.length)} />
          {match.favorites && match.favorites.length > 0 ? (
            <Row icon="heart-outline" color={theme.accent} muted={muted} text={copy.rows.favorites(match.favorites.length)} />
          ) : null}
          {match.genres.shared.length > 0 ? (
            <Row icon="pricetags-outline" color={theme.accent} muted={muted} text={copy.rows.genres(match.genres.shared.join(", "))} />
          ) : null}
          {percent !== null ? (
            <Row icon="star-half-outline" color={theme.accent} muted={muted} text={copy.rows.ratings(percent, match.ratings.pairs)} />
          ) : null}
        </View>
      ) : null}

      {/* ── Birlikte izleyelim ── */}
      <View style={[styles.divider, { backgroundColor: theme.border }]} />
      <Text allowFontScaling={false} style={[styles.togetherTitle, { color: primary }]}>
        {copy.together.title}
      </Text>
      <Text style={[styles.sub, { color: muted }]}>{introText}</Text>
      {friendListHidden ? (
        <Text style={[styles.note, { color: muted }]}>{copy.together.hiddenList(friendName)}</Text>
      ) : null}
      {candidates.length === 0 ? <Text style={[styles.note, { color: muted }]}>{copy.together.noneHint}</Text> : null}

      {candidates.length > 0 ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>
            {candidates.slice(0, THUMBS_SHOWN).map((item) => (
              <View
                key={item.key}
                accessible
                accessibilityLabel={`${item.name}. ${copy.together.sources[item.source]}`}
                style={[styles.thumb, { backgroundColor: theme.primary, borderColor: theme.border }]}
              >
                {item.imagePath ? (
                  <Image source={{ uri: getTmdbUrl(item.imagePath, "poster", 200) }} style={styles.thumbImage} contentFit="cover" />
                ) : null}
              </View>
            ))}
          </ScrollView>
          {candidates.length >= MAX_CANDIDATES ? (
            <Text style={[styles.note, { color: muted }]}>{copy.together.limit(MAX_CANDIDATES)}</Text>
          ) : null}
          {canInvite ? (
            <>
              <Pressable
                onPress={onInvite}
                disabled={inviteBusy}
                accessibilityRole="button"
                accessibilityLabel={copy.together.action(friendName)}
                accessibilityState={{ disabled: inviteBusy, busy: inviteBusy }}
                style={({ pressed }) => [styles.action, { backgroundColor: theme.accent }, (pressed || inviteBusy) && styles.pressed]}
              >
                {inviteBusy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="paper-plane-outline" size={16} color="#FFFFFF" />}
                <Text allowFontScaling={false} numberOfLines={2} style={styles.actionText}>
                  {copy.together.action(friendName)}
                </Text>
              </Pressable>
              <Text style={[styles.note, { color: muted }]}>{copy.together.actionHint}</Text>
            </>
          ) : (
            <Text style={[styles.note, { color: muted }]}>{copy.together.needFriend}</Text>
          )}
        </>
      ) : null}
    </View>
  );
}

export default memo(TasteMatchCard);

const styles = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: 1, padding: 16, gap: 8 },
  head: { flexDirection: "row", alignItems: "center", gap: 14 },
  ring: { width: 58, height: 58, borderRadius: 29, borderWidth: 3, alignItems: "center", justifyContent: "center" },
  ringText: { fontSize: 16, fontWeight: "900" },
  headText: { flexShrink: 1, flexGrow: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: "800" },
  sub: { fontSize: 12.5, lineHeight: 18 },
  rows: { gap: 7, marginTop: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 9 },
  rowText: { flexShrink: 1, fontSize: 13, fontWeight: "600" },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 8 },
  togetherTitle: { fontSize: 15, fontWeight: "800" },
  note: { fontSize: 11.5, lineHeight: 16 },
  thumbs: { gap: 8, paddingVertical: 6 },
  thumb: { width: 56, height: 84, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  thumbImage: { width: "100%", height: "100%" },
  action: {
    minHeight: 48,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 6,
  },
  actionText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800", flexShrink: 1, textAlign: "center" },
  pressed: { opacity: 0.8 },
});
