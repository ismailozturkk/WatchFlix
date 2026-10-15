// screens/tabs/settings/PersonalizationScreen.js
//
// Ayarlar > Kişiselleştirme. Görsel efekt modu + kar efekti + ambiyans arka
// planı + ikon arka planı (görünürlük + opaklık + düzen) + Pet/Dost. Hub'dan
// ayrı ekrana taşındı.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import {
  Animated,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
} from "react-native";
import SwitchToggle from "@components/SwitchToggle";
import AppIcon from "@components/AppIcon";
import {
  AmbientPreview,
  IconPatternPreview,
  SnowPreview,
} from "@components/settings/SettingPreviews";
import PetSettingsSection from "@components/pet/PetSettingsSection";
import FontSettingsSection from "@components/typography/FontSettingsSection";
import AppIconSection from "@components/settings/AppIconSection";
import PremiumPill from "@components/premium/PremiumPill";
import { usePremiumGate } from "@hooks/usePremiumGate";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import {
  useSnowSettings,
  useIconBackgroundSettings,
  useAmbientBackgroundSettings,
  useDecorScopeSettings,
} from "@context/AppSettingsContext";
import {
  onerilenEffectMode,
  setEffectMode,
  useEffectMode,
} from "@services/effectSettings";
import * as Haptics from "@services/hapticsService";
import { i18nText } from "@utils/i18nText";
import { clamp } from "@utils/colorUtils";
import { isDecorCustomized } from "@utils/decorScopes";
import { alpha } from "@theme/colors";
import {
  SettingsSubScreen,
  SettingRow,
  Chevron,
  buildUiColors,
} from "./settingsUi";

// İkon arka planı saydamlık kaydırıcısı (0.1–1). Delta-based native 120 FPS PanResponder.
function OpacitySlider({ value, onChange, colors }) {
  const MIN = 0.1;
  const MAX = 1;
  const [trackW, setTrackW] = useState(0);
  const widthRef = useRef(0);
  const dragStartXRef = useRef(0);
  const isDraggingRef = useRef(false);
  const latestValRef = useRef(value);
  latestValRef.current = value;
  const rafIdRef = useRef(null);

  const changeRef = useRef(onChange);
  changeRef.current = onChange;

  const thumbAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const lastBoundaryHitRef = useRef(null);

  // Prop değeri değiştiğinde (sürükleme yapılmıyorsa) animasyonlu pozisyonu güncelle
  useEffect(() => {
    if (!isDraggingRef.current && trackW > 0) {
      const r = clamp((value - MIN) / (MAX - MIN), 0, 1);
      const maxTravel = Math.max(0, trackW - 22);
      thumbAnim.setValue(r * maxTravel);
    }
  }, [value, trackW, thumbAnim]);

  const updatePosition = useCallback(
    (x, isImmediateCommit = false) => {
      const w = widthRef.current;
      if (!w) return;
      const maxTravel = Math.max(0, w - 22);
      const clampedRatio = clamp((x - 11) / Math.max(1, maxTravel), 0, 1);
      const targetX = clampedRatio * maxTravel;

      // 1) Anlık 120 FPS native görsel güncelleme (0ms gecikme)
      thumbAnim.setValue(targetX);

      // 2) Sınır haptikleri
      if (clampedRatio === 0 && lastBoundaryHitRef.current !== "min") {
        lastBoundaryHitRef.current = "min";
        Haptics.selectionAsync();
      } else if (clampedRatio === 1 && lastBoundaryHitRef.current !== "max") {
        lastBoundaryHitRef.current = "max";
        Haptics.selectionAsync();
      } else if (clampedRatio > 0.02 && clampedRatio < 0.98) {
        lastBoundaryHitRef.current = null;
      }

      const val = MIN + clampedRatio * (MAX - MIN);
      latestValRef.current = val;

      if (isImmediateCommit) {
        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        changeRef.current?.(val);
      } else if (!rafIdRef.current) {
        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = null;
          changeRef.current?.(latestValRef.current);
        });
      }
    },
    [thumbAnim],
  );

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        isDraggingRef.current = true;
        dragStartXRef.current = e.nativeEvent.locationX;
        updatePosition(e.nativeEvent.locationX, true);
        Animated.spring(scaleAnim, {
          toValue: 1.25,
          useNativeDriver: true,
          friction: 7,
          tension: 250,
        }).start();
      },
      onPanResponderMove: (_, g) => {
        updatePosition(dragStartXRef.current + g.dx, false);
      },
      onPanResponderRelease: (_, g) => {
        isDraggingRef.current = false;
        updatePosition(dragStartXRef.current + g.dx, true);
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          friction: 7,
          tension: 250,
        }).start();
      },
      onPanResponderTerminate: () => {
        isDraggingRef.current = false;
        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          friction: 7,
          tension: 250,
        }).start();
      },
    }),
  ).current;

  const ratio = clamp((value - MIN) / (MAX - MIN), 0, 1);

  return (
    <View
      {...pan.panHandlers}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        widthRef.current = w;
        setTrackW(w);
      }}
      style={ps.opacitySliderContainer}
      hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }}
    >
      <View
        pointerEvents="none"
        style={[
          ps.opacityTrackBg,
          { backgroundColor: colors.cardAlt, borderColor: colors.border },
        ]}
      >
        <View
          style={[
            ps.opacityFill,
            { width: ratio * trackW, backgroundColor: colors.accent },
          ]}
        />
      </View>
      <Animated.View
        pointerEvents="none"
        style={[
          ps.opacityThumb,
          {
            backgroundColor: colors.accent,
            borderColor: colors.white,
            transform: [
              { translateX: thumbAnim },
              { scale: scaleAnim },
            ],
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
  const { showSnow, snowAllowed, changeShowSnow } = useSnowSettings();
  const { showAmbientBackground, changeShowAmbientBackground } =
    useAmbientBackgroundSettings();
  const { decorHidden } = useDecorScopeSettings();
  const navigation = useNavigation();
  const {
    showIconBackground,
    iconBackgroundAllowed,
    changeShowIconBackground,
    iconBackgroundMode,
    changeIconBackgroundMode,
    iconBackgroundOpacity,
    changeIconBackgroundOpacity,
  } = useIconBackgroundSettings();

  // Kar ve ikon arka planı Premium'da. Free kullanıcıda anahtar KİLİTLİ ve kapalı
  // çizilir (bkz. AppSettingsContext: kayıtlı tercih silinmez, yalnız çizilen değer
  // kapanır); dokununca anahtar oynamaz, yükseltme sayfası gelir (bkz.
  // SwitchToggle `locked`). Satırın kendisine basmak da aynı yere götürür.
  const snowGate = usePremiumGate("snow_effect");
  const iconBackgroundGate = usePremiumGate("icon_background");
  const openSnowUpsell = useCallback(() => snowGate.showUpsell(), [snowGate]);
  const openIconBackgroundUpsell = useCallback(
    () => iconBackgroundGate.showUpsell(),
    [iconBackgroundGate],
  );

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
                <TouchableOpacity
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
                </TouchableOpacity>
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
          onPress={snowAllowed ? undefined : openSnowUpsell}
          background={showSnow ? null : <SnowPreview />}
          right={
            <View style={ps.rowRightGroup}>
              {snowAllowed ? null : <PremiumPill />}
              <SwitchToggle
                value={showSnow}
                onValueChange={changeShowSnow}
                locked={!snowAllowed}
                onLockedPress={openSnowUpsell}
                size={36}
              />
            </View>
          }
        />
        {/* Ambiyans Premium'a bağlı değil: kilit/pill yok, anahtar herkes için
            açık. Kar gibi KAPALIYKEN satırın zemininde (aynı renklerle) süzülen
            lekeler görünür; AÇIKKEN ekranın tamamı zaten ambiyans olduğundan
            önizleme çizilmez. Bulanıklık gerçek blur değil, yumuşak kenarlı
            degrade — bu yüzden Efektler "Kapalı" modunda da çalışır, yalnız
            leke sayısı azalır ve hareket yavaşlar. */}
        <SettingRow
          colors={C}
          iconBg={C.iconPurple}
          iconColor={C.purple}
          iconName={showAmbientBackground ? "prism" : "prism-outline"}
          title={t.ambientBackground}
          subtitle={t.ambientBackgroundSubtitle}
          background={showAmbientBackground ? null : <AmbientPreview />}
          right={
            <SwitchToggle
              value={showAmbientBackground}
              onValueChange={changeShowAmbientBackground}
              size={36}
            />
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
          onPress={iconBackgroundAllowed ? undefined : openIconBackgroundUpsell}
          last={!showIconBackground}
          background={<IconPatternPreview opacity={0.35} />}
          right={
            <View style={ps.rowRightGroup}>
              {iconBackgroundAllowed ? null : <PremiumPill />}
              <SwitchToggle
                value={showIconBackground}
                onValueChange={changeShowIconBackground}
                locked={!iconBackgroundAllowed}
                onLockedPress={openIconBackgroundUpsell}
                size={36}
              />
            </View>
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
  opacitySliderContainer: {
    height: 32,
    justifyContent: "center",
  },
  opacityTrackBg: {
    height: 24,
    borderRadius: 12,
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
    top: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
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
