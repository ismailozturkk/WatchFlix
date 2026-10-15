// components/theme/ThemePreviewCard.js
//
// Özel tema oluşturucu için canlı önizleme. Verilen tam tema nesnesinden mini bir
// uygulama mockup'ı çizer; kullanıcı seçtiği renklerin gerçek arayüzde nasıl
// görüneceğini görür. İki sahne:
//   • "home"   — üst bar, hero kart, istatistikler, vurgu düğmesi, sekme çubuğu
//   • "detail" — vurgu → koyu vurgu degradeli afiş, puan, türler, ilerleme,
//                sekmeler ve anahtar. `bold`, `between` ve `border` gibi ana
//                sahnede görünmeyen token'lar burada kendini gösterir.
//
// `mini`: kısa ekranlar (< 700 dp, ör. iPhone SE) için compact'ın da altı — üst
// çubuk, sekme çubuğu ve ilerleme satırı atılır; kaydırılan alana yer açılır.
// `compact`: ekrana SABİTLENEN yoğun sürüm (~215 pt) — kullanıcı aşağıdaki
// denetimlerde gezinirken canlı önizleme gözden kaçmasın. Aynı token'lar görünür,
// yalnız ikincil öğeler (istatistik şeridi, özet, anahtar satırı) atılır.
//
// Düğme yazısı BEYAZ: uygulamada vurgu zeminli düğmelerin yazısı beyaz
// (yerleşik temaların hepsi beyaza karşı >= 3.2:1); önizleme gerçeği yansıtsın,
// zayıf bir vurgu burada da zayıf görünsün.

import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";

const ON_ACCENT = "#FFFFFF";

function TabBar({ theme, compact }) {
  return (
    <View style={[styles.tabBar, compact && styles.tabBarCompact, { backgroundColor: theme.tab, borderTopColor: theme.border }]}>
      {["home", "search", "heart", "person"].map((icon, i) => (
        <AppIcon
          key={icon}
          family="Ionicons"
          name={i === 0 ? icon : `${icon}-outline`}
          size={18}
          color={i === 0 ? theme.accent : theme.text.muted}
        />
      ))}
    </View>
  );
}

function HomeScene({ theme, t, compact, mini }) {
  return (
    <>
      {/* Üst bar */}
      {mini ? null : (
        <View style={[styles.topBar, compact && styles.topBarCompact, { backgroundColor: theme.secondary, borderBottomColor: theme.border }]}>
          <View style={styles.topCopy}>
            <Text style={[styles.topTitle, { color: theme.text.primary }]} numberOfLines={1}>{t("Önizleme", "Preview")}</Text>
            {compact ? null : (
              <Text style={[styles.topSub, { color: theme.text.muted }]} numberOfLines={1}>{t("Temanın görünümü", "Your theme in action")}</Text>
            )}
          </View>
          <View style={[styles.topAction, { backgroundColor: theme.accent }]}>
            <AppIcon family="Ionicons" name="search" size={15} color={ON_ACCENT} />
          </View>
        </View>
      )}

      <View style={[styles.body, compact && styles.bodyCompact]}>
        {/* Hero kart */}
        <View style={[styles.heroCard, compact && styles.heroCardCompact, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          <View style={[styles.poster, compact && styles.posterCompact, { backgroundColor: theme.between }]}>
            <AppIcon family="Ionicons" name="film-outline" size={20} color={theme.text.muted} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={[styles.heroTitle, { color: theme.text.primary }]} numberOfLines={1}>{t("Başlık metni", "Title text")}</Text>
            <Text style={[styles.heroLine, { color: theme.text.secondary }]} numberOfLines={1}>{t("İkincil açıklama satırı", "Secondary description line")}</Text>
            {compact ? null : (
              <Text style={[styles.heroLine, { color: theme.text.muted }]} numberOfLines={1}>{t("Soluk yardımcı metin", "Muted helper text")}</Text>
            )}
            <View style={[styles.chipRow, compact && styles.chipRowCompact]}>
              <View style={[styles.chip, { backgroundColor: `${theme.accent}26`, borderColor: theme.accent }]}>
                <Text style={[styles.chipText, { color: theme.accent }]}>{t("Vurgu", "Accent")}</Text>
              </View>
              <View style={[styles.chip, { backgroundColor: theme.between, borderColor: theme.border }]}>
                <Text style={[styles.chipText, { color: theme.text.between }]}>{t("Ara", "Between")}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* İstatistik şeridi */}
        {compact ? null : (
          <View style={styles.statRow}>
            {[{ v: "1.2K", k: t("Skor", "Score") }, { v: "87%", k: t("Doğruluk", "Accuracy") }, { v: "12", k: t("Seri", "Streak") }].map((item) => (
              <View key={item.k} style={[styles.statCell, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
                <Text style={[styles.statValue, { color: theme.accent }]}>{item.v}</Text>
                <Text style={[styles.statLabel, { color: theme.text.muted }]}>{item.k}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Vurgu butonu */}
        <View style={[styles.primaryBtn, compact && styles.primaryBtnCompact, { backgroundColor: theme.accent }]}>
          <AppIcon family="Ionicons" name="play" size={15} color={ON_ACCENT} />
          <Text style={[styles.primaryBtnText, { color: ON_ACCENT }]}>{t("Oyna", "Play")}</Text>
        </View>
      </View>
    </>
  );
}

function DetailScene({ theme, t, compact, mini }) {
  return (
    <>
      {/* Afiş: vurgu → koyu vurgu */}
      <LinearGradient colors={[theme.accent, theme.bold || theme.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.banner, compact && styles.bannerCompact, mini && styles.bannerMini]}>
        <View style={styles.bannerTop}>
          <View style={styles.bannerGhost}>
            <AppIcon family="Ionicons" name="chevron-back" size={16} color={ON_ACCENT} />
          </View>
          <View style={styles.bannerGhost}>
            <AppIcon family="Ionicons" name="bookmark-outline" size={15} color={ON_ACCENT} />
          </View>
        </View>
        <View style={[styles.playDisc, compact && styles.playDiscCompact, mini && styles.playDiscMini]}>
          <AppIcon family="Ionicons" name="play" size={20} color={theme.bold || theme.accent} />
        </View>
      </LinearGradient>

      <View style={[styles.detailBody, compact && styles.detailBodyCompact]}>
        <Text style={[styles.heroTitle, { color: theme.text.primary }]} numberOfLines={1}>{t("Film Adı", "Movie Title")}</Text>
        <View style={styles.metaRow}>
          <AppIcon family="Ionicons" name="star" size={13} color={theme.accent} />
          <Text style={[styles.metaScore, { color: theme.text.primary }]}>8.4</Text>
          <Text style={[styles.metaMuted, { color: theme.text.muted }]} numberOfLines={1}>2024 · 128 {t("dk", "min")}</Text>
          <View style={[styles.chip, { backgroundColor: theme.between, borderColor: theme.border }]}>
            <Text style={[styles.chipText, { color: theme.text.between }]}>{t("Bilim Kurgu", "Sci-Fi")}</Text>
          </View>
        </View>
        {compact ? null : (
          <Text style={[styles.synopsis, { color: theme.text.secondary }]} numberOfLines={2}>
            {t("Kısa özet metni burada görünür; ikincil metin rengi okunur olmalı.", "A short synopsis appears here; the secondary text color must stay readable.")}
          </Text>
        )}

        {/* İlerleme */}
        {mini ? null : (
          <View style={styles.progressRow}>
            <View style={[styles.track, { backgroundColor: theme.between }]}>
              <View style={[styles.fill, { backgroundColor: theme.accent }]} />
            </View>
            <Text style={[styles.metaMuted, { color: theme.text.muted }]}>64%</Text>
          </View>
        )}

        {/* Sekmeler */}
        <View style={[styles.tabsRow, { borderBottomColor: theme.border }]}>
          {[t("Genel", "Overview"), t("Oyuncular", "Cast"), t("Yorumlar", "Reviews")].map((label, i) => (
            <View key={label} style={[styles.tabItem, i === 0 && { borderBottomColor: theme.bold || theme.accent, borderBottomWidth: 2 }]}>
              <Text style={[styles.tabItemText, { color: i === 0 ? theme.text.primary : theme.text.muted }]}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Anahtar satırı */}
        {compact ? null : (
          <View style={[styles.switchRow, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
            <AppIcon family="Ionicons" name="notifications-outline" size={16} color={theme.text.between} />
            <Text style={[styles.switchLabel, { color: theme.text.primary }]} numberOfLines={1}>{t("Hatırlat", "Remind me")}</Text>
            <View style={[styles.switchTrack, { backgroundColor: theme.accent }]}>
              <View style={styles.switchKnob} />
            </View>
          </View>
        )}
      </View>
    </>
  );
}

const ThemePreviewCard = memo(function ThemePreviewCard({ theme, isEn = false, scene = "home", compact = false, mini = false }) {
  const t = (trText, enText) => (isEn ? enText : trText);
  const dense = compact || mini;

  return (
    <View style={[styles.frame, dense && styles.frameCompact, mini && styles.frameMini, { backgroundColor: theme.primary, borderColor: theme.border, shadowColor: theme.shadow }]}>
      {scene === "detail" ? <DetailScene theme={theme} t={t} compact={dense} mini={mini} /> : <HomeScene theme={theme} t={t} compact={dense} mini={mini} />}
      {mini ? null : <TabBar theme={theme} compact={dense} />}
    </View>
  );
});

export default ThemePreviewCard;

const styles = StyleSheet.create({
  frame: { minHeight: 372, borderRadius: 22, borderWidth: 1, overflow: "hidden", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 },
  topBar: { minHeight: 52, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 10, borderBottomWidth: 1 },
  topCopy: { flex: 1 },
  topTitle: { fontSize: 16, fontWeight: "900" },
  topSub: { fontSize: 10, fontWeight: "650", marginTop: 2 },
  topAction: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  body: { flexGrow: 1, justifyContent: "center", padding: 13, gap: 11 },
  heroCard: { flexDirection: "row", borderRadius: 15, borderWidth: 1, padding: 11, gap: 11 },
  poster: { width: 52, height: 74, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  heroCopy: { flex: 1, justifyContent: "center" },
  heroTitle: { fontSize: 14, fontWeight: "850" },
  heroLine: { fontSize: 11, fontWeight: "600", marginTop: 4 },
  chipRow: { flexDirection: "row", gap: 7, marginTop: 9 },
  chip: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 4 },
  chipText: { fontSize: 10, fontWeight: "800" },
  statRow: { flexDirection: "row", gap: 9 },
  statCell: { flex: 1, borderRadius: 13, borderWidth: 1, paddingVertical: 11, alignItems: "center" },
  statValue: { fontSize: 17, fontWeight: "900" },
  statLabel: { fontSize: 9, fontWeight: "700", marginTop: 3 },
  primaryBtn: { minHeight: 44, borderRadius: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryBtnText: { fontSize: 14, fontWeight: "900" },
  tabBar: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-around", borderTopWidth: 1 },

  /* kompakt (sabitlenen) sürüm */
  // minHeight: iki sahne aynı yükseklikte dursun (sahne değişince altındaki içerik zıplamasın)
  frameCompact: { minHeight: 234, borderRadius: 20 },
  chipRowCompact: { marginTop: 8 },
  frameMini: { minHeight: 150 },
  bannerMini: { height: 50, padding: 7 },
  playDiscMini: { top: 8, width: 32, height: 32, borderRadius: 16 },
  topBarCompact: { minHeight: 40, paddingHorizontal: 12 },
  bodyCompact: { padding: 10, gap: 9 },
  heroCardCompact: { padding: 9, gap: 10, borderRadius: 13 },
  posterCompact: { width: 40, height: 58, borderRadius: 8 },
  primaryBtnCompact: { minHeight: 36, borderRadius: 11 },
  tabBarCompact: { height: 38 },
  bannerCompact: { height: 66, padding: 8 },
  playDiscCompact: { top: 16, width: 34, height: 34, borderRadius: 17 },
  detailBodyCompact: { paddingHorizontal: 12, paddingVertical: 9, gap: 8 },

  /* detay sahnesi */
  banner: { height: 104, padding: 10, justifyContent: "space-between" },
  bannerTop: { flexDirection: "row", justifyContent: "space-between" },
  bannerGhost: { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" },
  playDisc: { position: "absolute", alignSelf: "center", top: 30, width: 44, height: 44, borderRadius: 22, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  detailBody: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 13, paddingVertical: 11, gap: 9 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaScore: { fontSize: 12, fontWeight: "900" },
  metaMuted: { fontSize: 10.5, fontWeight: "700" },
  synopsis: { fontSize: 11, fontWeight: "600", lineHeight: 15 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  track: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { width: "64%", height: 6, borderRadius: 3 },
  tabsRow: { flexDirection: "row", gap: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  tabItem: { paddingBottom: 7, paddingTop: 1 },
  tabItemText: { fontSize: 11, fontWeight: "800" },
  switchRow: { minHeight: 40, borderRadius: 12, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 11 },
  switchLabel: { flex: 1, fontSize: 12, fontWeight: "750" },
  switchTrack: { width: 34, height: 20, borderRadius: 10, padding: 2, alignItems: "flex-end", justifyContent: "center" },
  switchKnob: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#FFFFFF" },
});
