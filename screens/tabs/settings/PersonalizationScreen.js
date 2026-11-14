// screens/tabs/settings/PersonalizationScreen.js
//
// Ayarlar > Kişiselleştirme. Görsel efekt modu, puanlama sistemi (10/5 yıldız) + atmosfer giriş satırı.
// Atmosfer, ambiyans arka planı ve ikon arka planı ayarları (9 Kas'tan beri
// hepsi) AtmosphereScreen'de: tek telefon önizlemesinde katmanlı görünürler.
// Hub'dan ayrı ekrana taşındı.

import React from "react";
import { useNavigation } from "@react-navigation/native";
import { View, Text, StyleSheet } from "react-native";
import AppIcon from "@components/AppIcon";
import { SnowPreview } from "@components/settings/SettingPreviews";
import FontSettingsSection from "@components/typography/FontSettingsSection";
import AppIconSection from "@components/settings/AppIconSection";
import RatingScaleSection from "@components/settings/RatingScaleSection";
import PremiumPill from "@components/premium/PremiumPill";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import {
  useSnowSettings,
  useIconBackgroundSettings,
  useAmbientBackgroundSettings,
  useOngoingTvShowsSettings,
} from "@context/AppSettingsContext";
import { useSectionVisibilityMap } from "@hooks/useSectionVisibility";
import {
  onerilenEffectMode,
  setEffectMode,
  useEffectMode,
} from "@services/effectSettings";
import { i18nText } from "@utils/i18nText";
import BetaBadge from "@components/common/BetaBadge";
import { isBetaFeature } from "@utils/betaFeatures";
import useWeatherSettings from "@hooks/useWeatherSettings";
import { WEATHER_ICONS, weatherChoiceLabel } from "@components/settings/AtmosphereControls";
import { countHiddenSections } from "@utils/sectionVisibility";
import { alpha } from "@theme/colors";
import {
  SettingsSubScreen,
  SettingRow,
  Chevron,
  buildUiColors,
} from "./settingsUi";
import { fillCopy, getSectionVisibilityCopy } from "./sectionVisibilityCopy";
import GlassTouchable from "../../../components/common/GlassTouchable";

export default function PersonalizationScreen() {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const C = buildUiColors(theme);
  const { showSnow, snowAllowed } = useSnowSettings();
  const { choice: weatherChoice, effect: weatherEffect } = useWeatherSettings();
  const { showAmbientBackground } = useAmbientBackgroundSettings();
  const { showIconBackground } = useIconBackgroundSettings();
  // Ekran bölümleri: gizlenen bölüm sayısı satırdaki rozeti besler. "Devam Edenler"in
  // kendi ayarı (Dil ve içerik) de aynı listeye girdiği için o da sayılır.
  const sectionCopy = getSectionVisibilityCopy(language);
  const sectionsHidden = useSectionVisibilityMap();
  const { showOngoingTvShows } = useOngoingTvShowsSettings();
  const hiddenSectionCount =
    countHiddenSections(sectionsHidden) + (showOngoingTvShows === false ? 1 : 0);
  const navigation = useNavigation();
  // Atmosfer satırının alt yazısı için: açık arka plan katmanı sayısı.
  const layerCount = (showAmbientBackground ? 1 : 0) + (showIconBackground ? 1 : 0);

  // Görsel efekt modu. Cihaz sınıfı yalnız varsayılanı seçer; burada kullanıcı
  // kendi dengesini kurar (bkz. utils/deviceTier.js, services/effectSettings.js).
  const effectMode = useEffectMode();
  const onerilen = onerilenEffectMode();
  const efektSecenekleri = [
    {
      value: "full",
      label: i18nText("autoI18n.efekt_tam", "Tam"),
      hint: i18nText(
        "autoI18n.efekt_tam_ipucu",
        "Kısıtsız: bulanıklık açık, desen tam yoğunlukta, animasyonlar tam hızda.",
      ),
    },
    {
      value: "balanced",
      label: i18nText("autoI18n.efekt_orta", "Orta"),
      hint: i18nText(
        "autoI18n.efekt_orta_ipucu",
        "Dengeli: bulanıklık açık kalır, desen ve animasyon hafifletilir.",
      ),
    },
    {
      value: "off",
      label: i18nText("autoI18n.efekt_kapali", "Kapalı"),
      hint: i18nText(
        "autoI18n.efekt_kapali_ipucu",
        "Performans odaklı: bulanıklık kapalı, desen seyrek, animasyonlar en düşük hızda.",
      ),
    },
  ];

  return (
    <SettingsSubScreen title={t.personalization}>
      <View
        style={[
          ps.card,
          { backgroundColor: C.card, borderColor: C.border, marginTop: 8 },
        ]}
      >
        <FontSettingsSection colors={C} language={language} />
      </View>

      <View style={ps.personalizationGap} />

      <View
        style={[
          ps.card,
          { backgroundColor: C.card, borderColor: C.border },
        ]}
      >
        <View style={ps.effectBlock}>
          <View style={ps.effectHeader}>
            <View style={[ps.iconWrap, { backgroundColor: C.iconPurple }]}>
              <AppIcon name="sparkles-outline" size={16} color={C.purple} />
            </View>
            <View style={{ flex: 1 }}>
              <Text allowFontScaling={false} style={[ps.rowTitle, { color: C.text }]}>
                {i18nText("autoI18n.efektler", "Efektler")}
              </Text>
              <Text allowFontScaling={false} style={[ps.rowSub, { color: C.muted }]}>
                {i18nText(
                  "autoI18n.efekt_alt_baslik",
                  "Bulanıklık, desen ve animasyon yoğunluğu",
                )}
              </Text>
            </View>
          </View>

          <View style={ps.effectOptionsWrap}>
            {efektSecenekleri.map((o) => {
              const active = effectMode === o.value;
              const isOnerilen = onerilen === o.value;
              const iconName =
                o.value === "full"
                  ? "sparkles"
                  : o.value === "balanced"
                    ? "speedometer-outline"
                    : "flash-off-outline";
              const iconColor =
                o.value === "full"
                  ? C.purple
                  : o.value === "balanced"
                    ? C.blue
                    : C.amber;
              const iconBg =
                o.value === "full"
                  ? C.iconPurple
                  : o.value === "balanced"
                    ? C.iconBlue
                    : C.iconAmber;

              // Yatay 3'lü karo: simge + ad; "Önerilen" adın altında küçük hap, seçili
              // karoda sağ üstte onay. Uzun açıklama yalnız SEÇİLİ mod için altta.
              return (
                <GlassTouchable
                  key={o.value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={`${o.label}. ${o.hint}`}
                  style={[
                    ps.effectTile,
                    {
                      backgroundColor: active
                        ? alpha(C.accent, 0.08)
                        : C.cardAlt,
                      borderColor: active ? C.accent : C.borderMuted,
                    },
                  ]}
                  onPress={() => setEffectMode(o.value)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[ps.effectOptIconWrap, { backgroundColor: iconBg }]}
                  >
                    <AppIcon name={iconName} size={15} color={iconColor} />
                  </View>
                  <Text
                    allowFontScaling={false}
                    numberOfLines={1}
                    style={[
                      ps.effectOptTitle,
                      { color: active ? C.accentStrong : C.text },
                    ]}
                  >
                    {o.label}
                  </Text>

                  {isOnerilen ? (
                    <View
                      style={[
                        ps.recBadge,
                        { backgroundColor: C.accentDim },
                      ]}
                    >
                      <Text
                        allowFontScaling={false}
                        numberOfLines={1}
                        style={[ps.recBadgeText, { color: C.accentStrong }]}
                      >
                        {i18nText("autoI18n.efekt_onerilen_rozet", "Önerilen")}
                      </Text>
                    </View>
                  ) : null}

                  {active ? (
                    <View style={[ps.tileCheck, { backgroundColor: C.accent }]}>
                      <AppIcon name="checkmark" size={9} color={C.white} />
                    </View>
                  ) : null}
                </GlassTouchable>
              );
            })}
          </View>

          {/* Seçili modun ne yaptığı — tek satırlık açıklama (eski kartlardaki ipucu). */}
          {efektSecenekleri.some((o) => o.value === effectMode) ? (
            <Text
              allowFontScaling={false}
              numberOfLines={2}
              style={[ps.effectOptHint, { color: C.muted }]}
            >
              {efektSecenekleri.find((o) => o.value === effectMode).hint}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={ps.personalizationGap} />

      {/* Puanlama sistemi: 10 yıldız (yarım puan) | 5 yıldız — yalnız görünüm, puanlar 0-10 kalır. */}
      <RatingScaleSection colors={C} language={language} />

      <View style={ps.personalizationGap} />

      {/* Uygulama simgesi: destek yoksa (modül yok / cihaz desteklemiyor) üretimde
          hiçbir şey çizmez ve boşluk da bırakmaz; geliştirme build'inde nedenini
          söyleyen soluk bir not çizer. */}
      <AppIconSection colors={C} />

      <View
        style={[
          ps.card,
          { backgroundColor: C.card, borderColor: C.border },
        ]}
      >
        {/* Atmosfer kendi ekranında (Ayarlar > Atmosfer): telefon önizlemesi +
            efekt, yoğunluk, türe göre + ambiyans ve ikon arka planı katmanları.
            Burada yalnız giriş satırı; alt yazı açık katmanları da sayar. KAPALIYKEN
            satırın zemininde seçili efektin önizlemesi akar; AÇIKKEN efekt
            zaten tüm ekranda, ikinci katman boşuna maliyet. */}
        <SettingRow
          colors={C}
          iconBg={C.iconTeal}
          iconColor={C.teal}
          iconFamily={WEATHER_ICONS[weatherChoice].family}
          iconName={WEATHER_ICONS[weatherChoice].name}
          title={t.snow}
          subtitle={[
            showSnow
              ? weatherChoiceLabel(weatherChoice, weatherEffect)
              : `${i18nText("autoI18n.efekt_kapali", "Kapalı")} · ${weatherChoiceLabel(weatherChoice, weatherEffect)}`,
            layerCount > 0
              ? i18nText("autoI18n.atmosfer_katman_sayisi", "+{{n}} arka plan katmanı", {
                  n: layerCount,
                }).replace("{{n}}", String(layerCount))
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
          onPress={() => navigation.navigate("AtmosphereScreen")}
          last
          background={showSnow ? null : <SnowPreview />}
          right={
            <View style={ps.rowRightGroup}>
              {isBetaFeature("atmosphere") ? <BetaBadge featureId="atmosphere" /> : null}
              {snowAllowed ? null : <PremiumPill />}
              <Chevron color={C.muted} />
            </View>
          }
        />
      </View>

      {/* "Ekran bazında ayarla" (DecorScopesScreen) Atmosfer ekranına taşındı:
          ayarladığı katmanların yanında duruyor (BackgroundLayerCards → DecorScopesCard). */}

      {/* Film, Dizi, Hub ve Profil'de hangi BÖLÜMLERİN görüneceği ayrı sayfada
          (bkz. SectionVisibilityScreen). */}
      <View style={ps.personalizationGap} />
      <View
        style={[
          ps.card,
          { backgroundColor: C.card, borderColor: C.border },
        ]}
      >
        <SettingRow
          colors={C}
          iconBg={C.iconPurple}
          iconColor={C.purple}
          iconName="albums-outline"
          title={sectionCopy.ui.title}
          subtitle={sectionCopy.ui.rowSub}
          onPress={() => navigation.navigate("SectionVisibilityScreen")}
          last
          right={
            <View style={ps.rowRightGroup}>
              <View style={[ps.qualityBadge, { backgroundColor: C.accentDim }]}>
                <Text
                  allowFontScaling={false}
                  style={[ps.qualityBadgeText, { color: C.accentStrong }]}
                >
                  {hiddenSectionCount > 0
                    ? fillCopy(sectionCopy.ui.badgeHidden, { n: hiddenSectionCount })
                    : sectionCopy.ui.badgeAll}
                </Text>
              </View>
              <Chevron color={C.muted} />
            </View>
          }
        />
      </View>
    </SettingsSubScreen>
  );
}

const ps = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  rowTitle: { fontSize: 14, fontWeight: "500" },
  rowSub: { fontSize: 11, marginTop: 2 },
  personalizationGap: { height: 10 },
  rowRightGroup: { flexDirection: "row", alignItems: "center", gap: 8 },
  effectBlock: {
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  effectHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  // Yatay 3'lü karo sırası (eski: alt alta üç uzun kart)
  effectOptionsWrap: {
    flexDirection: "row",
    gap: 8,
  },
  effectTile: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  effectOptIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  effectOptTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  // Karonun İÇİNDE (cam kabuk kenardan taşanı kırpabilir); sıra alignItems:stretch
  // olduğu için rozetli karo diğerlerini de aynı boya çeker.
  recBadge: {
    maxWidth: "100%",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  recBadgeText: {
    fontSize: 8.5,
    fontWeight: "800",
  },
  tileCheck: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 15,
    height: 15,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  effectOptHint: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 8,
    textAlign: "center",
  },
  qualityBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  qualityBadgeText: { fontSize: 11, fontWeight: "700" },
});
