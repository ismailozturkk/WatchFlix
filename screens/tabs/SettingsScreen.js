import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  PanResponder,
  ActivityIndicator,
} from "react-native";
import axios from "axios";
import { useNavigation } from "@react-navigation/native";
import { useLanguage } from "../../context/LanguageContext";
import AppIcon from "../../components/AppIcon";
import { useTheme } from "../../context/ThemeContext";
import SettingsTheme from "./setting/SettingsTheme";
import {
  useContentSettings,
  useImageQualitySettings,
  useOngoingTvShowsSettings,
  useHapticsSettings,
  useNotificationSettings,
  useAutoDataCacheSettings,
  useStreamingProviderSettings,
  STREAMING_PROVIDERS,
  useApiSettings,
} from "../../context/AppSettingsContext";
import { useDeviceNotifications } from "../../context/DeviceNotificationsContext";
import SwitchToggle from "@components/SwitchToggle";
import SwipeCard from "@components/SwipeCard";
import PetSettingsSection from "@components/pet/PetSettingsSection";
import PermissionsSection from "@components/PermissionsSection";
import BatteryOptimizationNotice from "@components/BatteryOptimizationNotice";
import { BlurView } from "expo-blur";
import CountryFlag from "react-native-country-flag";
import IconBacground from "../../components/IconBacground";
import ScreenSnow from "../../components/ScreenSnow";
import { alpha } from "../../theme/colors";
import { i18nText } from "../../utils/i18nText";
import { appAlert } from "@components/AppAlert";
import { Image } from "expo-image";
import TmdbLogo from "../../components/TmdbLogo";
import { getCachedValue, setCachedValue, TTL } from "../../utils/apiCache";

const LANGUAGES = [
  { code: "tr", name: "Türkçe", nativeName: "Türkçe", flag: "tr" },
  { code: "en", name: "English", nativeName: "English", flag: "us" },
];

const IMAGE_QUALITIES = [
  { labelKey: "imageQualityLow", value: "low" },
  { labelKey: "imageQualityMedium", value: "medium" },
  { labelKey: "imageQualityGood", value: "good" },
  { labelKey: "imageQualityHigh", value: "high" },
  { labelKey: "imageQualityOriginal", value: "original" },
];

const REMINDER_NOTIFICATION_TIMINGS = [
  { labelKey: "onReleaseDay", value: 0 },
  { labelKey: "oneDayBefore", value: 1 },
  { labelKey: "threeDaysBefore", value: 3 },
  { labelKey: "oneWeekBefore", value: 7 },
];

const NOTIFICATION_ROWS = [
  {
    key: "friendRequestsEnabled",
    titleKey: "friendRequestNotifications",
    subtitleKey: "friendRequestNotificationsSubtitle",
    iconName: "person-add-outline",
    colorKey: "blue",
    bgKey: "iconBlue",
  },
  {
    key: "friendAcceptedEnabled",
    titleKey: "friendAcceptedNotifications",
    subtitleKey: "friendAcceptedNotificationsSubtitle",
    iconName: "people-outline",
    colorKey: "green",
    bgKey: "iconGreen",
  },
  {
    key: "messagesEnabled",
    titleKey: "messageNotifications",
    subtitleKey: "messageNotificationsSubtitle",
    iconName: "chatbubble-ellipses-outline",
    colorKey: "teal",
    bgKey: "iconTeal",
  },
  {
    key: "postLikesEnabled",
    titleKey: "postLikeNotifications",
    subtitleKey: "postLikeNotificationsSubtitle",
    iconName: "heart-outline",
    colorKey: "amber",
    bgKey: "iconAmber",
  },
  {
    key: "postCommentsEnabled",
    titleKey: "postCommentNotifications",
    subtitleKey: "postCommentNotificationsSubtitle",
    iconName: "chatbox-outline",
    colorKey: "purple",
    bgKey: "iconPurple",
  },
  {
    key: "mentionsEnabled",
    titleKey: "mentionNotifications",
    subtitleKey: "mentionNotificationsSubtitle",
    iconName: "at-outline",
    colorKey: "blue",
    bgKey: "iconBlue",
  },
];

function buildUiColors(theme) {
  return {
    bg: theme.primary,
    card: theme.secondary,
    cardAlt: theme.between,
    border: theme.border,
    borderMuted: alpha(theme.border, 0.55),
    text: theme.text.primary,
    muted: theme.text.muted,
    accent: theme.accent,
    accentStrong: theme.bold,
    accentDim: alpha(theme.accent, 0.16),
    danger: theme.colors.red,
    dangerDim: alpha(theme.colors.red, 0.12),
    blue: theme.colors.blue,
    purple: theme.colors.purple,
    green: theme.colors.green,
    amber: theme.colors.orange,
    teal: theme.accent,
    iconBlue: alpha(theme.colors.blue, 0.14),
    iconPurple: alpha(theme.colors.purple, 0.14),
    iconGreen: alpha(theme.colors.green, 0.14),
    iconAmber: alpha(theme.colors.orange, 0.14),
    iconTeal: alpha(theme.accent, 0.14),
    white: "#FFFFFF",
    handle: alpha(theme.text.muted, 0.45),
    closeBg: alpha(theme.border, 0.7),
  };
}

function SectionLabel({ children, color }) {
  return (
    <Text allowFontScaling={false} style={[s.sectionLabel, { color }]}>
      {children}
    </Text>
  );
}

function Chevron({ color }) {
  return <AppIcon family="Ionicons" name="chevron-forward" size={14} color={color} />;
}

function SettingRow({
  colors,
  iconBg,
  iconColor,
  iconName,
  iconFamily = "Ionicons",
  title,
  subtitle,
  right,
  onPress,
  danger,
  last,
}) {
  return (
    <TouchableOpacity
      style={[
        s.row,
        { borderBottomColor: colors.borderMuted },
        last && { borderBottomWidth: 0 },
      ]}
      onPress={onPress}
      activeOpacity={0.65}
    >
      <View style={s.rowLeft}>
        <View style={[s.iconWrap, { backgroundColor: iconBg }]}>
          <AppIcon family={iconFamily} name={iconName} size={15} color={iconColor} />
        </View>
        <View style={s.rowTexts}>
          <Text
            allowFontScaling={false}
            style={[s.rowTitle, { color: danger ? colors.danger : colors.text }]}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text allowFontScaling={false} style={[s.rowSub, { color: colors.muted }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={s.rowRight}>{right}</View>
    </TouchableOpacity>
  );
}

// İkon saydamlık çarpanı için hafif kaydırıcı (0.1–1). Ek bağımlılık yok — PanResponder.
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
      style={[s.opacityTrack, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}
      hitSlop={{ top: 12, bottom: 12 }}
    >
      <View
        style={[s.opacityFill, { width: ratio * trackW, backgroundColor: colors.accent }]}
      />
      <View
        style={[
          s.opacityThumb,
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

export default function SettingsScreen() {
  const navigation = useNavigation();
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [langSearch, setLangSearch] = useState("");
  const [providerModalVisible, setProviderModalVisible] = useState(false);
  const [providerSearch, setProviderSearch] = useState("");
  const [providerCatalog, setProviderCatalog] = useState(
    STREAMING_PROVIDERS.map((provider, index) => ({
      id: provider.id,
      name: provider.name,
      logoPath: null,
      priority: index,
    })),
  );
  const [providerCatalogLoading, setProviderCatalogLoading] = useState(true);

  const { t, language, toggleLanguage } = useLanguage();
  const { theme } = useTheme();
  const { adultContent, chaneAdultContent } = useContentSettings();
  const { showOngoingTvShows, changeShowOngoingTvShows } =
    useOngoingTvShowsSettings();
  const { imageQuality, imageQualityLevel, changeImageQuality, getTmdbUrl } =
    useImageQualitySettings();
  const { API_KEY } = useApiSettings();
  const { hapticsEnabled, changeHapticsEnabled } = useHapticsSettings();
  const {
    notificationSettings,
    changeNotificationSettings,
  } = useNotificationSettings();
  const {
    autoDataCacheEnabled,
    changeAutoDataCacheEnabled,
  } = useAutoDataCacheSettings();
  const { permissionStatus, requestPermission } = useDeviceNotifications();
  const { streamingProviderIds, changeStreamingProviderIds } =
    useStreamingProviderSettings();

  useEffect(() => {
    let active = true;
    const tmdbLanguage = language === "tr" ? "tr-TR" : "en-US";
    const tmdbRegion = language === "tr" ? "TR" : "US";
    const cacheKey = `settings_provider_catalog_${tmdbLanguage}_${tmdbRegion}`;

    const applyCatalog = (rawProviders) => {
      const merged = new Map();
      for (const provider of rawProviders || []) {
        if (!provider?.provider_id) continue;
        const current = merged.get(provider.provider_id);
        merged.set(provider.provider_id, {
          id: provider.provider_id,
          name: provider.provider_name,
          logoPath: provider.logo_path || current?.logoPath || null,
          priority: Math.min(
            Number(provider.display_priority ?? 9999),
            Number(current?.priority ?? 9999),
          ),
        });
      }
      return [...merged.values()].sort(
        (a, b) => a.priority - b.priority || a.name.localeCompare(b.name),
      );
    };

    const loadProviderCatalog = async () => {
      setProviderCatalogLoading(true);
      try {
        const cached = await getCachedValue(cacheKey, TTL.PROVIDERS);
        if (cached?.length) {
          if (active) setProviderCatalog(cached);
          return;
        }
        const headers = { accept: "application/json", Authorization: API_KEY };
        const [movieResponse, tvResponse] = await Promise.all([
          axios.get("https://api.themoviedb.org/3/watch/providers/movie", {
            params: { language: tmdbLanguage, watch_region: tmdbRegion },
            headers,
          }),
          axios.get("https://api.themoviedb.org/3/watch/providers/tv", {
            params: { language: tmdbLanguage, watch_region: tmdbRegion },
            headers,
          }),
        ]);
        const next = applyCatalog([
          ...(movieResponse.data.results || []),
          ...(tvResponse.data.results || []),
        ]);
        if (next.length && active) setProviderCatalog(next);
        if (next.length) setCachedValue(cacheKey, next);
      } catch (error) {
        if (__DEV__) console.error("Settings provider catalog:", error?.message || error);
      } finally {
        if (active) setProviderCatalogLoading(false);
      }
    };

    loadProviderCatalog();
    return () => {
      active = false;
    };
  }, [API_KEY, language]);

  const C = buildUiColors(theme);

  const filteredLanguages = LANGUAGES.filter(
    (l) =>
      l.name.toLowerCase().includes(langSearch.toLowerCase()) ||
      l.nativeName.toLowerCase().includes(langSearch.toLowerCase()),
  );
  const currentLang =
    LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];

  const handleSelectLanguage = (code) => {
    toggleLanguage(code);
    setLangModalVisible(false);
    setLangSearch("");
  };

  const currentQualityLabel =
    t[IMAGE_QUALITIES.find((q) => q.value === imageQualityLevel)?.labelKey] ?? "—";
  const notificationsEnabled = notificationSettings.enabled;
  const remindersEnabled =
    notificationsEnabled && notificationSettings.remindersEnabled;
  const selectedProviderNames = providerCatalog
    .filter((provider) => streamingProviderIds.includes(provider.id))
    .map((provider) => provider.name);
  const providerSummary = streamingProviderIds.length
    ? selectedProviderNames.length
      ? selectedProviderNames.join(", ")
      : language === "tr"
        ? `${streamingProviderIds.length} platform seçili`
        : `${streamingProviderIds.length} services selected`
    : language === "tr"
      ? "Henüz platform seçilmedi"
      : "No services selected yet";

  const filteredProviders = useMemo(() => {
    const query = providerSearch.trim().toLocaleLowerCase(
      language === "tr" ? "tr-TR" : "en-US",
    );
    return providerCatalog
      .filter((provider) =>
        query
          ? provider.name
              .toLocaleLowerCase(language === "tr" ? "tr-TR" : "en-US")
              .includes(query)
          : true,
      )
      .sort((a, b) => {
        const aSelected = streamingProviderIds.includes(a.id) ? 1 : 0;
        const bSelected = streamingProviderIds.includes(b.id) ? 1 : 0;
        return bSelected - aSelected || a.priority - b.priority;
      });
  }, [language, providerCatalog, providerSearch, streamingProviderIds]);

  const toggleStreamingProvider = (providerId) => {
    changeStreamingProviderIds(
      streamingProviderIds.includes(providerId)
        ? streamingProviderIds.filter((id) => id !== providerId)
        : [...streamingProviderIds, providerId],
    );
  };

  const updateNotifications = (patch) => {
    changeNotificationSettings(patch);
  };

  // Ana anahtar açılınca OS bildirim iznini iste; reddedilirse yönlendir.
  const handleToggleMaster = async (enabled) => {
    updateNotifications({ enabled });
    if (enabled && permissionStatus !== "granted") {
      const granted = await requestPermission();
      if (!granted) {
        appAlert(t.notifPermissionTitle, t.notifPermissionMessage);
      }
    }
  };

  const masterSubtitle =
    notificationsEnabled && permissionStatus === "denied"
      ? t.notifPermissionDenied
      : t.allNotificationsSubtitle;

  return (
    <View style={[s.root, { backgroundColor: C.bg }]}>
      <IconBacground opacity={0.15} />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text allowFontScaling={false} style={[s.pageTitle, { color: C.text }]}>
          {t.settings}
        </Text>

        <SectionLabel color={C.muted}>{t.language.toUpperCase()}</SectionLabel>
        <TouchableOpacity
          style={[s.langCard, { backgroundColor: C.card, borderColor: C.border }]}
          onPress={() => {
            setLangSearch("");
            setLangModalVisible(true);
          }}
          activeOpacity={0.7}
        >
          <View style={s.langLeft}>
            <View style={[s.iconWrap, { backgroundColor: C.iconBlue }]}>
              <AppIcon name="language-outline" size={16} color={C.blue} />
            </View>
            <View>
              <Text allowFontScaling={false} style={[s.langSubLabel, { color: C.muted }]}>
                {t.language.toUpperCase()}
              </Text>
              <Text allowFontScaling={false} style={[s.langValue, { color: C.text }]}>
                {currentLang.nativeName}
              </Text>
            </View>
          </View>
          <View style={s.langRight}>
            <View style={[s.flagWrap, { borderColor: C.border }]}>
              <CountryFlag
                isoCode={currentLang.flag}
                size={24}
                style={{ borderRadius: 5 }}
              />
            </View>
            <Chevron color={C.muted} />
          </View>
        </TouchableOpacity>

        <SectionLabel color={C.muted}>{t.theme.toUpperCase()}</SectionLabel>
        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          {/* Ayrı "Görünüm" başlık satırı kaldırıldı — SettingsTheme'in kendi
              "Aktif tema" özet satırı bu görevi üstleniyor. */}
          <SettingsTheme />
        </View>

        <SectionLabel color={C.muted}>{t.quality.toUpperCase()}</SectionLabel>
        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={s.qualityHeader}>
            <View style={[s.iconWrap, { backgroundColor: C.iconPurple }]}>
              <AppIcon family="MaterialIcons" name="high-quality" size={16} color={C.purple} />
            </View>
            <View style={{ flex: 1 }}>
              <Text allowFontScaling={false} style={[s.rowTitle, { color: C.text }]}>
                {t.posterQuality}
              </Text>
              <Text allowFontScaling={false} style={[s.rowSub, { color: C.muted }]}>
                {currentQualityLabel} · poster:{imageQuality.poster} · backdrop:
                {imageQuality.backdrop}
              </Text>
            </View>
            <View style={[s.qualityBadge, { backgroundColor: C.accentDim }]}>
              <Text
                allowFontScaling={false}
                style={[s.qualityBadgeText, { color: C.accentStrong }]}
              >
                {currentQualityLabel}
              </Text>
            </View>
          </View>
          <View
            style={[
              s.segment,
              { backgroundColor: C.cardAlt, borderTopColor: C.border },
            ]}
          >
            {IMAGE_QUALITIES.map((q) => {
              const active = imageQualityLevel === q.value;
              return (
                <TouchableOpacity
                  key={q.value}
                  style={[s.segOpt, active && { backgroundColor: C.accent }]}
                  onPress={() => changeImageQuality(q.value)}
                  activeOpacity={0.7}
                >
                  <Text
                    allowFontScaling={false}
                    style={[
                      s.segText,
                      { color: active ? C.white : C.muted, fontWeight: active ? "700" : "500" },
                    ]}
                  >
                    {t[q.labelKey]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <SectionLabel color={C.muted}>
          {(language === "tr" ? "İZLEME PLATFORMLARIM" : "MY STREAMING SERVICES")}
        </SectionLabel>
        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <SettingRow
            colors={C}
            iconBg={C.iconTeal}
            iconColor={C.teal}
            iconName="play-circle-outline"
            title={language === "tr" ? "Platform üyeliklerim" : "My subscriptions"}
            subtitle={providerSummary}
            onPress={() => {
              setProviderSearch("");
              setProviderModalVisible(true);
            }}
            last
            right={
              <View style={s.providerCountWrap}>
                {streamingProviderIds.length > 0 && (
                  <View style={[s.providerCount, { backgroundColor: C.accentDim }]}>
                    <Text style={[s.providerCountText, { color: C.accent }]}>
                      {streamingProviderIds.length}
                    </Text>
                  </View>
                )}
                <Chevron color={C.muted} />
              </View>
            }
          />
        </View>

        <SectionLabel color={C.muted}>{t.general.toUpperCase()}</SectionLabel>
        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <SettingRow
            colors={C}
            iconBg={C.iconAmber}
            iconColor={C.amber}
            iconName="cloud-download-outline"
            title={t.downloadData}
            subtitle={t.downloadDataSubtitle}
            right={
              <SwitchToggle
                value={autoDataCacheEnabled}
                onValueChange={changeAutoDataCacheEnabled}
                size={36}
              />
            }
          />
          <SettingRow
            colors={C}
            iconBg={C.iconPurple}
            iconColor={C.purple}
            iconName={adultContent ? "eye-outline" : "eye-off-outline"}
            title={t.adultContent}
            subtitle={t.adultContentSubtitle}
            right={
              <SwitchToggle
                value={adultContent}
                onValueChange={() => chaneAdultContent(!adultContent)}
                size={36}
              />
            }
          />
          <SettingRow
            colors={C}
            iconBg={C.iconGreen}
            iconColor={C.green}
            iconName={showOngoingTvShows ? "play-circle-outline" : "pause-circle-outline"}
            title={t.showOngoingTvShows}
            subtitle={t.showOngoingTvShowsSubtitle}
            right={
              <SwitchToggle
                value={showOngoingTvShows}
                onValueChange={changeShowOngoingTvShows}
                size={36}
              />
            }
          />
          <SettingRow
            colors={C}
            iconBg={C.iconAmber}
            iconColor={C.amber}
            iconName={hapticsEnabled ? "phone-portrait-outline" : "phone-portrait"}
            title={t.haptics}
            subtitle={t.hapticsSubtitle}
            last
            right={
              <SwitchToggle
                value={hapticsEnabled}
                onValueChange={changeHapticsEnabled}
                size={36}
              />
            }
          />
        </View>

        {/* Kişiselleştirme: kar + ikon arka planı + pet aynı alanda toplandı */}
        {/* Genel'in altındaki yönlendirme grubu → ayrı ayar ekranları */}
        <SectionLabel color={C.muted}>
          {i18nText("autoI18n.dahaFazla", "Daha fazla").toUpperCase()}
        </SectionLabel>
        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <SettingRow
            colors={C}
            iconBg={C.iconBlue}
            iconColor={C.blue}
            iconName="person-circle-outline"
            title={language === "tr" ? "Hesap bağlantıları" : "Account connections"}
            subtitle={
              language === "tr"
                ? "Google, Apple ve parola yöntemleri"
                : "Google, Apple and password methods"
            }
            onPress={() => navigation.navigate("AccountConnectionsScreen")}
            right={<Chevron color={C.muted} />}
          />
          <SettingRow
            colors={C}
            iconBg={C.iconGreen}
            iconColor={C.green}
            iconName="alarm-outline"
            title={t.reminderNotificationGroup}
            subtitle={i18nText(
              "autoI18n.hatirlaticilar_aciklama",
              "Film ve dizi hatırlatmaları, bildirim zamanı",
            )}
            onPress={() => navigation.navigate("ReminderNotificationsScreen")}
            right={<Chevron color={C.muted} />}
          />
          <SettingRow
            colors={C}
            iconBg={C.iconAmber}
            iconColor={C.amber}
            iconName="chatbubbles-outline"
            title={t.socialNotificationGroup}
            subtitle={i18nText(
              "autoI18n.sosyal_mesajlar_aciklama",
              "Arkadaşlık, beğeni, yorum ve mesaj bildirimleri",
            )}
            onPress={() => navigation.navigate("SocialNotificationsScreen")}
            right={<Chevron color={C.muted} />}
          />
          <SettingRow
            colors={C}
            iconBg={C.iconTeal}
            iconColor={C.teal}
            iconName="color-palette-outline"
            title={t.personalization}
            subtitle={i18nText(
              "autoI18n.kisisellestirme_aciklama",
              "Kar efekti, ikon arka planı ve pet",
            )}
            onPress={() => navigation.navigate("PersonalizationScreen")}
            right={<Chevron color={C.muted} />}
          />
          <SettingRow
            colors={C}
            iconBg={C.iconPurple}
            iconColor={C.purple}
            iconName="images-outline"
            title={i18nText("autoI18n.poster_gorunumu", "Poster görünümü")}
            subtitle={i18nText("autoI18n.poster_gorunumu_aciklama", "Afiş boyutu, köşeler ve düzen")}
            onPress={() => navigation.navigate("PosterSettingsScreen")}
            right={<Chevron color={C.muted} />}
          />
          <SettingRow
            colors={C}
            iconBg={C.iconBlue}
            iconColor={C.blue}
            iconName="shield-checkmark-outline"
            title={i18nText("autoI18n.izinlerVeVeriler", "İzinler & Veriler")}
            subtitle={i18nText(
              "autoI18n.izinler_veriler_aciklama",
              "Cihaz izinleri, çevrimdışı veri ve önbellek",
            )}
            last
            onPress={() => navigation.navigate("PermissionsDataScreen")}
            right={<Chevron color={C.muted} />}
          />
        </View>

        <SwipeCard>
          <SectionLabel color={C.muted}>{t.about.toUpperCase()}</SectionLabel>
          <View
            style={[
              s.aboutCard,
              { backgroundColor: C.card, borderColor: C.border },
            ]}
          >
            <View
              style={[
                s.appIcon,
                {
                  borderColor: C.border,
                },
              ]}
            >
              <Image
                source={require("../../assets/android-icon-foreground.png")}
                style={{ width: 50, height: 50 }}
                contentFit="contain"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text allowFontScaling={false} style={[s.aboutName, { color: C.text }]}>
                Watchify
              </Text>
              <Text allowFontScaling={false} style={[s.aboutMeta, { color: C.muted }]}>
                created by ismail ozturk · © 2025
              </Text>
              {/* TMDB koşulları: zorunlu atıf cümlesi + resmi logo birlikte */}
              <TmdbLogo width={72} style={{ marginTop: 8 }} />
              <Text
                allowFontScaling={false}
                style={[s.aboutMeta, { marginTop: 4, fontSize: 10, color: C.muted }]}
              >
                {t.tmdbAttribution}
              </Text>
              <Text
                allowFontScaling={false}
                style={[s.aboutMeta, { marginTop: 2, fontSize: 10, color: C.muted }]}
              >
                {t.justwatchAttribution}
              </Text>
            </View>
            <View style={[s.versionBadge, { backgroundColor: C.borderMuted }]}>
              <Text
                allowFontScaling={false}
                style={[s.versionText, { color: C.text }]}
              >
                v1.21.1
              </Text>
            </View>
          </View>
        </SwipeCard>

        <Modal
          animationType="slide"
          transparent
          visible={providerModalVisible}
          onRequestClose={() => {
            setProviderModalVisible(false);
            setProviderSearch("");
          }}
        >
          <View style={s.sheetOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => {
                setProviderModalVisible(false);
                setProviderSearch("");
              }}
            />
            <BlurView
              tint="dark"
              intensity={40}
              experimentalBlurMethod="dimezisBlurView"
              style={StyleSheet.absoluteFill}
            />
            <View
              style={[
                s.sheet,
                s.providerSheet,
                { backgroundColor: C.card, borderColor: C.border },
              ]}
            >
              <View style={[s.sheetHandle, { backgroundColor: C.handle }]} />
              <View style={s.sheetHeader}>
                <View style={s.sheetTitleRow}>
                  <AppIcon name="play-circle-outline" size={20} color={C.text} />
                  <Text allowFontScaling={false} style={[s.sheetTitle, { color: C.text }]}>
                    {language === "tr" ? "Platform üyeliklerim" : "My subscriptions"}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[s.closeBtn, { backgroundColor: C.closeBg }]}
                  onPress={() => {
                    setProviderModalVisible(false);
                    setProviderSearch("");
                  }}
                >
                  <AppIcon name="close" size={16} color={C.muted} />
                </TouchableOpacity>
              </View>
              <Text allowFontScaling={false} style={[s.providerHelp, { color: C.muted }]}>
                {language === "tr"
                  ? "Üyesi olduğun servisleri seç. Film ve dizi ana ekranlarında sana özel bir alan oluşturulur."
                  : "Choose the services you subscribe to. A personalized rail will appear on movie and TV home screens."}
              </Text>
              <View
                style={[
                  s.providerSearchBox,
                  { backgroundColor: C.cardAlt, borderColor: C.border },
                ]}
              >
                <AppIcon name="search-outline" size={17} color={C.muted} />
                <TextInput
                  allowFontScaling={false}
                  style={[s.providerSearchInput, { color: C.text }]}
                  placeholder={
                    language === "tr" ? "Platform ara..." : "Search services..."
                  }
                  placeholderTextColor={C.muted}
                  value={providerSearch}
                  onChangeText={setProviderSearch}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                {providerSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setProviderSearch("")}>
                    <AppIcon name="close-circle" size={17} color={C.muted} />
                  </TouchableOpacity>
                )}
              </View>
              <View style={s.providerListMeta}>
                <Text style={[s.providerListMetaText, { color: C.muted }]}>
                  {language === "tr"
                    ? `${filteredProviders.length} platform`
                    : `${filteredProviders.length} services`}
                </Text>
                {streamingProviderIds.length > 0 && (
                  <TouchableOpacity onPress={() => changeStreamingProviderIds([])}>
                    <Text style={[s.providerClearText, { color: C.accent }]}>
                      {language === "tr" ? "Seçimi temizle" : "Clear selection"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              {providerCatalogLoading ? (
                <View style={s.providerLoading}>
                  <ActivityIndicator size="small" color={C.accent} />
                </View>
              ) : (
                <FlatList
                  data={filteredProviders}
                  keyExtractor={(provider) => String(provider.id)}
                  numColumns={3}
                  style={s.providerList}
                  contentContainerStyle={s.providerListContent}
                  columnWrapperStyle={s.providerColumn}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  ListEmptyComponent={
                    <View style={s.providerEmpty}>
                      <AppIcon name="search-outline" size={26} color={C.muted} />
                      <Text style={[s.providerEmptyText, { color: C.muted }]}>
                        {language === "tr" ? "Platform bulunamadı" : "No services found"}
                      </Text>
                    </View>
                  }
                  renderItem={({ item: provider }) => {
                    const selected = streamingProviderIds.includes(provider.id);
                    return (
                      <TouchableOpacity
                        activeOpacity={0.75}
                        onPress={() => toggleStreamingProvider(provider.id)}
                        style={[
                          s.providerTile,
                          {
                            backgroundColor: selected ? C.accentDim : C.cardAlt,
                            borderColor: selected ? C.accent : C.border,
                          },
                        ]}
                      >
                        {provider.logoPath ? (
                          <Image
                            source={{ uri: getTmdbUrl(provider.logoPath, "logo", 92) }}
                            style={s.providerLogoImage}
                            contentFit="cover"
                            cachePolicy="memory-disk"
                          />
                        ) : (
                          <View style={[s.providerLogo, { backgroundColor: C.accent }]}>
                            <Text style={s.providerLogoText}>{provider.name.slice(0, 1)}</Text>
                          </View>
                        )}
                        <Text
                          allowFontScaling={false}
                          numberOfLines={2}
                          style={[s.providerName, { color: selected ? C.accent : C.text }]}
                        >
                          {provider.name}
                        </Text>
                        <View style={[s.providerSelectionIcon, { backgroundColor: C.card }]}>
                          <AppIcon
                            name={selected ? "checkmark-circle" : "ellipse-outline"}
                            size={18}
                            color={selected ? C.accent : C.muted}
                          />
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                />
              )}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  setProviderModalVisible(false);
                  setProviderSearch("");
                }}
                style={[s.providerDone, { backgroundColor: C.accent }]}
              >
                <Text style={s.providerDoneText}>
                  {language === "tr" ? "Tamam" : "Done"}
                </Text>
              </TouchableOpacity>
              <Text allowFontScaling={false} style={[s.providerAttribution, { color: C.muted }]}>
                Watch provider data by JustWatch
              </Text>
            </View>
          </View>
        </Modal>

        <Modal
          animationType="slide"
          transparent
          visible={langModalVisible}
          onRequestClose={() => {
            setLangModalVisible(false);
            setLangSearch("");
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
          >
            <View style={s.sheetOverlay}>
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                activeOpacity={1}
                onPress={() => {
                  setLangModalVisible(false);
                  setLangSearch("");
                }}
              />
              <BlurView
                tint="dark"
                intensity={40}
                experimentalBlurMethod="dimezisBlurView"
                style={StyleSheet.absoluteFill}
              />
              <View
                style={[
                  s.sheet,
                  { backgroundColor: C.card, borderColor: C.border },
                ]}
              >
                <View style={[s.sheetHandle, { backgroundColor: C.handle }]} />
                <View style={s.sheetHeader}>
                  <View style={s.sheetTitleRow}>
                    <AppIcon
                      name="language-outline"
                      size={20}
                      color={C.text}
                    />
                    <Text allowFontScaling={false} style={[s.sheetTitle, { color: C.text }]}>
                      {t.language}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[s.closeBtn, { backgroundColor: C.closeBg }]}
                    onPress={() => {
                      setLangModalVisible(false);
                      setLangSearch("");
                    }}
                  >
                    <AppIcon name="close" size={16} color={C.muted} />
                  </TouchableOpacity>
                </View>

                <View
                  style={[
                    s.searchBox,
                    { borderColor: C.border, backgroundColor: C.cardAlt },
                  ]}
                >
                  <AppIcon name="search-outline" size={16} color={C.muted} />
                  <TextInput
                    allowFontScaling={false}
                    style={[s.searchInput, { color: C.text }]}
                    placeholder={t.searchLanguage}
                    placeholderTextColor={C.muted}
                    value={langSearch}
                    onChangeText={setLangSearch}
                    autoCorrect={false}
                    autoCapitalize="none"
                  />
                  {langSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setLangSearch("")}>
                      <AppIcon name="close-circle" size={16} color={C.muted} />
                    </TouchableOpacity>
                  )}
                </View>

                <FlatList
                  data={filteredLanguages}
                  keyExtractor={(i) => i.code}
                  style={{ maxHeight: 320 }}
                  showsVerticalScrollIndicator={false}
                  ListEmptyComponent={
                    <View style={s.emptyContainer}>
                      <AppIcon
                        name="search-outline"
                        size={28}
                        color={C.muted}
                      />
                      <Text allowFontScaling={false} style={[s.emptyText, { color: C.muted }]}>
                        {t.languageNotFound}
                      </Text>
                    </View>
                  }
                  renderItem={({ item }) => {
                    const sel = item.code === language;
                    return (
                      <TouchableOpacity
                        style={[
                          s.langItem,
                          sel && {
                            backgroundColor: C.accentDim,
                            borderColor: C.accent,
                          },
                        ]}
                        onPress={() => handleSelectLanguage(item.code)}
                        activeOpacity={0.7}
                      >
                        <View style={s.langItemLeft}>
                          <CountryFlag
                            isoCode={item.flag}
                            size={28}
                            style={{ borderRadius: 6 }}
                          />
                          <View>
                            <Text
                              allowFontScaling={false}
                              style={[
                                s.langItemName,
                                { color: sel ? C.accent : C.text, fontWeight: sel ? "700" : "500" },
                              ]}
                            >
                              {item.nativeName}
                            </Text>
                            <Text allowFontScaling={false} style={[s.rowSub, { color: C.muted }]}>
                              {item.name}
                            </Text>
                          </View>
                        </View>
                        {sel && (
                          <AppIcon
                            name="checkmark-circle"
                            size={20}
                            color={C.accent}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  }}
                />
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </ScrollView>
      {/* Kar efekti — sabit overlay (scroll dışında), optimize ortak bileşen */}
      <ScreenSnow />
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingBottom: 110,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 40,
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  sectionLabel: {
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.2,
    marginBottom: 10,
    marginLeft: 4,
    marginTop: 22,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  personalizationGap: {
    height: 10,
  },
  iconBgMode: {
    paddingTop: 13,
  },
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
  iconBgSliderWrap: {
    paddingHorizontal: 16,
  },
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  rowTexts: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: "500",
  },
  rowSub: {
    fontSize: 11,
    marginTop: 2,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  providerCountWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  providerCount: { minWidth: 24, height: 24, paddingHorizontal: 7, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  providerCountText: { fontSize: 11, fontWeight: "800" },
  providerSheet: { maxHeight: "88%" },
  providerHelp: { fontSize: 12, lineHeight: 18, marginBottom: 12 },
  providerSearchBox: { height: 44, borderRadius: 13, borderWidth: 1, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 9 },
  providerSearchInput: { flex: 1, fontSize: 13, paddingVertical: 0 },
  providerListMeta: { minHeight: 36, paddingHorizontal: 2, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  providerListMetaText: { fontSize: 10.5, fontWeight: "600" },
  providerClearText: { fontSize: 11, fontWeight: "700" },
  providerList: { flexGrow: 0, maxHeight: 410 },
  providerListContent: { gap: 8, paddingBottom: 4 },
  providerColumn: { gap: 8 },
  providerLoading: { height: 180, alignItems: "center", justifyContent: "center" },
  providerEmpty: { height: 150, alignItems: "center", justifyContent: "center", gap: 8 },
  providerEmptyText: { fontSize: 12 },
  providerTile: { width: "31.7%", minHeight: 108, borderWidth: 1, borderRadius: 14, paddingHorizontal: 7, paddingVertical: 10, alignItems: "center", justifyContent: "center", gap: 7 },
  providerLogo: { width: 46, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  providerLogoImage: { width: 46, height: 46, borderRadius: 12, backgroundColor: "#FFFFFF" },
  providerLogoText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  providerName: { minHeight: 26, fontSize: 10.5, lineHeight: 13, fontWeight: "700", textAlign: "center" },
  providerSelectionIcon: { position: "absolute", top: 5, right: 5, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  providerDone: { height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 20 },
  providerDoneText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  providerAttribution: { textAlign: "center", fontSize: 9, marginTop: 10 },
  langCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  langLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },
  langSubLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.8,
  },
  langValue: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 2,
  },
  langRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  flagWrap: {
    borderRadius: 6,
    overflow: "hidden",
    borderWidth: 1,
  },
  qualityHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  qualityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  qualityBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  notificationTiming: {
    paddingTop: 13,
  },
  notificationTimingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  notificationTimingSegment: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  notificationGroup: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  notificationGroupText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
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
  segText: {
    fontSize: 11,
    textAlign: "center",
  },
  aboutCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  appIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    flexShrink: 0,
  },
  aboutName: {
    fontSize: 15,
    fontWeight: "600",
  },
  aboutMeta: {
    fontSize: 11.5,
    marginTop: 3,
  },
  versionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  versionText: {
    fontSize: 11,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalBox: {
    borderRadius: 22,
    padding: 28,
    marginHorizontal: 32,
    width: "85%",
    borderWidth: 1,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 16,
    textAlign: "center",
    fontWeight: "500",
    marginBottom: 22,
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  btnCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
  },
  btnConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  btnText: {
    fontWeight: "700",
    fontSize: 14,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 16,
    paddingBottom: 34,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sheetTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  langItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "transparent",
    marginBottom: 8,
  },
  langItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  langItemName: {
    fontSize: 15,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 30,
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
  },
});
