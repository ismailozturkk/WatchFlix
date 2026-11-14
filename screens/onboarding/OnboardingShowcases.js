// screens/onboarding/OnboardingShowcases.js
//
// Onboarding tanıtım slaytları için özellik gösterimleri.
// Tüm örnek içerikler TMDB'den gelen GERÇEK yapımlarla beslenir
// (poster/başlık/puan/yıl tutarlı). Kompakt tasarım hedefi:
//  - AI: kullanıcı sorusu + öneri kartı (3 poster) + 5 cevap stili çipi
//  - Profil: kendi profil kartı (istatistik, Wrapped, favoriler) + arkadaş hareketi
// (Sohbet / Turnuva / Paylaş / Oyna gösterimleri onboarding iki slayta indiğinde
// kullanılmaz olmuştu; 12 Kas 2026'da silindi — git geçmişinde.)

import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image as ExpoImage } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import { alpha } from "../../theme/colors";
import { isLightSurface } from "../../utils/colorUtils";

const GOLD = "#F5C518";

// Bilinmeyen dil İngilizceye düşer.
const L = (lang, tr, en, es, pt, de, it, fr, ja) => (lang === "tr" ? tr : lang === "es" && es != null ? es : lang === "pt" && pt != null ? pt : lang === "de" && de != null ? de : lang === "it" && it != null ? it : lang === "fr" && fr != null ? fr : lang === "ja" && ja != null ? ja : en);
/* ═══════════════════════ 1. YAPAY ZEKÂ — soru + öneri kartı ═════════════════ */

// Seelogd AI'ın beş cevap stili (ilki örnekte açık, diğerleri çip olarak listelenir).
const AI_STYLES = [
  { icon: "sparkles", tr: "Öneri", en: "Picks", es: "Sugerencias", pt: "Sugestões", de: "Tipps" , it: "Scelte", fr: "Sélection", ja: "セレクト"},
  { icon: "git-compare", tr: "Karşılaştırma", en: "Compare", es: "Comparación", pt: "Comparação", de: "Vergleichen" , it: "Confronta", fr: "Comparer", ja: "比較"},
  { icon: "calendar", tr: "İzleme planı", en: "Watch plan", es: "Plan de visionado", pt: "Plano para assistir", de: "Schauplan" , it: "Piano di visione", fr: "Programme", ja: "視聴プラン"},
  { icon: "list", tr: "Liste", en: "List", es: "Lista", pt: "Lista", de: "Liste" , it: "Elenco", fr: "Liste", ja: "リスト"},
  { icon: "information-circle", tr: "Künye", en: "Spotlight", es: "Ficha", pt: "Destaque", de: "Steckbrief" , it: "Sotto i riflettori", fr: "Projecteur", ja: "スポットライト"},
];

// Poster + puan rozeti + başlık/yıl. Veri henüz yoksa nötr iskelet çizer.
function AiPick({ item, getTmdbUrl, theme }) {
  return (
    <View style={aiMock.pick}>
      <View style={[aiMock.posterBox, { backgroundColor: alpha(theme.text.muted, 0.14) }]}>
        {item ? (
          <>
            <ExpoImage
              source={{ uri: getTmdbUrl(item.poster_path, "poster", 200) }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
            <View style={aiMock.rating}>
              <Ionicons name="star" size={10} color={GOLD} />
              <Text style={aiMock.ratingText}>{item.vote_average}</Text>
            </View>
          </>
        ) : null}
      </View>
      <Text style={[aiMock.pickTitle, { color: theme.text.primary }]} numberOfLines={1}>
        {item ? item.title : " "}
      </Text>
      <Text style={[aiMock.pickMeta, { color: theme.text.muted }]} numberOfLines={1}>
        {item ? item.year : " "}
      </Text>
    </View>
  );
}

export function AiShowcase({ theme, accent, mediaItems = [], getTmdbUrl, lang = "tr" }) {
  const picks = useMemo(() => {
    const movies = mediaItems.filter((x) => x.media_type === "movie");
    const pool = movies.length >= 3 ? movies : mediaItems;
    return [0, 1, 2].map((i) => pool[i] || null);
  }, [mediaItems]);
  const onAccent = isLightSurface(accent) ? "#111827" : "#FFFFFF";

  return (
    <View style={aiMock.root}>
      {/* Kullanıcının sorusu */}
      <View style={[aiMock.question, { backgroundColor: accent }]}>
        <Text style={[aiMock.questionText, { color: onAccent }]}>
          {L(lang, "Bu akşam ne izlesem? 🍿", "What should I watch tonight? 🍿", "¿Qué veo esta noche? 🍿", "O que assistir hoje à noite? 🍿", "Was soll ich heute Abend schauen? 🍿", "Cosa dovrei guardare stasera? 🍿", "Qu'est-ce que je regarde ce soir ? 🍿", "今夜は何を観よう?🍿")}
        </Text>
      </View>

      {/* AI cevabı */}
      <View style={aiMock.answerRow}>
        <View
          style={[
            aiMock.aiAvatar,
            { backgroundColor: alpha(accent, 0.16), borderColor: alpha(accent, 0.36) },
          ]}
        >
          <Ionicons name="sparkles" size={15} color={accent} />
        </View>
        <View
          style={[aiMock.answer, { backgroundColor: theme.secondary, borderColor: theme.border }]}
        >
          <View style={aiMock.answerHead}>
            <Text style={[aiMock.aiName, { color: theme.text.primary }]}>Seelogd AI</Text>
            <View style={[aiMock.styleTag, { backgroundColor: alpha(accent, 0.14) }]}>
              <Ionicons name={AI_STYLES[0].icon} size={10} color={accent} />
              <Text style={[aiMock.styleTagText, { color: accent }]}>{L(lang, AI_STYLES[0].tr, AI_STYLES[0].en, AI_STYLES[0].es, AI_STYLES[0].pt, AI_STYLES[0].de, AI_STYLES[0].it, AI_STYLES[0].fr, AI_STYLES[0].ja)}</Text>
            </View>
          </View>
          <Text style={[aiMock.answerText, { color: theme.text.secondary }]}>
            {L(lang, "Ruh haline göre üç yapım seçtim:", "Three picks matched to your mood:", "Tres opciones según tu estado de ánimo:", "Três opções de acordo com o seu humor:", "Drei Tipps passend zu deiner Stimmung:", "Tre scelte adatte al tuo umore:", "Trois choix adaptés à ton humeur :", "あなたの気分に合った3つのおすすめ:")}
          </Text>

          <View style={aiMock.picks}>
            {picks.map((item, i) => (
              <AiPick key={item ? item.id : `empty-${i}`} item={item} getTmdbUrl={getTmdbUrl} theme={theme} />
            ))}
          </View>

          <View style={[aiMock.addRow, { borderTopColor: theme.border }]}>
            <Ionicons name="bookmark-outline" size={13} color={accent} />
            <Text style={[aiMock.addText, { color: theme.text.muted }]}>
              {L(lang, "Tek dokunuşla listene ekle", "Add to your list in one tap", "Añádelo a tu lista con un toque", "Adicione à sua lista com um toque", "Mit einem Tippen zu deiner Liste hinzufügen", "Aggiungi alla tua lista con un solo tocco", "Ajoute à ta liste en un geste", "ワンタップでリストに追加")}
            </Text>
          </View>
        </View>
      </View>

      {/* Beş cevap stili */}
      <Text style={[aiMock.label, { color: theme.text.muted }]}>
        {L(lang, "5 FARKLI CEVAP STİLİ", "5 ANSWER STYLES", "5 ESTILOS DE RESPUESTA", "5 ESTILOS DE RESPOSTA", "5 ANTWORTSTILE", "5 STILI DI RISPOSTA", "5 STYLES DE RÉPONSE", "5つの回答スタイル")}
      </Text>
      <View style={aiMock.chips}>
        {AI_STYLES.map((style, i) => (
          <View
            key={style.icon}
            style={[
              aiMock.chip,
              i === 0
                ? { backgroundColor: alpha(accent, 0.16), borderColor: alpha(accent, 0.45) }
                : { backgroundColor: alpha(theme.secondary, 0.9), borderColor: theme.border },
            ]}
          >
            <Ionicons name={style.icon} size={12} color={i === 0 ? accent : theme.text.secondary} />
            <Text style={[aiMock.chipText, { color: i === 0 ? accent : theme.text.secondary }]}>
              {L(lang, style.tr, style.en, style.es, style.pt, style.de, style.it, style.fr, style.ja)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ═══════════════════════ 2. TURNUVA — kompakt mini ağaç ═════════════════════ */

/* ═══════════════════════ 3. PAYLAŞ (gerçek PostCard + story) ════════════════ */

/* ═══════════════════════ 4. OYNA — tahmin + turnuva + paylaşım (çapraz) ═════ */

/* ═══════════════════════ 5. SOHBET + GRUP — tek slayt, çapraz düzen ═════════ */

/* ═══════════════════════ 6. PROFİL — kendi profilin + arkadaş hareketi ══════ */

function ProfileStat({ theme, accent, icon, value, label }) {
  return (
    <View style={[pf.stat, { backgroundColor: theme.between, borderColor: theme.border }]}>
      <Ionicons name={icon} size={14} color={accent} />
      <Text style={[pf.statValue, { color: theme.text.primary }]}>{value}</Text>
      <Text style={[pf.statLabel, { color: theme.text.muted }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

// Arkadaş hareketi satırı: avatar + "ad izledi/puanladı" + başlık + mini poster.
function FriendActivity({ theme, name, color, verb, item, rating, getTmdbUrl, first }) {
  return (
    <View
      style={[
        pf.activityRow,
        !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
      ]}
    >
      <View style={[pf.friendAvatar, { backgroundColor: alpha(color, 0.2) }]}>
        <Text style={[pf.friendAvatarText, { color }]}>{name.slice(0, 1).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[pf.activityLine, { color: theme.text.secondary }]} numberOfLines={1}>
          <Text style={{ color: theme.text.primary, fontWeight: "800" }}>{name}</Text> {verb}
        </Text>
        <View style={pf.activityMeta}>
          <Text style={[pf.activityTitle, { color: theme.text.primary }]} numberOfLines={1}>
            {item ? item.title : " "}
          </Text>
          {rating ? (
            <View style={pf.activityRating}>
              <Ionicons name="star" size={10} color={GOLD} />
              <Text style={[pf.activityRatingText, { color: theme.text.secondary }]}>{rating}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={[pf.activityPoster, { backgroundColor: alpha(theme.text.muted, 0.14) }]}>
        {item ? (
          <ExpoImage
            source={{ uri: getTmdbUrl(item.poster_path, "poster", 200) }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : null}
      </View>
    </View>
  );
}

export function ProfileShowcase({ theme, accent, posters = [], mediaItems = [], getTmdbUrl, lang = "tr" }) {
  const green = theme.colors?.green || "#3ddc84";
  const blue = theme.colors?.blue || "#4a7cf6";
  const purple = theme.colors?.purple || "#7C3AED";
  const posterAt = (i) => (posters.length ? posters[i % posters.length] : null);
  const year = new Date().getFullYear();
  const titles = mediaItems.length ? mediaItems : [];
  const friendA = titles[3] || null;
  const friendB = titles[6 % Math.max(titles.length, 1)] || null;

  return (
    <View style={pf.root}>
      {/* Profil kartı */}
      <View style={[pf.card, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
        <View style={pf.cover}>
          <LinearGradient
            colors={[alpha(accent, 0.7), alpha(purple, 0.55)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </View>

        <View style={pf.headRow}>
          <View style={[pf.avatar, { backgroundColor: theme.between, borderColor: theme.secondary }]}>
            <Text style={[pf.avatarText, { color: accent }]}>D</Text>
          </View>
          <View style={{ flex: 1, paddingTop: 30 }}>
            <Text style={[pf.name, { color: theme.text.primary }]} numberOfLines={1}>Deniz A.</Text>
            <Text style={[pf.handle, { color: theme.text.muted }]} numberOfLines={1}>@deniza</Text>
          </View>
        </View>

        <View style={pf.stats}>
          <ProfileStat theme={theme} accent={accent} icon="film-outline" value="312" label={L(lang, "Film", "Movies", "Películas", "Filmes", "Filme", "Film", "Films", "映画")} />
          <ProfileStat theme={theme} accent={accent} icon="tv-outline" value="48" label={L(lang, "Dizi", "Shows", "Series", "Séries", "Serien", "Serie TV", "Séries", "TV番組")} />
          <ProfileStat
            theme={theme}
            accent={accent}
            icon="time-outline"
            value={L(lang, "18 gün", "18 days", "18 días", "18 dias", "18 Tage", "18 giorni", "18 jours", "18日")}
            label={L(lang, "İzleme süresi", "Watch time", "Tiempo de visionado", "Tempo assistido", "Sehzeit", "Tempo di visione", "Temps de visionnage", "視聴時間")}
          />
        </View>

        {/* Wrapped şeridi */}
        <View style={pf.wrapped}>
          <LinearGradient
            colors={[accent, purple]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <MaterialCommunityIcons name="star-four-points" size={14} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={pf.wrappedTitle}>Wrapped {year}</Text>
            <Text style={pf.wrappedSub}>{L(lang, "Yılın izleme özetin hazır", "Your year in watching", "Tu año viendo cine y series", "Seu ano assistindo filmes e séries", "Dein Seh-Jahr", "Il tuo anno di visione", "Ton année de visionnage", "あなたの1年の視聴")}</Text>
          </View>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </View>

        <Text style={[pf.label, { color: theme.text.muted }]}>{L(lang, "FAVORİLERİN", "YOUR FAVORITES", "TUS FAVORITOS", "SEUS FAVORITOS", "DEINE FAVORITEN", "I TUOI PREFERITI", "TES FAVORIS", "あなたのお気に入り")}</Text>
        <View style={pf.favs}>
          {[0, 1, 2, 3].map((k) => (
            <View key={k} style={[pf.fav, { backgroundColor: alpha(theme.text.muted, 0.14) }]}>
              {posterAt(k + 6) ? (
                <ExpoImage
                  source={{ uri: posterAt(k + 6) }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ) : null}
            </View>
          ))}
        </View>
      </View>

      {/* Arkadaş hareketi */}
      <View style={[pf.activity, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
        <Text style={[pf.label, { color: theme.text.muted, marginTop: 0 }]}>
          {L(lang, "ARKADAŞLARIN NE İZLİYOR", "WHAT FRIENDS ARE WATCHING", "LO QUE VEN TUS AMIGOS", "O QUE SEUS AMIGOS ESTÃO ASSISTINDO", "WAS FREUNDE SCHAUEN", "COSA STANNO GUARDANDO GLI AMICI", "CE QUE REGARDENT TES AMIS", "友だちが観ているもの")}
        </Text>
        <FriendActivity
          first
          theme={theme}
          name="zeynep"
          color={green}
          verb={L(lang, "izledi", "watched", "vio", "assistiu", "gesehen", "guardato", "vu", "視聴済み")}
          item={friendA}
          getTmdbUrl={getTmdbUrl}
        />
        <FriendActivity
          theme={theme}
          name="can"
          color={blue}
          verb={L(lang, "puanladı", "rated", "puntuó", "avaliou", "bewertet", "valutato", "noté", "評価済み")}
          item={friendB}
          rating={4.5}
          getTmdbUrl={getTmdbUrl}
        />
      </View>
    </View>
  );
}

/* ═══════════════════════ Stiller ════════════════════════════════════════════ */

// Yapay zekâ önizlemesi stilleri
const aiMock = StyleSheet.create({
  root: { width: "100%", maxWidth: 360 },
  question: {
    alignSelf: "flex-end",
    maxWidth: "88%",
    borderRadius: 18,
    borderBottomRightRadius: 5,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  questionText: { fontSize: 13.5, fontWeight: "800" },
  answerRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 12 },
  aiAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  answer: {
    flex: 1,
    borderRadius: 20,
    borderTopLeftRadius: 6,
    borderWidth: 1,
    padding: 12,
  },
  answerHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  aiName: { fontSize: 13, fontWeight: "900" },
  styleTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  styleTagText: { fontSize: 10.5, fontWeight: "800" },
  answerText: { fontSize: 12.5, lineHeight: 18, marginTop: 8 },
  picks: { flexDirection: "row", gap: 8, marginTop: 10 },
  pick: { flex: 1 },
  posterBox: { width: "100%", aspectRatio: 2 / 3, borderRadius: 10, overflow: "hidden" },
  rating: {
    position: "absolute",
    left: 5,
    bottom: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  ratingText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  pickTitle: { fontSize: 11.5, fontWeight: "800", marginTop: 6 },
  pickMeta: { fontSize: 10.5, fontWeight: "600", marginTop: 1 },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  addText: { fontSize: 11.5, fontWeight: "600" },
  label: { fontSize: 10.5, fontWeight: "900", letterSpacing: 1.1, marginTop: 16, marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: 11.5, fontWeight: "800" },
});

// Profil önizlemesi stilleri
const pf = StyleSheet.create({
  root: { width: "100%", maxWidth: 360, gap: 12 },
  card: { borderRadius: 22, borderWidth: 1, overflow: "hidden", paddingBottom: 14 },
  cover: { height: 64 },
  headRow: { flexDirection: "row", gap: 12, paddingHorizontal: 14, marginTop: -30 },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 24, fontWeight: "900" },
  name: { fontSize: 16, fontWeight: "900" },
  handle: { fontSize: 12, fontWeight: "600", marginTop: 1 },
  stats: { flexDirection: "row", gap: 8, paddingHorizontal: 14, marginTop: 14 },
  stat: {
    flex: 1,
    alignItems: "center",
    gap: 3,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statValue: { fontSize: 15, fontWeight: "900" },
  statLabel: { fontSize: 10.5, fontWeight: "600" },
  wrapped: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    overflow: "hidden",
    marginHorizontal: 14,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  wrappedTitle: { color: "#fff", fontSize: 13, fontWeight: "900" },
  wrappedSub: { color: "rgba(255,255,255,0.82)", fontSize: 11, fontWeight: "600", marginTop: 1 },
  label: {
    fontSize: 10.5,
    fontWeight: "900",
    letterSpacing: 1.1,
    marginTop: 14,
    marginBottom: 8,
    marginHorizontal: 14,
  },
  favs: { flexDirection: "row", gap: 8, paddingHorizontal: 14 },
  fav: { flex: 1, aspectRatio: 2 / 3, borderRadius: 10, overflow: "hidden" },
  activity: { borderRadius: 22, borderWidth: 1, paddingTop: 14, paddingBottom: 4 },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  friendAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  friendAvatarText: { fontSize: 14, fontWeight: "900" },
  activityLine: { fontSize: 12, fontWeight: "600" },
  activityMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  activityTitle: { flexShrink: 1, fontSize: 13, fontWeight: "800" },
  activityRating: { flexDirection: "row", alignItems: "center", gap: 3 },
  activityRatingText: { fontSize: 11, fontWeight: "800" },
  activityPoster: { width: 30, height: 45, borderRadius: 7, overflow: "hidden" },
});

