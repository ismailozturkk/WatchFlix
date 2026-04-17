import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useMemo,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from "react-native-toast-message";

const AppSettingsContext = createContext();

/**
 * TMDB Image Quality Presets
 * poster_sizes: w92, w154, w185, w342, w500, w780, original
 * backdrop_sizes: w300, w780, w1280, original
 * logo_sizes: w45, w92, w154, w185, w300, w500, original
 */
export const IMAGE_QUALITY_PRESETS = {
  low: { poster: "w185", backdrop: "w300", logo: "w92" },
  medium: { poster: "w342", backdrop: "w300", logo: "w154" },
  good: { poster: "w500", backdrop: "w780", logo: "w300" },
  high: { poster: "w780", backdrop: "w1280", logo: "w500" },
  original: { poster: "original", backdrop: "original", logo: "original" },
};

/** Eski string formatından yeni level key'e migration */
const LEGACY_TO_LEVEL = {
  w300: "low",
  w500: "good",
  w780: "high",
  w1280: "high",
  original: "original",
};

export const AppSettingsProvider = ({ children }) => {
  const [showSnow, setShowSnow] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [selectedTheme, setSelectedTheme] = useState("dark");
  const [adultContent, setAdultContent] = useState(false);
  const [imageQualityLevel, setImageQualityLevel] = useState("good");

  const [selectedAvatar, setSelectedAvatar] = useState(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedShowSnow = await AsyncStorage.getItem("showSnow");
        const savedLanguage = await AsyncStorage.getItem("selectedLanguage");
        const savedTheme = await AsyncStorage.getItem("selectedTheme");
        const savedAvatar = await AsyncStorage.getItem("selectedAvatar");
        const savedAdultContent = await AsyncStorage.getItem("adultContent");

        // Yeni format: level key (low, medium, good, high, original)
        const savedLevel = await AsyncStorage.getItem("imageQualityLevel");
        // Eski format: tmdb size string (w500, w780 vb.)
        const savedLegacy = await AsyncStorage.getItem("imageQuality");

        if (savedAdultContent !== null) {
          setAdultContent(JSON.parse(savedAdultContent));
        }

        if (savedLevel !== null && IMAGE_QUALITY_PRESETS[savedLevel]) {
          // Yeni format
          setImageQualityLevel(savedLevel);
        } else if (savedLegacy !== null) {
          // Eski format — migrate
          const level = LEGACY_TO_LEVEL[savedLegacy] || "good";
          setImageQualityLevel(level);
          await AsyncStorage.setItem("imageQualityLevel", level);
          await AsyncStorage.removeItem("imageQuality");
        }

        if (savedShowSnow !== null) {
          setShowSnow(JSON.parse(savedShowSnow));
        }
        if (savedLanguage !== null) {
          setSelectedLanguage(savedLanguage);
        }
        if (savedTheme !== null) {
          setSelectedTheme(savedTheme);
        }
        if (savedAvatar !== null) {
          setSelectedAvatar(JSON.parse(savedAvatar));
        }
      } catch (error) {
        Toast.show({
          type: "error",
          text1: "Ayarlar yüklenemedi: " + error,
        });
      }
    };
    loadSettings();
  }, []);

  /** imageQuality artık { poster, backdrop, logo } objesi */
  const imageQuality = useMemo(
    () =>
      IMAGE_QUALITY_PRESETS[imageQualityLevel] ?? IMAGE_QUALITY_PRESETS.good,
    [imageQualityLevel],
  );

  const changeShowSnow = (newShowSnow) => {
    setShowSnow(newShowSnow);
    AsyncStorage.setItem("showSnow", JSON.stringify(newShowSnow)).catch(
      (error) => {
        Toast.show({ type: "error", text1: "ShowSnow kaydedilmedi: " + error });
      },
    );
  };

  const changeLanguage = (newLanguage) => {
    setSelectedLanguage(newLanguage);
    AsyncStorage.setItem("selectedLanguage", newLanguage).catch((error) => {
      Toast.show({ type: "error", text1: "Dil kaydedilemedi: " + error });
    });
  };

  const changeTheme = (newTheme) => {
    setSelectedTheme(newTheme);
    AsyncStorage.setItem("selectedTheme", newTheme).catch((error) => {
      Toast.show({ type: "error", text1: "Tema kaydedilemedi: " + error });
    });
  };

  const changeAvatar = (userId, newAvatar) => {
    setSelectedAvatar(newAvatar);
    AsyncStorage.setItem(`avatar_${userId}`, JSON.stringify(newAvatar)).catch(
      (error) => {
        Toast.show({ type: "error", text1: "Avatar kaydedilemedi: " + error });
      },
    );
  };

  const chaneAdultContent = (newContent) => {
    setAdultContent(newContent);
    AsyncStorage.setItem("adultContent", JSON.stringify(newContent)).catch(
      (error) => {
        Toast.show({ type: "error", text1: "Content kaydedilemedi: " + error });
      },
    );
  };

  /**
   * @param {string} level - "low" | "medium" | "good" | "high" | "original"
   */
  const changeImageQuality = (level) => {
    if (!IMAGE_QUALITY_PRESETS[level]) return;

    setImageQualityLevel(level);
    AsyncStorage.setItem("imageQualityLevel", level).catch((error) => {
      Toast.show({ type: "error", text1: "Kalite kaydedilemedi: " + error });
    });
  };
  // ✅ YENİ — doğrudan statik referans
  const RAW_KEY = process.env.EXPO_PUBLIC_API_KEY || "....";
  const apiKey =
    RAW_KEY && !RAW_KEY.startsWith("Bearer ") ? `Bearer ${RAW_KEY}` : RAW_KEY;

  const value = {
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
    /** { poster: string, backdrop: string, logo: string } */
    imageQuality,
    /** "low" | "medium" | "good" | "high" | "original" */
    imageQualityLevel,
    changeImageQuality,
    API_KEY: apiKey,
  };

  return (
    <AppSettingsContext.Provider value={value}>
      {children}
    </AppSettingsContext.Provider>
  );
};

export const useAppSettings = () => {
  const context = useContext(AppSettingsContext);
  if (context === undefined) {
    throw new Error(
      "useAppSettings must be used within an AppSettingsProvider",
    );
  }
  return context;
};
