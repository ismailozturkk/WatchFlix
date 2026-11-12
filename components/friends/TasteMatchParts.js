// components/friends/TasteMatchParts.js
//
// Zevk uyumu kartının ÜST KISMI (türler dahil): halka + kademe başlığı, ısı çubuğu, Film / Dizi kutuları, sayı şeridi
// ve ortak tür çipleri. Arkadaş profilindeki kart (TasteMatchCard) ile sohbette paylaşılan kart
// (chat/SharedTasteMatchMessage) AYNI parçaları kullanır; böylece sohbete giden kart profildekinin aynısı görünür.
//
// Renkler tema nesnesi yerine düz değerlerle gelir (`tone`): sohbet balonu kendi paletini, profil temasını verir.
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import Svg, { Circle } from "react-native-svg";
import { alpha } from "../../theme/colors";
import { TASTE_HEAT_THRESHOLDS } from "../../utils/tasteMatchVisuals";

export const TASTE_RING = 50;
const RING_STROKE = 5;

/**
 * @typedef {{ primary: string, muted: string, track: string, border: string, accent: string, strip: string }} TasteTone
 */

/** Yüzde halkası: iz + vurgu yayı. Merkez metni çağıran verir. */
export function Ring({ ratio, accent, track, children, size = TASTE_RING }) {
  const r = (size - RING_STROKE) / 2;
  const c = 2 * Math.PI * r;
  const o = Math.max(0, Math.min(1, Number(ratio) || 0));
  return (
    <View style={[styles.ring, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={RING_STROKE} fill="none" />
        {o > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={accent}
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${c}`}
            strokeDashoffset={c * (1 - o)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      <View pointerEvents="none" style={styles.ringCenter}>
        {children}
      </View>
    </View>
  );
}

export function Bar({ value, color, track }) {
  return (
    <View style={[styles.barTrack, { backgroundColor: track }]}>
      <View style={[styles.barFill, { backgroundColor: color, width: `${Math.max(4, Math.min(100, value))}%` }]} />
    </View>
  );
}

/** Ana uyum puanı: 60/70/80/90 eşiklerinde rengi ve alev yoğunluğu artan çubuk. */
export function HeatBar({ score, heat, track }) {
  return (
    <View accessible accessibilityLabel={`heat-${heat.level}`} style={styles.heatBarWrap}>
      <View style={[styles.heatTrack, { backgroundColor: track }]}>
        <LinearGradient
          colors={heat.colors}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.heatFill, { width: `${Math.max(3, heat.score)}%` }]}
        />
        {TASTE_HEAT_THRESHOLDS.map((threshold) => (
          <View
            key={threshold}
            pointerEvents="none"
            style={[styles.heatMark, { left: `${threshold}%`, backgroundColor: alpha("#FFFFFF", score >= threshold ? 0.9 : 0.36) }]}
          />
        ))}
      </View>
      {heat.level > 0 ? (
        <View style={[styles.heatFlames, { backgroundColor: alpha(heat.accent, 0.16) }]}>
          {Array.from({ length: heat.level }, (_, index) => (
            <Ionicons key={index} name={index === heat.level - 1 ? "flame" : "flame-outline"} size={11} color={heat.accent} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Başlık satırı: halka (yüzde ya da "?") + kademe + alt satır. Sağ uca isteğe bağlı öğe (`trailing`) konur.
 * `hot` verilirse ısı rengiyle çerçevelenir.
 */
export function TasteHead({ score, title, sub, heat, tone, trailing, emptyAccent, percentText }) {
  return (
    <View
      style={[
        styles.head,
        heat.level > 0 && styles.hotHead,
        heat.level > 0 && { backgroundColor: alpha(heat.accent, heat.level >= 3 ? 0.12 : 0.07), borderColor: alpha(heat.accent, 0.28) },
      ]}
    >
      {score !== null && score !== undefined ? (
        <View accessible accessibilityLabel={percentText.label}>
          <Ring ratio={score / 100} accent={heat.accent} track={tone.track}>
            <Text allowFontScaling={false} style={[styles.ringText, { color: heat.level > 0 ? heat.accent : tone.primary }]}>
              {percentText.value}
            </Text>
          </Ring>
        </View>
      ) : (
        <Ring ratio={0} accent={emptyAccent || tone.accent} track={tone.track}>
          <Ionicons name="help" size={20} color={tone.muted} />
        </Ring>
      )}
      <View style={styles.headText}>
        <Text allowFontScaling={false} numberOfLines={2} style={[styles.title, { color: tone.primary }]}>
          {title}
        </Text>
        {sub}
      </View>
      {trailing}
    </View>
  );
}

/** Film / Dizi kompakt yatay kartı: başlık + yüzde aynı satırda, altında ince çubuk ve ortak sayısı. */
export function TypeTile({ icon, label, info, color, copy, tone, pct }) {
  const accent = color || tone.accent;
  const { primary, muted, track, border } = tone;
  if (!info.shared) {
    return (
      <View
        accessible
        accessibilityLabel={`${label}: ${copy.types.notShared}`}
        style={[styles.tile, styles.tileOff, { borderColor: border, backgroundColor: alpha(muted, 0.05) }]}
      >
        <View style={styles.tileTopRow}>
          <View style={styles.tileHead}>
            <Ionicons name={icon} size={13} color={muted} />
            <Text allowFontScaling={false} numberOfLines={1} style={[styles.tileLabel, { color: muted }]}>
              {label}
            </Text>
          </View>
          <Ionicons name="lock-closed-outline" size={12} color={muted} />
        </View>
        <Text allowFontScaling={false} numberOfLines={1} style={[styles.tileCaption, { color: muted }]}>
          {copy.types.notShared}
        </Text>
      </View>
    );
  }
  const scored = info.score !== null && info.score !== undefined;
  const caption = scored ? (typeof info.overlap === "number" ? copy.types.common(info.overlap) : null) : copy.types.notEnough;
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${scored ? pct(info.score) : copy.types.notEnough}`}
      style={[styles.tile, { borderColor: alpha(accent, 0.28), backgroundColor: alpha(accent, 0.07) }]}
    >
      <View style={styles.tileTopRow}>
        <View style={styles.tileHead}>
          <Ionicons name={icon} size={13} color={accent} />
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.tileLabel, { color: primary }]}>
            {label}
          </Text>
        </View>
        <Text allowFontScaling={false} style={[styles.tileValue, { color: scored ? accent : muted }]}>
          {scored ? pct(info.score) : "–"}
        </Text>
      </View>
      {scored ? <Bar value={info.score} color={accent} track={track} /> : null}
      {caption ? (
        <Text allowFontScaling={false} numberOfLines={1} style={[styles.tileCaption, { color: muted }]}>
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

export function TypeTiles({ movie, tv, colors, copy, tone, pct }) {
  return (
    <View style={styles.tiles}>
      <TypeTile icon="film-outline" label={copy.types.movie} info={movie} color={colors.movie} {...{ copy, tone, pct }} />
      <TypeTile icon="tv-outline" label={copy.types.tv} info={tv} color={colors.tv} {...{ copy, tone, pct }} />
    </View>
  );
}

/** Sayı hücresi: tek şerit içinde ikonlu değer + kısa etiket + ince çubuk. */
function Stat({ icon, value, label, bar, color, tone }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={styles.stat}>
      <View style={styles.statTop}>
        <Ionicons name={icon} size={13} color={color} />
        <Text allowFontScaling={false} numberOfLines={1} style={[styles.statValue, { color: tone.primary }]}>
          {value}
        </Text>
      </View>
      <Text allowFontScaling={false} numberOfLines={1} style={[styles.statLabel, { color: tone.muted }]}>
        {label}
      </Text>
      {typeof bar === "number" ? <Bar value={bar} color={color} track={tone.track} /> : null}
    </View>
  );
}

/**
 * Sayı şeridi. `stats`: [{ key, icon, value, label, bar?, color }] — yalnız gösterilecek hücreler.
 */
export function StatsStrip({ stats, tone }) {
  if (!stats.length) return null;
  return (
    <View style={[styles.statsStrip, { backgroundColor: tone.strip, borderColor: tone.border }]}>
      {stats.map(({ key, ...stat }, index) => (
        <React.Fragment key={key}>
          {index > 0 ? <View style={[styles.statDivider, { backgroundColor: alpha(tone.border, 0.9) }]} /> : null}
          <Stat {...stat} tone={tone} />
        </React.Fragment>
      ))}
    </View>
  );
}

export function GenreChips({ genres, label, tone }) {
  if (!genres.length) return null;
  return (
    <View style={styles.chips} accessible accessibilityLabel={`${label}: ${genres.join(", ")}`}>
      <Ionicons name="pricetags-outline" size={13} color={tone.muted} />
      {genres.map((genre) => (
        <View key={genre} style={[styles.chip, { backgroundColor: alpha(tone.accent, 0.13), borderColor: alpha(tone.accent, 0.25) }]}>
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.chipText, { color: tone.accent }]}>
            {genre}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  hotHead: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, margin: -4, padding: 4 },
  ring: { alignItems: "center", justifyContent: "center" },
  ringCenter: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  ringText: { fontSize: 14.5, fontWeight: "900", letterSpacing: -0.4 },
  headText: { flexShrink: 1, flexGrow: 1, gap: 2 },
  title: { fontSize: 14.5, lineHeight: 19, fontWeight: "800", letterSpacing: -0.2 },

  heatBarWrap: { minHeight: 18, flexDirection: "row", alignItems: "center", gap: 8 },
  heatTrack: { flex: 1, height: 8, borderRadius: 999, overflow: "hidden", position: "relative" },
  heatFill: { height: "100%", borderRadius: 999 },
  heatMark: { position: "absolute", top: 1, bottom: 1, width: 1, marginLeft: -0.5 },
  heatFlames: { minWidth: 25, height: 18, borderRadius: 9, paddingHorizontal: 5, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 1 },

  tiles: { flexDirection: "row", gap: 8 },
  tile: { flex: 1, minWidth: 0, borderRadius: 12, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 6, gap: 3 },
  tileOff: { borderStyle: "dashed", justifyContent: "space-between" },
  tileTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
  tileHead: { flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 1 },
  tileLabel: { fontSize: 12, fontWeight: "800", letterSpacing: 0.1, flexShrink: 1 },
  tileValue: { fontSize: 16, lineHeight: 19, fontWeight: "900", letterSpacing: -0.3 },
  tileCaption: { fontSize: 11, fontWeight: "600" },

  statsStrip: {
    flexDirection: "row",
    alignItems: "stretch",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  stat: { flex: 1, minWidth: 0, paddingHorizontal: 8, gap: 2, justifyContent: "center" },
  statDivider: { width: StyleSheet.hairlineWidth * 2, marginVertical: 2 },
  statTop: { flexDirection: "row", alignItems: "center", gap: 5 },
  statValue: { fontSize: 16, lineHeight: 19, fontWeight: "900", letterSpacing: -0.3 },
  statLabel: { fontSize: 10.5, lineHeight: 13, fontWeight: "700" },

  barTrack: { height: 3, borderRadius: 1.5, overflow: "hidden", marginTop: 2 },
  barFill: { height: "100%", borderRadius: 1.5 },

  chips: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5 },
  chip: { borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 9, paddingVertical: 3.5, maxWidth: "100%" },
  chipText: { fontSize: 11.5, fontWeight: "800" },
});
