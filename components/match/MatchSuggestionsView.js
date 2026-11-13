// components/match/MatchSuggestionsView.js
//
// Zevk Çemberleri Faz 6 — öneri ekranının GÖVDESİ (veri yok, yalnız çizim + geri çağırımlar). Hem gerçek ekran
// (screens/match/MatchScreen.js) hem Geliştirici Laboratuvarı'nın sahte durumları bunu çizer.
//
// Kart: avatar + görünen ad + karar rozeti (ikiz / yakın / rehber) + ortak sevilenler (afiş) + ayrışılan yapım
// (yalnız ad; PUAN YOK) + "izleme geçmişinize göre" etiketi + selam düğmesi + "…" (gizle / engelle / şikâyet).
// Yaş, konum, cinsiyet YOK; fotoğraf öncelikli tasarım yok (rehber §11).

import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import AppIcon from "@components/AppIcon";
import GlassBox from "../common/GlassBox";
import GlassTouchable from "../common/GlassTouchable";
import UserAvatar from "../common/UserAvatar";
import LensLoader from "../LensLoader";
import { ChallengePoster } from "../challenges/ChallengeParts";
import { GENRE_LABELS } from "../../utils/genreDisplay";
import { copyLanguage } from "../../utils/appLanguages";
import { helloState, laneStatus, parseTitleKey } from "../../utils/matchSuggestions";

export const VERDICT_COLORS = { twin: "#A855F7", near: "#3B82F6", guide: "#F59E0B" };

const genreText = (ids, language) => {
  const lang = copyLanguage(language, ["tr", "en", "es", "pt", "de", "it"]);
  return (ids || []).map((id) => GENRE_LABELS[id]?.[lang]).filter(Boolean).join(", ");
};

function Button({ label, onPress, C, kind = "primary", busy = false, disabled = false, icon }) {
  const primary = kind === "primary";
  return (
    <GlassTouchable
      activeOpacity={0.8}
      onPress={disabled || busy ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy }}
      style={[
        s.button,
        primary ? { backgroundColor: C.accent } : { borderWidth: 1, borderColor: C.border },
        (disabled || busy) && { opacity: 0.6 },
      ]}
    >
      {busy ? <LensLoader size="small" color={primary ? "#FFFFFF" : C.accent} /> : null}
      {!busy && icon ? <AppIcon family="Ionicons" name={icon} size={16} color={primary ? "#FFFFFF" : C.text} /> : null}
      <Text allowFontScaling={false} style={[s.buttonText, { color: primary ? "#FFFFFF" : C.text }]} numberOfLines={1}>
        {label}
      </Text>
    </GlassTouchable>
  );
}

export const MatchCandidateCard = memo(function MatchCandidateCard({ item, titles = {}, copy, C, busy, onHello, onMore, onOpenChat }) {
  const color = VERDICT_COLORS[item.verdict];
  const state = helloState(item);
  const loved = item.loved.slice(0, 3).map((key) => ({ ...parseTitleKey(key), ...(titles[key] || {}) }));
  const split = item.split ? { ...parseTitleKey(item.split), ...(titles[item.split] || {}) } : null;

  return (
    <GlassBox role="card" style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
      <View style={s.head}>
        <UserAvatar avatarIndex={item.avatarIndex} photoURL={item.photoURL} size={46} />
        <View style={s.headBody}>
          <Text allowFontScaling={false} style={[s.name, { color: C.text }]} numberOfLines={1}>
            {item.displayName || "—"}
          </Text>
          <View style={s.badgeRow}>
            <View style={[s.badge, { backgroundColor: `${color}22`, borderColor: `${color}66` }]}>
              <Text allowFontScaling={false} style={[s.badgeText, { color }]}>
                {copy.verdict[item.verdict]}
              </Text>
            </View>
            {item.score != null ? (
              <Text allowFontScaling={false} style={[s.score, { color: C.text }]}>
                {copy.scoreLabel(item.score)}
              </Text>
            ) : null}
          </View>
        </View>
        <GlassTouchable
          activeOpacity={0.7}
          onPress={() => onMore?.(item)}
          accessibilityRole="button"
          accessibilityLabel={copy.more}
          hitSlop={10}
          style={s.more}
        >
          <AppIcon family="Ionicons" name="ellipsis-horizontal" size={20} color={C.muted} />
        </GlassTouchable>
      </View>

      {item.implicitHeavy ? (
        <View style={s.tagRow}>
          <AppIcon family="Ionicons" name="time-outline" size={13} color={C.muted} />
          <Text allowFontScaling={false} style={[s.tag, { color: C.muted }]}>
            {copy.implicit}
          </Text>
        </View>
      ) : null}
      {item.verdict === "guide" ? <Text style={[s.note, { color: C.muted }]}>{copy.guideHint}</Text> : null}

      {loved.length ? (
        <View style={s.section}>
          <Text allowFontScaling={false} style={[s.sectionLabel, { color: C.muted }]}>
            {copy.loved}
          </Text>
          <View style={s.posters}>
            {loved.map((t) => (
              <View key={t.key} style={s.posterCell}>
                <ChallengePoster type={t.type} id={t.id} path={t.posterPath} width={58} check={false} />
                <Text allowFontScaling={false} style={[s.posterName, { color: C.text }]} numberOfLines={1}>
                  {t.name || ""}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {split?.name ? (
        <View style={s.tagRow}>
          <AppIcon family="Ionicons" name="git-compare-outline" size={13} color={C.muted} />
          <Text allowFontScaling={false} style={[s.tag, { color: C.muted }]} numberOfLines={1}>
            {`${copy.split}: ${split.name}`}
          </Text>
        </View>
      ) : null}

      {state === "greeted" ? (
        <Text allowFontScaling={false} style={[s.greeted, { color }]}>
          {`👋 ${copy.greetedNote}`}
        </Text>
      ) : null}

      <View style={s.actions}>
        {state === "mutual" ? (
          <Button label={copy.openChat} icon="chatbubbles-outline" C={C} onPress={() => onOpenChat?.(item)} />
        ) : state === "sent" ? (
          <Button label={copy.sent} icon="checkmark" C={C} kind="secondary" disabled />
        ) : (
          <Button
            label={state === "greeted" ? copy.replyHello : copy.hello}
            icon="hand-left-outline"
            C={C}
            busy={busy}
            onPress={() => onHello?.(item)}
          />
        )}
      </View>
    </GlassBox>
  );
});

export function MatchCircleCard({ circle, copy, C, language, busy, onJoin, onOpenGroup }) {
  if (!circle) return null;
  const genres = genreText(circle.genres, language);
  return (
    <GlassBox role="card" style={[s.card, s.circle, { backgroundColor: C.card, borderColor: VERDICT_COLORS.twin }]}>
      <View style={s.head}>
        <View style={[s.circleIcon, { backgroundColor: `${VERDICT_COLORS.twin}22` }]}>
          <AppIcon family="Ionicons" name="people-circle-outline" size={26} color={VERDICT_COLORS.twin} />
        </View>
        <View style={s.headBody}>
          <Text allowFontScaling={false} style={[s.name, { color: C.text }]}>
            {copy.circle.title}
          </Text>
          <Text allowFontScaling={false} style={[s.tag, { color: C.muted }]}>
            {copy.circle.joined(circle.joinedCount, circle.size)}
          </Text>
        </View>
      </View>
      <Text style={[s.note, { color: C.muted }]}>{copy.circle.body(circle.size, genres)}</Text>
      {circle.joined && !circle.groupId ? <Text style={[s.note, { color: C.text }]}>{copy.circle.waiting}</Text> : null}
      {!circle.joined && circle.groupReady ? <Text style={[s.note, { color: C.text }]}>{copy.circle.readyJoin}</Text> : null}
      <View style={s.actions}>
        {circle.groupId ? (
          <Button label={copy.circle.openGroup} icon="chatbubbles-outline" C={C} onPress={() => onOpenGroup?.(circle)} />
        ) : circle.joined ? (
          <Button label={copy.circle.joined(circle.joinedCount, circle.size)} icon="checkmark" C={C} kind="secondary" disabled />
        ) : (
          <Button label={copy.circle.join} icon="add-circle-outline" C={C} busy={busy} onPress={() => onJoin?.(circle)} />
        )}
      </View>
    </GlassBox>
  );
}

/**
 * Kulvar sekmeleri + durum + kartlar. `lanes` = kullanıcının seçtiği kulvarlar.
 * @param {object} props
 */
export default function MatchSuggestionsView({
  view,
  lane,
  lanes,
  onLane,
  titles,
  copy,
  laneNames,
  C,
  language,
  locale,
  stepNote,
  busyCid,
  circleBusy,
  onHello,
  onMore,
  onOpenChat,
  onJoinCircle,
  onOpenGroup,
  onSettings,
}) {
  const status = laneStatus(view, lane, lanes);
  const entry = view?.lanes?.[lane] || null;
  const when = view?.updatedAt
    ? new Date(view.updatedAt).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <View style={s.root}>
      {lanes.length > 1 ? (
        <View style={s.tabs} accessibilityRole="tablist">
          {lanes.map((id) => {
            const on = id === lane;
            return (
              <GlassTouchable
                key={id}
                activeOpacity={0.8}
                onPress={() => onLane?.(id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={laneNames[id]}
                style={[s.tab, { borderColor: on ? C.accent : C.border, backgroundColor: on ? C.accentDim : "transparent" }]}
              >
                <Text allowFontScaling={false} style={[s.tabText, { color: on ? C.accentStrong : C.text }]}>
                  {laneNames[id]}
                </Text>
              </GlassTouchable>
            );
          })}
        </View>
      ) : null}

      {entry && (status === "list" || status === "empty") ? (
        <View style={s.meta}>
          <Text allowFontScaling={false} style={[s.metaText, { color: C.text }]}>
            {copy.poolCount(entry.active || entry.pool)}
          </Text>
          {when ? (
            <Text allowFontScaling={false} style={[s.metaSub, { color: C.muted }]}>
              {copy.refreshed(when)}
            </Text>
          ) : null}
          {!entry.twinsEnabled ? <Text style={[s.note, { color: C.muted }]}>{copy.coldStart}</Text> : null}
        </View>
      ) : null}

      {entry?.circle && status !== "not-in-pool" ? (
        <MatchCircleCard
          circle={entry.circle}
          copy={copy}
          C={C}
          language={language}
          busy={circleBusy}
          onJoin={onJoinCircle}
          onOpenGroup={onOpenGroup}
        />
      ) : null}

      {status === "list"
        ? entry.items.map((item) => (
            <MatchCandidateCard
              key={item.cid}
              item={item}
              titles={titles}
              copy={copy}
              C={C}
              busy={busyCid === item.cid}
              onHello={onHello}
              onMore={onMore}
              onOpenChat={onOpenChat}
            />
          ))
        : (
          <GlassBox role="card" style={[s.card, s.empty, { backgroundColor: C.card, borderColor: C.border }]}>
            <AppIcon
              family="Ionicons"
              name={status === "not-ready" ? "moon-outline" : status === "empty" ? "search-outline" : "trending-up-outline"}
              size={28}
              color={C.accent}
            />
            <Text style={[s.emptyText, { color: C.text }]}>
              {status === "not-ready"
                ? copy.notReady
                : status === "not-selected"
                  ? copy.notSelected
                  : status === "not-in-pool"
                    ? copy.notInPool
                    : copy.empty}
            </Text>
            {status === "not-in-pool" && stepNote ? <Text style={[s.note, { color: C.muted }]}>{stepNote}</Text> : null}
            {status === "not-in-pool" || status === "not-selected" ? (
              <Button label={copy.goSettings} C={C} kind="secondary" onPress={onSettings} />
            ) : null}
          </GlassBox>
        )}

      <Text style={[s.privacy, { color: C.muted }]}>{copy.privacy}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: 12, paddingTop: 6 },
  tabs: { flexDirection: "row", gap: 8 },
  tab: { flex: 1, alignItems: "center", borderWidth: 1, borderRadius: 12, paddingVertical: 9 },
  tabText: { fontSize: 13.5, fontWeight: "800" },
  meta: { gap: 3, paddingHorizontal: 4 },
  metaText: { fontSize: 13.5, fontWeight: "800" },
  metaSub: { fontSize: 11.5, fontWeight: "600" },
  card: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 10 },
  circle: { borderWidth: 1.5 },
  circleIcon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  headBody: { flex: 1, gap: 4 },
  name: { fontSize: 15.5, fontWeight: "800" },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11.5, fontWeight: "800" },
  score: { fontSize: 12.5, fontWeight: "800" },
  more: { padding: 4 },
  tagRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  tag: { fontSize: 12, fontWeight: "600", flexShrink: 1 },
  note: { fontSize: 12.5, fontWeight: "600", lineHeight: 18 },
  section: { gap: 6 },
  sectionLabel: { fontSize: 11.5, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 },
  posters: { flexDirection: "row", gap: 10 },
  posterCell: { width: 58, gap: 4 },
  posterName: { fontSize: 10.5, fontWeight: "600" },
  greeted: { fontSize: 12.5, fontWeight: "800" },
  actions: { flexDirection: "row", gap: 8 },
  button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 13,
    paddingVertical: 11,
  },
  buttonText: { fontSize: 14, fontWeight: "800" },
  empty: { alignItems: "center", paddingVertical: 22 },
  emptyText: { fontSize: 14, fontWeight: "700", textAlign: "center", lineHeight: 20 },
  privacy: { fontSize: 11.5, fontWeight: "600", lineHeight: 16, paddingHorizontal: 4, marginTop: 4 },
});
