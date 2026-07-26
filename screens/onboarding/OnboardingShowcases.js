// screens/onboarding/OnboardingShowcases.js
//
// Onboarding tanıtım slaytları için özellik gösterimleri.
// Tüm örnek içerikler TMDB'den gelen GERÇEK yapımlarla beslenir
// (poster/başlık/puan/yıl tutarlı). Kompakt tasarım hedefi:
//  - AI: 5 cevap stilinin TAMAMI aynı anda açık, 2'li mini kart grid'i
//  - Sohbet: birebir sohbet sol üstte, grup sohbeti sağ altta, yanlarında bilgi
//  - Turnuva: kaydırma gerektirmeyen kompakt mini ağaç (MiniBracket)
//  - Oyna: sahne tahmini + aylık turnuva + post paylaşımı, sohbetteki çapraz mini kart düzeniyle
//  - Profil: kendi profilin + arkadaş profili kartı, aynı çapraz kompakt düzen

import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image as ExpoImage } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import { alpha } from "../../theme/colors";

const GAME_TOKENS = { correct: "#00E676", incorrect: "#FF1744" };
const GOLD = "#F5C518";

const L = (lang, tr, en) => (lang === "en" ? en : tr);
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
        {L(lang, "İçerik yükleniyor…", "Loading…")}
      </Text>
    </Panel>
  );
}

/* ═══════════════════════ 1. YAPAY ZEKÂ — hepsi açık mini grid ═══════════════ */

// Mini yıldız + puan
function MiniStar({ rating, color }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
      <Ionicons name="star" size={8.5} color={GOLD} />
      <Text style={{ fontSize: 8.5, fontWeight: "800", color }}>{rating}</Text>
    </View>
  );
}

// Mini poster + başlık satırı (öneri/liste kartlarında)
function AiItemRow({ item, getTmdbUrl, theme }) {
  return (
    <View style={ai.itemRow}>
      <ExpoImage
        source={{ uri: getTmdbUrl(item.poster_path, "poster", 200) }}
        style={ai.itemPoster}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
      <View style={{ flex: 1 }}>
        <Text style={[ai.itemTitle, { color: theme.text.primary }]} numberOfLines={1}>
          {item.title}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 1 }}>
          <Text style={[ai.itemMeta, { color: theme.text.muted }]}>{item.year}</Text>
          <MiniStar rating={item.vote_average} color={theme.text.secondary} />
        </View>
      </View>
    </View>
  );
}

// Karşılaştırma metriği: iki taraflı mini bar
function VsBar({ label, l, r, theme, accent, orange }) {
  return (
    <View style={{ marginTop: 7 }}>
      <Text style={[ai.vsLabel, { color: theme.text.muted }]}>{label}</Text>
      <View style={[ai.vsTrack, { backgroundColor: alpha(theme.text.muted, 0.14) }]}>
        <View style={{ flex: l, backgroundColor: accent, borderRadius: 2 }} />
        <View style={{ width: 3 }} />
        <View style={{ flex: r, backgroundColor: orange, borderRadius: 2 }} />
      </View>
    </View>
  );
}

// Grid'deki tek mini özellik kartı
function AiMiniCard({ theme, accent, icon, label, full, children }) {
  return (
    <View
      style={[
        ai.card,
        {
          backgroundColor: theme.secondary,
          borderColor: theme.border,
          width: full ? "100%" : "48%",
        },
      ]}
    >
      <View style={ai.head}>
        <View style={[ai.headIcon, { backgroundColor: alpha(accent, 0.15) }]}>
          <Ionicons name={icon} size={11} color={accent} />
        </View>
        <Text style={[ai.headText, { color: theme.text.secondary }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      {children}
    </View>
  );
}

export function AiShowcase({ theme, accent, mediaItems = [], getTmdbUrl, lang = "tr" }) {
  const orange = theme.colors?.orange || "#FF7C25";
  const movies = useMemo(() => {
    const mv = mediaItems.filter((x) => x.media_type === "movie");
    return mv.length >= 5 ? mv : mediaItems;
  }, [mediaItems]);

  if (movies.length < 5) return <LoadingCard theme={theme} lang={lang} />;
  const [m0, m1, m2, m3, m4] = movies;
  const winner = (m0.vote_average || 0) >= (m1.vote_average || 0) ? m0 : m1;

  return (
    <View style={{ width: "100%", maxWidth: 360 }}>
      {/* Kullanıcı sorusu + AI'ın çoklu-format cevabı hissi */}
      <View style={[ai.qBubble, { backgroundColor: alpha(accent, 0.14), borderColor: alpha(accent, 0.3) }]}>
        <Text style={[ai.qText, { color: theme.text.primary }]}>
          {L(lang, "“Bu akşam ne izlesem?” 🍿", "“What should I watch tonight?” 🍿")}
        </Text>
      </View>
      <View style={ai.hintRow}>
        <Ionicons name="sparkles" size={11} color={accent} />
        <Text style={[ai.hintText, { color: theme.text.muted }]}>
          {L(lang, "Seelogd AI — 5 farklı cevap stili", "Seelogd AI — 5 answer styles")}
        </Text>
      </View>

      <View style={ai.grid}>
        {/* Öneri */}
        <AiMiniCard theme={theme} accent={accent} icon="sparkles" label={L(lang, "Öneri", "Suggest")}>
          <AiItemRow item={m0} getTmdbUrl={getTmdbUrl} theme={theme} />
          <AiItemRow item={m1} getTmdbUrl={getTmdbUrl} theme={theme} />
          <Text style={[ai.footNote, { color: theme.text.muted }]} numberOfLines={1}>
            {L(lang, "Ruh haline göre seçildi", "Picked for your mood")}
          </Text>
        </AiMiniCard>

        {/* Karşılaştır */}
        <AiMiniCard theme={theme} accent={accent} icon="git-compare" label={L(lang, "Karşılaştır", "Compare")}>
          <View style={ai.vsHead}>
            <ExpoImage source={{ uri: getTmdbUrl(m0.poster_path, "poster", 200) }} style={ai.vsPoster} contentFit="cover" cachePolicy="memory-disk" />
            <View style={[ai.vsBadge, { backgroundColor: alpha(accent, 0.16) }]}>
              <Text style={[ai.vsBadgeText, { color: accent }]}>VS</Text>
            </View>
            <ExpoImage source={{ uri: getTmdbUrl(m1.poster_path, "poster", 200) }} style={ai.vsPoster} contentFit="cover" cachePolicy="memory-disk" />
          </View>
          <VsBar label={L(lang, "Hikâye", "Story")} l={4} r={5} theme={theme} accent={accent} orange={orange} />
          <VsBar label={L(lang, "Görsellik", "Visuals")} l={5} r={4} theme={theme} accent={accent} orange={orange} />
          <View style={ai.verdictRow}>
            <Ionicons name="trophy" size={10} color={GOLD} />
            <Text style={[ai.verdictText, { color: theme.text.secondary }]} numberOfLines={1}>
              {winner.title}
            </Text>
          </View>
        </AiMiniCard>

        {/* İzleme Planı */}
        <AiMiniCard theme={theme} accent={accent} icon="calendar" label={L(lang, "İzleme Planı", "Watch Plan")}>
          {[m0, m1, m2].map((m, i) => (
            <View key={m.id} style={ai.planRow}>
              <View style={[ai.dayBadge, { backgroundColor: alpha(accent, 0.15) }]}>
                <Text style={[ai.dayBadgeText, { color: accent }]}>{i + 1}</Text>
              </View>
              <ExpoImage source={{ uri: getTmdbUrl(m.poster_path, "poster", 200) }} style={ai.planPoster} contentFit="cover" cachePolicy="memory-disk" />
              <Text style={[ai.planTitle, { color: theme.text.primary }]} numberOfLines={1}>
                {m.title}
              </Text>
            </View>
          ))}
          <Text style={[ai.footNote, { color: theme.text.muted }]} numberOfLines={1}>
            {L(lang, "Hafta sonu maratonu", "Weekend marathon")}
          </Text>
        </AiMiniCard>

        {/* Liste */}
        <AiMiniCard theme={theme} accent={accent} icon="list" label={L(lang, "Liste", "List")}>
          {[m2, m3, m4].map((m, i) => (
            <View key={m.id} style={ai.listRow}>
              <Ionicons name={i === 0 ? "star" : "bookmark"} size={10} color={i === 0 ? GOLD : accent} />
              <Text style={[ai.listTitle, { color: theme.text.primary }]} numberOfLines={1}>
                {m.title}
              </Text>
              <MiniStar rating={m.vote_average} color={theme.text.secondary} />
            </View>
          ))}
          <Text style={[ai.footNote, { color: theme.text.muted }]} numberOfLines={1}>
            {L(lang, "Tek dokunuşla listene ekle", "Add to your list in one tap")}
          </Text>
        </AiMiniCard>

        {/* Künye — tam genişlik */}
        <AiMiniCard theme={theme} accent={accent} icon="information-circle" label={L(lang, "Künye", "Spotlight")} full>
          <View style={ai.spotRow}>
            <ExpoImage source={{ uri: getTmdbUrl(m1.poster_path, "poster", 200) }} style={ai.spotPoster} contentFit="cover" cachePolicy="memory-disk" />
            <View style={{ flex: 1 }}>
              <Text style={[ai.spotTitle, { color: theme.text.primary }]} numberOfLines={1}>
                {m1.title}
              </Text>
              <View style={ai.chipRow}>
                {[m1.year, ...(m1.genres || []).slice(0, 2)].filter(Boolean).map((c) => (
                  <View key={c} style={[ai.chip, { borderColor: theme.border, backgroundColor: theme.between }]}>
                    <Text style={[ai.chipText, { color: theme.text.secondary }]}>{c}</Text>
                  </View>
                ))}
                <MiniStar rating={m1.vote_average} color={theme.text.secondary} />
              </View>
              <Text style={[ai.spotSummary, { color: theme.text.muted }]} numberOfLines={2}>
                {clip(m1.overview, 90) || L(lang, "Tür, oyuncular, benzer yapımlar ve daha fazlası…", "Genres, cast, similar titles and more…")}
              </Text>
              <View style={ai.similarRow}>
                <Text style={[ai.footNote, { color: theme.text.muted, marginTop: 0 }]}>
                  {L(lang, "Benzer:", "Similar:")}
                </Text>
                {[m0, m2, m3].map((m) => (
                  <ExpoImage key={m.id} source={{ uri: getTmdbUrl(m.poster_path, "poster", 200) }} style={ai.similarPoster} contentFit="cover" cachePolicy="memory-disk" />
                ))}
              </View>
            </View>
          </View>
        </AiMiniCard>
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
              {L(lang, "ŞAMPİYON", "CHAMPION")}
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
    return d.toLocaleDateString(lang === "en" ? "en-US" : "tr-TR", { month: "long", year: "numeric" });
  }, [lang]);

  return (
    <Panel theme={theme}>
      <View style={styles.aiHeader}>
        <View style={[styles.aiAvatar, { backgroundColor: alpha(GOLD, 0.18) }]}>
          <Ionicons name="trophy" size={16} color={GOLD} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.aiName, { color: theme.text.primary }]}>
            {L(lang, "Aylık Turnuva", "Monthly Tournament")}
          </Text>
          <Text style={[styles.aiSub, { color: theme.text.muted }]}>{prevMonth}</Text>
        </View>
        <View style={[styles.pastPill, { backgroundColor: alpha(theme.text.muted, 0.14) }]}>
          <Ionicons name="time-outline" size={11} color={theme.text.muted} />
          <Text style={[styles.pastPillText, { color: theme.text.muted }]}>
            {L(lang, "Geçen ay", "Last month")}
          </Text>
        </View>
      </View>

      {posterPaths.length ? (
        <>
          <MiniBracket theme={theme} accent={accent} posterPaths={posterPaths} getTmdbUrl={getTmdbUrl} lang={lang} />
          <Text style={[mb.caption, { color: theme.text.muted }]}>
            {L(lang, "32 yapım · 1.2k oy · her ay yenilenir", "32 titles · 1.2k votes · renews monthly")}
          </Text>
        </>
      ) : (
        <Text style={[styles.aiSub, { color: theme.text.muted, paddingVertical: 20, textAlign: "center" }]}>
          {L(lang, "Ağaç yükleniyor…", "Loading bracket…")}
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
                <Text style={[ps.badgeText, { color: blue }]}>{L(lang, "İNCELEME", "REVIEW")}</Text>
              </View>
            </View>
            <Text style={[ps.time, { color: theme.text.muted }]}>{L(lang, "2 saat önce", "2h ago")}</Text>
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
              {clip(post.overview, 150) || L(lang, "Kesinlikle önerdiğim bir yapım!", "A title I highly recommend!")}
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
          {L(lang, "HİKÂYE PAYLAŞIMI", "STORY SHARE")}
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
              {L(lang, "İzlediğin içeriği şık bir kartla hikâyende paylaş.", "Share what you watched as a sleek story card.")}
            </Text>
            <View style={[ps.shareBtn, { backgroundColor: accent }]}>
              <Ionicons name="share-social" size={14} color="#fff" />
              <Text style={ps.shareBtnText}>{L(lang, "Hikâyeye Ekle", "Add to Story")}</Text>
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
                {L(lang, "Sahne Tahmin", "Guess the Scene")}
              </Text>
              <Text style={[duo.headSub, { color: theme.text.muted }]}>
                {L(lang, "Soru 3/10", "Q 3/10")}
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
          eyebrow={L(lang, "SAHNE TAHMİN", "GUESS THE SCENE")}
          bullets={[
            { icon: "film-outline", text: L(lang, "Sahneden yapımı bil", "Guess the title from a scene") },
            { icon: "flash-outline", text: L(lang, "Klasik · Zamana Karşı · Günlük", "Classic · Time Attack · Daily") },
            { icon: "flame-outline", text: L(lang, "Seri yap, puanını katla", "Build streaks, boost your score") },
          ]}
        />
      </View>

      {/* ORTA — bilgiler solda, aylık turnuva sağda */}
      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
        <InfoCol
          theme={theme}
          accent={accent}
          align="right"
          eyebrow={L(lang, "AYLIK TURNUVA", "MONTHLY TOURNAMENT")}
          bullets={[
            { icon: "trophy-outline", text: L(lang, "32 yapım kapışır", "32 titles face off") },
            { icon: "people-outline", text: L(lang, "Şampiyonu topluluk seçer", "The community picks the champion") },
            { icon: "refresh-outline", text: L(lang, "Her ay yeni turnuva", "A fresh bracket every month") },
          ]}
        />

        <View style={[duo.card, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          <View style={duo.head}>
            <View style={[duo.avatar, { backgroundColor: alpha(GOLD, 0.18) }]}>
              <Ionicons name="trophy" size={11} color={GOLD} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[duo.headName, { color: theme.text.primary }]} numberOfLines={1}>
                {L(lang, "Aylık Turnuva", "Monthly Tournament")}
              </Text>
              <Text style={[duo.headSub, { color: theme.text.muted }]}>
                {L(lang, "1.2k oy", "1.2k votes")}
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
                {L(lang, "2 sa önce", "2h ago")}
              </Text>
            </View>
            <View style={[mini.badge, { backgroundColor: alpha(blue, 0.13), borderColor: alpha(blue, 0.33) }]}>
              <Text style={[mini.badgeText, { color: blue }]}>{L(lang, "İNCELEME", "REVIEW")}</Text>
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
                {clip(post.overview, 70) || L(lang, "Kesinlikle önerdiğim bir yapım!", "A title I highly recommend!")}
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
          eyebrow={L(lang, "PAYLAŞ", "SHARE")}
          bullets={[
            { icon: "create-outline", text: L(lang, "Puanla ve incele", "Rate and review") },
            { icon: "heart-outline", text: L(lang, "Beğeni ve yorum al", "Get likes and comments") },
            { icon: "share-social-outline", text: L(lang, "Skorunu kartla paylaş", "Share your score as a card") },
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
              <Text style={[duo.headSub, { color: theme.colors.green }]}>
                {L(lang, "çevrimiçi", "online")}
              </Text>
            </View>
            <Ionicons name="videocam-outline" size={13} color={theme.text.muted} />
          </View>

          <MiniBubble>
            <Text style={duo.bubbleText}>{L(lang, "Bu akşam ne izlesek? 🍿", "What should we watch? 🍿")}</Text>
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
            <Text style={duo.bubbleText}>{L(lang, "Bu olur! 🔥", "That works! 🔥")}</Text>
          </MiniBubble>

          <View style={[duo.inputBar, { backgroundColor: theme.between, borderColor: theme.border }]}>
            <Ionicons name="add-circle-outline" size={13} color={accent} />
            <Text style={[duo.inputHint, { color: theme.text.muted }]}>{L(lang, "Mesaj yaz…", "Type…")}</Text>
            <Ionicons name="send" size={11} color={accent} />
          </View>
        </View>

        <InfoCol
          theme={theme}
          accent={accent}
          eyebrow={L(lang, "BİREBİR SOHBET", "DIRECT CHAT")}
          bullets={[
            { icon: "film-outline", text: L(lang, "Film kartı & fragman paylaş", "Share title cards & trailers") },
            { icon: "list-outline", text: L(lang, "Listeni tek dokunuşla gönder", "Send lists in one tap") },
            { icon: "flash-outline", text: L(lang, "Anında öneri alışverişi", "Swap picks instantly") },
          ]}
        />
      </View>

      {/* ALT — bilgiler solda, grup sohbeti sağda */}
      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
        <InfoCol
          theme={theme}
          accent={accent}
          align="right"
          eyebrow={L(lang, "GRUP SOHBETİ", "GROUP CHAT")}
          bullets={[
            { icon: "bar-chart-outline", text: L(lang, "Posterli anketlerle oylayın", "Vote with poster polls") },
            { icon: "calendar-outline", text: L(lang, "Film gecesini planlayın", "Plan movie night") },
            { icon: "people-outline", text: L(lang, "Karar saniyeler içinde", "Decide in seconds") },
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
                {L(lang, "Film Gecesi 🎬", "Movie Night 🎬")}
              </Text>
              <Text style={[duo.headSub, { color: theme.text.muted }]}>{L(lang, "4 üye", "4 members")}</Text>
            </View>
          </View>

          <Text style={[duo.senderName, { color: theme.colors.blue }]}>can</Text>
          <MiniBubble>
            <Text style={duo.bubbleText}>{L(lang, "Herkes hazır mı? 🙌", "Everyone ready? 🙌")}</Text>
          </MiniBubble>

          {/* Mini anket (gerçek yapımlarla) */}
          <Text style={[duo.senderName, { color: theme.colors.orange }]}>mert</Text>
          <MiniBubble style={{ maxWidth: "96%" }}>
            <Text style={duo.pollQuestion}>{L(lang, "Bu akşam hangisi?", "Which one tonight?")}</Text>
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
            <Text style={duo.pollVotes}>{L(lang, "6 oy", "6 votes")}</Text>
          </MiniBubble>
        </View>
      </View>
    </View>
  );
}

/* ═══════════════════════ 6. PROFİL — sen + arkadaş profili (çapraz düzen) ═══ */

export function ProfileShowcase({ theme, accent, posters = [], lang = "tr" }) {
  const green = theme.colors?.green || "#3ddc84";
  const posterAt = (i) => (posters.length ? posters[i % posters.length] : undefined);

  return (
    <View style={{ width: "100%", maxWidth: 360, gap: 12 }}>
      {/* ÜST — kendi profilin solda, bilgiler sağda */}
      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
        <View
          style={[
            duo.card,
            { backgroundColor: theme.secondary, borderColor: theme.border, padding: 0, overflow: "hidden" },
          ]}
        >
          <View style={{ height: 26, backgroundColor: alpha(accent, 0.2) }} />
          <View style={{ paddingHorizontal: 9, paddingBottom: 9 }}>
            <View style={[mini.pAvatar, { backgroundColor: theme.between, borderColor: theme.secondary }]}>
              <Text style={[mini.pAvatarText, { color: accent }]}>D</Text>
            </View>
            <Text style={[mini.pName, { color: theme.text.primary }]} numberOfLines={1}>Deniz A.</Text>
            <Text style={[mini.pHandle, { color: theme.text.muted }]} numberOfLines={1}>@deniza</Text>

            {/* Mini istatistik hücreleri */}
            <View style={mini.statRow}>
              {[
                { n: "312", l: L(lang, "Film", "Movies") },
                { n: "48", l: L(lang, "Dizi", "Shows") },
                { n: "18g", l: L(lang, "Süre", "Time") },
              ].map((s) => (
                <View
                  key={s.l}
                  style={[mini.statCell, { backgroundColor: theme.between, borderColor: theme.border }]}
                >
                  <Text style={[mini.statNum, { color: theme.text.primary }]}>{s.n}</Text>
                  <Text style={[mini.statLabel, { color: theme.text.muted }]}>{s.l}</Text>
                </View>
              ))}
            </View>

            {/* Wrapped mini şeridi */}
            <View style={mini.wrappedStrip}>
              <LinearGradient
                colors={[accent, "#7C3AED"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <MaterialCommunityIcons name="star-four-points" size={10} color="#fff" />
              <Text style={mini.wrappedStripText} numberOfLines={1}>Wrapped 2025</Text>
              <View style={{ flex: 1 }} />
              <Ionicons name="arrow-forward" size={10} color="#fff" />
            </View>
          </View>
        </View>

        <InfoCol
          theme={theme}
          accent={accent}
          eyebrow={L(lang, "SENİN PROFİLİN", "YOUR PROFILE")}
          bullets={[
            { icon: "stats-chart-outline", text: L(lang, "Film & dizi istatistiklerin", "Your movie & show stats") },
            { icon: "time-outline", text: L(lang, "Toplam izleme süren", "Your total watch time") },
            { icon: "gift-outline", text: L(lang, "Yıl sonu özetin: Wrapped", "Your year in review: Wrapped") },
          ]}
        />
      </View>

      {/* ALT — bilgiler solda, arkadaş profili sağda */}
      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
        <InfoCol
          theme={theme}
          accent={accent}
          align="right"
          eyebrow={L(lang, "ARKADAŞ PROFİLİ", "FRIEND PROFILES")}
          bullets={[
            { icon: "person-add-outline", text: L(lang, "Takip et, takipleş", "Follow and connect") },
            { icon: "albums-outline", text: L(lang, "Listelerini ve favorilerini gör", "See their lists & favorites") },
            { icon: "chatbubble-outline", text: L(lang, "Tek dokunuşla sohbet başlat", "Start a chat in one tap") },
          ]}
        />

        <View
          style={[
            duo.card,
            { backgroundColor: theme.secondary, borderColor: theme.border, padding: 0, overflow: "hidden" },
          ]}
        >
          <View style={{ height: 26, backgroundColor: alpha(green, 0.18) }} />
          <View style={{ paddingHorizontal: 9, paddingBottom: 9 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
              <View style={[mini.pAvatar, { backgroundColor: theme.between, borderColor: theme.secondary }]}>
                <Text style={[mini.pAvatarText, { color: green }]}>Z</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingBottom: 2 }}>
                <View style={[mini.followBtn, { backgroundColor: accent }]}>
                  <Text style={mini.followBtnText}>{L(lang, "Takip Et", "Follow")}</Text>
                </View>
                <View style={[mini.msgBtn, { borderColor: theme.border }]}>
                  <Ionicons name="chatbubble-outline" size={10} color={theme.text.secondary} />
                </View>
              </View>
            </View>
            <Text style={[mini.pName, { color: theme.text.primary }]} numberOfLines={1}>Zeynep K.</Text>
            <Text style={[mini.pHandle, { color: theme.text.muted }]} numberOfLines={1}>
              @zeynepk · {L(lang, "184 takipçi", "184 followers")}
            </Text>

            <Text style={[mini.friendLabel, { color: theme.text.muted }]}>
              {L(lang, "FAVORİLERİ", "THEIR FAVORITES")}
            </Text>
            <View style={mini.friendPosters}>
              {[0, 1, 2].map((k) => (
                <ExpoImage
                  key={k}
                  source={{ uri: posterAt(k + 6) }}
                  style={[mini.friendPoster, { backgroundColor: theme.between }]}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ))}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

/* ═══════════════════════ Stiller ════════════════════════════════════════════ */

// AI mini grid stilleri
const ai = StyleSheet.create({
  qBubble: {
    alignSelf: "flex-end",
    borderRadius: 14,
    borderTopRightRadius: 4,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 11,
  },
  qText: { fontSize: 11.5, fontWeight: "700" },
  hintRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8, marginBottom: 10 },
  hintText: { fontSize: 9.5, fontWeight: "700", letterSpacing: 0.3 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 9, justifyContent: "space-between" },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 9,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  head: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 3 },
  headIcon: { width: 18, height: 18, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  headText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3, flex: 1 },

  itemRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  itemPoster: { width: 22, height: 33, borderRadius: 5, backgroundColor: "rgba(255,255,255,0.06)" },
  itemTitle: { fontSize: 10, fontWeight: "700" },
  itemMeta: { fontSize: 8.5, fontWeight: "500" },
  footNote: { fontSize: 8.5, fontWeight: "600", marginTop: 8, fontStyle: "italic" },

  vsHead: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 },
  vsPoster: { width: 26, height: 39, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.06)" },
  vsBadge: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  vsBadgeText: { fontSize: 8, fontWeight: "900" },
  vsLabel: { fontSize: 8.5, fontWeight: "600", marginBottom: 3 },
  vsTrack: { flexDirection: "row", height: 4, borderRadius: 2, overflow: "hidden" },
  verdictRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
  verdictText: { fontSize: 9, fontWeight: "800", flex: 1 },

  planRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  dayBadge: { width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  dayBadgeText: { fontSize: 8.5, fontWeight: "900" },
  planPoster: { width: 18, height: 27, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.06)" },
  planTitle: { fontSize: 9.5, fontWeight: "700", flex: 1 },

  listRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 7 },
  listTitle: { fontSize: 9.5, fontWeight: "700", flex: 1 },

  spotRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  spotPoster: { width: 44, height: 66, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.06)" },
  spotTitle: { fontSize: 12, fontWeight: "800" },
  chipRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4, marginTop: 4 },
  chip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 8.5, fontWeight: "700" },
  spotSummary: { fontSize: 9.5, lineHeight: 13, marginTop: 5 },
  similarRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 7 },
  similarPoster: { width: 18, height: 27, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.06)" },
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

  // Mini profil kartları
  pAvatar: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: "center", justifyContent: "center", marginTop: -13 },
  pAvatarText: { fontSize: 12, fontWeight: "800" },
  pName: { fontSize: 11, fontWeight: "800", marginTop: 4 },
  pHandle: { fontSize: 8.5, marginTop: 1 },
  statRow: { flexDirection: "row", gap: 4, marginTop: 8 },
  statCell: { flex: 1, alignItems: "center", borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 5 },
  statNum: { fontSize: 10.5, fontWeight: "900" },
  statLabel: { fontSize: 7.5, marginTop: 1 },
  wrappedStrip: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 6, marginTop: 8, overflow: "hidden" },
  wrappedStripText: { color: "#fff", fontSize: 8.5, fontWeight: "900", letterSpacing: 0.2 },
  followBtn: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  followBtnText: { color: "#fff", fontSize: 8.5, fontWeight: "800" },
  msgBtn: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  friendLabel: { fontSize: 7.5, fontWeight: "800", letterSpacing: 0.6, marginTop: 9 },
  friendPosters: { flexDirection: "row", gap: 4, marginTop: 5 },
  friendPoster: { flex: 1, aspectRatio: 2 / 3, borderRadius: 6 },
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
