// screens/fun/LeagueScreen.js
//
// "Haftalık Lig" (Eğlence'nin en üstündeki karttan): bu haftanın 30 kişilik grubu, yükselme / düşme bölgeleri,
// ligler merdiveni, XP kaynakları ve kurallar. Geçen haftanın sonucu üst kartta.
//
//   • Veri hooks/useLeague (services/leagueService): durum + tablo Firestore'dan OKUNUR; XP'yi yalnız sunucu yazar.
//   • Bölgeler utils/leagueVisuals.zoneOf — hafta sonu kuralının (utils/leagueRules.outcomeFor) görsel karşılığı.
//     Yükselmek için ayrıca MIN_PROMOTE_XP gerekir; tablonun altındaki not bunu söyler.
//   • Bu hafta henüz XP kazanmamış oyuncu tablo yerine katılma açıklamasını görür (grup ilk XP'de atanır).

import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import GlassTouchable from "@components/common/GlassTouchable";
import UserAvatar from "@components/common/UserAvatar";
import { GameScreenShell } from "../game/GameScreenShell";
import { useTheme } from "@context/ThemeContext";
import { useLanguage } from "@context/LanguageContext";
import useLeague from "@hooks/useLeague";
import { getLeagueCopy } from "@utils/leagueCopy";
import { SOURCE_IDS, XP_SOURCES, weekIdOf } from "@utils/leagueRules";
import { TIER_VISUALS, lastResultLine, tableNotes, tierVisual, timeLeftLabel, zoneOf } from "@utils/leagueVisuals";

const UP = "#22C55E";
const DOWN = "#EF4444";
const SOURCE_ICONS = { game: "game-controller", daily: "calendar", watch: "eye", vote: "hand-left" };

function Hero({ copy, user, rank, size, lastResult }) {
  const tier = user?.tier ?? 0;
  const visual = tierVisual(tier);
  const resultLine = user?.pendingWeek ? copy.pending : lastResultLine(copy, lastResult);
  return (
    <LinearGradient colors={visual.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
      <View pointerEvents="none" style={styles.heroMark}>
        <AppIcon family="Ionicons" name={visual.icon} size={170} color="rgba(255,255,255,0.08)" />
      </View>
      <View style={styles.heroTop}>
        <Text style={styles.heroEyebrow} allowFontScaling={false}>
          {copy.eyebrow}
        </Text>
        <View style={styles.heroPill}>
          <AppIcon family="Ionicons" name="time-outline" size={12} color="#FFFFFF" />
          <Text style={styles.heroPillText} allowFontScaling={false}>
            {timeLeftLabel(copy, weekIdOf(Date.now()))}
          </Text>
        </View>
      </View>
      <View style={styles.heroBody}>
        <View style={[styles.heroEmblem, { borderColor: visual.medal }]}>
          <AppIcon family="Ionicons" name={visual.icon} size={34} color={visual.medal} />
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle} numberOfLines={1}>
            {copy.league(copy.tiers[tier])}
          </Text>
          <Text style={styles.heroSub} numberOfLines={2}>
            {user?.joined
              ? [rank ? copy.rankOf(rank, size) : null, copy.xp(user.xp)].filter(Boolean).join(" · ")
              : copy.joinTitle}
          </Text>
        </View>
      </View>
      {!user?.joined ? <Text style={styles.heroNote}>{copy.joinSub}</Text> : null}
      {resultLine ? (
        <View style={styles.heroResult}>
          <AppIcon
            family="Ionicons"
            name={lastResult?.outcome === "up" ? "trending-up" : lastResult?.outcome === "down" ? "trending-down" : "remove"}
            size={16}
            color="#FFFFFF"
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.heroResultTitle} numberOfLines={1}>
              {resultLine}
            </Text>
            {lastResult && !user?.pendingWeek ? (
              <Text style={styles.heroResultSub} numberOfLines={1}>
                {copy.lastWeek} · {copy.lastWeekBody(lastResult.rank, lastResult.size, lastResult.xp)}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}
    </LinearGradient>
  );
}

function Ladder({ copy, tier, theme }) {
  return (
    <View style={styles.ladder}>
      {TIER_VISUALS.map((visual, index) => {
        const active = index === tier;
        return (
          <View
            key={visual.id}
            style={[
              styles.rung,
              { backgroundColor: active ? visual.colors[1] : theme.secondary, borderColor: active ? visual.medal : theme.border },
            ]}
          >
            <AppIcon family="Ionicons" name={visual.icon} size={18} color={active ? visual.medal : theme.text.muted} />
            <Text
              style={[styles.rungText, { color: active ? "#FFFFFF" : theme.text.secondary }]}
              numberOfLines={1}
              allowFontScaling={false}
            >
              {copy.tiers[index]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function Row({ copy, row, rank, size, tier, self, theme }) {
  const zone = zoneOf({ tier, rank, size });
  const name = self ? copy.you : row.displayName || copy.player;
  return (
    <View
      accessible
      accessibilityLabel={copy.rowA11y(rank, name, row.xp)}
      style={[
        styles.row,
        {
          backgroundColor: self ? `${theme.accent}1A` : theme.secondary,
          borderColor: self ? theme.accent : theme.border,
        },
      ]}
    >
      <View style={[styles.zoneBar, { backgroundColor: zone === "up" ? UP : zone === "down" ? DOWN : "transparent" }]} />
      <Text style={[styles.rank, { color: zone === "up" ? UP : zone === "down" ? DOWN : theme.text.muted }]}>{rank}</Text>
      <UserAvatar avatarIndex={row.avatarIndex} photoURL={row.photoURL} isCustomPhoto size={34} />
      <Text style={[styles.name, { color: theme.text.primary }]} numberOfLines={1}>
        {name}
      </Text>
      <Text style={[styles.xp, { color: theme.text.primary }]}>{copy.xp(row.xp)}</Text>
    </View>
  );
}

function ZoneLabel({ text, color }) {
  return (
    <View style={styles.zoneLabel}>
      <View style={[styles.zoneLine, { backgroundColor: color }]} />
      <Text style={[styles.zoneText, { color }]} allowFontScaling={false}>
        {text}
      </Text>
      <View style={[styles.zoneLine, { backgroundColor: color }]} />
    </View>
  );
}

function Table({ copy, members, tier, uid, theme }) {
  const size = members.length;
  const items = [];
  members.forEach((row, index) => {
    const rank = index + 1;
    const zone = zoneOf({ tier, rank, size });
    const prevZone = index > 0 ? zoneOf({ tier, rank: rank - 1, size }) : null;
    if (zone === "up" && index === 0) items.push(<ZoneLabel key="up" text={copy.promoteZone} color={UP} />);
    if (zone === "down" && prevZone !== "down") items.push(<ZoneLabel key="down" text={copy.demoteZone} color={DOWN} />);
    items.push(<Row key={row.uid} copy={copy} row={row} rank={rank} size={size} tier={tier} self={row.uid === uid} theme={theme} />);
  });
  return (
    <View>
      {items}
      {tableNotes(copy, { tier, size }).map((note) => (
        <Text key={note} style={[styles.note, { color: theme.text.muted }]}>
          {note}
        </Text>
      ))}
    </View>
  );
}

function SectionTitle({ text, theme }) {
  return <Text style={[styles.sectionTitle, { color: theme.text.secondary }]}>{text}</Text>;
}

export default function LeagueScreen({ navigation }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const copy = getLeagueCopy(language);
  const { status, user, members, uid, rank, size, lastResult, refresh } = useLeague();
  const tier = user?.tier ?? 0;

  let content;
  if (!user && status === "loading") {
    content = (
      <View style={styles.state}>
        <ActivityIndicator color={theme.accent} />
        <Text style={[styles.stateText, { color: theme.text.muted }]}>{copy.loading}</Text>
      </View>
    );
  } else if (!user) {
    content = (
      <View style={styles.state}>
        <AppIcon family="Ionicons" name="cloud-offline-outline" size={30} color={theme.text.muted} />
        <Text style={[styles.stateText, { color: theme.text.muted }]}>{copy.error}</Text>
        <GlassTouchable onPress={refresh} accessibilityRole="button" style={[styles.retry, { borderColor: theme.border }]}>
          <Text style={[styles.retryText, { color: theme.text.primary }]}>{copy.retry}</Text>
        </GlassTouchable>
      </View>
    );
  } else {
    content = (
      <>
        <Hero copy={copy} user={user} rank={rank} size={size} lastResult={lastResult} />

        <SectionTitle text={copy.ladderTitle} theme={theme} />
        <Ladder copy={copy} tier={tier} theme={theme} />

        {user.joined && members.length > 0 ? (
          <>
            <SectionTitle text={copy.tableTitle} theme={theme} />
            <Table copy={copy} members={members} tier={tier} uid={uid} theme={theme} />
          </>
        ) : null}

        <SectionTitle text={copy.howTitle} theme={theme} />
        <View style={[styles.card, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          {SOURCE_IDS.map((id, index) => {
            const [title, body] = copy.sources[id];
            return (
              <View key={id} style={[styles.source, index > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                <View style={[styles.sourceIcon, { backgroundColor: `${tierVisual(tier).colors[0]}26` }]}>
                  <AppIcon family="Ionicons" name={SOURCE_ICONS[id]} size={18} color={tierVisual(tier).colors[0]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sourceTitle, { color: theme.text.primary }]}>{title}</Text>
                  <Text style={[styles.sourceBody, { color: theme.text.muted }]}>{body}</Text>
                  <Text style={[styles.sourceXp, { color: theme.text.secondary }]}>
                    {copy.perEvent(XP_SOURCES[id].xp, XP_SOURCES[id].daily)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        <SectionTitle text={copy.rulesTitle} theme={theme} />
        <View style={[styles.card, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          {copy.rules.map((rule) => (
            <View key={rule} style={styles.rule}>
              <Text style={[styles.ruleDot, { color: theme.text.muted }]}>•</Text>
              <Text style={[styles.ruleText, { color: theme.text.secondary }]}>{rule}</Text>
            </View>
          ))}
        </View>
      </>
    );
  }

  return (
    <GameScreenShell navigation={navigation} title={copy.screenTitle} subtitle={copy.screenSub}>
      {content}
    </GameScreenShell>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 24, padding: 18, overflow: "hidden" },
  heroMark: { position: "absolute", right: -24, bottom: -36, transform: [{ rotate: "-10deg" }] },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  heroEyebrow: { color: "rgba(255,255,255,0.86)", fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  heroPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  heroPillText: { color: "#FFFFFF", fontSize: 11.5, fontWeight: "800" },
  heroBody: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 14 },
  heroEmblem: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  heroCopy: { flex: 1, minWidth: 0 },
  heroTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "900", letterSpacing: -0.3 },
  heroSub: { color: "rgba(255,255,255,0.9)", fontSize: 13.5, fontWeight: "700", marginTop: 3 },
  heroNote: { color: "rgba(255,255,255,0.86)", fontSize: 12.5, lineHeight: 17, fontWeight: "600", marginTop: 12 },
  heroResult: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
    padding: 10,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  heroResultTitle: { color: "#FFFFFF", fontSize: 13.5, fontWeight: "900" },
  heroResultSub: { color: "rgba(255,255,255,0.82)", fontSize: 11.5, fontWeight: "700", marginTop: 1 },

  sectionTitle: { fontSize: 12, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase", marginTop: 22, marginBottom: 10 },

  ladder: { flexDirection: "row", gap: 6 },
  rung: { flex: 1, alignItems: "center", gap: 4, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
  rungText: { fontSize: 10.5, fontWeight: "800" },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingRight: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 6,
    overflow: "hidden",
  },
  zoneBar: { width: 4, alignSelf: "stretch" },
  rank: { width: 22, fontSize: 14, fontWeight: "900", textAlign: "center", fontVariant: ["tabular-nums"] },
  name: { flex: 1, fontSize: 14, fontWeight: "700" },
  xp: { fontSize: 13.5, fontWeight: "900", fontVariant: ["tabular-nums"] },
  zoneLabel: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 6 },
  zoneLine: { flex: 1, height: StyleSheet.hairlineWidth * 2, opacity: 0.6 },
  zoneText: { fontSize: 11, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" },
  note: { fontSize: 12, lineHeight: 17, marginTop: 6 },

  card: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 14 },
  source: { flexDirection: "row", gap: 12, paddingVertical: 12 },
  sourceIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  sourceTitle: { fontSize: 14, fontWeight: "800" },
  sourceBody: { fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  sourceXp: { fontSize: 12, fontWeight: "800", marginTop: 4 },
  rule: { flexDirection: "row", gap: 8, paddingVertical: 7 },
  ruleDot: { fontSize: 14, lineHeight: 19 },
  ruleText: { flex: 1, fontSize: 13, lineHeight: 19 },

  state: { alignItems: "center", gap: 10, paddingVertical: 60 },
  stateText: { fontSize: 14, textAlign: "center" },
  retry: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, borderWidth: 1 },
  retryText: { fontSize: 14, fontWeight: "800" },
});
