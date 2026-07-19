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
const ListLayoutSettingsContext = createContext();
const StreamingProviderSettingsContext = createContext();

export const STREAMING_PROVIDERS = Object.freeze([
  { id: 8, name: "Netflix", color: "#E50914" },
  { id: 337, name: "Disney+", color: "#113CCF" },
  { id: 119, name: "Prime Video", color: "#00A8E1" },
  { id: 350, name: "Apple TV+", color: "#6E6E73" },
  { id: 1899, name: "Max", color: "#5B34DA" },
  { id: 11, name: "MUBI", color: "#083B66" },
]);

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
  streamingEnabled: false,
  leadTimeDays: 0,
};

const DEFAULT_POSTER_BADGES = Object.freeze({
  watchlist: true,
  watched: true,
  favorite: true,
  other: true,
  shared: true,
  rated: true,
  commented: true,
  tmdbRating: true,
  voteCount: true,
  releaseDate: true,
  countdown: true,
});
const POSTER_BADGE_KEYS = Object.keys(DEFAULT_POSTER_BADGES);

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
    streamingEnabled: getBooleanSetting(next, "streamingEnabled"),
    leadTimeDays: [0, 1, 3, 7].includes(next.leadTimeDays)
      ? next.leadTimeDays
      : DEFAULT_NOTIFICATION_SETTINGS.leadTimeDays,
  };
};

const normalizePosterBadges = (settings) => {
  if (typeof settings === "boolean") {
    return POSTER_BADGE_KEYS.reduce((acc, key) => {
      acc[key] = settings;
      return acc;
    }, {});
  }

  const source =
    settings && typeof settings === "object" && !Array.isArray(settings)
      ? settings
      : {};

  return POSTER_BADGE_KEYS.reduce((acc, key) => {
    acc[key] =
      typeof source[key] === "boolean"
        ? source[key]
        : DEFAULT_POSTER_BADGES[key];
    return acc;
  }, {});
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
  // Liste görünümü: sütun sayısı (3 varsayılan | 4) ve afiş köşe yuvarlaklığı (2 | 10 varsayılan | 20)
  const [listsGridColumns, setListsGridColumns] = useState(3);
  const [listsPosterRadius, setListsPosterRadius] = useState(10);
  // "Tümünü Gör" (poster grid) görünümü — listelerden bağımsız kendi ayarı
  const [seeAllGridColumns, setSeeAllGridColumns] = useState(3);
  const [seeAllPosterRadius, setSeeAllPosterRadius] = useState(10);
  // TV/Film ana ekran yatay rail posterleri: boyut ("normal" | "small") ve köşe (4 | 15 varsayılan | 24)
  const [railPosterSize, setRailPosterSize] = useState("normal");
  const [railPosterRadius, setRailPosterRadius] = useState(15);
  // Poster üzerindeki rozetlerin (ListBadges) TÜR BAZINDA görünürlüğü —
  // her rozet ayrı açılıp kapatılabilir; kapalı olan posterde çizilmez.
  const [posterBadges, setPosterBadges] = useState(DEFAULT_POSTER_BADGES);
  const [streamingProviderIds, setStreamingProviderIds] = useState([]);

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
          [, savedListsGridColumns],
          [, savedListsPosterRadius],
          [, savedSeeAllGridColumns],
          [, savedSeeAllPosterRadius],
          [, savedRailPosterSize],
          [, savedRailPosterRadius],
          [, savedShowPosterBadges],
          [, savedStreamingProviderIds],
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
          "listsGridColumns",
          "listsPosterRadius",
          "seeAllGridColumns",
          "seeAllPosterRadius",
          "railPosterSize",
          "railPosterRadius",
          "showPosterBadges",
          "streamingProviderIds",
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
        if (savedListsGridColumns !== null) {
          const n = parseInt(savedListsGridColumns, 10);
          if (n === 3 || n === 4) setListsGridColumns(n);
        }
        if (savedListsPosterRadius !== null) {
          const n = parseInt(savedListsPosterRadius, 10);
          if (n === 2 || n === 10 || n === 20) setListsPosterRadius(n);
        }
        if (savedSeeAllGridColumns !== null) {
          const n = parseInt(savedSeeAllGridColumns, 10);
          if (n === 3 || n === 4) setSeeAllGridColumns(n);
        }
        if (savedSeeAllPosterRadius !== null) {
          const n = parseInt(savedSeeAllPosterRadius, 10);
          if (n === 2 || n === 10 || n === 20) setSeeAllPosterRadius(n);
        }
        if (savedRailPosterSize === "normal" || savedRailPosterSize === "small") {
          setRailPosterSize(savedRailPosterSize);
        }
        if (savedRailPosterRadius !== null) {
          const n = parseInt(savedRailPosterRadius, 10);
          if (n === 4 || n === 15 || n === 24) setRailPosterRadius(n);
        }
        if (savedShowPosterBadges !== null) {
          const parsed = JSON.parse(savedShowPosterBadges);
          setPosterBadges(normalizePosterBadges(parsed));
        }
        if (savedStreamingProviderIds !== null) {
          const parsed = JSON.parse(savedStreamingProviderIds);
          if (Array.isArray(parsed)) {
            setStreamingProviderIds(
              [...new Set(parsed.map(Number))].filter(
                (id) => Number.isInteger(id) && id > 0,
              ),
            );
          }
        }
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

  const changeListsGridColumns = useCallback((n) => {
    if (n !== 3 && n !== 4) return;
    setListsGridColumns(n);
    AsyncStorage.setItem("listsGridColumns", String(n)).catch((e) =>
      Toast.show({ type: "error", text1: i18nText("autoI18n.gorunum_ayari_kaydedilemedi", "Görünüm ayarı kaydedilemedi") }),
    );
  }, []);

  const changeListsPosterRadius = useCallback((n) => {
    if (n !== 2 && n !== 10 && n !== 20) return;
    setListsPosterRadius(n);
    AsyncStorage.setItem("listsPosterRadius", String(n)).catch((e) =>
      Toast.show({ type: "error", text1: i18nText("autoI18n.gorunum_ayari_kaydedilemedi", "Görünüm ayarı kaydedilemedi") }),
    );
  }, []);

  const changeSeeAllGridColumns = useCallback((n) => {
    if (n !== 3 && n !== 4) return;
    setSeeAllGridColumns(n);
    AsyncStorage.setItem("seeAllGridColumns", String(n)).catch((e) =>
      Toast.show({ type: "error", text1: i18nText("autoI18n.gorunum_ayari_kaydedilemedi", "Görünüm ayarı kaydedilemedi") }),
    );
  }, []);

  const changeSeeAllPosterRadius = useCallback((n) => {
    if (n !== 2 && n !== 10 && n !== 20) return;
    setSeeAllPosterRadius(n);
    AsyncStorage.setItem("seeAllPosterRadius", String(n)).catch((e) =>
      Toast.show({ type: "error", text1: i18nText("autoI18n.gorunum_ayari_kaydedilemedi", "Görünüm ayarı kaydedilemedi") }),
    );
  }, []);

  const changeRailPosterSize = useCallback((size) => {
    if (size !== "normal" && size !== "small") return;
    setRailPosterSize(size);
    AsyncStorage.setItem("railPosterSize", size).catch((e) =>
      Toast.show({ type: "error", text1: i18nText("autoI18n.gorunum_ayari_kaydedilemedi", "Görünüm ayarı kaydedilemedi") }),
    );
  }, []);

  const changeRailPosterRadius = useCallback((n) => {
    if (n !== 4 && n !== 15 && n !== 24) return;
    setRailPosterRadius(n);
    AsyncStorage.setItem("railPosterRadius", String(n)).catch((e) =>
      Toast.show({ type: "error", text1: i18nText("autoI18n.gorunum_ayari_kaydedilemedi", "Görünüm ayarı kaydedilemedi") }),
    );
  }, []);

  const showPosterBadges = useMemo(
    () => POSTER_BADGE_KEYS.some((key) => posterBadges[key]),
    [posterBadges],
  );

  const persistPosterBadges = useCallback((next) => {
    AsyncStorage.setItem("showPosterBadges", JSON.stringify(next)).catch(
      (e) =>
        Toast.show({ type: "error", text1: i18nText("autoI18n.gorunum_ayari_kaydedilemedi", "Görünüm ayarı kaydedilemedi") }),
    );
  }, []);

  const changePosterBadges = useCallback((nextValue) => {
    const next = normalizePosterBadges(nextValue);
    setPosterBadges(next);
    persistPosterBadges(next);
  }, [persistPosterBadges]);

  const changePosterBadge = useCallback((key, val) => {
    if (!POSTER_BADGE_KEYS.includes(key)) return;
    const next = normalizePosterBadges({ ...posterBadges, [key]: !!val });
    setPosterBadges(next);
    persistPosterBadges(next);
  }, [posterBadges, persistPosterBadges]);

  const changeShowPosterBadges = useCallback((val) => {
    changePosterBadges(val);
  }, [changePosterBadges]);

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

  const changeStreamingProviderIds = useCallback((providerIds) => {
    const next = [...new Set((providerIds || []).map(Number))].filter(
      (id) => Number.isInteger(id) && id > 0,
    );
    setStreamingProviderIds(next);
    AsyncStorage.setItem("streamingProviderIds", JSON.stringify(next)).catch((e) =>
      Toast.show({
        type: "error",
        text1: i18nText(
          "autoI18n.platform_uyelikleri_kaydedilemedi",
          "Platform üyelikleri kaydedilemedi: ",
        ) + e,
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

  const streamingProviderValue = useMemo(
    () => ({ streamingProviderIds, changeStreamingProviderIds }),
    [streamingProviderIds, changeStreamingProviderIds],
  );

  const listLayoutValue = useMemo(
    () => ({
      listsGridColumns,
      changeListsGridColumns,
      listsPosterRadius,
      changeListsPosterRadius,
      seeAllGridColumns,
      changeSeeAllGridColumns,
      seeAllPosterRadius,
      changeSeeAllPosterRadius,
      railPosterSize,
      changeRailPosterSize,
      railPosterRadius,
      changeRailPosterRadius,
      showPosterBadges,
      changeShowPosterBadges,
      posterBadges,
      changePosterBadges,
      changePosterBadge,
    }),
    [
      listsGridColumns,
      changeListsGridColumns,
      listsPosterRadius,
      changeListsPosterRadius,
      seeAllGridColumns,
      changeSeeAllGridColumns,
      seeAllPosterRadius,
      changeSeeAllPosterRadius,
      railPosterSize,
      changeRailPosterSize,
      railPosterRadius,
      changeRailPosterRadius,
      showPosterBadges,
      changeShowPosterBadges,
      posterBadges,
      changePosterBadges,
      changePosterBadge,
    ],
  );

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
                            <ListLayoutSettingsContext.Provider
                              value={listLayoutValue}
                            >
                              <StreamingProviderSettingsContext.Provider
                                value={streamingProviderValue}
                              >
                                <AppSettingsContext.Provider value={value}>
                                  {children}
                                </AppSettingsContext.Provider>
                              </StreamingProviderSettingsContext.Provider>
                            </ListLayoutSettingsContext.Provider>
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

export const useListLayoutSettings = () =>
  useRequiredContext(ListLayoutSettingsContext, "useListLayoutSettings");

export const useStreamingProviderSettings = () =>
  useRequiredContext(
    StreamingProviderSettingsContext,
    "useStreamingProviderSettings",
  );

export const useReminderNotificationSettings = useNotificationSettings;
