// screens/tabs/settings/widgets/WidgetStage.js
//
// Canlı önizleme sahnesi: duvar kâğıdı üstünde, seçili platformun GERÇEK widget
// çizimiyle (Android → AndroidPreviews, iOS → IosPreviews).
//
// Sahne ekranda SABİT durur (ayar listesi altında kayar), yani kullanıcı bir
// anahtarı çevirirken sonucu aynı anda görür. Sabit kalabilmesi için yüksekliği
// sınırlıdır: widget doğal ölçüsüyle bu sınıra sığmıyorsa ORANTILI küçültülür
// (transform scale) — yerleşim ve metin kırpılması gerçekle aynı kalır.

import React, { useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { i18nText } from "@utils/i18nText";
import { selectionAsync } from "../../../../services/hapticsService";
import AndroidWidgetPreview from "./AndroidPreviews";
import IosWidgetPreview from "./IosPreviews";
import {
  ANDROID_CELLS,
  IOS_FAMILIES,
  WALLPAPERS,
  fitScale,
  iosFamilyFor,
  widgetAspect,
  widgetNaturalWidth,
} from "./widgetPlatform";

const STAGE_PAD = 14;
const SCREEN_GUTTER = 16; // settingsUi `ui.scroll` yatay dolgusu

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const WALLPAPER_LABELS = {
  night: () => i18nText("autoI18n.widget_wallpaper_night", "Gece"),
  sunrise: () => i18nText("autoI18n.widget_wallpaper_sunrise", "Gün doğumu"),
  paper: () => i18nText("autoI18n.widget_wallpaper_paper", "Açık"),
};

const tap = () => {
  selectionAsync().catch(() => {});
};

/** Doğal ölçüde çizilen widget'ı `scale` ile küçültür; kapladığı yer de küçülür. */
function FitBox({ width, height, scale, radius, shadowColor, children }) {
  return (
    <View
      style={[
        styles.shadow,
        {
          width: width * scale,
          height: height * scale,
          borderRadius: radius * scale,
          backgroundColor: shadowColor,
        },
      ]}
    >
      <View
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width,
          height,
          transform: [
            { translateX: -(width * (1 - scale)) / 2 },
            { translateY: -(height * (1 - scale)) / 2 },
            { scale },
          ],
        }}
      >
        {children}
      </View>
    </View>
  );
}

function StatusPill({ status, chip, colors }) {
  const dot =
    status === "failed" ? colors.danger : status === "saving" ? colors.amber : colors.green;
  const label =
    status === "failed"
      ? i18nText("autoI18n.widget_save_failed", "Kaydedilemedi")
      : status === "saving"
        ? i18nText("autoI18n.widget_saving", "Kaydediliyor")
        : i18nText("autoI18n.widget_saved", "Güncel");
  return (
    <View style={[styles.chip, { backgroundColor: chip.bg }]}>
      <View style={[styles.statusDot, { backgroundColor: dot }]} />
      <Text
        accessibilityLiveRegion="polite"
        allowFontScaling={false}
        style={[styles.chipText, { color: chip.text }]}
      >
        {label}
      </Text>
    </View>
  );
}

function FamilyToggle({ active, family, onChange, chip, accent }) {
  const families = IOS_FAMILIES[active];
  const label = (id) =>
    id === "medium"
      ? i18nText("autoI18n.widget_size_medium", "Orta")
      : i18nText("autoI18n.widget_size_large", "Büyük");

  if (families.length < 2) {
    return (
      <View style={[styles.chip, { backgroundColor: chip.bg }]}>
        <Text allowFontScaling={false} style={[styles.chipText, { color: chip.text }]}>
          {label(families[0])}
        </Text>
      </View>
    );
  }
  return (
    <View style={[styles.familyToggle, { backgroundColor: chip.bg }]}>
      {families.map((id) => {
        const selected = id === family;
        return (
          <Pressable
            key={id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            hitSlop={4}
            onPress={() => {
              if (selected) return;
              tap();
              onChange(id);
            }}
            style={[styles.familyOption, selected && { backgroundColor: accent }]}
          >
            <Text
              allowFontScaling={false}
              style={[
                styles.chipText,
                { color: selected ? "#FFFFFF" : chip.text },
              ]}
            >
              {label(id)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function WallpaperDots({ value, onChange, chip }) {
  return (
    <View style={styles.dots}>
      {WALLPAPERS.map((wallpaper) => {
        const selected = wallpaper.id === value;
        return (
          <Pressable
            key={wallpaper.id}
            accessibilityRole="button"
            accessibilityLabel={`${i18nText("autoI18n.widget_wallpaper", "Duvar kâğıdı")}: ${WALLPAPER_LABELS[wallpaper.id]()}`}
            accessibilityState={{ selected }}
            hitSlop={5}
            onPress={() => {
              if (selected) return;
              tap();
              onChange(wallpaper.id);
            }}
            style={[
              styles.dotRing,
              { borderColor: selected ? chip.text : "transparent" },
            ]}
          >
            <LinearGradient
              colors={wallpaper.colors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.dot}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * @param {object} props
 * @param {"ios"|"android"} props.platform
 * @param {"reminders"|"lists"|"stats"} props.active
 * @param {object} props.settings seçili widget'ın tercihleri
 * @param {"medium"|"large"} props.family iOS widget ailesi
 * @param {(family: string) => void} props.onFamilyChange
 * @param {string} props.wallpaperId
 * @param {(id: string) => void} props.onWallpaperChange
 * @param {"saved"|"saving"|"failed"} props.status
 * @param {object} props.colors buildUiColors çıktısı
 */
export default function WidgetStage({
  platform,
  active,
  settings,
  family,
  onFamilyChange,
  wallpaperId,
  onWallpaperChange,
  status,
  colors,
}) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const wallpaper = WALLPAPERS.find((w) => w.id === wallpaperId) || WALLPAPERS[0];
  const chip = wallpaper.dark
    ? { bg: "rgba(0,0,0,0.38)", text: "#FFFFFF" }
    : { bg: "rgba(255,255,255,0.7)", text: "#14161F" };

  const resolvedFamily = iosFamilyFor(active, family);
  const inner = windowWidth - SCREEN_GUTTER * 2 - STAGE_PAD * 2;
  const naturalWidth = widgetNaturalWidth(platform, active, resolvedFamily, inner);
  const naturalHeight =
    naturalWidth / widgetAspect(platform, active, resolvedFamily);
  // Pinli sahnenin payı: ekran yüksekliğinin ~%25'i, çok küçük/büyük ekranlarda sınırlı.
  // Kalan alan ayarların kaydığı bölgedir; sahne ne kadar büyükse o kadar daralır.
  const maxHeight = clamp(windowHeight * 0.25, 150, 230);
  const scale = fitScale(naturalHeight, maxHeight);
  const radius = platform === "ios" ? 22 : 24;

  // Widget ya da aile değişince küçük bir yay: değişimin sahnede yapıldığı belli olsun.
  const pop = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    pop.setValue(0.94);
    Animated.spring(pop, {
      toValue: 1,
      damping: 14,
      stiffness: 220,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }, [active, resolvedFamily, platform, pop]);

  return (
    <View
      style={[styles.stage, { borderColor: colors.border }]}
      accessibilityLabel={i18nText("autoI18n.widget_preview_label", "Önizleme")}
    >
      <LinearGradient
        colors={wallpaper.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.topRow}>
        <StatusPill status={status} chip={chip} colors={colors} />
        <View style={styles.topRight}>
          {platform === "ios" ? (
            <FamilyToggle
              active={active}
              family={resolvedFamily}
              onChange={onFamilyChange}
              chip={chip}
              accent={settings.appearance.accent}
            />
          ) : (
            <View style={[styles.chip, { backgroundColor: chip.bg }]}>
              <Text allowFontScaling={false} style={[styles.chipText, { color: chip.text }]}>
                {ANDROID_CELLS[active]}
              </Text>
            </View>
          )}
          <WallpaperDots
            value={wallpaper.id}
            onChange={onWallpaperChange}
            chip={chip}
          />
        </View>
      </View>

      <View style={styles.widgetArea}>
        <Animated.View
          style={{
            transform: [{ scale: pop }],
            opacity: pop.interpolate({
              inputRange: [0.94, 1],
              outputRange: [0.7, 1],
              extrapolate: "clamp",
            }),
          }}
        >
          <FitBox
            width={naturalWidth}
            height={naturalHeight}
            scale={scale}
            radius={radius}
            shadowColor={settings.appearance.background}
          >
            {platform === "ios" ? (
              <IosWidgetPreview
                active={active}
                settings={settings}
                family={resolvedFamily}
                width={naturalWidth}
              />
            ) : (
              <AndroidWidgetPreview active={active} settings={settings} />
            )}
          </FitBox>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    borderRadius: 26,
    borderWidth: 1,
    overflow: "hidden",
    padding: STAGE_PAD,
    gap: 12,
  },
  topRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    rowGap: 8,
    columnGap: 8,
  },
  topRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
  },
  chipText: { fontSize: 11.5, fontWeight: "700" },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  familyToggle: {
    flexDirection: "row",
    padding: 2,
    borderRadius: 13,
    gap: 2,
  },
  familyOption: {
    minHeight: 22,
    paddingHorizontal: 9,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  dots: { flexDirection: "row", alignItems: "center", gap: 6 },
  dotRing: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: { width: 14, height: 14, borderRadius: 7, overflow: "hidden" },
  widgetArea: { alignItems: "center", justifyContent: "center" },
  // Widget'a "ana ekrana yerleşmiş" derinliği: gölge, kırpmayan bu kapta durur
  // (widget çerçevesi overflow: hidden). Android elevation gölgesi için zemin şart.
  shadow: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
  },
});
