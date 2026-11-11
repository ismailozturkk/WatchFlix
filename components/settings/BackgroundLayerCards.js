// components/settings/BackgroundLayerCards.js
//
// Ayarlar > Atmosfer'deki arka plan katmanı kartları: Ambiyans arka planı
// (leke yoğunluğu + saydamlık) ve İkon arka planı (saydamlık + yoğunluk +
// düzen) + "Arka planı yeniden oluştur". 9 Kas'ta Kişiselleştirme'den buraya
// taşındı: üç katman (ambiyans → ikon deseni → atmosfer) aynı telefon
// önizlemesinde birlikte görünsün diye.
//
// Ayar anahtarları DEĞİŞMEDİ (showAmbientBackground, ambientDensity,
// ambientOpacity, showIconBackground, iconBackgroundMode/Opacity/Density,
// decorSeed): yalnız ekran yeri değişti. Premium kapısı aynı: Free'de anahtar
// kilitli, karta/anahtara dokununca yükseltme sayfası (ambient_background /
// icon_background).

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, PanResponder, StyleSheet, Text, View } from "react-native";
import AppIcon from "../AppIcon";
import SwitchToggle from "../SwitchToggle";
import PremiumPill from "../premium/PremiumPill";
import GlassBox from "../common/GlassBox";
import GlassTouchable from "../common/GlassTouchable";
import { DensitySegment } from "./AtmosphereControls";
import { usePremiumGate } from "../../hooks/usePremiumGate";
import { useLanguage } from "../../context/LanguageContext";
import { useNavigation } from "@react-navigation/native";
import {
  useAmbientBackgroundSettings,
  useDecorScopeSettings,
  useIconBackgroundSettings,
} from "../../context/AppSettingsContext";
import { isDecorCustomized } from "../../utils/decorScopes";
import { useEffectPreset } from "../../services/effectSettings";
import { reshuffleDecorSeed } from "../../services/decorSeed";
import * as Haptics from "../../services/hapticsService";
import { i18nText, percentText } from "../../utils/i18nText";
import {
  AMBIENT_OPACITY_MIN,
  resolveAmbientBlobCount,
  resolveIconGrid,
} from "../../utils/decorLayout";
import { clamp } from "../../utils/colorUtils";
import { GLASS_PRESS_ROOM } from "../../utils/liquidGlass";

const THUMB = 22;

// Saydamlık kaydırıcısı (min–1). Sürüklerken başparmak native Animated ile
// anında, değer kare başına bir kez (rAF) yazılır.
export function OpacitySlider({ value, onChange, colors, min = 0.1 }) {
  const MIN = min;
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

  useEffect(() => {
    if (!isDraggingRef.current && trackW > 0) {
      const r = clamp((value - MIN) / (MAX - MIN), 0, 1);
      thumbAnim.setValue(r * Math.max(0, trackW - THUMB));
    }
  }, [value, trackW, thumbAnim, MIN]);

  const updatePosition = useCallback(
    (x, commit = false) => {
      const w = widthRef.current;
      if (!w) return;
      const maxTravel = Math.max(0, w - THUMB);
      const ratio = clamp((x - THUMB / 2) / Math.max(1, maxTravel), 0, 1);
      thumbAnim.setValue(ratio * maxTravel);

      if (ratio === 0 && lastBoundaryHitRef.current !== "min") {
        lastBoundaryHitRef.current = "min";
        Haptics.selectionAsync();
      } else if (ratio === 1 && lastBoundaryHitRef.current !== "max") {
        lastBoundaryHitRef.current = "max";
        Haptics.selectionAsync();
      } else if (ratio > 0.02 && ratio < 0.98) {
        lastBoundaryHitRef.current = null;
      }

      const val = MIN + ratio * (MAX - MIN);
      latestValRef.current = val;
      if (commit) {
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
    [thumbAnim, MIN],
  );

  const springScale = (toValue) =>
    Animated.spring(scaleAnim, { toValue, useNativeDriver: true, friction: 7, tension: 250 }).start();

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Dikey kaydırma (ScrollView) sürüklemeyi çalmasın.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        isDraggingRef.current = true;
        dragStartXRef.current = e.nativeEvent.locationX;
        updatePosition(e.nativeEvent.locationX, true);
        springScale(1.25);
      },
      onPanResponderMove: (_, g) => updatePosition(dragStartXRef.current + g.dx, false),
      onPanResponderRelease: (_, g) => {
        isDraggingRef.current = false;
        updatePosition(dragStartXRef.current + g.dx, true);
        springScale(1);
      },
      onPanResponderTerminate: () => {
        isDraggingRef.current = false;
        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        springScale(1);
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
      style={s.sliderContainer}
      hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }}
    >
      <View
        pointerEvents="none"
        style={[s.sliderTrack, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}
      >
        <View style={[s.sliderFill, { width: ratio * trackW, backgroundColor: colors.accent }]} />
      </View>
      <Animated.View
        pointerEvents="none"
        style={[
          s.sliderThumb,
          {
            backgroundColor: colors.accent,
            borderColor: colors.white,
            transform: [{ translateX: thumbAnim }, { scale: scaleAnim }],
          },
        ]}
      />
    </View>
  );
}

// Kart başlığı: simge + başlık/alt yazı + sağda (Premium hap +) anahtar.
function LayerHeader({ colors, icon, iconBg, iconColor, title, subtitle, right }) {
  return (
    <View style={s.header}>
      <View style={[s.iconWrap, { backgroundColor: iconBg }]}>
        <AppIcon family={icon.family} name={icon.name} size={16} color={iconColor} />
      </View>
      <View style={s.flex}>
        <Text allowFontScaling={false} style={[s.title, { color: colors.text }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text allowFontScaling={false} style={[s.sub, { color: colors.muted }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

// Kart içi alt ayar: küçük başlık + (rozet) + kontrol.
function SubControl({ colors, title, hint, badge, children }) {
  return (
    <View style={[s.sub_control, { borderTopColor: colors.borderMuted }]}>
      <View style={s.subHead}>
        <View style={s.flex}>
          <Text allowFontScaling={false} style={[s.subTitle, { color: colors.text }]}>
            {title}
          </Text>
          {hint ? (
            <Text allowFontScaling={false} style={[s.sub, { color: colors.muted }]}>
              {hint}
            </Text>
          ) : null}
        </View>
        {badge != null ? (
          <View style={[s.badge, { backgroundColor: colors.accentDim }]}>
            <Text allowFontScaling={false} style={[s.badgeText, { color: colors.accentStrong }]}>
              {badge}
            </Text>
          </View>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function LockableSwitch({ value, onChange, allowed, onLocked }) {
  return (
    <View style={s.right}>
      {allowed ? null : <PremiumPill />}
      <SwitchToggle
        value={value}
        onValueChange={onChange}
        locked={!allowed}
        onLockedPress={onLocked}
        size={36}
      />
    </View>
  );
}

function cardStyle(colors) {
  return [s.card, { backgroundColor: colors.card, borderColor: colors.border }];
}

// ── Ambiyans arka planı ────────────────────────────────────────────────────
export function AmbientLayerCard({ colors }) {
  const { t, language } = useLanguage();
  const preset = useEffectPreset();
  const {
    showAmbientBackground,
    ambientAllowed,
    changeShowAmbientBackground,
    ambientDensity,
    changeAmbientDensity,
    ambientOpacity,
    changeAmbientOpacity,
  } = useAmbientBackgroundSettings();
  const gate = usePremiumGate("ambient_background");
  const openUpsell = useCallback(() => gate.showUpsell(), [gate]);
  const blobCount = resolveAmbientBlobCount(ambientDensity, preset);

  return (
    <GlassBox role="card" style={cardStyle(colors)}>
      <GlassTouchable
        glass={false}
        activeOpacity={ambientAllowed ? 1 : 0.7}
        disabled={ambientAllowed}
        onPress={openUpsell}
      >
        <LayerHeader
          colors={colors}
          icon={{ name: showAmbientBackground ? "prism" : "prism-outline" }}
          iconBg={colors.iconPurple}
          iconColor={colors.purple}
          title={t.ambientBackground}
          subtitle={t.ambientBackgroundSubtitle}
          right={
            <LockableSwitch
              value={showAmbientBackground}
              onChange={changeShowAmbientBackground}
              allowed={ambientAllowed}
              onLocked={openUpsell}
            />
          }
        />
      </GlassTouchable>
      {/* Açıkken: leke sayısı (çizim maliyeti; "Otomatik" efekt modunu izler)
          + saydamlık. Önizleme ikisini de anında gösterir. */}
      {showAmbientBackground ? (
        <>
          <SubControl
            colors={colors}
            title={i18nText("autoI18n.ambiyans_yogunluk_baslik", "Ambiyans yoğunluğu")}
            hint={i18nText("autoI18n.ambiyans_yogunluk_alt", "Işık lekesi sayısı · {{n}} leke", {
              n: blobCount,
            }).replace("{{n}}", String(blobCount))}
          >
            <DensitySegment value={ambientDensity} onChange={changeAmbientDensity} colors={colors} />
          </SubControl>
          <SubControl
            colors={colors}
            title={i18nText("autoI18n.ambiyans_saydamlik_baslik", "Ambiyans saydamlığı")}
            hint={i18nText("autoI18n.ambiyans_saydamlik_alt", "Renklerin ne kadar belirgin olacağı")}
            badge={percentText(Math.round((ambientOpacity ?? 1) * 100), language)}
          >
            <OpacitySlider
              value={ambientOpacity ?? 1}
              onChange={changeAmbientOpacity}
              colors={colors}
              min={AMBIENT_OPACITY_MIN}
            />
          </SubControl>
        </>
      ) : null}
    </GlassBox>
  );
}

// ── İkon arka planı ────────────────────────────────────────────────────────
export function IconLayerCard({ colors }) {
  const { t, language } = useLanguage();
  const preset = useEffectPreset();
  const {
    showIconBackground,
    iconBackgroundAllowed,
    changeShowIconBackground,
    iconBackgroundMode,
    changeIconBackgroundMode,
    iconBackgroundOpacity,
    changeIconBackgroundOpacity,
    iconBackgroundDensity,
    changeIconBackgroundDensity,
  } = useIconBackgroundSettings();
  const gate = usePremiumGate("icon_background");
  const openUpsell = useCallback(() => gate.showUpsell(), [gate]);
  const grid = resolveIconGrid(iconBackgroundDensity, preset);
  const iconCount = grid.cols * grid.rows;

  return (
    <GlassBox role="card" style={cardStyle(colors)}>
      <GlassTouchable
        glass={false}
        activeOpacity={iconBackgroundAllowed ? 1 : 0.7}
        disabled={iconBackgroundAllowed}
        onPress={openUpsell}
      >
        <LayerHeader
          colors={colors}
          icon={{ name: showIconBackground ? "image-outline" : "image-sharp" }}
          iconBg={colors.iconBlue}
          iconColor={colors.blue}
          title={t.iconBackground}
          subtitle={t.iconBackgroundSubtitle}
          right={
            <LockableSwitch
              value={showIconBackground}
              onChange={changeShowIconBackground}
              allowed={iconBackgroundAllowed}
              onLocked={openUpsell}
            />
          }
        />
      </GlassTouchable>
      {showIconBackground ? (
        <>
          <SubControl
            colors={colors}
            title={t.iconBackgroundOpacity}
            hint={t.iconBackgroundOpacitySubtitle}
            badge={percentText(Math.round((iconBackgroundOpacity ?? 1) * 100), language)}
          >
            <OpacitySlider
              value={iconBackgroundOpacity ?? 1}
              onChange={changeIconBackgroundOpacity}
              colors={colors}
            />
          </SubControl>
          {/* Öğe sayısı = ekran başına görsel görünümü sayısı. */}
          <SubControl
            colors={colors}
            title={i18nText("autoI18n.ikon_yogunluk_baslik", "İçerik yoğunluğu")}
            hint={i18nText("autoI18n.ikon_yogunluk_alt", "Daha az ikon daha hafif çizilir · {{n}} ikon", {
              n: iconCount,
            }).replace("{{n}}", String(iconCount))}
          >
            <DensitySegment
              value={iconBackgroundDensity}
              onChange={changeIconBackgroundDensity}
              colors={colors}
            />
          </SubControl>
          <SubControl
            colors={colors}
            title={t.iconBackgroundLayout}
            hint={
              iconBackgroundMode === "random"
                ? t.iconBackgroundRandomHint
                : t.iconBackgroundSharedHint
            }
          >
            <View
              accessibilityRole="radiogroup"
              style={[s.segment, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}
            >
              {[
                { value: "shared", label: t.iconBackgroundShared },
                { value: "random", label: t.iconBackgroundRandom },
              ].map((o) => {
                const active = iconBackgroundMode === o.value;
                return (
                  <GlassTouchable
                    key={o.value}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    style={[s.segOpt, active && { backgroundColor: colors.accent }]}
                    onPress={() => {
                      if (active) return;
                      Haptics.selectionAsync();
                      changeIconBackgroundMode(o.value);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      allowFontScaling={false}
                      style={[
                        s.segText,
                        { color: active ? colors.white : colors.muted, fontWeight: active ? "700" : "500" },
                      ]}
                    >
                      {o.label}
                    </Text>
                  </GlassTouchable>
                );
              })}
            </View>
          </SubControl>
        </>
      ) : null}
    </GlassBox>
  );
}

// ── Yeniden oluştur ────────────────────────────────────────────────────────
// Desen tohumu ikon yerleşimini ve ambiyans renklerini birlikte belirler;
// yalnız ikisinden biri açıkken anlamlı.
export function RegenerateBackgroundCard({ colors }) {
  const { showAmbientBackground } = useAmbientBackgroundSettings();
  const { showIconBackground } = useIconBackgroundSettings();
  const regenerate = useCallback(() => {
    Haptics.selectionAsync();
    reshuffleDecorSeed();
  }, []);
  if (!showAmbientBackground && !showIconBackground) return null;
  return (
    <GlassBox role="card" style={cardStyle(colors)}>
      <GlassTouchable glass={false} activeOpacity={0.7} onPress={regenerate}>
        <LayerHeader
          colors={colors}
          icon={{ name: "shuffle-outline" }}
          iconBg={colors.iconTeal}
          iconColor={colors.teal}
          title={i18nText("autoI18n.dekor_yeniden_baslik", "Arka planı yeniden oluştur")}
          subtitle={i18nText(
            "autoI18n.dekor_yeniden_alt",
            "Desen ve ambiyans renkleri bir kez üretilir, her ekranda aynısı kullanılır",
          )}
          right={
            <View style={[s.badge, { backgroundColor: colors.accentDim }]}>
              <Text allowFontScaling={false} style={[s.badgeText, { color: colors.accentStrong }]}>
                {i18nText("autoI18n.dekor_yeniden_dugme", "Yenile")}
              </Text>
            </View>
          }
        />
      </GlassTouchable>
    </GlassBox>
  );
}

/**
 * "Ekran bazında ayarla": atmosfer, ikon deseni ve ambiyansın HANGİ ekran
 * gruplarında görüneceği (DecorScopesScreen). Eskiden Kişiselleştirme'de ayrı
 * bir satırdı; ayarladığı katmanların yanında, Atmosfer ekranında duruyor.
 */
export function DecorScopesCard({ colors }) {
  const navigation = useNavigation();
  const { decorHidden } = useDecorScopeSettings();
  return (
    <GlassBox role="card" style={cardStyle(colors)}>
      <GlassTouchable
        glass={false}
        activeOpacity={0.7}
        onPress={() => navigation.navigate("DecorScopesScreen")}
        accessibilityRole="button"
      >
        <LayerHeader
          colors={colors}
          icon={{ name: "layers-outline" }}
          iconBg={colors.iconBlue}
          iconColor={colors.blue}
          title={i18nText("autoI18n.dekor_kapsam_satir_baslik", "Ekran bazında ayarla")}
          subtitle={i18nText(
            "autoI18n.dekor_kapsam_satir_alt",
            "Kar, ikon ve ambiyans hangi ekranlarda görünsün",
          )}
          right={
            <View style={s.right}>
              <View style={[s.badge, { backgroundColor: colors.accentDim }]}>
                <Text allowFontScaling={false} style={[s.badgeText, { color: colors.accentStrong }]}>
                  {isDecorCustomized(decorHidden)
                    ? i18nText("autoI18n.dekor_kapsam_ozel", "Özel")
                    : i18nText("autoI18n.dekor_kapsam_her_yerde", "Her yerde")}
                </Text>
              </View>
              <AppIcon name="chevron-forward" size={14} color={colors.muted} />
            </View>
          }
        />
      </GlassTouchable>
    </GlassBox>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  card: { borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  title: { fontSize: 14, fontWeight: "500" },
  sub: { fontSize: 11, marginTop: 2 },
  right: { flexDirection: "row", alignItems: "center", gap: 8 },
  sub_control: {
    borderTopWidth: 1,
    paddingTop: 12,
    paddingBottom: 14,
    paddingHorizontal: 16,
    gap: 10,
  },
  subHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  subTitle: { fontSize: 13, fontWeight: "600" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  sliderContainer: { height: 32, justifyContent: "center" },
  sliderTrack: {
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    justifyContent: "center",
  },
  sliderFill: { position: "absolute", left: 0, top: 0, bottom: 0, opacity: 0.35 },
  sliderThumb: {
    position: "absolute",
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 3,
    top: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  // Kart kırpıyor (overflow): basılan cam seçenek kenarda kesilmesin.
  segment: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 14,
    padding: GLASS_PRESS_ROOM / 2,
    gap: 2,
  },
  segOpt: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 10 },
  segText: { fontSize: 11, textAlign: "center" },
});
