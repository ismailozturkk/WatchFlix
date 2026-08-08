import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useMemo,
  useRef,
} from "react";
import { Keys, get, set, has } from "../services/storage";
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
  const [gridStyle, setGridStyle] = useState(() => get(Keys.listGridStyle));
  const [allCornersRounded, setAllCornersRounded] = useState(() =>
    get(Keys.allCornersRounded),
  );
  const firestoreAvatarUidRef = useRef(null);
  const avatarSavingRef = useRef(false);

  // Görünüm tercihleri yukarıdaki useState başlangıç değerlerinde SENKRON
  // okunuyor; eski iki ayrı hidrasyon effect'i kalktı. "true"/"false" biçimli
  // eski kayıtların sayıya çevrilmesi göçün işi (registry: listGridStyle).

  const saveListGridStyle = async (styleId) => {
    if (!set(Keys.listGridStyle, styleId)) {
      Toast.show({
        type: "error",
        text1: i18nText(
          "autoI18n.gorunum_ayari_kaydedilemedi",
          "Görünüm ayarı kaydedilemedi"
        ),
      });
      return;
    }
    setGridStyle(styleId);
  };

  const saveAllCornersRounded = async (isRounded) => {
    if (!set(Keys.allCornersRounded, !!isRounded)) {
      Toast.show({
        type: "error",
        text1: i18nText("autoI18n.ayarlar_kaydedilemedi", "Ayar kaydedilemedi"),
      });
      return;
    }
    setAllCornersRounded(isRounded);
  };

  // Yerel kayıt yalnız hızlı başlangıç önbelleğidir; gerçek kaynak Firestore.
  //
  // MMKV GEÇİŞİ: okuma senkron olduğu için "geç gelen local okuma güncel server
  // index'ini ezmesin" koruması (cancelled bayrağı + firestoreAvatarUidRef
  // kontrolü) gereksizleşti — local okuma Firestore snapshot'ından ÖNCE bitiyor.
  // Kullanıcı ayrıca avatarını bir kare gecikmeyle değil, ilk render'da görüyor.
  useEffect(() => {
    firestoreAvatarUidRef.current = null;
    if (!uid) {
      setSelectAvatarIndex(0);
      return;
    }
    if (has(Keys.avatarIndex, { uid })) {
      setSelectAvatarIndex(clampAvatarIndex(get(Keys.avatarIndex, { uid })));
    }
    setAvatarHydrating(false);
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
    set(Keys.avatarIndex, index, { uid });
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
        set(Keys.avatarIndex, index, { uid });
        setModalVisible(false);
        return true;
      } catch (error) {
        setSelectAvatarIndex(previous);
        set(Keys.avatarIndex, previous, { uid });
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
