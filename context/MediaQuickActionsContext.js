// context/MediaQuickActionsContext.js
//
// Ana ekran raylarındaki bir postere BASILI TUTUNCA açılan hızlı eylem sayfası
// (components/modals/MediaQuickActionsSheet.js) için tek durum noktası.
//
// NEDEN CONTEXT: sayfayı film ve dizi ana ekranlarındaki ~15 farklı ray
// besliyor. Her rayın kendi modal durumunu tutması, aynı sayfanın onlarca kez
// mount edilmesi ve her rayın kendi TMDB isteğini açması demekti. Burada tek
// örnek var; raylar yalnızca "şunu aç" diyor.
//
// `navigation` bilerek çağıran taraftan alınıyor: sayfa sağlayıcı ağacında
// NavigationContainer'ın DIŞINDA duruyor (RN Modal ayrı bir katman), kendi
// navigation'ını okuyamaz. Rayların elinde zaten geçerli bir navigation var.

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import * as Haptics from "@services/hapticsService";
import { useHapticsSettings } from "./AppSettingsContext";
import MediaQuickActionsSheet from "../components/modals/MediaQuickActionsSheet";

const NOOP = () => {};

const MediaQuickActionsContext = createContext({
  openQuickActions: NOOP,
  closeQuickActions: NOOP,
});

export const useMediaQuickActions = () => useContext(MediaQuickActionsContext);

/**
 * Ray öğesini (TMDB listesi ya da izlenen-dizi kaydı) sayfanın beklediği sabit
 * biçime indirger. Alan adları kaynağa göre değişiyor:
 *   TMDB:      title/name, poster_path, release_date/first_air_date
 *   watchedTv: name, imagePath
 */
const normalizeMedia = (item, mediaType) => {
  if (!item || item.id == null) return null;
  if (mediaType !== "movie" && mediaType !== "tv") return null;
  return {
    id: item.id,
    mediaType,
    title: item.title || item.name || "",
    posterPath: item.poster_path ?? item.imagePath ?? null,
    backdropPath: item.backdrop_path ?? null,
    voteAverage: Number(item.vote_average) || 0,
    voteCount: Number(item.vote_count) || 0,
    releaseDate: item.release_date || item.first_air_date || null,
  };
};

export const MediaQuickActionsProvider = ({ children }) => {
  const [target, setTarget] = useState(null);
  // `onDismiss` kapanış anında hedeften okunuyor; state'i updater içinde
  // okumak yan etkiyi StrictMode'da iki kez çalıştırırdı.
  const targetRef = useRef(null);
  const { hapticsEnabled } = useHapticsSettings();

  const setActiveTarget = useCallback((next) => {
    targetRef.current = next;
    setTarget(next);
  }, []);

  // `onDismiss` (isteğe bağlı): sayfa yalnızca KAPATILINCA — dışarı dokunuş,
  // X, geri tuşu — çağrılır. Başka bir sayfaya/ekrana devredilirken (detay,
  // puan, tarih…) çağrılmaz. Sayfayı bir Modal'ın içinden açan çağıran, o
  // Modal'ı kapatıp açtığı için, vazgeçilince geri açmak için bunu kullanır.
  const openQuickActions = useCallback(
    ({ item, mediaType, navigation, onDismiss }) => {
      const media = normalizeMedia(item, mediaType);
      // navigation olmadan sayfanın alt yönlendirmeleri ölü düğmeye dönerdi;
      // eksikse hiç açma.
      if (!media || !navigation) return;
      if (hapticsEnabled) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      setActiveTarget({ media, navigation, onDismiss });
    },
    [hapticsEnabled, setActiveTarget],
  );

  const closeQuickActions = useCallback(
    () => setActiveTarget(null),
    [setActiveTarget],
  );

  const dismissQuickActions = useCallback(() => {
    const onDismiss = targetRef.current?.onDismiss;
    setActiveTarget(null);
    onDismiss?.();
  }, [setActiveTarget]);

  const value = useMemo(
    () => ({ openQuickActions, closeQuickActions }),
    [openQuickActions, closeQuickActions],
  );

  return (
    <MediaQuickActionsContext.Provider value={value}>
      {children}
      <MediaQuickActionsSheet
        target={target}
        onClose={closeQuickActions}
        onDismiss={dismissQuickActions}
      />
    </MediaQuickActionsContext.Provider>
  );
};

export default MediaQuickActionsContext;
