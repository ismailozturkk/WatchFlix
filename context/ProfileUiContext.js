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
import { AppState } from "react-native";
import { runAfterInteractions } from "../utils/afterInteractions";
import { Keys, get, set, has } from "../services/storage";
import Toast from "@components/AppToast";
import { useAuth } from "./AuthContext";
import { useUserProfile } from "./UserProfileContext";
import { cooldownRemainingMs } from "../utils/profileIdentityCooldown";
import { identityCooldownToast } from "../utils/profileIdentityCooldownCopy";
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
import { requestPhotoCheck } from "../services/photoRevalidation";
import { OWN_PHOTO_CHECK_TTL_MS, revalidatedUriOf } from "../utils/photoRevalidation";
import useFreshPhotoSource from "../hooks/useFreshPhotoSource";
import { i18nText } from "../utils/i18nText";
import { updateUserProfile } from "../services/userService";
import {
  LIST_COVER_STYLE_FIELD,
  buildListCoverStyle,
  readListCoverStyle,
  sameListCoverStyle,
} from "../utils/listCoverStyle";

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
  const [listLayoutDirections, setListLayoutDirections] = useState(() =>
    get(Keys.listLayoutDirections),
  );
  const listLayoutDirectionsRef = useRef(listLayoutDirections);
  const [allCornersRounded, setAllCornersRounded] = useState(() =>
    get(Keys.allCornersRounded),
  );
  // Görünüm tercihleri yukarıdaki useState başlangıç değerlerinde SENKRON
  // okunuyor; eski iki ayrı hidrasyon effect'i kalktı. "true"/"false" biçimli
  // eski kayıtların sayıya çevrilmesi göçün işi (registry: listGridStyle).

  // Seçilen kapak düzeni profil belgesine de yazılır (Users/{uid}.listCoverStyle):
  // arkadaş profili listeleri SAHİBİN düzeninde çizer. Yalnız kullanıcı bir
  // tercihi değiştirdiğinde (ya da alan hiç yokken bir kez) yazılır — iki
  // cihaz farklı yerel tercihle açıkken birbirini ezip durmasın.
  const coverStyleDirtyRef = useRef(false);
  const markCoverStyleDirty = () => {
    coverStyleDirtyRef.current = true;
  };

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
    markCoverStyleDirty();
    setGridStyle(styleId);
  };

  const saveListLayoutDirection = (styleId, direction) => {
    if (![8, 10, 11].includes(styleId) || !["left", "right"].includes(direction)) return;
    const next = { ...listLayoutDirectionsRef.current, [styleId]: direction };
    if (!set(Keys.listLayoutDirections, next)) return;
    listLayoutDirectionsRef.current = next;
    markCoverStyleDirty();
    setListLayoutDirections(next);
  };

  const saveAllCornersRounded = async (isRounded) => {
    if (!set(Keys.allCornersRounded, !!isRounded)) {
      Toast.show({
        type: "error",
        text1: i18nText("autoI18n.ayarlar_kaydedilemedi", "Ayar kaydedilemedi"),
      });
      return;
    }
    markCoverStyleDirty();
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
    // Kişi fotoğrafı etiketi ({ id, name }): nesne her anlık görüntüde yeni
    // gelir, alanlarına bağlanılır.
    profile?.photoPerson?.id,
    profile?.photoPerson?.name,
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

  // Kapak düzenini profile yayınla (bkz. coverStyleDirtyRef). Kısa gecikme:
  // modalda art arda yapılan seçimler tek yazıma iner.
  const publishedCoverStyle = profileReady ? readListCoverStyle(profile) : null;
  const hasPublishedCoverStyle = !!publishedCoverStyle;
  useEffect(() => {
    if (!profileReady) return undefined;
    if (!coverStyleDirtyRef.current && hasPublishedCoverStyle) return undefined;
    const next = buildListCoverStyle({ gridStyle, allCornersRounded, listLayoutDirections });
    if (!next) return undefined;
    if (sameListCoverStyle(next, publishedCoverStyle)) {
      coverStyleDirtyRef.current = false;
      return undefined;
    }
    const timer = setTimeout(() => {
      coverStyleDirtyRef.current = false;
      updateUserProfile(uid, { [LIST_COVER_STYLE_FIELD]: next }).catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
    // publishedCoverStyle her anlık görüntüde yeni nesne; alanlarına bağlı.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    profileReady,
    uid,
    gridStyle,
    allCornersRounded,
    listLayoutDirections,
    hasPublishedCoverStyle,
    publishedCoverStyle?.gridStyle,
    publishedCoverStyle?.rounded,
    publishedCoverStyle?.direction,
  ]);

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

      // Ad/avatar değişimi tüm geçmişi yeniden yazdırıyor (profil yayılımı): günde bir.
      const remaining = cooldownRemainingMs(profile?.identityChangedAt);
      if (remaining > 0) {
        Toast.show(identityCooldownToast(remaining));
        return false;
      }

      avatarSavingRef.current = true;
      setAvatarSaving(true);
      setPendingChoice(choice);
      try {
        await changeAvatarIndex(choice, null, { stampIdentity: true });
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
    const task = runAfterInteractions(() => {
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
  const avatarSource = useMemo(
    () => getAvatarSource(myAvatar.avatarIndex, myAvatar.photoURL),
    [myAvatar.avatarIndex, myAvatar.photoURL],
  );
  // Google'da değiştirilen fotoğraf AYNI adresten gelir; cihazdaki eski kopya
  // açılışta ve uygulama öne geldikçe (kısmalı) denetlenir. Sürümlü kaynak
  // (`cacheKey`'li) tüketicilere geçer — UserAvatar onu ayrıca denetlemez.
  const avatar = useFreshPhotoSource(avatarSource, {
    maxAgeMs: OWN_PHOTO_CHECK_TTL_MS,
    priority: true,
  });
  const ownPhotoUri = revalidatedUriOf(avatarSource);
  useEffect(() => {
    if (!ownPhotoUri) return undefined;
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        requestPhotoCheck(ownPhotoUri, { maxAgeMs: OWN_PHOTO_CHECK_TTL_MS, priority: true });
      }
    });
    return () => sub.remove();
  }, [ownPhotoUri]);
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
      listLayoutDirections,
      saveListLayoutDirection,
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
      listLayoutDirections,
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
