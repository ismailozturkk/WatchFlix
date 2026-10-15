// screens/onboarding/OnboardingPreferences.js
//
// Kişiselleştirme adımları: tür seçimi (film ve dizi ayrı, en fazla 3) ve
// izlenen platformlar. Seçimler üst bileşende saklanır; burası yalnız görünüm.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image as ExpoImage } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AuthPressable } from "../../components/auth/AuthKit";
import { ONBOARDING_GENRES } from "../../utils/onboardingPreferences";
import { alpha } from "../../theme/colors";
import { isLightSurface } from "../../utils/colorUtils";
import {
  FeatureHeading,
  PAGE_W,
  SIDE_PAD,
  slideBottom,
  slideTop,
  useSlideParallax,
} from "./OnboardingParts";

// Dizi için TMDB'nin birleşik tür adları ("Aksiyon & Macera") varsa onlar gösterilir.
export const genreLabel = (genre, mediaType, isEnglish) =>
  mediaType === "tv"
    ? (isEnglish ? genre.tvEn || genre.en : genre.tvTr || genre.tr)
    : isEnglish
      ? genre.en
      : genre.tr;

const GRID_GAP = 10;
const CONTENT_W = PAGE_W - SIDE_PAD * 2;
const GENRE_W = Math.floor((Math.min(CONTENT_W, 400) - GRID_GAP) / 2);
const PROVIDER_W = Math.floor((Math.min(CONTENT_W, 400) - GRID_GAP * 2) / 3);
const PROVIDERS_COLLAPSED = 12;
const PROVIDERS_EXPANDED = 36;
const MAX_GENRES = 3;

// ── Film / Dizi anahtarı: kayan gösterge + seçim sayısı noktaları ─────────────
function MediaTypeSwitch({ theme, accent, isLightTheme, value, onChange, options }) {
  const [trackW, setTrackW] = useState(0);
  const pos = useRef(new Animated.Value(value === "tv" ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(pos, {
      toValue: value === "tv" ? 1 : 0,
      friction: 9,
      tension: 140,
      useNativeDriver: true,
    }).start();
  }, [value, pos]);

  const segW = trackW ? (trackW - 8) / 2 : 0;
  return (
    <View
      onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
      style={[
        styles.switchTrack,
        {
          backgroundColor: alpha(theme.secondary, isLightTheme ? 0.95 : 0.8),
          borderColor: theme.border,
        },
      ]}
    >
      {segW > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.switchThumb,
            {
              width: segW,
              backgroundColor: accent,
              shadowColor: accent,
              transform: [{ translateX: pos.interpolate({ inputRange: [0, 1], outputRange: [0, segW] }) }],
            },
          ]}
        />
      )}
      {options.map((option) => {
        const active = value === option.key;
        const fg = active ? (isLightSurface(accent) ? "#111827" : "#FFFFFF") : theme.text.secondary;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.key)}
            style={styles.switchItem}
          >
            <Ionicons name={option.icon} size={15} color={fg} />
            <Text maxFontSizeMultiplier={1.15} style={[styles.switchLabel, { color: fg }]}>
              {option.label}
            </Text>
            {option.pips != null && (
              <View style={styles.pips}>
                {Array.from({ length: MAX_GENRES }, (_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.pip,
                      {
                        backgroundColor:
                          i < option.pips
                            ? active
                              ? fg
                              : accent
                            : alpha(active ? fg : theme.text.muted, active ? 0.35 : 0.3),
                      },
                    ]}
                  />
                ))}
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Tür kutusu ───────────────────────────────────────────────────────────────
function GenreTile({ theme, accent, label, icon, order, locked, onPress }) {
  const selected = order > 0;
  return (
    <AuthPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled: locked }}
      disabled={locked}
      onPress={onPress}
      pressedScale={0.96}
      containerStyle={{ width: GENRE_W, opacity: locked ? 0.4 : 1 }}
      style={[
        styles.genre,
        {
          backgroundColor: selected ? alpha(accent, 0.16) : alpha(theme.secondary, 0.85),
          borderColor: selected ? accent : alpha(theme.border, 0.9),
        },
      ]}
    >
      <View
        style={[
          styles.genreIcon,
          { backgroundColor: selected ? accent : alpha(accent, 0.12) },
        ]}
      >
        <Ionicons
          name={icon}
          size={18}
          color={selected ? (isLightSurface(accent) ? "#111827" : "#FFFFFF") : accent}
        />
      </View>
      <Text
        numberOfLines={2}
        maxFontSizeMultiplier={1.2}
        style={[styles.genreLabel, { color: theme.text.primary }]}
      >
        {label}
      </Text>
      {selected ? (
        <View style={[styles.order, { backgroundColor: accent }]}>
          <Text style={[styles.orderText, { color: isLightSurface(accent) ? "#111827" : "#FFFFFF" }]}>
            {order}
          </Text>
        </View>
      ) : (
        <View style={[styles.ring, { borderColor: alpha(theme.text.muted, 0.45) }]} />
      )}
    </AuthPressable>
  );
}

// ── Platform kutusu ──────────────────────────────────────────────────────────
function ProviderTile({ theme, provider, selected, logoUri, onPress }) {
  return (
    <AuthPressable
      accessibilityRole="button"
      accessibilityLabel={provider.name}
      accessibilityState={{ selected }}
      onPress={onPress}
      pressedScale={0.95}
      containerStyle={{ width: PROVIDER_W }}
      style={[
        styles.provider,
        {
          backgroundColor: selected ? alpha(provider.color, 0.18) : alpha(theme.secondary, 0.85),
          borderColor: selected ? provider.color : alpha(theme.border, 0.9),
        },
      ]}
    >
      {logoUri ? (
        <ExpoImage
          source={{ uri: logoUri }}
          style={styles.providerLogo}
          contentFit="cover"
          transition={180}
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={[styles.providerInitial, { backgroundColor: provider.color }]}>
          <Text style={styles.providerInitialText}>{provider.name.slice(0, 1)}</Text>
        </View>
      )}
      <Text
        numberOfLines={1}
        maxFontSizeMultiplier={1.15}
        style={[styles.providerName, { color: theme.text.primary }]}
      >
        {provider.name}
      </Text>
      {selected && (
        <View style={[styles.providerCheck, { backgroundColor: provider.color }]}>
          <Ionicons name="checkmark" size={12} color="#FFFFFF" />
        </View>
      )}
    </AuthPressable>
  );
}

/**
 * @param kind "genre" | "provider"
 */
export default function PreferenceSlide({
  kind,
  copy,
  isEnglish,
  theme,
  accent,
  isLightTheme,
  topInset,
  bottomInset,
  scrollX,
  slideIndex,
  selectedGenreKeys,
  selectedProviderIds,
  providerCatalog,
  getTmdbUrl,
  onToggleGenre,
  onToggleProvider,
  onSelectionTick,
}) {
  const parallax = useSlideParallax(scrollX, slideIndex);
  const isGenre = kind === "genre";
  const text = isGenre ? copy.genre : copy.provider;
  const [mediaType, setMediaType] = useState("movie");
  const [expanded, setExpanded] = useState(false);
  // Önceki oturumdan gelen seçimler "daha fazla"nın arkasında kalıp kaybolmasın.
  const initialProviders = useRef(selectedProviderIds).current;

  const activeGenres = selectedGenreKeys?.[mediaType] || [];
  const genres = useMemo(
    () => ONBOARDING_GENRES.filter((genre) => (mediaType === "movie" ? genre.movieId : genre.tvId)),
    [mediaType],
  );

  const catalog = useMemo(
    () =>
      (providerCatalog || [])
        .filter((provider) => provider.mediaTypes?.includes(mediaType))
        .sort((a, b) => a.priority - b.priority),
    [providerCatalog, mediaType],
  );
  // Sıra seçime göre DEĞİŞMEZ: dokunduğun kutu parmağının altından kaçmasın.
  const providers = useMemo(() => {
    const limit = expanded ? PROVIDERS_EXPANDED : PROVIDERS_COLLAPSED;
    return [
      ...catalog.slice(0, limit),
      ...catalog.slice(limit).filter((provider) => initialProviders.includes(provider.id)),
    ];
  }, [catalog, expanded, initialProviders]);

  const options = [
    {
      key: "movie",
      label: isGenre ? copy.genre.movies : copy.provider.movies,
      icon: "film-outline",
      pips: isGenre ? selectedGenreKeys?.movie?.length || 0 : null,
    },
    {
      key: "tv",
      label: isGenre ? copy.genre.shows : copy.provider.shows,
      icon: "tv-outline",
      pips: isGenre ? selectedGenreKeys?.tv?.length || 0 : null,
    },
  ];

  return (
    <View style={{ width: PAGE_W, flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: SIDE_PAD,
          paddingTop: slideTop(topInset),
          paddingBottom: slideBottom(bottomInset),
        }}
      >
        <Animated.View style={parallax.head}>
          <FeatureHeading
            eyebrow={text.eyebrow}
            title={text.title}
            titleAccent={text.titleAccent}
            desc={text.desc}
            icon={isGenre ? "color-palette-outline" : "tv-outline"}
            theme={theme}
            accent={accent}
            size={28}
          />
        </Animated.View>

        <Animated.View style={[styles.body, parallax.stage]}>
          <MediaTypeSwitch
            theme={theme}
            accent={accent}
            isLightTheme={isLightTheme}
            value={mediaType}
            onChange={(next) => {
              onSelectionTick?.();
              setMediaType(next);
            }}
            options={options}
          />

          {isGenre ? (
            <View style={styles.grid}>
              {genres.map((genre) => {
                const at = activeGenres.indexOf(genre.key);
                return (
                  <GenreTile
                    key={genre.key}
                    theme={theme}
                    accent={accent}
                    label={genreLabel(genre, mediaType, isEnglish)}
                    icon={genre.icon}
                    order={at + 1}
                    locked={at < 0 && activeGenres.length >= MAX_GENRES}
                    onPress={() => onToggleGenre(mediaType, genre.key)}
                  />
                );
              })}
            </View>
          ) : (
            <>
              <View style={styles.countRow}>
                <View
                  style={[
                    styles.countPill,
                    { backgroundColor: alpha(accent, 0.12), borderColor: alpha(accent, 0.22) },
                  ]}
                >
                  <Ionicons name="checkmark-circle" size={13} color={accent} />
                  <Text maxFontSizeMultiplier={1.15} style={[styles.countText, { color: accent }]}>
                    {text.selected(selectedProviderIds.length)}
                  </Text>
                </View>
                <Text
                  maxFontSizeMultiplier={1.15}
                  style={[styles.countHint, { color: theme.text.muted }]}
                  numberOfLines={2}
                >
                  {text.hint}
                </Text>
              </View>
              <View style={styles.grid}>
                {providers.map((provider) => (
                  <ProviderTile
                    key={provider.id}
                    theme={theme}
                    provider={provider}
                    selected={selectedProviderIds.includes(provider.id)}
                    logoUri={provider.logoPath ? getTmdbUrl(provider.logoPath, "logo", 150) : null}
                    onPress={() => onToggleProvider(provider.id)}
                  />
                ))}
              </View>
              {catalog.length > PROVIDERS_COLLAPSED && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setExpanded((value) => !value)}
                  style={styles.more}
                  hitSlop={8}
                >
                  <Text maxFontSizeMultiplier={1.15} style={[styles.moreText, { color: accent }]}>
                    {expanded ? text.less : text.more}
                  </Text>
                  <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={14} color={accent} />
                </Pressable>
              )}
            </>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { width: "100%", maxWidth: 400, alignSelf: "center", marginTop: 22, gap: 14 },
  switchTrack: {
    flexDirection: "row",
    borderRadius: 18,
    borderWidth: 1,
    padding: 4,
  },
  switchThumb: {
    position: "absolute",
    top: 4,
    left: 4,
    bottom: 4,
    borderRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 8,
    elevation: 4,
  },
  switchItem: {
    flex: 1,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  switchLabel: { fontSize: 13, fontWeight: "800" },
  pips: { flexDirection: "row", gap: 3, marginLeft: 2 },
  pip: { width: 5, height: 5, borderRadius: 3 },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP },
  genre: {
    minHeight: 60,
    borderRadius: 18,
    borderWidth: 1.5,
    paddingLeft: 10,
    paddingRight: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  genreIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  genreLabel: { flex: 1, fontSize: 12.5, fontWeight: "800", lineHeight: 16 },
  order: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  orderText: { fontSize: 11.5, fontWeight: "900" },
  ring: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5 },

  countRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  countHint: { flex: 1, fontSize: 11.5, fontWeight: "600", lineHeight: 15 },
  countPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  countText: { fontSize: 12, fontWeight: "800" },
  provider: {
    height: 112,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 6,
  },
  providerLogo: { width: 52, height: 52, borderRadius: 14, backgroundColor: "#FFFFFF" },
  providerInitial: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  providerInitialText: { color: "#FFFFFF", fontSize: 20, fontWeight: "900" },
  providerName: { width: "100%", fontSize: 11, fontWeight: "800", textAlign: "center" },
  providerCheck: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  more: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
  },
  moreText: { fontSize: 13, fontWeight: "800" },
});
