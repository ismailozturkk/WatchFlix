import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useMemo,
  useCallback,
  useRef,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from "react-native-toast-message";
import { buildTmdbUrl } from "../utils/tmdbImageUtils";
import { i18nText } from "../utils/i18nText";
import {
  AUTO_DATA_CACHE_KEY,
  setAutoDataCacheEnabled,
} from "../utils/dataCacheSettings";


const AppSettingsContext = createContext();
const LanguageSettingsContext = createContext();
const ThemeSettingsContext = createContext();
const SnowSettingsContext = createContext();
const ContentSettingsContext = createContext();
const OngoingTvShowsSettingsContext = createContext();
const ImageQualitySettingsContext = createContext();
const IconBackgroundSettingsContext = createContext();
const AvatarSettingsContext = createContext();
const ApiSettingsContext = createContext();
const HapticsSettingsContext = createContext();
const NotificationSettingsContext = createContext();
const AutoDataCacheSettingsContext = createContext();

/**
 * TMDB Image Quality Presets
 * Legacy map kept for UI labels only. The actual resolutions are now calculated dynamically
 * in `utils/tmdbImageUtils.js` based on component width.
 */
export const IMAGE_QUALITY_PRESETS = {
  low: { poster: "low", backdrop: "low", logo: "low" },
  medium: { poster: "medium", backdrop: "medium", logo: "medium" },
  good: { poster: "good", backdrop: "good", logo: "good" },
  high: { poster: "high", backdrop: "high", logo: "high" },
  original: { poster: "original", backdrop: "original", logo: "original" },
};

const LEGACY_TO_LEVEL = {
  w300: "low",
  w500: "good",
  w780: "high",
  w1280: "high",
  original: "original",
};

const RAW_KEY = process.env.EXPO_PUBLIC_API_KEY || "";
const API_KEY = RAW_KEY && !RAW_KEY.startsWith("Bearer ") ? `Bearer ${RAW_KEY}` : RAW_KEY;
const DEFAULT_NOTIFICATION_SETTINGS = {
  enabled: true,
  remindersEnabled: true,
  moviesEnabled: true,
  tvShowsEnabled: true,
  noteRemindersEnabled: true,
  friendRequestsEnabled: true,
  friendAcceptedEnabled: true,
  messagesEnabled: true,
  postLikesEnabled: true,
  postCommentsEnabled: true,
  mentionsEnabled: true,
  leadTimeDays: 0,
};

const genThemeId = () =>
  `ct_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

const getBooleanSetting = (settings, key) =>
  typeof settings[key] === "boolean" ? settings[key] : DEFAULT_NOTIFICATION_SETTINGS[key];

const normalizeNotificationSettings = (settings) => {
  const next = {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...(settings && typeof settings === "object" ? settings : {}),
  };

  return {
    enabled: getBooleanSetting(next, "enabled"),
    remindersEnabled: getBooleanSetting(next, "remindersEnabled"),
    moviesEnabled: getBooleanSetting(next, "moviesEnabled"),
    tvShowsEnabled: getBooleanSetting(next, "tvShowsEnabled"),
    noteRemindersEnabled: getBooleanSetting(next, "noteRemindersEnabled"),
    friendRequestsEnabled: getBooleanSetting(next, "friendRequestsEnabled"),
    friendAcceptedEnabled: getBooleanSetting(next, "friendAcceptedEnabled"),
    messagesEnabled: getBooleanSetting(next, "messagesEnabled"),
    postLikesEnabled: getBooleanSetting(next, "postLikesEnabled"),
    postCommentsEnabled: getBooleanSetting(next, "postCommentsEnabled"),
    mentionsEnabled: getBooleanSetting(next, "mentionsEnabled"),
    leadTimeDays: [0, 1, 3, 7].includes(next.leadTimeDays)
      ? next.leadTimeDays
      : DEFAULT_NOTIFICATION_SETTINGS.leadTimeDays,
  };
};

export const AppSettingsProvider = ({ children }) => {
  const [showSnow, setShowSnow] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("tr");
  const [selectedTheme, setSelectedTheme] = useState("dark");
  const [customThemes, setCustomThemes] = useState([]);
  const [adultContent, setAdultContent] = useState(false);
  const [showOngoingTvShows, setShowOngoingTvShows] = useState(true);
  const [showIconBackground, setShowIconBackground] = useState(true);
  // İkon arka plan düzeni: "shared" (sabit, her ekranda aynı, performanslı) | "random" (her ekran farklı)
  const [iconBackgroundMode, setIconBackgroundMode] = useState("shared");
  // İkon saydamlık çarpanı (0.1–1). Ekranların kendi opaklık değerini ölçekler; 1 = değişiklik yok.
  const [iconBackgroundOpacity, setIconBackgroundOpacity] = useState(1);
  const [imageQualityLevel, setImageQualityLevel] = useState("good");
  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [autoDataCacheEnabled, setAutoDataCacheEnabledState] = useState(false);
  const [notificationSettings, setNotificationSettings] =
    useState(DEFAULT_NOTIFICATION_SETTINGS);

  // Single multiGet reads all persisted settings in one AsyncStorage round-trip.
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [
          [, savedShowSnow],
          [, savedLanguage],
          [, savedTheme],
          [, savedAvatar],
          [, savedAdultContent],
          [, savedOngoingTvShows],
          [, savedIconBackground],
          [, savedIconBackgroundMode],
          [, savedIconBackgroundOpacity],
          [, savedLevel],
          [, savedLegacy],
          [, savedHapticsEnabled],
          [, savedNotificationSettings],
          [, savedReminderNotificationSettings],
          [, savedAutoDataCache],
          [, savedCustomTheme],
          [, savedCustomThemes],
        ] = await AsyncStorage.multiGet([
          "showSnow",
          "selectedLanguage",
          "selectedTheme",
          "selectedAvatar",
          "adultContent",
          "showOngoingTvShows",
          "showIconBackground",
          "iconBackgroundMode",
          "iconBackgroundOpacity",
          "imageQualityLevel",
          "imageQuality", // legacy key — migrated on first read
          "hapticsEnabled",
          "notificationSettings",
          "reminderNotificationSettings",
          AUTO_DATA_CACHE_KEY,
          "customThemeTokens", // legacy tek özel tema — çoklu yapıya migrate edilir
          "customThemes",
        ]);

        if (savedAdultContent !== null)
          setAdultContent(JSON.parse(savedAdultContent));

        if (savedOngoingTvShows !== null)
          setShowOngoingTvShows(JSON.parse(savedOngoingTvShows));

        if (savedIconBackground !== null)
          setShowIconBackground(JSON.parse(savedIconBackground));

        if (savedIconBackgroundMode === "shared" || savedIconBackgroundMode === "random")
          setIconBackgroundMode(savedIconBackgroundMode);

        if (savedIconBackgroundOpacity !== null) {
          const v = parseFloat(savedIconBackgroundOpacity);
          if (!Number.isNaN(v)) setIconBackgroundOpacity(Math.min(1, Math.max(0.1, v)));
        }

        if (savedLevel !== null && IMAGE_QUALITY_PRESETS[savedLevel]) {
          setImageQualityLevel(savedLevel);
        } else if (savedLegacy !== null) {
          const level = LEGACY_TO_LEVEL[savedLegacy] || "good";
          setImageQualityLevel(level);
          await AsyncStorage.setItem("imageQualityLevel", level);
          await AsyncStorage.removeItem("imageQuality");
        }

        if (savedShowSnow !== null) setShowSnow(JSON.parse(savedShowSnow));
        if (savedLanguage !== null) setSelectedLanguage(savedLanguage);
        if (savedTheme !== null) setSelectedTheme(savedTheme);

        // Özel temalar (çoklu). Eski tek "customThemeTokens" kaydı varsa adlandırılmış
        // bir temaya migrate edilir ve seçili tema "custom" ise "custom:<id>" olur.
        let themesArr = [];
        if (savedCustomThemes !== null) {
          try {
            const parsed = JSON.parse(savedCustomThemes);
            if (Array.isArray(parsed)) themesArr = parsed.filter((x) => x && x.id && x.tokens);
          } catch { /* gecersiz kayit yok sayilir */ }
        }
        if (themesArr.length === 0 && savedCustomTheme !== null) {
          try {
            const legacyTokens = JSON.parse(savedCustomTheme);
            if (legacyTokens && typeof legacyTokens === "object") {
              const migratedId = genThemeId();
              themesArr = [{
                id: migratedId,
                name: i18nText("autoI18n.ozel_tema", "Özel Tema"),
                tokens: legacyTokens,
              }];
              AsyncStorage.setItem("customThemes", JSON.stringify(themesArr)).catch(() => {});
              if (savedTheme === "custom") {
                setSelectedTheme(`custom:${migratedId}`);
                AsyncStorage.setItem("selectedTheme", `custom:${migratedId}`).catch(() => {});
              }
              AsyncStorage.removeItem("customThemeTokens").catch(() => {});
            }
          } catch { /* gecersiz legacy kayit yok sayilir */ }
        }
        if (themesArr.length > 0) setCustomThemes(themesArr);
        if (savedAvatar !== null) setSelectedAvatar(JSON.parse(savedAvatar));
        if (savedHapticsEnabled !== null) setHapticsEnabled(JSON.parse(savedHapticsEnabled));
        const autoCache = savedAutoDataCache === "true";
        setAutoDataCacheEnabledState(autoCache);
        setAutoDataCacheEnabled(autoCache);
        if (savedNotificationSettings !== null || savedReminderNotificationSettings !== null) {
          const loadedSettings = JSON.parse(
            savedNotificationSettings ?? savedReminderNotificationSettings,
          );
          const normalized = normalizeNotificationSettings(loadedSettings);
          setNotificationSettings(normalized);

          if (savedNotificationSettings === null) {
            await AsyncStorage.setItem("notificationSettings", JSON.stringify(normalized));
            await AsyncStorage.removeItem("reminderNotificationSettings");
          }
        }
      } catch (error) {
        Toast.show({ type: "error", text1: i18nText("autoI18n.ayarlar_yuklenemedi", "Ayarlar yüklenemedi: ") + error });
      }
    };
    loadSettings();
  }, []);

  const imageQuality = useMemo(
    () => IMAGE_QUALITY_PRESETS[imageQualityLevel] ?? IMAGE_QUALITY_PRESETS.good,
    [imageQualityLevel],
  );

  // Stable setters — only close over React's stable setState refs.
  const changeShowSnow = useCallback((newVal) => {
    setShowSnow(newVal);
    AsyncStorage.setItem("showSnow", JSON.stringify(newVal)).catch((e) =>
      Toast.show({ type: "error", text1: "ShowSnow kaydedilmedi: " + e }),
    );
  }, []);

  const changeLanguage = useCallback((newVal) => {
    setSelectedLanguage(newVal);
    AsyncStorage.setItem("selectedLanguage", newVal).catch((e) =>
      Toast.show({ type: "error", text1: i18nText("autoI18n.dil_kaydedilemedi", "Dil kaydedilemedi: ") + e }),
    );
  }, []);

  const changeTheme = useCallback((newVal) => {
    setSelectedTheme(newVal);
    AsyncStorage.setItem("selectedTheme", newVal).catch((e) =>
      Toast.show({ type: "error", text1: i18nText("autoI18n.tema_kaydedilemedi", "Tema kaydedilemedi: ") + e }),
    );
  }, []);

  // Özel tema (ad + token seti) ekler veya günceller. id verilmezse yeni üretilir.
  // Yalnızca isim ve token haritası (mutlak hex + bağıl) saklanır; tam tema nesnesi
  // ThemeContext içinde buildCustomTheme ile üretilir. Kaydedilen tema id'sini döner.
  const saveCustomTheme = useCallback((themeInput) => {
    const id = themeInput?.id || genThemeId();
    const entry = {
      id,
      name: (themeInput?.name || "").trim() || i18nText("autoI18n.ozel_tema", "Özel Tema"),
      tokens: themeInput?.tokens || {},
    };
    setCustomThemes((prev) => {
      const idx = prev.findIndex((x) => x.id === id);
      const next = idx >= 0 ? prev.map((x, i) => (i === idx ? entry : x)) : [...prev, entry];
      AsyncStorage.setItem("customThemes", JSON.stringify(next)).catch((e) =>
        Toast.show({ type: "error", text1: i18nText("autoI18n.tema_kaydedilemedi", "Tema kaydedilemedi: ") + e }),
      );
      return next;
    });
    return id;
  }, []);

  const deleteCustomTheme = useCallback((id) => {
    setCustomThemes((prev) => {
      const next = prev.filter((x) => x.id !== id);
      AsyncStorage.setItem("customThemes", JSON.stringify(next)).catch((e) =>
        Toast.show({ type: "error", text1: i18nText("autoI18n.tema_kaydedilemedi", "Tema kaydedilemedi: ") + e }),
      );
      return next;
    });
  }, []);

  const changeAvatar = useCallback((userId, newAvatar) => {
    setSelectedAvatar(newAvatar);
    AsyncStorage.setItem(
      `avatar_${userId}`,
      JSON.stringify(newAvatar),
    ).catch((e) =>
      Toast.show({ type: "error", text1: "Avatar kaydedilemedi: " + e }),
    );
  }, []);

  const chaneAdultContent = useCallback((newVal) => {
    setAdultContent(newVal);
    AsyncStorage.setItem("adultContent", JSON.stringify(newVal)).catch((e) =>
      Toast.show({ type: "error", text1: "Content kaydedilemedi: " + e }),
    );
  }, []);

  const changeShowOngoingTvShows = useCallback((newVal) => {
    setShowOngoingTvShows(newVal);
    AsyncStorage.setItem("showOngoingTvShows", JSON.stringify(newVal)).catch((e) =>
      Toast.show({ type: "error", text1: i18nText("autoI18n.devam_eden_diziler_ayari_kaydedilemedi", "Devam eden diziler ayarı kaydedilemedi: ") + e }),
    );
  }, []);

  const changeShowIconBackground = useCallback((newVal) => {
    setShowIconBackground(newVal);
    AsyncStorage.setItem("showIconBackground", JSON.stringify(newVal)).catch((e) =>
      Toast.show({ type: "error", text1: i18nText("autoI18n.ikon_arka_plan_ayari_kaydedilemedi", "İkon arka plan ayarı kaydedilemedi: ") + e }),
    );
  }, []);

  const changeIconBackgroundMode = useCallback((mode) => {
    if (mode !== "shared" && mode !== "random") return;
    setIconBackgroundMode(mode);
    AsyncStorage.setItem("iconBackgroundMode", mode).catch((e) =>
      Toast.show({ type: "error", text1: i18nText("autoI18n.ikon_arka_plan_ayari_kaydedilemedi", "İkon arka plan ayarı kaydedilemedi: ") + e }),
    );
  }, []);

  // Saydamlık kaydırıcısı her harekette tetiklenir → state'i anında günceller (canlı
  // önizleme), ama AsyncStorage yazımını debounce eder (sürükleme sırasında yüzlerce
  // gereksiz yazımdan kaçınır; yalnız durunca/bırakınca kalıcılaştırır).
  const opacityPersistTimer = useRef(null);
  const changeIconBackgroundOpacity = useCallback((val) => {
    const v = Math.min(1, Math.max(0.1, Number(val) || 0.1));
    setIconBackgroundOpacity(v);
    if (opacityPersistTimer.current) clearTimeout(opacityPersistTimer.current);
    opacityPersistTimer.current = setTimeout(() => {
      AsyncStorage.setItem("iconBackgroundOpacity", String(v)).catch((e) =>
        Toast.show({ type: "error", text1: i18nText("autoI18n.ikon_arka_plan_ayari_kaydedilemedi", "İkon arka plan ayarı kaydedilemedi: ") + e }),
      );
    }, 250);
  }, []);

  const changeImageQuality = useCallback((level) => {
    if (!IMAGE_QUALITY_PRESETS[level]) return;
    setImageQualityLevel(level);
    AsyncStorage.setItem("imageQualityLevel", level).catch((e) =>
      Toast.show({ type: "error", text1: "Kalite kaydedilemedi: " + e }),
    );
  }, []);

  const changeHapticsEnabled = useCallback((newVal) => {
    setHapticsEnabled(newVal);
    AsyncStorage.setItem("hapticsEnabled", JSON.stringify(newVal)).catch((e) =>
      Toast.show({ type: "error", text1: i18nText("autoI18n.titresim_ayari_kaydedilemedi", "Titreşim ayarı kaydedilemedi: ") + e }),
    );
  }, []);

  const changeNotificationSettings = useCallback((patch) => {
    const next = normalizeNotificationSettings({
      ...notificationSettings,
      ...patch,
    });
    setNotificationSettings(next);
    AsyncStorage.setItem(
      "notificationSettings",
      JSON.stringify(next),
    ).catch((e) =>
      Toast.show({
        type: "error",
        text1: i18nText("autoI18n.bildirim_ayari_kaydedilemedi", "Bildirim ayarı kaydedilemedi: ") + e,
      }),
    );
  }, [notificationSettings]);

  const changeAutoDataCacheEnabled = useCallback((newVal) => {
    const enabled = !!newVal;
    setAutoDataCacheEnabledState(enabled);
    setAutoDataCacheEnabled(enabled);
    AsyncStorage.setItem(AUTO_DATA_CACHE_KEY, JSON.stringify(enabled)).catch((e) =>
      Toast.show({
        type: "error",
        text1: i18nText("autoI18n.veri_indirme_ayari_kaydedilemedi", "Veri indirme ayarı kaydedilemedi: ") + e,
      }),
    );
  }, []);

  const value = useMemo(
    () => ({
      showSnow,
      changeShowSnow,
      selectedLanguage,
      changeLanguage,
      selectedTheme,
      changeTheme,
      selectedAvatar,
      changeAvatar,
      adultContent,
      chaneAdultContent,
      showOngoingTvShows,
      changeShowOngoingTvShows,
      imageQuality,
      imageQualityLevel,
      changeImageQuality,
      API_KEY,
      hapticsEnabled,
      changeHapticsEnabled,
      notificationSettings,
      changeNotificationSettings,
      autoDataCacheEnabled,
      changeAutoDataCacheEnabled,
    }),
    [
      showSnow,
      selectedLanguage,
      selectedTheme,
      selectedAvatar,
      adultContent,
      imageQuality,
      imageQualityLevel,
      changeShowSnow,
      changeLanguage,
      changeTheme,
      changeAvatar,
      chaneAdultContent,
      showOngoingTvShows,
      changeShowOngoingTvShows,
      showIconBackground,
      changeShowIconBackground,
      changeImageQuality,
      hapticsEnabled,
      changeHapticsEnabled,
      notificationSettings,
      changeNotificationSettings,
      autoDataCacheEnabled,
      changeAutoDataCacheEnabled,
    ],
  );

  const languageValue = useMemo(
    () => ({
      selectedLanguage,
      changeLanguage,
    }),
    [selectedLanguage, changeLanguage],
  );

  const themeValue = useMemo(
    () => ({
      selectedTheme,
      changeTheme,
      customThemes,
      saveCustomTheme,
      deleteCustomTheme,
    }),
    [selectedTheme, changeTheme, customThemes, saveCustomTheme, deleteCustomTheme],
  );

  const snowValue = useMemo(
    () => ({
      showSnow,
      changeShowSnow,
    }),
    [showSnow, changeShowSnow],
  );

  const contentValue = useMemo(
    () => ({
      adultContent,
      chaneAdultContent,
    }),
    [adultContent, chaneAdultContent],
  );

  const ongoingTvShowsValue = useMemo(
    () => ({
      showOngoingTvShows,
      changeShowOngoingTvShows,
    }),
    [showOngoingTvShows, changeShowOngoingTvShows],
  );

  const iconBackgroundValue = useMemo(
    () => ({
      showIconBackground,
      changeShowIconBackground,
      iconBackgroundMode,
      changeIconBackgroundMode,
      iconBackgroundOpacity,
      changeIconBackgroundOpacity,
    }),
    [
      showIconBackground,
      changeShowIconBackground,
      iconBackgroundMode,
      changeIconBackgroundMode,
      iconBackgroundOpacity,
      changeIconBackgroundOpacity,
    ],
  );

  const getTmdbUrl = useCallback(
    (path, type, expectedWidth) => {
      return buildTmdbUrl(path, type, expectedWidth, imageQualityLevel);
    },
    [imageQualityLevel]
  );

  const imageQualityValue = useMemo(
    () => ({
      imageQuality,
      imageQualityLevel,
      changeImageQuality,
      getTmdbUrl,
    }),
    [imageQuality, imageQualityLevel, changeImageQuality, getTmdbUrl],
  );

  const avatarValue = useMemo(
    () => ({
      selectedAvatar,
      changeAvatar,
    }),
    [selectedAvatar, changeAvatar],
  );

  const hapticsValue = useMemo(
    () => ({
      hapticsEnabled,
      changeHapticsEnabled,
    }),
    [hapticsEnabled, changeHapticsEnabled],
  );

  const notificationValue = useMemo(
    () => ({
      notificationSettings,
      changeNotificationSettings,
    }),
    [notificationSettings, changeNotificationSettings],
  );

  const autoDataCacheValue = useMemo(
    () => ({
      autoDataCacheEnabled,
      changeAutoDataCacheEnabled,
    }),
    [autoDataCacheEnabled, changeAutoDataCacheEnabled],
  );

  const apiValue = useMemo(() => ({ API_KEY }), []);

  return (
    <ApiSettingsContext.Provider value={apiValue}>
      <LanguageSettingsContext.Provider value={languageValue}>
        <ThemeSettingsContext.Provider value={themeValue}>
          <SnowSettingsContext.Provider value={snowValue}>
            <ContentSettingsContext.Provider value={contentValue}>
              <OngoingTvShowsSettingsContext.Provider value={ongoingTvShowsValue}>
                <IconBackgroundSettingsContext.Provider value={iconBackgroundValue}>
                  <ImageQualitySettingsContext.Provider value={imageQualityValue}>
                    <AvatarSettingsContext.Provider value={avatarValue}>
                      <HapticsSettingsContext.Provider value={hapticsValue}>
                        <NotificationSettingsContext.Provider
                          value={notificationValue}
                        >
                          <AutoDataCacheSettingsContext.Provider
                            value={autoDataCacheValue}
                          >
                            <AppSettingsContext.Provider value={value}>
                              {children}
                            </AppSettingsContext.Provider>
                          </AutoDataCacheSettingsContext.Provider>
                        </NotificationSettingsContext.Provider>
                      </HapticsSettingsContext.Provider>
                    </AvatarSettingsContext.Provider>
                  </ImageQualitySettingsContext.Provider>
                </IconBackgroundSettingsContext.Provider>
              </OngoingTvShowsSettingsContext.Provider>
            </ContentSettingsContext.Provider>
          </SnowSettingsContext.Provider>
        </ThemeSettingsContext.Provider>
      </LanguageSettingsContext.Provider>
    </ApiSettingsContext.Provider>
  );
};

export const useAppSettings = () => {
  const context = useContext(AppSettingsContext);
  if (context === undefined) {
    throw new Error("useAppSettings must be used within an AppSettingsProvider");
  }
  return context;
};

const useRequiredContext = (context, name) => {
  const value = useContext(context);
  if (value === undefined) {
    throw new Error(`${name} must be used within an AppSettingsProvider`);
  }
  return value;
};

export const useLanguageSettings = () =>
  useRequiredContext(LanguageSettingsContext, "useLanguageSettings");

export const useThemeSettings = () =>
  useRequiredContext(ThemeSettingsContext, "useThemeSettings");

export const useSnowSettings = () =>
  useRequiredContext(SnowSettingsContext, "useSnowSettings");

export const useContentSettings = () =>
  useRequiredContext(ContentSettingsContext, "useContentSettings");

export const useOngoingTvShowsSettings = () =>
  useRequiredContext(
    OngoingTvShowsSettingsContext,
    "useOngoingTvShowsSettings",
  );

export const useIconBackgroundSettings = () =>
  useRequiredContext(
    IconBackgroundSettingsContext,
    "useIconBackgroundSettings",
  );

export const useImageQualitySettings = () =>
  useRequiredContext(ImageQualitySettingsContext, "useImageQualitySettings");

export const useAvatarSettings = () =>
  useRequiredContext(AvatarSettingsContext, "useAvatarSettings");

export const useApiSettings = () =>
  useRequiredContext(ApiSettingsContext, "useApiSettings");

export const useHapticsSettings = () =>
  useRequiredContext(HapticsSettingsContext, "useHapticsSettings");

export const useNotificationSettings = () =>
  useRequiredContext(NotificationSettingsContext, "useNotificationSettings");

export const useAutoDataCacheSettings = () =>
  useRequiredContext(
    AutoDataCacheSettingsContext,
    "useAutoDataCacheSettings",
  );

export const useReminderNotificationSettings = useNotificationSettings;
