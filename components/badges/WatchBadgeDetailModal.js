// components/badges/WatchBadgeDetailModal.js
//
// Rozet detay sayfası — İKİ yerden açılır:
//   • Rozetler ekranında bir karoya dokununca (screens/tabs/profile/WatchBadgesScreen.js)
//   • Profil başlığındaki yatay raftaki bir simgeye dokununca (components/profile/WatchBadgeStrip.js)
// ve bir de kutlama bildirimine dokununca (rozet ekranı `openId` ile açar).
//
// KENDİ ALT SAYFASINI render eder (BottomSheetModal — uygulamanın ortak kabuğu,
// blur yerinde solar, sayfa kayar). İki çağıranın da aynı sarmalama kodunu
// kopyalaması, iki yerde ayrışacak bir animasyon/backdrop mantığı demekti.
//
// ASIL İŞİ "NEREYE GİDİYORSUN". Kullanıcı rozetin ne olduğunu karodan biliyor;
// burada merak ettiği: ne zaman kazandım, sıradaki ne kadar uzak, bu bir koleksiyonsa
// eksik hangisi, bu bir mühürse yetişir miyim. Her rozet türü kendi sorusunu cevaplar:
//   • kademeli aile  → YOL: tüm kademeler patika olarak serilir
//   • koleksiyon     → ÜYELER: hangileri tamam, hangisi eksik (dokununca o rozet)
//   • dönem mührü    → GERİ SAYIM: bitmesine kaç gün var, o güne yetişir mi
//   • tamamlanmış aile → PRESTİJ: zirvenin ötesinde bir sonraki basamağa mesafe
//
// İÇERİĞİ ÇIKIŞ ANIMASYONU BOYUNCA TUTAR: BottomSheetModal `visible` düşünce ≈260 ms
// daha çizer, ama çağıran taraf rozeti hemen null'lar. Son rozet burada ref'te
// saklanır, yoksa sayfa boşalarak aşağı kayardı.

import { copyLanguage } from "../../utils/appLanguages";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppIcon from "@components/AppIcon";
import AppBadge from "@components/badges/AppBadge";
import BottomSheetModal from "@components/common/BottomSheetModal";
import GlassCloseButton from "@components/common/GlassCloseButton";
import SheetScroll from "@components/common/SheetScroll";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import { useWatchProgressContext } from "@context/WatchProgressContext";
import { GOLD, kademeRengi, kademeSekli, rarityStyle } from "@theme/badgeTokens";
import { withAlpha } from "@components/profile/StatsComponents";
import { i18nText } from "@utils/i18nText";
import {
  BOLUM_BASLIK,
  SURE_BIRIMLERI,
  SURE_BIRIM_VARSAYILAN,
  badgeAciklama,
  badgeAd,
  formatBadgeAralik,
  formatBadgeDeger,
  formatBadgeSayi,
  sureBirimiBul,
} from "./watchBadgeCatalog";
import { kalanMiktar, kartBul, prestijBilgisi, prestijEk, setUyeleri } from "./badgeInsights";
import { formatTarih, nadirlikAdi, yuzdeMetni } from "./badgeFormat";
import GlassTouchable from "../common/GlassTouchable";

const DUGUM_ROZET = 40;      // yol düğümündeki rozet boyu (hücre genişliği esnek)
const BOS = [];

export default function WatchBadgeDetailModal({ badge, visible, onClose }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const insets = useSafeAreaInsets();
  const lang = copyLanguage(language, ["tr", "en", "es", "pt", "de"]);

  // Koleksiyon üyelerini çözmek ve üyeye dokununca onun kartını bulmak için
  // bağlamdan okunur. Çağıranlara ek prop taşımak (ekran + profil rafı) iki yerde
  // aynı bağlantıyı kurmak demekti.
  const progress = useWatchProgressContext();
  const rozetler = progress?.rozetler || BOS;
  const kartlar = progress?.kartlar || BOS;

  // Çıkış animasyonu için son rozeti sakla (üstteki not).
  const sonRef = useRef(null);
  if (badge) sonRef.current = badge;

  // Koleksiyondan bir üyeye geçildiğinde o kartı GÖSTERİR; "geri" ile koleksiyona
  // dönülür. Seçim, ait olduğu açılışın anahtarıyla saklanır: render sırasında
  // sıfırlanır, efektle sıfırlamak yeni rozeti bir kare boyunca eskinin üyesiyle çizerdi.
  const acilisAnahtari = `${badge?.id ?? ""}|${visible ? 1 : 0}`;
  const [gecis, setGecis] = useState({ anahtar: acilisAnahtari, kart: null });
  const gecisKarti = gecis.anahtar === acilisAnahtari ? gecis.kart : null;
  const asil = gecisKarti || badge || sonRef.current;

  // SÜRE ÇEVİRİCİSİ. Ekran süresi rozetlerinin ham değeri dakikadır; hangi birimle
  // okunacağı kullanıcının işi: 74.040 dk / 1.234 sa / 51 gün aynı sayının üç okunuşu.
  // Varsayılan dk, her açılışta sıfırlanır.
  const birimAnahtari = `${asil?.id ?? ""}|${visible ? 1 : 0}`;
  const [birimSecimi, setBirimSecimi] = useState({ id: SURE_BIRIM_VARSAYILAN, anahtar: birimAnahtari });
  const birimId = birimSecimi.anahtar === birimAnahtari ? birimSecimi.id : SURE_BIRIM_VARSAYILAN;
  const secBirim = (id) => setBirimSecimi({ id, anahtar: birimAnahtari });

  // Ailenin kademe sayısı (koleksiyon üyeleri düz katalog girdisi; aileToplam taşımaz).
  const aileUzunluk = useMemo(() => {
    const m = {};
    for (const r of rozetler) if (r.family) m[r.family] = Math.max(m[r.family] || 0, r.tier);
    return m;
  }, [rozetler]);

  // Rozet belirişi: açılışta yaylanarak büyür. Yalnız dönüşüm + opaklık → native sürücü.
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) return;
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, damping: 13, stiffness: 160, mass: 0.85, useNativeDriver: true }).start();
  }, [visible, asil?.id, pop]);

  const veri = useMemo(() => {
    if (!asil) return null;
    const gizliKilitli = !!asil.hidden && !asil.acik;
    const uyeler = asil.aileUyeleri?.length > 1 ? asil.aileUyeleri : null;
    // Yol dolgusu: kazanılmış düğüm sayısı + sıradaki düğüme kısmi ilerleme.
    // (N-1) aralık üzerinden hesaplanır çünkü çizgi İLK düğümün merkezinden SON
    // düğümün merkezine uzanır, kenarlardan değil.
    let dolgu = 0;
    if (uyeler) {
      const acikSayisi = uyeler.filter((u) => u.acik).length;
      const sonraki = uyeler.find((u) => !u.acik);
      const kismi = sonraki ? sonraki.oran : 0;
      dolgu = uyeler.length > 1
        ? Math.max(0, Math.min(1, (Math.max(0, acikSayisi - 1) + (acikSayisi > 0 ? kismi : 0)) / (uyeler.length - 1)))
        : 0;
    }
    return {
      gizliKilitli,
      uyeler,
      dolgu,
      hedef: asil.sonrakiHedef || (!asil.acik ? asil : null),
      prestij: prestijBilgisi(asil),
      koleksiyon: asil.uyeIdleri ? setUyeleri(asil, rozetler) : null,
    };
  }, [asil, rozetler]);

  if (!asil || !veri) return null;

  const { gizliKilitli, uyeler, dolgu, hedef, prestij, koleksiyon } = veri;
  const acik = !!asil.acik;
  // Çevirici yalnız zaman birimli rozetlerde anlamlı: rozetin kendisi, sıradaki
  // hedefi ya da aile üyelerinden biri birim taşıyorsa gösterilir.
  const sureli = !!asil.birim || !!hedef?.birim || !!uyeler?.some((u) => u.birim);
  const secilenBirim = sureli ? sureBirimiBul(birimId) : undefined;

  const nadirlik = rarityStyle(asil.rarity, theme);
  const sekil = kademeSekli(asil.tier, asil.aileToplam);
  const kadRenk = kademeRengi(sekil.kademe, theme);
  // Sayfanın vurgu rengi: kademeli rozette KADEME, ailesizde nadirlik. Hero parıltısı,
  // yol rayı ve kademe sayacı hep bunu kullanır — modal tek bir renk konuşmalı.
  const vurgu = kadRenk || nadirlik.color;

  const baslik = gizliKilitli ? "???" : badgeAd(asil, lang);
  const aciklama = gizliKilitli
    ? i18nText("autoI18n.rozet_gizli_baslik", "Gizli rozet")
    : badgeAciklama(asil, lang);
  const bolumAdi = (BOLUM_BASLIK[asil.section] || {})[lang] || "";

  const tarihMetni = acik && asil.kazanmaTarihi ? formatTarih(asil.kazanmaTarihi, lang) : null;

  const geriDon = gecisKarti ? () => setGecis({ anahtar: acilisAnahtari, kart: null }) : null;
  const uyeyeGit = (uye) => {
    const kart = kartBul(kartlar, uye.id);
    if (kart) setGecis({ anahtar: acilisAnahtari, kart });
  };

  // Prestij miktarı BİRİMİYLE: "her 500" tek başına neyin 500'ü olduğunu söylemiyor.
  const prestijMiktar = (deger) =>
    [formatBadgeDeger({ birim: prestij?.birim }, deger, lang, secilenBirim), prestijEk(asil.family, lang)]
      .filter(Boolean)
      .join(" ");

  const kutuStili = [styles.kutu, { backgroundColor: withAlpha(theme.primary, 0.55), borderColor: theme.border }];

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      intensity={34}
      dimColor="rgba(0,0,0,0.32)"
      sheetStyle={[styles.sheet, { backgroundColor: theme.secondary }]}
    >
      {/* Hero VE gövde TEK kaydırma alanında: küçük ekranda (667 pt) sabit bir hero
          sayfanın yarısını yerdi ve 13 üyeli koleksiyon ızgarasına 200 pt kalırdı.
          Kapat/geri düğmeleri ve tutamak ise kaydırmayla gitmesin diye sabit katmanda. */}
      <SheetScroll contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 12) + 18 }}>
      {/* ── HERO ── */}
      <View style={styles.hero}>
        <LinearGradient
          pointerEvents="none"
          colors={[withAlpha(vurgu, acik ? 0.36 : 0.13), withAlpha(vurgu, 0)]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.sahne}>
          <View style={[styles.halo, styles.haloDis, { backgroundColor: withAlpha(acik ? vurgu : theme.text.muted, acik ? 0.09 : 0.05) }]} />
          <View style={[styles.halo, styles.haloIc, { backgroundColor: withAlpha(acik ? vurgu : theme.text.muted, acik ? 0.14 : 0.07) }]} />
          <Animated.View
            style={{
              opacity: pop,
              transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) }],
            }}
          >
            <AppBadge
              glyph={gizliKilitli ? "help-outline" : asil.icon}
              glyphSolid={gizliKilitli ? "help" : asil.iconSolid}
              rarity={asil.rarity}
              unlocked={acik}
              progress={gizliKilitli ? 0 : asil.oran}
              size={104}
              sides={sekil.kenar}
              color={kadRenk}
              ornate={sekil.ornate && acik}
              accessibilityLabel={baslik}
            />
          </Animated.View>
        </View>

        {bolumAdi ? (
          <Text allowFontScaling={false} style={[styles.ustYazi, { color: vurgu }]}>
            {bolumAdi}
          </Text>
        ) : null}
        <Text allowFontScaling={false} style={[styles.baslik, { color: theme.text.primary }]}>
          {baslik}
        </Text>

        <View style={styles.pillSatir}>
          <View style={[styles.pill, { backgroundColor: withAlpha(nadirlik.color, 0.14), borderColor: withAlpha(nadirlik.color, 0.38) }]}>
            <Text allowFontScaling={false} style={[styles.pillText, { color: nadirlik.color }]}>
              {nadirlikAdi(asil.rarity, lang)}
            </Text>
          </View>
          <View
            style={[
              styles.pill,
              {
                backgroundColor: acik ? withAlpha("#2ECC71", 0.14) : theme.primary,
                borderColor: acik ? withAlpha("#2ECC71", 0.38) : theme.border,
              },
            ]}
          >
            <AppIcon
              family="Ionicons"
              name={acik ? "checkmark-circle" : "lock-closed"}
              size={11}
              color={acik ? "#2ECC71" : theme.text.muted}
            />
            <Text allowFontScaling={false} style={[styles.pillText, { color: acik ? "#2ECC71" : theme.text.muted }]}>
              {acik
                ? i18nText("autoI18n.rozet_kazanildi_etiket", "Kazanıldı")
                : i18nText("autoI18n.rozet_kilitli_etiket", "Kilitli")}
            </Text>
          </View>
          {uyeler ? (
            <View style={[styles.pill, { backgroundColor: withAlpha(vurgu, 0.14), borderColor: withAlpha(vurgu, 0.38) }]}>
              <Text allowFontScaling={false} style={[styles.pillText, { color: vurgu }]}>
                {i18nText("autoI18n.rozet_aile_kademe", `Kademe ${asil.aileKademe}/${asil.aileToplam}`, {
                  n: asil.aileKademe,
                  toplam: asil.aileToplam,
                })}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Kazanma tarihi. Tarih yoksa (tohumlanan ya da bu özellikten önce kazanılan
            rozet) UYDURULMAZ: "Önceden kazanıldı" denir. */}
        {acik ? (
          <View style={styles.tarihSatir}>
            <AppIcon
              family="Ionicons"
              name={tarihMetni ? "calendar-outline" : "time-outline"}
              size={13}
              color={theme.text.muted}
            />
            <Text allowFontScaling={false} style={[styles.tarihYazi, { color: theme.text.muted }]}>
              {tarihMetni || i18nText("autoI18n.rozet_kazanma_onceden", "Önceden kazanıldı")}
            </Text>
          </View>
        ) : null}
      </View>

      {/* ── GÖVDE ── */}
      <View style={styles.govde}>
        <Text allowFontScaling={false} style={[styles.aciklama, { color: theme.text.muted }]}>
          {aciklama}
        </Text>

        {/* İlerleme. Gizli rozette ÇİZİLMEZ: "18/25" göstermek rozetin ne ölçtüğünü
            ele verir ve gizliliğin tek anlamını öldürür. */}
        {!gizliKilitli && hedef ? (
          <View style={kutuStili}>
            <View style={styles.kutuBaslikSatir}>
              <Text allowFontScaling={false} style={[styles.kutuBaslik, { color: theme.text.muted }]}>
                {acik && asil.sonrakiHedef
                  ? i18nText("autoI18n.rozet_hedef_siradaki", "Sıradaki hedef")
                  : i18nText("autoI18n.rozet_hedef_ilerleme", "İlerleme")}
              </Text>
              <Text allowFontScaling={false} style={[styles.kutuYuzde, { color: theme.accent }]}>
                {yuzdeMetni(hedef.oran, lang)}
              </Text>
            </View>
            {acik && asil.sonrakiHedef ? (
              <Text allowFontScaling={false} style={[styles.hedefAciklama, { color: theme.text.primary }]}>
                {badgeAciklama(hedef, lang)}
              </Text>
            ) : null}
            <View style={[styles.iz, { backgroundColor: withAlpha(theme.text.muted, 0.2) }]}>
              <View style={[styles.dolgu, { backgroundColor: theme.accent, width: `${Math.max(2, Math.round(hedef.oran * 100))}%` }]} />
            </View>
            <View style={styles.kutuAltSatir}>
              <Text allowFontScaling={false} style={[styles.kutuSol, { color: theme.text.primary }]}>
                {formatBadgeAralik(hedef, hedef.ilerleme, hedef.target, lang, secilenBirim)}
              </Text>
              <Text allowFontScaling={false} style={[styles.kutuSag, { color: theme.text.muted }]}>
                {i18nText("autoI18n.rozet_kalan", `${formatBadgeDeger(hedef, kalanMiktar(hedef), lang, secilenBirim)} kaldı`, {
                  deger: formatBadgeDeger(hedef, kalanMiktar(hedef), lang, secilenBirim),
                })}
              </Text>
            </View>

            {/* SÜRE BİRİMİ ÇEVİRİCİSİ. Kilitli gizli rozette çizilmez — birim seçtirmek
                rozetin süre ölçtüğünü ele verirdi. */}
            {sureli ? (
              <View style={styles.birimSatir}>
                {SURE_BIRIMLERI.map((b) => {
                  const secili = b.id === birimId;
                  return (
                    <GlassTouchable
                      key={b.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: secili }}
                      activeOpacity={0.85}
                      onPress={() => secBirim(b.id)}
                      style={[
                        styles.birimChip,
                        {
                          backgroundColor: secili ? withAlpha(vurgu, 0.16) : theme.primary,
                          borderColor: secili ? withAlpha(vurgu, 0.45) : theme.border,
                        },
                      ]}
                    >
                      <Text allowFontScaling={false} style={[styles.birimChipText, { color: secili ? vurgu : theme.text.muted }]}>
                        {/* Büyük harfe JS'te çevriliyor: style textTransform Android'de
                            cihaz yereline göre çalışıyor ve Türkçe yerelli telefonda
                            İngilizce arayüzde "min" → "MİN" oluyordu. */}
                        {(lang === "tr" ? b.ekTr : lang === "es" ? b.ekEs : lang === "pt" ? b.ekPt : lang === "de" ? b.ekDe : b.ekEn).toUpperCase()}
                      </Text>
                    </GlassTouchable>
                  );
                })}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ── DÖNEM MÜHRÜ: geri sayım ── */}
        {asil.section === "muhur" && !acik && typeof asil.kalanGun === "number" && asil.kalanGun >= 0 ? (
          <View style={[kutuStili, { borderColor: asil.yetisir ? theme.border : withAlpha("#F59E0B", 0.55) }]}>
            <View style={styles.satirIkon}>
              <AppIcon family="Ionicons" name="hourglass-outline" size={18} color={asil.yetisir ? vurgu : "#F59E0B"} />
              <Text allowFontScaling={false} style={[styles.satirBaslik, { color: theme.text.primary }]}>
                {asil.kalanGun === 0
                  ? i18nText("autoI18n.rozet_muhur_son_gun", "Bugün dönemin son günü")
                  : i18nText("autoI18n.rozet_muhur_kalan", `Dönem bitimine ${asil.kalanGun} gün`, { n: asil.kalanGun })}
              </Text>
            </View>
            {!asil.yetisir ? (
              <Text allowFontScaling={false} style={[styles.uyari, { color: "#F59E0B" }]}>
                {i18nText(
                  "autoI18n.rozet_muhur_yetismez",
                  `Yetişmesi zor: ${asil.eksikGun} gün daha işaretlemen gerek`,
                  { n: asil.eksikGun },
                )}
              </Text>
            ) : null}
            <Text allowFontScaling={false} style={[styles.not, { color: theme.text.muted }]}>
              {i18nText("autoI18n.rozet_muhur_not", "Kaçırılan mühür bir daha kazanılamaz.")}
            </Text>
          </View>
        ) : null}

        {/* ── KOLEKSİYON: üyeler ── */}
        {koleksiyon && koleksiyon.length ? (
          <View style={styles.bolum}>
            <Text allowFontScaling={false} style={[styles.bolumBaslik, { color: theme.text.muted }]}>
              {i18nText("autoI18n.rozet_set_uyeler", "Koleksiyondakiler")}
              {"  "}
              <Text style={{ color: vurgu }}>
                {koleksiyon.filter((u) => u.acik).length}/{koleksiyon.length}
              </Text>
            </Text>
            <View style={styles.izgara}>
              {koleksiyon.map((u) => {
                const s = kademeSekli(u.tier, aileUzunluk[u.family] || 0);
                const gizli = u.hidden && !u.acik;
                return (
                  <TouchableOpacity
                    key={u.id}
                    activeOpacity={0.8}
                    onPress={() => uyeyeGit(u)}
                    accessibilityRole="button"
                    accessibilityLabel={`${gizli ? "???" : badgeAd(u, lang)}, ${
                      u.acik ? i18nText("autoI18n.rozet_kazanildi_etiket", "Kazanıldı") : i18nText("autoI18n.rozet_kilitli_etiket", "Kilitli")
                    }`}
                    style={[styles.uye, { opacity: u.acik ? 1 : 0.62 }]}
                  >
                    <AppBadge
                      glyph={gizli ? "help-outline" : u.icon}
                      glyphSolid={gizli ? "help" : u.iconSolid}
                      rarity={u.rarity}
                      unlocked={u.acik}
                      progress={gizli ? 0 : u.oran}
                      size={44}
                      sides={s.kenar}
                      color={kademeRengi(s.kademe, theme)}
                      ornate={s.ornate && u.acik}
                    />
                    <Text
                      allowFontScaling={false}
                      numberOfLines={2}
                      style={[styles.uyeAd, { color: u.acik ? theme.text.primary : theme.text.muted }]}
                    >
                      {gizli ? "???" : badgeAd(u, lang)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* ── YOL: ailenin tüm kademeleri ── */}
        {uyeler ? (
          <View style={styles.bolum}>
            <Text allowFontScaling={false} style={[styles.bolumBaslik, { color: theme.text.muted }]}>
              {i18nText("autoI18n.rozet_yol_baslik", "Kademeler")}
              {"  "}
              <Text style={{ color: vurgu }}>
                {asil.aileKademe}/{asil.aileToplam}
              </Text>
            </Text>

            <View style={styles.yol}>
              {/* Çizgi düğümlerin ALTINDA durur ve ilk/son düğümün MERKEZİNDEN
                  başlayıp biter. Kenar boşluğu YÜZDE: düğümler `flex: 1` olduğu için
                  her biri genişliğin 1/N'i, ilk düğümün merkezi %(50/N)'de — sabit
                  piksel, aileler 5 kademeye çıkınca 320pt ekranda rayı kaydırırdı. */}
              <View style={[styles.rayWrap, { left: `${50 / uyeler.length}%`, right: `${50 / uyeler.length}%` }]}>
                <View style={[styles.ray, { backgroundColor: withAlpha(theme.text.muted, 0.18) }]} />
                {/* Dolu kısım ULAŞILAN kademenin rengiyle çizilir. */}
                <View style={[styles.rayDolu, { backgroundColor: vurgu, width: `${Math.round(dolgu * 100)}%` }]} />
              </View>

              {uyeler.map((u) => {
                const s = kademeSekli(u.tier, uyeler.length);
                const suAnki = u.id === asil.id;
                return (
                  <View key={u.id} style={styles.dugum}>
                    <View style={[styles.dugumHalka, suAnki && { borderColor: vurgu, backgroundColor: theme.secondary }]}>
                      <AppBadge
                        glyph={u.icon}
                        glyphSolid={u.iconSolid}
                        rarity={u.rarity}
                        unlocked={u.acik}
                        progress={u.oran}
                        size={DUGUM_ROZET}
                        sides={s.kenar}
                        color={kademeRengi(s.kademe, theme)}
                        ornate={s.ornate && u.acik}
                        accessibilityLabel={badgeAd(u, lang)}
                      />
                    </View>
                    <Text
                      allowFontScaling={false}
                      numberOfLines={1}
                      style={[styles.dugumHedef, { color: u.acik ? theme.text.primary : theme.text.muted, fontWeight: suAnki ? "900" : "700" }]}
                    >
                      {/* Birim eki yok: çevirici çipleri hangi birimde okunduğunu
                          söylüyor ve düğüm hücresi dar — "525.600 dk" burada kırpılırdı. */}
                      {formatBadgeSayi(u, u.target, lang, secilenBirim)}
                    </Text>
                    <Text
                      allowFontScaling={false}
                      numberOfLines={2}
                      style={[styles.dugumAd, { color: u.acik ? theme.text.muted : withAlpha(theme.text.muted, 0.6) }]}
                    >
                      {badgeAd(u, lang)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* ── PRESTİJ: zirvenin ötesi ── */}
        {prestij ? (
          <View style={[kutuStili, { borderColor: withAlpha(GOLD, 0.45) }]}>
            <View style={styles.kutuBaslikSatir}>
              <View style={styles.satirIkon}>
                <AppIcon family="Ionicons" name="star" size={15} color={GOLD} />
                <Text allowFontScaling={false} style={[styles.kutuBaslik, { color: GOLD }]}>
                  {i18nText("autoI18n.rozet_prestij_baslik", "Prestij")}
                </Text>
              </View>
              <Text allowFontScaling={false} style={[styles.kutuYuzde, { color: GOLD }]}>
                ★{prestij.n}
              </Text>
            </View>
            <Text allowFontScaling={false} style={[styles.hedefAciklama, { color: theme.text.primary }]}>
              {i18nText(
                "autoI18n.rozet_prestij_aciklama",
                `Zirvedesin — buradan sonra her ${prestijMiktar(prestij.adim)} yeni bir basamak`,
                { adim: prestijMiktar(prestij.adim) },
              )}
            </Text>
            <View style={[styles.iz, { backgroundColor: withAlpha(GOLD, 0.2) }]}>
              <View style={[styles.dolgu, { backgroundColor: GOLD, width: `${Math.max(2, Math.round(prestij.oran * 100))}%` }]} />
            </View>
            <Text allowFontScaling={false} style={[styles.kutuSag, { color: theme.text.muted, marginTop: 7 }]}>
              {i18nText(
                "autoI18n.rozet_prestij_kalan",
                `Sonraki basamağa ${prestijMiktar(prestij.kalan)}`,
                { deger: prestijMiktar(prestij.kalan) },
              )}
            </Text>
          </View>
        ) : null}

        {/* Tek kademeli KATALOG rozeti: koleksiyon/mühür kendi bloğuyla zaten konuşuyor. */}
        {!uyeler && !koleksiyon && asil.section !== "muhur" ? (
          <Text allowFontScaling={false} style={[styles.tekKademe, { color: withAlpha(theme.text.muted, 0.75) }]}>
            {i18nText("autoI18n.rozet_tek_kademe", "Tek kademeli rozet")}
          </Text>
        ) : null}
      </View>
      </SheetScroll>

      {/* Sabit katman: tutamak + geri/kapat. İçerik kaydırılsa da erişilebilir kalır. */}
      <View style={styles.sabitUst} pointerEvents="box-none">
        <View style={styles.tutamak} pointerEvents="none">
          <View style={[styles.tutamakCizgi, { backgroundColor: withAlpha(theme.text.muted, 0.38) }]} />
        </View>
        <View style={styles.ustSatir} pointerEvents="box-none">
          {geriDon ? (
            <GlassCloseButton icon="chevron-back" onPress={geriDon} />
          ) : (
            <View style={styles.ustBosluk} />
          )}
          <GlassCloseButton onPress={onClose} />
        </View>
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: "hidden",
    maxHeight: "92%",
  },
  hero: { alignItems: "center", paddingHorizontal: 22, paddingTop: 30, paddingBottom: 14 },
  sabitUst: { position: "absolute", top: 0, left: 0, right: 0 },
  tutamak: { position: "absolute", top: 8, left: 0, right: 0, alignItems: "center" },
  tutamakCizgi: { width: 40, height: 4, borderRadius: 2 },
  ustSatir: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 18,
    paddingHorizontal: 16,
  },
  ustBosluk: { width: 34, height: 34 },
  sahne: { width: 188, height: 188, alignItems: "center", justifyContent: "center" },
  halo: { position: "absolute", borderRadius: 999 },
  haloDis: { width: 188, height: 188 },
  haloIc: { width: 146, height: 146 },
  ustYazi: { marginTop: 2, fontSize: 10.5, fontWeight: "900", letterSpacing: 1.1, textTransform: "uppercase" },
  baslik: { marginTop: 5, fontSize: 25, fontWeight: "900", letterSpacing: -0.4, textAlign: "center" },
  pillSatir: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 7, marginTop: 11 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 11,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4.5,
  },
  pillText: { fontSize: 11, fontWeight: "900" },
  tarihSatir: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 11 },
  tarihYazi: { fontSize: 12, fontWeight: "750" },

  govde: { paddingHorizontal: 20, paddingTop: 4, gap: 14 },
  aciklama: { fontSize: 13.5, fontWeight: "650", lineHeight: 20, textAlign: "center" },

  kutu: { borderRadius: 18, borderWidth: 1, padding: 14 },
  kutuBaslikSatir: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  kutuBaslik: { fontSize: 11, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" },
  kutuYuzde: { fontSize: 20, fontWeight: "900", letterSpacing: -0.4 },
  hedefAciklama: { marginTop: 5, fontSize: 13, fontWeight: "750", lineHeight: 18 },
  iz: { height: 9, borderRadius: 5, overflow: "hidden", marginTop: 11 },
  dolgu: { height: "100%", borderRadius: 5 },
  kutuAltSatir: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  kutuSol: { fontSize: 12.5, fontWeight: "900" },
  kutuSag: { fontSize: 12, fontWeight: "750" },

  birimSatir: { flexDirection: "row", gap: 6, marginTop: 12, alignSelf: "center" },
  birimChip: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 5, minWidth: 46, alignItems: "center" },
  birimChipText: { fontSize: 11, fontWeight: "900" },

  satirIkon: { flexDirection: "row", alignItems: "center", gap: 8 },
  satirBaslik: { fontSize: 14, fontWeight: "850" },
  uyari: { marginTop: 8, fontSize: 12.5, fontWeight: "800", lineHeight: 17 },
  not: { marginTop: 8, fontSize: 12, fontWeight: "650", lineHeight: 17 },

  bolum: { width: "100%", marginTop: 6 },
  bolumBaslik: { fontSize: 11, fontWeight: "850", letterSpacing: 0.7, textTransform: "uppercase", marginBottom: 12 },

  izgara: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  uye: { width: "25%", alignItems: "center", paddingHorizontal: 4, marginBottom: 14 },
  uyeAd: { marginTop: 6, fontSize: 10, lineHeight: 12.5, fontWeight: "750", textAlign: "center", minHeight: 25 },

  yol: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  // Ray, düğüm rozetinin DİKEY MERKEZİNE hizalanır. Halka yüksekliği
  // 2(border) + 3(padding) + 40(rozet) + 3 + 2 = 50 → merkez 25; ray 3px olduğu
  // için üst kenarı 25 − 1.5 = 23.5'e oturur. `dugumHalka`nın borderWidth'i seçili
  // olmayan düğümde de 2 (rengi saydam): yalnızca seçilide vermek düğümü 4px
  // kısaltıp rayı eğri gösterirdi.
  rayWrap: { position: "absolute", top: 23.5, height: 3 },
  ray: { ...StyleSheet.absoluteFillObject, borderRadius: 2 },
  rayDolu: { height: 3, borderRadius: 2 },
  // `flex: 1` düğümleri eşit paylaştırır: sabit 58 px × 5 = 290 px, 320 pt'lik
  // cihazda (iç genişlik 276) sheet'in overflow:hidden'ı 5. düğümü keserdi.
  // `minWidth: 0` uzun rozet adının hücreyi şişirmesini engeller.
  dugum: { flex: 1, minWidth: 0, alignItems: "center" },
  dugumHalka: { padding: 3, borderRadius: 26, borderWidth: 2, borderColor: "transparent" },
  dugumHedef: { fontSize: 12, marginTop: 6 },
  dugumAd: { fontSize: 9, fontWeight: "700", textAlign: "center", marginTop: 2, lineHeight: 12 },
  tekKademe: { fontSize: 11, fontWeight: "700", textAlign: "center", marginTop: 4 },
});
