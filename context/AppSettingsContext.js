import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useMemo,
  useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from "react-native-toast-message";
import { buildTmdbUrl } from "../utils/tmdbImageUtils";

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

export const AppSettingsProvider = ({ children }) => {
  const [showSnow, setShowSnow] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [selectedTheme, setSelectedTheme] = useState("dark");
  const [adultContent, setAdultContent] = useState(false);
  const [showOngoingTvShows, setShowOngoingTvShows] = useState(true);
  const [showIconBackground, setShowIconBackground] = useState(true);
  const [imageQualityLevel, setImageQualityLevel] = useState("good");
  const [selectedAvatar, setSelectedAvatar] = useState(null);

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
          [, savedLevel],
          [, savedLegacy],
        ] = await AsyncStorage.multiGet([
          "showSnow",
          "selectedLanguage",
          "selectedTheme",
          "selectedAvatar",
          "adultContent",
          "showOngoingTvShows",
          "showIconBackground",
          "imageQualityLevel",
          "imageQuality", // legacy key — migrated on first read
        ]);

        if (savedAdultContent !== null)
          setAdultContent(JSON.parse(savedAdultContent));

        if (savedOngoingTvShows !== null)
          setShowOngoingTvShows(JSON.parse(savedOngoingTvShows));

        if (savedIconBackground !== null)
          setShowIconBackground(JSON.parse(savedIconBackground));

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
        if (savedAvatar !== null) setSelectedAvatar(JSON.parse(savedAvatar));
      } catch (error) {
        Toast.show({ type: "error", text1: "Ayarlar yüklenemedi: " + error });
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
      Toast.show({ type: "error", text1: "Dil kaydedilemedi: " + e }),
    );
  }, []);

  const changeTheme = useCallback((newVal) => {
    setSelectedTheme(newVal);
    AsyncStorage.setItem("selectedTheme", newVal).catch((e) =>
      Toast.show({ type: "error", text1: "Tema kaydedilemedi: " + e }),
    );
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
      Toast.show({ type: "error", text1: "Devam eden diziler ayarı kaydedilemedi: " + e }),
    );
  }, []);

  const changeShowIconBackground = useCallback((newVal) => {
    setShowIconBackground(newVal);
    AsyncStorage.setItem("showIconBackground", JSON.stringify(newVal)).catch((e) =>
      Toast.show({ type: "error", text1: "İkon arka plan ayarı kaydedilemedi: " + e }),
    );
  }, []);

  const changeImageQuality = useCallback((level) => {
    if (!IMAGE_QUALITY_PRESETS[level]) return;
    setImageQualityLevel(level);
    AsyncStorage.setItem("imageQualityLevel", level).catch((e) =>
      Toast.show({ type: "error", text1: "Kalite kaydedilemedi: " + e }),
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
    }),
    [selectedTheme, changeTheme],
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
    }),
    [showIconBackground, changeShowIconBackground],
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
                      <AppSettingsContext.Provider value={value}>
                        {children}
                      </AppSettingsContext.Provider>
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
