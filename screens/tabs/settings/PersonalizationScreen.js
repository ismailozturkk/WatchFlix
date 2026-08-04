// screens/tabs/settings/PersonalizationScreen.js
//
// Ayarlar > Kişiselleştirme. Görsel efekt modu + kar efekti + ikon arka planı
// (görünürlük + opaklık + düzen) + Pet/Dost. Hub'dan ayrı ekrana taşındı.

import React, { useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
} from "react-native";
import SwitchToggle from "@components/SwitchToggle";
import AppIcon from "@components/AppIcon";
import {
  IconPatternPreview,
  SnowPreview,
} from "@components/settings/SettingPreviews";
import PetSettingsSection from "@components/pet/PetSettingsSection";
import FontSettingsSection from "@components/typography/FontSettingsSection";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import {
  useSnowSettings,
  useIconBackgroundSettings,
} from "@context/AppSettingsContext";
import {
  onerilenEffectMode,
  setEffectMode,
  useEffectMode,
} from "@services/effectSettings";
import { i18nText } from "@utils/i18nText";
import { SettingsSubScreen, SettingRow, buildUiColors } from "./settingsUi";

// İkon arka planı saydamlık kaydırıcısı (0.1–1). PanResponder, ek bağımlılık yok.
function OpacitySlider({ value, onChange, colors }) {
  const MIN = 0.1;
  const MAX = 1;
  const [trackW, setTrackW] = useState(0);
  const widthRef = useRef(0);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;

  const emit = (x) => {
    const w = widthRef.current;
    if (!w) return;
    const ratio = Math.min(1, Math.max(0, x / w));
    changeRef.current(MIN + ratio * (MAX - MIN));
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => emit(e.nativeEvent.locationX),
      onPanResponderMove: (e) => emit(e.nativeEvent.locationX),
    }),
  ).current;

  const ratio = Math.min(1, Math.max(0, (value - MIN) / (MAX - MIN)));

  return (
    <View
      {...pan.panHandlers}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        widthRef.current = w;
        setTrackW(w);
      }}
      style={[ps.opacityTrack, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}
      hitSlop={{ top: 12, bottom: 12 }}
    >
      <View style={[ps.opacityFill, { width: ratio * trackW, backgroundColor: colors.accent }]} />
      <View
        style={[
          ps.opacityThumb,
          {
            left: Math.max(0, Math.min(ratio * trackW - 11, Math.max(0, trackW - 22))),
            backgroundColor: colors.accent,
            borderColor: colors.white,
          },
        ]}
      />
    </View>
  );
}

export default function PersonalizationScreen() {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const C = buildUiColors(theme);
  const { showSnow, changeShowSnow } = useSnowSettings();
  const {
    showIconBackground,
    changeShowIconBackground,
    iconBackgroundMode,
    changeIconBackgroundMode,
    iconBackgroundOpacity,
    changeIconBackgroundOpacity,
  } = useIconBackgroundSettings();

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
  const aktifEfekt =
    efektSecenekleri.find((o) => o.value === effectMode) || efektSecenekleri[0];
  const onerilenEtiket = efektSecenekleri.find((o) => o.value === onerilen)?.label;

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
          <View style={ps.iconBgModeHeader}>
            <View style={[ps.iconWrap, { backgroundColor: C.iconPurple }]}>
              <AppIcon name="sparkles-outline" size={16} color={C.purple} />
            </View>
            <View style={{ flex: 1 }}>
              <Text allowFontScaling={false} style={[ps.rowTitle, { color: C.text }]}>
                {i18nText("autoI18n.efektler", "Efektler")}
              </Text>
              <Text allowFontScaling={false} style={[ps.rowSub, { color: C.muted }]}>
                {aktifEfekt.hint}
              </Text>
              {/* Cihaz kararını GÖRÜNÜR kılar: blur'ün neden kapalı açıldığı
                  sorusunun cevabı burada, ayarın yanında durur. */}
              {onerilenEtiket ? (
                <Text allowFontScaling={false} style={[ps.rowSub, { color: C.muted }]}>
                  {i18nText(
                    "autoI18n.efekt_onerilen",
                    `Cihazın için önerilen: ${onerilenEtiket}`,
                    { mod: onerilenEtiket },
                  )}
                </Text>
              ) : null}
            </View>
          </View>
          <View
            style={[ps.segment, { backgroundColor: C.cardAlt, borderTopColor: C.border }]}
          >
            {efektSecenekleri.map((o) => {
              const active = effectMode === o.value;
              return (
                <TouchableOpacity
                  key={o.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[ps.segOpt, active && { backgroundColor: C.accent }]}
                  onPress={() => setEffectMode(o.value)}
                  activeOpacity={0.7}
                >
                  <Text
                    allowFontScaling={false}
                    style={[
                      ps.segText,
                      { color: active ? C.white : C.muted, fontWeight: active ? "700" : "500" },
                    ]}
                  >
                    {o.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      <View style={ps.personalizationGap} />

      <View
        style={[
          ps.card,
          { backgroundColor: C.card, borderColor: C.border },
        ]}
      >
        {/* Kar KAPALIYKEN satırın zemininde önizleme yağar: kullanıcı açmadan
            önce ne alacağını görür. AÇIKKEN önizleme yok — kar zaten tüm
            ekranda yağıyor, ikinci bir Lottie boşuna maliyet. O durumda ikon da
            kar tanesi değil kar küreme makinesi: satırın işlevi artık "aç"
            değil "temizle". */}
        <SettingRow
          colors={C}
          iconBg={C.iconTeal}
          iconColor={C.teal}
          iconFamily={showSnow ? "MaterialCommunityIcons" : "Ionicons"}
          iconName={showSnow ? "bulldozer" : "snow-outline"}
          title={t.snow}
          subtitle={t.snowSubtitle}
          background={showSnow ? null : <SnowPreview />}
          right={
            <SwitchToggle value={showSnow} onValueChange={changeShowSnow} size={36} />
          }
        />
        {/* Desen önizlemesi hem açık hem kapalıyken durur: statik ve ucuz,
            ayrıca ayar açıkken de "şu an bu desen kullanılıyor" bilgisini
            veriyor. Sabit opaklık kullanılıyor — buradaki iş deseni
            tanıtmak; opaklığın kendisinin ayarı aşağıdaki kaydırıcıda. */}
        <SettingRow
          colors={C}
          iconBg={C.iconBlue}
          iconColor={C.blue}
          iconName={showIconBackground ? "image-outline" : "image-sharp"}
          title={t.iconBackground}
          subtitle={t.iconBackgroundSubtitle}
          last={!showIconBackground}
          background={<IconPatternPreview opacity={0.35} />}
          right={
            <SwitchToggle
              value={showIconBackground}
              onValueChange={changeShowIconBackground}
              size={36}
            />
          }
        />
        {showIconBackground && (
          <>
            <View style={[ps.iconBgOpacity, { borderBottomColor: C.borderMuted }]}>
              <View style={ps.iconBgModeHeader}>
                <View style={[ps.iconWrap, { backgroundColor: C.iconPurple }]}>
                  <AppIcon name="contrast-outline" size={16} color={C.purple} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text allowFontScaling={false} style={[ps.rowTitle, { color: C.text }]}>
                    {t.iconBackgroundOpacity}
                  </Text>
                  <Text allowFontScaling={false} style={[ps.rowSub, { color: C.muted }]}>
                    {t.iconBackgroundOpacitySubtitle}
                  </Text>
                </View>
                <View style={[ps.qualityBadge, { backgroundColor: C.accentDim }]}>
                  <Text
                    allowFontScaling={false}
                    style={[ps.qualityBadgeText, { color: C.accentStrong }]}
                  >
                    {Math.round((iconBackgroundOpacity ?? 1) * 100)}%
                  </Text>
                </View>
              </View>
              <View style={ps.iconBgSliderWrap}>
                <OpacitySlider
                  value={iconBackgroundOpacity ?? 1}
                  onChange={changeIconBackgroundOpacity}
                  colors={C}
                />
              </View>
            </View>

            <View style={ps.iconBgMode}>
              <View style={ps.iconBgModeHeader}>
                <View style={[ps.iconWrap, { backgroundColor: C.iconBlue }]}>
                  <AppIcon family="MaterialCommunityIcons" name="view-grid-outline" size={16} color={C.blue} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text allowFontScaling={false} style={[ps.rowTitle, { color: C.text }]}>
                    {t.iconBackgroundLayout}
                  </Text>
                  <Text allowFontScaling={false} style={[ps.rowSub, { color: C.muted }]}>
                    {iconBackgroundMode === "random"
                      ? t.iconBackgroundRandomHint
                      : t.iconBackgroundSharedHint}
                  </Text>
                </View>
              </View>
              <View
                style={[
                  ps.segment,
                  { backgroundColor: C.cardAlt, borderTopColor: C.border },
                ]}
              >
                {[
                  { value: "shared", label: t.iconBackgroundShared },
                  { value: "random", label: t.iconBackgroundRandom },
                ].map((o) => {
                  const active = iconBackgroundMode === o.value;
                  return (
                    <TouchableOpacity
                      key={o.value}
                      style={[ps.segOpt, active && { backgroundColor: C.accent }]}
                      onPress={() => changeIconBackgroundMode(o.value)}
                      activeOpacity={0.7}
                    >
                      <Text
                        allowFontScaling={false}
                        style={[
                          ps.segText,
                          { color: active ? C.white : C.muted, fontWeight: active ? "700" : "500" },
                        ]}
                      >
                        {o.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </>
        )}
      </View>

      <View style={ps.personalizationGap} />
      <PetSettingsSection colors={C} showLabel={false} />
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
  effectBlock: { paddingTop: 13 },
  iconBgMode: { paddingTop: 13 },
  iconBgModeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  iconBgOpacity: {
    paddingTop: 13,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  iconBgSliderWrap: { paddingHorizontal: 16 },
  qualityBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  qualityBadgeText: { fontSize: 11, fontWeight: "700" },
  opacityTrack: {
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    overflow: "hidden",
    justifyContent: "center",
  },
  opacityFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    opacity: 0.35,
  },
  opacityThumb: {
    position: "absolute",
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 3,
    top: 1,
  },
  segment: {
    flexDirection: "row",
    borderTopWidth: 1,
    padding: 4,
    gap: 2,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  segOpt: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 10,
  },
  segText: { fontSize: 11, textAlign: "center" },
});
