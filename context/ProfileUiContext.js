import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import { AppState, InteractionManager } from "react-native";
import { Keys, get, set, has } from "../services/storage";
import Toast from "@components/AppToast";
import { useAuth } from "./AuthContext";
import { useUserProfile } from "./UserProfileContext";
import {
  AVATARS as avatars,
  CUSTOM_AVATAR_INDEX,
  DEFAULT_AVATAR_INDEX,
  clampAvatarIndex,
  getAvatarSource,
} from "../utils/avatars";
import {
  profileAvatarChoice,
  sameAvatarChoice,
  toAvatarChoice,
} from "../utils/avatarPhotos";
import {
  fetchFreshProviderPhotos,
  getLinkedPhotosState,
  reconcileAvatarPhoto,
  refreshLinkedPhotos,
  subscribeLinkedPhotos,
} from "../services/avatarPhotoSync";
import { i18nText } from "../utils/i18nText";

const ProfileUiContext = createContext();
const NO_PHOTOS = [];

function readCachedAvatarIndex(uid) {
  return uid && has(Keys.avatarIndex, { uid })
    ? clampAvatarIndex(get(Keys.avatarIndex, { uid }))
    : null;
}
export const useProfileUi = () => useContext(ProfileUiContext);

export const ProfileUiProvider = ({ children }) => {
  const { user } = useAuth();
  const { profile, changeAvatarIndex } = useUserProfile();
  const uid = user?.uid;

  const [modalVisible, setModalVisible] = useState(false);
  const [gridStyle, setGridStyle] = useState(() => get(Keys.listGridStyle));
  const [allCornersRounded, setAllCornersRounded] = useState(() =>
    get(Keys.allCornersRounded),
  );
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

  // ── Avatar ────────────────────────────────────────────────────────────────
  //
  // "Kendi avatarım" TEK yerde çözülür: kaydedilmekte olan seçim (iyimser) →
  // Firestore profili → cihazdaki son seçim (profil henüz gelmediyse). Kendi
  // kimliğini gönderiye/yoruma/mesaja yazan her yer `myAvatar`ı
  // (avatarSnapshot ile) kullanır; formülü ayrıca kurmaz.

  const linked = useSyncExternalStore(subscribeLinkedPhotos, getLinkedPhotosState);
  const linkedPhotos = linked.uid === uid ? linked.linkedPhotos : NO_PHOTOS;

  const [cachedIndex, setCachedIndex] = useState(() => readCachedAvatarIndex(uid));
  const [pendingChoice, setPendingChoice] = useState(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const avatarSavingRef = useRef(false);

  useEffect(() => {
    setPendingChoice(null);
    setCachedIndex(readCachedAvatarIndex(uid));
  }, [uid]);

  const profileReady = !!uid && profile?.uid === uid;
  const savedChoice = useMemo(() => {
    if (profileReady) {
      return profileAvatarChoice(profile, {
        fallbackIndex: cachedIndex ?? DEFAULT_AVATAR_INDEX,
        authPhotoURL: user?.photoURL,
      });
    }
    return toAvatarChoice(cachedIndex ?? DEFAULT_AVATAR_INDEX, {
      photoURL: user?.photoURL || linkedPhotos[0]?.uri,
    });
    // profil nesnesinin yalnız avatar alanları önemli
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    profileReady,
    profile?.avatarIndex,
    profile?.photoURL,
    profile?.photoSource,
    cachedIndex,
    user?.photoURL,
    linkedPhotos,
  ]);
  const myAvatar = pendingChoice || savedChoice;

  // Firestore'daki seçim cihaz önbelleğine yansır (sonraki soğuk açılışın ilk
  // karesi için). Başka cihazdaki seçim de bu yoldan gelir.
  useEffect(() => {
    if (!profileReady || typeof profile?.avatarIndex !== "number") return;
    set(Keys.avatarIndex, clampAvatarIndex(profile.avatarIndex), { uid });
  }, [profileReady, profile?.avatarIndex, uid]);

  // Tek kalıcı seçim yolu. Hazır avatar indeksi ya da seçim nesnesi
  // ({ avatarIndex, photoURL, photoSource }) alır; fotoğrafsız -1 gelirse ilk
  // bağlı hesap fotoğrafı kullanılır. UI iyimser güncellenir; yazım düşerse
  // profildeki değer geri gelir.
  const selectAvatar = useCallback(
    async (next) => {
      if (!uid || avatarSavingRef.current) return false;
      const fallbackPhoto = linkedPhotos[0]
        ? { photoURL: linkedPhotos[0].uri, photoSource: linkedPhotos[0].providerId }
        : myAvatar.avatarIndex === CUSTOM_AVATAR_INDEX
          ? myAvatar
          : null;
      const choice = toAvatarChoice(next, fallbackPhoto);
      if (sameAvatarChoice(choice, savedChoice)) {
        setModalVisible(false);
        return true;
      }

      avatarSavingRef.current = true;
      setAvatarSaving(true);
      setPendingChoice(choice);
      try {
        await changeAvatarIndex(choice);
        set(Keys.avatarIndex, choice.avatarIndex, { uid });
        setModalVisible(false);
        return true;
      } catch (error) {
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
        setPendingChoice(null);
        avatarSavingRef.current = false;
        setAvatarSaving(false);
      }
    },
    [uid, linkedPhotos, myAvatar, savedChoice, changeAvatarIndex]
  );

  // Bağlı hesap fotoğraflarını tazele: açılışta (etkileşimler bitince, açılış
  // yolunu yavaşlatmadan), uygulama öne geldikçe (servis kendisi kısar).
  useEffect(() => {
    if (!uid) {
      refreshLinkedPhotos();
      return undefined;
    }
    refreshLinkedPhotos();
    const task = InteractionManager.runAfterInteractions(() => {
      fetchFreshProviderPhotos().catch(() => {});
    });
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") fetchFreshProviderPhotos().catch(() => {});
    });
    return () => {
      task?.cancel?.();
      sub.remove();
    };
  }, [uid]);

  // Fotoğraf avatarı bağlı hesapla uyumlu kalsın: sağlayıcıdaki resim
  // değiştiyse tazele, hesabı kaldırıldıysa hazır avatara dön.
  useEffect(() => {
    if (!profileReady || avatarSavingRef.current) return;
    reconcileAvatarPhoto(uid, {
      uid,
      avatarIndex: profile?.avatarIndex,
      photoURL: profile?.photoURL,
      photoSource: profile?.photoSource,
    }).catch(() => {});
  }, [
    profileReady,
    uid,
    profile?.avatarIndex,
    profile?.photoURL,
    profile?.photoSource,
    linked,
  ]);

  // Fotoğrafta getAvatarSource her çağrıda yeni { uri } döner; sabit tutulmazsa
  // context değeri her render'da değişir ve bütün tüketiciler yeniden çizilir.
  const avatar = useMemo(
    () => getAvatarSource(myAvatar.avatarIndex, myAvatar.photoURL),
    [myAvatar.avatarIndex, myAvatar.photoURL],
  );
  const isloadingAvatar = avatarSaving;
  const selectAvatarIndex = myAvatar.avatarIndex;

  const value = useMemo(
    () => ({
      avatar,
      avatars,
      myAvatar,
      selectAvatarIndex,
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
      linkedPhotos,
    }),
    [
      avatar,
      myAvatar,
      selectAvatarIndex,
      selectAvatar,
      isloadingAvatar,
      modalVisible,
      gridStyle,
      allCornersRounded,
      linkedPhotos,
    ]
  );

  return (
    <ProfileUiContext.Provider value={value}>
      {children}
    </ProfileUiContext.Provider>
  );
};
