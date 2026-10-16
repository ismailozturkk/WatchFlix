// components/ai/AIPrefsPanel.js
//
// CineMatch sohbetinin içindeki hızlı ayar paneli (üstteki "filtre" düğmesi).
// Tam ayarlar Ayarlar > Yapay zeka'dadır; ikisi AYNI kaydı (Keys.aiCinePrefs)
// kullanır, bu panel en sık dokunulanları sohbetten çıkmadan açar:
// listeler, platformlar, içerik türü, türler, cevap stili.

import React, { memo, useCallback, useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { alpha } from "../../theme/colors";
import SwitchToggle from "../SwitchToggle";
import { STREAMING_PROVIDERS } from "../../context/AppSettingsContext";
import { ONBOARDING_GENRES, onboardingGenreLabel } from "../../utils/onboardingPreferences";
import {
  AI_MAX_ITEM_CHOICES,
  AI_RESPONSE_STYLES,
  AI_SPOILER_LEVELS,
  countDiscoveryFilters,
} from "../../utils/aiPrefs";
import { ChoiceChip, ChoiceWrap, SegmentedChoice } from "./AIChips";

const LIST_TOGGLES = [
  ["watchList", "listWatchList"],
  ["favorites", "listFavorites"],
  ["custom", "listCustom"],
  ["watched", "listWatched"],
];

const genreSupported = (genre, mediaType) =>
  mediaType === "movie" ? genre.movieId : mediaType === "tv" ? genre.tvId : genre.movieId || genre.tvId;

export const genreLabel = (genre, mediaType, language) =>
  onboardingGenreLabel(genre, mediaType, language);

function AIPrefsPanel({ theme, t, copy, language, prefs, updatePrefs, onOpenAllSettings }) {
  const filterCount = countDiscoveryFilters(prefs);

  const availableGenres = useMemo(
    () => ONBOARDING_GENRES.filter((genre) => genreSupported(genre, prefs.mediaType)),
    [prefs.mediaType],
  );

  const toggleProvider = useCallback(
    (providerId) => {
      const next = prefs.providerIds.includes(providerId)
        ? prefs.providerIds.filter((id) => id !== providerId)
        : [...prefs.providerIds, providerId];
      updatePrefs({ providerIds: next });
    },
    [prefs.providerIds, updatePrefs],
  );

  const changeMediaType = useCallback(
    (mediaType) => {
      // Seçili türlerden yeni içerik türünde karşılığı olmayanlar düşer.
      const genreKeys = prefs.genreKeys.filter((key) => {
        const genre = ONBOARDING_GENRES.find((item) => item.key === key);
        return genre && genreSupported(genre, mediaType);
      });
      updatePrefs({ mediaType, genreKeys });
    },
    [prefs.genreKeys, updatePrefs],
  );

  const toggleGenre = useCallback(
    (genreKey) => {
      const next = prefs.genreKeys.includes(genreKey)
        ? prefs.genreKeys.filter((key) => key !== genreKey)
        : [...prefs.genreKeys, genreKey];
      updatePrefs({ genreKeys: next });
    },
    [prefs.genreKeys, updatePrefs],
  );

  const styleOptions = useMemo(
    () => AI_RESPONSE_STYLES.map((value) => ({ value, label: copy.panel.style[value] })),
    [copy],
  );
  const spoilerOptions = useMemo(
    () => AI_SPOILER_LEVELS.map((value) => ({ value, label: copy.panel.spoiler[value] })),
    [copy],
  );
  const countOptions = useMemo(
    () => AI_MAX_ITEM_CHOICES.map((value) => ({ value, label: String(value) })),
    [],
  );
  const providerOptions = useMemo(
    () => STREAMING_PROVIDERS.map((provider) => ({ value: provider.id, label: provider.name, dotColor: provider.color })),
    [],
  );
  const mediaOptions = useMemo(
    () => [
      { value: "all", label: t?.AICineChat?.contentAll || "Film + Dizi", icon: "apps-outline" },
      { value: "movie", label: t?.AICineChat?.contentMovies || "Yalnız film", icon: "film-outline" },
      { value: "tv", label: t?.AICineChat?.contentSeries || "Yalnız dizi", icon: "tv-outline" },
    ],
    [t],
  );
  const genreOptions = useMemo(
    () =>
      availableGenres.map((genre) => ({
        value: genre.key,
        label: genreLabel(genre, prefs.mediaType, language),
        icon: genre.icon,
      })),
    [availableGenres, prefs.mediaType, language],
  );

  const divider = <View style={[s.divider, { backgroundColor: theme.border }]} />;

  return (
    <View style={[s.panel, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        <View style={s.heading}>
          <View style={[s.headingIcon, { backgroundColor: alpha(theme.accent, 0.16) }]}>
            <Ionicons name="options-outline" size={18} color={theme.bold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.title, { color: theme.text.primary }]}>
              {t?.AICineChat?.personalizeTitle || "CineMatch'i özelleştir"}
            </Text>
            <Text style={[s.hint, { color: theme.text.muted }]}>
              {t?.AICineChat?.personalizeHint || "Öneriler seçtiğin liste, platform ve türlere göre hazırlanır."}
            </Text>
          </View>
          {filterCount > 0 ? (
            <View style={[s.count, { backgroundColor: theme.accent }]}>
              <Text style={s.countText}>{filterCount}</Text>
            </View>
          ) : null}
        </View>

        {divider}

        <View style={s.settingRow}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={[s.settingTitle, { color: theme.text.primary }]}>
              {t?.AICineChat?.useMyLists || "Listelerimi kullan"}
            </Text>
            <Text style={[s.hint, { color: theme.text.muted }]}>
              {t?.AICineChat?.listsHint || "Önerileri listelerine göre kişiselleştirir (daha fazla token kullanır)"}
            </Text>
          </View>
          <SwitchToggle value={prefs.enabled} onValueChange={(value) => updatePrefs({ enabled: value })} size={36} />
        </View>
        {prefs.enabled ? (
          <View style={s.chips}>
            {LIST_TOGGLES.map(([key, label]) => (
              <ChoiceChip
                key={key}
                label={t?.AICineChat?.[label] || key}
                icon={prefs[key] ? "checkmark-circle" : "ellipse-outline"}
                selected={prefs[key]}
                onPress={() => updatePrefs({ [key]: !prefs[key] })}
                theme={theme}
              />
            ))}
          </View>
        ) : null}

        {divider}

        <Text style={[s.settingTitle, { color: theme.text.primary }]}>
          {t?.AICineChat?.platformsTitle || "Platformlar"}
        </Text>
        <Text style={[s.hint, { color: theme.text.muted }]}>
          {t?.AICineChat?.platformsHint || "Boş bırakırsan tüm platformlarda arar."}
        </Text>
        <View style={s.chips}>
          <ChoiceChip
            label={t?.AICineChat?.allPlatforms || "Tümü"}
            icon="globe-outline"
            selected={prefs.providerIds.length === 0}
            onPress={() => updatePrefs({ providerIds: [] })}
            theme={theme}
          />
          {providerOptions.map((option) => (
            <ChoiceChip
              key={option.value}
              label={option.label}
              dotColor={option.dotColor}
              selected={prefs.providerIds.includes(option.value)}
              onPress={() => toggleProvider(option.value)}
              theme={theme}
            />
          ))}
        </View>

        {divider}

        <Text style={[s.settingTitle, { color: theme.text.primary }]}>
          {t?.AICineChat?.contentTypeTitle || "İçerik türü"}
        </Text>
        <ChoiceWrap
          options={mediaOptions}
          selected={[prefs.mediaType]}
          onToggle={changeMediaType}
          theme={theme}
          style={s.chips}
        />

        <View style={s.genreHeading}>
          <Text style={[s.settingTitle, { color: theme.text.primary }]}>{t?.AICineChat?.genresTitle || "Türler"}</Text>
          {prefs.genreKeys.length ? (
            <TouchableOpacity onPress={() => updatePrefs({ genreKeys: [] })}>
              <Text style={[s.clearInline, { color: theme.bold }]}>{t?.AICineChat?.clear || "Temizle"}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <Text style={[s.hint, { color: theme.text.muted }]}>
          {t?.AICineChat?.genresHint || "Birden fazla tür seçebilirsin."}
        </Text>
        <ChoiceWrap options={genreOptions} selected={prefs.genreKeys} onToggle={toggleGenre} theme={theme} style={s.chips} />

        {divider}

        <Text style={[s.settingTitle, { color: theme.text.primary }]}>{copy.panel.styleTitle}</Text>
        <SegmentedChoice
          options={styleOptions}
          value={prefs.responseStyle}
          onChange={(value) => updatePrefs({ responseStyle: value })}
          theme={theme}
          style={s.segment}
        />
        <View style={s.twoCol}>
          <View style={{ flex: 1 }}>
            <Text style={[s.miniTitle, { color: theme.text.muted }]}>{copy.panel.spoilerTitle}</Text>
            <SegmentedChoice
              options={spoilerOptions}
              value={prefs.spoilerLevel}
              onChange={(value) => updatePrefs({ spoilerLevel: value })}
              theme={theme}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.miniTitle, { color: theme.text.muted }]}>{copy.panel.countTitle}</Text>
            <SegmentedChoice
              options={countOptions}
              value={prefs.maxItems}
              onChange={(value) => updatePrefs({ maxItems: value })}
              theme={theme}
            />
          </View>
        </View>

        {filterCount > 0 ? (
          <TouchableOpacity
            onPress={() => updatePrefs({ mediaType: "all", providerIds: [], genreKeys: [] })}
            style={s.linkBtn}
          >
            <Ionicons name="refresh-outline" size={15} color={theme.bold} />
            <Text style={[s.linkText, { color: theme.bold }]}>
              {t?.AICineChat?.clearDiscoveryFilters || "Platform ve tür filtrelerini temizle"}
            </Text>
          </TouchableOpacity>
        ) : null}

        {onOpenAllSettings ? (
          <TouchableOpacity
            onPress={onOpenAllSettings}
            style={[s.allBtn, { borderColor: alpha(theme.accent, 0.45), backgroundColor: alpha(theme.accent, 0.1) }]}
          >
            <Ionicons name="settings-outline" size={16} color={theme.bold} />
            <Text style={[s.linkText, { color: theme.bold, flex: 1 }]}>{copy.panel.allSettings}</Text>
            <Ionicons name="chevron-forward" size={15} color={theme.bold} />
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </View>
  );
}

export default memo(AIPrefsPanel);

const s = StyleSheet.create({
  panel: {
    margin: 10,
    marginBottom: 0,
    maxHeight: "58%",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  content: { padding: 13, paddingBottom: 18 },
  heading: { flexDirection: "row", alignItems: "center", gap: 10 },
  headingIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 15, fontWeight: "800" },
  count: { minWidth: 25, height: 25, borderRadius: 13, paddingHorizontal: 7, alignItems: "center", justifyContent: "center" },
  countText: { color: "#fff", fontSize: 11, fontWeight: "900" },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 13 },
  settingRow: { flexDirection: "row", alignItems: "center" },
  settingTitle: { fontSize: 14, fontWeight: "700" },
  miniTitle: { fontSize: 10.5, fontWeight: "800", letterSpacing: 0.6, marginBottom: 6, marginTop: 12, textTransform: "uppercase" },
  hint: { fontSize: 11, lineHeight: 15, marginTop: 2 },
  chips: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  genreHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 15 },
  clearInline: { fontSize: 11, fontWeight: "700" },
  segment: { marginTop: 10 },
  twoCol: { flexDirection: "row", gap: 10 },
  linkBtn: { minHeight: 40, marginTop: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  linkText: { fontSize: 12, fontWeight: "700" },
  allBtn: {
    marginTop: 12,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
