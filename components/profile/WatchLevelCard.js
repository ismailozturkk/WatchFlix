// components/profile/WatchLevelCard.js
//
// Profildeki Perde kartı — izleme puanının tek görünür yüzeyi.
// Görsel dil StatsComponents.StatsHeroCard'dan alınır (LinearGradient hero,
// radius 24, sağ üstte pill, withAlpha zorunlu).
//
// "AZ KALDI" ŞERİDİ bu kartın asıl işidir. Ham bir sayı ("2.319 Kare kaldı")
// hiçbir şey ifade etmez; kullanıcı Kare cinsinden düşünmez. Kalan mesafe
// SOMUT EYLEME çevrilir: "≈ 14 film ya da 63 bölüm". Ölçek olarak
// __tests__/watchScoring.test.js'te sabitlenen ortalama değerler kullanılır.

import React, { memo, useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import AppBadge from "@components/badges/AppBadge";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import { kademeRengi, kademeSekli, perdeStyle } from "@theme/badgeTokens";
import { withAlpha } from "./StatsComponents";
import {
  badgeAd,
  formatBadgeDeger,
} from "@components/badges/watchBadgeCatalog";
import { i18nText } from "@utils/i18nText";

// Ortalama eser değerleri — Perde tablosunun dayandığı sayılar.
const ORT_FILM = 165;
const ORT_BOLUM = 37;

const sayi = (n, lang) =>
  Math.round(Number(n) || 0).toLocaleString(lang === "tr" ? "tr-TR" : "en-US");

function WatchLevelCard({ progress, onPress }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const tr = language !== "en";
  const {
    loading,
    kare,
    perde,
    kartlar,
    acikSayisi,
    toplamRozet,
    tahmini,
    ilkTohum,
    seriler,
  } = progress || {};

  const band = perdeStyle(perde?.banded, theme);

  // Hedefe en yakın iki hedef. Gizli rozetler GÖSTERİLMEZ — gizli olmalarının
  // anlamı budur.
  //
  // Kaynak `kartlar` (gruplanmış), ham `rozetler` DEĞİL: ham listeyi kullanmak
  // kartta "Salon Sakini" yazarken rozet ekranında o adı hiçbir yerde
  // bulunmamasına yol açıyordu (ekran kademeli aileleri tek karta indiriyor ve
  // kimlik olarak ULAŞILAN kademeyi gösteriyor). Kullanıcı profilde gördüğü
  // rozeti aramaya gidip bulamıyordu.
  const yakinlar = useMemo(() => {
    if (!kartlar?.length) return [];
    return kartlar
      .map((k) => {
        const hedef = k.sonrakiHedef || (!k.acik ? k : null);
        return hedef ? { ...k, hedef } : null;
      })
      .filter((k) => k && !k.hidden && k.hedef.oran >= 0.5)
      .sort((a, b) => b.hedef.oran - a.hedef.oran)
      .slice(0, 2);
  }, [kartlar]);

  // ProfileStatsContext listener'ları useStartupGate(3200) ile ertelendiği için
  // ilk saniyelerde veri yok. "0 Kare / Perde 1" göstermek YANLIŞ BİLGİdir —
  // iskelet gösterip susmak doğrusu.
  if (loading || !perde) {
    return (
      <View
        style={[
          styles.card,
          styles.skeleton,
          { backgroundColor: theme.secondary, borderColor: theme.border },
        ]}
      >
        <View
          style={[
            styles.skelBar,
            {
              backgroundColor: withAlpha(theme.text.muted, 0.14),
              width: "44%",
            },
          ]}
        />
        <View
          style={[
            styles.skelBar,
            {
              backgroundColor: withAlpha(theme.text.muted, 0.1),
              width: "68%",
              height: 12,
            },
          ]}
        />
        <View
          style={[
            styles.skelBar,
            {
              backgroundColor: withAlpha(theme.text.muted, 0.08),
              width: "100%",
              height: 8,
              marginTop: 6,
            },
          ]}
        />
      </View>
    );
  }

  const kalan = perde.kalanKare;
  const filmKarsiligi = Math.max(1, Math.round(kalan / ORT_FILM));
  const bolumKarsiligi = Math.max(1, Math.round(kalan / ORT_BOLUM));
  const perdeAdi = tr ? perde.ad : perde.adEn;

  const hedefParam = { film: filmKarsiligi, bolum: bolumKarsiligi };
  const kalanMetni = perde.tabanDevrede
    ? i18nText("autoI18n.perde_korunuyor", "Seviyeni koruyorsun")
    : perde.zirve
    ? i18nText(
        "autoI18n.perde_sonraki_makara",
        `Sonraki Makara'ya ≈ ${filmKarsiligi} film ya da ${bolumKarsiligi} bölüm`,
        hedefParam
      )
    : i18nText(
        "autoI18n.perde_sonraki_hedef",
        `Sonraki perdeye ≈ ${filmKarsiligi} film ya da ${bolumKarsiligi} bölüm`,
        hedefParam
      );

  const CardRoot = onPress ? TouchableOpacity : View;

  return (
    <CardRoot
      {...(onPress
        ? {
            accessibilityRole: "button",
            accessibilityLabel: tr
              ? `Perde ${perde.perde}, ${perdeAdi}. Rozetler`
              : `Act ${perde.perde}, ${perdeAdi}. Badges`,
            activeOpacity: 0.85,
            onPress,
          }
        : {})}
      style={[styles.card, { borderColor: withAlpha(band.color, 0.3) }]}
    >
      <LinearGradient
        colors={[
          withAlpha(band.color, 0.26),
          withAlpha(band.color, 0.07),
          theme.primary,
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.fill}
      >
        <View
          pointerEvents="none"
          style={[styles.orb, { backgroundColor: withAlpha(band.color, 0.12) }]}
        />

        <View style={styles.topRow}>
          <View style={styles.titleWrap}>
            <Text
              allowFontScaling={false}
              style={[styles.eyebrow, { color: withAlpha(band.color, 0.95) }]}
            >
              {i18nText("autoI18n.perde_kisaltma", `PERDE ${perde.perde}`, {
                n: perde.perde,
              })}
              {perde.makara > 0
                ? ` · ${i18nText(
                    "autoI18n.perde_makara",
                    `${perde.makara}. Makara`,
                    { n: perde.makara }
                  )}`
                : ""}
            </Text>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.name, { color: theme.text.primary }]}
            >
              {perdeAdi}
            </Text>
          </View>
          <View
            style={[
              styles.pill,
              {
                backgroundColor: withAlpha(band.color, 0.18),
                borderColor: withAlpha(band.color, 0.4),
              },
            ]}
          >
            <AppIcon
              family="Ionicons"
              name="ribbon"
              size={12}
              color={band.color}
            />
            <Text
              allowFontScaling={false}
              style={[styles.pillText, { color: band.color }]}
            >
              {acikSayisi}/{toplamRozet}
            </Text>
          </View>
        </View>

        <View style={styles.kareRow}>
          {/* "≈" veri kalitesi ilanıdır: süresi bilinmeyen eserler için ortalama
              kullanıldığında sayıyı kesinmiş gibi göstermek dürüst değil. */}
          <Text
            allowFontScaling={false}
            style={[styles.kare, { color: theme.text.primary }]}
          >
            {tahmini ? "≈" : ""}
            {sayi(kare, language)}
          </Text>
          <Text
            allowFontScaling={false}
            style={[styles.kareLabel, { color: theme.text.muted }]}
          >
            {i18nText("autoI18n.kare_birimi", "Kare")}
          </Text>
        </View>

        <View
          style={[
            styles.track,
            { backgroundColor: withAlpha(theme.primary, 0.5) },
          ]}
        >
          <View
            style={[
              styles.fillBar,
              {
                backgroundColor: band.color,
                width: `${Math.round(perde.ilerleme * 100)}%`,
              },
            ]}
          />
        </View>

        <Text
          allowFontScaling={false}
          style={[styles.hint, { color: theme.text.muted }]}
        >
          {kalanMetni}
        </Text>

        {/* SERİ ŞERİDİ. Kartın Perde'den sonraki tek "bozulabilir" göstergesi.
            İki sayı BİLEREK yan yana: sol taraf MEVCUT seri (kaybedilebilir,
            gerilim buradan gelir), sağ taraf REKOR (asla düşmez, rozetleri o
            besler). Ayrımı göstermeseydik "Perde ve rozet düşmez" sözleşmesi ile
            serinin kaybedilebilir olması kullanıcıya çelişki gibi görünürdü.
            Sayı HAFTA: bu bir takip uygulaması, kimse her gün film izlemez —
            günlük ceza kullanıcıyı seriyi korumak için sahte işaretlemeye iter.
            7 kutucuk yine de günlük, çünkü canlılık hissi günlük olmalı. */}
        {seriler ? (
          <View style={styles.seriWrap}>
            <View style={styles.seriSatir}>
              <AppIcon
                family="Ionicons"
                name={seriler.haftaSerisi > 0 ? "flame" : "flame-outline"}
                size={13}
                color={seriler.haftaSerisi > 0 ? band.color : theme.text.muted}
              />
              <Text
                allowFontScaling={false}
                style={[
                  styles.seriMetin,
                  {
                    color:
                      seriler.haftaSerisi > 0
                        ? theme.text.primary
                        : theme.text.muted,
                  },
                ]}
              >
                {seriler.haftaSerisi > 0
                  ? i18nText(
                      "autoI18n.seri_hafta",
                      `${sayi(seriler.haftaSerisi, language)} hafta seri`,
                      { n: seriler.haftaSerisi }
                    )
                  : i18nText("autoI18n.seri_baslat", "Serini başlat")}
              </Text>
              {seriler.rekorHafta > seriler.haftaSerisi ? (
                <Text
                  allowFontScaling={false}
                  style={[styles.seriRekor, { color: theme.text.muted }]}
                >
                  {i18nText(
                    "autoI18n.seri_rekor",
                    `rekor ${sayi(seriler.rekorHafta, language)}`,
                    { n: seriler.rekorHafta }
                  )}
                </Text>
              ) : null}
              <View style={styles.kutuSirasi}>
                {seriler.haftaKutulari.map((dolu, i) => (
                  <View
                    key={i}
                    style={[
                      styles.kutu,
                      {
                        backgroundColor: dolu
                          ? band.color
                          : withAlpha(theme.text.muted, 0.18),
                      },
                    ]}
                  />
                ))}
              </View>
            </View>
          </View>
        ) : null}

        {ilkTohum && acikSayisi > 0 ? (
          <Text
            allowFontScaling={false}
            style={[
              styles.hint,
              { color: withAlpha(band.color, 0.9), marginTop: 2 },
            ]}
          >
            {i18nText(
              "autoI18n.rozet_arsiv_acildi",
              `Arşivin açıldı — ${acikSayisi} rozet zaten senindi`,
              { n: acikSayisi }
            )}
          </Text>
        ) : null}

        {yakinlar.length ? (
          <View
            style={[
              styles.yakinWrap,
              { borderTopColor: withAlpha(theme.text.muted, 0.14) },
            ]}
          >
            {yakinlar.map((b) => (
              <View key={b.id} style={styles.yakin}>
                {/* Siluet ikon/nadirlikle AYNI kaynaktan (ulaşılan kademe)
                    türer; `hedef` yalnızca adı ve oranı verir. */}
                <AppBadge
                  glyph={b.icon}
                  glyphSolid={b.iconSolid}
                  rarity={b.rarity}
                  unlocked={false}
                  progress={b.hedef.oran}
                  size={30}
                  sides={kademeSekli(b.tier, b.aileToplam).kenar}
                  color={kademeRengi(
                    kademeSekli(b.tier, b.aileToplam).kademe,
                    theme
                  )}
                />
                <View style={styles.yakinCopy}>
                  <Text
                    allowFontScaling={false}
                    numberOfLines={1}
                    style={[styles.yakinAd, { color: theme.text.primary }]}
                  >
                    {badgeAd(b.hedef, tr ? "tr" : "en")}
                  </Text>
                  <Text
                    allowFontScaling={false}
                    style={[styles.yakinOran, { color: theme.text.muted }]}
                  >
                    {formatBadgeDeger(
                      b.hedef,
                      b.hedef.ilerleme,
                      tr ? "tr" : "en"
                    )}
                    /
                    {formatBadgeDeger(
                      b.hedef,
                      b.hedef.target,
                      tr ? "tr" : "en"
                    )}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </LinearGradient>
    </CardRoot>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "90%",
    alignSelf: "center",
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
    marginTop: 4,
  },
  fill: { padding: 16 },
  orb: {
    position: "absolute",
    right: -34,
    top: -44,
    width: 148,
    height: 148,
    borderRadius: 74,
  },
  topRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  titleWrap: { flex: 1 },
  eyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 1.1 },
  name: { fontSize: 19, fontWeight: "900", marginTop: 2 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 11,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  pillText: { fontSize: 11, fontWeight: "900" },
  kareRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginTop: 12,
  },
  kare: { fontSize: 28, fontWeight: "900", letterSpacing: -0.5 },
  kareLabel: { fontSize: 12, fontWeight: "800" },
  track: { height: 8, borderRadius: 4, overflow: "hidden", marginTop: 10 },
  fillBar: { height: "100%", borderRadius: 4 },
  hint: { fontSize: 11, fontWeight: "700", marginTop: 8 },
  seriWrap: { marginTop: 9 },
  seriSatir: { flexDirection: "row", alignItems: "center", gap: 6 },
  seriMetin: { fontSize: 11, fontWeight: "850" },
  seriRekor: { fontSize: 10, fontWeight: "700" },
  // Kutucuklar sağa yaslanır: sol taraf sayı, sağ taraf haftanın ritmi.
  kutuSirasi: { flexDirection: "row", gap: 3, marginLeft: "auto" },
  kutu: { width: 9, height: 9, borderRadius: 3 },
  yakinWrap: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
    paddingTop: 11,
    borderTopWidth: 1,
  },
  yakin: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  yakinCopy: { flex: 1 },
  yakinAd: { fontSize: 11, fontWeight: "850" },
  yakinOran: { fontSize: 10, fontWeight: "700", marginTop: 1 },
  skeleton: { padding: 16, gap: 8, minHeight: 132, justifyContent: "center" },
  skelBar: { height: 18, borderRadius: 7 },
});

export default memo(WatchLevelCard);
