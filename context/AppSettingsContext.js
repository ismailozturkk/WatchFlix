import React, { createContext, useState, useEffect, useContext } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from "react-native-toast-message";

const AppSettingsContext = createContext();

export const AppSettingsProvider = ({ children }) => {
  const [showSnow, setShowSnow] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [selectedTheme, setSelectedTheme] = useState("dark");
  const [adultContent, setAdultContent] = useState(false);

  const [selectedAvatar, setSelectedAvatar] = useState(null);
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedShowSnow = await AsyncStorage.getItem("showSnow");
        const savedLanguage = await AsyncStorage.getItem("selectedLanguage");
        const savedTheme = await AsyncStorage.getItem("selectedTheme");
        const savedAvatar = await AsyncStorage.getItem("selectedAvatar");
        const savedAdultContent = await AsyncStorage.getItem("adultContent");
        if (savedAdultContent !== null) {
          setAdultContent(JSON.parse(savedAdultContent));
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
          text1: "ShowSnow yüklenemedi:" + error,
        });
      }
    };
    loadSettings();
  }, []);

  const changeShowSnow = async (newShowSnow) => {
    setShowSnow(newShowSnow);
    try {
      await AsyncStorage.setItem("showSnow", JSON.stringify(newShowSnow));
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "ShowSnow kaydedilmedi:" + error,
      });
    }
  };

  const changeLanguage = async (newLanguage) => {
    setSelectedLanguage(newLanguage);
    try {
      await AsyncStorage.setItem("selectedLanguage", newLanguage);
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Dil kaydedilemedi:" + error,
      });
    }
  };

  const changeTheme = async (newTheme) => {
    setSelectedTheme(newTheme);
    try {
      await AsyncStorage.setItem("selectedTheme", newTheme);
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Tema kaydedilemedi:" + error,
      });
    }
  };

  const changeAvatar = async (userId, newAvatar) => {
    setSelectedAvatar(newAvatar);
    try {
      await AsyncStorage.setItem(`avatar_${userId}`, JSON.stringify(newAvatar));
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Avatar kaydedilemedi:" + error,
      });
    }
  };
  const chaneAdultContent = async (newContent) => {
    setAdultContent(newContent);
    try {
      await AsyncStorage.setItem("adultContent", JSON.stringify(newContent));
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Content kaydedilemedi:" + error,
      });
    }
  };
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
    API_KEY: process.env.EXPO_PUBLIC_API_KEY,
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
      "useAppSettings must be used within an AppSettingsProvider"
    );
  }
  return context;
};
