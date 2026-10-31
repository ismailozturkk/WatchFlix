// screens/onboarding/OnboardingShowcases.js
//
// Onboarding tanıtım slaytları için özellik gösterimleri.
// Tüm örnek içerikler TMDB'den gelen GERÇEK yapımlarla beslenir
// (poster/başlık/puan/yıl tutarlı). Kompakt tasarım hedefi:
//  - AI: kullanıcı sorusu + öneri kartı (3 poster) + 5 cevap stili çipi
//  - Sohbet: birebir sohbet sol üstte, grup sohbeti sağ altta, yanlarında bilgi
//  - Turnuva: kaydırma gerektirmeyen kompakt mini ağaç (MiniBracket)
//  - Oyna: sahne tahmini + aylık turnuva + post paylaşımı, sohbetteki çapraz mini kart düzeniyle
//  - Profil: kendi profil kartı (istatistik, Wrapped, favoriler) + arkadaş hareketi

import { intlLocaleOf } from "../../utils/appLanguages";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image as ExpoImage } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import { alpha } from "../../theme/colors";
import { isLightSurface } from "../../utils/colorUtils";

const GAME_TOKENS = { correct: "#00E676", incorrect: "#FF1744" };
const GOLD = "#F5C518";

// Üç dilli metin seçici: es verilmezse İngilizce (utils/appLanguages kuralı: bilinmeyen → en).
const L = (lang, tr, en, es, pt, de) => (lang === "tr" ? tr : lang === "es" && es != null ? es : lang === "pt" && pt != null ? pt : lang === "de" && de != null ? de : en);
const pathAt = (paths, i) => (paths.length ? paths[i % paths.length] : null);

// Uzun metni kısa "hook"a indirger (gerçek özet cümlesinden).
function clip(s, n = 72) {
  if (!s) return "";
  const str = String(s).trim();
  if (str.length <= n) return str;
  const cut = str.slice(0, n);
  const sp = cut.lastIndexOf(" ");
  return (sp > 40 ? cut.slice(0, sp) : cut) + "…";
}

// Ortak panel yüzeyi (kart)
function Panel({ theme, children, style }) {
  return (
    <View
      style={[
        {
          width: "100%",
          maxWidth: 360,
          backgroundColor: theme.secondary,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: theme.border,
          padding: 14,
        },
        styles.panelShadow,
        style,
      ]}
    >
      {children}
    </View>
  );
}

function LoadingCard({ theme, lang }) {
  return (
    <Panel theme={theme}>
      <Text style={[styles.aiSub, { color: theme.text.muted, textAlign: "center", paddingVertical: 26 }]}>
        {L(lang, "İçerik yükleniyor…", "Loading…", "Cargando…", "Carregando…", "Wird geladen…")}
      </Text>
    </Panel>
  );
}

/* ═══════════════════════ 1. YAPAY ZEKÂ — soru + öneri kartı ═════════════════ */

// Seelogd AI'ın beş cevap stili (ilki örnekte açık, diğerleri çip olarak listelenir).
const AI_STYLES = [
  { icon: "sparkles", tr: "Öneri", en: "Picks", es: "Sugerencias", pt: "Sugestões", de: "Tipps" },
  { icon: "git-compare", tr: "Karşılaştırma", en: "Compare", es: "Comparación", pt: "Comparação", de: "Vergleichen" },
  { icon: "calendar", tr: "İzleme planı", en: "Watch plan", es: "Plan de visionado", pt: "Plano para assistir", de: "Schauplan" },
  { icon: "list", tr: "Liste", en: "List", es: "Lista", pt: "Lista", de: "Liste" },
  { icon: "information-circle", tr: "Künye", en: "Spotlight", es: "Ficha", pt: "Destaque", de: "Steckbrief" },
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
          {L(lang, "Bu akşam ne izlesem? 🍿", "What should I watch tonight? 🍿", "¿Qué veo esta noche? 🍿", "O que assistir hoje à noite? 🍿", "Was soll ich heute Abend schauen? 🍿")}
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
              <Text style={[aiMock.styleTagText, { color: accent }]}>{L(lang, AI_STYLES[0].tr, AI_STYLES[0].en, AI_STYLES[0].es, AI_STYLES[0].pt, AI_STYLES[0].de)}</Text>
            </View>
          </View>
          <Text style={[aiMock.answerText, { color: theme.text.secondary }]}>
            {L(lang, "Ruh haline göre üç yapım seçtim:", "Three picks matched to your mood:", "Tres opciones según tu estado de ánimo:", "Três opções de acordo com o seu humor:", "Drei Tipps passend zu deiner Stimmung:")}
          </Text>

          <View style={aiMock.picks}>
            {picks.map((item, i) => (
              <AiPick key={item ? item.id : `empty-${i}`} item={item} getTmdbUrl={getTmdbUrl} theme={theme} />
            ))}
          </View>

          <View style={[aiMock.addRow, { borderTopColor: theme.border }]}>
            <Ionicons name="bookmark-outline" size={13} color={accent} />
            <Text style={[aiMock.addText, { color: theme.text.muted }]}>
              {L(lang, "Tek dokunuşla listene ekle", "Add to your list in one tap", "Añádelo a tu lista con un toque", "Adicione à sua lista com um toque", "Mit einem Tippen zu deiner Liste hinzufügen")}
            </Text>
          </View>
        </View>
      </View>

      {/* Beş cevap stili */}
      <Text style={[aiMock.label, { color: theme.text.muted }]}>
        {L(lang, "5 FARKLI CEVAP STİLİ", "5 ANSWER STYLES", "5 ESTILOS DE RESPUESTA", "5 ESTILOS DE RESPOSTA", "5 ANTWORTSTILE")}
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
              {L(lang, style.tr, style.en, style.es, style.pt, style.de)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ═══════════════════════ 2. TURNUVA — kompakt mini ağaç ═════════════════════ */

function BracketThumb({ uri, w, h, theme, champion, accent }) {
  return (
    <View
      style={{
        width: w,
        height: h,
        borderRadius: champion ? 9 : 6,
        borderWidth: champion ? 1.5 : StyleSheet.hairlineWidth,
        borderColor: champion ? accent : theme.border,
        overflow: "hidden",
        backgroundColor: alpha(theme.text.muted, 0.1),
      }}
    >
      {uri ? (
        <ExpoImage source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
      ) : null}
    </View>
  );
}

// Kaydırma gerektirmeyen kompakt turnuva ağacı: 4 → 2 → şampiyon.
// Bağlantı çizgileri border'lı ⊐ şekilleriyle çizilir.
export function MiniBracket({ theme, accent, posterPaths = [], getTmdbUrl, lang = "tr" }) {
  // Ölçüler — tek bakışta okunacak sabit mini ağaç
  const qW = 26, qH = 39, qGap = 10; // çeyrek final küçük posterleri
  const sW = 32, sH = 48; // yarı final
  const fW = 44, fH = 66; // şampiyon
  const colH = 4 * qH + 3 * qGap; // 186
  const c = [qH / 2, qH * 1.5 + qGap, qH * 2.5 + qGap * 2, qH * 3.5 + qGap * 3]; // çeyrek merkezleri
  const p0 = (c[0] + c[1]) / 2; // üst çift merkezi
  const p1 = (c[2] + c[3]) / 2; // alt çift merkezi
  const fc = (p0 + p1) / 2; // final merkezi
  const line = alpha(theme.text.muted, 0.4);
  const uri = (i) => getTmdbUrl(pathAt(posterPaths, i * 3 + 1), "poster", 200);

  const champTop = fc - (fH + 30) / 2; // taç + poster + etiket bloğu

  return (
    <View style={{ height: colH, flexDirection: "row", justifyContent: "center", marginTop: 8 }}>
      {/* Çeyrek final */}
      <View style={{ height: colH, justifyContent: "space-between" }}>
        {[0, 1, 2, 3].map((i) => (
          <BracketThumb key={i} uri={uri(i)} w={qW} h={qH} theme={theme} accent={accent} />
        ))}
      </View>

      {/* Bağlantı: çeyrek → yarı */}
      <View style={{ width: 13, height: colH }}>
        {[
          { top: c[0], h: c[1] - c[0], mid: p0 },
          { top: c[2], h: c[3] - c[2], mid: p1 },
        ].map((seg, i) => (
          <React.Fragment key={i}>
            <View
              style={{
                position: "absolute",
                top: seg.top,
                height: seg.h,
                left: 0,
                width: 7,
                borderTopWidth: 1.2,
                borderBottomWidth: 1.2,
                borderRightWidth: 1.2,
                borderColor: line,
              }}
            />
            <View style={{ position: "absolute", top: seg.mid - 0.6, left: 7, width: 6, height: 1.2, backgroundColor: line }} />
          </React.Fragment>
        ))}
      </View>

      {/* Yarı final */}
      <View style={{ width: sW, height: colH }}>
        <View style={{ position: "absolute", top: p0 - sH / 2 }}>
          <BracketThumb uri={uri(4)} w={sW} h={sH} theme={theme} accent={accent} />
        </View>
        <View style={{ position: "absolute", top: p1 - sH / 2 }}>
          <BracketThumb uri={uri(5)} w={sW} h={sH} theme={theme} accent={accent} />
        </View>
      </View>

      {/* Bağlantı: yarı → final */}
      <View style={{ width: 13, height: colH }}>
        <View
          style={{
            position: "absolute",
            top: p0,
            height: p1 - p0,
            left: 0,
            width: 7,
            borderTopWidth: 1.2,
            borderBottomWidth: 1.2,
            borderRightWidth: 1.2,
            borderColor: line,
          }}
        />
        <View style={{ position: "absolute", top: fc - 0.6, left: 7, width: 6, height: 1.2, backgroundColor: line }} />
      </View>

      {/* Şampiyon */}
      <View style={{ width: fW + 34, height: colH, alignItems: "center" }}>
        <View style={{ position: "absolute", top: Math.max(0, champTop), alignItems: "center" }}>
          <MaterialCommunityIcons name="crown" size={13} color={GOLD} style={{ marginBottom: 2 }} />
          <BracketThumb uri={uri(6)} w={fW} h={fH} theme={theme} accent={accent} champion />
          <View style={[mb.champPill, { backgroundColor: alpha(accent, 0.15) }]}>
            <Text style={[mb.champPillText, { color: accent }]}>
              {L(lang, "ŞAMPİYON", "CHAMPION", "CAMPEÓN", "CAMPEÃO", "CHAMPION")}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export function TournamentShowcase({ theme, accent, posterPaths = [], getTmdbUrl, lang = "tr" }) {
  const prevMonth = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return d.toLocaleDateString(intlLocaleOf(lang), { month: "long", year: "numeric" });
  }, [lang]);

  return (
    <Panel theme={theme}>
      <View style={styles.aiHeader}>
        <View style={[styles.aiAvatar, { backgroundColor: alpha(GOLD, 0.18) }]}>
          <Ionicons name="trophy" size={16} color={GOLD} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.aiName, { color: theme.text.primary }]}>
            {L(lang, "Aylık Turnuva", "Monthly Tournament", "Torneo mensual", "Torneio mensal", "Monatsturnier")}
          </Text>
          <Text style={[styles.aiSub, { color: theme.text.muted }]}>{prevMonth}</Text>
        </View>
        <View style={[styles.pastPill, { backgroundColor: alpha(theme.text.muted, 0.14) }]}>
          <Ionicons name="time-outline" size={11} color={theme.text.muted} />
          <Text style={[styles.pastPillText, { color: theme.text.muted }]}>
            {L(lang, "Geçen ay", "Last month", "El mes pasado", "No mês passado", "Letzter Monat")}
          </Text>
        </View>
      </View>

      {posterPaths.length ? (
        <>
          <MiniBracket theme={theme} accent={accent} posterPaths={posterPaths} getTmdbUrl={getTmdbUrl} lang={lang} />
          <Text style={[mb.caption, { color: theme.text.muted }]}>
            {L(lang, "32 yapım · 1.2k oy · her ay yenilenir", "32 titles · 1.2k votes · renews monthly", "32 títulos · 1,2 mil votos · se renueva cada mes", "32 títulos · 1,2 mil votos · renova todo mês", "32 Titel · 1,2k Stimmen · erneuert sich monatlich")}
          </Text>
        </>
      ) : (
        <Text style={[styles.aiSub, { color: theme.text.muted, paddingVertical: 20, textAlign: "center" }]}>
          {L(lang, "Ağaç yükleniyor…", "Loading bracket…", "Cargando el cuadro…", "Carregando o chaveamento…", "Turnierbaum wird geladen…")}
        </Text>
      )}
    </Panel>
  );
}

/* ═══════════════════════ 3. PAYLAŞ (gerçek PostCard + story) ════════════════ */

// Gerçek ShareContentScreen'deki 5 yıldız (RatingStars) davranışı.
function Stars5({ rating = 0, color, size = 11 }) {
  const n = Math.round(rating);
  return (
    <View style={{ flexDirection: "row" }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Ionicons
          key={i}
          name={i < n ? "star" : "star-outline"}
          size={size}
          color={i < n ? color : alpha(color, 0.35)}
          style={{ marginHorizontal: 0.3 }}
        />
      ))}
    </View>
  );
}

export function ShareShowcase({ theme, accent, mediaItems = [], getTmdbUrl, lang = "tr" }) {
  const blue = theme.colors?.blue || "#4a7cf6";
  const movies = mediaItems.filter((x) => x.media_type === "movie");
  const post = movies[0] || mediaItems[0];
  const story = movies[1] || mediaItems[1] || post;

  if (!mediaItems.length) return <LoadingCard theme={theme} lang={lang} />;

  return (
    <View style={{ width: "100%", maxWidth: 360, gap: 14 }}>
      {/* Gerçek PostCard (inceleme) — ShareContentScreen ile birebir */}
      <View style={[ps.card, { backgroundColor: theme.secondary, borderColor: theme.border, borderLeftColor: blue }]}>
        {/* Header */}
        <View style={ps.header}>
          <View style={[ps.avatar, { backgroundColor: alpha(accent, 0.22), alignItems: "center", justifyContent: "center" }]}>
            <Text style={{ color: accent, fontWeight: "800", fontSize: 15 }}>E</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
              <Text style={[ps.userName, { color: theme.text.primary }]} numberOfLines={1}>emir</Text>
              <View style={[ps.badge, { backgroundColor: blue + "22", borderColor: blue + "55" }]}>
                <Text style={[ps.badgeText, { color: blue }]}>{L(lang, "İNCELEME", "REVIEW", "RESEÑA", "AVALIAÇÃO", "REZENSION")}</Text>
              </View>
            </View>
            <Text style={[ps.time, { color: theme.text.muted }]}>{L(lang, "2 saat önce", "2h ago", "hace 2 h", "há 2 h", "vor 2 Std.")}</Text>
          </View>
          <MaterialCommunityIcons name="dots-vertical" size={18} color={theme.text.muted} />
        </View>

        {/* Body (review) — gerçek film */}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ alignItems: "center" }}>
            <View style={[ps.mediaCard, { borderColor: theme.border }]}>
              <ExpoImage source={{ uri: getTmdbUrl(post.poster_path, "poster", 200) }} style={ps.mediaPoster} contentFit="cover" cachePolicy="memory-disk" />
            </View>
            <View style={[ps.ratingPill, { backgroundColor: theme.primary, borderColor: theme.border }]}>
              <Stars5 rating={4} color={theme.colors.orange} size={10} />
              <Text style={[ps.ratingNumber, { color: theme.text.primary }]}>4</Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[ps.title, { color: theme.text.primary }]} numberOfLines={2}>{post.title}</Text>
            <Text style={[ps.content, { color: theme.text.secondary }]} numberOfLines={4}>
              {clip(post.overview, 150) || L(lang, "Kesinlikle önerdiğim bir yapım!", "A title I highly recommend!", "¡Un título que recomiendo muchísimo!", "Um título que eu recomendo muito!", "Ein Titel, den ich sehr empfehle!")}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={[ps.actions, { borderTopColor: theme.border }]}>
          <View style={ps.actionBtn}>
            <Ionicons name="heart" size={19} color="#FF5A5F" />
            <Text style={[ps.actionText, { color: "#FF5A5F" }]}>124</Text>
          </View>
          <View style={ps.actionBtn}>
            <Ionicons name="chatbubble-outline" size={18} color={theme.text.secondary} />
            <Text style={[ps.actionText, { color: theme.text.secondary }]}>18</Text>
          </View>
          <View style={{ flex: 1 }} />
          <View style={ps.actionBtn}>
            <Ionicons name="bookmark-outline" size={18} color={theme.text.secondary} />
          </View>
          <View style={ps.actionBtn}>
            <Ionicons name="share-social-outline" size={18} color={theme.text.secondary} />
          </View>
        </View>
      </View>

      {/* Story paylaşım kartı (StoryShareScreen çıktısı) */}
      <Panel theme={theme}>
        <Text style={[styles.blockLabel, { color: theme.text.muted }]}>
          {L(lang, "HİKÂYE PAYLAŞIMI", "STORY SHARE", "COMPARTIR EN HISTORIA", "COMPARTILHAR NO STORY", "STORY TEILEN")}
        </Text>
        <View style={{ flexDirection: "row", gap: 14, marginTop: 10, alignItems: "center" }}>
          <View style={ps.storyCard}>
            {story.poster_path ? (
              <ExpoImage source={{ uri: getTmdbUrl(story.poster_path, "poster", 300) }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.between }]} />
            )}
            <LinearGradient colors={["rgba(0,0,0,0.15)", "rgba(0,0,0,0.85)"]} style={StyleSheet.absoluteFill} />
            <View style={ps.storyTop}>
              <Text style={ps.storyBrand}>
                Watch<Text style={{ color: accent }}>ify</Text>
              </Text>
            </View>
            <View style={ps.storyBottom}>
              <Text style={ps.storyTitle} numberOfLines={1}>{story.title}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
                <Ionicons name="star" size={11} color="#FFD54F" />
                <Text style={ps.storyRating}>{story.vote_average}{story.year ? ` · ${story.year}` : ""}</Text>
              </View>
            </View>
          </View>
          <View style={{ flex: 1, gap: 10 }}>
            <Text style={[styles.mediaMeta, { color: theme.text.secondary, fontSize: 12.5, lineHeight: 17 }]}>
              {L(lang, "İzlediğin içeriği şık bir kartla hikâyende paylaş.", "Share what you watched as a sleek story card.", "Comparte lo que has visto en una tarjeta de historia con estilo.", "Compartilhe o que você assistiu em um card de story estiloso.", "Teile, was du gesehen hast, als schicke Story-Karte.")}
            </Text>
            <View style={[ps.shareBtn, { backgroundColor: accent }]}>
              <Ionicons name="share-social" size={14} color="#fff" />
              <Text style={ps.shareBtnText}>{L(lang, "Hikâyeye Ekle", "Add to Story", "Añadir a la historia", "Adicionar ao story", "Zur Story hinzufügen")}</Text>
            </View>
          </View>
        </View>
      </Panel>
    </View>
  );
}

/* ═══════════════════════ 4. OYNA — tahmin + turnuva + paylaşım (çapraz) ═════ */

// Oyna slaytı — sohbet slaytındaki çapraz düzenin aynısı: her satırda bir mini
// kart + yanında bilgi sütunu. Üst: sahne tahmin · Orta: aylık turnuva ·
// Alt: post paylaşımı (oyun sonucu/inceleme toplulukla paylaşılır).
export function PlayShowcase({ theme, accent, mediaItems = [], posterPaths = [], getTmdbUrl, lang = "tr" }) {
  const orange = theme.colors?.orange || "#FF7C25";
  const blue = theme.colors?.blue || "#4a7cf6";
  const green = GAME_TOKENS.correct;
  const movies = mediaItems.filter((x) => x.media_type === "movie");
  const pool = movies.length >= 4 ? movies : mediaItems;

  if (pool.length < 4) return <LoadingCard theme={theme} lang={lang} />;

  // Sahne = doğru cevabın posteri; şıklar gerçek başlıklardan.
  const answer = pool[0];
  const wrong = pool[1];
  const post = pool[2];

  return (
    <View style={{ width: "100%", maxWidth: 360, gap: 12 }}>
      {/* ÜST — sahne tahmin kartı solda, bilgiler sağda */}
      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
        <View style={[duo.card, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          <View style={duo.head}>
            <View style={[duo.avatar, { backgroundColor: alpha(accent, 0.18) }]}>
              <Ionicons name="game-controller" size={11} color={accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[duo.headName, { color: theme.text.primary }]} numberOfLines={1}>
                {L(lang, "Sahne Tahmin", "Guess the Scene", "Adivina la escena", "Adivinhe a cena", "Szenenraten")}
              </Text>
              <Text style={[duo.headSub, { color: theme.text.muted }]}>
                {L(lang, "Soru 3/10", "Q 3/10", "P 3/10", "P 3/10", "Q 3/10")}
              </Text>
            </View>
            <View style={[mini.pill, { backgroundColor: alpha(orange, 0.15) }]}>
              <Ionicons name="flame" size={9} color={orange} />
              <Text style={[mini.pillText, { color: orange }]}>240</Text>
            </View>
          </View>

          <View>
            <ExpoImage
              source={{ uri: getTmdbUrl(answer.poster_path, "poster", 300) }}
              style={mini.scene}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
            <View style={mini.timer}>
              <Ionicons name="timer-outline" size={9} color="#fff" />
              <Text style={mini.timerText}>0:08</Text>
            </View>
          </View>

          {/* Mini şıklar: doğru (yeşil) + bir çeldirici */}
          <View style={{ gap: 5, marginTop: 7 }}>
            <View style={[mini.opt, { borderColor: green, backgroundColor: alpha(green, 0.13) }]}>
              <Ionicons name="checkmark-circle" size={11} color={green} />
              <Text style={[mini.optText, { color: theme.text.primary }]} numberOfLines={1}>
                {answer.title}
              </Text>
            </View>
            <View style={[mini.opt, { borderColor: theme.border, backgroundColor: theme.between }]}>
              <View style={[mini.optDot, { borderColor: theme.text.muted }]} />
              <Text style={[mini.optText, { color: theme.text.secondary }]} numberOfLines={1}>
                {wrong.title}
              </Text>
            </View>
          </View>
        </View>

        <InfoCol
          theme={theme}
          accent={accent}
          eyebrow={L(lang, "SAHNE TAHMİN", "GUESS THE SCENE", "ADIVINA LA ESCENA", "ADIVINHE A CENA", "SZENENRATEN")}
          bullets={[
            { icon: "film-outline", text: L(lang, "Sahneden yapımı bil", "Guess the title from a scene", "Adivina el título a partir de una escena", "Adivinhe o título a partir de uma cena", "Errate den Titel anhand einer Szene") },
            { icon: "flash-outline", text: L(lang, "Klasik · Zamana Karşı · Günlük", "Classic · Time Attack · Daily", "Clásico · Contrarreloj · Diario", "Clássico · Contra o relógio · Diário", "Klassik · Gegen die Zeit · Täglich") },
            { icon: "flame-outline", text: L(lang, "Seri yap, puanını katla", "Build streaks, boost your score", "Encadena rachas y sube tu puntuación", "Encadeie sequências e aumente sua pontuação", "Baue Serien auf, steigere deine Punktzahl") },
          ]}
        />
      </View>

      {/* ORTA — bilgiler solda, aylık turnuva sağda */}
      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
        <InfoCol
          theme={theme}
          accent={accent}
          align="right"
          eyebrow={L(lang, "AYLIK TURNUVA", "MONTHLY TOURNAMENT", "TORNEO MENSUAL", "TORNEIO MENSAL", "MONATSTURNIER")}
          bullets={[
            { icon: "trophy-outline", text: L(lang, "32 yapım kapışır", "32 titles face off", "32 títulos se enfrentan", "32 títulos se enfrentam", "32 Titel treten gegeneinander an") },
            { icon: "people-outline", text: L(lang, "Şampiyonu topluluk seçer", "The community picks the champion", "La comunidad elige al campeón", "A comunidade escolhe o campeão", "Die Community wählt den Champion") },
            { icon: "refresh-outline", text: L(lang, "Her ay yeni turnuva", "A fresh bracket every month", "Un cuadro nuevo cada mes", "Uma chave nova a cada mês", "Jeden Monat ein neuer Turnierbaum") },
          ]}
        />

        <View style={[duo.card, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          <View style={duo.head}>
            <View style={[duo.avatar, { backgroundColor: alpha(GOLD, 0.18) }]}>
              <Ionicons name="trophy" size={11} color={GOLD} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[duo.headName, { color: theme.text.primary }]} numberOfLines={1}>
                {L(lang, "Aylık Turnuva", "Monthly Tournament", "Torneo mensual", "Torneio mensal", "Monatsturnier")}
              </Text>
              <Text style={[duo.headSub, { color: theme.text.muted }]}>
                {L(lang, "1.2k oy", "1.2k votes", "1,2 mil votos", "1,2 mil votos", "1,2k Stimmen")}
              </Text>
            </View>
          </View>
          <MiniBracket theme={theme} accent={accent} posterPaths={posterPaths} getTmdbUrl={getTmdbUrl} lang={lang} />
        </View>
      </View>

      {/* ALT — post paylaşım kartı solda, bilgiler sağda */}
      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
        <View style={[duo.card, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          <View style={duo.head}>
            <View style={[duo.avatar, { backgroundColor: alpha(accent, 0.2) }]}>
              <Text style={[duo.avatarText, { color: accent }]}>E</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[duo.headName, { color: theme.text.primary }]} numberOfLines={1}>emir</Text>
              <Text style={[duo.headSub, { color: theme.text.muted }]}>
                {L(lang, "2 sa önce", "2h ago", "hace 2 h", "há 2 h", "vor 2 Std.")}
              </Text>
            </View>
            <View style={[mini.badge, { backgroundColor: alpha(blue, 0.13), borderColor: alpha(blue, 0.33) }]}>
              <Text style={[mini.badgeText, { color: blue }]}>{L(lang, "İNCELEME", "REVIEW", "RESEÑA", "AVALIAÇÃO", "REZENSION")}</Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 7 }}>
            <ExpoImage
              source={{ uri: getTmdbUrl(post.poster_path, "poster", 200) }}
              style={[mini.postPoster, { backgroundColor: theme.between }]}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
            <View style={{ flex: 1 }}>
              <Text style={[mini.postTitle, { color: theme.text.primary }]} numberOfLines={1}>
                {post.title}
              </Text>
              <Stars5 rating={4} color={orange} size={8} />
              <Text style={[mini.postText, { color: theme.text.secondary }]} numberOfLines={2}>
                {clip(post.overview, 70) || L(lang, "Kesinlikle önerdiğim bir yapım!", "A title I highly recommend!", "¡Un título que recomiendo muchísimo!", "Um título que eu recomendo muito!", "Ein Titel, den ich sehr empfehle!")}
              </Text>
            </View>
          </View>

          <View style={[mini.postFoot, { borderTopColor: theme.border }]}>
            <Ionicons name="heart" size={11} color="#FF5A5F" />
            <Text style={[mini.postFootText, { color: theme.text.secondary }]}>124</Text>
            <Ionicons name="chatbubble-outline" size={10} color={theme.text.muted} />
            <Text style={[mini.postFootText, { color: theme.text.muted }]}>18</Text>
            <View style={{ flex: 1 }} />
            <Ionicons name="share-social-outline" size={11} color={theme.text.muted} />
          </View>
        </View>

        <InfoCol
          theme={theme}
          accent={accent}
          eyebrow={L(lang, "PAYLAŞ", "SHARE", "COMPARTE", "COMPARTILHE", "TEILEN")}
          bullets={[
            { icon: "create-outline", text: L(lang, "Puanla ve incele", "Rate and review", "Puntúa y reseña", "Avalie e escreva uma resenha", "Bewerten und rezensieren") },
            { icon: "heart-outline", text: L(lang, "Beğeni ve yorum al", "Get likes and comments", "Consigue me gusta y comentarios", "Ganhe curtidas e comentários", "Erhalte Likes und Kommentare") },
            { icon: "share-social-outline", text: L(lang, "Skorunu kartla paylaş", "Share your score as a card", "Comparte tu puntuación en una tarjeta", "Compartilhe sua nota em um card", "Teile deine Punktzahl als Karte") },
          ]}
        />
      </View>
    </View>
  );
}

/* ═══════════════════════ 5. SOHBET + GRUP — tek slayt, çapraz düzen ═════════ */

// Küçük sohbet baloncuğu (ChatScreen renkleriyle)
function MiniBubble({ mine, children, style }) {
  return <View style={[duo.bubble, mine ? duo.mine : duo.their, style]}>{children}</View>;
}

// Kartın yanındaki bilgi sütunu: eyebrow + mini madde listesi
function InfoCol({ theme, accent, eyebrow, bullets, align = "left" }) {
  return (
    <View style={[duo.infoCol, align === "right" && { alignItems: "flex-end" }]}>
      <Text style={[duo.infoEyebrow, { color: accent, textAlign: align }]}>{eyebrow}</Text>
      {bullets.map((b) => (
        <View key={b.text} style={[duo.infoRow, align === "right" && { flexDirection: "row-reverse" }]}>
          <View style={[duo.infoIcon, { backgroundColor: alpha(accent, 0.13) }]}>
            <Ionicons name={b.icon} size={10} color={accent} />
          </View>
          <Text style={[duo.infoText, { color: theme.text.secondary, textAlign: align }]}>{b.text}</Text>
        </View>
      ))}
    </View>
  );
}

export function ChatDuoShowcase({ theme, accent, mediaItems = [], getTmdbUrl, lang = "tr" }) {
  const movies = mediaItems.filter((x) => x.media_type === "movie");
  const pool = movies.length >= 3 ? movies : mediaItems;

  if (pool.length < 3) return <LoadingCard theme={theme} lang={lang} />;
  const media = pool[0];
  const pollA = pool[1];
  const pollB = pool[2];

  return (
    <View style={{ width: "100%", maxWidth: 360, gap: 12 }}>
      {/* ÜST — birebir sohbet solda, bilgiler sağda */}
      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
        <View style={[duo.card, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          <View style={duo.head}>
            <View style={[duo.avatar, { backgroundColor: alpha(accent, 0.2) }]}>
              <Text style={[duo.avatarText, { color: accent }]}>A</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[duo.headName, { color: theme.text.primary }]}>ayşe</Text>
              <Text style={[duo.headSub, { color: theme.text.muted }]}>
                @ayse
              </Text>
            </View>
            <Ionicons name="videocam-outline" size={13} color={theme.text.muted} />
          </View>

          <MiniBubble>
            <Text style={duo.bubbleText}>{L(lang, "Bu akşam ne izlesek? 🍿", "What should we watch? 🍿", "¿Qué vemos? 🍿", "O que vamos assistir? 🍿", "Was schauen wir? 🍿")}</Text>
          </MiniBubble>

          {/* Paylaşılan film kartı (kendi mesajım) */}
          <MiniBubble mine style={{ maxWidth: "94%" }}>
            <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
              <ExpoImage
                source={{ uri: getTmdbUrl(media.poster_path, "poster", 200) }}
                style={duo.bubblePoster}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
              <View style={{ flex: 1 }}>
                <Text style={duo.bubbleTitle} numberOfLines={2}>{media.title}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 }}>
                  <Ionicons name="star" size={8} color={GOLD} />
                  <Text style={duo.bubbleMeta}>{media.vote_average}{media.year ? ` · ${media.year}` : ""}</Text>
                </View>
              </View>
            </View>
          </MiniBubble>

          <MiniBubble>
            <Text style={duo.bubbleText}>{L(lang, "Bu olur! 🔥", "That works! 🔥", "¡Me apunto! 🔥", "Bora! 🔥", "Passt! 🔥")}</Text>
          </MiniBubble>

          <View style={[duo.inputBar, { backgroundColor: theme.between, borderColor: theme.border }]}>
            <Ionicons name="add-circle-outline" size={13} color={accent} />
            <Text style={[duo.inputHint, { color: theme.text.muted }]}>{L(lang, "Mesaj yaz…", "Type…", "Escribe…", "Escreva…", "Schreib…")}</Text>
            <Ionicons name="send" size={11} color={accent} />
          </View>
        </View>

        <InfoCol
          theme={theme}
          accent={accent}
          eyebrow={L(lang, "BİREBİR SOHBET", "DIRECT CHAT", "CHAT INDIVIDUAL", "CONVERSA INDIVIDUAL", "DIREKTCHAT")}
          bullets={[
            { icon: "film-outline", text: L(lang, "Film kartı & fragman paylaş", "Share title cards & trailers", "Comparte fichas de títulos y tráileres", "Compartilhe fichas de títulos e trailers", "Titelkarten & Trailer teilen") },
            { icon: "list-outline", text: L(lang, "Listeni tek dokunuşla gönder", "Send lists in one tap", "Envía listas con un toque", "Envie listas com um toque", "Listen mit einem Tippen senden") },
            { icon: "flash-outline", text: L(lang, "Anında öneri alışverişi", "Swap picks instantly", "Intercambia recomendaciones al instante", "Troque recomendações na hora", "Tipps sofort austauschen") },
          ]}
        />
      </View>

      {/* ALT — bilgiler solda, grup sohbeti sağda */}
      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
        <InfoCol
          theme={theme}
          accent={accent}
          align="right"
          eyebrow={L(lang, "GRUP SOHBETİ", "GROUP CHAT", "CHAT DE GRUPO", "CONVERSA EM GRUPO", "GRUPPENCHAT")}
          bullets={[
            { icon: "bar-chart-outline", text: L(lang, "Posterli anketlerle oylayın", "Vote with poster polls", "Vota con encuestas con pósteres", "Vote com enquetes de pôsteres", "Mit Poster-Umfragen abstimmen") },
            { icon: "calendar-outline", text: L(lang, "Film gecesini planlayın", "Plan movie night", "Planifica la noche de cine", "Planeje a noite de cinema", "Filmabend planen") },
            { icon: "people-outline", text: L(lang, "Karar saniyeler içinde", "Decide in seconds", "Decidid en segundos", "Decidam em segundos", "In Sekunden entschieden") },
          ]}
        />

        <View style={[duo.card, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          <View style={duo.head}>
            <View style={{ flexDirection: "row" }}>
              {[
                { n: "c", c: theme.colors.blue },
                { n: "z", c: theme.colors.purple },
                { n: "m", c: theme.colors.orange },
              ].map((m, i) => (
                <View
                  key={m.n}
                  style={[
                    duo.groupAvatar,
                    { backgroundColor: alpha(m.c, 0.25), marginLeft: i === 0 ? 0 : -7, borderColor: theme.secondary },
                  ]}
                >
                  <Text style={[duo.groupAvatarText, { color: m.c }]}>{m.n.toUpperCase()}</Text>
                </View>
              ))}
            </View>
            <View style={{ flex: 1, marginLeft: 6 }}>
              <Text style={[duo.headName, { color: theme.text.primary }]} numberOfLines={1}>
                {L(lang, "Film Gecesi 🎬", "Movie Night 🎬", "Noche de cine 🎬", "Noite de cinema 🎬", "Filmabend 🎬")}
              </Text>
              <Text style={[duo.headSub, { color: theme.text.muted }]}>{L(lang, "4 üye", "4 members", "4 miembros", "4 membros", "4 Mitglieder")}</Text>
            </View>
          </View>

          <Text style={[duo.senderName, { color: theme.colors.blue }]}>can</Text>
          <MiniBubble>
            <Text style={duo.bubbleText}>{L(lang, "Herkes hazır mı? 🙌", "Everyone ready? 🙌", "¿Todos listos? 🙌", "Todo mundo pronto? 🙌", "Alle bereit? 🙌")}</Text>
          </MiniBubble>

          {/* Mini anket (gerçek yapımlarla) */}
          <Text style={[duo.senderName, { color: theme.colors.orange }]}>mert</Text>
          <MiniBubble style={{ maxWidth: "96%" }}>
            <Text style={duo.pollQuestion}>{L(lang, "Bu akşam hangisi?", "Which one tonight?", "¿Cuál esta noche?", "Qual hoje à noite?", "Welcher heute Abend?")}</Text>
            {[
              { m: pollA, pct: 67 },
              { m: pollB, pct: 33 },
            ].map(({ m, pct }, i) => (
              <View key={m.id} style={{ marginTop: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Text style={duo.pollLabel} numberOfLines={1}>
                    {m.title}
                  </Text>
                  <Text style={[duo.pollPct, { color: i === 0 ? "#B3AEFF" : "rgba(255,255,255,0.65)" }]}>{pct}%</Text>
                </View>
                <View style={duo.pollTrack}>
                  <View
                    style={[
                      duo.pollFill,
                      { width: `${pct}%`, backgroundColor: i === 0 ? "#6C63FF" : "rgba(255,255,255,0.35)" },
                    ]}
                  />
                </View>
              </View>
            ))}
            <Text style={duo.pollVotes}>{L(lang, "6 oy", "6 votes", "6 votos", "6 votos", "6 Stimmen")}</Text>
          </MiniBubble>
        </View>
      </View>
    </View>
  );
}

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
          <ProfileStat theme={theme} accent={accent} icon="film-outline" value="312" label={L(lang, "Film", "Movies", "Películas", "Filmes", "Filme")} />
          <ProfileStat theme={theme} accent={accent} icon="tv-outline" value="48" label={L(lang, "Dizi", "Shows", "Series", "Séries", "Serien")} />
          <ProfileStat
            theme={theme}
            accent={accent}
            icon="time-outline"
            value={L(lang, "18 gün", "18 days", "18 días", "18 dias", "18 Tage")}
            label={L(lang, "İzleme süresi", "Watch time", "Tiempo de visionado", "Tempo assistido", "Sehzeit")}
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
            <Text style={pf.wrappedSub}>{L(lang, "Yılın izleme özetin hazır", "Your year in watching", "Tu año viendo cine y series", "Seu ano assistindo filmes e séries", "Dein Seh-Jahr")}</Text>
          </View>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </View>

        <Text style={[pf.label, { color: theme.text.muted }]}>{L(lang, "FAVORİLERİN", "YOUR FAVORITES", "TUS FAVORITOS", "SEUS FAVORITOS", "DEINE FAVORITEN")}</Text>
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
          {L(lang, "ARKADAŞLARIN NE İZLİYOR", "WHAT FRIENDS ARE WATCHING", "LO QUE VEN TUS AMIGOS", "O QUE SEUS AMIGOS ESTÃO ASSISTINDO", "WAS FREUNDE SCHAUEN")}
        </Text>
        <FriendActivity
          first
          theme={theme}
          name="zeynep"
          color={green}
          verb={L(lang, "izledi", "watched", "vio", "assistiu", "gesehen")}
          item={friendA}
          getTmdbUrl={getTmdbUrl}
        />
        <FriendActivity
          theme={theme}
          name="can"
          color={blue}
          verb={L(lang, "puanladı", "rated", "puntuó", "avaliou", "bewertet")}
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

// Mini bracket stilleri
const mb = StyleSheet.create({
  champPill: {
    marginTop: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  champPillText: { fontSize: 7.5, fontWeight: "900", letterSpacing: 0.5 },
  caption: { fontSize: 9.5, fontWeight: "600", textAlign: "center", marginTop: 10 },
});

// Sohbet + grup (duo) stilleri — baloncuk renkleri ChatScreen ile aynı
const duo = StyleSheet.create({
  card: {
    width: "60%",
    borderRadius: 18,
    borderWidth: 1,
    padding: 9,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 5,
  },
  head: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  avatar: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 10, fontWeight: "800" },
  headName: { fontSize: 11, fontWeight: "800" },
  headSub: { fontSize: 8.5, fontWeight: "600" },
  groupAvatar: { width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  groupAvatarText: { fontSize: 8.5, fontWeight: "800" },
  senderName: { fontSize: 8.5, fontWeight: "800", marginLeft: 6, marginBottom: 2 },

  bubble: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 12,
    maxWidth: "88%",
    marginBottom: 6,
  },
  mine: {
    alignSelf: "flex-end",
    backgroundColor: "#17245cff",
    borderTopRightRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(108,99,255,0.35)",
  },
  their: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(68, 68, 68, 1)",
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  bubbleText: { fontSize: 10.5, lineHeight: 15, color: "#fff" },
  bubblePoster: { width: 24, height: 36, borderRadius: 5, backgroundColor: "rgba(255,255,255,0.08)" },
  bubbleTitle: { fontSize: 10, fontWeight: "800", color: "#fff", lineHeight: 12.5 },
  bubbleMeta: { fontSize: 8.5, fontWeight: "600", color: "rgba(255,255,255,0.8)" },

  pollQuestion: { fontSize: 10, fontWeight: "800", color: "#fff" },
  pollLabel: { fontSize: 9, fontWeight: "600", color: "rgba(255,255,255,0.92)", flex: 1 },
  pollPct: { fontSize: 9, fontWeight: "800" },
  pollTrack: { height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.18)", marginTop: 3, overflow: "hidden" },
  pollFill: { height: "100%", borderRadius: 2 },
  pollVotes: { fontSize: 8, fontWeight: "600", color: "rgba(255,255,255,0.6)", marginTop: 6 },

  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 2,
  },
  inputHint: { flex: 1, fontSize: 9, fontWeight: "500" },

  infoCol: { flex: 1, justifyContent: "center", gap: 8 },
  infoEyebrow: { fontSize: 9, fontWeight: "900", letterSpacing: 1, marginBottom: 2 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  infoIcon: { width: 18, height: 18, borderRadius: 6, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  infoText: { fontSize: 10, lineHeight: 13.5, fontWeight: "600", flex: 1 },
});

// Çapraz düzendeki mini kartların (oyna / paylaş / profil) ortak stilleri
const mini = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 999 },
  pillText: { fontSize: 8.5, fontWeight: "800" },

  // Sahne tahmin
  scene: { width: "100%", height: 58, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.05)" },
  timer: { position: "absolute", top: 4, right: 4, flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.72)" },
  timerText: { color: "#fff", fontSize: 8, fontWeight: "800" },
  opt: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 5 },
  optDot: { width: 9, height: 9, borderRadius: 5, borderWidth: 1, marginHorizontal: 1 },
  optText: { fontSize: 9, fontWeight: "700", flex: 1 },

  // Mini post kartı
  badge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5, borderWidth: StyleSheet.hairlineWidth },
  badgeText: { fontSize: 7.5, fontWeight: "800", letterSpacing: 0.3 },
  postPoster: { width: 26, height: 39, borderRadius: 5 },
  postTitle: { fontSize: 9.5, fontWeight: "800", marginBottom: 2 },
  postText: { fontSize: 8.5, lineHeight: 11.5, marginTop: 3 },
  postFoot: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8, paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth },
  postFootText: { fontSize: 8.5, fontWeight: "700", marginRight: 5 },
});

// ── Post / Story / Profil / İstatistik / Liste stilleri (gerçek ekranlarla birebir) ──
const ps = StyleSheet.create({
  // PostCard
  card: {
    width: "100%",
    borderRadius: 16,
    padding: 13,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  avatar: { width: 34, height: 34, borderRadius: 17 },
  userName: { fontSize: 13.5, fontWeight: "700", maxWidth: 150 },
  badge: {
    marginLeft: 7,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badgeText: { fontSize: 8.5, fontWeight: "800", letterSpacing: 0.4 },
  time: { fontSize: 10.5, marginTop: 2 },
  title: { fontSize: 14.5, fontWeight: "700", marginBottom: 4 },
  content: { fontSize: 13, lineHeight: 18.5 },
  mediaCard: { width: 78, height: 117, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  mediaPoster: { width: "100%", height: "100%" },
  ratingPill: {
    marginTop: -11,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  ratingNumber: { fontSize: 11, fontWeight: "700", marginLeft: 2 },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 9,
    marginTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 14,
  },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  actionText: { fontSize: 12, fontWeight: "600" },

  // Story kartı (StoryShareScreen çıktısı)
  storyCard: { width: 130, height: 200, borderRadius: 14, overflow: "hidden", backgroundColor: "#000" },
  storyTop: { position: "absolute", top: 8, left: 10 },
  storyBrand: { color: "#fff", fontSize: 13, fontWeight: "900", letterSpacing: 0.2 },
  storyBottom: { position: "absolute", bottom: 10, left: 10, right: 10 },
  storyTitle: { color: "#fff", fontSize: 15, fontWeight: "800" },
  storyRating: { color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "700" },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 999,
  },
  shareBtnText: { color: "#fff", fontSize: 13, fontWeight: "800" },
});

const styles = StyleSheet.create({
  panelShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },

  // Ortak başlık
  aiHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  aiAvatar: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  aiName: { fontSize: 14.5, fontWeight: "800" },
  aiSub: { fontSize: 11.5, fontWeight: "500", marginTop: 1 },

  mediaMeta: { fontSize: 11, fontWeight: "500", marginTop: 1 },

  // Turnuva
  pastPill: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  pastPillText: { fontSize: 10.5, fontWeight: "700" },

  // Paylaş — story etiketi
  blockLabel: { fontSize: 10.5, fontWeight: "800", letterSpacing: 0.5 },
});
