// screens/tabs/settings/WidgetSettingsScreen.js
//
// Ana ekran widget'larının görünümü (Yaklaşanlar / Listelerim / İstatistikler).
//
// Düzen: üstte SABİT bir önizleme bölgesi (widget seçici + duvar kâğıdı sahnesi),
// altında kayan ayarlar. Kullanıcı bir anahtarı çevirirken sonucu aynı anda görür.
//
// iOS ve Android ayrı çizilir çünkü widget'ların kendisi ayrı çiziliyor:
//   • önizleme → platformun gerçek widget'ı (widgets/AndroidPreviews, IosPreviews)
//   • kontroller → o platformda gerçekten işe yarayanlar (widgets/widgetPlatform)
//   • bileşen dili → iOS: kayan başparmaklı segment; Android: Material 3 segment
// Parçalar screens/tabs/settings/widgets/ altında.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import ConfirmSheet from "@components/common/ConfirmSheet";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import { alpha, buildCustomTheme, themes } from "../../../theme/colors";
import { isLightSurface, toHex } from "../../../utils/colorUtils";
import { i18nText } from "@utils/i18nText";
import { toast } from "@components/AppToast";
import {
  DEFAULT_WIDGET_PREFERENCES,
  POSTER_LIMIT_OPTIONS,
  REMINDER_LIMIT_OPTIONS,
  loadWidgetPreferences,
  resetWidgetPreferences,
  saveWidgetPreferences,
} from "@services/widgetPreferencesService";
import {
  notificationAsync,
  selectionAsync,
} from "../../../services/hapticsService";
import { SectionLabel, SettingsSubScreen, buildUiColors } from "./settingsUi";
import {
  AccentGrid,
  ControlBlock,
  ControlCard,
  HowToCard,
  InfoNote,
  Segmented,
  ThemeCards,
  ToggleRow,
  WidgetPicker,
} from "./widgets/WidgetControls";
import WidgetStage from "./widgets/WidgetStage";
import {
  IOS_DEFAULT_FAMILY,
  WIDGET_IDS,
  iosFamilyFor,
  widgetCapabilities,
} from "./widgets/widgetPlatform";

const PLATFORM = Platform.OS === "ios" ? "ios" : "android";

const WIDGET_ICONS = {
  reminders: "time-outline",
  lists: "grid-outline",
  stats: "stats-chart-outline",
};

const BUILTIN_THEMES = [
  { id: "gray", labelKey: "grayTheme", fallback: "Gri" },
  { id: "dark", labelKey: "darkTheme", fallback: "AMOLED" },
  { id: "light", labelKey: "lightTheme", fallback: "Açık" },
  { id: "sky", labelKey: "skyTheme", fallback: "Açık Mavi" },
  { id: "blue", labelKey: "blueTheme", fallback: "Lacivert" },
  { id: "green", labelKey: "greenTheme", fallback: "Yeşil" },
  { id: "purple", labelKey: "purpleTheme", fallback: "Gece Moru" },
  { id: "amber", labelKey: "amberTheme", fallback: "Kızıl Sinema" },
];

const widgetLabel = (id) =>
  id === "reminders"
    ? i18nText("autoI18n.widget_upcoming", "Yaklaşanlar")
    : id === "lists"
      ? i18nText("autoI18n.widget_lists", "Listeler")
      : i18nText("autoI18n.widget_stats", "İstatistikler");

const appearanceFromPalette = (themeId, themeName, palette) => ({
  themeId,
  themeName,
  background: toHex(palette.primary),
  surface: toHex(palette.secondary),
  surfaceAlt: toHex(palette.between),
  border: toHex(palette.border),
  text: toHex(palette.text.primary),
  secondaryText: toHex(palette.text.secondary),
  muted: toHex(palette.text.muted),
  accent: toHex(palette.accent),
  bold: toHex(palette.bold || palette.accent),
});

export default function WidgetSettingsScreen() {
  const { theme, customThemes = [] } = useTheme();
  // Dil değişince ekran yeniden çizilsin (metinler i18nText ile çağrı anında çözülür).
  useLanguage();
  const C = buildUiColors(theme);
  const caps = widgetCapabilities(PLATFORM);
  const { height: windowHeight } = useWindowDimensions();

  const [activeWidget, setActiveWidget] = useState("reminders");
  const [preferences, setPreferences] = useState(DEFAULT_WIDGET_PREFERENCES);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [family, setFamily] = useState(IOS_DEFAULT_FAMILY);
  const [wallpaperId, setWallpaperId] = useState(() =>
    isLightSurface(theme.primary) ? "paper" : "night",
  );
  const [appliedAll, setAppliedAll] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const persistTimer = useRef(null);
  const appliedTimer = useRef(null);
  const persistVersion = useRef(0);
  const dirty = useRef(false);
  const latestPreferences = useRef(DEFAULT_WIDGET_PREFERENCES);

  latestPreferences.current = preferences;

  const themeCatalog = useMemo(() => {
    const builtins = BUILTIN_THEMES.map((item) => ({
      id: item.id,
      name: i18nText(item.labelKey, item.fallback),
      appearance: appearanceFromPalette(
        item.id,
        i18nText(item.labelKey, item.fallback),
        themes[item.id],
      ),
      custom: false,
    }));
    const custom = customThemes.map((item) => {
      const id = `custom:${item.id}`;
      // Rozet metni ("ÖZEL") ile tema ADI ayrı anahtar: tek anahtar
      // paylaşılınca ikisinden biri kaçınılmaz olarak yanlış görünüyordu.
      const name =
        item.name || i18nText("autoI18n.widget_custom_theme_name", "Özel Tema");
      return {
        id,
        name,
        appearance: appearanceFromPalette(
          id,
          name,
          buildCustomTheme(item.tokens),
        ),
        custom: true,
      };
    });
    return [...builtins, ...custom];
  }, [customThemes]);

  useEffect(() => {
    let mounted = true;
    loadWidgetPreferences().then((loaded) => {
      if (!mounted) return;
      setPreferences(loaded);
      setReady(true);
    });
    return () => {
      mounted = false;
      if (persistTimer.current) clearTimeout(persistTimer.current);
      if (appliedTimer.current) clearTimeout(appliedTimer.current);
      // Kullanıcı son seçimin ardından hemen geri giderse 220 ms'lik debounce
      // yüzünden tercih kaybolmasın. MMKV yazımı senkrondur; native yenileme
      // güvenli biçimde fire-and-forget devam eder.
      if (dirty.current) saveWidgetPreferences(latestPreferences.current);
    };
  }, []);

  useEffect(() => {
    if (!ready || !dirty.current) return undefined;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    setSaving(true);
    setSaveFailed(false);
    const version = ++persistVersion.current;
    persistTimer.current = setTimeout(() => {
      saveWidgetPreferences(preferences)
        .then(() => {
          if (version !== persistVersion.current) return;
          dirty.current = false;
          setSaveFailed(false);
        })
        .catch(() => {
          if (version === persistVersion.current) setSaveFailed(true);
        })
        .finally(() => {
          if (version === persistVersion.current) setSaving(false);
        });
    }, 220);
    return () => clearTimeout(persistTimer.current);
  }, [preferences, ready]);

  const patchActive = useCallback(
    (next) => {
      dirty.current = true;
      setPreferences((current) => ({
        ...current,
        [activeWidget]: { ...current[activeWidget], ...next },
      }));
    },
    [activeWidget],
  );

  const patchAppearance = useCallback(
    (next) => {
      dirty.current = true;
      setPreferences((current) => ({
        ...current,
        [activeWidget]: {
          ...current[activeWidget],
          appearance: {
            ...current[activeWidget].appearance,
            ...next,
          },
        },
      }));
    },
    [activeWidget],
  );

  // Seçili widget'ın temasını üçüne birden yayar (içerik tercihlerine dokunmaz).
  const applyThemeToAll = useCallback(() => {
    dirty.current = true;
    setPreferences((current) => {
      const appearance = current[activeWidget].appearance;
      return {
        reminders: { ...current.reminders, appearance },
        lists: { ...current.lists, appearance },
        stats: { ...current.stats, appearance },
      };
    });
    notificationAsync().catch(() => {});
    setAppliedAll(true);
    if (appliedTimer.current) clearTimeout(appliedTimer.current);
    appliedTimer.current = setTimeout(() => setAppliedAll(false), 2200);
  }, [activeWidget]);

  const resetActive = useCallback(() => {
    selectionAsync().catch(() => {});
    dirty.current = true;
    setPreferences((current) => ({
      ...current,
      [activeWidget]: DEFAULT_WIDGET_PREFERENCES[activeWidget],
    }));
  }, [activeWidget]);

  const handleResetAll = useCallback(async () => {
    setConfirmReset(false);
    setSaving(true);
    setSaveFailed(false);
    try {
      const defaults = await resetWidgetPreferences();
      dirty.current = false;
      setPreferences(defaults);
      toast.success(i18nText("autoI18n.toast_widget_sifirlandi", "Widget ayarları sıfırlandı"));
    } catch {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  }, []);

  const title = i18nText("autoI18n.widget_settings_title", "Widget’lar");

  if (!ready) {
    return (
      <SettingsSubScreen title={title}>
        <View style={styles.loading}>
          <ActivityIndicator color={C.accent} />
        </View>
      </SettingsSubScreen>
    );
  }

  const settings = preferences[activeWidget];
  const accentOptions = Array.from(
    new Set(
      themeCatalog.flatMap((item) => [
        item.appearance.accent,
        item.appearance.bold,
      ]),
    ),
  );
  const status = saveFailed ? "failed" : saving ? "saving" : "saved";
  const resolvedFamily = iosFamilyFor(activeWidget, family);

  const densityOptions = [
    { value: "compact", label: i18nText("autoI18n.widget_compact", "Kompakt") },
    {
      value: "comfortable",
      label: i18nText("autoI18n.widget_comfortable", "Rahat"),
    },
  ];

  const platformNote =
    PLATFORM === "ios"
      ? activeWidget === "reminders"
        ? i18nText(
            "autoI18n.widget_ios_note_reminders",
            "iOS’ta satır sayısını widget boyutu belirler; posterlerin yerine tür rozeti gösterilir.",
          )
        : activeWidget === "lists"
          ? i18nText(
              "autoI18n.widget_ios_note_lists",
              "iOS’ta listeler alt alta sıralanır; poster ızgarası ve liste geçişi yalnızca Android’de var.",
            )
          : i18nText(
              "autoI18n.widget_ios_note_stats",
              "İstatistikler iOS’ta orta ve büyük boyutta eklenebilir; orta boyda süre şeridi yalnızca yer kalırsa görünür.",
            )
      : i18nText(
          "autoI18n.widget_android_note_resize",
          "Ana ekranda widget’a uzun basıp sürükleyerek yeniden boyutlandırabilirsin.",
        );

  return (
    <SettingsSubScreen title={title} scrollable={false}>
      <View style={styles.root}>
        {/* ── Sabit bölge: kullanıcı ayarları kaydırırken önizleme yerinde kalır ── */}
        <View style={styles.pinned}>
          <WidgetPicker
            widgets={WIDGET_IDS.map((id) => ({
              id,
              icon: WIDGET_ICONS[id],
              label: widgetLabel(id),
            }))}
            active={activeWidget}
            onChange={setActiveWidget}
            colors={C}
            platform={PLATFORM}
            compact={windowHeight < 720}
          />
          <WidgetStage
            platform={PLATFORM}
            active={activeWidget}
            settings={settings}
            family={resolvedFamily}
            onFamilyChange={setFamily}
            wallpaperId={wallpaperId}
            onWallpaperChange={setWallpaperId}
            status={status}
            colors={C}
          />
        </View>

        <View style={styles.flex}>
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <SectionLabel color={C.muted}>
              {i18nText(
                "autoI18n.widget_private_appearance",
                "BU WIDGET’A ÖZEL GÖRÜNÜM",
              )}
            </SectionLabel>
            <ControlCard colors={C} platform={PLATFORM}>
              <ControlBlock
                first
                colors={C}
                title={i18nText("autoI18n.widget_theme", "Widget teması")}
                hint={i18nText(
                  "autoI18n.widget_theme_description",
                  "Uygulama temaları ve oluşturduğun özel temalar",
                )}
              >
                <ThemeCards
                  catalog={themeCatalog}
                  activeId={settings.appearance.themeId}
                  onPick={(item) => patchAppearance(item.appearance)}
                  colors={C}
                />
              </ControlBlock>
              <ControlBlock
                colors={C}
                title={i18nText("autoI18n.widget_accent", "Vurgu rengi")}
                hint={i18nText(
                  "autoI18n.widget_theme_accent_description",
                  "Tema paletlerinden bir vurgu seç; önizlemede anında gör",
                )}
              >
                <AccentGrid
                  options={accentOptions}
                  selected={settings.appearance.accent}
                  onPick={(accent) => patchAppearance({ accent, bold: accent })}
                />
              </ControlBlock>
              <Pressable
                accessibilityRole="button"
                android_ripple={{ color: alpha(C.accent, 0.15) }}
                onPress={applyThemeToAll}
                style={({ pressed }) => [
                  styles.applyAll,
                  { borderTopColor: C.borderMuted },
                  PLATFORM === "ios" && pressed && { opacity: 0.6 },
                ]}
              >
                <AppIcon
                  name={appliedAll ? "checkmark-circle" : "color-palette-outline"}
                  size={18}
                  color={appliedAll ? C.green : C.accent}
                />
                <Text
                  allowFontScaling={false}
                  style={[
                    styles.applyAllText,
                    { color: appliedAll ? C.green : C.accent },
                  ]}
                >
                  {appliedAll
                    ? i18nText(
                        "autoI18n.widget_apply_all_done",
                        "Tüm widget’lara uygulandı",
                      )
                    : i18nText(
                        "autoI18n.widget_apply_all",
                        "Temayı tüm widget’lara uygula",
                      )}
                </Text>
              </Pressable>
            </ControlCard>

            <SectionLabel color={C.muted}>
              {i18nText("autoI18n.widget_section_layout", "DÜZEN")}
            </SectionLabel>
            <ControlCard colors={C} platform={PLATFORM}>
              <ControlBlock
                first
                colors={C}
                title={i18nText("autoI18n.widget_density", "İçerik yoğunluğu")}
                hint={i18nText(
                  "autoI18n.widget_density_hint",
                  "Kompakt daha sıkı aralık kullanır",
                )}
              >
                <Segmented
                  platform={PLATFORM}
                  colors={C}
                  value={settings.density}
                  onChange={(density) => patchActive({ density })}
                  options={densityOptions}
                />
              </ControlBlock>
              <ToggleRow
                last
                colors={C}
                platform={PLATFORM}
                icon="text-outline"
                title={i18nText(
                  "autoI18n.widget_show_title",
                  "Widget başlığını göster",
                )}
                subtitle={i18nText(
                  "autoI18n.widget_show_title_description",
                  "Logo ve bölüm adını üst alanda tutar",
                )}
                value={settings.showTitle}
                onChange={(showTitle) => patchActive({ showTitle })}
              />
            </ControlCard>

            <SectionLabel color={C.muted}>
              {i18nText("autoI18n.widget_section_content", "İÇERİK")} ·{" "}
              {widgetLabel(activeWidget).toUpperCase()}
            </SectionLabel>
            <ControlCard colors={C} platform={PLATFORM}>
              <InfoNote colors={C}>{platformNote}</InfoNote>

              {activeWidget === "reminders" && (
                <>
                  <ControlBlock
                    colors={C}
                    title={i18nText(
                      "autoI18n.widget_content_filter",
                      "İçerik filtresi",
                    )}
                  >
                    <Segmented
                      platform={PLATFORM}
                      colors={C}
                      value={settings.content}
                      onChange={(content) => patchActive({ content })}
                      options={[
                        { value: "all", label: i18nText("autoI18n.tumu", "Tümü") },
                        { value: "movie", label: i18nText("autoI18n.film", "Film") },
                        { value: "tv", label: i18nText("autoI18n.dizi", "Dizi") },
                      ]}
                    />
                  </ControlBlock>
                  {caps.reminderLimit && (
                    <ControlBlock
                      colors={C}
                      title={i18nText(
                        "autoI18n.widget_item_limit",
                        "Gösterilecek öğe",
                      )}
                    >
                      <Segmented
                        platform={PLATFORM}
                        colors={C}
                        value={settings.maxItems}
                        onChange={(maxItems) => patchActive({ maxItems })}
                        options={[
                          ...new Set([settings.maxItems, ...REMINDER_LIMIT_OPTIONS]),
                        ].map((value) => ({ value, label: String(value) }))}
                      />
                    </ControlBlock>
                  )}
                  <ToggleRow
                    colors={C}
                    platform={PLATFORM}
                    icon={
                      caps.reminderArtwork === "badge"
                        ? "pricetag-outline"
                        : "image-outline"
                    }
                    title={
                      caps.reminderArtwork === "badge"
                        ? i18nText("autoI18n.widget_show_badge", "Tür rozetini göster")
                        : i18nText("autoI18n.widget_show_posters", "Posterleri göster")
                    }
                    subtitle={
                      caps.reminderArtwork === "badge"
                        ? i18nText(
                            "autoI18n.widget_show_badge_description",
                            "Film ve dizi satırlarının başında küçük rozet",
                          )
                        : undefined
                    }
                    value={settings.showPosters}
                    onChange={(showPosters) => patchActive({ showPosters })}
                  />
                  <ToggleRow
                    last
                    colors={C}
                    platform={PLATFORM}
                    icon="calendar-outline"
                    title={i18nText("autoI18n.widget_show_dates", "Tarihleri göster")}
                    value={settings.showDates}
                    onChange={(showDates) => patchActive({ showDates })}
                  />
                </>
              )}

              {activeWidget === "lists" && (
                <>
                  {caps.listsPosterLimit && (
                    <ControlBlock
                      colors={C}
                      title={i18nText(
                        "autoI18n.widget_poster_limit",
                        "Widget başına poster",
                      )}
                    >
                      <Segmented
                        platform={PLATFORM}
                        colors={C}
                        value={settings.maxPosters}
                        onChange={(maxPosters) => patchActive({ maxPosters })}
                        options={[
                          ...new Set([settings.maxPosters, ...POSTER_LIMIT_OPTIONS]),
                        ].map((value) => ({ value, label: String(value) }))}
                      />
                    </ControlBlock>
                  )}
                  <ToggleRow
                    last={!caps.listsNavigation}
                    colors={C}
                    platform={PLATFORM}
                    icon="calculator-outline"
                    title={i18nText(
                      "autoI18n.widget_show_count",
                      "İçerik sayısını göster",
                    )}
                    value={settings.showCount}
                    onChange={(showCount) => patchActive({ showCount })}
                  />
                  {caps.listsNavigation && (
                    <ToggleRow
                      last
                      colors={C}
                      platform={PLATFORM}
                      icon="swap-horizontal-outline"
                      title={i18nText(
                        "autoI18n.widget_show_navigation",
                        "Liste geçişini göster",
                      )}
                      subtitle={i18nText(
                        "autoI18n.widget_show_navigation_description",
                        "Önceki ve sonraki liste düğmeleri",
                      )}
                      value={settings.showNavigation}
                      onChange={(showNavigation) => patchActive({ showNavigation })}
                    />
                  )}
                </>
              )}

              {activeWidget === "stats" && (
                <>
                  <ToggleRow
                    colors={C}
                    platform={PLATFORM}
                    icon="film-outline"
                    title={i18nText("autoI18n.widget_movie_stats", "Film istatistikleri")}
                    value={settings.showMovies}
                    onChange={(showMovies) => patchActive({ showMovies })}
                  />
                  <ToggleRow
                    colors={C}
                    platform={PLATFORM}
                    icon="tv-outline"
                    title={i18nText("autoI18n.widget_tv_stats", "Dizi istatistikleri")}
                    value={settings.showTv}
                    onChange={(showTv) => patchActive({ showTv })}
                  />
                  <ToggleRow
                    last
                    colors={C}
                    platform={PLATFORM}
                    icon="time-outline"
                    title={i18nText(
                      "autoI18n.widget_duration_stats",
                      "Toplam süre şeridi",
                    )}
                    value={settings.showDuration}
                    onChange={(showDuration) => patchActive({ showDuration })}
                  />
                </>
              )}
            </ControlCard>

            <SectionLabel color={C.muted}>
              {i18nText("autoI18n.widget_section_help", "YARDIM")}
            </SectionLabel>
            <HowToCard colors={C} platform={PLATFORM} />

            <View style={styles.resetRow}>
              <Pressable
                accessibilityRole="button"
                android_ripple={{ color: alpha(C.accent, 0.15) }}
                onPress={resetActive}
                style={({ pressed }) => [
                  styles.resetButton,
                  { borderColor: C.border, backgroundColor: C.card },
                  PLATFORM === "ios" && pressed && { opacity: 0.6 },
                ]}
              >
                <AppIcon name="refresh-outline" size={17} color={C.muted} />
                <Text
                  allowFontScaling={false}
                  style={[styles.resetText, { color: C.muted }]}
                >
                  {i18nText("autoI18n.widget_reset_one", "Bu widget’ı sıfırla")}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => setConfirmReset(true)}
                hitSlop={8}
                style={styles.resetAll}
              >
                <Text
                  allowFontScaling={false}
                  style={[styles.resetAllText, { color: C.danger }]}
                >
                  {i18nText("autoI18n.widget_reset_all", "Tüm widget’ları sıfırla")}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
          {/* Ayarlar sabit önizlemenin altına sert bir çizgiyle girmesin: üstte yumuşak geçiş. */}
          <LinearGradient
            pointerEvents="none"
            colors={[C.bg, alpha(C.bg, 0)]}
            style={styles.topFade}
          />
        </View>
      </View>

      <ConfirmSheet
        visible={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={handleResetAll}
        icon="refresh-outline"
        title={i18nText(
          "autoI18n.widget_reset_all_title",
          "Tüm widget’lar sıfırlansın mı?",
        )}
        message={i18nText(
          "autoI18n.widget_reset_all_message",
          "Üç widget’ın tema, yoğunluk ve içerik ayarları varsayılana döner.",
        )}
        confirmLabel={i18nText("autoI18n.widget_reset_confirm", "Sıfırla")}
      />
    </SettingsSubScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  loading: { paddingTop: 80, alignItems: "center" },
  // Sabit önizleme bölgesi: seçici + sahne.
  pinned: { gap: 10, paddingTop: 4, paddingBottom: 6 },
  content: { paddingBottom: 110 },
  topFade: { position: "absolute", top: 0, left: 0, right: 0, height: 14 },
  applyAll: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 52,
    borderTopWidth: 1,
  },
  applyAllText: { fontSize: 14, fontWeight: "700" },
  resetRow: { marginTop: 22, gap: 6, alignItems: "stretch" },
  resetButton: {
    borderWidth: 1,
    borderRadius: 16,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    overflow: "hidden",
  },
  resetText: { fontSize: 14, fontWeight: "700" },
  resetAll: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  resetAllText: { fontSize: 13, fontWeight: "600" },
});
