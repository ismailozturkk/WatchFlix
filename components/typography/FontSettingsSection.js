// components/typography/FontSettingsSection.js
//
// Ayarlar > Kişiselleştirme > Uygulama yazı tipi.
//
// Tek bir font yerine ÜÇ ROL ayrı ayrı seçilir: BAŞLIK / YAZI / RAKAM.
// Gerekçe: her yazı başlığa ya da rakama uymuyor — dar sinematik bir font
// başlıkta harika görünürken uzun bir açıklamada okunmuyor, sayılar ise çoğu
// zaman kendi karakterini istiyor. Rol ayrımının nasıl yapıldığı (hangi metin
// hangi role düşer) utils/typographyRoles.js içinde yazılı.
//
// ARAYÜZ ÜÇ ADIMDIR, fazlası yok:
//   1) Rolü seç      → segment; her segment o rolün SEÇİLİ fontunu da yazar,
//                      böylece üç seçimin tamamı tek bakışta görünür.
//   2) Önizlemeye bak → aktif rolün fontuyla tek satır örnek.
//   3) Fontu seç     → ızgara; her hücrede fontun kendi karakteriyle bir örnek
//                      ve altında adı.
//
// Bu bileşen kendi kartını ÇİZMEZ; PersonalizationScreen onu ps.card içine
// sarar ve colors=buildUiColors(theme) ile besler.
import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import AppIcon from "../AppIcon";
import { ensureCatalogFontsLoaded } from "../../context/TypographyContext";
import {
  FONT_PRESETS,
  FONT_PRESET_BY_ID,
  TEXT_ROLES,
  isPresetRecommendedFor,
  resolveFontFamily,
} from "../../utils/typographyRoles";
import {
  setAllFontRoles,
  setFontRole,
  useTypographyState,
} from "../../services/typographySettings";
import { i18nText } from "../../utils/i18nText";
import { alpha } from "../../theme/colors";

const SISTEM_FONTU = Platform.select({
  ios: "System",
  android: "sans-serif",
  default: "system-ui",
});

const KAPALI_GALERI_LIMITI = 9;

// Rol tanımları. `etiket` segmentte sığması için KISA; `ornek` ızgara
// hücresindeki, `onizleme` ise büyük önizlemedeki metindir.
const ROLLER = [
  {
    id: "heading",
    etiket: () => i18nText("autoI18n.rol_baslik", "Başlık"),
    ornek: "İzle",
    onizleme: () =>
      i18nText("autoI18n.font_onizleme_varsayilan", "Film gecesi başlıyor"),
    onizlemeBoyut: 22,
  },
  {
    id: "body",
    etiket: () => i18nText("autoI18n.rol_yazi", "Yazı"),
    ornek: "Aa",
    onizleme: () =>
      i18nText(
        "autoI18n.font_onizleme_govde",
        "Yeni keşifler, listeler ve izleme istatistiklerin tek yerde.",
      ),
    onizlemeBoyut: 14,
  },
  {
    id: "numeric",
    etiket: () => i18nText("autoI18n.rol_rakam", "Rakam"),
    ornek: "8.7",
    onizleme: () =>
      i18nText("autoI18n.font_onizleme_rakam", "24 film · 8.7 puan · 2026"),
    onizlemeBoyut: 19,
  },
];

export default function FontSettingsSection({ colors, language }) {
  const durum = useTypographyState();
  const locale = language === "en" ? "en" : "tr";
  const [aktifRol, setAktifRol] = useState("heading");
  const [tumunuGoster, setTumunuGoster] = useState(false);

  // Galeri önizlemeleri katalogdaki TÜM dosyaları ister; açılışta yalnız
  // seçili rollerin dosyaları yüklenir (bkz. TypographyContext). Gecikmiş arka
  // plan yüklemesi henüz koşmadıysa burada beklemeden başlat.
  useEffect(() => {
    ensureCatalogFontsLoaded();
  }, []);

  const rolMeta = ROLLER.find((rol) => rol.id === aktifRol) || ROLLER[0];
  const secili =
    FONT_PRESETS.find((preset) => preset.id === durum[aktifRol]) ||
    FONT_PRESETS[0];
  const uygunPresetler = FONT_PRESETS
    .filter((preset) => isPresetRecommendedFor(preset.id, aktifRol))
    // Kullanıcının özellikle seçtiği marjinal aileler kapalı galerinin ilk
    // dokuz kartında görünür. Önce o role özel aileler, sonra iki role ortak,
    // en sonda üç role ortak aileler gelir.
    .sort((a, b) => {
      const featuredFarki =
        Number(Boolean(b.featured)) - Number(Boolean(a.featured));
      if (featuredFarki) return featuredFarki;
      if (a.featured && b.featured) return a.bestFor.length - b.bestFor.length;
      return 0;
    });
  const tumRollereUygun = TEXT_ROLES.every((rol) =>
    isPresetRecommendedFor(secili.id, rol),
  );
  const kapaliPresetler = uygunPresetler.slice(0, KAPALI_GALERI_LIMITI);
  const seciliKapaliykenGorunuyor = kapaliPresetler.some(
    (preset) => preset.id === secili.id,
  );
  const gosterilenPresetler = tumunuGoster
    ? uygunPresetler
    : seciliKapaliykenGorunuyor
      ? kapaliPresetler
      : [...kapaliPresetler.slice(0, KAPALI_GALERI_LIMITI - 1), secili];

  // Örnekleri ELDEN veriyoruz: AppText, stilde fontFamily görünce rol
  // çözümlemesini atlar (bkz. components/typography/AppText.js) — henüz
  // seçilmemiş bir fontu göstermenin tek yolu budur. Katalog daha inmediyse
  // yalnız seçili rollerin (açılışta yüklenen) aileleri gerçek fontla çizilir;
  // kalan hücreler catalogFontsLoaded açılınca kendi fontuna döner.
  const dosyasiYuklu = (presetId) =>
    durum.catalogFontsLoaded ||
    (durum.fontsLoaded && TEXT_ROLES.some((rol) => durum[rol] === presetId));
  const ailesi = (presetId, agirlik) =>
    presetId === "system" || !dosyasiYuklu(presetId)
      ? SISTEM_FONTU
      : resolveFontFamily({ presetId, fontWeight: agirlik }) || SISTEM_FONTU;

  // Özel font adı zaten doğru ağırlık dosyasını gösterir; Android'in aynı anda
  // sentetik kalınlık aramasını engelle.
  const agirlik = (presetId) => (presetId === "system" ? "800" : "400");

  return (
    <View>
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: colors.iconTeal }]}>
          <AppIcon
            family="MaterialCommunityIcons"
            name="format-font"
            size={17}
            color={colors.teal}
          />
        </View>
        <View style={styles.headerCopy}>
          <Text
            allowFontScaling={false}
            style={[styles.title, { color: colors.text }]}
          >
            {i18nText("autoI18n.uygulama_yazi_tipi", "Uygulama yazı tipi")}
          </Text>
          <Text
            allowFontScaling={false}
            style={[styles.subtitle, { color: colors.muted }]}
          >
            {i18nText(
              "autoI18n.font_rol_alt_baslik_kisa",
              "Başlık, yazı ve rakam için ayrı ayrı",
            )}
          </Text>
        </View>
      </View>

      {/* 1) ROL — her segment o rolün seçili fontunu da yazar: üç seçimin
          tamamı, hiçbir yere dokunmadan görünür. */}
      <View style={[styles.roleTabs, { backgroundColor: colors.cardAlt }]}>
        {ROLLER.map((rol) => {
          const aktif = aktifRol === rol.id;
          const preset = FONT_PRESET_BY_ID[durum[rol.id]] || FONT_PRESETS[0];
          return (
            <TouchableOpacity
              key={rol.id}
              activeOpacity={0.75}
              onPress={() => {
                setAktifRol(rol.id);
                setTumunuGoster(false);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: aktif }}
              style={[
                styles.roleTab,
                aktif && { backgroundColor: colors.accent },
              ]}
            >
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[
                  styles.roleTabLabel,
                  { color: aktif ? colors.white : colors.text },
                ]}
              >
                {rol.etiket()}
              </Text>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[
                  styles.roleTabFont,
                  {
                    color: aktif
                      ? alpha(colors.white, 0.85)
                      : colors.muted,
                  },
                ]}
              >
                {preset.names[locale]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 2) ÖNİZLEME — tek satır, aktif rolün fontuyla. */}
      <View
        style={[
          styles.preview,
          {
            backgroundColor: colors.cardAlt,
            borderColor: alpha(colors.accent, 0.28),
          },
        ]}
      >
        <Text
          allowFontScaling={false}
          numberOfLines={2}
          style={[
            styles.previewText,
            {
              color: colors.text,
              fontSize: rolMeta.onizlemeBoyut,
              lineHeight: rolMeta.onizlemeBoyut * 1.35,
              fontFamily: ailesi(secili.id, 700),
              fontWeight: agirlik(secili.id),
            },
          ]}
        >
          {rolMeta.onizleme()}
        </Text>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[
            styles.previewMeta,
            { color: colors.muted, fontFamily: SISTEM_FONTU },
          ]}
        >
          {secili.descriptions[locale]}
        </Text>
      </View>

      {/* 3) FONT — aktif role uygun seçenekler. Bazı okunaklı aileler birden
          fazla sekmede ortak kalır; dekoratif aileler yalnız başlıkta görünür. */}
      <View style={styles.galleryHeader}>
        <Text
          allowFontScaling={false}
          style={[styles.galleryTitle, { color: colors.text }]}
        >
          {rolMeta.etiket()}
        </Text>
        <View style={[styles.countBadge, { backgroundColor: colors.accentDim }]}>
          <Text
            allowFontScaling={false}
            style={[styles.countBadgeText, { color: colors.accentStrong }]}
          >
            {i18nText(
              "autoI18n.font_secenek_sayisi",
              `${uygunPresetler.length} seçenek`,
              { count: uygunPresetler.length },
            )}
          </Text>
        </View>
      </View>
      <View style={styles.grid}>
        {gosterilenPresetler.map((preset) => {
          const aktif = durum[aktifRol] === preset.id;
          return (
            <TouchableOpacity
              key={preset.id}
              activeOpacity={0.75}
              onPress={() => setFontRole(aktifRol, preset.id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: aktif }}
              accessibilityLabel={preset.names[locale]}
              style={[
                styles.cell,
                {
                  backgroundColor: aktif ? colors.accentDim : colors.cardAlt,
                  borderColor: aktif ? colors.accent : colors.borderMuted,
                },
              ]}
            >
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[
                  styles.cellSample,
                  {
                    color: aktif ? colors.accentStrong : colors.text,
                    fontFamily: ailesi(preset.id, 700),
                    fontWeight: agirlik(preset.id),
                  },
                ]}
              >
                {rolMeta.ornek}
              </Text>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[styles.cellName, { color: colors.muted }]}
              >
                {preset.names[locale]}
              </Text>

              {aktif ? (
                <View style={[styles.check, { backgroundColor: colors.accent }]}>
                  <AppIcon name="checkmark" size={9} color={colors.white} />
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {uygunPresetler.length > KAPALI_GALERI_LIMITI ? (
        <TouchableOpacity
          activeOpacity={0.72}
          onPress={() => setTumunuGoster((deger) => !deger)}
          accessibilityRole="button"
          accessibilityState={{ expanded: tumunuGoster }}
          style={[styles.expandButton, { borderColor: colors.borderMuted }]}
        >
          <Text
            allowFontScaling={false}
            style={[styles.expandButtonText, { color: colors.accentStrong }]}
          >
            {tumunuGoster
              ? i18nText("autoI18n.font_daha_az_goster", "Daha az göster")
              : i18nText(
                  "autoI18n.font_tumunu_goster",
                  `Tüm ${uygunPresetler.length} fontu göster`,
                  { count: uygunPresetler.length },
                )}
          </Text>
          <AppIcon
            name={tumunuGoster ? "chevron-up" : "chevron-down"}
            size={15}
            color={colors.accent}
          />
        </TouchableOpacity>
      ) : null}

      {tumRollereUygun ? (
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => setAllFontRoles(durum[aktifRol])}
          accessibilityRole="button"
          style={[
            styles.applyAll,
            {
              backgroundColor: alpha(colors.accent, 0.1),
              borderColor: alpha(colors.accent, 0.24),
            },
          ]}
        >
          <AppIcon name="color-wand-outline" size={14} color={colors.accent} />
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.applyAllText, { color: colors.accentStrong }]}
          >
            {i18nText(
              "autoI18n.font_ucune_uygula",
              `“${secili.names[locale]}” fontunu üçüne birden uygula`,
              { font: secili.names[locale] },
            )}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
  },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: { flex: 1 },
  title: { fontSize: 14, fontWeight: "600" },
  subtitle: { fontSize: 10.5, lineHeight: 14, marginTop: 2 },

  // ── 1) Rol segmenti ──
  roleTabs: {
    flexDirection: "row",
    gap: 3,
    marginHorizontal: 12,
    padding: 3,
    borderRadius: 12,
  },
  roleTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: 9,
  },
  roleTabLabel: { fontSize: 11.5, fontWeight: "700" },
  roleTabFont: { fontSize: 9, fontWeight: "500" },

  // ── 2) Önizleme ──
  preview: {
    marginHorizontal: 12,
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 68,
    justifyContent: "center",
  },
  previewText: { textAlign: "center" },
  previewMeta: {
    marginTop: 7,
    fontSize: 9.5,
    fontWeight: "500",
    textAlign: "center",
  },

  // ── 3) Font ızgarası ──
  galleryHeader: {
    minHeight: 34,
    paddingHorizontal: 14,
    paddingTop: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  galleryTitle: { fontSize: 12, fontWeight: "700" },
  countBadge: {
    minHeight: 22,
    borderRadius: 11,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  countBadgeText: { fontSize: 9, fontWeight: "700" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    paddingHorizontal: 12,
    paddingTop: 7,
  },
  cell: {
    // Üç sütun: 3×%31.5 + 2×7px boşluk ≈ tam genişlik.
    width: "31.5%",
    minHeight: 58,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  cellSample: { fontSize: 19, letterSpacing: -0.3 },
  cellName: { fontSize: 8.5, fontWeight: "600" },
  check: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  expandButton: {
    minHeight: 36,
    marginHorizontal: 12,
    marginTop: 9,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  expandButtonText: { fontSize: 10.5, fontWeight: "700" },
  applyAll: {
    minHeight: 36,
    marginHorizontal: 12,
    marginTop: 9,
    marginBottom: 12,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  applyAllText: { flexShrink: 1, fontSize: 10.5, fontWeight: "700" },
});
