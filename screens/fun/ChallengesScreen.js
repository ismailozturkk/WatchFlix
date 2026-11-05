// screens/fun/ChallengesScreen.js
//
// Meydan Okumalar (Eğlence > Meydan okumalar kartı; belge docs/ozellikler/MEYDAN_OKUMALAR.md).
//
//   • Üst şerit: süren görev / madalya / katalogdaki görev sayısı.
//   • Süren görevler: madalya + ad + kalan gün + ilerleme + tempo + son sayılan afişler. İlerleme izleme geçmişinden
//     kendiliğinden dolar (hooks/useWatchChallenges.js); kullanıcının elle işaretlediği bir şey yok.
//   • Grup süzgeci (Tümü · Bu aya özel · Maraton · Tür maratonları · Dünya sineması · Keşif · Dizi · Yönetmenler ·
//     Oyuncular) ve katalog: kişi dışı görevler iki sütunlu döşeme, yönetmen / oyuncu ray + "Tümünü gör" ızgarası
//     (izlediğin film sayısı katılmadan da görünür). Parçalar components/challenges/ChallengeCatalog.js'te.
//   • Madalyalar: tamamlanan görevler; altında süresi dolanlar (Geçmiş).
//   Her öğe ChallengeSheet'i açar (katıl / bırak / sayılanlar). `route.params.openId` → o görevin sayfası açık gelir
//   (tamamlama toast'ına dokunma).

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import AppIcon from "@components/AppIcon";
import GlassTouchable from "@components/common/GlassTouchable";
import ChallengeSheet from "@components/challenges/ChallengeSheet";
import { ChallengeMedal } from "@components/challenges/ChallengeParts";
import {
  ActiveChallengeCard,
  ChallengeHero,
  ChallengeTileGrid,
  GroupChips,
  GroupHeader,
  PeopleSection,
} from "@components/challenges/ChallengeCatalog";
import { formatTarih } from "@components/badges/badgeFormat";
import { GameScreenShell } from "../game/GameScreenShell";
import { useTheme } from "@context/ThemeContext";
import { useLanguage } from "@context/LanguageContext";
import useWatchChallenges from "@hooks/useWatchChallenges";
import { triggerHaptic } from "@services/hapticsService";
import { getWatchChallengesCopy } from "@utils/watchChallengesCopy";
import { MAX_ACTIVE_CHALLENGES, PERSON_GROUPS, getChallenge } from "@utils/watchChallenges";

const GROUP_ICONS = {
  seasonal: "calendar-outline",
  marathon: "flash-outline",
  genres: "film-outline",
  world: "earth-outline",
  explore: "compass-outline",
  series: "tv-outline",
  directors: "videocam-outline",
  actors: "people-outline",
};

export default function ChallengesScreen({ navigation, route }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const copy = getWatchChallengesCopy(language);
  const { active, finished, completed, catalog, previewOf, progressOf, blockerOf, join, leave } = useWatchChallenges();
  const [groupFilter, setGroupFilter] = useState("all");

  // Seçim: { id, joinedAt? } — joinedAt verilirse o BİTMİŞ kayıt gösterilir (madalyalar / geçmiş).
  const [selection, setSelection] = useState(() =>
    route?.params?.openId && getChallenge(route.params.openId) ? { id: route.params.openId } : null,
  );
  const [sheetVisible, setSheetVisible] = useState(!!selection);

  useEffect(() => {
    const id = route?.params?.openId;
    if (id && getChallenge(id)) {
      setSelection({ id });
      setSheetVisible(true);
    }
  }, [route?.params?.openId]);

  const open = useCallback((id, joinedAt) => {
    setSelection({ id, joinedAt });
    setSheetVisible(true);
  }, []);

  // Katılmadan "bugün katılsan kaç sayılır" (döşemedeki "N hazır", kişi kartındaki izlenen sayısı). Görev başına bir kez.
  const previewCount = useMemo(() => {
    const cache = new Map();
    return (challenge) => {
      if (!cache.has(challenge.id)) cache.set(challenge.id, previewOf(challenge).count);
      return cache.get(challenge.id);
    };
  }, [previewOf]);

  const item = useMemo(() => {
    if (!selection) return null;
    const challenge = getChallenge(selection.id);
    if (!challenge) return null;
    const base = { challenge, blocker: blockerOf(challenge.id), maxActive: MAX_ACTIVE_CHALLENGES };
    if (selection.joinedAt) {
      const run = finished.find((r) => r.id === challenge.id && r.joinedAt === selection.joinedAt);
      if (run) return { ...base, run, progress: progressOf(challenge, run.joinedAt), daysLeft: null, pace: null };
    }
    const running = active.find((entry) => entry.challenge.id === challenge.id);
    if (running) return { ...base, ...running };
    // Bir kez bitebilen (kişi) görev tamamlandıysa o kayıt; değilse bugün katılsan ne sayılacağı.
    const done = base.blocker === "done" ? finished.find((r) => r.id === challenge.id && r.status === "done") : null;
    if (done) return { ...base, run: done, progress: progressOf(challenge, done.joinedAt), daysLeft: null, pace: null };
    return { ...base, run: null, progress: previewOf(challenge), daysLeft: null, pace: null };
  }, [selection, active, finished, blockerOf, progressOf, previewOf]);

  const onJoin = useCallback(
    (id) => {
      if (join(id) === "ok") triggerHaptic("success");
    },
    [join],
  );
  const onLeave = useCallback(
    (id) => {
      leave(id);
      setSheetVisible(false);
    },
    [leave],
  );
  const onOpenMedia = useCallback(
    ({ type, id }) => navigation.navigate(type === "tv" ? "TvShowsDetails" : "MovieDetails", { id }),
    [navigation],
  );

  const catalogSize = catalog.reduce((sum, section) => sum + section.items.length, 0);
  const chipOptions = useMemo(
    () => [
      { key: "all", label: copy.filterAll, icon: "apps-outline" },
      ...catalog.map(({ group }) => ({ key: group, label: copy.groups[group], icon: GROUP_ICONS[group] })),
    ],
    [catalog, copy],
  );
  const shownGroups = groupFilter === "all" ? catalog : catalog.filter((section) => section.group === groupFilter);

  const expired = finished.filter((run) => run.status === "expired");

  return (
    <GameScreenShell navigation={navigation} title={copy.screenTitle} subtitle={copy.screenSub}>
      <ChallengeHero
        theme={theme}
        stats={[
          { key: "active", value: `${active.length}/${MAX_ACTIVE_CHALLENGES}`, label: copy.statActive },
          { key: "medals", value: String(completed.length), label: copy.statMedals },
          { key: "catalog", value: String(catalogSize), label: copy.statCatalog },
        ]}
      />

      <SectionTitle text={copy.sectionActive} theme={theme} />
      {active.length ? (
        <View style={styles.stack}>
          {active.map((entry) => (
            <ActiveChallengeCard
              key={entry.challenge.id}
              entry={entry}
              copy={copy}
              theme={theme}
              onPress={() => open(entry.challenge.id)}
            />
          ))}
        </View>
      ) : (
        <View style={[styles.emptyCard, { borderColor: theme.border, backgroundColor: theme.secondary }]}>
          <AppIcon family="Ionicons" name="flag-outline" size={18} color={theme.text.muted} />
          <Text style={[styles.emptyText, { color: theme.text.secondary }]}>{copy.noActive}</Text>
        </View>
      )}

      <GroupChips options={chipOptions} value={groupFilter} onChange={setGroupFilter} theme={theme} />

      {shownGroups.map(({ group, items }) => (
        <View key={group} style={styles.group}>
          <GroupHeader title={copy.groups[group]} sub={copy.groupSubs[group]} theme={theme} />
          {PERSON_GROUPS.includes(group) ? (
            <PeopleSection group={group} items={items} previewCount={previewCount} copy={copy} theme={theme} onOpen={open} />
          ) : (
            <ChallengeTileGrid items={items} previewCount={previewCount} copy={copy} theme={theme} onOpen={open} />
          )}
        </View>
      ))}

      <SectionTitle text={copy.sectionMedals} theme={theme} />
      {completed.length ? (
        <View style={styles.medals}>
          {completed.map((run) => {
            const challenge = getChallenge(run.id);
            return (
              <GlassTouchable
                key={`${run.id}@${run.joinedAt}`}
                glass={false}
                onPress={() => open(run.id, run.joinedAt)}
                accessibilityRole="button"
                accessibilityLabel={`${copy.titleOf(challenge)}, ${copy.doneOn(formatTarih(run.endedAt, language))}`}
                style={styles.medalCell}
              >
                <ChallengeMedal challenge={challenge} size={58} />
                <Text style={[styles.medalTitle, { color: theme.text.primary }]} numberOfLines={2}>
                  {copy.titleOf(challenge)}
                </Text>
                <Text style={[styles.medalDate, { color: theme.text.muted }]} numberOfLines={1}>
                  {formatTarih(run.endedAt, language)}
                </Text>
              </GlassTouchable>
            );
          })}
        </View>
      ) : (
        <Text style={[styles.hint, { color: theme.text.muted }]}>{copy.noMedals}</Text>
      )}

      {expired.length ? (
        <>
          <SectionTitle text={copy.history} theme={theme} />
          <View style={[styles.list, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
            {expired.map((run, index) => {
              const challenge = getChallenge(run.id);
              return (
                <GlassTouchable
                  key={`${run.id}@${run.joinedAt}`}
                  glass={false}
                  onPress={() => open(run.id, run.joinedAt)}
                  accessibilityRole="button"
                  style={[styles.row, index < expired.length - 1 && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth }]}
                >
                  <ChallengeMedal challenge={challenge} size={36} dim />
                  <View style={styles.rowCopy}>
                    <Text style={[styles.rowTitle, { color: theme.text.primary }]} numberOfLines={1}>
                      {copy.titleOf(challenge)}
                    </Text>
                    <Text style={[styles.rowSub, { color: theme.text.muted }]} numberOfLines={1}>
                      {`${copy.count(run.count ?? 0, run.target ?? challenge.target)} · ${copy.expiredOn(formatTarih(run.endedAt, language))}`}
                    </Text>
                  </View>
                </GlassTouchable>
              );
            })}
          </View>
        </>
      ) : null}

      <ChallengeSheet
        item={item}
        visible={sheetVisible}
        copy={copy}
        language={language}
        onClose={() => setSheetVisible(false)}
        onDismissed={() => setSelection(null)}
        onJoin={onJoin}
        onLeave={onLeave}
        onOpenMedia={onOpenMedia}
      />
    </GameScreenShell>
  );
}

function SectionTitle({ text, theme }) {
  return <Text style={[styles.sectionTitle, { color: theme.text.muted }]}>{text.toLocaleUpperCase()}</Text>;
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 11, fontWeight: "900", letterSpacing: 0.9, marginTop: 22, marginBottom: 10, marginLeft: 4 },
  stack: { gap: 10 },
  group: { gap: 10 },
  emptyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  emptyText: { flex: 1, fontSize: 13, lineHeight: 18 },
  list: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, fontWeight: "800" },
  rowSub: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  medals: { flexDirection: "row", flexWrap: "wrap", rowGap: 14 },
  medalCell: { width: "33.33%", alignItems: "center", paddingHorizontal: 4 },
  medalTitle: { fontSize: 11, fontWeight: "800", textAlign: "center", marginTop: 6 },
  medalDate: { fontSize: 10, marginTop: 2 },
  hint: { fontSize: 13, lineHeight: 18, marginLeft: 4 },
});
