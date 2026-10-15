// components/cineswipe/CineDuoResultsModal.js
//
// Duo oyun sonucu: eşleşme halkası, kişi bazında beğeni/pas karşılaştırması,
// ortak eşleşmeler ve toplu eylemler.
//
// Eski sürümden farklar: "Ortak liste oluştur"a art arda basınca birden çok liste
// açılabiliyordu (artık işlem sürerken/bitince pasif); eylemler durum gösterir
// (kaydediliyor ✓); sonuçlar halka + karşılaştırma çubuklarıyla özetlenir.
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import Animated, { FadeInDown } from "react-native-reanimated";
import AppIcon from "../AppIcon";
import LevelRing from "../game/LevelRing";
import CineSheet from "./CineSheet";
import PressableScale from "./PressableScale";
import { cineColors } from "./cineTheme";
import useCineCopy from "./useCineCopy";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { alpha } from "../../theme/colors";
import { triggerHaptic } from "../../services/hapticsService";
import { cineMediaKey, fillText, posterUrl } from "../../services/cineswipe/deckModel";

/** 0 → hedef arası kübik yavaşlayan sayaç (halka ve yüzde birlikte dolsun). */
function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const start = Date.now();
    let frame;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      setValue(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

function PersonRow({ name, stats, highlight, text, colors }) {
  const likes = stats.likes || 0;
  const passes = stats.passes || 0;
  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <View style={styles.person}>
      <View style={[styles.avatar, { backgroundColor: alpha(highlight ? colors.accent : colors.textSecondary, 0.18) }]}>
        <Text style={[styles.avatarText, { color: highlight ? colors.accent : colors.textSecondary }]}>{initial}</Text>
      </View>
      <View style={styles.personBody}>
        <Text style={[styles.personName, { color: colors.text }]} numberOfLines={1}>
          {name}
        </Text>
        <View style={[styles.bar, { backgroundColor: alpha(colors.text, 0.08) }]}>
          {likes > 0 ? <View style={{ flex: likes, backgroundColor: colors.like }} /> : null}
          {passes > 0 ? <View style={{ flex: passes, backgroundColor: colors.pass }} /> : null}
        </View>
        <Text style={[styles.personMeta, { color: colors.textSecondary }]}>
          {likes} {text.likes} · {passes} {text.passes}
        </Text>
      </View>
    </View>
  );
}

function ActionButton({ state, idleIcon, idleLabel, busyLabel, doneLabel, onPress, primary, colors }) {
  const done = state === "done";
  const busy = state === "saving";
  const tint = done ? colors.like : primary ? colors.onAccent : colors.text;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={done ? doneLabel : busy ? busyLabel : idleLabel}
      disabled={busy || done}
      onPress={onPress}
      style={[
        primary ? styles.primary : styles.secondary,
        primary && !done
          ? { backgroundColor: colors.accent }
          : {
              backgroundColor: done ? alpha(colors.like, 0.16) : alpha(colors.surface, 0.75),
              borderColor: done ? colors.like : colors.border,
              borderWidth: 1,
            },
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={tint} />
      ) : (
        <AppIcon family="Ionicons" name={done ? "checkmark-circle" : idleIcon} size={19} color={tint} />
      )}
      <Text style={[primary ? styles.primaryText : styles.secondaryText, { color: tint }]} numberOfLines={1}>
        {done ? doneLabel : busy ? busyLabel : idleLabel}
      </Text>
    </PressableScale>
  );
}

function ResultsBody({
  matches,
  partnerName,
  summary,
  isHost,
  cleanupError,
  onRetrySave,
  onSelectMedia,
  onAddAllToWatchlist,
  onSaveAsSharedList,
  onClose,
  sharedState,
  watchlistState,
  text,
  copy,
  colors,
}) {
  const you = (isHost ? summary?.host : summary?.guest) || {};
  const partner = (isHost ? summary?.guest : summary?.host) || {};
  const percent = summary?.matchRate || 0;
  const animated = useCountUp(percent);

  return (
    <View>
      {summary ? (
        <Animated.View entering={FadeInDown.duration(320)} style={styles.hero}>
          <LevelRing
            size={116}
            stroke={10}
            progress={animated / 100}
            color={percent >= 50 ? colors.like : colors.accent}
            trackColor={alpha(colors.text, 0.1)}
          >
            <Text style={[styles.ringValue, { color: colors.text }]}>%{Math.round(animated)}</Text>
            <Text style={[styles.ringLabel, { color: colors.textSecondary }]}>{text.matchRate}</Text>
          </LevelRing>
          <View style={styles.heroStats}>
            <View style={[styles.stat, { backgroundColor: alpha(colors.accent, 0.1) }]}>
              <Text style={[styles.statValue, { color: colors.accent }]}>{matches.length}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{text.matches}</Text>
            </View>
            <View style={[styles.stat, { backgroundColor: alpha(colors.text, 0.06) }]}>
              <Text style={[styles.statValue, { color: colors.text }]}>{summary.total}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{text.total}</Text>
            </View>
          </View>
        </Animated.View>
      ) : null}

      {summary ? (
        <Animated.View
          entering={FadeInDown.delay(80).duration(320)}
          style={[styles.people, { backgroundColor: alpha(colors.surface, 0.5) }]}
        >
          <PersonRow name={text.you} stats={you} highlight text={text} colors={colors} />
          <PersonRow name={partnerName || text.partner} stats={partner} text={text} colors={colors} />
        </Animated.View>
      ) : null}

      {cleanupError ? (
        <View style={[styles.error, { backgroundColor: alpha(colors.pass, 0.1), borderColor: alpha(colors.pass, 0.35) }]}>
          <Text accessibilityLiveRegion="polite" style={[styles.errorText, { color: colors.text }]}>
            {text.saveError}
          </Text>
          <PressableScale
            accessibilityRole="button"
            onPress={onRetrySave}
            style={[styles.retry, { borderColor: colors.accent }]}
          >
            <Text style={[styles.retryText, { color: colors.accent }]}>{text.retrySave}</Text>
          </PressableScale>
        </View>
      ) : null}

      {matches.length === 0 ? (
        <View style={styles.empty}>
          <AppIcon family="Ionicons" name="film-outline" size={46} color={colors.muted} />
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>{text.emptyTitle}</Text>
          <Text style={[styles.emptyBody, { color: colors.muted }]}>{text.emptyBody}</Text>
        </View>
      ) : (
        <>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
            {fillText(copy.results.matchesHeading, { n: matches.length })}
          </Text>
          <View style={styles.list}>
            {matches.map((item, index) => {
              const uri = posterUrl(item.poster_path || item.poster, "w342");
              const year = item.release_date ? item.release_date.split("-")[0] : "";
              const rating = item.vote_average ? Number(item.vote_average).toFixed(1) : "";
              return (
                <Animated.View key={cineMediaKey(item)} entering={FadeInDown.delay(120 + index * 45).duration(300)}>
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel={`${item.title || item.name} — ${copy.detailsAction}`}
                    scaleTo={0.97}
                    onPress={() => {
                      triggerHaptic("selection");
                      onClose();
                      setTimeout(() => onSelectMedia?.(item), 280);
                    }}
                    style={[styles.card, { backgroundColor: alpha(colors.surface, 0.6) }]}
                  >
                    <View style={[styles.poster, { backgroundColor: colors.between }]}>
                      {uri ? (
                        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                      ) : (
                        <View style={[StyleSheet.absoluteFill, styles.posterEmpty]}>
                          <AppIcon family="Ionicons" name="film-outline" size={22} color={colors.muted} />
                        </View>
                      )}
                      <View style={[styles.index, { backgroundColor: colors.accent }]}>
                        <Text style={styles.indexText}>{index + 1}</Text>
                      </View>
                    </View>
                    <View style={styles.cardBody}>
                      <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
                        {item.title || item.name}
                      </Text>
                      <View style={styles.cardMeta}>
                        {year ? <Text style={[styles.cardYear, { color: colors.textSecondary }]}>{year}</Text> : null}
                        {rating && rating !== "0.0" ? (
                          <View style={styles.rating}>
                            <AppIcon family="Ionicons" name="star" size={11} color={colors.gold} />
                            <Text style={[styles.ratingText, { color: colors.gold }]}>{rating}</Text>
                          </View>
                        ) : null}
                      </View>
                      {item.overview ? (
                        <Text style={[styles.cardOverview, { color: colors.muted }]} numberOfLines={2}>
                          {item.overview}
                        </Text>
                      ) : null}
                    </View>
                    <AppIcon family="Ionicons" name="chevron-forward" size={18} color={colors.muted} />
                  </PressableScale>
                </Animated.View>
              );
            })}
          </View>

          <View style={styles.actions}>
            <ActionButton
              primary
              state={sharedState}
              idleIcon="people"
              idleLabel={text.sharedList}
              busyLabel={copy.results.creating}
              doneLabel={copy.results.sharedDone}
              onPress={() => {
                triggerHaptic("impact");
                onSaveAsSharedList?.(matches);
              }}
              colors={colors}
            />
            <ActionButton
              state={watchlistState}
              idleIcon="bookmark-outline"
              idleLabel={text.watchlist}
              busyLabel={copy.results.adding}
              doneLabel={copy.results.watchlistDone}
              onPress={() => {
                triggerHaptic("notification");
                onAddAllToWatchlist?.(matches);
              }}
              colors={colors}
            />
          </View>
        </>
      )}
    </View>
  );
}

/**
 * @param {"idle"|"saving"|"done"} sharedState     Ortak liste oluşturma durumu.
 * @param {"idle"|"saving"|"done"} watchlistState  İzleme listesine ekleme durumu.
 */
export default function CineDuoResultsModal({
  visible,
  onClose,
  matches = [],
  partnerName,
  summary,
  isHost,
  cleanupError,
  onRetrySave,
  onSelectMedia,
  onAddAllToWatchlist,
  onSaveAsSharedList,
  sharedState = "idle",
  watchlistState = "idle",
}) {
  const { theme } = useTheme();
  const colors = cineColors(theme);
  const copy = useCineCopy();
  const { t } = useLanguage();
  const text = t.cineRoomResults;

  return (
    <CineSheet
      visible={visible}
      onClose={onClose}
      icon="trophy"
      iconColor={colors.gold}
      title={text.title}
      subtitle={text.subtitle}
      intensity={40}
      maxHeight="92%"
    >
      <ResultsBody
        matches={matches}
        partnerName={partnerName}
        summary={summary}
        isHost={isHost}
        cleanupError={cleanupError}
        onRetrySave={onRetrySave}
        onSelectMedia={onSelectMedia}
        onAddAllToWatchlist={onAddAllToWatchlist}
        onSaveAsSharedList={onSaveAsSharedList}
        onClose={onClose}
        sharedState={sharedState}
        watchlistState={watchlistState}
        text={text}
        copy={copy}
        colors={colors}
      />
    </CineSheet>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    paddingBottom: 14,
  },
  ringValue: {
    fontSize: 25,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  ringLabel: {
    fontSize: 10.5,
    fontWeight: "700",
    marginTop: 1,
  },
  heroStats: {
    flex: 1,
    gap: 10,
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 15,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "900",
    minWidth: 30,
  },
  statLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
  },
  people: {
    borderRadius: 18,
    padding: 14,
    gap: 14,
  },
  person: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "900",
  },
  personBody: {
    flex: 1,
    gap: 5,
  },
  personName: {
    fontSize: 14,
    fontWeight: "800",
  },
  bar: {
    flexDirection: "row",
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  personMeta: {
    fontSize: 11.5,
    fontWeight: "600",
  },
  error: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 19,
  },
  retry: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  retryText: {
    fontSize: 13,
    fontWeight: "800",
  },
  empty: {
    alignItems: "center",
    paddingVertical: 38,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  emptyBody: {
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: "center",
    maxWidth: 250,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.9,
    marginTop: 20,
    marginBottom: 10,
  },
  list: {
    gap: 10,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 18,
    gap: 12,
  },
  poster: {
    width: 56,
    height: 82,
    borderRadius: 11,
    overflow: "hidden",
  },
  posterEmpty: {
    alignItems: "center",
    justifyContent: "center",
  },
  index: {
    position: "absolute",
    top: 4,
    left: 4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  indexText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },
  cardBody: {
    flex: 1,
    gap: 3,
  },
  cardTitle: {
    fontSize: 14.5,
    fontWeight: "800",
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  cardYear: {
    fontSize: 11.5,
    fontWeight: "600",
  },
  rating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  ratingText: {
    fontSize: 11.5,
    fontWeight: "800",
  },
  cardOverview: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  actions: {
    marginTop: 16,
    gap: 10,
  },
  primary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 17,
  },
  primaryText: {
    fontSize: 15,
    fontWeight: "900",
  },
  secondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    height: 46,
    borderRadius: 14,
  },
  secondaryText: {
    fontSize: 13.5,
    fontWeight: "800",
  },
});
