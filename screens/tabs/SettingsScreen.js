import React, { useEffect, useMemo, useState } from "react";
import { useTabBarLayout } from "../../context/TabBarLayoutContext";
import useTabBarScrollSync from "../../hooks/useTabBarScrollSync";
import { markTabScroll } from "../../components/navigation/TabScrollMarker";
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
  ActivityIndicator,
  Animated,
  InteractionManager,
} from "react-native";
import axios from "axios";
import { useNavigation } from "@react-navigation/native";
import { flushUserData } from "../../services/userData";
import { useLanguage } from "../../context/LanguageContext";
import AppIcon from "../../components/AppIcon";
import GlassCloseButton from "../../components/common/GlassCloseButton";
import { useTheme } from "../../context/ThemeContext";
import SettingsTheme from "./setting/SettingsTheme";
import {
  useContentSettings,
  useImageQualitySettings,
  useOngoingTvShowsSettings,
  useHapticsSettings,
  useAutoDataCacheSettings,
  useStreamingProviderSettings,
  STREAMING_PROVIDERS,
  useApiSettings,
} from "../../context/AppSettingsContext";
import SwitchToggle from "@components/SwitchToggle";
import SwipeCard from "@components/SwipeCard";
import ModalBlurBackdrop from "../../components/common/ModalBlurBackdrop";
import BottomSheetModal from "@components/common/BottomSheetModal";
import ConfirmSheet from "@components/common/ConfirmSheet";
import useSheetTransition from "@hooks/useSheetTransition";
import Constants from "expo-constants";
import CountryFlag from "react-native-country-flag";
import ScreenDecor from "../../components/ScreenDecor";
import { alpha } from "../../theme/colors";
import { i18nText } from "../../utils/i18nText";
import { appAlert } from "@components/AppAlert";
import { getAuth } from "firebase/auth";
import { Image } from "expo-image";
import TmdbLogo from "../../components/TmdbLogo";
import JustWatchLogo from "../../components/JustWatchLogo";
import { getCachedValue, setCachedValue, TTL } from "../../utils/apiCache";
import PremiumSettingsCard from "@components/settings/PremiumSettingsCard";
import DevPlanSimulatorCard from "@components/settings/DevPlanSimulatorCard";
import {
  DATA_TYPE_COUNT,
  buildAllTypes,
  countEnabledTypes,
  getDataTypeOptions,
} from "./settings/dataTypes";
import ImportDataModal from "../../components/import/ImportDataModal";
import useAppLogo from "@hooks/useAppLogo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tabTitleTopSpacing } from "../../utils/screenTopSpacing";

const APP_VERSION = `v${Constants.expoConfig?.version ?? "1.4.5"}`;

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

function SectionLabel({ children, color, first, style }) {
  return (
    <Text
      allowFontScaling={false}
      style={[
        s.sectionLabel,
        { color },
        first && s.firstSectionLabel,
        style,
      ]}
    >
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

/**
 * "Verileri indir" açıkken indirilecek veri türlerinin seçimi.
 * Ana anahtar kapalıyken hiç render edilmez — kapalıyken zaten hiçbir şey
 * indirilmediği için seçim de anlamsız olur.
 */
function DataTypePicker({ types, colors, onChange, onToggleAll }) {
  const options = getDataTypeOptions();
  const enabledCount = countEnabledTypes(types);
  const allEnabled = enabledCount === DATA_TYPE_COUNT;

  return (
    <View style={s.dataTypes}>
      <View style={s.dataTypesHeader}>
        <View style={{ flex: 1 }}>
          <Text allowFontScaling={false} style={[s.dataTypesTitle, { color: colors.text }]}>
            {i18nText("autoI18n.indirilecek_veri_turleri", "İndirilecek veri türleri")}
            {"  "}
            <Text style={{ color: colors.accent }}>
              {enabledCount}/{DATA_TYPE_COUNT}
            </Text>
          </Text>
          <Text allowFontScaling={false} style={[s.dataTypesSub, { color: colors.muted }]}>
            {i18nText(
              "autoI18n.indirilecek_veri_turleri_alt",
              "Kapalı tür ne otomatik indirilir ne de çevrimdışı saklanır",
            )}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => onToggleAll(!allEnabled)}
          activeOpacity={0.7}
          style={[s.dataTypesAction, { backgroundColor: colors.accentDim }]}
        >
          <Text allowFontScaling={false} style={[s.dataTypesActionText, { color: colors.accent }]}>
            {allEnabled
              ? i18nText("autoI18n.tumunu_kapat", "Tümünü kapat")
              : i18nText("autoI18n.tumunu_ac", "Tümünü aç")}
          </Text>
        </TouchableOpacity>
      </View>

      {enabledCount === 0 && (
        <Text allowFontScaling={false} style={[s.dataTypesWarn, { color: colors.danger }]}>
          {i18nText(
            "autoI18n.hicbir_veri_turu_secili_degil",
            "Hiçbir tür seçili değil — hiçbir veri çevrimdışı saklanmaz.",
          )}
        </Text>
      )}

      <View style={s.dataTypeGrid}>
        {options.map((opt) => {
          const enabled = types?.[opt.id] !== false;
          const tint = colors[opt.colorKey] || colors.accent;
          return (
            <TouchableOpacity
              key={opt.id}
              style={[
                s.dataTypeButton,
                {
                  backgroundColor: enabled ? alpha(tint, 0.14) : colors.cardAlt,
                  borderColor: enabled ? alpha(tint, 0.55) : colors.borderMuted,
                },
              ]}
              activeOpacity={0.72}
              onPress={() => onChange(opt.id, !enabled)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: enabled }}
              accessibilityLabel={opt.label}
            >
              <View
                style={[
                  s.dataTypeIcon,
                  { backgroundColor: enabled ? tint : colors.closeBg },
                ]}
              >
                <AppIcon
                  family="Ionicons"
                  name={opt.icon}
                  size={15}
                  color={enabled ? colors.white : colors.muted}
                />
              </View>
              <Text
                allowFontScaling={false}
                numberOfLines={2}
                style={[
                  s.dataTypeLabel,
                  { color: enabled ? colors.text : colors.muted },
                ]}
              >
                {opt.label}
              </Text>
              <View
                style={[
                  s.dataTypeCheck,
                  {
                    backgroundColor: enabled ? tint : "transparent",
                    borderColor: enabled ? tint : colors.border,
                  },
                ]}
              >
                {enabled ? (
                  <AppIcon family="Ionicons" name="checkmark" size={9} color="#fff" />
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// iOS sekme çubuğunun "aşağı kaydırınca küçül" davranışı için kaydırma
// görünümünü sekme ekranına tanıtır (bkz. components/navigation/TabScrollMarker.js).
// Modül kapsamında: render içinde kurulursa içerik her render'da sökülür.
const MarkedScrollView = markTabScroll(ScrollView);

export default function SettingsScreen() {
  // Marka logosu seçili uygulama simgesini izler (hooks/useAppLogo.js).
  const { logo: appLogo } = useAppLogo();
  const { contentBottom } = useTabBarLayout();
  const onTabBarScroll = useTabBarScrollSync();
  const navigation = useNavigation();
  // İçerik ekranın tepesinden başlıyor (durum çubuğu / Dynamic Island altında
  // değil): başlığın üst boşluğu güvenli alana bağlı, sabit değer değil.
  const insets = useSafeAreaInsets();
  const titleTop = tabTitleTopSpacing(insets.top);
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [langSearch, setLangSearch] = useState("");
  const [modalVisibleLogout, setModalVisibleLogout] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Arka planda Settings etkileşimleri bittiğinde PremiumScreen modülünü önceden yükle (preload)
  // Böylece butona dokunulduğunda JS thread takılmadan 60 FPS anında açılır.
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      try {
        require("../premium/PremiumScreen");
      } catch {}
    });
    return () => task?.cancel?.();
  }, []);

  const handleSignOut = async () => {
    try {
      const auth = getAuth();
      // Çıkıştan ÖNCE buluta gitmemiş notları/hatırlatıcıları göndermeyi dene:
      // çıkıştan sonra yetkisiz kalınır. En çok 4 sn bekler; çevrimdışıysa
      // vazgeçer — değişiklikler yazma günlüğünde durur ve aynı hesapla tekrar
      // girişte gider (çıkışı asla kilitlemez).
      if (auth.currentUser?.uid) {
        await flushUserData(auth.currentUser.uid, { timeoutMs: 4000 }).catch(() => {});
      }
      await auth.signOut();
      navigation.reset({
        index: 0,
        routes: [{ name: "LoginScreen" }],
      });
    } catch (error) {
      appAlert(
        i18nText("autoI18n.hata", "Hata"),
        error?.message || i18nText("autoI18n.hata_olustu", "Hata oluştu"),
        undefined,
        { type: "error" },
      );
    }
  };

  // Dil sayfası: blur yerinde solar, sayfa kayar
  // (bkz. hooks/useSheetTransition.js).
  const langSheet = useSheetTransition(langModalVisible);
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
  const { adultContent, chaneAdultContent, ageRestricted } = useContentSettings();
  const { showOngoingTvShows, changeShowOngoingTvShows } =
    useOngoingTvShowsSettings();
  const { imageQuality, imageQualityLevel, changeImageQuality, getTmdbUrl } =
    useImageQualitySettings();
  const { API_KEY } = useApiSettings();
  const { hapticsEnabled, changeHapticsEnabled } = useHapticsSettings();
  const {
    autoDataCacheEnabled,
    changeAutoDataCacheEnabled,
    dataCacheTypes,
    changeDataCacheType,
    changeDataCacheTypes,
  } = useAutoDataCacheSettings();
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




  return (
    <View style={[s.root, { backgroundColor: C.bg }]}>
      {/* Arka plan dekoru (ikon deseni + kar) — içeriğin ARKASINDA */}
      <ScreenDecor scope="settings" iconOpacity={0.15} />

      <MarkedScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: contentBottom }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={onTabBarScroll}
        scrollEventThrottle={16}
      >
        <Text
          allowFontScaling={false}
          style={[s.pageTitle, { color: C.text, marginTop: titleTop }]}
        >
          {t.settings}
        </Text>

        {/* ── Premium: abonelik vitrini en üstte ── */}
        <SectionLabel color={C.muted} first>SEELOGD PREMIUM</SectionLabel>
        <PremiumSettingsCard />
        <View
          style={[
            s.card,
            s.cardStacked,
            { backgroundColor: C.card, borderColor: C.border },
          ]}
        >
          <SettingRow
            colors={C}
            iconBg={C.iconPurple}
            iconColor={C.purple}
            iconName="speedometer-outline"
            title={i18nText("autoI18n.kullanim_haklar_baslik", "Kullanım ve haklar")}
            subtitle={i18nText(
              "autoI18n.kullanim_haklar_aciklama",
              "Planının limitleri ve kalan hakların",
            )}
            onPress={() => navigation.navigate("PremiumUsageScreen")}
            right={<Chevron color={C.muted} />}
            last
          />
        </View>
        {/* Yalnız geliştirme build'inde: premium kapılarını mağazasız dene */}
        {__DEV__ ? <DevPlanSimulatorCard /> : null}

        {/* ── Hesap: kimlik doğrulama yöntemleri ve gizlilik ── */}
        <SectionLabel color={C.muted}>{i18nText("autoI18n.ayarlar_grup_hesap", "Hesap").toUpperCase()}</SectionLabel>
        <View
          style={[
            s.card,
            { backgroundColor: C.card, borderColor: C.border },
          ]}
        >
          <SettingRow
            colors={C}
            iconBg={C.iconBlue}
            iconColor={C.blue}
            iconName="person-circle-outline"
            title={i18nText("autoI18n.hesap_baglantilari", "Hesap bağlantıları")}
            subtitle={i18nText("autoI18n.hesap_baglantilari_aciklama", "Google, Apple ve parola yöntemleri")}
            onPress={() => navigation.navigate("AccountConnectionsScreen")}
            right={<Chevron color={C.muted} />}
          />
          <SettingRow
            colors={C}
            iconBg={C.iconBlue}
            iconColor={C.blue}
            iconName="lock-closed-outline"
            title={i18nText("autoI18n.gizlilik", "Gizlilik")}
            subtitle={i18nText(
              "autoI18n.gizlilik_aciklama",
              "Profil, listeler, gönderiler ve çevrimiçi durumu kimler görsün",
            )}
            onPress={() => navigation.navigate("PrivacySettingsScreen")}
            right={<Chevron color={C.muted} />}
            last
          />
        </View>

        {/* ── Görünüm: tema, kişiselleştirme, poster düzeni, widget'lar, dokunsal geri bildirim ── */}
        <SectionLabel color={C.muted}>{t.appearance.toUpperCase()}</SectionLabel>
        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          {/* Ayrı "Görünüm" başlık satırı kaldırıldı — SettingsTheme'in kendi
              "Aktif tema" özet satırı bu görevi üstleniyor. */}
          <SettingsTheme />
        </View>
        <View
          style={[
            s.card,
            s.cardStacked,
            { backgroundColor: C.card, borderColor: C.border },
          ]}
        >
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
            iconBg={C.iconTeal}
            iconColor={C.teal}
            iconName="grid-outline"
            title={i18nText("autoI18n.widget_settings_title", "Widget’lar")}
            subtitle={i18nText(
              "autoI18n.widget_settings_description",
              "Ana ekran widget’larının görünümünü özelleştir",
            )}
            onPress={() => navigation.navigate("WidgetSettingsScreen")}
            right={<Chevron color={C.muted} />}
          />
          <SettingRow
            colors={C}
            iconBg={C.iconAmber}
            iconColor={C.amber}
            iconName={hapticsEnabled ? "phone-portrait-outline" : "phone-portrait"}
            title={t.haptics}
            subtitle={t.hapticsSubtitle}
            right={
              <SwitchToggle
                value={hapticsEnabled}
                onValueChange={changeHapticsEnabled}
                size={36}
              />
            }
            last
          />
        </View>

        {/* ── Dil ve içerik: uygulama dili, izleme platformları, içerik tercihleri ── */}
        <SectionLabel color={C.muted}>{i18nText("autoI18n.ayarlar_grup_dil_icerik", "Dil ve içerik").toUpperCase()}</SectionLabel>
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
        <View
          style={[
            s.card,
            s.cardStacked,
            { backgroundColor: C.card, borderColor: C.border },
          ]}
        >
          <SettingRow
            colors={C}
            iconBg={C.iconTeal}
            iconColor={C.teal}
            iconName="play-circle-outline"
            title={i18nText("autoI18n.platform_uyeliklerim", "Platform üyeliklerim")}
            subtitle={providerSummary}
            onPress={() => {
              setProviderSearch("");
              setProviderModalVisible(true);
            }}
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
          <SettingRow
            colors={C}
            iconBg={C.iconGreen}
            iconColor={C.green}
            iconName={showOngoingTvShows ? "play-circle-outline" : "pause-circle-outline"}
            title={t.showOngoingTvShows}
            subtitle={t.showOngoingTvShowsSubtitle}
            last={ageRestricted}
            right={
              <SwitchToggle
                value={showOngoingTvShows}
                onValueChange={changeShowOngoingTvShows}
                size={36}
              />
            }
          />
          {/* Yetişkin içerik — 18 altı hesapta satır HİÇ ÇİZİLMEZ. Kapalı bir
              anahtar göstermek "neden açamıyorum" sorusunu doğuruyor; içerik
              süzgeci zaten ayrıca kilitli (bkz. utils/tmdbAdultGuard.js). */}
          {!ageRestricted && (
            <SettingRow
              colors={C}
              iconBg={C.iconPurple}
              iconColor={C.purple}
              iconName={adultContent ? "eye-outline" : "eye-off-outline"}
              title={t.adultContent}
              subtitle={t.adultContentSubtitle}
              last
              right={
                <SwitchToggle
                  value={adultContent}
                  onValueChange={() => chaneAdultContent(!adultContent)}
                  size={36}
                />
              }
            />
          )}
        </View>

        {/* ── Bildirimler ── */}
        <SectionLabel color={C.muted}>{t.notifications.toUpperCase()}</SectionLabel>
        <View
          style={[
            s.card,
            { backgroundColor: C.card, borderColor: C.border },
          ]}
        >
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
            last
          />
        </View>

        {/* ── Veri ve depolama: görsel kalitesi, çevrimdışı veri, izinler, içe aktarma ── */}
        <SectionLabel color={C.muted}>{i18nText("autoI18n.ayarlar_grup_veri_depolama", "Veri ve depolama").toUpperCase()}</SectionLabel>
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
        <View
          style={[
            s.card,
            s.cardStacked,
            { backgroundColor: C.card, borderColor: C.border },
          ]}
        >
          <SettingRow
            colors={C}
            iconBg={C.iconAmber}
            iconColor={C.amber}
            iconName="cloud-download-outline"
            title={t.downloadData}
            subtitle={
              autoDataCacheEnabled
                ? `${t.downloadDataSubtitle} · ${countEnabledTypes(dataCacheTypes)}/${DATA_TYPE_COUNT} ${i18nText("autoI18n.tur_kucuk", "tür")}`
                : i18nText(
                    "autoI18n.veri_indirme_kapali_alt",
                    "Kapalı — hiçbir veri veya poster indirilmez",
                  )
            }
            right={
              <SwitchToggle
                value={autoDataCacheEnabled}
                onValueChange={changeAutoDataCacheEnabled}
                size={36}
              />
            }
          />
          {autoDataCacheEnabled && (
            <DataTypePicker
              types={dataCacheTypes}
              colors={C}
              onChange={changeDataCacheType}
              onToggleAll={(enabled) => changeDataCacheTypes(buildAllTypes(enabled))}
            />
          )}
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
            onPress={() => navigation.navigate("PermissionsDataScreen")}
            right={<Chevron color={C.muted} />}
          />
          <SettingRow
            colors={C}
            iconBg={C.iconPurple}
            iconColor={C.purple}
            iconName="archive-outline"
            title={i18nText("autoI18n.ayar_yedek_baslik", "Ayarları Yedekle ve Geri Yükle")}
            subtitle={i18nText(
              "autoI18n.ayar_yedek_alt",
              "Tema, özel temalar ve tüm tercihlerini dosyaya aktar",
            )}
            onPress={() => navigation.navigate("BackupSettingsScreen")}
            right={<Chevron color={C.muted} />}
          />
          <SettingRow
            colors={C}
            iconBg={C.iconAmber}
            iconColor={C.amber}
            iconName="file-tray-full-outline"
            title="Letterboxd & IMDb'den Aktar"
            subtitle="İzleme geçmişinizi ve puanlarınızı Seelogd'a taşıyın"
            onPress={() => setShowImportModal(true)}
            right={<Chevron color={C.muted} />}
            last
          />
        </View>

        {/* ── Hakkında + hata ayıklama ── */}
        <SwipeCard>
          <SectionLabel color={C.muted}>{t.about.toUpperCase()}</SectionLabel>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate("AboutAppScreen")}
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
                source={appLogo}
                style={{ width: 50, height: 50 }}
                contentFit="contain"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text allowFontScaling={false} style={[s.aboutName, { color: C.text }]}>
                Seelogd
              </Text>
              <Text allowFontScaling={false} style={[s.aboutMeta, { color: C.muted }]}>
                {i18nText("autoI18n.created_by", "Oluşturan: İsmail Öztürk · © 2025")}
              </Text>
              {/* Veri kaynaklarının resmî logoları: içerik TMDB'den, izleme
                  sağlayıcısı (watch provider) verisi JustWatch'tan geliyor;
                  ikisinin de koşulları kaynağın görünür olmasını istiyor.
                  Dar ekranda ikinci logo alt satıra iner (flexWrap). */}
              <View style={s.attributionRow}>
                <TmdbLogo width={72} />
                <JustWatchLogo width={64} />
              </View>
            </View>
            <View style={{ alignItems: "flex-end", gap: 6 }}>
              <View style={[s.versionBadge, { backgroundColor: C.borderMuted }]}>
                <Text
                  allowFontScaling={false}
                  style={[s.versionText, { color: C.text }]}
                >
                  {APP_VERSION}
                </Text>
              </View>
              <Chevron color={C.muted} />
            </View>
          </TouchableOpacity>
        </SwipeCard>

        <View style={[s.card, s.debugCard, { backgroundColor: C.card, borderColor: C.border }]}>
          <SettingRow colors={C} iconBg={C.iconBlue} iconColor={C.blue}
            iconName="analytics-outline" title="Debug"
            onPress={() => navigation.navigate("UsageDebugScreen")}
            right={<Chevron color={C.muted} />} last />
        </View>

        {/* ── Çıkış: tehlikeli işlem en altta ── */}
        <SectionLabel color={C.danger}>
          {(t.logout || "Çıkış Yap").toUpperCase()}
        </SectionLabel>
        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <SettingRow
            colors={C}
            iconBg={C.dangerDim}
            iconColor={C.danger}
            iconName="log-out-outline"
            title={t.logout || "Çıkış Yap"}
            subtitle={i18nText("autoI18n.cikis_yap_aciklama", "Hesabından güvenli bir şekilde çıkış yap")}
            danger
            last
            onPress={() => setModalVisibleLogout(true)}
            right={<Chevron color={C.danger} />}
          />
        </View>

        <BottomSheetModal
          visible={providerModalVisible}
          onClose={() => {
            setProviderModalVisible(false);
            setProviderSearch("");
          }}
          sheetStyle={[
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
                    {i18nText("autoI18n.platform_uyeliklerim", "Platform üyeliklerim")}
                  </Text>
                </View>
                <GlassCloseButton
                  size={30}
                  fallbackRadius={15}
                  iconSize={16}
                  color={C.muted}
                  backgroundColor={C.closeBg}
                  onPress={() => {
                    setProviderModalVisible(false);
                    setProviderSearch("");
                  }}
                />
              </View>
              <Text allowFontScaling={false} style={[s.providerHelp, { color: C.muted }]}>
                {i18nText("autoI18n.platform_uyelikleri_aciklama", "Üyesi olduğun servisleri seç. Film ve dizi ana ekranlarında sana özel bir alan oluşturulur.")}
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
                  placeholder={i18nText("autoI18n.platform_ara", "Platform ara...")}
                  placeholderTextColor={C.muted}
                  value={providerSearch}
                  onChangeText={setProviderSearch}
                  maxLength={80}
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
                  {i18nText("autoI18n.n_platform", "{{count}} platform", {
                    count: filteredProviders.length,
                  })}
                </Text>
                {streamingProviderIds.length > 0 && (
                  <TouchableOpacity onPress={() => changeStreamingProviderIds([])}>
                    <Text style={[s.providerClearText, { color: C.accent }]}>
                      {i18nText("autoI18n.secimi_temizle", "Seçimi temizle")}
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
                        {i18nText("autoI18n.platform_bulunamadi", "Platform bulunamadı")}
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
                  {i18nText("autoI18n.tamam", "Tamam")}
                </Text>
              </TouchableOpacity>
              <Text allowFontScaling={false} style={[s.providerAttribution, { color: C.muted }]}>
                {t.justwatchAttribution}
              </Text>
        </BottomSheetModal>

        <Modal
          animationType="none"
          transparent
          visible={langSheet.mounted}
          onRequestClose={() => {
            setLangModalVisible(false);
            setLangSearch("");
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
          >
            {/* onLayout: KeyboardAvoidingView pencereyi daralttığında sayfa
                zaten yükselmiş olur; ölçüm çift kaymayı engeller. */}
            <View style={s.sheetOverlay} onLayout={langSheet.onOverlayLayout}>
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                activeOpacity={1}
                onPress={() => {
                  setLangModalVisible(false);
                  setLangSearch("");
                }}
              />
              {/* Blur YERİNDE solar — sayfayla birlikte kaymaz. */}
              <Animated.View
                style={[
                  StyleSheet.absoluteFill,
                  { opacity: langSheet.backdropOpacity },
                ]}
              >
                <ModalBlurBackdrop intensity={40} />
              </Animated.View>
              {/* fit: arama kutusu klavyeyi açınca sayfa, klavyenin üstünde kalan
                  alana sığacak şekilde kısalır (liste kendi içinde kayar). */}
              <Animated.View
                onLayout={langSheet.onSheetLayout}
                style={[
                  langSheet.fit([
                    s.sheet,
                    { backgroundColor: C.card, borderColor: C.border },
                  ]),
                  langSheet.sheetStyle,
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
                  <GlassCloseButton
                    size={30}
                    fallbackRadius={15}
                    iconSize={16}
                    color={C.muted}
                    backgroundColor={C.closeBg}
                    onPress={() => {
                      setLangModalVisible(false);
                      setLangSearch("");
                    }}
                  />
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
                    maxLength={80}
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
              </Animated.View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Çıkış onayı alt sayfası */}
        <ConfirmSheet
          visible={modalVisibleLogout}
          onClose={() => setModalVisibleLogout(false)}
          onConfirm={() => {
            setModalVisibleLogout(false);
            handleSignOut();
          }}
          icon="log-out-outline"
          tone="danger"
          title={t.logout || "Çıkış Yap"}
          message={
            t.profileScreen?.logoutMessage ||
            i18nText(
              "autoI18n.cikis_onay_mesaj",
              "Hesabından çıkış yapmak istediğine emin misin?",
            )
          }
          confirmLabel={t.logout || "Çıkış Yap"}
          cancelLabel={t.cancel || "İptal"}
        />

        <ImportDataModal
          visible={showImportModal}
          onClose={() => setShowImportModal(false)}
        />
      </MarkedScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  // ── "Verileri indir" tür seçici ───────────────────────────────────────────
  // Üstteki SettingRow'un alt çizgisi ayırıcı görevi görür; burada tekrar
  // kenarlık verilmez (yoksa 2px'lik çift çizgi oluşur).
  dataTypes: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  dataTypesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 9,
  },
  dataTypesTitle: { fontSize: 11.5, fontWeight: "800" },
  dataTypesSub: { fontSize: 9, marginTop: 2, lineHeight: 12 },
  dataTypesAction: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  dataTypesActionText: { fontSize: 8.5, fontWeight: "800" },
  dataTypesWarn: { fontSize: 9.5, fontWeight: "700", marginBottom: 8 },
  dataTypeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  dataTypeButton: {
    width: "31.8%",
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingLeft: 6,
    paddingRight: 13,
    paddingVertical: 6,
  },
  dataTypeIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  dataTypeLabel: { flex: 1, fontSize: 8.8, fontWeight: "700", lineHeight: 11 },
  dataTypeCheck: {
    position: "absolute",
    top: 3,
    right: 3,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
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
  // Üst boşluk (marginTop) çalışma zamanında güvenli alandan gelir: bkz.
  // utils/screenTopSpacing.js. Sabit satır yüksekliği iOS/Android'de başlık
  // kutusunu eşitler (Android'in font dolgusu yüzünden farklı yükseklik çıkmasın).
  pageTitle: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: -0.5,
    includeFontPadding: false,
  },
  firstSectionLabel: {
    marginTop: 8,
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
  // Aynı grup etiketinin altında alt alta duran kartlar arası boşluk (dil kartı +
  // satır kartı, tema kartı + satır kartı, kalite kartı + satır kartı).
  cardStacked: {
    marginTop: 10,
  },
  debugCard: {
    marginTop: 12,
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
  // TMDB + JustWatch logoları yan yana; sığmazsa alt satıra sarar.
  attributionRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    columnGap: 10,
    rowGap: 6,
    marginTop: 8,
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
