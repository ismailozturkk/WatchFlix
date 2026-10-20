// components/detail/ExternalRatingsSheet.js
//
// Harici puanların AYRINTI sayfası (BottomSheetModal — blur yerinde solar, sayfa kayar). Detaydaki tek satırlık
// çipler (ExternalRatingsRow) basılınca açar. Her kaynak kendi satırında: simge + ad + açıklama + büyük değer +
// ölçek çubuğu. Yalnız GELEN puanlar çizilir; olmayan kaynak hiç görünmez (OMDb her başlık için hepsini vermez).
//
//   IMDb            kullanıcı puanı, oy sayısı TAM (2,345,678 oy), 10 üzerinden
//   Rotten Tomatoes eleştirmen onay oranı, Taze / Çürük
//   Metascore       eleştirmen ortalaması, Metacritic'in kelime değerlendirmesiyle (Evrensel beğeni … Aşırı hoşnutsuzluk)
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import BottomSheetModal from "../common/BottomSheetModal";
import GlassCloseButton from "../common/GlassCloseButton";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { ImdbLogo, MetascoreLogo, TomatoLogo, TONE_COLORS, TOMATO_COLORS, IMDB_YELLOW } from "./RatingLogos";
import { formatImdbVotes, metascoreVerdict, metascoreTone, tomatoState } from "../../utils/externalRatings";
import { getExternalRatingsCopy } from "../../utils/externalRatingsCopy";

function Row({ logo, name, sub, value, scale, ratio, color, verdict, theme }) {
  return (
    <View style={[styles.row, { borderColor: theme.border, backgroundColor: theme.primary }]}>
      <View style={styles.logoBox}>{logo}</View>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <View style={styles.rowNames}>
            <Text allowFontScaling={false} style={[styles.name, { color: theme.text.primary }]} numberOfLines={1}>
              {name}
            </Text>
            <Text allowFontScaling={false} style={[styles.sub, { color: theme.text.muted }]} numberOfLines={2}>
              {sub}
            </Text>
          </View>
          <View style={styles.rowValue}>
            <Text allowFontScaling={false} style={[styles.value, { color: theme.text.primary }]}>
              {value}
            </Text>
            {scale ? (
              <Text allowFontScaling={false} style={[styles.scale, { color: theme.text.muted }]}>
                {scale}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={[styles.track, { backgroundColor: theme.border }]}>
          <View style={[styles.fill, { width: `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`, backgroundColor: color }]} />
        </View>
        {verdict ? (
          <Text allowFontScaling={false} style={[styles.verdict, { color }]} numberOfLines={1}>
            {verdict}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default function ExternalRatingsSheet({ visible, onClose, ratings }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const copy = getExternalRatingsCopy(language);
  if (!ratings) return null;

  const rows = [];
  if (Number.isFinite(ratings.imdbRating)) {
    rows.push(
      <Row
        key="imdb"
        theme={theme}
        logo={<ImdbLogo />}
        name="IMDb"
        sub={copy.imdb.sub(formatImdbVotes(ratings.imdbVotes))}
        value={ratings.imdbRating.toFixed(1)}
        scale={copy.imdb.scale}
        ratio={ratings.imdbRating / 10}
        color={IMDB_YELLOW}
      />,
    );
  }
  if (Number.isFinite(ratings.rottenTomatoes)) {
    const state = tomatoState(ratings.rottenTomatoes) || "fresh";
    rows.push(
      <Row
        key="rt"
        theme={theme}
        logo={<TomatoLogo percent={ratings.rottenTomatoes} size={30} />}
        name="Rotten Tomatoes"
        sub={copy.rt.sub}
        value={`${ratings.rottenTomatoes}%`}
        ratio={ratings.rottenTomatoes / 100}
        color={TOMATO_COLORS[state]}
        verdict={copy.rt[state]}
      />,
    );
  }
  if (Number.isFinite(ratings.metascore)) {
    const tone = metascoreTone(ratings.metascore) || "yellow";
    rows.push(
      <Row
        key="meta"
        theme={theme}
        logo={<MetascoreLogo score={ratings.metascore} />}
        name="Metascore"
        sub={copy.meta.sub}
        value={String(ratings.metascore)}
        scale={copy.meta.scale}
        ratio={ratings.metascore / 100}
        color={TONE_COLORS[tone]}
        verdict={copy.meta.verdicts[metascoreVerdict(ratings.metascore)]}
      />,
    );
  }
  if (rows.length === 0) return null;

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      intensity={50}
      sheetStyle={[styles.sheet, { backgroundColor: theme.secondary, borderColor: theme.border }]}
    >
      <View style={[styles.handle, { backgroundColor: theme.border }]} />
      <View style={styles.header}>
        <Text allowFontScaling={false} style={[styles.title, { color: theme.text.primary }]}>
          {copy.title}
        </Text>
        <GlassCloseButton size={30} fallbackRadius={10} iconSize={15} onPress={onClose} accessibilityLabel={copy.close} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list} style={styles.scroll}>
        {rows}
        <Text style={[styles.source, { color: theme.text.muted }]}>{copy.source}</Text>
      </ScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    maxHeight: "82%",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
  },
  handle: { width: 42, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 14 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  title: { fontSize: 18, fontWeight: "800" },
  scroll: { flexGrow: 0 },
  list: { gap: 10, paddingBottom: 4 },
  row: { flexDirection: "row", gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 12 },
  logoBox: { width: 44, alignItems: "center", justifyContent: "flex-start", paddingTop: 2 },
  rowBody: { flexShrink: 1, flexGrow: 1, gap: 8 },
  rowTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  rowNames: { flexShrink: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: "800" },
  sub: { fontSize: 12, lineHeight: 16 },
  rowValue: { alignItems: "flex-end" },
  value: { fontSize: 24, fontWeight: "900", letterSpacing: -0.5 },
  scale: { fontSize: 11, fontWeight: "600", marginTop: -2 },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3 },
  verdict: { fontSize: 12, fontWeight: "700" },
  source: { fontSize: 11.5, lineHeight: 16, marginTop: 4, paddingHorizontal: 2 },
});
