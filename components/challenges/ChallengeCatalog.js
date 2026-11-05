// components/challenges/ChallengeCatalog.js
//
// Meydan Okumalar ekranının (screens/fun/ChallengesScreen.js) katalog parçaları:
//   • ChallengeHero      — üstte üç sayı (süren / madalya / görev) gradyan şerit üstünde
//   • GroupChips         — grup süzgeci (Tümü · Bu aya özel · Maraton · … · Oyuncular)
//   • GroupHeader        — grup adı + kısa alt satır (+ sağda isteğe bağlı sayı)
//   • ChallengeTileGrid  — kişi dışı görevler: iki sütunlu döşeme (madalya, ad, hedef · süre, durum hapı,
//                          "N hazır" önizleme çubuğu)
//   • PeopleSection      — yönetmen / oyuncu: Tümü · Türk sineması · Dünya süzgeci; kapalıyken yatay ray (başladıkların
//                          önde), "Tümünü gör" ile arama kutulu üç sütunlu ızgara
//   • ActiveChallengeCard — süren görev: madalya + ad + kalan gün + çubuk + tempo + son sayılan afişler
// Görsel yapı taşları ChallengeParts'tan (madalya, çubuk, afiş).

import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import GlassBox from "@components/common/GlassBox";
import GlassTouchable from "@components/common/GlassTouchable";
import { GLASS_PRESS_ROOM } from "../../utils/liquidGlass";
import { flagOf } from "../../utils/watchChallenges";
import { ChallengeBar, ChallengeMedal, ChallengePoster } from "./ChallengeParts";

const SIDE = 16; // GameScreenShell içerik dolgusu
const GAP = 10;
const RAIL_LIMIT = 12;
const DONE = "#22C55E";

const fold = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .toLowerCase();

function useColumnWidth(columns) {
  const { width } = useWindowDimensions();
  const inner = Math.min(width, 640) - SIDE * 2;
  return Math.floor((inner - GAP * (columns - 1)) / columns);
}

// ── Üst şerit ───────────────────────────────────────────────────────────────

export function ChallengeHero({ stats, theme }) {
  return (
    <LinearGradient
      colors={["#10B981", "#047857", "#064E3B"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <View pointerEvents="none" style={styles.heroWatermark}>
        <AppIcon family="Ionicons" name="flag" size={120} color="rgba(255,255,255,0.08)" />
      </View>
      {stats.map((stat, index) => (
        <View key={stat.key} style={[styles.heroStat, index > 0 && styles.heroDivider]}>
          <Text style={styles.heroValue} allowFontScaling={false}>
            {stat.value}
          </Text>
          <Text style={styles.heroLabel} numberOfLines={1}>
            {stat.label}
          </Text>
        </View>
      ))}
    </LinearGradient>
  );
}

// ── Grup süzgeci ────────────────────────────────────────────────────────────

export function GroupChips({ options, value, onChange, theme }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.chipRail}
      contentContainerStyle={styles.chipRow}
    >
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <GlassTouchable
            key={option.key}
            glass={false}
            onPress={() => onChange(option.key)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            style={[
              styles.chip,
              selected
                ? { backgroundColor: theme.text.primary, borderColor: theme.text.primary }
                : { backgroundColor: theme.secondary, borderColor: theme.border },
            ]}
          >
            {option.icon ? (
              <AppIcon family="Ionicons" name={option.icon} size={13} color={selected ? theme.primary : theme.text.secondary} />
            ) : null}
            <Text style={[styles.chipText, { color: selected ? theme.primary : theme.text.secondary }]}>{option.label}</Text>
          </GlassTouchable>
        );
      })}
    </ScrollView>
  );
}

export function GroupHeader({ title, sub, right, theme }) {
  return (
    <View style={styles.groupHeader}>
      <View style={styles.groupHeaderCopy}>
        <Text style={[styles.groupTitle, { color: theme.text.primary }]}>{title}</Text>
        {sub ? (
          <Text style={[styles.groupSub, { color: theme.text.muted }]} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

// ── Süren görev kartı ───────────────────────────────────────────────────────

/** Kartın altındaki afiş şeridi: son sayılan (kişi görevinde son izlenen) en çok 5 eser. */
function recentPostersOf(challenge, progress) {
  const kind = challenge.rule.kind;
  if (kind === "person") {
    return [...progress.matches]
      .sort((a, b) => ((a.day || "") < (b.day || "") ? 1 : -1))
      .slice(0, 5)
      .map((film) => ({ key: film.key, type: "movie", id: film.id, path: film.posterPath }));
  }
  const tv = kind === "episodes" || kind === "shows" || kind === "episodeDay";
  return [...progress.matches]
    .sort((a, b) => ((a.day || "") < (b.day || "") ? 1 : -1))
    .slice(0, 5)
    .map((item) => ({ key: item.key, type: tv ? "tv" : "movie", id: item.id, path: item.imagePath }));
}

export function ActiveChallengeCard({ entry, copy, theme, onPress }) {
  const { challenge, progress, daysLeft, pace } = entry;
  const color = challenge.colors[0];
  const posters = recentPostersOf(challenge, progress);
  const urgent = daysLeft != null && daysLeft <= 3;
  return (
    <GlassTouchable
      glass={false}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${copy.titleOf(challenge)}, ${copy.count(progress.count, progress.target)}`}
      style={[styles.activeCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}
    >
      <LinearGradient
        colors={[`${challenge.colors[0]}33`, `${challenge.colors[1]}00`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.6 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.activeTop}>
        <ChallengeMedal challenge={challenge} size={48} />
        <View style={styles.rowCopy}>
          <Text style={[styles.rowTitle, { color: theme.text.primary }]} numberOfLines={1}>
            {copy.titleOf(challenge)}
          </Text>
          <View style={styles.metaRow}>
            <View style={[styles.metaChip, { backgroundColor: urgent ? "#EF444422" : `${color}1F` }]}>
              <AppIcon family="Ionicons" name="time-outline" size={11} color={urgent ? "#EF4444" : color} />
              <Text style={[styles.metaChipText, { color: urgent ? "#EF4444" : color }]} numberOfLines={1}>
                {daysLeft == null ? copy.noDeadline : copy.daysLeft(daysLeft)}
              </Text>
            </View>
            {pace ? (
              <Text
                style={[styles.rowSub, { color: pace.ahead ? DONE : theme.text.muted }]}
                numberOfLines={1}
              >
                {pace.ahead ? copy.paceAhead : copy.paceBehind(pace.expected)}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={styles.activeCountBox}>
          <Text style={[styles.activeCount, { color }]}>{progress.count}</Text>
          <Text style={[styles.activeTarget, { color: theme.text.muted }]}>/{progress.target}</Text>
        </View>
      </View>
      <ChallengeBar ratio={progress.ratio} color={color} height={7} style={styles.activeBar} />
      {posters.length ? (
        <View style={styles.posterStrip}>
          {posters.map((poster) => (
            <ChallengePoster
              key={poster.key}
              type={poster.type}
              id={poster.id}
              path={poster.path}
              width={34}
              check={false}
            />
          ))}
        </View>
      ) : null}
    </GlassTouchable>
  );
}

// ── Kişi dışı görev döşemeleri ──────────────────────────────────────────────

export function ChallengeTileGrid({ items, previewCount, copy, theme, onOpen }) {
  const width = useColumnWidth(2);
  return (
    <View style={styles.tileGrid}>
      {items.map(({ challenge, blocker }) => (
        <ChallengeTile
          key={challenge.id}
          challenge={challenge}
          blocker={blocker}
          ready={previewCount(challenge)}
          width={width}
          copy={copy}
          theme={theme}
          onPress={() => onOpen(challenge.id)}
        />
      ))}
    </View>
  );
}

function ChallengeTile({ challenge, blocker, ready, width, copy, theme, onPress }) {
  const color = challenge.colors[0];
  const state = blocker === "active" ? copy.joined : blocker === "done" ? copy.alreadyDone : null;
  return (
    <GlassTouchable
      glass={false}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${copy.titleOf(challenge)}${state ? `, ${state}` : ""}`}
      style={[
        styles.tile,
        { width, backgroundColor: theme.secondary, borderColor: blocker === "active" ? color : theme.border },
      ]}
    >
      <LinearGradient
        colors={[`${challenge.colors[0]}2E`, `${challenge.colors[1]}00`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.4, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.tileTop}>
        <ChallengeMedal challenge={challenge} size={38} />
        {state ? (
          <View style={[styles.pill, { backgroundColor: `${color}26` }]}>
            <Text style={[styles.pillText, { color }]} numberOfLines={1}>
              {state}
            </Text>
          </View>
        ) : challenge.flag ? (
          <Text style={styles.tileFlag}>{flagOf(challenge.flag)}</Text>
        ) : null}
      </View>
      <Text style={[styles.tileTitle, { color: theme.text.primary }]} numberOfLines={2}>
        {copy.titleOf(challenge)}
      </Text>
      <View style={styles.tileMeta}>
        <AppIcon family="Ionicons" name="flag-outline" size={11} color={theme.text.muted} />
        <Text style={[styles.tileMetaText, { color: theme.text.muted }]} numberOfLines={1}>
          {`${challenge.target} · ${copy.windowShortOf(challenge)}`}
        </Text>
      </View>
      {ready > 0 && !state ? (
        <View style={styles.tileReady}>
          <View style={styles.tileReadyBar}>
            <ChallengeBar ratio={ready / challenge.target} color={color} height={4} />
          </View>
          <Text style={[styles.tileReadyText, { color }]}>{copy.ready(Math.min(ready, challenge.target))}</Text>
        </View>
      ) : null}
    </GlassTouchable>
  );
}

// ── Yönetmen / oyuncu bölümü ────────────────────────────────────────────────

export function PeopleSection({ group, items, previewCount, copy, theme, onOpen }) {
  const [region, setRegion] = useState("all");
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const cardWidth = useColumnWidth(3);
  const hasTr = items.some(({ challenge }) => challenge.person.tr);

  // Başladıkların önde (en çok ilerleyen önce), sonra veri sırası, bitenler sonda.
  const sorted = useMemo(() => {
    const ranked = items.map((item, index) => {
      const count = previewCount(item.challenge);
      const ratio = count / item.challenge.target;
      const rank = item.blocker === "done" || ratio >= 1 ? 2 : count > 0 ? 0 : 1;
      return { ...item, count, ratio, rank, index };
    });
    return ranked.sort((a, b) => a.rank - b.rank || (a.rank === 0 ? b.ratio - a.ratio : 0) || a.index - b.index);
  }, [items, previewCount]);

  const filtered = useMemo(() => {
    const q = fold(query.trim());
    return sorted.filter(({ challenge }) => {
      if (region === "tr" && !challenge.person.tr) return false;
      if (region === "world" && challenge.person.tr) return false;
      return !q || fold(challenge.person.name).includes(q);
    });
  }, [sorted, region, query]);

  const regionOptions = [
    { key: "all", label: copy.peopleAll },
    { key: "tr", label: copy.peopleTr },
    { key: "world", label: copy.peopleWorld },
  ];

  return (
    <View>
      {hasTr ? (
        <View style={styles.regionRow}>
          {regionOptions.map((option) => {
            const selected = option.key === region;
            return (
              <GlassTouchable
                key={option.key}
                glass={false}
                onPress={() => setRegion(option.key)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[styles.regionChip, { borderColor: selected ? "#F59E0B" : theme.border }]}
              >
                <Text style={[styles.regionText, { color: selected ? "#F59E0B" : theme.text.muted }]}>{option.label}</Text>
              </GlassTouchable>
            );
          })}
        </View>
      ) : null}

      {expanded ? (
        <>
          <GlassBox role="field" style={[styles.search, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
            <AppIcon family="Ionicons" name="search" size={15} color={theme.text.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={copy.searchPeople}
              placeholderTextColor={theme.text.muted}
              style={[styles.searchInput, { color: theme.text.primary }]}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              accessibilityLabel={copy.searchPeople}
            />
            {query ? (
              <GlassTouchable glass={false} onPress={() => setQuery("")} accessibilityRole="button" hitSlop={8}>
                <AppIcon family="Ionicons" name="close-circle" size={16} color={theme.text.muted} />
              </GlassTouchable>
            ) : null}
          </GlassBox>
          {filtered.length ? (
            <View style={styles.peopleGrid}>
              {filtered.map((item) => (
                <PersonCard key={item.challenge.id} item={item} width={cardWidth} copy={copy} theme={theme} onOpen={onOpen} />
              ))}
            </View>
          ) : (
            <Text style={[styles.noMatch, { color: theme.text.muted }]}>{copy.noPeopleMatch}</Text>
          )}
          <GlassTouchable
            glass={false}
            onPress={() => {
              setExpanded(false);
              setQuery("");
            }}
            accessibilityRole="button"
            style={styles.moreLink}
          >
            <Text style={[styles.moreText, { color: theme.text.secondary }]}>{copy.showLess}</Text>
            <AppIcon family="Ionicons" name="chevron-up" size={14} color={theme.text.secondary} />
          </GlassTouchable>
        </>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.peopleRail}
          contentContainerStyle={styles.peopleRow}
        >
          {filtered.slice(0, RAIL_LIMIT).map((item) => (
            <PersonCard key={item.challenge.id} item={item} width={112} copy={copy} theme={theme} onOpen={onOpen} />
          ))}
          {filtered.length > RAIL_LIMIT ? (
            <GlassTouchable
              glass={false}
              onPress={() => setExpanded(true)}
              accessibilityRole="button"
              accessibilityLabel={copy.seeAll(filtered.length)}
              style={[styles.seeAllCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}
            >
              <View style={[styles.seeAllIcon, { backgroundColor: `${group === "actors" ? "#F43F5E" : "#F59E0B"}22` }]}>
                <AppIcon family="Ionicons" name="grid-outline" size={20} color={group === "actors" ? "#F43F5E" : "#F59E0B"} />
              </View>
              <Text style={[styles.seeAllText, { color: theme.text.primary }]}>{copy.seeAll(filtered.length)}</Text>
            </GlassTouchable>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

function PersonCard({ item, width, copy, theme, onOpen }) {
  const { challenge, blocker, count } = item;
  const color = challenge.colors[0];
  const done = blocker === "done";
  const tint = done ? DONE : color;
  return (
    <GlassTouchable
      glass={false}
      onPress={() => onOpen(challenge.id)}
      accessibilityRole="button"
      accessibilityLabel={`${copy.titleOf(challenge)}, ${copy.count(count, challenge.target)}`}
      style={[
        styles.personCard,
        { width, backgroundColor: theme.secondary, borderColor: blocker === "active" ? color : theme.border },
      ]}
    >
      <View>
        <ChallengeMedal challenge={challenge} size={Math.min(64, width - 36)} />
        {done ? (
          <View style={[styles.personBadge, { backgroundColor: DONE, borderColor: theme.secondary }]}>
            <AppIcon family="Ionicons" name="checkmark" size={11} color="#FFFFFF" />
          </View>
        ) : blocker === "active" ? (
          <View style={[styles.personBadge, { backgroundColor: color, borderColor: theme.secondary }]}>
            <AppIcon family="Ionicons" name="flag" size={10} color="#FFFFFF" />
          </View>
        ) : null}
      </View>
      <Text style={[styles.personName, { color: theme.text.primary }]} numberOfLines={2}>
        {challenge.person.name}
      </Text>
      <Text style={[styles.personCount, { color: count > 0 || done ? tint : theme.text.muted }]}>
        {done ? copy.alreadyDone : copy.count(count, challenge.target)}
      </Text>
      <ChallengeBar ratio={done ? 1 : count / challenge.target} color={tint} height={4} />
    </GlassTouchable>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: "row",
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 8,
    overflow: "hidden",
  },
  heroWatermark: { position: "absolute", right: -14, bottom: -30, transform: [{ rotate: "-10deg" }] },
  heroStat: { flex: 1, alignItems: "center", paddingHorizontal: 4 },
  heroDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: "rgba(255,255,255,0.35)" },
  heroValue: { color: "#FFFFFF", fontSize: 24, fontWeight: "900", fontVariant: ["tabular-nums"] },
  heroLabel: { color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "800", marginTop: 2 },

  chipRail: { marginHorizontal: -SIDE, marginVertical: -GLASS_PRESS_ROOM },
  chipRow: { gap: 8, paddingHorizontal: SIDE, paddingVertical: GLASS_PRESS_ROOM },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 13,
    height: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: { fontSize: 13, fontWeight: "800" },

  groupHeader: { flexDirection: "row", alignItems: "flex-end", gap: 10, marginTop: 14, marginLeft: 2 },
  groupHeaderCopy: { flex: 1, minWidth: 0 },
  groupTitle: { fontSize: 18, fontWeight: "900", letterSpacing: -0.2 },
  groupSub: { fontSize: 12, marginTop: 2 },

  activeCard: { padding: 14, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  activeTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, fontWeight: "800" },
  rowSub: { flexShrink: 1, fontSize: 12, fontWeight: "700" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 5 },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  metaChipText: { fontSize: 11, fontWeight: "900" },
  activeCountBox: { flexDirection: "row", alignItems: "baseline" },
  activeCount: { fontSize: 24, fontWeight: "900", fontVariant: ["tabular-nums"] },
  activeTarget: { fontSize: 13, fontWeight: "800", fontVariant: ["tabular-nums"] },
  activeBar: { marginTop: 12 },
  posterStrip: { flexDirection: "row", gap: 6, marginTop: 12 },

  tileGrid: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
  tile: {
    minHeight: 132,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  tileTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 6 },
  tileFlag: { fontSize: 20 },
  tileTitle: { fontSize: 14, lineHeight: 18, fontWeight: "900", marginTop: 10 },
  tileMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  tileMetaText: { flexShrink: 1, fontSize: 11, fontWeight: "700" },
  tileReady: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  tileReadyBar: { flex: 1 },
  tileReadyText: { fontSize: 10, fontWeight: "900" },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, flexShrink: 1 },
  pillText: { fontSize: 10, fontWeight: "900" },

  regionRow: { flexDirection: "row", gap: 6, marginBottom: 10 },
  regionChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  regionText: { fontSize: 12, fontWeight: "800" },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  peopleGrid: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
  noMatch: { fontSize: 13, marginLeft: 2, marginVertical: 8 },
  moreLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  moreText: { fontSize: 13, fontWeight: "800" },
  // Cam düğmeli yatay satır: basma büyümesi kırpılmasın (dolgu + eşit negatif dış boşluk, yerleşim değişmez).
  peopleRail: { marginHorizontal: -SIDE, marginVertical: -GLASS_PRESS_ROOM },
  peopleRow: { gap: GAP, paddingHorizontal: SIDE, paddingVertical: GLASS_PRESS_ROOM },
  personCard: {
    padding: 10,
    paddingTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    gap: 6,
  },
  personBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  personName: { fontSize: 12, lineHeight: 15, fontWeight: "800", textAlign: "center", minHeight: 30 },
  personCount: { fontSize: 12, fontWeight: "900", fontVariant: ["tabular-nums"] },
  seeAllCard: {
    width: 112,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 10,
  },
  seeAllIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  seeAllText: { fontSize: 12, fontWeight: "900", textAlign: "center" },
});
