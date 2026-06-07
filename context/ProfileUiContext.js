import React, {
  createContext, useContext, useEffect, useState, useMemo,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from "react-native-toast-message";
import { useAuth } from "./AuthContext";

// Avatar assets — defined at module level (stable reference, no re-require on render)
const avatars = [
  require("../assets/avatar/0.png"),  require("../assets/avatar/1.png"),
  require("../assets/avatar/2.png"),  require("../assets/avatar/3.png"),
  require("../assets/avatar/4.png"),  require("../assets/avatar/5.png"),
  require("../assets/avatar/6.png"),  require("../assets/avatar/7.png"),
  require("../assets/avatar/8.png"),  require("../assets/avatar/9.png"),
  require("../assets/avatar/10.png"), require("../assets/avatar/11.png"),
  require("../assets/avatar/12.png"), require("../assets/avatar/13.png"),
  require("../assets/avatar/14.png"), require("../assets/avatar/15.png"),
  require("../assets/avatar/16.png"), require("../assets/avatar/17.png"),
  require("../assets/avatar/18.png"), require("../assets/avatar/19.png"),
  require("../assets/avatar/20.png"), require("../assets/avatar/21.png"),
  require("../assets/avatar/22.png"), require("../assets/avatar/23.png"),
  require("../assets/avatar/24.png"), require("../assets/avatar/25.png"),
  require("../assets/avatar/26.png"), require("../assets/avatar/27.png"),
  require("../assets/avatar/28.png"), require("../assets/avatar/29.png"),
  require("../assets/avatar/30.png"), require("../assets/avatar/31.png"),
  require("../assets/avatar/32.png"), require("../assets/avatar/33.png"),
  require("../assets/avatar/34.png"), require("../assets/avatar/35.png"),
  require("../assets/avatar/36.png"), require("../assets/avatar/37.png"),
  require("../assets/avatar/38.png"), require("../assets/avatar/39.png"),
  require("../assets/avatar/40.png"), require("../assets/avatar/41.png"),
  require("../assets/avatar/42.png"), require("../assets/avatar/43.png"),
  require("../assets/avatar/44.png"), require("../assets/avatar/45.png"),
  require("../assets/avatar/46.png"), require("../assets/avatar/47.png"),
  require("../assets/avatar/48.png"), require("../assets/avatar/49.png"),
  require("../assets/avatar/50.png"), require("../assets/avatar/51.png"),
  require("../assets/avatar/52.png"), require("../assets/avatar/53.png"),
  require("../assets/avatar/54.png"), require("../assets/avatar/55.png"),
];

const ProfileUiContext = createContext();
export const useProfileUi = () => useContext(ProfileUiContext);

export const ProfileUiProvider = ({ children }) => {
  const { user } = useAuth();
  const uid = user?.uid;

  const [avatar,            setAvatar]            = useState(avatars[0]);
  const [selectAvatarIndex, setSelectAvatarIndex] = useState(0);
  const [isloadingAvatar,   setIsLoadingAvatar]   = useState(false);
  const [modalVisible,      setModalVisible]      = useState(false);
  const [gridStyle,         setGridStyle]         = useState(true);

  // Load grid style preference
  useEffect(() => {
    AsyncStorage.getItem("listGridStyle")
      .then((val) => { if (val !== null) setGridStyle(val === "true"); })
      .catch(() => {});
  }, [uid]);

  const saveListGridStyle = async (isGrid) => {
    try {
      await AsyncStorage.setItem("listGridStyle", isGrid ? "true" : "false");
      setGridStyle(isGrid);
    } catch (err) {
      Toast.show({ type: "error", text1: "Görünüm ayarı kaydedilemedi" });
    }
  };

  // Load avatar from AsyncStorage
  useEffect(() => {
    if (!uid) return;
    setIsLoadingAvatar(true);
    AsyncStorage.getItem(`avatar_${uid}`)
      .then((stored) => {
        if (stored !== null) {
          const index = parseInt(stored);
          setAvatar(avatars[index]);
          setSelectAvatarIndex(index);
        }
      })
      .catch(() => Toast.show({ type: "error", text1: "Avatar yüklenemedi" }))
      .finally(() => setIsLoadingAvatar(false));
  }, [uid]);

  // Persist avatar when user picks a new one
  useEffect(() => {
    if (!uid) return;
    setIsLoadingAvatar(true);
    AsyncStorage.setItem(`avatar_${uid}`, selectAvatarIndex.toString())
      .then(() => {
        setAvatar(avatars[selectAvatarIndex]);
        setModalVisible(false);
      })
      .catch(() => Toast.show({ type: "error", text1: "Avatar kaydedilemedi" }))
      .finally(() => setIsLoadingAvatar(false));
  }, [selectAvatarIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo(() => ({
    avatar, avatars, selectAvatarIndex, setSelectAvatarIndex,
    isloadingAvatar, modalVisible, setModalVisible,
    gridStyle, setGridStyle, saveListGridStyle,
  }), [avatar, selectAvatarIndex, isloadingAvatar, modalVisible, gridStyle]);

  return (
    <ProfileUiContext.Provider value={value}>
      {children}
    </ProfileUiContext.Provider>
  );
};
