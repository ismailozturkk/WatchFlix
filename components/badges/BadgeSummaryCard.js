// components/badges/BadgeSummaryCard.js
//
// Rozet ekranının "kaç tanesi açık?" kartı: halka (yüzde) + büyük sayı + beş
// nadirlik sütunu. Perde kartı (WatchLevelCard) ilerlemeyi PUAN cinsinden söyler;
// bu kart aynı kullanıcıyı KOLEKSİYON cinsinden söyler — iki ayrı soru, iki ayrı kart.
//
// SAYAÇ KATALOG ROZETLERİNİ sayar (81), koleksiyon/mühür/prestij dahil değil:
// payda her dönem başında büyürse kullanıcı hiçbir şey yapmadan "42/95"ten
// "42/96"ya düşmüş görünürdü (hooks/useWatchProgress.js → acikSayisi ile aynı sözleşme).
//
// Nadirlik sütunları "hangi liglerde ilerledim?" sorusunu cevaplar: 8/12 yaygın
// ama 0/3 efsanevi olan kullanıcı sıradaki büyük hedefini bir bakışta görür.

import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import { rarityStyle } from "@theme/badgeTokens";
import { i18nText } from "@utils/i18nText";
import { withAlpha } from "@components/profile/StatsComponents";
import { nadirlikAdi, yuzdeMetni } from "./badgeFormat";

const HALKA = 72;
const KALINLIK = 8;

function Halka({ oran, renk, iz, metin, metinRenk }) {
  const r = (HALKA - KALINLIK) / 2;
  const c = 2 * Math.PI * r;
  const o = Math.max(0, Math.min(1, Number(oran) || 0));
  return (
    <View style={styles.halka}>
      <Svg width={HALKA} height={HALKA}>
        <Circle cx={HALKA / 2} cy={HALKA / 2} r={r} stroke={iz} strokeWidth={KALINLIK} fill="none" />
        {o > 0 ? (
          <Circle
            cx={HALKA / 2}
            cy={HALKA / 2}
            r={r}
            stroke={renk}
            strokeWidth={KALINLIK}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${c}`}
            strokeDashoffset={c * (1 - o)}
            transform={`rotate(-90 ${HALKA / 2} ${HALKA / 2})`}
          />
        ) : null}
      </Svg>
      <View pointerEvents="none" style={styles.halkaMerkez}>
        <Text allowFontScaling={false} style={[styles.halkaYuzde, { color: metinRenk }]}>
          {metin}
        </Text>
      </View>
    </View>
  );
}

function BadgeSummaryCard({ acik, toplam, dagilim, style }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const lang = language === "en" ? "en" : "tr";
  const oran = toplam > 0 ? acik / toplam : 0;

  return (
    <View
      style={[styles.card, { backgroundColor: theme.secondary, borderColor: theme.border }, style]}
      accessible
      accessibilityLabel={`${acik}/${toplam} ${i18nText("autoI18n.rozet_ozet_acildi", "rozet açıldı")}`}
    >
      <View style={styles.ust}>
        <Halka
          oran={oran}
          renk={theme.accent}
          iz={withAlpha(theme.text.muted, 0.2)}
          metin={yuzdeMetni(oran, lang)}
          metinRenk={theme.text.primary}
        />
        <View style={styles.sayiBlok}>
          <Text allowFontScaling={false} style={[styles.buyuk, { color: theme.text.primary }]}>
            {acik}
            <Text allowFontScaling={false} style={[styles.toplam, { color: theme.text.muted }]}>
              {" "}/ {toplam}
            </Text>
          </Text>
          <Text allowFontScaling={false} style={[styles.altYazi, { color: theme.text.muted }]}>
            {i18nText("autoI18n.rozet_ozet_acildi", "rozet açıldı")}
          </Text>
        </View>
      </View>

      <View style={styles.sutunlar}>
        {(dagilim || []).map((d) => {
          const renk = rarityStyle(d.rarity, theme).color;
          const o = d.toplam > 0 ? d.acik / d.toplam : 0;
          return (
            <View key={d.rarity} style={styles.sutun}>
              <View style={[styles.iz, { backgroundColor: withAlpha(renk, 0.2) }]}>
                <View style={[styles.dolgu, { backgroundColor: renk, width: `${Math.round(o * 100)}%` }]} />
              </View>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                style={[styles.sutunAd, { color: theme.text.muted }]}
              >
                {nadirlikAdi(d.rarity, lang)}
              </Text>
              <Text allowFontScaling={false} style={[styles.sutunSayi, { color: theme.text.primary }]}>
                {d.acik}
                <Text style={{ color: theme.text.muted }}>/{d.toplam}</Text>
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: 1, padding: 16 },
  ust: { flexDirection: "row", alignItems: "center", gap: 16 },
  halka: { width: HALKA, height: HALKA },
  halkaMerkez: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  halkaYuzde: { fontSize: 15, fontWeight: "900", letterSpacing: -0.3 },
  sayiBlok: { flex: 1 },
  buyuk: { fontSize: 34, fontWeight: "900", letterSpacing: -1, lineHeight: 38 },
  toplam: { fontSize: 18, fontWeight: "800", letterSpacing: 0 },
  altYazi: { fontSize: 12.5, fontWeight: "700", marginTop: 1 },
  sutunlar: { flexDirection: "row", gap: 8, marginTop: 16 },
  sutun: { flex: 1, minWidth: 0 },
  iz: { height: 5, borderRadius: 3, overflow: "hidden" },
  dolgu: { height: "100%", borderRadius: 3 },
  sutunAd: { marginTop: 6, fontSize: 10, fontWeight: "800" },
  sutunSayi: { marginTop: 1, fontSize: 12.5, fontWeight: "900" },
});

export default memo(BadgeSummaryCard);
