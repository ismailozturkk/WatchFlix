// screens/tabs/settings/PersonalizationScreen.js
//
// Ayarlar > Kişiselleştirme. Görsel efekt modu + atmosfer giriş satırı.
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
import PremiumPill from "@components/premium/PremiumPill";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import {
  useSnowSettings,
  useIconBackgroundSettings,
  useAmbientBackgroundSettings,
  useDecorScopeSettings,
  useOngoingTvShowsSettings,
} from "@context/AppSettingsContext";
import { useSectionVisibilityMap } from "@hooks/useSectionVisibility";
import {
  onerilenEffectMode,
  setEffectMode,
  useEffectMode,
} from "@services/effectSettings";
import { i18nText } from "@utils/i18nText";
import useWeatherSettings from "@hooks/useWeatherSettings";
import { WEATHER_ICONS, weatherChoiceLabel } from "@components/settings/AtmosphereControls";
import { isDecorCustomized } from "@utils/decorScopes";
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
  const { decorHidden } = useDecorScopeSettings();
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

              return (
                <GlassTouchable
                  key={o.value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  style={[
                    ps.effectOptionCard,
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

                  <View style={ps.effectOptContent}>
                    <View style={ps.effectOptTitleRow}>
                      <Text
                        allowFontScaling={false}
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
                            style={[
                              ps.recBadgeText,
                              { color: C.accentStrong },
                            ]}
                          >
                            {i18nText(
                              "autoI18n.efekt_onerilen_rozet",
                              "Önerilen",
                            )}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text
                      allowFontScaling={false}
                      style={[ps.effectOptHint, { color: C.muted }]}
                    >
                      {o.hint}
                    </Text>
                  </View>

                  <View
                    style={[
                      ps.radioOuter,
                      {
                        borderColor: active ? C.accent : C.borderMuted,
                        backgroundColor: active ? C.accent : "transparent",
                      },
                    ]}
                  >
                    {active ? (
                      <AppIcon name="checkmark" size={10} color={C.white} />
                    ) : null}
                  </View>
                </GlassTouchable>
              );
            })}
          </View>
        </View>
      </View>

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
              {snowAllowed ? null : <PremiumPill />}
              <Chevron color={C.muted} />
            </View>
          }
        />
      </View>

      {/* Efektlerin HANGİ ekran gruplarında görüneceği ayrı sayfada (bkz.
          DecorScopesScreen). Üstteki anahtarlar genel kapı; bu onun üstünde süzgeç. */}
      <View style={ps.personalizationGap} />
      <View
        style={[
          ps.card,
          { backgroundColor: C.card, borderColor: C.border },
        ]}
      >
        <SettingRow
          colors={C}
          iconBg={C.iconBlue}
          iconColor={C.blue}
          iconName="layers-outline"
          title={i18nText("autoI18n.dekor_kapsam_satir_baslik", "Ekran bazında ayarla")}
          subtitle={i18nText(
            "autoI18n.dekor_kapsam_satir_alt",
            "Kar, ikon ve ambiyans hangi ekranlarda görünsün",
          )}
          onPress={() => navigation.navigate("DecorScopesScreen")}
          last
          right={
            <View style={ps.rowRightGroup}>
              <View style={[ps.qualityBadge, { backgroundColor: C.accentDim }]}>
                <Text
                  allowFontScaling={false}
                  style={[ps.qualityBadgeText, { color: C.accentStrong }]}
                >
                  {isDecorCustomized(decorHidden)
                    ? i18nText("autoI18n.dekor_kapsam_ozel", "Özel")
                    : i18nText("autoI18n.dekor_kapsam_her_yerde", "Her yerde")}
                </Text>
              </View>
              <Chevron color={C.muted} />
            </View>
          }
        />
      </View>

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
  effectOptionsWrap: {
    gap: 8,
  },
  effectOptionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  effectOptIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  effectOptContent: {
    flex: 1,
  },
  effectOptTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  effectOptTitle: {
    fontSize: 13.5,
    fontWeight: "700",
  },
  recBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  recBadgeText: {
    fontSize: 9,
    fontWeight: "700",
  },
  effectOptHint: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2.5,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  qualityBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  qualityBadgeText: { fontSize: 11, fontWeight: "700" },
});
