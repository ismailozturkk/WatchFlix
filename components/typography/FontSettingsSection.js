// components/typography/FontSettingsSection.js
//
// Ayarlar > Kişiselleştirme > Uygulama yazı tipi.
//
// Tek bir font yerine ÜÇ ROL ayrı ayrı seçilir: BAŞLIK / YAZI / RAKAM.
// Her rolde 9'arlı yatay kaydırılabilir sayfa (3x3 sabit boyutlu grid) yapısı
// kullanılarak üstteki canlı önizleme ve rol sekmelerinin daima görünür kalması
// ve font karakterlerinden bağımsız kusursuz kart hizalaması sağlanır.
import { copyLanguage } from "../../utils/appLanguages";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
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
import { isFontPresetFree } from "../../utils/premiumFeatures";
import { usePremiumGate } from "../../hooks/usePremiumGate";
import GlassTouchable from "../common/GlassTouchable";
import { GLASS_PRESS_ROOM } from "../../utils/liquidGlass";

const SISTEM_FONTU = Platform.select({
  ios: "System",
  android: "sans-serif",
  default: "system-ui",
});

const SAYFA_KAPASITESI = 9;
const SUTUN_SAYISI = 3;
const SATIR_SAYISI = 3;

// Dizi parçalama yardımcısı
const chunkArray = (arr, size) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

// Rol tanımları. `etiket` segmentte sığması için KISA; `ornek` ızgara
// hücresindeki, `onizleme` ise büyük önizlemedeki metindir.
const ROLLER = [
  {
    id: "heading",
    etiket: () => i18nText("autoI18n.rol_baslik", "Başlık"),
    ornek: () => i18nText("autoI18n.rol_baslik", "Başlık"),
    onizleme: () =>
      i18nText("autoI18n.font_onizleme_varsayilan", "Film gecesi başlıyor"),
    onizlemeBoyut: 22,
  },
  {
    id: "body",
    etiket: () => i18nText("autoI18n.rol_yazi", "Yazı"),
    ornek: () => i18nText("autoI18n.rol_yazi", "Yazı"),
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
    ornek: () => "8.7",
    onizleme: () =>
      i18nText("autoI18n.font_onizleme_rakam", "24 film · 8.7 puan · 2026"),
    onizlemeBoyut: 19,
  },
];

export default function FontSettingsSection({ colors, language }) {
  const durum = useTypographyState();
  // Katalog Premium'da; ücretsiz set utils/premiumFeatures.js'te. `durum[rol]`
  // ÇİZİLEN fonttur: Free'ye düşmüş kullanıcının premium seçimi `selected`'da
  // saklı kalır ve burada notla belirtilir.
  const fontGate = usePremiumGate("font_catalog");
  const kilitli = (presetId) =>
    !durum.premiumFontsAllowed && !isFontPresetFree(presetId);
  const saklananSecimVar = TEXT_ROLES.some(
    (rol) => durum.selected && durum.selected[rol] !== durum[rol],
  );
  const locale = copyLanguage(language, ["tr", "en", "es", "pt", "de"]);
  const [aktifRol, setAktifRol] = useState("heading");
  const [aktifSayfa, setAktifSayfa] = useState(0);
  const [galleryWidth, setGalleryWidth] = useState(0);
  // Sayfa, galeri genişliğinin iki yanına GLASS_PRESS_ROOM ekler: kenardaki cam hücre basılınca
  // kaydırma görünümünün sınırında kesilmesin (görünüm aynı miktarda dışa taşar, hizalama aynı).
  const sayfaGenisligi = galleryWidth + 2 * GLASS_PRESS_ROOM;
  const scrollRef = useRef(null);

  // Galeri önizlemeleri katalogdaki TÜM dosyaları ister; açılışta yalnız
  // seçili rollerin dosyaları yüklenir. Gecikmiş arka plan yüklemesi henüz
  // koşmadıysa burada beklemeden başlat.
  useEffect(() => {
    ensureCatalogFontsLoaded();
  }, []);

  const rolMeta = ROLLER.find((rol) => rol.id === aktifRol) || ROLLER[0];
  const secili =
    FONT_PRESET_BY_ID[durum[aktifRol]] ||
    FONT_PRESETS.find((preset) => preset.id === durum[aktifRol]) ||
    FONT_PRESETS[0];

  const uygunPresetler = useMemo(() => {
    return FONT_PRESETS
      .filter((preset) => isPresetRecommendedFor(preset.id, aktifRol))
      .sort((a, b) => {
        const featuredFarki =
          Number(Boolean(b.featured)) - Number(Boolean(a.featured));
        if (featuredFarki) return featuredFarki;
        if (a.featured && b.featured) return a.bestFor.length - b.bestFor.length;
        return 0;
      });
  }, [aktifRol]);

  const tumRollereUygun = TEXT_ROLES.every((rol) =>
    isPresetRecommendedFor(secili.id, rol),
  );

  const toplamSayfa = Math.max(
    1,
    Math.ceil(uygunPresetler.length / SAYFA_KAPASITESI),
  );

  // Sayfaları 3'erli satırlar ve sütunlar halinde düzenle
  const sayfalar = useMemo(() => {
    const pList = [];
    for (let p = 0; p < toplamSayfa; p++) {
      const sayfaPresetleri = uygunPresetler.slice(
        p * SAYFA_KAPASITESI,
        (p + 1) * SAYFA_KAPASITESI,
      );
      const rows = chunkArray(sayfaPresetleri, SUTUN_SAYISI);
      // Her satırı 3 öğeye tamamla (boş alanlar simetrik kalsın)
      for (const row of rows) {
        while (row.length < SUTUN_SAYISI) {
          row.push(null);
        }
      }
      // Sayfayı da 3 satıra tamamla (sayfa yükseklikleri eşit kalsın)
      while (rows.length < SATIR_SAYISI) {
        rows.push([null, null, null]);
      }
      pList.push(rows);
    }
    return pList;
  }, [toplamSayfa, uygunPresetler]);

  // Rol değiştiğinde seçili fontun bulunduğu sayfaya otomatik odaklan
  const rolDegistir = (rolId) => {
    setAktifRol(rolId);
    const yeniUygunlar = FONT_PRESETS.filter((p) =>
      isPresetRecommendedFor(p.id, rolId),
    );
    const seciliId = durum[rolId];
    const index = yeniUygunlar.findIndex((p) => p.id === seciliId);
    const hedefSayfa = index >= 0 ? Math.floor(index / SAYFA_KAPASITESI) : 0;
    setAktifSayfa(hedefSayfa);
    if (galleryWidth > 0) {
      scrollRef.current?.scrollTo({
        x: hedefSayfa * sayfaGenisligi,
        animated: false,
      });
    }
  };

  const gitSayfa = (hedef) => {
    const s = Math.max(0, Math.min(hedef, toplamSayfa - 1));
    setAktifSayfa(s);
    if (galleryWidth > 0) {
      scrollRef.current?.scrollTo({ x: s * sayfaGenisligi, animated: true });
    }
  };

  const dosyasiYuklu = (presetId) =>
    durum.catalogFontsLoaded ||
    (durum.fontsLoaded && TEXT_ROLES.some((rol) => durum[rol] === presetId));
  const ailesi = (presetId, agirlik) =>
    presetId === "system" || !dosyasiYuklu(presetId)
      ? SISTEM_FONTU
      : resolveFontFamily({ presetId, fontWeight: agirlik }) || SISTEM_FONTU;

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

      {/* 1) ROL SEÇİMİ — her segment o rolün seçili fontunu gösterir */}
      <View style={[styles.roleTabs, { backgroundColor: colors.cardAlt }]}>
        {ROLLER.map((rol) => {
          const aktif = aktifRol === rol.id;
          const preset = FONT_PRESET_BY_ID[durum[rol.id]] || FONT_PRESETS[0];
          return (
            <GlassTouchable
              key={rol.id}
              activeOpacity={0.75}
              onPress={() => rolDegistir(rol.id)}
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
            </GlassTouchable>
          );
        })}
      </View>

      {/* 2) CANLI ÖNİZLEME — aktif rolün seçili fontuyla canlı örnek */}
      <View
        style={[
          styles.preview,
          {
            backgroundColor: colors.cardAlt,
            borderColor: alpha(colors.accent, 0.28),
          },
        ]}
      >
        <View style={styles.previewHeader}>
          <View style={styles.previewTag}>
            <AppIcon name="eye-outline" size={11} color={colors.accentStrong} />
            <Text
              allowFontScaling={false}
              style={[styles.previewTagText, { color: colors.accentStrong }]}
            >
              {rolMeta.etiket()} {i18nText("autoI18n.onizleme", "Önizlemesi")}
            </Text>
          </View>
          <View
            style={[
              styles.previewFontBadge,
              { backgroundColor: alpha(colors.accent, 0.12) },
            ]}
          >
            <Text
              allowFontScaling={false}
              style={[styles.previewFontBadgeText, { color: colors.accentStrong }]}
            >
              {secili.names[locale]}
            </Text>
          </View>
        </View>

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

      {/* 3) FONT GALERİSİ — 3x3 (9 fontluk) yatay kaydırılabilir sayfalar */}
      <View style={styles.galleryHeader}>
        <View style={styles.galleryTitleRow}>
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

        {toplamSayfa > 1 ? (
          <View style={styles.paginationNav}>
            <GlassTouchable
              activeOpacity={0.7}
              onPress={() => gitSayfa(aktifSayfa - 1)}
              disabled={aktifSayfa === 0}
              style={[
                styles.pageArrowBtn,
                {
                  backgroundColor: colors.cardAlt,
                  borderColor: colors.borderMuted,
                  opacity: aktifSayfa === 0 ? 0.35 : 1,
                },
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <AppIcon name="chevron-back" size={13} color={colors.text} />
            </GlassTouchable>
            <Text
              allowFontScaling={false}
              style={[styles.pageCounterText, { color: colors.muted }]}
            >
              {aktifSayfa + 1} / {toplamSayfa}
            </Text>
            <GlassTouchable
              activeOpacity={0.7}
              onPress={() => gitSayfa(aktifSayfa + 1)}
              disabled={aktifSayfa === toplamSayfa - 1}
              style={[
                styles.pageArrowBtn,
                {
                  backgroundColor: colors.cardAlt,
                  borderColor: colors.borderMuted,
                  opacity: aktifSayfa === toplamSayfa - 1 ? 0.35 : 1,
                },
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <AppIcon name="chevron-forward" size={13} color={colors.text} />
            </GlassTouchable>
          </View>
        ) : null}
      </View>

      <View
        style={styles.galleryContainer}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0 && Math.abs(w - galleryWidth) > 1) {
            setGalleryWidth(w);
          }
        }}
      >
        {galleryWidth > 0 ? (
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            nestedScrollEnabled={true}
            directionalLockEnabled={true}
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            decelerationRate="fast"
            snapToInterval={sayfaGenisligi}
            snapToAlignment="center"
            disableIntervalMomentum={true}
            onMomentumScrollEnd={(e) => {
              const p = Math.round(
                e.nativeEvent.contentOffset.x / (sayfaGenisligi || 1),
              );
              if (p !== aktifSayfa) setAktifSayfa(p);
            }}
            style={styles.galleryScroll}
            contentContainerStyle={styles.galleryScrollContent}
          >
            {sayfalar.map((rows, pageIndex) => (
              <View
                key={pageIndex}
                style={[styles.pageGrid, { width: sayfaGenisligi }]}
              >
                {rows.map((row, rIdx) => (
                  <View key={rIdx} style={styles.gridRow}>
                    {row.map((preset, colIdx) => {
                      if (!preset) {
                        return (
                          <View
                            key={`empty-${colIdx}`}
                            style={styles.emptyCell}
                            pointerEvents="none"
                          />
                        );
                      }
                      const aktif = durum[aktifRol] === preset.id;
                      const premiumKilidi = kilitli(preset.id);
                      return (
                        <GlassTouchable
                          key={preset.id}
                          activeOpacity={0.75}
                          onPress={() =>
                            premiumKilidi
                              ? fontGate.showUpsell()
                              : setFontRole(aktifRol, preset.id)
                          }
                          accessibilityRole="radio"
                          accessibilityState={{ checked: aktif }}
                          accessibilityLabel={preset.names[locale]}
                          style={[
                            styles.cell,
                            {
                              backgroundColor: aktif
                                ? colors.accentDim
                                : colors.cardAlt,
                              borderColor: aktif
                                ? colors.accent
                                : colors.borderMuted,
                            },
                          ]}
                        >
                          <View style={styles.sampleWrap}>
                            <Text
                              allowFontScaling={false}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                              adjustsFontSizeToFit
                              minimumFontScale={0.55}
                              style={[
                                styles.cellSample,
                                {
                                  color: aktif
                                    ? colors.accentStrong
                                    : colors.text,
                                  fontFamily: ailesi(preset.id, 700),
                                  fontWeight: agirlik(preset.id),
                                },
                              ]}
                            >
                              {typeof rolMeta.ornek === "function"
                                ? rolMeta.ornek()
                                : rolMeta.ornek}
                            </Text>
                          </View>

                          <View style={styles.nameWrap}>
                            <Text
                              allowFontScaling={false}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                              style={[
                                styles.cellName,
                                {
                                  color: aktif
                                    ? colors.accentStrong
                                    : colors.muted,
                                },
                              ]}
                            >
                              {preset.names[locale]}
                            </Text>
                          </View>

                          {premiumKilidi ? (
                            <View
                              style={[
                                styles.lockMark,
                                { backgroundColor: alpha(colors.accent, 0.9) },
                              ]}
                            >
                              <AppIcon name="diamond" size={7} color={colors.white} />
                            </View>
                          ) : null}

                          {aktif ? (
                            <View
                              style={[
                                styles.check,
                                { backgroundColor: colors.accent },
                              ]}
                            >
                              <AppIcon
                                name="checkmark"
                                size={8}
                                color={colors.white}
                              />
                            </View>
                          ) : null}
                        </GlassTouchable>
                      );
                    })}
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
        ) : null}
      </View>

      {toplamSayfa > 1 ? (
        <View style={styles.dotsRow}>
          {Array.from({ length: toplamSayfa }, (_, idx) => {
            const aktif = idx === aktifSayfa;
            return (
              <GlassTouchable
                key={idx}
                onPress={() => gitSayfa(idx)}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                style={[
                  styles.dot,
                  aktif
                    ? [styles.activeDot, { backgroundColor: colors.accent }]
                    : { backgroundColor: colors.borderMuted },
                ]}
              />
            );
          })}
        </View>
      ) : null}

      {saklananSecimVar ? (
        <Text
          allowFontScaling={false}
          style={[styles.savedNote, { color: colors.muted }]}
        >
          {locale === "tr"
            ? "Seçtiğin premium yazı tipleri saklı; Premium ile geri gelir."
            : locale === "es"
              ? "Las fuentes Premium que elegiste están guardadas y vuelven con Premium."
              : locale === "pt" ? "As fontes Premium que você escolheu estão salvas e voltam com o Premium." : locale === "de" ? "Deine Premium-Schriftauswahl ist gespeichert und kehrt mit Premium zurück." : "Your premium font picks are saved and return with Premium."}
        </Text>
      ) : null}

      {tumRollereUygun ? (
        <GlassTouchable
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
        </GlassTouchable>
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

  // ── 2) Canlı Önizleme ──
  preview: {
    marginHorizontal: 12,
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 84,
    justifyContent: "center",
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  previewTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  previewTagText: {
    fontSize: 9.5,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  previewFontBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  previewFontBadgeText: {
    fontSize: 9,
    fontWeight: "700",
  },
  previewText: { textAlign: "center", marginVertical: 2 },
  previewMeta: {
    marginTop: 6,
    fontSize: 9.5,
    fontWeight: "500",
    textAlign: "center",
  },

  // ── 3) Font Galerisi ──
  galleryHeader: {
    minHeight: 34,
    marginHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  galleryTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  galleryTitle: { fontSize: 12, fontWeight: "700" },
  countBadge: {
    minHeight: 20,
    borderRadius: 10,
    paddingHorizontal: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  countBadgeText: { fontSize: 9, fontWeight: "700" },
  paginationNav: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  pageArrowBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pageCounterText: {
    fontSize: 10,
    fontWeight: "600",
  },
  galleryContainer: {
    marginHorizontal: 12,
    paddingTop: 6,
    minHeight: 195,
  },
  galleryScroll: { margin: -GLASS_PRESS_ROOM },
  galleryScrollContent: {
    alignItems: "flex-start",
    paddingVertical: GLASS_PRESS_ROOM,
  },
  pageGrid: {
    gap: 6,
    paddingHorizontal: GLASS_PRESS_ROOM,
  },
  gridRow: {
    flexDirection: "row",
    gap: 6,
    width: "100%",
  },
  cell: {
    flex: 1,
    height: 58,
    borderWidth: 1,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
    paddingVertical: 2,
    // overflow YOK: cam katmanı hücrenin çocuğu, basılınca hücre sınırında kesilirdi.
    // Yazılar kendi sarmalayıcılarında (sampleWrap / nameWrap) kırpılıyor.
  },
  emptyCell: {
    flex: 1,
    height: 58,
  },
  sampleWrap: {
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 2,
    overflow: "hidden",
  },
  cellSample: {
    fontSize: 14.5,
    letterSpacing: -0.2,
    textAlign: "center",
    includeFontPadding: false,
  },
  nameWrap: {
    height: 13,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 2,
    overflow: "hidden",
  },
  cellName: {
    fontSize: 8.5,
    fontWeight: "600",
    textAlign: "center",
    includeFontPadding: false,
  },
  // Premium kilidi: hücrenin sol üst köşesi (seçim işareti sağ üstte).
  lockMark: {
    position: "absolute",
    top: 3,
    left: 3,
    width: 12,
    height: 12,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  savedNote: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "600",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  check: {
    position: "absolute",
    top: 3,
    right: 3,
    width: 12,
    height: 12,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activeDot: {
    width: 16,
    height: 6,
    borderRadius: 3,
  },
  applyAll: {
    minHeight: 36,
    marginHorizontal: 12,
    marginTop: 2,
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

