// components/AICineCards.js
//
// CineMatch Pro — yapılandırılmış AI cevaplarının zengin görsel kartları.
// Her response "type" için ayrı bir kart; ChatBubble type'a göre doğru kartı seçer.
//
// Görsellik: poster yelpazeli kart başlığı, backdrop bannerlı yapım detayı,
// türlü/süreli/platformlu öneri satırları, zevk uyumu rozeti, toplam puanlı
// karşılaştırma ve süre toplamlı izleme planı. Her yapımın altında tek dokunuşla
// izleme listesi / favori eylemi (components/ai/AITitleActions) bulunur.
//
// Ortak atomlar components/ai/aiCardKit.js'te; kartlar `ctx` nesnesi alır:
//   { posterMap, getTmdbUrl, theme, t, copy, language, onTitlePress,
//     tasteGenres, showMatchScore }
// Tüm renkler tema context'inden gelir; posterler TMDB'den çözülmüş posterMap'ten.

import React, { memo, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import Reanimated, { FadeInUp } from "react-native-reanimated";

import { alpha } from "../theme/colors";
import { normMediaType, safeArr, safeNum, toStr } from "../services/aiCineService";
import { formatDuration, sessionRuntime } from "../services/aiCineInsights";
import { fillCopy } from "../utils/aiCopy";
import { i18nText } from "../utils/i18nText";
import {
  CardHero,
  Chip,
  MatchPill,
  PosterBox,
  PosterThumb,
  Stars,
  getPoster,
  matchScoreFor,
  ratingColor,
  s as k,
  unresolvedCard,
} from "./ai/aiCardKit";
import AITitleActions from "./ai/AITitleActions";
import AIResponseFooter from "./ai/AIResponseFooter";

// ── Yardımcılar ───────────────────────────────────────────────────────────────

const metricLabel = (metric, t) => {
  const key = toStr(metric?.key).toLowerCase();
  return t?.AICineChat?.metrics?.[key] || toStr(metric?.label || key);
};

const sectionLabel = (section, t) => {
  const key = toStr(section?.key).toLowerCase();
  return t?.AICineChat?.sections?.[key] || toStr(section?.name || key);
};

const fanOf = (items, ctx) =>
  safeArr(items)
    .map((it) => getPoster(ctx.posterMap, it?.mediaType, toStr(it?.title)))
    .filter((card) => card?.found && card.posterPath)
    .map((card) => ctx.getTmdbUrl(card.posterPath, "poster", 154));

const typeWord = (mediaType, t) =>
  mediaType === "movie"
    ? t?.AICineChat?.movie || i18nText("autoI18n.film", "Film")
    : t?.AICineChat?.series || i18nText("autoI18n.dizi", "Dizi");

// ── 1) Recommendations ────────────────────────────────────────────────────────

const RecItem = memo(({ item, ctx, last }) => {
  const { theme, copy, language, posterMap, onTitlePress, t } = ctx;
  const mediaType = normMediaType(item?.mediaType);
  const title = toStr(item?.title);
  const pcard = getPoster(posterMap, mediaType, title);
  const found = !!pcard?.found;
  const year = toStr(pcard?.year || item?.year);
  const runtime = formatDuration(pcard?.runtimeMinutes, language);
  const genres = safeArr(pcard?.genres).map(toStr).filter(Boolean).slice(0, 3);
  const providers = safeArr(pcard?.providers).map(toStr).filter(Boolean).slice(0, 2);
  const reason = toStr(item?.reason || item?.why || item?.hook);
  const score = matchScoreFor(pcard, ctx);
  const meta = [typeWord(mediaType, t), year, runtime].filter(Boolean).join(" · ");

  return (
    <View style={[s.recRow, { borderColor: theme.border }, last && { borderBottomWidth: 0, paddingBottom: 2 }]}>
      <PosterBox item={item} ctx={ctx} width={84} radius={12} />
      <View style={s.recMain}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => onTitlePress(pcard || unresolvedCard(mediaType, title))}
        >
          <Text style={[s.recTitle, { color: theme.text.primary }]} numberOfLines={2}>
            {found ? pcard.title : title}
          </Text>
        </TouchableOpacity>
        {!!meta && <Text style={[s.recMeta, { color: theme.text.muted }]} numberOfLines={1}>{meta}</Text>}
        {score != null && <MatchPill score={score} theme={theme} copy={copy} />}
        {genres.length > 0 && (
          <View style={s.chipRow}>
            {genres.map((genre) => (
              <Chip key={genre} label={genre} theme={theme} />
            ))}
          </View>
        )}
        {!!reason && <Text style={[s.recWhy, { color: theme.text.secondary }]}>{reason}</Text>}
        {providers.length > 0 && (
          <View style={s.chipRow}>
            {providers.map((name) => (
              <Chip key={name} icon="tv-outline" label={name} theme={theme} tint={theme.colors.green} />
            ))}
          </View>
        )}
        {found && <AITitleActions card={pcard} theme={theme} copy={copy} style={{ marginTop: 10 }} />}
      </View>
    </View>
  );
});

const RecommendationsCard = ({ data, ctx }) => {
  const items = safeArr(data.items);
  const fan = useMemo(() => fanOf(items, ctx), [items, ctx]);
  return (
    <View style={[k.card, { backgroundColor: ctx.theme.secondary, borderColor: ctx.theme.border }]}>
      <CardHero type="recommendations" ctx={ctx} count={items.length} fan={fan} />
      <View style={k.body}>
        {items.map((item, i) => (
          <RecItem
            key={`${normMediaType(item?.mediaType)}-${toStr(item?.title)}-${i}`}
            item={item}
            ctx={ctx}
            last={i === items.length - 1}
          />
        ))}
      </View>
    </View>
  );
};

// ── 2) Comparison ─────────────────────────────────────────────────────────────

const ProsCons = ({ items, color, icon, theme }) => {
  const list = safeArr(items).map(toStr).filter(Boolean);
  if (!list.length) return null;
  return (
    <View style={{ marginTop: 6 }}>
      {list.map((x, i) => (
        <View key={i} style={s.pcRow}>
          <Ionicons name={icon} size={13} color={color} style={{ marginTop: 2 }} />
          <Text style={[s.pcText, { color: theme.text.secondary }]}>{x}</Text>
        </View>
      ))}
    </View>
  );
};

const CompareHead = ({ item, ctx, winner }) => {
  const { theme, posterMap, copy } = ctx;
  const mediaType = normMediaType(item?.mediaType);
  const title = toStr(item?.title);
  const pcard = getPoster(posterMap, mediaType, title);
  const found = !!pcard?.found;
  return (
    <View style={s.cmpHead}>
      <View style={[s.cmpPosterRing, winner && { borderColor: theme.colors.orange }]}>
        <PosterBox item={item} ctx={ctx} width={92} radius={11} />
        {winner && (
          <View style={[s.crown, { backgroundColor: theme.colors.orange }]}>
            <Ionicons name="trophy" size={11} color="#fff" />
          </View>
        )}
      </View>
      <Text numberOfLines={2} style={[s.cmpName, { color: theme.text.primary }]}>
        {found ? pcard.title : title}
      </Text>
      {found && !!pcard.year && <Text style={[s.posterYearSm, { color: theme.text.muted }]}>{pcard.year}</Text>}
      {found && <AITitleActions card={pcard} theme={theme} copy={copy} compact style={{ marginTop: 8 }} />}
    </View>
  );
};

const ComparisonCard = ({ data, ctx }) => {
  const { theme, t } = ctx;
  const metrics = safeArr(data.metrics);
  const green = theme.colors.green;
  const red = theme.colors.red;
  const leftTotal = metrics.reduce((sum, m) => sum + safeNum(m?.left ?? m?.leftScore), 0);
  const rightTotal = metrics.reduce((sum, m) => sum + safeNum(m?.right ?? m?.rightScore), 0);
  const hasTotals = metrics.length > 0 && leftTotal + rightTotal > 0;
  const leftWins = hasTotals && leftTotal > rightTotal;
  const rightWins = hasTotals && rightTotal > leftTotal;

  return (
    <View style={[k.card, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      <CardHero type="comparison" ctx={ctx} fan={fanOf([data.left, data.right], ctx)} />
      <View style={k.body}>
        {/* İki taraf posterleri */}
        <View style={s.cmpHeads}>
          <CompareHead item={data.left} ctx={ctx} winner={leftWins} />
          <View style={[s.vsBadge, { backgroundColor: theme.bold }]}>
            <Text style={s.vsText}>VS</Text>
          </View>
          <CompareHead item={data.right} ctx={ctx} winner={rightWins} />
        </View>

        {/* Toplam puan çubuğu */}
        {hasTotals && (
          <View style={s.totalWrap}>
            <Text style={[s.totalNum, { color: leftWins ? theme.bold : theme.text.muted }]}>{leftTotal}</Text>
            <View style={[s.totalBar, { backgroundColor: alpha(theme.accent, 0.25) }]}>
              <View
                style={{
                  width: `${Math.round((leftTotal / (leftTotal + rightTotal)) * 100)}%`,
                  height: "100%",
                  backgroundColor: theme.bold,
                }}
              />
            </View>
            <Text style={[s.totalNum, { color: rightWins ? theme.accent : theme.text.muted }]}>{rightTotal}</Text>
          </View>
        )}

        {/* Metrik tablosu */}
        {metrics.length > 0 && (
          <View style={[s.metricBox, { borderColor: theme.border }]}>
            {metrics.map((m, i) => (
              <View
                key={i}
                style={[s.metricRow, i === metrics.length - 1 && { borderBottomWidth: 0 }, { borderColor: theme.border }]}
              >
                <View style={s.metricSide}>
                  <Stars score={m?.left ?? m?.leftScore} color={theme.bold} />
                </View>
                <Text style={[s.metricLabel, { color: theme.text.between }]} numberOfLines={1}>
                  {metricLabel(m, t)}
                </Text>
                <View style={[s.metricSide, { alignItems: "flex-end" }]}>
                  <Stars score={m?.right ?? m?.rightScore} color={theme.accent} />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Artı / Eksi */}
        <View style={s.cmpProsCons}>
          <View style={{ flex: 1, paddingRight: 6 }}>
            <ProsCons items={data.leftPros} color={green} icon="add-circle" theme={theme} />
            <ProsCons items={data.leftCons} color={red} icon="remove-circle" theme={theme} />
          </View>
          <View style={[s.cmpDivider, { backgroundColor: theme.border }]} />
          <View style={{ flex: 1, paddingLeft: 6 }}>
            <ProsCons items={data.rightPros} color={green} icon="add-circle" theme={theme} />
            <ProsCons items={data.rightCons} color={red} icon="remove-circle" theme={theme} />
          </View>
        </View>

        {/* Sonuç */}
        {!!toStr(data.verdict) && (
          <View style={[s.verdict, { backgroundColor: alpha(theme.bold, 0.12), borderColor: theme.bold }]}>
            <Ionicons name="trophy" size={15} color={theme.bold} />
            <Text style={[s.verdictText, { color: theme.text.primary }]}>
              <Text style={{ fontWeight: "800" }}>{t?.AICineChat?.verdict || i18nText("autoI18n.sonuc", "Sonuç")}: </Text>
              {toStr(data.verdict)}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

// ── 3) Watch plan ─────────────────────────────────────────────────────────────

const PlanSession = ({ session, idx, ctx }) => {
  const { theme, copy, language, posterMap } = ctx;
  const [open, setOpen] = useState(idx === 0);
  const items = safeArr(session?.items);
  const total = useMemo(() => sessionRuntime(session, posterMap), [session, posterMap]);
  const runtimeParts = [];
  if (total.minutes > 0) {
    runtimeParts.push(
      fillCopy(copy.notes.runtimeMovies, { time: formatDuration(total.minutes, language), n: total.movies }),
    );
  }
  if (total.series > 0) runtimeParts.push(fillCopy(copy.notes.runtimeSeries, { n: total.series }));
  const runtimeText = runtimeParts.join(" ");

  return (
    <View style={[s.session, { borderColor: theme.border, backgroundColor: theme.primary }]}>
      <TouchableOpacity style={s.sessionHead} activeOpacity={0.7} onPress={() => setOpen((o) => !o)}>
        <View style={[s.sessionNum, { backgroundColor: theme.bold }]}>
          <Text style={s.sessionNumText}>{idx + 1}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.sessionLabel, { color: theme.text.primary }]} numberOfLines={2}>
            {toStr(session?.label)}
          </Text>
          {!!runtimeText && (
            <View style={s.runtimePill}>
              <Ionicons name="time-outline" size={11} color={theme.text.muted} />
              <Text style={[s.runtimeText, { color: theme.text.muted }]}>{runtimeText}</Text>
            </View>
          )}
        </View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={theme.text.muted} />
      </TouchableOpacity>
      {open && (
        <View style={{ paddingHorizontal: 10, paddingBottom: 10 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {items.map((it, i) => {
              const pcard = getPoster(posterMap, it?.mediaType, toStr(it?.title));
              const runtime = formatDuration(pcard?.runtimeMinutes, language) || toStr(it?.runtime);
              return (
                <View key={i} style={{ marginRight: 10 }}>
                  <PosterThumb item={it} ctx={ctx} width={76} showMeta={false} />
                  {!!runtime && <Text style={[s.runtimeTag, { color: theme.text.muted }]}>{runtime}</Text>}
                </View>
              );
            })}
          </ScrollView>
          {!!toStr(session?.note) && (
            <Text style={[s.sessionNote, { color: theme.text.secondary }]}>{toStr(session.note)}</Text>
          )}
        </View>
      )}
    </View>
  );
};

const WatchPlanCard = ({ data, ctx }) => {
  const sessions = safeArr(data.sessions);
  const everyItem = sessions.flatMap((session) => safeArr(session?.items));
  return (
    <View style={[k.card, { backgroundColor: ctx.theme.secondary, borderColor: ctx.theme.border }]}>
      <CardHero type="watch_plan" ctx={ctx} count={sessions.length} fan={fanOf(everyItem, ctx)} />
      <View style={k.body}>
        {sessions.map((session, i) => (
          <PlanSession key={i} session={session} idx={i} ctx={ctx} />
        ))}
      </View>
    </View>
  );
};

// ── 4) Watchlist ──────────────────────────────────────────────────────────────

const WatchlistItem = memo(({ item, ctx }) => {
  const { theme, copy, language, posterMap, onTitlePress, t } = ctx;
  const mediaType = normMediaType(item?.mediaType);
  const title = toStr(item?.title);
  const pcard = getPoster(posterMap, mediaType, title);
  const found = !!pcard?.found;
  const meta = [typeWord(mediaType, t), pcard?.year, formatDuration(pcard?.runtimeMinutes, language)]
    .filter(Boolean)
    .join(" · ");
  const note = toStr(item?.reason || item?.note);

  return (
    <View style={[s.wlRow, { borderColor: theme.border }]}>
      <PosterBox item={item} ctx={ctx} width={50} radius={8} badges={false} />
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => onTitlePress(pcard || unresolvedCard(mediaType, title))}
        style={s.wlMain}
      >
        <View style={s.wlTitleRow}>
          <Text numberOfLines={2} style={[s.wlTitle, { color: theme.text.primary }]}>
            {found ? pcard.title : title}
          </Text>
          {item?.mustWatch && (
            <View style={[s.mustBadge, { backgroundColor: alpha(theme.colors.orange, 0.2) }]}>
              <Text style={{ color: theme.colors.orange, fontSize: 9, fontWeight: "800" }}>
                {t?.AICineChat?.mustWatch || "Mutlaka"}
              </Text>
            </View>
          )}
        </View>
        {!!meta && <Text style={[s.wlMeta, { color: theme.text.muted }]} numberOfLines={1}>{meta}</Text>}
        {!!note && (
          <Text numberOfLines={3} style={[s.wlNote, { color: theme.text.secondary }]}>
            {note}
          </Text>
        )}
      </TouchableOpacity>
      {found && <AITitleActions card={pcard} theme={theme} copy={copy} compact vertical />}
    </View>
  );
});

const WatchlistCard = ({ data, ctx }) => {
  const { theme, t } = ctx;
  const sections = safeArr(data.sections);
  const everyItem = sections.flatMap((section) => safeArr(section?.items));
  return (
    <View style={[k.card, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      <CardHero type="watchlist" ctx={ctx} count={everyItem.length} fan={fanOf(everyItem, ctx)} />
      <View style={k.body}>
        {sections.map((sec, i) => (
          <View key={i} style={{ marginBottom: 10 }}>
            {!!sectionLabel(sec, t) && (
              <View style={s.sectionHead}>
                <View style={[s.sectionDot, { backgroundColor: theme.bold }]} />
                <Text style={[s.sectionName, { color: theme.text.primary }]}>{sectionLabel(sec, t)}</Text>
              </View>
            )}
            {safeArr(sec?.items).map((it, j) => (
              <WatchlistItem key={`${toStr(it?.title)}-${j}`} item={it} ctx={ctx} />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
};

// ── 5) Title spotlight ────────────────────────────────────────────────────────

const TitleSpotlightCard = ({ data, ctx }) => {
  const { theme, t, copy, language, posterMap, getTmdbUrl, onTitlePress } = ctx;
  const [expanded, setExpanded] = useState(false);
  const mediaType = normMediaType(data.mediaType);
  const pcard = getPoster(posterMap, mediaType, toStr(data.title));
  const found = !!pcard?.found;
  const uri = found && pcard.posterPath ? getTmdbUrl(pcard.posterPath, "poster", 185) : null;
  const backdropUri = found && pcard.backdropPath ? getTmdbUrl(pcard.backdropPath, "backdrop", 780) : null;
  const rating = safeNum(pcard?.rating) || safeNum(data.rating);
  const genres = safeArr(pcard?.genres || data.genres).map(toStr).filter(Boolean);
  const cast = safeArr(pcard?.cast || data.cast).map(toStr).filter(Boolean);
  const where = safeArr(pcard?.providers || data.whereToWatch).map(toStr).filter(Boolean);
  const similar = safeArr(pcard?.similar || data.similar);
  const displayTitle = toStr(pcard?.title || data.title);
  const displayYear = toStr(pcard?.year || data.year);
  const runtime = formatDuration(pcard?.runtimeMinutes, language) || toStr(data.runtime);
  const take = toStr(data.take || data.summary);
  const overview = toStr(pcard?.overview);
  const tagline = toStr(pcard?.tagline);
  const director = toStr(pcard?.director || data.director);
  const score = matchScoreFor(pcard, ctx);

  return (
    <View style={[k.card, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      {backdropUri ? (
        <View style={s.banner}>
          <Image source={{ uri: backdropUri }} style={k.posterImg} contentFit="cover" transition={200} />
          <LinearGradient
            colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.0)", alpha(theme.secondary, 0.96)]}
            locations={[0, 0.35, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={s.bannerTag}>
            <Ionicons name="film-outline" size={12} color="#fff" />
            <Text style={s.bannerTagText}>{t?.AICineChat?.responseTypes?.title_spotlight || "Yapım Detayı"}</Text>
          </View>
        </View>
      ) : (
        <CardHero type="title_spotlight" ctx={ctx} />
      )}
      <View style={k.body}>
        <View style={s.spotHead}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => onTitlePress(pcard || unresolvedCard(mediaType, toStr(data.title)))}
            style={[
              s.spotPoster,
              backdropUri && s.spotPosterRaised,
              { backgroundColor: theme.between, borderColor: theme.secondary },
            ]}
          >
            {uri ? (
              <Image source={{ uri }} style={k.posterImg} contentFit="cover" />
            ) : (
              <Ionicons name={mediaType === "movie" ? "film-outline" : "tv-outline"} size={28} color={theme.text.muted} />
            )}
          </TouchableOpacity>
          <View style={{ flex: 1, paddingTop: backdropUri ? 6 : 4 }}>
            <Text style={[s.spotTitle, { color: theme.text.primary }]} numberOfLines={3}>
              {displayTitle}
            </Text>
            {!!tagline && (
              <Text style={[s.tagline, { color: theme.text.muted }]} numberOfLines={2}>
                {tagline}
              </Text>
            )}
            <View style={s.spotMetaRow}>
              {!!displayYear && <Chip icon="calendar-outline" label={displayYear} theme={theme} />}
              {!!runtime && <Chip icon="time-outline" label={runtime} theme={theme} />}
              {rating > 0 && (
                <View
                  style={[k.chip, { backgroundColor: alpha(ratingColor(rating), 0.18), borderColor: alpha(ratingColor(rating), 0.5) }]}
                >
                  <Text style={{ color: ratingColor(rating), fontSize: 11, fontWeight: "800" }}>★ {rating.toFixed(1)}</Text>
                </View>
              )}
            </View>
            {genres.length > 0 && (
              <View style={[s.spotMetaRow, { marginTop: 4 }]}>
                {genres.slice(0, 3).map((g, i) => (
                  <Chip key={i} label={g} theme={theme} />
                ))}
              </View>
            )}
          </View>
        </View>

        {score != null && (
          <View style={{ marginTop: 10 }}>
            <MatchPill score={score} theme={theme} copy={copy} />
          </View>
        )}

        {!!take && (
          <View style={[s.takeBox, { backgroundColor: alpha(theme.accent, 0.1), borderColor: alpha(theme.accent, 0.35) }]}>
            <Ionicons name="sparkles" size={14} color={theme.bold} style={{ marginTop: 2 }} />
            <Text style={[s.takeText, { color: theme.text.primary }]}>{take}</Text>
          </View>
        )}

        {!!overview && (
          <TouchableOpacity activeOpacity={0.8} onPress={() => setExpanded((v) => !v)}>
            <Text numberOfLines={expanded ? undefined : 4} style={[s.spotSummary, { color: theme.text.secondary }]}>
              {overview}
            </Text>
          </TouchableOpacity>
        )}

        {!!director && (
          <Text style={[s.spotLine, { color: theme.text.secondary }]}>
            <Text style={{ color: theme.text.muted }}>{t?.AICineChat?.director || i18nText("autoI18n.yonetmen", "Yönetmen")}: </Text>
            {director}
          </Text>
        )}
        {cast.length > 0 && (
          <Text style={[s.spotLine, { color: theme.text.secondary }]}>
            <Text style={{ color: theme.text.muted }}>{t?.AICineChat?.cast || "Oyuncular"}: </Text>
            {cast.slice(0, 4).join(", ")}
          </Text>
        )}
        {where.length > 0 && (
          <View style={[s.spotMetaRow, { marginTop: 8 }]}>
            <Text style={[s.spotLine, { color: theme.text.muted, marginRight: 4, marginTop: 0 }]}>
              {t?.AICineChat?.whereToWatch || "Nerede izlenir"}:
            </Text>
            {where.map((w, i) => (
              <Chip key={i} icon="tv-outline" label={w} theme={theme} tint={theme.colors.green} />
            ))}
          </View>
        )}

        {found && (
          <View style={s.spotActions}>
            <AITitleActions card={pcard} theme={theme} copy={copy} />
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => onTitlePress(pcard)}
              style={[s.detailBtn, { borderColor: alpha(theme.accent, 0.5), backgroundColor: alpha(theme.accent, 0.12) }]}
            >
              <Text style={[s.detailBtnText, { color: theme.bold }]}>{copy.actions.detail}</Text>
              <Ionicons name="chevron-forward" size={14} color={theme.bold} />
            </TouchableOpacity>
          </View>
        )}

        {similar.length > 0 && (
          <View style={{ marginTop: 14 }}>
            <Text style={[s.subHead, { color: theme.text.primary }]}>
              {t?.AICineChat?.similar || i18nText("autoI18n.benzer_yapimlar", "Benzer yapımlar")}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {similar.map((it, i) => (
                <View key={i} style={{ marginRight: 10 }}>
                  <PosterThumb item={it} ctx={ctx} width={72} showMeta={false} />
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    </View>
  );
};

// ── 6) General ────────────────────────────────────────────────────────────────

const GeneralCard = ({ data, ctx }) => {
  const { theme } = ctx;
  const items = safeArr(data.items);
  return (
    <View style={[k.card, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      <View style={k.body}>
        {!!toStr(data.content || data.summary) && (
          <Text style={[s.generalText, { color: theme.text.secondary }]}>{toStr(data.content || data.summary)}</Text>
        )}
        {items.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={{ marginTop: 10 }}
          >
            {items.map((it, i) => (
              <View key={i} style={{ marginRight: 10 }}>
                <PosterThumb item={it} ctx={ctx} width={72} showMeta={false} />
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
};

// ── Dispatcher + kullanıcı/hata baloncukları ──────────────────────────────────

const CARD_BY_TYPE = {
  recommendations: RecommendationsCard,
  comparison: ComparisonCard,
  watch_plan: WatchPlanCard,
  watchlist: WatchlistCard,
  title_spotlight: TitleSpotlightCard,
  general: GeneralCard,
};

/**
 * Kullanıcı mesajına iliştirilen yapım kartı ("alıntı" görünümü).
 * attachment: { mediaType, title, year, posterPath, rating, id }
 * Poster/başlık yalnızca baloncukta gösterilir; AI'a giden metne dahil değildir.
 */
const UserAttachment = memo(({ attachment, t, getTmdbUrl, onTitlePress }) => {
  const mediaType = normMediaType(attachment?.mediaType);
  const title = toStr(attachment?.title);
  if (!title) return null;

  const year = toStr(attachment?.year);
  const rating = safeNum(attachment?.rating);
  const posterPath = toStr(attachment?.posterPath);
  const uri = posterPath && getTmdbUrl ? getTmdbUrl(posterPath, "poster", 185) : null;
  const meta = [typeWord(mediaType, t), year].filter(Boolean).join(" · ");
  const pressable = typeof onTitlePress === "function";

  return (
    <TouchableOpacity
      activeOpacity={pressable ? 0.85 : 1}
      disabled={!pressable}
      onPress={() =>
        onTitlePress?.({
          mediaType,
          id: attachment?.id,
          found: !!attachment?.id,
          title,
          query: title,
        })
      }
      style={s.attachCard}
    >
      <View style={s.attachBar} />
      <View style={s.attachPoster}>
        {uri ? (
          <Image source={{ uri }} style={k.posterImg} contentFit="cover" />
        ) : (
          <Ionicons name={mediaType === "movie" ? "film-outline" : "tv-outline"} size={18} color="rgba(255,255,255,0.75)" />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.attachTitle} numberOfLines={2}>
          {title}
        </Text>
        <View style={s.attachMetaRow}>
          {!!meta && <Text style={s.attachMeta}>{meta}</Text>}
          {rating > 0 && (
            <View style={s.attachRating}>
              <Ionicons name="star" size={9} color="#fff" />
              <Text style={s.attachRatingText}>{rating.toFixed(1)}</Text>
            </View>
          )}
        </View>
      </View>
      {pressable && <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />}
    </TouchableOpacity>
  );
});

const UserBubble = memo(({ text, attachment, theme, t, getTmdbUrl, onTitlePress }) => (
  <Reanimated.View entering={FadeInUp.duration(200)} style={[s.row, { justifyContent: "flex-end" }]}>
    <View style={[s.userBubble, { backgroundColor: theme.accent }, attachment?.title && s.userBubbleWithAttachment]}>
      {!!attachment?.title && (
        <UserAttachment attachment={attachment} t={t} getTmdbUrl={getTmdbUrl} onTitlePress={onTitlePress} />
      )}
      {!!text && (
        <Text selectable style={{ color: "#fff", fontSize: 14, lineHeight: 20 }}>
          {text}
        </Text>
      )}
    </View>
  </Reanimated.View>
));

// `upsell`: kota dolduğunda üst planın limitini söyleyen metin. Varsa "Tekrar
// dene" yerine ödeme ekranına götüren buton çizilir — hak yarına/gelecek aya
// kadar dönmeyeceği için tekrar denemek bir işe yaramaz.
const ErrorBubble = memo(({ text, retry, upsell, onRetry, onUpgrade, theme, t }) => (
  <Reanimated.View entering={FadeInUp.duration(200)} style={[s.row, { justifyContent: "flex-start" }]}>
    <View
      style={[
        s.errBubble,
        upsell
          ? { backgroundColor: alpha(theme.accent, 0.1), borderColor: alpha(theme.accent, 0.34) }
          : { backgroundColor: theme.notesColor.redBackground, borderColor: alpha(theme.colors.red, 0.34) },
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons
          name={upsell ? "sparkles" : "alert-circle"}
          size={16}
          color={upsell ? theme.accent : theme.colors.red}
        />
        <Text style={{ color: theme.text.primary, fontSize: 13, flex: 1 }}>{text}</Text>
      </View>
      {!!upsell && (
        <Text style={{ color: theme.text.secondary, fontSize: 12, marginTop: 6 }}>{upsell.message}</Text>
      )}
      {upsell && onUpgrade ? (
        <TouchableOpacity
          onPress={onUpgrade}
          style={[s.retryBtn, { borderColor: alpha(theme.accent, 0.5), backgroundColor: alpha(theme.accent, 0.12) }]}
        >
          <Ionicons name="diamond" size={13} color={theme.accent} />
          <Text style={{ color: theme.accent, fontSize: 12, fontWeight: "800" }}>{upsell.cta}</Text>
        </TouchableOpacity>
      ) : (
        !!retry && (
          <TouchableOpacity onPress={() => onRetry(retry)} style={[s.retryBtn, { borderColor: alpha(theme.colors.red, 0.4) }]}>
            <Ionicons name="refresh" size={13} color={theme.colors.red} />
            <Text style={{ color: theme.colors.red, fontSize: 12, fontWeight: "700" }}>
              {t?.AICineChat?.retry || "Tekrar dene"}
            </Text>
          </TouchableOpacity>
        )
      )}
    </View>
  </Reanimated.View>
));

/**
 * Mesajı role/type'a göre doğru bileşene yönlendirir.
 * msg: { id, role, text?, display?, attachment?, aiResponse?, posterMap?, notes?, status?, retry? }
 *
 * `baseCtx` ekran düzeyindeki ortak bağlam (tema, dil, tıklama işleyicisi…);
 * mesajın kendi posterMap'i burada eklenir. `isLast` yalnız son cevapta devam
 * çiplerini ve "yeniden öner"i açar.
 */
export const ChatBubble = memo(
  ({
    msg,
    baseCtx,
    isLast = false,
    loading = false,
    showFollowUps = true,
    onRetry,
    onUpgrade,
    onFollowUp,
    onRegenerate,
  }) => {
    const ctx = useMemo(() => ({ ...baseCtx, posterMap: msg.posterMap }), [baseCtx, msg.posterMap]);
    const { theme, t, getTmdbUrl, onTitlePress } = baseCtx;

    if (msg.role === "user") {
      return (
        <UserBubble
          text={msg.display || msg.text}
          attachment={msg.attachment}
          theme={theme}
          t={t}
          getTmdbUrl={getTmdbUrl}
          onTitlePress={onTitlePress}
        />
      );
    }
    if (msg.status === "error") {
      return (
        <ErrorBubble
          text={msg.text}
          retry={msg.retry}
          upsell={msg.upsell}
          onRetry={onRetry}
          onUpgrade={onUpgrade}
          theme={theme}
          t={t}
        />
      );
    }
    const data = msg.aiResponse;
    if (!data) return null;
    const Card = CARD_BY_TYPE[data.type] || GeneralCard;

    return (
      <Reanimated.View entering={FadeInUp.duration(220)} style={[s.row, { justifyContent: "flex-start" }]}>
        <View style={{ width: "100%" }}>
          <Card data={data} ctx={ctx} />
          <AIResponseFooter
            response={data}
            notes={msg.notes}
            ctx={ctx}
            isLast={isLast}
            loading={loading}
            showFollowUps={showFollowUps}
            showBulk={data.type !== "title_spotlight"}
            onFollowUp={onFollowUp}
            onRegenerate={isLast ? onRegenerate : undefined}
          />
        </View>
      </Reanimated.View>
    );
  },
);

// ── Stiller ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  row: { width: "100%", marginBottom: 14, flexDirection: "row" },

  userBubble: {
    maxWidth: "86%",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 18,
    borderBottomRightRadius: 5,
  },
  // Yapım kartı iliştirildiğinde baloncuk biraz daha geniş durur
  userBubbleWithAttachment: { maxWidth: "92%", minWidth: 232, padding: 8, paddingBottom: 9 },

  // Kullanıcı mesajındaki "alıntı" yapım kartı
  attachCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    padding: 7,
    paddingRight: 9,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.16)",
    marginBottom: 7,
  },
  attachBar: { width: 3, alignSelf: "stretch", borderRadius: 2, backgroundColor: "rgba(255,255,255,0.6)" },
  attachPoster: {
    width: 40,
    height: 60,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.22)",
    justifyContent: "center",
    alignItems: "center",
  },
  attachTitle: { color: "#fff", fontSize: 14, fontWeight: "800", letterSpacing: -0.2, lineHeight: 18 },
  attachMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  attachMeta: { color: "rgba(255,255,255,0.82)", fontSize: 11, fontWeight: "600" },
  attachRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 7,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  attachRatingText: { color: "#fff", fontSize: 10, fontWeight: "800" },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 7 },

  // Recommendations
  recRow: { flexDirection: "row", gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  recMain: { flex: 1 },
  recTitle: { fontSize: 16, fontWeight: "800", letterSpacing: -0.25, lineHeight: 21 },
  recMeta: { fontSize: 11.5, fontWeight: "600", marginTop: 2, marginBottom: 6 },
  recWhy: { fontSize: 12.5, lineHeight: 18, marginTop: 8 },

  // Comparison
  cmpHeads: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  cmpHead: { flex: 1, alignItems: "center" },
  cmpPosterRing: { borderWidth: 2, borderColor: "transparent", borderRadius: 13, padding: 1 },
  crown: {
    position: "absolute",
    top: -6,
    left: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  cmpName: { fontSize: 12.5, fontWeight: "800", textAlign: "center", marginTop: 7, lineHeight: 16 },
  posterYearSm: { fontSize: 10.5, marginTop: 1 },
  vsBadge: { width: 34, height: 34, borderRadius: 17, justifyContent: "center", alignItems: "center", marginHorizontal: 6, marginTop: 56 },
  vsText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  totalWrap: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 },
  totalNum: { fontSize: 17, fontWeight: "900", minWidth: 24, textAlign: "center" },
  totalBar: { flex: 1, height: 8, borderRadius: 4, overflow: "hidden" },
  metricBox: { marginTop: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, overflow: "hidden" },
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  metricSide: { width: 78 },
  metricLabel: { flex: 1, textAlign: "center", fontSize: 12, fontWeight: "600" },
  cmpProsCons: { flexDirection: "row", marginTop: 12 },
  cmpDivider: { width: StyleSheet.hairlineWidth },
  pcRow: { flexDirection: "row", gap: 6, marginBottom: 4 },
  pcText: { flex: 1, fontSize: 12, lineHeight: 16 },
  verdict: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  verdictText: { flex: 1, fontSize: 13, lineHeight: 18 },

  // Watch plan
  session: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, marginBottom: 8, overflow: "hidden" },
  sessionHead: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10 },
  sessionNum: { width: 26, height: 26, borderRadius: 13, justifyContent: "center", alignItems: "center" },
  sessionNumText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  sessionLabel: { fontSize: 13, fontWeight: "700" },
  runtimePill: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  runtimeText: { fontSize: 11, fontWeight: "600" },
  runtimeTag: { fontSize: 10, marginTop: 3 },
  sessionNote: { fontSize: 12, lineHeight: 17, marginTop: 8, fontStyle: "italic" },

  // Watchlist
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 6, marginTop: 2 },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionName: { fontSize: 13, fontWeight: "800" },
  wlRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  wlMain: { flex: 1 },
  wlTitleRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  wlTitle: { flexShrink: 1, fontSize: 13.5, fontWeight: "800", letterSpacing: -0.15 },
  wlMeta: { fontSize: 11, marginTop: 2 },
  wlNote: { fontSize: 11.5, lineHeight: 16, marginTop: 3 },
  mustBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },

  // Spotlight
  banner: { height: 138, width: "100%", backgroundColor: "rgba(0,0,0,0.2)" },
  bannerTag: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  bannerTagText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  spotHead: { flexDirection: "row", gap: 12 },
  spotPoster: { width: 90, height: 135, borderRadius: 11, overflow: "hidden", borderWidth: 3, justifyContent: "center", alignItems: "center" },
  spotPosterRaised: { marginTop: -58 },
  spotTitle: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3, lineHeight: 23 },
  tagline: { fontSize: 11.5, fontStyle: "italic", marginTop: 3, lineHeight: 15 },
  spotMetaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 5, marginTop: 6 },
  takeBox: { flexDirection: "row", gap: 8, marginTop: 12, padding: 10, borderRadius: 12, borderWidth: 1 },
  takeText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: "600" },
  spotSummary: { fontSize: 12.5, lineHeight: 19, marginTop: 10 },
  spotLine: { fontSize: 12, lineHeight: 18, marginTop: 6 },
  spotActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 },
  detailBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  detailBtnText: { fontSize: 12, fontWeight: "800" },
  subHead: { fontSize: 13, fontWeight: "800", marginBottom: 8 },

  // General
  generalText: { fontSize: 14, lineHeight: 21 },

  // Error
  errBubble: {
    maxWidth: "88%",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 18,
    borderBottomLeftRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
});

export default ChatBubble;
