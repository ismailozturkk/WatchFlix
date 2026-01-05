import React, { createContext, useState, useEffect, useContext } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from "react-native-toast-message";

const SnowContext = createContext();

export const SnowProvider = ({ children }) => {
  const [showSnow, setShowSnow] = useState(false);

  useEffect(() => {
    const loadShowSnow = async () => {
      try {
        const savedShowSnow = await AsyncStorage.getItem("showSnow");
        if (savedShowSnow !== null) {
          setShowSnow(JSON.parse(savedShowSnow));
        }
      } catch (error) {
        Toast.show({
          type: "error",
          text1: "ShowSnow yüklenemedi:" + error,
        });
      }
    };
    loadShowSnow();
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

  const value = {
    showSnow,
    changeShowSnow,
  };

  return <SnowContext.Provider value={value}>{children}</SnowContext.Provider>;
};

export const useSnow = () => {
  const context = useContext(SnowContext);
  if (context === undefined) {
    throw new Error("useSnow must be used within a SnowProvider");
  }
  return context;
};
