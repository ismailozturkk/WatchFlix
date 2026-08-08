// components/badges/WatchBadgeDetailModal.js
//
// Rozet detay sayfası — İKİ yerden açılır:
//   • Rozetler ekranında bir karta dokununca (screens/tabs/profile/WatchBadgesScreen.js)
//   • Profil başlığındaki yatay raftaki bir simgeye dokununca (components/profile/WatchBadgeStrip.js)
//
// KENDİ <Modal>'INI RENDER EDER. RatingSheetModal'ın aksine dışarıdan bir
// <Modal> ile sarmalanmayı beklemez: iki ayrı çağıran var ve ikisinin de aynı
// sarmalama kodunu kopyalaması, iki yerde ayrışacak bir animasyon/backdrop
// mantığı demekti.
//
// ASIL İŞİ "YOL". Kademeli bir ailede kullanıcı nerede olduğunu değil, NEREYE
// GİTTİĞİNİ merak eder. Rozet kartı tek bir kademe gösterebiliyor (ulaşılan);
// bu modal ailenin TAMAMINI bir patika olarak serer: hangi kademeler geçildi,
// şu an hangi düğümdesin, sıradaki eşik kaç. Kenar sayısı merdiveni de burada
// ilk kez yan yana görünür — kare → beşgen → altıgen.

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated, Dimensions, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import ModalBlurBackdrop from "../common/ModalBlurBackdrop";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import AppBadge from "@components/badges/AppBadge";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import { kademeRengi, kademeSekli, rarityStyle } from "@theme/badgeTokens";
import {
  badgeAciklama,
  badgeAd,
  formatBadgeAralik,
  formatBadgeSayi,
  sureBirimiBul,
  SURE_BIRIMLERI,
  SURE_BIRIM_VARSAYILAN,
} from "./watchBadgeCatalog";
import { withAlpha } from "@components/profile/StatsComponents";
import { i18nText } from "@utils/i18nText";

const { height: EKRAN_H } = Dimensions.get("window");
const SHEET_ORAN = 0.66;

// Nadirlik adları katalog emsaliyle INLINE tutulur (81 rozet metni de öyle):
// beş kademe × iki dil = 10 dize için autoI18n anahtarı açmaya değmez.
const NADIRLIK_AD = {
  common: { tr: "Yaygın", en: "Common" },
  uncommon: { tr: "Az Bulunur", en: "Uncommon" },
  rare: { tr: "Nadir", en: "Rare" },
  epic: { tr: "Destansı", en: "Epic" },
  legendary: { tr: "Efsanevi", en: "Legendary" },
};

const DUGUM_ROZET = 40;      // yol düğümündeki rozet boyu (hücre genişliği esnek)

export default function WatchBadgeDetailModal({ badge, visible, onClose }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const lang = language === "en" ? "en" : "tr";
  const tr = lang === "tr";

  const SHEET_H = EKRAN_H * SHEET_ORAN;
  const slide = useRef(new Animated.Value(SHEET_H)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  // SÜRE ÇEVİRİCİSİ. Ekran süresi rozetlerinin ham değeri dakikadır; hangi
  // birimle okunacağı kullanıcının işi: 74.040 dk / 1.234 sa / 51 gün aynı
  // sayının üç okunuşu. Varsayılan dk (kullanıcı isteği), her açılışta sıfırlanır
  // — modal bir önceki rozetin seçimini taşırsa sayı bambaşka bir şey sanılır.
  //
  // Sıfırlama EFEKTLE DEĞİL, render sırasında yapılır: bu modal profil rafında
  // kapalıyken de mount kalıyor (components/profile/WatchBadgeStrip.js) ve
  // efektle sıfırlamak yeni rozeti bir kare boyunca ÖNCEKİ rozetin birimiyle
  // çizerdi. Seçim, ait olduğu açılışın anahtarıyla birlikte saklanır.
  const acilisAnahtari = `${badge?.id ?? ""}|${visible ? 1 : 0}`;
  const [birimSecimi, setBirimSecimi] = useState({
    id: SURE_BIRIM_VARSAYILAN,
    anahtar: acilisAnahtari,
  });
  const birimId =
    birimSecimi.anahtar === acilisAnahtari
      ? birimSecimi.id
      : SURE_BIRIM_VARSAYILAN;
  const secBirim = (id) => setBirimSecimi({ id, anahtar: acilisAnahtari });

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slide, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 180, mass: 0.9 }),
        Animated.timing(backdrop, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]).start();
    } else {
      // Kapanış animasyonu yalnızca GÖRÜNÜRKEN anlamlı; kapalıyken değerleri
      // sıfırlamak bir sonraki açılışın alttan gelmesini garantiler.
      slide.setValue(SHEET_H);
      backdrop.setValue(0);
    }
  }, [visible, SHEET_H, slide, backdrop]);

  const kapat = () => {
    Animated.parallel([
      Animated.timing(slide, { toValue: SHEET_H, duration: 240, useNativeDriver: true }),
      Animated.timing(backdrop, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onClose?.());
  };

  const veri = useMemo(() => {
    if (!badge) return null;
    const gizliKilitli = badge.hidden && !badge.acik;
    const uyeler = badge.aileUyeleri?.length > 1 ? badge.aileUyeleri : null;
    // Yol dolgusu: kazanılmış düğüm sayısı + sıradaki düğüme kısmi ilerleme.
    // (N-1) aralık üzerinden hesaplanır çünkü çizgi İLK düğümün merkezinden
    // SON düğümün merkezine uzanır, kenarlardan değil.
    let dolgu = 0;
    if (uyeler) {
      const acikSayisi = uyeler.filter((u) => u.acik).length;
      const sonraki = uyeler.find((u) => !u.acik);
      const kismi = sonraki ? sonraki.oran : 0;
      dolgu = uyeler.length > 1
        ? Math.max(0, Math.min(1, (Math.max(0, acikSayisi - 1) + (acikSayisi > 0 ? kismi : 0)) / (uyeler.length - 1)))
        : 0;
    }
    return { gizliKilitli, uyeler, dolgu, hedef: badge.sonrakiHedef || (!badge.acik ? badge : null) };
  }, [badge]);

  if (!badge || !veri) return null;

  const { gizliKilitli, uyeler, dolgu, hedef } = veri;
  // Çevirici yalnız zaman birimli rozetlerde anlamlı: rozetin kendisi, sıradaki
  // hedefi ya da aile üyelerinden biri birim taşıyorsa gösterilir.
  const sureli =
    !!badge.birim || !!hedef?.birim || !!uyeler?.some((u) => u.birim);
  const secilenBirim = sureli ? sureBirimiBul(birimId) : undefined;
  const nadirlik = rarityStyle(badge.rarity, theme);
  const sekil = kademeSekli(badge.tier, badge.aileToplam);
  const kadRenk = kademeRengi(sekil.kademe, theme);
  // Sayfanın vurgu rengi: kademeli rozette KADEME, ailesizde nadirlik. Üst
  // parıltı, yol rayı ve kademe sayacı hep bunu kullanır — modal tek bir renk
  // konuşmalı, yoksa aynı rozet için iki farklı kimlik iddia eder.
  const vurgu = kadRenk || nadirlik.color;
  const baslik = gizliKilitli ? "???" : badgeAd(badge, lang);
  const aciklama = gizliKilitli
    ? i18nText("autoI18n.rozet_gizli_baslik", "Gizli rozet")
    : badgeAciklama(badge, lang);

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={kapat} statusBarTranslucent>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
          <ModalBlurBackdrop intensity={28} />
          <LinearGradient
            colors={["rgba(0,0,0,0.1)", "rgba(0,0,0,0.55)", "rgba(0,0,0,0.82)"]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <TouchableOpacity style={styles.backdropTouchable} activeOpacity={1} onPress={kapat} />

        <Animated.View
          style={[styles.sheet, { height: SHEET_H, backgroundColor: theme.secondary, transform: [{ translateY: slide }] }]}
        >
          <View style={[styles.topGlow, { backgroundColor: vurgu }]} />
          <View style={styles.handleWrap}>
            <View style={[styles.handle, { backgroundColor: withAlpha(theme.text.muted, 0.35) }]} />
          </View>

          <ScrollView contentContainerStyle={styles.icerik} showsVerticalScrollIndicator={false}>
            {/* ── Kimlik ── */}
            <AppBadge
              glyph={gizliKilitli ? "help-outline" : badge.icon}
              glyphSolid={gizliKilitli ? "help" : badge.iconSolid}
              rarity={badge.rarity}
              unlocked={badge.acik}
              progress={gizliKilitli ? 0 : badge.oran}
              size={84}
              sides={sekil.kenar}
              color={kadRenk}
              ornate={sekil.ornate && badge.acik}
              accessibilityLabel={baslik}
            />

            <Text allowFontScaling={false} style={[styles.baslik, { color: theme.text.primary }]}>
              {baslik}
            </Text>

            <View style={styles.pillSatir}>
              <View style={[styles.pill, {
                backgroundColor: withAlpha(nadirlik.color, 0.14),
                borderColor: withAlpha(nadirlik.color, 0.35),
              }]}>
                <Text allowFontScaling={false} style={[styles.pillText, { color: nadirlik.color }]}>
                  {NADIRLIK_AD[nadirlik.key]?.[lang] || nadirlik.key}
                </Text>
              </View>
              <View style={[styles.pill, {
                backgroundColor: badge.acik ? withAlpha("#2ECC71", 0.14) : theme.primary,
                borderColor: badge.acik ? withAlpha("#2ECC71", 0.35) : theme.border,
              }]}>
                <AppIcon
                  family="Ionicons"
                  name={badge.acik ? "checkmark-circle" : "lock-closed"}
                  size={11}
                  color={badge.acik ? "#2ECC71" : theme.text.muted}
                />
                <Text allowFontScaling={false} style={[styles.pillText, { color: badge.acik ? "#2ECC71" : theme.text.muted }]}>
                  {badge.acik
                    ? i18nText("autoI18n.rozet_kazanildi_etiket", "Kazanıldı")
                    : i18nText("autoI18n.rozet_kilitli_etiket", "Kilitli")}
                </Text>
              </View>
            </View>

            <Text allowFontScaling={false} style={[styles.aciklama, { color: theme.text.muted }]}>
              {aciklama}
            </Text>

            {/* ── İlerleme. Gizli rozette ÇİZİLMEZ: "18/25" göstermek rozetin
                   ne ölçtüğünü ele verir ve gizliliğin tek anlamını öldürür. ── */}
            {!gizliKilitli && hedef ? (
              <View style={styles.ilerlemeWrap}>
                <View style={[styles.track, { backgroundColor: theme.primary }]}>
                  <View style={[styles.fill, {
                    backgroundColor: theme.accent,
                    width: `${Math.round(hedef.oran * 100)}%`,
                  }]} />
                </View>
                <Text allowFontScaling={false} style={[styles.ilerlemeText, { color: theme.text.muted }]}>
                  {formatBadgeAralik(hedef, hedef.ilerleme, hedef.target, lang, secilenBirim)}
                </Text>
              </View>
            ) : null}

            {/* ── SÜRE BİRİMİ ÇEVİRİCİSİ ──
                Ekran süresi dakika toplanır; hangi birimle okunacağını burada
                kullanıcı seçer. Kilitli gizli rozette çizilmez — ilerleme satırı
                da orada gizlidir, birim seçtirmek rozetin süre ölçtüğünü ele
                verirdi. */}
            {sureli && !gizliKilitli ? (
              <View style={styles.birimSatir}>
                {SURE_BIRIMLERI.map((b) => {
                  const secili = b.id === birimId;
                  return (
                    <TouchableOpacity
                      key={b.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: secili }}
                      activeOpacity={0.85}
                      onPress={() => secBirim(b.id)}
                      style={[styles.birimChip, {
                        backgroundColor: secili ? withAlpha(vurgu, 0.16) : theme.primary,
                        borderColor: secili ? withAlpha(vurgu, 0.45) : theme.border,
                      }]}
                    >
                      <Text
                        allowFontScaling={false}
                        style={[styles.birimChipText, { color: secili ? vurgu : theme.text.muted }]}
                      >
                        {/* Büyük harfe JS'te çevriliyor: style textTransform
                            Android'de cihaz yereline göre çalışıyor ve Türkçe
                            yerelli telefonda İngilizce arayüzde "min" → "MİN"
                            oluyordu. */}
                        {(tr ? b.ekTr : b.ekEn).toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}

            {/* ── YOL ── */}
            {uyeler ? (
              <View style={styles.yolWrap}>
                <Text allowFontScaling={false} style={[styles.yolBaslik, { color: theme.text.muted }]}>
                  {i18nText("autoI18n.rozet_yol_baslik", "Kademeler")}
                  {"  "}
                  <Text style={{ color: vurgu }}>
                    {badge.aileKademe}/{badge.aileToplam}
                  </Text>
                </Text>

                <View style={styles.yol}>
                  {/* Çizgi düğümlerin ALTINDA durur ve ilk/son düğümün
                      MERKEZİNDEN başlayıp biter — kenardan başlasaydı ilk
                      düğümün solunda anlamsız bir kuyruk kalırdı. */}
                  {/* Kenar boşluğu YÜZDE: düğümler artık `flex: 1` olduğu için
                      her biri genişliğin 1/N'i, dolayısıyla ilk düğümün merkezi
                      %(50/N)'de. Sabit piksel yarım-genişlik kullanmak, aileler 5
                      kademeye çıkınca 320pt ekranda rayı düğümlerden kaydırırdı. */}
                  <View style={[styles.rayWrap, {
                    left: `${50 / uyeler.length}%`,
                    right: `${50 / uyeler.length}%`,
                  }]}>
                    <View style={[styles.ray, { backgroundColor: withAlpha(theme.text.muted, 0.18) }]} />
                    {/* Dolu kısım ULAŞILAN kademenin rengiyle çizilir: yol
                        boyunca renk değiştiği için "şu an neredesin"i tek
                        bakışta söyleyen şey bu. */}
                    <View style={[styles.rayDolu, { backgroundColor: vurgu, width: `${Math.round(dolgu * 100)}%` }]} />
                  </View>

                  {uyeler.map((u) => {
                    const s = kademeSekli(u.tier, uyeler.length);
                    const suAnki = u.id === badge.id;
                    return (
                      <View key={u.id} style={styles.dugum}>
                        <View style={[
                          styles.dugumHalka,
                          suAnki && { borderColor: vurgu, backgroundColor: theme.secondary },
                        ]}>
                          <AppBadge
                            glyph={u.icon}
                            glyphSolid={u.iconSolid}
                            rarity={u.rarity}
                            unlocked={u.acik}
                            progress={u.oran}
                            size={DUGUM_ROZET}
                            sides={s.kenar}
                            // Her düğüm KENDİ kademe rengini taşır; yol boyunca
                            // gri → mavi → mor → zümrüt → altın diye ilerler.
                            color={kademeRengi(s.kademe, theme)}
                            ornate={s.ornate && u.acik}
                            accessibilityLabel={badgeAd(u, lang)}
                          />
                        </View>
                        <Text allowFontScaling={false} numberOfLines={1} style={[styles.dugumHedef, {
                          color: u.acik ? theme.text.primary : theme.text.muted,
                          fontWeight: suAnki ? "900" : "700",
                        }]}>
                          {/* Birim eki yok: çevirici çipleri hemen yukarıda
                              hangi birimde okunduğunu söylüyor ve düğüm
                              hücresi dar — "525.600 dk" burada kırpılırdı. */}
                          {formatBadgeSayi(u, u.target, lang, secilenBirim)}
                        </Text>
                        <Text allowFontScaling={false} numberOfLines={2} style={[styles.dugumAd, {
                          color: u.acik ? theme.text.muted : withAlpha(theme.text.muted, 0.6),
                        }]}>
                          {badgeAd(u, lang)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : (
              <Text allowFontScaling={false} style={[styles.tekKademe, { color: withAlpha(theme.text.muted, 0.75) }]}>
                {i18nText("autoI18n.rozet_tek_kademe", "Tek kademeli rozet")}
              </Text>
            )}
          </ScrollView>

          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.85}
            onPress={kapat}
            style={[styles.kapat, { backgroundColor: theme.primary, borderColor: theme.border }]}
          >
            <Text allowFontScaling={false} style={[styles.kapatText, { color: theme.text.primary }]}>
              {tr ? "Kapat" : "Close"}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFill },
  backdropTouchable: { ...StyleSheet.absoluteFill },
  sheet: {
    borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: "hidden",
    paddingBottom: 14,
  },
  topGlow: { height: 3, opacity: 0.9 },
  handleWrap: { alignItems: "center", paddingTop: 9, paddingBottom: 3 },
  handle: { width: 40, height: 4, borderRadius: 2 },
  icerik: { alignItems: "center", paddingHorizontal: 22, paddingTop: 12, paddingBottom: 18 },
  baslik: { fontSize: 21, fontWeight: "900", marginTop: 13, textAlign: "center" },
  pillSatir: { flexDirection: "row", gap: 7, marginTop: 9 },
  pill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderRadius: 11, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 4,
  },
  pillText: { fontSize: 10.5, fontWeight: "900" },
  aciklama: { fontSize: 12.5, fontWeight: "650", lineHeight: 18, marginTop: 12, textAlign: "center" },
  ilerlemeWrap: { width: "100%", flexDirection: "row", alignItems: "center", gap: 10, marginTop: 15 },
  track: { flex: 1, height: 7, borderRadius: 4, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
  ilerlemeText: { fontSize: 11, fontWeight: "850" },

  birimSatir: { flexDirection: "row", gap: 6, marginTop: 10, alignSelf: "center" },
  birimChip: {
    borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 5, minWidth: 46, alignItems: "center",
  },
  birimChipText: { fontSize: 11, fontWeight: "900" },

  yolWrap: { width: "100%", marginTop: 24 },
  yolBaslik: { fontSize: 11, fontWeight: "850", letterSpacing: 0.7, textTransform: "uppercase", marginBottom: 14 },
  yol: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  // Ray, düğüm rozetinin DİKEY MERKEZİNE hizalanır. Halka yüksekliği
  // 2(border) + 3(padding) + 40(rozet) + 3 + 2 = 50 → merkez 25; ray 3px
  // olduğu için üst kenarı 25 − 1.5 = 23.5'e oturur.
  // `dugumHalka`nın borderWidth'i seçili olmayan düğümde de 2 (rengi saydam):
  // yalnızca seçilide vermek düğümü 4px kısaltıp rayı eğri gösterirdi.
  rayWrap: { position: "absolute", top: 23.5, height: 3 },
  ray: { ...StyleSheet.absoluteFill, borderRadius: 2 },
  rayDolu: { height: 3, borderRadius: 2 },
  // TAŞMA DÜZELTMESİ. Sabit 58px genişlik, aileler 5 kademeye çıkınca 5×58=290px
  // istiyordu; modalın iç genişliği ise ekran−44, yani 320pt'lik bir cihazda
  // 276px. RN'de satır çocuklarının varsayılan flexShrink'i 0 olduğu için
  // sıkışmıyorlar ve sheet'in `overflow: hidden`'ı 5. düğümü kesiyordu.
  // `flex: 1` düğümleri eşit paylaştırır ve taşma matematiksel olarak imkânsız
  // olur; `minWidth: 0` uzun rozet adının hücreyi şişirmesini engeller.
  dugum: { flex: 1, minWidth: 0, alignItems: "center" },
  dugumHalka: { padding: 3, borderRadius: 26, borderWidth: 2, borderColor: "transparent" },
  dugumHedef: { fontSize: 12, marginTop: 6 },
  dugumAd: { fontSize: 9, fontWeight: "700", textAlign: "center", marginTop: 2, lineHeight: 12 },
  tekKademe: { fontSize: 11, fontWeight: "700", marginTop: 22 },

  kapat: {
    marginHorizontal: 22, height: 44, borderRadius: 14, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  kapatText: { fontSize: 13.5, fontWeight: "850" },
});
