import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useMemo,
  useRef,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from "react-native-toast-message";
import { useAuth } from "./AuthContext";
import { useUserProfile } from "./UserProfileContext";
import { AVATARS as avatars, clampAvatarIndex } from "../utils/avatars";
import { i18nText } from "../utils/i18nText";

const ProfileUiContext = createContext();
export const useProfileUi = () => useContext(ProfileUiContext);

export const ProfileUiProvider = ({ children }) => {
  const { user } = useAuth();
  const { profile, changeAvatarIndex } = useUserProfile();
  const uid = user?.uid;

  const [selectAvatarIndex, setSelectAvatarIndex] = useState(0);
  const [avatarHydrating, setAvatarHydrating] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [gridStyle, setGridStyle] = useState(1);
  const [allCornersRounded, setAllCornersRounded] = useState(false);
  const firestoreAvatarUidRef = useRef(null);
  const avatarSavingRef = useRef(false);

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
      Toast.show({
        type: "error",
        text1: i18nText(
          "autoI18n.gorunum_ayari_kaydedilemedi",
          "Görünüm ayarı kaydedilemedi"
        ),
      });
    }
  };

  const saveAllCornersRounded = async (isRounded) => {
    try {
      await AsyncStorage.setItem(
        "allCornersRounded",
        isRounded ? "true" : "false"
      );
      setAllCornersRounded(isRounded);
    } catch (err) {
      Toast.show({
        type: "error",
        text1: i18nText("autoI18n.ayarlar_kaydedilemedi", "Ayar kaydedilemedi"),
      });
    }
  };

  // AsyncStorage yalnız hızlı başlangıç önbelleğidir. Firestore profili geldiyse
  // geç gelen local okuma güncel server index'inin üzerine yazamaz.
  useEffect(() => {
    let cancelled = false;
    firestoreAvatarUidRef.current = null;
    if (!uid) {
      setSelectAvatarIndex(0);
      return undefined;
    }
    setAvatarHydrating(true);
    AsyncStorage.getItem(`avatar_${uid}`)
      .then((stored) => {
        if (
          !cancelled &&
          stored !== null &&
          firestoreAvatarUidRef.current !== uid
        ) {
          const index = clampAvatarIndex(parseInt(stored, 10));
          setSelectAvatarIndex(index);
        }
      })
      .catch(() =>
        Toast.show({
          type: "error",
          text1: i18nText("autoI18n.avatar_yuklenemedi", "Avatar yüklenemedi"),
        })
      )
      .finally(() => {
        if (!cancelled) setAvatarHydrating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  // Firestore gerçek kaynak: profil snapshot'ı geldiğinde hem UI hem local cache
  // aynı güvenli index'e çekilir. Bu ayrıca başka cihazdaki seçimi de taşır.
  useEffect(() => {
    if (
      !uid ||
      profile?.uid !== uid ||
      typeof profile?.avatarIndex !== "number"
    ) {
      return;
    }
    const index = clampAvatarIndex(profile.avatarIndex);
    firestoreAvatarUidRef.current = uid;
    setSelectAvatarIndex(index);
    setAvatarHydrating(false);
    AsyncStorage.setItem(`avatar_${uid}`, String(index)).catch(() => {});
  }, [uid, profile?.uid, profile?.avatarIndex]);

  // Tek kalıcı seçim yolu. UI optimistic güncellenir; Firestore yazısı başarısız
  // olursa hem state hem local cache önceki değere geri alınır.
  const selectAvatar = useCallback(
    async (nextIndex) => {
      if (!uid || avatarSavingRef.current) return false;
      const index = clampAvatarIndex(nextIndex);
      if (index === selectAvatarIndex) {
        setModalVisible(false);
        return true;
      }

      const previous = selectAvatarIndex;
      avatarSavingRef.current = true;
      setAvatarSaving(true);
      setSelectAvatarIndex(index);
      try {
        await changeAvatarIndex(index);
        AsyncStorage.setItem(`avatar_${uid}`, String(index)).catch(() => {});
        setModalVisible(false);
        return true;
      } catch (error) {
        setSelectAvatarIndex(previous);
        AsyncStorage.setItem(`avatar_${uid}`, String(previous)).catch(() => {});
        Toast.show({
          type: "error",
          text1: i18nText(
            "autoI18n.avatar_kaydedilemedi",
            "Avatar kaydedilemedi"
          ),
          text2: error?.message,
        });
        throw error;
      } finally {
        avatarSavingRef.current = false;
        setAvatarSaving(false);
      }
    },
    [uid, selectAvatarIndex, changeAvatarIndex]
  );

  const avatar = avatars[selectAvatarIndex] || avatars[0];
  const isloadingAvatar = avatarHydrating || avatarSaving;

  const value = useMemo(
    () => ({
      avatar,
      avatars,
      selectAvatarIndex,
      setSelectAvatarIndex,
      selectAvatar,
      isloadingAvatar,
      modalVisible,
      setModalVisible,
      gridStyle,
      setGridStyle,
      saveListGridStyle,
      allCornersRounded,
      setAllCornersRounded,
      saveAllCornersRounded,
    }),
    [
      avatar,
      selectAvatarIndex,
      selectAvatar,
      isloadingAvatar,
      modalVisible,
      gridStyle,
      allCornersRounded,
    ]
  );

  return (
    <ProfileUiContext.Provider value={value}>
      {children}
    </ProfileUiContext.Provider>
  );
};
