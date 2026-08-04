// hooks/useUpNextQueue.js
//
// "Sıradaki bölüm" kuyruğunun TEK kaynağı. Aynı mantık iki yerden tüketiliyor:
//
//   • TV ana ekranındaki "Devam Eden Dizilerim" rayı (ilk birkaç dizi)
//   • Sıradaki ekranı (tümü, yönetim kipiyle)
//
// Çözümleme, iyimser ilerletme, gizleme tercihleri, işaretleme ve ölçüm burada
// durur; tüketiciler yalnız çizim yapar. İkisi aynı anda mount olabildiği için
// ağ tarafındaki tekrar `resolveUpNextEpisodeCached` ile ortadan kalkar —
// aynı dizi iki kez çözülmez.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Toast from "react-native-toast-message";

import { useApiSettings } from "../context/AppSettingsContext";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useListStatusContext } from "../context/ListStatusContext";
import { ANALYTICS_EVENTS, trackEvent } from "../services/analytics";
import {
  mapWithConcurrency,
  resolveUpNextEpisodeCached,
} from "../services/upNextService";
import {
  loadUpNextPreferences,
  saveUpNextPreferences,
} from "../services/upNextPreferences";
import { markEpisodes } from "../services/watchedTvService";
import { advanceUpNextItem } from "../utils/upNext";
import {
  getWatchedShowActivityTime,
  getWatchedShowProgress,
} from "../utils/watchState";
import { i18nText } from "../utils/i18nText";

/** Cihazın yerel tarihi ("YYYY-MM-DD"); UTC kayması olmadan. */
export const localWatchDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function useUpNextQueue({
  limit = 30,
  concurrency = 4,
  // Ray, ilk kareyi bloklamamak için çözümlemeyi etkileşimler bitene kadar
  // beklet(ebil)ir.
  enabled = true,
  // Ölçümde rayı ekrandan ayırt etmek için: sekmeyi kaldırmadan önce rayın
  // gerçekten kullanıldığını bu alan gösterecek.
  surface = "screen",
} = {}) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { API_KEY } = useApiSettings();
  const { watchedTvMap, watchedTvLoaded } = useListStatusContext();

  // Kartlar dizi başına önbelleklenir: yalnızca imzası değişen dizi yeniden
  // çözülür, geri kalanlar elde kalır. Tek bir işaretleme tüm listeyi yeniden
  // yüklemez.
  const [entries, setEntries] = useState({});
  const entriesRef = useRef(entries);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failedCount, setFailedCount] = useState(0);
  const [hiddenShowIds, setHiddenShowIds] = useState(new Set());
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const viewTracked = useRef(false);
  // Kaydı süren işaretlemeler: bölüm kimliği -> dizi anahtarı.
  const pendingMarks = useRef(new Map());
  // Elle tazelemede disk cache'i de atlanmalı; efekt bunu bir kez tüketir.
  const forceRefreshRef = useRef(false);

  // Çözümleme efekti önbelleği okurken kendini tetiklemesin diye state bir
  // ref'e aynalanır. Bu efekt aşağıdakinden önce tanımlı olmalı.
  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  useEffect(() => {
    let active = true;
    setPreferencesReady(false);
    loadUpNextPreferences(user?.uid).then((preferences) => {
      if (!active) return;
      setHiddenShowIds(new Set(preferences.hiddenShowIds));
      setPreferencesReady(true);
    });
    return () => {
      active = false;
    };
  }, [user?.uid]);

  const allShows = useMemo(
    () =>
      Object.values(watchedTvMap || {})
        .filter(
          (show) =>
            show?.id != null && !getWatchedShowProgress(show).isCompleted
        )
        .sort(
          (a, b) =>
            getWatchedShowActivityTime(b) - getWatchedShowActivityTime(a)
        ),
    [watchedTvMap]
  );

  // Tercihler okunmadan liste verilmez: aksi halde gizlenmiş diziler bir kare
  // görünüp kaybolur (rayda posterler doğrudan bu listeden çizildiği için
  // gözle görülür bir sıçrama olurdu).
  const visibleShows = useMemo(
    () =>
      preferencesReady
        ? allShows.filter((show) => !hiddenShowIds.has(String(show.id)))
        : [],
    [allShows, hiddenShowIds, preferencesReady]
  );

  const shows = useMemo(
    () => visibleShows.slice(0, limit),
    [limit, visibleShows]
  );

  // Bir dizinin kartı yalnızca izleme ilerlemesi, dil ya da elle tazeleme
  // değiştiğinde geçersiz olur; imza bunları tek dizeye toplar.
  const signatureFor = useCallback(
    (show) =>
      [
        language,
        refreshToken,
        getWatchedShowProgress(show).watched,
        getWatchedShowActivityTime(show),
      ].join("|"),
    [language, refreshToken]
  );

  const progressSignature = useMemo(
    () => shows.map((show) => `${show.id}#${signatureFor(show)}`).join("~"),
    [shows, signatureFor]
  );

  useEffect(() => {
    if (!enabled || !watchedTvLoaded || !preferencesReady) return undefined;
    let alive = true;

    const targets = shows.map((show) => ({
      show,
      key: String(show.id),
      signature: signatureFor(show),
    }));
    const pending = targets.filter(
      ({ key, signature }) => entriesRef.current[key]?.signature !== signature
    );

    const trackFirstView = (resolvedNow) => {
      if (viewTracked.current) return;
      viewTracked.current = true;
      const list = targets
        .map(({ key }) =>
          resolvedNow.has(key)
            ? resolvedNow.get(key)
            : entriesRef.current[key]?.item
        )
        .filter(Boolean);
      trackEvent(ANALYTICS_EVENTS.UP_NEXT_VIEWED, {
        surface,
        ready_count: list.filter((item) => item.isAired).length,
        upcoming_count: list.filter((item) => !item.isAired).length,
        tracked_show_count: targets.length,
      });
    };

    if (pending.length === 0) {
      setLoading(false);
      setRefreshing(false);
      // Ekrana kullanıcı bilerek geldiği için boş liste de bir görüntülemedir;
      // ray ise hiç çizilmediğinde görüntülenmiş sayılmaz (bkz. TvOngoingSection
      // dizi yoksa null döner) — yoksa her açılışta sahte olay üretirdi.
      if (targets.length > 0 || surface === "screen") trackFirstView(new Map());
      return undefined;
    }

    // Tam ekran yükleme yalnızca gösterilecek kart hiç yokken çıkar; aksi
    // halde eldeki kartlar dururken değişen dizi arka planda tazelenir.
    const hasVisibleCard = targets.some(
      ({ key }) => entriesRef.current[key]?.item
    );
    if (!refreshing && !hasVisibleCard) setLoading(true);

    const force = forceRefreshRef.current;
    forceRefreshRef.current = false;

    (async () => {
      const resolvedNow = new Map();
      let failures = 0;

      await mapWithConcurrency(
        pending,
        concurrency,
        async ({ show, key, signature }) => {
          try {
            const item = await resolveUpNextEpisodeCached(show, {
              apiKey: API_KEY,
              language: language === "en" ? "en-US" : "tr-TR",
              refresh: force,
            });
            if (!alive) return null;
            resolvedNow.set(key, item);
            // Sonuçlar tek tek yazılır; ilk çözülen kart hemen görünür. Kaydı
            // süren bir işaretleme varsa iyimser kart korunur: o kayıt bitince
            // ilerleme imzası değişeceği için burası yeniden çalışacak.
            setEntries((prev) =>
              [...pendingMarks.current.values()].includes(key)
                ? prev
                : { ...prev, [key]: { signature, item } }
            );
          } catch {
            // İmza yazılmadığından bu dizi bir sonraki tazelemede tekrar denenir.
            failures += 1;
          }
          return null;
        }
      );
      if (!alive) return;

      setFailedCount(failures);
      setLoading(false);
      setRefreshing(false);
      trackFirstView(resolvedNow);
    })();

    return () => {
      alive = false;
    };
  }, [
    API_KEY,
    concurrency,
    enabled,
    language,
    preferencesReady,
    progressSignature,
    refreshToken,
    surface,
    watchedTvLoaded,
  ]);

  const refresh = useCallback(() => {
    forceRefreshRef.current = true;
    setRefreshing(true);
    setRefreshToken((value) => value + 1);
  }, []);

  const persistHiddenShows = useCallback(
    async (nextHidden) => {
      setHiddenShowIds(nextHidden);
      const saved = await saveUpNextPreferences(user?.uid, {
        hiddenShowIds: [...nextHidden],
      });
      if (!saved) {
        Toast.show({
          type: "error",
          text1: i18nText(
            "autoI18n.up_next_tercih_hatasi",
            "Dizi tercihin kaydedilemedi."
          ),
        });
      }
    },
    [user?.uid]
  );

  const toggleShow = useCallback(
    (showId) => {
      const next = new Set(hiddenShowIds);
      const key = String(showId);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      persistHiddenShows(next);
    },
    [hiddenShowIds, persistHiddenShows]
  );

  const showAll = useCallback(() => {
    persistHiddenShows(new Set());
  }, [persistHiddenShows]);

  // Sıradaki bölüm hazırda tutulduğu için kart, kayıt bitmesini beklemeden
  // ilerler. Yalnızca bu dizinin kaydı değişir; arka plandaki tazeleme sonucu
  // doğrular. Dönen işlev, kayıt başarısız olursa kartı geri alır.
  const advanceEntry = useCallback((item) => {
    const key = String(item.showId);
    const previous = entriesRef.current[key];
    // Arka plan tazelemesi bizden önce ilerlettiyse dokunma.
    if (previous?.item && previous.item.id !== item.id) return () => {};

    const signature = `advanced:${item.id}`;
    setEntries((prev) => ({
      ...prev,
      [key]: { signature, item: advanceUpNextItem(item) },
    }));

    return () => {
      setEntries((prev) => {
        // Bu arada gerçek veri geldiyse geri alma.
        if (prev[key]?.signature !== signature) return prev;
        // Boş imza kaydı bayat sayar: kart geri döner ve tazelenmeyi bekler.
        return { ...prev, [key]: previous || { signature: "", item } };
      });
    };
  }, []);

  const markWatched = useCallback(
    async (item, watchDate = localWatchDate()) => {
      // Kart hemen ilerlediği için yeniden giriş kilidi bölüm bazında tutulur;
      // aynı bölümün iki kez kaydını engeller ama art arda işaretlemeyi değil.
      if (!user?.uid || !watchDate || pendingMarks.current.has(item.id)) return;
      pendingMarks.current.set(item.id, String(item.showId));
      const revertAdvance = advanceEntry(item);
      try {
        await markEpisodes(
          user.uid,
          {
            id: item.showId,
            name: item.showName,
            showEpisodeCount: item.showEpisodeCount,
            showSeasonCount: item.showSeasonCount,
            imagePath: item.showPosterPath,
            genres: item.genres,
          },
          {
            seasonNumber: item.seasonNumber,
            seasonPosterPath: item.seasonPosterPath,
            seasonEpisodes: item.seasonEpisodes,
          },
          [
            {
              episodeNumber: item.episodeNumber,
              episodePosterPath: item.episodePosterPath,
              episodeName: item.episodeName,
              episodeRatings: item.episodeRatings,
              episodeMinutes: item.episodeMinutes,
            },
          ],
          watchDate,
          { scope: "episode", source: "up_next" }
        );
        trackEvent(ANALYTICS_EVENTS.UP_NEXT_COMPLETED, {
          surface,
          content_id: String(item.showId),
          season_number: item.seasonNumber,
          episode_number: item.episodeNumber,
          date_mode: watchDate === localWatchDate() ? "now" : "custom",
        });
        Toast.show({
          type: "success",
          text1: i18nText(
            "autoI18n.up_next_kaydedildi",
            "Bölüm izlendi olarak işaretlendi"
          ),
        });
      } catch (error) {
        if (__DEV__) {
          console.warn("[UpNext] mark watched:", error?.message || error);
        }
        revertAdvance();
        Toast.show({
          type: "error",
          text1: i18nText(
            "autoI18n.up_next_kayit_hatasi",
            "Bölüm kaydedilemedi."
          ),
        });
      } finally {
        pendingMarks.current.delete(item.id);
      }
    },
    [advanceEntry, surface, user?.uid]
  );

  // `shows` gizlenenleri zaten eler; kart listesi doğrudan ondan türetilir.
  const items = useMemo(
    () =>
      shows
        .map((show) => entries[String(show.id)]?.item)
        .filter(Boolean)
        .sort(
          (a, b) => Number(b.activityTime || 0) - Number(a.activityTime || 0)
        ),
    [entries, shows]
  );

  // Ray posterleri çözümleme bitmeden de çizildiği için dizi -> bölüm eşlemesi
  // ayrıca veriliyor. "Anahtar yok" (henüz çözülmedi) ile "değer null" (çözüldü,
  // sıradaki bölüm yok) farkı bilinçli olarak korunur.
  const itemsByShow = useMemo(() => {
    const map = {};
    shows.forEach((show) => {
      const key = String(show.id);
      if (key in entries) map[key] = entries[key]?.item ?? null;
    });
    return map;
  }, [entries, shows]);

  return {
    allShows,
    shows,
    // `limit` uygulanmadan ÖNCEKİ görünür dizi sayısı: rayın "Tümü" düğmesi
    // listenin kesildiğini bununla söyler.
    totalCount: visibleShows.length,
    items,
    itemsByShow,
    hiddenShowIds,
    loading,
    refreshing,
    failedCount,
    readyCount: items.filter((item) => item.isAired).length,
    allHidden: allShows.length > 0 && preferencesReady && shows.length === 0,
    refresh,
    markWatched,
    toggleShow,
    showAll,
  };
}
