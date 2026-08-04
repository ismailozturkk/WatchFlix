// components/AICineCards.js
//
// CineMatch Pro — yapılandırılmış AI cevaplarının zengin görsel kartları.
// Her response "type" için ayrı bir kart; ChatBubble type'a göre doğru kartı seçer.
//
// Tüm renkler tema context'inden gelir; posterler TMDB'den çözülmüş posterMap'ten.

import React, { memo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import Reanimated, { FadeInUp } from "react-native-reanimated";

import { alpha } from "../theme/colors";
import { posterKey, safeArr, safeNum, toStr, normMediaType } from "../services/aiCineService";
import { i18nText } from "../utils/i18nText";

// ── Yardımcılar ───────────────────────────────────────────────────────────────

const ratingColor = (r) => {
  if (r >= 8) return "#29b864";
  if (r >= 6) return "#f5c518";
  if (r >= 4) return "#ff6400";
  return "#e33";
};

const getPoster = (posterMap, mediaType, title) =>
  (posterMap || {})[posterKey(mediaType, title)] || null;

const typeMeta = {
  recommendations: { icon: "sparkles", key: "recommendations" },
  comparison: { icon: "git-compare-outline", key: "comparison" },
  watch_plan: { icon: "calendar-outline", key: "watch_plan" },
  watchlist: { icon: "list-outline", key: "watchlist" },
  title_spotlight: { icon: "film-outline", key: "title_spotlight" },
  general: { icon: "chatbubble-ellipses-outline", key: "general" },
};

// ── Atomlar ───────────────────────────────────────────────────────────────────

const Stars = memo(({ score, color, size = 12 }) => {
  const n = Math.round(safeNum(score));
  return (
    <View style={{ flexDirection: "row" }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Ionicons
          key={i}
          name={i < n ? "star" : "star-outline"}
          size={size}
          color={i < n ? color : alpha(color, 0.35)}
          style={{ marginHorizontal: 0.5 }}
        />
      ))}
    </View>
  );
});

const responseTypeLabel = (type, t) => {
  const fallback = {
    recommendations: "Sana Özel Öneriler",
    comparison: "Karşılaştırma",
    watch_plan: "İzleme Planı",
    watchlist: "İzleme Listesi",
    title_spotlight: "Yapım Detayı",
  };
  return t?.AICineChat?.responseTypes?.[type] || fallback[type] || "CineMatch";
};

const metricLabel = (metric, t) => {
  const key = toStr(metric?.key).toLowerCase();
  return t?.AICineChat?.metrics?.[key] || toStr(metric?.label || key);
};

const sectionLabel = (section, t) => {
  const key = toStr(section?.key).toLowerCase();
  return t?.AICineChat?.sections?.[key] || toStr(section?.name || key);
};

const formatRuntime = (minutes, t) => {
  const value = Math.round(safeNum(minutes));
  return value ? `${value} ${t?.AICineChat?.minutesShort || "dk"}` : "";
};

const CardHero = memo(({ type, theme, t }) => {
  const meta = typeMeta[type] || typeMeta.general;
  return (
    <LinearGradient
      colors={[theme.accent, theme.bold]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={s.hero}
    >
      <View style={s.heroIcon}>
        <Ionicons name={meta.icon} size={20} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.heroTitle} numberOfLines={1}>{responseTypeLabel(type, t)}</Text>
      </View>
    </LinearGradient>
  );
});

/** Poster küçük resmi + başlık; bulunamazsa "ara" çipi. */
const PosterThumb = memo(
  ({ item, posterMap, getTmdbUrl, theme, t, onTitlePress, width = 70, showMeta = true }) => {
    const mediaType = normMediaType(item?.mediaType);
    const title = toStr(item?.title);
    const pcard = getPoster(posterMap, mediaType, title);
    const found = !!pcard?.found;
    const typeLabel = mediaType === "movie" ? t?.AICineChat?.movie : t?.AICineChat?.series;
    const typeColor = mediaType === "movie" ? theme.notesColor.blue : theme.notesColor.green;
    const uri = found && pcard.posterPath ? getTmdbUrl(pcard.posterPath, "poster", 154) : null;
    const rating = safeNum(pcard?.rating);

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => onTitlePress(pcard || { mediaType, query: title, found: false })}
        style={{ width }}
      >
        <View style={[s.posterWrap, { width, height: width * 1.5, backgroundColor: theme.between }]}>
          {uri ? (
            <Image source={{ uri }} style={s.posterImg} contentFit="cover" />
          ) : (
            <View style={s.posterFallback}>
              <Ionicons
                name={mediaType === "movie" ? "film-outline" : "tv-outline"}
                size={22}
                color={theme.text.muted}
              />
              {!found && <Ionicons name="search" size={12} color={theme.text.muted} style={{ marginTop: 4 }} />}
            </View>
          )}
          {found && rating > 0 && (
            <View style={[s.posterBadge, { backgroundColor: alpha(ratingColor(rating), 0.92) }]}>
              <Text style={s.posterBadgeText}>★ {rating.toFixed(1)}</Text>
            </View>
          )}
          <View style={[s.posterType, { backgroundColor: alpha(theme.primary, 0.8) }]}>
            <Text style={{ color: typeColor, fontSize: 8, fontWeight: "800" }}>{typeLabel}</Text>
          </View>
        </View>
        <Text numberOfLines={2} style={[s.posterTitle, { color: theme.text.primary }]}>
          {found ? pcard.title : title}
        </Text>
        {showMeta && found && !!pcard.year && (
          <Text style={[s.posterYear, { color: theme.text.muted }]}>{pcard.year}</Text>
        )}
      </TouchableOpacity>
    );
  },
);

// ── 1) Recommendations ────────────────────────────────────────────────────────

const RecommendationsCard = ({ data, posterMap, getTmdbUrl, theme, t, onTitlePress }) => {
  const items = safeArr(data.items);
  return (
    <View style={[s.card, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      <CardHero type="recommendations" theme={theme} t={t} />
      <View style={s.body}>
        {items.map((it, i) => {
          const mediaType = normMediaType(it?.mediaType);
          const pcard = getPoster(posterMap, mediaType, toStr(it?.title));
          const year = toStr(pcard?.year || it?.year);
          const rating = safeNum(pcard?.rating || it?.rating);
          const reason = toStr(it?.reason || it?.why || it?.hook);
          return (
            <View
              key={i}
              style={[s.recRow, { borderColor: theme.border }, i === items.length - 1 && { borderBottomWidth: 0 }]}
            >
              <PosterThumb
                item={it}
                posterMap={posterMap}
                getTmdbUrl={getTmdbUrl}
                theme={theme}
                t={t}
                onTitlePress={onTitlePress}
                width={62}
                showMeta={false}
              />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={s.recMetaRow}>
                  {!!year && <Text style={[s.metaChipTxt, { color: theme.text.muted }]}>{year}</Text>}
                  {rating > 0 && (
                    <Text style={[s.metaChipTxt, { color: ratingColor(rating), fontWeight: "800" }]}>
                      · ★ {rating.toFixed(1)}
                    </Text>
                  )}
                </View>
                {!!reason && (
                  <Text style={[s.recWhy, { color: theme.text.secondary }]}>{reason}</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

// ── 2) Comparison ─────────────────────────────────────────────────────────────

const ProsCons = ({ title, items, color, icon, theme }) => {
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

const ComparisonCard = ({ data, posterMap, getTmdbUrl, theme, t, onTitlePress }) => {
  const metrics = safeArr(data.metrics);
  const green = theme.colors.green;
  const red = theme.colors.red;
  return (
    <View style={[s.card, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      <CardHero type="comparison" theme={theme} t={t} />
      <View style={s.body}>
        {/* İki taraf posterleri */}
        <View style={s.cmpHeads}>
          <View style={s.cmpHead}>
            <PosterThumb
              item={data.left}
              posterMap={posterMap}
              getTmdbUrl={getTmdbUrl}
              theme={theme}
              t={t}
              onTitlePress={onTitlePress}
              width={78}
              showMeta={false}
            />
          </View>
          <View style={[s.vsBadge, { backgroundColor: theme.bold }]}>
            <Text style={s.vsText}>VS</Text>
          </View>
          <View style={s.cmpHead}>
            <PosterThumb
              item={data.right}
              posterMap={posterMap}
              getTmdbUrl={getTmdbUrl}
              theme={theme}
              t={t}
              onTitlePress={onTitlePress}
              width={78}
              showMeta={false}
            />
          </View>
        </View>

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

const PlanSession = ({ session, idx, posterMap, getTmdbUrl, theme, t, onTitlePress }) => {
  const [open, setOpen] = useState(idx === 0);
  const items = safeArr(session?.items);
  return (
    <View style={[s.session, { borderColor: theme.border, backgroundColor: theme.primary }]}>
      <TouchableOpacity style={s.sessionHead} activeOpacity={0.7} onPress={() => setOpen((o) => !o)}>
        <View style={[s.sessionNum, { backgroundColor: theme.bold }]}>
          <Text style={s.sessionNumText}>{idx + 1}</Text>
        </View>
        <Text style={[s.sessionLabel, { color: theme.text.primary }]} numberOfLines={2}>
          {toStr(session?.label)}
        </Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={theme.text.muted} />
      </TouchableOpacity>
      {open && (
        <View style={{ paddingHorizontal: 10, paddingBottom: 10 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {items.map((it, i) => (
              <View key={i} style={{ marginRight: 10, alignItems: "center" }}>
                <PosterThumb
                  item={it}
                  posterMap={posterMap}
                  getTmdbUrl={getTmdbUrl}
                  theme={theme}
                  t={t}
                  onTitlePress={onTitlePress}
                  width={64}
                  showMeta={false}
                />
                {!!toStr(it?.runtime) && (
                  <Text style={[s.runtimeTag, { color: theme.text.muted }]}>{toStr(it.runtime)}</Text>
                )}
              </View>
            ))}
          </ScrollView>
          {!!toStr(session?.note) && (
            <Text style={[s.sessionNote, { color: theme.text.secondary }]}>{toStr(session.note)}</Text>
          )}
        </View>
      )}
    </View>
  );
};

const WatchPlanCard = ({ data, posterMap, getTmdbUrl, theme, t, onTitlePress }) => {
  const sessions = safeArr(data.sessions);
  return (
    <View style={[s.card, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      <CardHero type="watch_plan" theme={theme} t={t} />
      <View style={s.body}>
        {sessions.map((ses, i) => (
          <PlanSession
            key={i}
            session={ses}
            idx={i}
            posterMap={posterMap}
            getTmdbUrl={getTmdbUrl}
            theme={theme}
            t={t}
            onTitlePress={onTitlePress}
          />
        ))}
      </View>
    </View>
  );
};

// ── 4) Watchlist (checklist) ──────────────────────────────────────────────────

const WatchlistItem = ({ item, posterMap, getTmdbUrl, theme, t, onTitlePress }) => {
  const [checked, setChecked] = useState(false);
  const mediaType = normMediaType(item?.mediaType);
  const title = toStr(item?.title);
  const pcard = getPoster(posterMap, mediaType, title);
  const found = !!pcard?.found;
  const uri = found && pcard.posterPath ? getTmdbUrl(pcard.posterPath, "poster", 92) : null;

  return (
    <View style={[s.wlRow, { borderColor: theme.border }]}>
      <TouchableOpacity onPress={() => setChecked((c) => !c)} hitSlop={8} style={s.checkbox}>
        <Ionicons
          name={checked ? "checkbox" : "square-outline"}
          size={22}
          color={checked ? theme.colors.green : theme.text.muted}
        />
      </TouchableOpacity>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => onTitlePress(pcard || { mediaType, query: title, found: false })}
        style={s.wlMain}
      >
        <View style={[s.wlPoster, { backgroundColor: theme.between }]}>
          {uri ? (
            <Image source={{ uri }} style={s.posterImg} contentFit="cover" />
          ) : (
            <Ionicons
              name={mediaType === "movie" ? "film-outline" : "tv-outline"}
              size={16}
              color={theme.text.muted}
            />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={1}
            style={[
              s.wlTitle,
              { color: theme.text.primary },
              checked && { textDecorationLine: "line-through", color: theme.text.muted },
            ]}
          >
            {found ? pcard.title : title}
          </Text>
          {!!toStr(item?.reason || item?.note) && (
            <Text numberOfLines={2} style={[s.wlNote, { color: theme.text.secondary }]}>
              {toStr(item.reason || item.note)}
            </Text>
          )}
        </View>
        {item?.mustWatch && (
          <View style={[s.mustBadge, { backgroundColor: alpha(theme.colors.orange, 0.2) }]}>
            <Text style={{ color: theme.colors.orange, fontSize: 9, fontWeight: "800" }}>
              {t?.AICineChat?.mustWatch || "Mutlaka"}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const WatchlistCard = ({ data, posterMap, getTmdbUrl, theme, t, onTitlePress }) => {
  const sections = safeArr(data.sections);
  return (
    <View style={[s.card, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      <CardHero type="watchlist" theme={theme} t={t} />
      <View style={s.body}>
        {sections.map((sec, i) => (
          <View key={i} style={{ marginBottom: 10 }}>
            {!!sectionLabel(sec, t) && (
              <View style={s.sectionHead}>
                <View style={[s.sectionDot, { backgroundColor: theme.bold }]} />
                <Text style={[s.sectionName, { color: theme.text.primary }]}>{sectionLabel(sec, t)}</Text>
              </View>
            )}
            {safeArr(sec?.items).map((it, j) => (
              <WatchlistItem
                key={j}
                item={it}
                posterMap={posterMap}
                getTmdbUrl={getTmdbUrl}
                theme={theme}
                t={t}
                onTitlePress={onTitlePress}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
};

// ── 5) Title spotlight ────────────────────────────────────────────────────────

const Chip = ({ icon, label, theme }) => (
  <View style={[s.chip, { backgroundColor: theme.between, borderColor: theme.border }]}>
    {!!icon && <Ionicons name={icon} size={12} color={theme.text.between} />}
    <Text style={[s.chipText, { color: theme.text.secondary }]} numberOfLines={1}>
      {label}
    </Text>
  </View>
);

const TitleSpotlightCard = ({ data, posterMap, getTmdbUrl, theme, t, onTitlePress }) => {
  const mediaType = normMediaType(data.mediaType);
  const pcard = getPoster(posterMap, mediaType, toStr(data.title));
  const found = !!pcard?.found;
  const uri = found && pcard.posterPath ? getTmdbUrl(pcard.posterPath, "poster", 185) : null;
  const rating = safeNum(pcard?.rating) || safeNum(data.rating);
  const genres = safeArr(pcard?.genres || data.genres).map(toStr).filter(Boolean);
  const cast = safeArr(pcard?.cast || data.cast).map(toStr).filter(Boolean);
  const where = safeArr(pcard?.providers || data.whereToWatch).map(toStr).filter(Boolean);
  const similar = safeArr(pcard?.similar || data.similar);
  const displayTitle = toStr(pcard?.title || data.title);
  const displayYear = toStr(pcard?.year || data.year);
  const runtime = formatRuntime(pcard?.runtimeMinutes, t) || toStr(data.runtime);
  const summary = toStr(data.take || pcard?.overview || data.summary);
  const director = toStr(pcard?.director || data.director);

  return (
    <View style={[s.card, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      <CardHero type="title_spotlight" theme={theme} t={t} />
      <View style={s.body}>
        <View style={s.spotHead}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => onTitlePress(pcard || { mediaType, query: toStr(data.title), found: false })}
            style={[s.spotPoster, { backgroundColor: theme.between, borderColor: theme.secondary }]}
          >
            {uri ? (
              <Image source={{ uri }} style={s.posterImg} contentFit="cover" />
            ) : (
              <Ionicons
                name={mediaType === "movie" ? "film-outline" : "tv-outline"}
                size={28}
                color={theme.text.muted}
              />
            )}
          </TouchableOpacity>
          <View style={{ flex: 1, paddingTop: 36 }}>
            <Text style={[s.spotTitle, { color: theme.text.primary }]} numberOfLines={2}>
              {displayTitle}
            </Text>
            <View style={s.spotMetaRow}>
              {!!displayYear && <Chip icon="calendar-outline" label={displayYear} theme={theme} />}
              {!!runtime && <Chip icon="time-outline" label={runtime} theme={theme} />}
              {rating > 0 && (
                <View style={[s.chip, { backgroundColor: alpha(ratingColor(rating), 0.18), borderColor: alpha(ratingColor(rating), 0.5) }]}>
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

        {!!summary && (
          <Text style={[s.spotSummary, { color: theme.text.secondary }]}>{summary}</Text>
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
            <Text style={[s.spotLine, { color: theme.text.muted, marginRight: 4 }]}>
              {t?.AICineChat?.whereToWatch || "Nerede izlenir"}:
            </Text>
            {where.map((w, i) => (
              <Chip key={i} icon="tv-outline" label={w} theme={theme} />
            ))}
          </View>
        )}

        {similar.length > 0 && (
          <View style={{ marginTop: 12 }}>
            <Text style={[s.subHead, { color: theme.text.primary }]}>
              {t?.AICineChat?.similar || i18nText("autoI18n.benzer_yapimlar", "Benzer yapımlar")}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {similar.map((it, i) => (
                <View key={i} style={{ marginRight: 10 }}>
                  <PosterThumb
                    item={it}
                    posterMap={posterMap}
                    getTmdbUrl={getTmdbUrl}
                    theme={theme}
                    t={t}
                    onTitlePress={onTitlePress}
                    width={64}
                    showMeta={false}
                  />
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

const GeneralCard = ({ data, posterMap, getTmdbUrl, theme, t, onTitlePress }) => {
  const items = safeArr(data.items);
  return (
    <View style={[s.card, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      <View style={s.body}>
        {!!toStr(data.content || data.summary) && (
          <Text style={[s.generalText, { color: theme.text.secondary }]}>
            {toStr(data.content || data.summary)}
          </Text>
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
                <PosterThumb
                  item={it}
                  posterMap={posterMap}
                  getTmdbUrl={getTmdbUrl}
                  theme={theme}
                  t={t}
                  onTitlePress={onTitlePress}
                  width={64}
                  showMeta={false}
                />
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
const UserAttachment = memo(({ attachment, theme, t, getTmdbUrl, onTitlePress }) => {
  const mediaType = normMediaType(attachment?.mediaType);
  const title = toStr(attachment?.title);
  if (!title) return null;

  const year = toStr(attachment?.year);
  const rating = safeNum(attachment?.rating);
  const posterPath = toStr(attachment?.posterPath);
  const uri = posterPath && getTmdbUrl ? getTmdbUrl(posterPath, "poster", 185) : null;
  const typeLabel =
    mediaType === "movie"
      ? t?.AICineChat?.movie || i18nText("autoI18n.film", "Film")
      : t?.AICineChat?.series || i18nText("autoI18n.dizi", "Dizi");
  const meta = [typeLabel, year].filter(Boolean).join(" · ");
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
          <Image source={{ uri }} style={s.posterImg} contentFit="cover" />
        ) : (
          <Ionicons
            name={mediaType === "movie" ? "film-outline" : "tv-outline"}
            size={18}
            color="rgba(255,255,255,0.75)"
          />
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
      {pressable && (
        <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
      )}
    </TouchableOpacity>
  );
});

const UserBubble = memo(({ text, attachment, theme, t, getTmdbUrl, onTitlePress }) => (
  <Reanimated.View entering={FadeInUp.duration(200)} style={[s.row, { justifyContent: "flex-end" }]}>
    <View
      style={[
        s.userBubble,
        { backgroundColor: theme.accent },
        attachment?.title && s.userBubbleWithAttachment,
      ]}
    >
      {!!attachment?.title && (
        <UserAttachment
          attachment={attachment}
          theme={theme}
          t={t}
          getTmdbUrl={getTmdbUrl}
          onTitlePress={onTitlePress}
        />
      )}
      {!!text && (
        <Text selectable style={{ color: "#fff", fontSize: 14, lineHeight: 20 }}>
          {text}
        </Text>
      )}
    </View>
  </Reanimated.View>
));

const ErrorBubble = memo(({ text, retry, onRetry, theme, t }) => (
  <Reanimated.View entering={FadeInUp.duration(200)} style={[s.row, { justifyContent: "flex-start" }]}>
    <View
      style={[
        s.errBubble,
        { backgroundColor: theme.notesColor.redBackground, borderColor: alpha(theme.colors.red, 0.34) },
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons name="alert-circle" size={16} color={theme.colors.red} />
        <Text style={{ color: theme.text.primary, fontSize: 13, flex: 1 }}>{text}</Text>
      </View>
      {!!retry && (
        <TouchableOpacity onPress={() => onRetry(retry)} style={[s.retryBtn, { borderColor: alpha(theme.colors.red, 0.4) }]}>
          <Ionicons name="refresh" size={13} color={theme.colors.red} />
          <Text style={{ color: theme.colors.red, fontSize: 12, fontWeight: "700" }}>
            {t?.AICineChat?.retry || "Tekrar dene"}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  </Reanimated.View>
));

/**
 * Mesajı role/type'a göre doğru bileşene yönlendirir.
 * msg: { id, role, text?, display?, attachment?, aiResponse?, posterMap?, status?, retry? }
 */
export const ChatBubble = memo(({ msg, theme, t, getTmdbUrl, onTitlePress, onRetry }) => {
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
    return <ErrorBubble text={msg.text} retry={msg.retry} onRetry={onRetry} theme={theme} t={t} />;
  }
  const data = msg.aiResponse;
  if (!data) return null;
  const Card = CARD_BY_TYPE[data.type] || GeneralCard;

  return (
    <Reanimated.View entering={FadeInUp.duration(220)} style={[s.row, { justifyContent: "flex-start" }]}>
      <View style={{ width: "100%" }}>
        <Card
          data={data}
          posterMap={msg.posterMap}
          getTmdbUrl={getTmdbUrl}
          theme={theme}
          t={t}
          onTitlePress={onTitlePress}
        />
      </View>
    </Reanimated.View>
  );
});

// ── Stiller ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  row: { width: "100%", marginBottom: 12, flexDirection: "row" },

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

  // Kart kabuğu
  card: {
    width: "100%",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  body: { padding: 12 },

  // Hero
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  heroIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
  },
  heroTitle: { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: -0.2 },

  // Poster
  posterWrap: { borderRadius: 10, overflow: "hidden", position: "relative" },
  posterImg: { width: "100%", height: "100%" },
  posterFallback: { width: "100%", height: "100%", justifyContent: "center", alignItems: "center" },
  posterBadge: { position: "absolute", top: 4, right: 4, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 6 },
  posterBadgeText: { color: "#fff", fontSize: 8, fontWeight: "800" },
  posterType: { position: "absolute", bottom: 4, left: 4, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 5 },
  posterTitle: { fontSize: 11, fontWeight: "600", marginTop: 4, lineHeight: 14 },
  posterYear: { fontSize: 10, marginTop: 1 },

  // Recommendations
  recRow: { flexDirection: "row", paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  recMetaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 3, marginBottom: 3 },
  metaChipTxt: { fontSize: 11, fontWeight: "600" },
  recWhy: { fontSize: 12, lineHeight: 17, marginTop: 2 },

  // Comparison
  cmpHeads: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cmpHead: { flex: 1, alignItems: "center" },
  vsBadge: { width: 34, height: 34, borderRadius: 17, justifyContent: "center", alignItems: "center", marginHorizontal: 6 },
  vsText: { color: "#fff", fontWeight: "900", fontSize: 12 },
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
  sessionNum: { width: 24, height: 24, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  sessionNumText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  sessionLabel: { flex: 1, fontSize: 13, fontWeight: "700" },
  runtimeTag: { fontSize: 10, marginTop: 3 },
  sessionNote: { fontSize: 12, lineHeight: 17, marginTop: 8, fontStyle: "italic" },

  // Watchlist
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 6, marginTop: 2 },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionName: { fontSize: 13, fontWeight: "800" },
  wlRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  checkbox: { paddingRight: 8 },
  wlMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  wlPoster: { width: 34, height: 50, borderRadius: 6, overflow: "hidden", justifyContent: "center", alignItems: "center" },
  wlTitle: { fontSize: 13, fontWeight: "700" },
  wlNote: { fontSize: 11, lineHeight: 15, marginTop: 1 },
  mustBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 6 },

  // Spotlight
  spotHead: { flexDirection: "row", gap: 12 },
  spotPoster: { width: 86, height: 129, borderRadius: 10, overflow: "hidden", borderWidth: 3, justifyContent: "center", alignItems: "center" },
  spotTitle: { fontSize: 17, fontWeight: "800", letterSpacing: -0.3 },
  spotMetaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 5, marginTop: 6 },
  spotSummary: { fontSize: 13, lineHeight: 19, marginTop: 12 },
  spotLine: { fontSize: 12, lineHeight: 18, marginTop: 6 },
  subHead: { fontSize: 13, fontWeight: "800", marginBottom: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: { fontSize: 11, fontWeight: "600", maxWidth: 130 },

  // General
  generalText: { fontSize: 14, lineHeight: 21 },

  // Error
  errBubble: { maxWidth: "88%", paddingHorizontal: 12, paddingVertical: 9, borderRadius: 18, borderBottomLeftRadius: 5, borderWidth: StyleSheet.hairlineWidth },
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
