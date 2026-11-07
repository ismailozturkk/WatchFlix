// components/top100/Top100PosterSheet.js
//
// Seelogd Top 100 ızgarasında bir afişe dokununca açılan seçenek sayfası: üstte yapımın künyesi (afiş, sıra, ad, oy
// sayısı — ızgarada ad ve oy yazılmıyor, burada görünür), altta üç seçenek:
//   • Bilgi      → yapımın detay sayfası
//   • Seçim yap  → oy ver / oyu geri al (Free'de ya da hak doluyken kilit simgesi; dokunuş yükseltme sayfasına gider)
//   • İptal et   → sayfayı kapatır
//
// Seçilen iş sayfa KAPANDIKTAN sonra çalışır (`onDismissed`): yükseltme sayfası da bir Modal, iOS kapanmakta olan
// Modal'ın üstüne ikincisini sunamaz (bkz. BottomSheetModal "İKİ MODAL ARDARDA"). Çağıran işi kendisi saklar.

import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import AppIcon from "@components/AppIcon";
import BottomSheetModal from "@components/common/BottomSheetModal";
import GlassTouchable from "@components/common/GlassTouchable";
import { useTheme } from "@context/ThemeContext";
import { SEELOGD_VOTE_WEIGHT } from "@utils/top100";

const HYPE = "#F97316";
const MEDALS = ["#F5B70A", "#A8B0BC", "#CD7F42"];

/**
 * @param {object} props
 * @param {boolean} props.visible
 * @param {object|null} props.row      Izgara satırı (key, title, rank, votes, poster_path, media_type, year).
 * @param {boolean} props.hyped        Bu yapıma oy verilmiş mi.
 * @param {boolean} props.locked       Yeni oy verilemez (Free ya da hak dolu).
 * @param {object} props.copy          getTop100Copy(language).
 * @param {(path: string, kind: string, size: number) => string} props.getTmdbUrl
 * @param {(action: "info"|"vote") => void} props.onAction
 * @param {() => void} props.onClose
 * @param {() => void} [props.onDismissed]
 */
export default function Top100PosterSheet({ visible, row, hyped, locked, copy, getTmdbUrl, onAction, onClose, onDismissed }) {
  const { theme } = useTheme();
  // Kapanış animasyonu boyunca (~260 ms) sayfa çizilmeye devam eder: içerik boşalmasın diye son hâl tutulur.
  const [shown, setShown] = useState(null);
  useEffect(() => {
    if (visible && row) setShown({ row, hyped, locked });
  }, [visible, row, hyped, locked]);

  const item = shown?.row;
  const isHyped = !!shown?.hyped;
  const isLocked = !!shown?.locked && !isHyped;
  const medal = item?.rank && item.rank <= 3 ? MEDALS[item.rank - 1] : null;

  const voteSub = isHyped ? copy.menuUnvoteSub : isLocked ? copy.menuLockedSub : copy.voteGain(SEELOGD_VOTE_WEIGHT);
  const options = [
    {
      key: "info",
      icon: "information-circle",
      tint: theme.accent,
      title: copy.menuInfo,
      sub: copy.menuInfoSub,
      a11y: copy.menuInfo,
      trailing: "chevron-forward",
    },
    {
      key: "vote",
      icon: isHyped ? "flame" : isLocked ? "lock-closed" : "flame-outline",
      tint: HYPE,
      title: isHyped ? copy.menuUnvote : copy.menuVote,
      sub: voteSub,
      a11y: item ? copy.hypeA11y(item.title, isHyped) : copy.menuVote,
      trailing: isHyped ? "checkmark-circle" : null,
    },
  ];

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      onDismissed={onDismissed}
      intensity={35}
      dimColor="rgba(0,0,0,0.35)"
      sheetStyle={[styles.sheet, { backgroundColor: theme.secondary, borderColor: theme.border }]}
    >
      <View style={[styles.handle, { backgroundColor: theme.border }]} />
      {item ? (
        <>
          <View style={styles.head}>
            <View style={[styles.poster, { backgroundColor: theme.border }]}>
              {item.poster_path ? (
                <Image
                  source={{ uri: getTmdbUrl(item.poster_path, "poster", 200) }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={120}
                />
              ) : null}
            </View>
            <View style={styles.headText}>
              <View style={styles.metaRow}>
                <View style={[styles.rankChip, { backgroundColor: medal || `${theme.text.muted}33` }]}>
                  <Text style={[styles.rankChipText, { color: medal ? "#1F1300" : theme.text.primary }]} allowFontScaling={false}>
                    {item.rank ? `#${item.rank}` : copy.outside}
                  </Text>
                </View>
                <Text style={[styles.meta, { color: theme.text.muted }]} numberOfLines={1}>
                  {[item.media_type === "tv" ? copy.tv : copy.movie, item.year].filter(Boolean).join(" · ")}
                </Text>
              </View>
              <Text style={[styles.title, { color: theme.text.primary }]} numberOfLines={2}>
                {item.title}
              </Text>
              <View style={styles.votesRow}>
                <AppIcon family="Ionicons" name="people" size={12} color={theme.text.muted} />
                <Text style={[styles.votes, { color: theme.text.secondary }]} numberOfLines={1}>
                  {copy.votes(item.votes)}
                </Text>
                {isHyped ? (
                  <View style={styles.hypedPill}>
                    <AppIcon family="Ionicons" name="flame" size={10} color="#FFFFFF" />
                    <Text style={styles.hypedPillText} numberOfLines={1}>
                      {copy.voted}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          <View style={[styles.group, { backgroundColor: theme.primary, borderColor: theme.border }]}>
            {options.map((option, index) => (
              <GlassTouchable
                key={option.key}
                glass={false}
                onPress={() => onAction(option.key)}
                accessibilityRole="button"
                accessibilityLabel={option.a11y}
                style={[
                  styles.option,
                  index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
                ]}
              >
                <View style={[styles.optionIcon, { backgroundColor: `${option.tint}1F` }]}>
                  <AppIcon family="Ionicons" name={option.icon} size={19} color={option.tint} />
                </View>
                <View style={styles.optionText}>
                  <Text style={[styles.optionTitle, { color: theme.text.primary }]} numberOfLines={1}>
                    {option.title}
                  </Text>
                  <Text style={[styles.optionSub, { color: theme.text.muted }]} numberOfLines={1}>
                    {option.sub}
                  </Text>
                </View>
                {option.trailing ? (
                  <AppIcon
                    family="Ionicons"
                    name={option.trailing}
                    size={18}
                    color={option.key === "vote" ? HYPE : theme.text.muted}
                  />
                ) : null}
              </GlassTouchable>
            ))}
          </View>

          <GlassTouchable
            glass={false}
            onPress={onClose}
            accessibilityRole="button"
            style={[styles.cancel, { backgroundColor: theme.primary, borderColor: theme.border }]}
          >
            <Text style={[styles.cancelText, { color: theme.text.secondary }]}>{copy.menuCancel}</Text>
          </GlassTouchable>
        </>
      ) : null}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 28,
  },
  handle: { width: 42, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  head: { flexDirection: "row", alignItems: "center", gap: 14 },
  poster: { width: 58, height: 87, borderRadius: 10, overflow: "hidden" },
  headText: { flex: 1, minWidth: 0, gap: 5 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  rankChip: { paddingHorizontal: 8, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rankChipText: { fontSize: 11, fontWeight: "900", fontVariant: ["tabular-nums"] },
  meta: { flexShrink: 1, fontSize: 12, fontWeight: "700" },
  title: { fontSize: 17, fontWeight: "900", letterSpacing: -0.2 },
  votesRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  votes: { flexShrink: 1, fontSize: 12.5, fontWeight: "700", fontVariant: ["tabular-nums"] },
  hypedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginLeft: 4,
    paddingHorizontal: 7,
    height: 18,
    borderRadius: 9,
    backgroundColor: HYPE,
  },
  hypedPillText: { color: "#FFFFFF", fontSize: 10.5, fontWeight: "900" },
  group: { marginTop: 18, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  option: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  optionIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  optionText: { flex: 1, minWidth: 0 },
  optionTitle: { fontSize: 15, fontWeight: "900" },
  optionSub: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  cancel: {
    marginTop: 10,
    minHeight: 50,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { fontSize: 15, fontWeight: "900" },
});
