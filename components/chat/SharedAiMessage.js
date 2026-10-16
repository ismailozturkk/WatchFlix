// components/chat/SharedAiMessage.js
//
// Sohbette/grupta paylaşılan CineMatch (AI) cevabı balonunun gövdesi (mesaj
// kind: "aiShare", bkz. utils/chatShare.js). Alıcı cevabı AI hakkı HARCAMADAN,
// bağlamıyla (sorulan soru) görür; bulunan yapımlara basınca detay açılır.
//
// Görünüm: sparkles karolu "CINEMATCH" başlığı + cevap türü; kullanıcının sorusu
// alıntı olarak; gövde türe göre —
//   • öneri / liste / plan / genel  → bölümlü satırlar (afiş + ad + not), ilk
//                                     dördü açık, kalanı "Tümünü gör" ile
//   • karşılaştırma                 → iki afiş yan yana + VS rozeti
//   • karar / görüş / genel metin   → özet kutusu ("Devamını oku" ile açılır)
//
// Metin sabitleri tek yerden (çeviri paketi `AICineChat`) gelir; böylece alıcı
// cevabın türünü / bölüm adlarını KENDİ dilinde görür (içerik — başlık, neden —
// gönderenin dilinde kalır, çünkü modelin ürettiği metindir).

import React, { memo, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { i18nText } from "../../utils/i18nText";
import { MEDIA_TYPE_COLOR, PosterEdge, easeLayout, sharePalette } from "./shareKit";

const COLLAPSED_PICKS = 4;
const SUMMARY_FOLD_CHARS = 220;
const ROW_POSTER_W = 46;

const VARIANT_FALLBACK = {
  recommendations: "Sana Özel Öneriler",
  comparison: "Karşılaştırma",
  watch_plan: "İzleme Planı",
  watchlist: "İzleme Listesi",
  title_spotlight: "Yapım Detayı",
};

const typeWord = (mediaType, t) =>
  mediaType === "tv"
    ? t?.AICineChat?.series || i18nText("autoI18n.dizi", "Dizi")
    : t?.AICineChat?.movie || i18nText("autoI18n.film", "Film");

function Poster({ pick, width, radius, getTmdbUrl, palette }) {
  return (
    <View
      style={[
        styles.poster,
        {
          width,
          height: Math.round(width * 1.5),
          borderRadius: radius,
          backgroundColor: palette.posterBg,
        },
      ]}
    >
      {pick.poster_path ? (
        <Image
          source={{ uri: getTmdbUrl(pick.poster_path, "poster", Math.max(154, width * 2)) }}
          style={styles.fill}
          cachePolicy="memory-disk"
          transition={120}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.fill, styles.center]}>
          <Ionicons
            name={pick.media_type === "tv" ? "tv-outline" : "film-outline"}
            size={width > 60 ? 24 : 16}
            color={palette.muted}
          />
        </View>
      )}
      <PosterEdge radius={radius} color={palette.posterEdge} />
    </View>
  );
}

function PickRow({ pick, palette, getTmdbUrl, t, onOpen, last }) {
  const openable = pick.id != null && typeof onOpen === "function";
  const color = MEDIA_TYPE_COLOR[pick.media_type] || MEDIA_TYPE_COLOR.movie;
  const meta = [typeWord(pick.media_type, t), pick.year].filter(Boolean).join(" · ");
  const Wrapper = openable ? TouchableOpacity : View;
  return (
    <Wrapper
      {...(openable
        ? {
            activeOpacity: 0.8,
            onPress: () => onOpen(pick),
            accessibilityRole: "button",
            accessibilityLabel: pick.title,
          }
        : {})}
      style={[styles.row, { borderColor: palette.divider }, last && styles.rowLast]}
    >
      <Poster pick={pick} width={ROW_POSTER_W} radius={9} getTmdbUrl={getTmdbUrl} palette={palette} />
      <View style={styles.rowCopy}>
        <View style={styles.rowTitleLine}>
          <Text style={[styles.rowTitle, { color: palette.primary }]} numberOfLines={2}>
            {pick.title}
          </Text>
          {pick.must ? (
            <View style={[styles.must, { backgroundColor: palette.tile }]}>
              <Text allowFontScaling={false} style={[styles.mustText, { color: palette.tileInk }]}>
                {t?.AICineChat?.mustWatch || "Mutlaka"}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.metaLine}>
          <View style={[styles.typeDot, { backgroundColor: color }]} />
          <Text style={[styles.rowMeta, { color: palette.muted }]} numberOfLines={1}>
            {meta}
          </Text>
          {pick.rating ? (
            <>
              <Ionicons name="star" size={10} color="#FFD54F" style={styles.star} />
              <Text allowFontScaling={false} style={[styles.rowMeta, { color: palette.secondary }]}>
                {pick.rating.toFixed(1)}
              </Text>
            </>
          ) : null}
        </View>
        {!!pick.note && (
          <Text style={[styles.note, { color: palette.secondary }]} numberOfLines={3}>
            {pick.note}
          </Text>
        )}
      </View>
      {openable ? <Ionicons name="chevron-forward" size={14} color={palette.muted} /> : null}
    </Wrapper>
  );
}

function VersusPick({ pick, palette, getTmdbUrl, t, onOpen }) {
  const openable = pick.id != null && typeof onOpen === "function";
  const Wrapper = openable ? TouchableOpacity : View;
  return (
    <Wrapper
      {...(openable
        ? { activeOpacity: 0.8, onPress: () => onOpen(pick), accessibilityRole: "button" }
        : {})}
      style={styles.versusPick}
    >
      <Poster pick={pick} width={88} radius={12} getTmdbUrl={getTmdbUrl} palette={palette} />
      <Text style={[styles.versusTitle, { color: palette.primary }]} numberOfLines={2}>
        {pick.title}
      </Text>
      <Text style={[styles.versusMeta, { color: palette.muted }]} numberOfLines={1}>
        {[typeWord(pick.media_type, t), pick.year].filter(Boolean).join(" · ")}
      </Text>
    </Wrapper>
  );
}

function FoldText({ text, palette, style, lines }) {
  const [open, setOpen] = useState(false);
  const foldable = text.length > SUMMARY_FOLD_CHARS;
  return (
    <View>
      <Text style={[style, { color: palette.primary }]} numberOfLines={open || !foldable ? undefined : lines}>
        {text}
      </Text>
      {foldable && (
        <TouchableOpacity
          activeOpacity={0.7}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 12 }}
          onPress={() => {
            easeLayout();
            setOpen((value) => !value);
          }}
          accessibilityRole="button"
        >
          <Text allowFontScaling={false} style={[styles.foldLink, { color: palette.tileInk }]}>
            {open ? i18nText("autoI18n.daha_az", "Daha az") : i18nText("autoI18n.devamini_oku", "Devamını oku")}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function SharedAiMessage({ share, isOutgoing = false, accent: propAccent, getTmdbUrl, onOpenItem }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const accent = propAccent || theme.accent || "#6C63FF";
  const palette = useMemo(() => sharePalette({ theme, isOutgoing, accent }), [theme, isOutgoing, accent]);
  const [expanded, setExpanded] = useState(false);

  const sections = share?.sections || [];
  const picksTotal = useMemo(
    () => sections.reduce((n, section) => n + section.picks.length, 0),
    [sections],
  );
  const canFold = !share?.versus && picksTotal > COLLAPSED_PICKS;

  // Katlıyken ilk dört öğe bölümler boyunca sayılır; öğesi kalmayan bölüm gizlenir.
  const visible = useMemo(() => {
    if (!canFold || expanded) return sections;
    let budget = COLLAPSED_PICKS;
    const out = [];
    sections.forEach((section) => {
      if (budget <= 0) return;
      const picks = section.picks.slice(0, budget);
      budget -= picks.length;
      out.push({ ...section, picks });
    });
    return out;
  }, [sections, canFold, expanded]);

  const variant = share?.variant || "general";
  const variantLabel =
    t?.AICineChat?.responseTypes?.[variant] || VARIANT_FALLBACK[variant] || "";
  const isGeneral = variant === "general";
  const hasSummary = !!share?.summary;

  const sectionLabel = (section) =>
    (section.labelKey && t?.AICineChat?.sections?.[section.labelKey]) ||
    section.label ||
    section.labelKey ||
    "";

  const summaryNode = hasSummary ? (
    isGeneral ? (
      <View style={sections.length ? styles.summaryTop : null}>
        <FoldText text={share.summary} palette={palette} style={styles.summaryPlain} lines={8} />
      </View>
    ) : (
      <View
        style={[
          styles.summaryBox,
          { backgroundColor: palette.surface, borderColor: palette.surfaceBorder },
        ]}
      >
        <Ionicons name="bulb-outline" size={15} color={palette.tileInk} style={styles.summaryIcon} />
        <View style={styles.summaryCopy}>
          <FoldText text={share.summary} palette={palette} style={styles.summaryText} lines={5} />
        </View>
      </View>
    )
  ) : null;

  return (
    <View style={styles.wrap}>
      {/* Başlık */}
      <View style={styles.header}>
        <View style={[styles.headerTile, { backgroundColor: palette.tile }]}>
          <Ionicons name="sparkles" size={15} color={palette.tileInk} />
        </View>
        <View style={styles.headerCopy}>
          <Text
            allowFontScaling={false}
            style={[styles.kicker, { color: palette.tileInk }]}
            numberOfLines={1}
          >
            CineMatch
          </Text>
          {!!variantLabel && (
            <Text style={[styles.title, { color: palette.primary }]} numberOfLines={1}>
              {variantLabel}
            </Text>
          )}
        </View>
      </View>

      {/* Sorulan soru */}
      {!!share?.question && (
        <View style={styles.questionLine}>
          <View style={[styles.questionBar, { backgroundColor: palette.ghostBorder }]} />
          <Text style={[styles.question, { color: palette.secondary }]} numberOfLines={3}>
            {share.question}
          </Text>
        </View>
      )}

      {/* Genel cevapta metin önce gelir */}
      {isGeneral ? summaryNode : null}

      {/* Karşılaştırma: yan yana */}
      {share?.versus ? (
        <View style={styles.versus}>
          <VersusPick
            pick={sections[0].picks[0]}
            palette={palette}
            getTmdbUrl={getTmdbUrl}
            t={t}
            onOpen={onOpenItem}
          />
          <View style={[styles.vsBadge, { backgroundColor: palette.buttonBg }]}>
            <Text allowFontScaling={false} style={[styles.vsText, { color: palette.buttonInk }]}>
              VS
            </Text>
          </View>
          <VersusPick
            pick={sections[0].picks[1]}
            palette={palette}
            getTmdbUrl={getTmdbUrl}
            t={t}
            onOpen={onOpenItem}
          />
        </View>
      ) : (
        visible.map((section, sIndex) => {
          const label = sectionLabel(section);
          return (
            <View key={`${label}-${sIndex}`} style={styles.section}>
              {!!label && (
                <View style={styles.sectionHead}>
                  <View style={[styles.sectionDot, { backgroundColor: palette.tileInk }]} />
                  <Text style={[styles.sectionName, { color: palette.primary }]} numberOfLines={1}>
                    {label}
                  </Text>
                </View>
              )}
              {!!section.note && (
                <Text style={[styles.sectionNote, { color: palette.muted }]} numberOfLines={3}>
                  {section.note}
                </Text>
              )}
              {section.picks.map((pick, pIndex) => (
                <PickRow
                  key={`${pick.media_type}-${pick.id ?? pick.title}-${pIndex}`}
                  pick={pick}
                  palette={palette}
                  getTmdbUrl={getTmdbUrl}
                  t={t}
                  onOpen={onOpenItem}
                  last={pIndex === section.picks.length - 1}
                />
              ))}
            </View>
          );
        })
      )}

      {canFold && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            easeLayout();
            setExpanded((value) => !value);
          }}
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          style={[styles.foldButton, { backgroundColor: palette.ghostBg, borderColor: palette.ghostBorder }]}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
        >
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={15} color={palette.ghostInk} />
          <Text allowFontScaling={false} style={[styles.foldButtonText, { color: palette.ghostInk }]}>
            {expanded
              ? i18nText("autoI18n.daha_az", "Daha az")
              : `${i18nText("autoI18n.liste_paylas_tumunu_gor", "Tümünü gör")} (${picksTotal})`}
          </Text>
        </TouchableOpacity>
      )}

      {/* Karar / görüş özeti en sonda */}
      {!isGeneral ? summaryNode : null}
    </View>
  );
}

export default memo(SharedAiMessage);

const styles = StyleSheet.create({
  wrap: { width: "100%", minWidth: 250, marginBottom: 2 },

  header: { flexDirection: "row", alignItems: "center", gap: 9 },
  headerTile: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: { flex: 1, minWidth: 0 },
  kicker: { fontSize: 9.5, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" },
  title: { fontSize: 15, fontWeight: "800", lineHeight: 19, marginTop: 1 },

  questionLine: { flexDirection: "row", gap: 8, marginTop: 10 },
  questionBar: { width: 3, borderRadius: 2 },
  question: { flex: 1, fontSize: 12.5, lineHeight: 17, fontStyle: "italic" },

  section: { marginTop: 10 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 2 },
  sectionDot: { width: 7, height: 7, borderRadius: 4 },
  sectionName: { flex: 1, fontSize: 13, fontWeight: "800" },
  sectionNote: { fontSize: 11.5, lineHeight: 15, fontStyle: "italic", marginBottom: 2 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLast: { borderBottomWidth: 0 },
  poster: { overflow: "hidden" },
  fill: { width: "100%", height: "100%" },
  center: { alignItems: "center", justifyContent: "center" },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitleLine: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  rowTitle: { flexShrink: 1, fontSize: 14, fontWeight: "800", lineHeight: 18 },
  must: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 1 },
  mustText: { fontSize: 9, fontWeight: "800" },
  metaLine: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  typeDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  rowMeta: { fontSize: 11, fontWeight: "600" },
  star: { marginLeft: 8, marginRight: 2 },
  note: { fontSize: 12, lineHeight: 16, marginTop: 4 },

  versus: { flexDirection: "row", alignItems: "flex-start", justifyContent: "center", marginTop: 12 },
  versusPick: { flex: 1, alignItems: "center" },
  versusTitle: { fontSize: 12.5, fontWeight: "800", lineHeight: 16, textAlign: "center", marginTop: 7 },
  versusMeta: { fontSize: 10.5, marginTop: 1, textAlign: "center" },
  vsBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 4,
    marginTop: 50,
  },
  vsText: { fontSize: 11, fontWeight: "900" },

  summaryTop: { marginTop: 10 },
  summaryPlain: { fontSize: 14, lineHeight: 20 },
  summaryBox: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  summaryIcon: { marginTop: 1 },
  summaryCopy: { flex: 1, minWidth: 0 },
  summaryText: { fontSize: 13, lineHeight: 18, fontWeight: "600" },
  foldLink: { fontSize: 11.5, fontWeight: "800", marginTop: 4 },

  foldButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    height: 32,
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  foldButtonText: { fontSize: 12, fontWeight: "800" },
});
