import React, {
  createContext, useContext, useEffect, useState, useMemo,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from "react-native-toast-message";
import { useAuth } from "./AuthContext";
import { AVATARS as avatars, clampAvatarIndex } from "../utils/avatars";
import { i18nText } from "../utils/i18nText";


const ProfileUiContext = createContext();
export const useProfileUi = () => useContext(ProfileUiContext);

export const ProfileUiProvider = ({ children }) => {
  const { user } = useAuth();
  const uid = user?.uid;

  const [avatar,            setAvatar]            = useState(avatars[0]);
  const [selectAvatarIndex, setSelectAvatarIndex] = useState(0);
  const [isloadingAvatar,   setIsLoadingAvatar]   = useState(false);
  const [modalVisible,      setModalVisible]      = useState(false);
  const [gridStyle,         setGridStyle]         = useState(1);
  const [allCornersRounded, setAllCornersRounded] = useState(false);

  // Load grid style preference
  useEffect(() => {
    AsyncStorage.getItem("listGridStyle")
      .then((val) => {
        if (val === "true" || val === "1") setGridStyle(1);
        else if (val === "false" || val === "2") setGridStyle(2);
        else if (val === "3") setGridStyle(3);
        else if (val === "4") setGridStyle(4);
        else if (val !== null) setGridStyle(1);
      })
      .catch(() => {});

    AsyncStorage.getItem("allCornersRounded")
      .then((val) => {
        if (val !== null) setAllCornersRounded(val === "true");
      })
      .catch(() => {});
  }, [uid]);

  const saveListGridStyle = async (styleId) => {
    try {
      await AsyncStorage.setItem("listGridStyle", String(styleId));
      setGridStyle(styleId);
    } catch (err) {
      Toast.show({ type: "error", text1: i18nText("autoI18n.gorunum_ayari_kaydedilemedi", "Görünüm ayarı kaydedilemedi") });
    }
  };

  const saveAllCornersRounded = async (isRounded) => {
    try {
      await AsyncStorage.setItem("allCornersRounded", isRounded ? "true" : "false");
      setAllCornersRounded(isRounded);
    } catch (err) {
      Toast.show({ type: "error", text1: i18nText("autoI18n.ayarlar_kaydedilemedi", "Ayar kaydedilemedi") });
    }
  };

  // Load avatar from AsyncStorage
  useEffect(() => {
    if (!uid) return;
    setIsLoadingAvatar(true);
    AsyncStorage.getItem(`avatar_${uid}`)
      .then((stored) => {
        if (stored !== null) {
          const index = clampAvatarIndex(parseInt(stored, 10));
          setAvatar(avatars[index]);
          setSelectAvatarIndex(index);
        }
      })
      .catch(() => Toast.show({ type: "error", text1: i18nText("autoI18n.avatar_yuklenemedi", "Avatar yüklenemedi") }))
      .finally(() => setIsLoadingAvatar(false));
  }, [uid]);

  // Persist avatar when user picks a new one — hem AsyncStorage hem Firestore
  useEffect(() => {
    if (!uid) return;
    setIsLoadingAvatar(true);
    // 1) Hızlı local cache
    AsyncStorage.setItem(`avatar_${uid}`, selectAvatarIndex.toString())
      .then(() => {
        setAvatar(avatars[selectAvatarIndex]);
        setModalVisible(false);
      })
      .catch(() => Toast.show({ type: "error", text1: "Avatar kaydedilemedi" }))
      .finally(() => setIsLoadingAvatar(false));

    // 2) Firestore'a yansıt — best effort. UserProfileContext snapshot ile
    //    diğer ekranlara propagate eder. Hata Toast üretmiyoruz çünkü
    //    AsyncStorage zaten kaydedildi.
    import("../services/userService")
      .then(({ setAvatarIndex }) => setAvatarIndex(uid, selectAvatarIndex))
      .catch(() => {});
  }, [selectAvatarIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo(() => ({
    avatar, avatars, selectAvatarIndex, setSelectAvatarIndex,
    isloadingAvatar, modalVisible, setModalVisible,
    gridStyle, setGridStyle, saveListGridStyle,
    allCornersRounded, setAllCornersRounded, saveAllCornersRounded,
  }), [avatar, selectAvatarIndex, isloadingAvatar, modalVisible, gridStyle, allCornersRounded]);

  return (
    <ProfileUiContext.Provider value={value}>
      {children}
    </ProfileUiContext.Provider>
  );
};
