// components/modals/MediaQuickActionsSheet.js
//
// Ana ekran raylarındaki bir postere BASILI TUTUNCA açılan hızlı eylem sayfası.
// İçeriği detay ekranının üst bloğunun birebir küçültülmüş hâlidir:
//
//   1. Poster başlığı  → backdrop + poster + ad + tür çipleri + RatingSummary
//   2. Listeler        → detay ekranının KENDİ bileşenleri (ListView/ListViewTv)
//   3. Yönlendirmeler  → dizide "Bölüm Puan Grafiği" (TvGraphDetailScreen),
//                        her iki türde tam detay ekranı
//
// ── NEDEN LİSTE BİLEŞENLERİ YENİDEN YAZILMADI ────────────────────────────────
// `ListView` (film) ve `ListViewTv` (dizi) burada aynı proplarla kullanılıyor.
// Böylece rozet renkleri, iyimser (optimistic) durum, dokunsal geri bildirim,
// "Diğer Listeler" ızgarası ve ortak listeler bölümü detay ekranıyla birebir
// aynı davranıyor; ikinci bir kopya bakımsız kalıp sessizce ayrışmıyor.
//
// ── MODAL DERİNLİĞİ ──────────────────────────────────────────────────────────
// RN'de iç içe Modal maliyetli ve platformlara göre kırılgan. Bu yüzden izleme
// tarihi / izleme geçmişi / puan sayfaları bu sayfanın İÇİNDE değil, KARDEŞİ
// olarak duruyor: bir eylem seçildiğinde önce bu sayfa kapanır, kısa bir gecikme
// sonrası diğeri açılır (WatchHistorySheet'in "tekrar ekle" akışındaki desen).
// Böylece aynı anda en fazla iki katman üst üste gelir — ListView'in kendi
// "Diğer Listeler" ızgarası + bu sayfa — ki bu, uygulamada zaten kanıtlanmış
// derinlik (WatchedDateSheet → DatePickerModal).

import { intlLocaleOf } from "../../utils/appLanguages";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import axios from "axios";
import Toast from "@components/AppToast";
import useUserDataDomain from "../../hooks/useUserDataDomain";
import { remindersActions, remindersDomain } from "../../services/userData";

import ModalBlurBackdrop from "../common/ModalBlurBackdrop";
import PosterImage from "../PosterImage";
import ListView from "../ListView";
import ListViewTv from "../ListViewTv";
import Reminder from "../Reminder";
import RatingSummary from "../RatingSummary";
import RatingSheetModal from "./RatingSheetModal";
import WatchHistorySheet from "./WatchHistorySheet";
import WatchedDateSheet from "../detail/WatchedDateSheet";

import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { useDeviceNotifications } from "../../context/DeviceNotificationsContext";
import {
  useApiSettings,
  useImageQualitySettings,
} from "../../context/AppSettingsContext";
import useBackdropUri from "../../hooks/useBackdropUri";
import { useListStatusContext } from "../../context/ListStatusContext";
import { useWatchedShow } from "../../hooks/useWatchedShow";
import useReminderGate from "../../hooks/useReminderGate";
import { PREDEFINED_MOVIE_LISTS } from "../../services/listItemsService";
import {
  markMovieWatched,
  markShowWatched,
  removeMovieWatch,
  removeTvWatch,
  setListMembership,
} from "../../services/libraryActions";
import {
  customListHas,
  listItemFromDetails,
  movieWatchItemFromDetails,
} from "../../utils/libraryCore";
import { showLibraryError, showWatchSpreadNotice } from "../../utils/libraryErrorText";
import { movieWatchEvents } from "../../utils/watchHistory";
import { getCachedValue, setCachedValue, TTL } from "../../utils/apiCache";
import { i18nText } from "../../utils/i18nText";
import { alpha } from "../../theme/colors";
import {
  RELEASE_STATE,
  WATCH_STATE,
  getReleaseState,
  getWatchState,
  isAired,
} from "../../utils/watchState";

import ModalToastHost from "@components/toast/ModalToastHost";
import GlassTouchable from "../common/GlassTouchable";
const { width, height } = Dimensions.get("window");
const BACKDROP_H = Math.round(width * (9 / 16) * 0.72);
const POSTER_W = Math.round(width * 0.25);
// Kapanış animasyonu ile bir sonraki sayfanın açılışı arasındaki nefes payı.
// WatchHistorySheet'in "tekrar ekle" akışında kullanılan değerle aynı.
const HANDOFF_MS = 220;

const formatDateSave = (value) => {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
};

/* ── Alt yönlendirme satırı ──────────────────────────────────────────────── */
const ActionRow = ({ icon, tint, title, subtitle, onPress, theme }) => (
  <GlassTouchable
    activeOpacity={0.85}
    onPress={onPress}
    style={[
      styles.actionRow,
      { backgroundColor: theme.secondary, borderColor: theme.border },
    ]}
  >
    <View style={[styles.actionIcon, { backgroundColor: alpha(tint, 0.18) }]}>
      <Ionicons name={icon} size={18} color={tint} />
    </View>
    <View style={styles.actionCopy}>
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[styles.actionTitle, { color: theme.text.primary }]}
      >
        {title}
      </Text>
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[styles.actionSub, { color: theme.text.muted }]}
      >
        {subtitle}
      </Text>
    </View>
    <Ionicons name="chevron-forward" size={16} color={theme.text.muted} />
  </GlassTouchable>
);

// `onClose`  → sayfayı kapatır; devir akışları (detay, puan, tarih…) bunu kullanır.
// `onDismiss` → kullanıcı vazgeçti (dışarı dokunuş, X, geri tuşu); sağlayıcı
//               hedefin `onDismiss` geri çağrısını da çalıştırır. Verilmezse
//               `onClose`a düşer.
export default function MediaQuickActionsSheet({ target, onClose, onDismiss }) {
  const handleDismiss = onDismiss || onClose;
  const { theme } = useTheme();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { needsPermissionPriming, primeNotificationPermission } =
    useDeviceNotifications();
  const reminderGate = useReminderGate();
  const { API_KEY } = useApiSettings();
  const { getTmdbUrl } = useImageQualitySettings();
  const backdropUri = useBackdropUri();
  const { allLists, statusIndex, watchedMoviesItems } = useListStatusContext();

  // `target` kapanınca null olur; içerik kapanış animasyonu boyunca çizilmeye
  // devam etsin (ve devamındaki tarih/geçmiş sayfaları veriyi bulsun) diye son
  // hedef ayrıca tutulur.
  //
  // GÖSTERİLEN HEDEF RENDER SIRASINDA TÜRETİLİR. `shown`ı bir effect'te
  // güncellemek yetmiyordu: effect render'dan SONRA koşuyor, dolayısıyla yeni
  // bir postere basıldığında sayfa bir kare ÖNCEKİ yapımın bilgisiyle açılıp
  // hemen ardından güncelleniyordu. `target` varken doğrudan onu çiziyoruz.
  const [shown, setShown] = useState(null);
  const current = target || shown;
  const [overviewExpanded, setOverviewExpanded] = useState(false);

  useEffect(() => {
    if (target && target !== shown) {
      setShown(target);
      setOverviewExpanded(false);
    }
  }, [target, shown]);

  const media = current?.media || null;
  const navigation = current?.navigation || null;
  const mediaType = media?.mediaType === "tv" ? "tv" : "movie";
  const id = media?.id ?? null;
  const isTv = mediaType === "tv";
  // Yapıma bağlı her asenkron durum bu anahtarla etiketlenir; anahtar
  // tutmuyorsa veri BAŞKA bir yapıma ait demektir ve hiç çizilmez.
  const targetKey = id == null ? null : `${mediaType}:${id}`;

  const [detailState, setDetailState] = useState({ key: null, data: null });
  // Hatırlatıcı durumu YEREL kopyadan (services/userData): eskiden sayfa her
  // açıldığında bu film için buluttan bir `onSnapshot` açılıyordu.
  const remindersView = useUserDataDomain(remindersDomain);
  const [busy, setBusy] = useState(false);
  const [dateSheetVisible, setDateSheetVisible] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [ratingVisible, setRatingVisible] = useState(false);

  const details = detailState.key === targetKey ? detailState.data : null;
  const isReminderSet = !isTv && id != null && remindersView.has("movies", id);

  /* ── Açılış / kapanış animasyonu ────────────────────────────────────────
     Modal'ın kendi `animationType="slide"`ı (Ayarlar'daki sayfaların yaptığı)
     TÜM katmanı blok hâlinde aşağıdan yukarı sürüyor; bulanıklık da sayfayla
     birlikte yükselmiş gibi görünüyor.

     Detay ekranındaki "Diğer Listeler" sayfasının deseni farklı ve buradaki
     asıl mesele bu: Modal animasyonsuz, FADE **TÜM KATMANA** uygulanıyor —
     blur da sayfa da birlikte beliriyor — sayfa ayrıca bir yay (spring) ile
     kayıyor. Fade yalnız arka plana verilip sayfa tam opaklıkta kayarsa
     hareket yine düz bir "aşağıdan yukarı" olarak okunuyor.

     Süreler ve yay katsayıları components/ListView.js'ten birebir. */
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(height)).current;
  // Kayma mesafesi sayfanın gerçek yüksekliği; ilk ölçümden önce güvenli
  // (fazla) bir tahminle başlar, böylece sayfa hep ekranın tam altından gelir.
  const sheetHeightRef = useRef(Math.round(height * 0.9));
  const [mounted, setMounted] = useState(false);
  const mountedRef = useRef(false);

  // Mount / unmount kapısı. Animasyonun kendisi AŞAĞIDAKİ effect'te.
  useEffect(() => {
    if (target) {
      mountedRef.current = true;
      setMounted(true);
      return undefined;
    }
    if (!mountedRef.current) return undefined;
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: sheetHeightRef.current,
        duration: 200,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      // Yarıda kesilen kapanış (kullanıcı hemen başka bir postere bastı)
      // `finished:false` ile döner; orada unmount ETMEMELİYİZ, yoksa yeni
      // açılan sayfa anında kapanır.
    ]).start(({ finished }) => {
      if (!finished) return;
      mountedRef.current = false;
      setMounted(false);
    });
    return undefined;
  }, [target, fadeAnim, slideAnim]);

  // Giriş animasyonu Modal GERÇEKTEN göründükten sonra başlar. Mount'tan önce
  // başlatılırsa native görünümler henüz yokken ilk kareler düşüyor ve fade
  // anlık bir sıçramaya dönüşüyor.
  useEffect(() => {
    if (!mounted || !target) return undefined;
    fadeAnim.setValue(0);
    slideAnim.setValue(sheetHeightRef.current);
    const animation = Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        mass: 1,
        stiffness: 250,
        damping: 22,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [mounted, target, fadeAnim, slideAnim]);

  // Kaydırma konumu sayfa kapanınca sıfırlanmalı: 600 ms'lik bırakma
  // penceresinde yeniden açılırsa ScrollView unmount olmuyor ve önceki
  // yapımda kaydırılan yerden açılırdı. `mounted` de bağımlılık: hedef
  // atandığı karede Modal henüz çocuklarını çizmemiş oluyor, ref boş.
  const scrollRef = useRef(null);
  useEffect(() => {
    if (!target || !mounted) return;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [target, mounted]);

  // Sayfa VE devam sayfalarının hepsi kapandığında son hedefi bırak. Bırakmak
  // sadece temizlik değil: `shown` durdukça `useWatchedShow`un dizi dokümanı
  // aboneliği ve film hatırlatma dinleyicisi açık kalırdı. Gecikme kapanış
  // animasyonu içindir — erken bırakırsak kayarak kapanan sayfa boşalır.
  useEffect(() => {
    if (target || dateSheetVisible || historyVisible || ratingVisible) {
      return undefined;
    }
    const timer = setTimeout(() => setShown(null), 600);
    return () => clearTimeout(timer);
  }, [target, dateSheetVisible, historyVisible, ratingVisible]);

  /* ── TMDB detayı ────────────────────────────────────────────────────────
     Ray öğesi yalnız afiş/ad/puan taşıyor; listeye yazılacak kayıt ise tür
     ADLARINI, film süresini ve yayın durumunu istiyor (bkz. normalizeItem).
     Bu yüzden detay bir kez çekilip önbelleğe alınıyor. Anahtar öneki
     "movie_"/"tv_" olmalı — "Verileri indir" ayarının kategori eşlemesi
     (utils/dataCacheSettings.js → categoryForCacheKey) buradan okuyor. */
  useEffect(() => {
    if (!targetKey) return undefined;
    const locale = intlLocaleOf(language);
    const cacheKey = `${mediaType}_quickactions_detail_${id}_${locale}`;

    // Sonuç `targetKey` ile etiketleniyor; ayrıca "eskisini temizle" adımı
    // gerekmiyor — anahtarı tutmayan detay zaten çizilmiyor.
    const cached = getCachedValue(cacheKey, TTL.NOW_PLAYING);
    if (cached) {
      setDetailState({ key: targetKey, data: cached });
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        const response = await axios.get(
          `https://api.themoviedb.org/3/${mediaType}/${id}`,
          {
            params: { language: locale },
            headers: { accept: "application/json", Authorization: API_KEY },
          },
        );
        if (cancelled) return;
        setDetailState({ key: targetKey, data: response.data });
        setCachedValue(cacheKey, response.data);
      } catch (error) {
        // Detay ikincil: gelmezse başlık/afiş ray verisinden çizilmeye devam
        // eder, yalnız liste yazma eylemleri kibarca uyarır.
        if (__DEV__) console.warn("[quickActions] detay:", error?.message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [targetKey, id, mediaType, language, API_KEY]);

  /* ── İzlenme durumu ─────────────────────────────────────────────────────
     `useWatchedShow(null)` dinleyici açmaz; film hedefinde bedeli yok. */
  const watched = useWatchedShow(isTv ? id : null);
  // Kanca yeni diziye geçerken bir kare önceki dizinin belgesini elinde
  // tutabiliyor. Belge kimliği hedefle tutmuyorsa izlenme durumunu YOK say —
  // belge henüz yokken (`null`) zaten sıfır dönüyor.
  const watchedIsCurrent =
    !isTv || id == null || String(watched.showDoc?.id ?? id) === String(id);
  const watchedEpisodeCount = watchedIsCurrent
    ? watched.aggregates.watchedEpisodeCount
    : 0;
  const watchEvents = watchedIsCurrent ? watched.watchEvents : [];
  const showTotalEpisodes = details?.number_of_episodes || 0;
  // Detay gelmeden yayın tarihi bilinmiyor. `getWatchState`e boş tarih vermek
  // UNAIRED üretip düğmeyi bir an "Hatırlat"a çeviriyordu; detay yokken nötr
  // (İzle / İzleniyor) durumda bekliyoruz.
  const showWatchState = details
    ? getWatchState({
        aired: isAired(details.first_air_date),
        watched: watchedEpisodeCount,
        total: showTotalEpisodes,
      })
    : watchedEpisodeCount > 0
      ? WATCH_STATE.PARTIAL
      : WATCH_STATE.NONE;
  const isSeasonWatched =
    showTotalEpisodes > 0
      ? Math.min(1, watchedEpisodeCount / showTotalEpisodes)
      : 0;

  const watchedMovieDoc = useMemo(() => {
    if (isTv || id == null) return null;
    return (
      (watchedMoviesItems || []).find(
        (item) => String(item.id) === String(id),
      ) || null
    );
  }, [watchedMoviesItems, id, isTv]);
  const movieEvents = useMemo(
    () => movieWatchEvents(watchedMovieDoc),
    [watchedMovieDoc],
  );

  /* ── listStates — detay ekranlarındaki hesabın aynısı ───────────────────
     Öntanımlı listeler subcollection tabanlı statusIndex'ten; özel listeler
     (Part B'ye kadar) kök-array'den. */
  const listStates = useMemo(() => {
    const state = {};
    const bucket = (isTv ? statusIndex?.tv : statusIndex?.movie) || {};
    const entry = (id != null && bucket[id]) || {};
    state.favorites = !!entry.inFavorites;
    state.watchList = !!entry.inWatchList;
    state.watchedMovies = !!entry.isWatched;
    if (allLists) {
      Object.entries(allLists).forEach(([key, value]) => {
        if (
          PREDEFINED_MOVIE_LISTS.includes(key) ||
          key === "watchedTv" ||
          key === "customLists"
        ) {
          return;
        }
        if (Array.isArray(value)) {
          state[key] = customListHas(allLists, key, id, mediaType);
        }
      });
    }
    return state;
  }, [allLists, statusIndex, id, isTv, mediaType]);

  const title = details?.title || details?.name || media?.title || "";
  const posterPath = details?.poster_path ?? media?.posterPath ?? null;
  const backdropPath = details?.backdrop_path ?? media?.backdropPath ?? null;
  const releaseDate =
    (isTv ? details?.first_air_date : details?.release_date) ??
    media?.releaseDate ??
    null;
  const genres = details?.genres || [];
  const overviewText = details?.overview || media?.overview || "";

  const releaseState = getReleaseState(releaseDate, details?.status);
  // Film göz butonu: tarih ileride → hatırlatmaya döner, tarih bilinmiyor →
  // kilitlenir (bkz. utils/watchState.js).
  const isRemaining = releaseState === RELEASE_STATE.SCHEDULED;
  const watchLocked = releaseState === RELEASE_STATE.UNKNOWN;

  const sharedItem = useMemo(() => {
    if (id == null) return null;
    return {
      id,
      type: mediaType,
      name: title,
      imagePath: posterPath,
      minutes: isTv ? undefined : details?.runtime,
      genres: genres.map((genre) => genre.name),
    };
  }, [id, mediaType, title, posterPath, isTv, details?.runtime, genres]);

  /* ── Sayfa devri: önce kapan, sonra diğerini aç ─────────────────────────── */
  const closeThen = useCallback(
    (next) => {
      onClose();
      setTimeout(next, HANDOFF_MS);
    },
    [onClose],
  );

  const navigateTo = useCallback(
    (route, params) => {
      if (!navigation) return;
      closeThen(() => navigation.navigate(route, params));
    },
    [navigation, closeThen],
  );

  // ListView/ListViewTv "Tüm Listeler" düğmesi kendi ızgarasını kapatıp
  // navigate ediyor; bu sayfayı kapatmayı bilmiyor. Minik bir vekil geçiyoruz.
  //
  // Gecikme şart: o ızgara bu sayfanın İÇİNDE bir Modal ve kapanışı ~200 ms
  // sürüyor. Çocuk kapanmadan ebeveyni kapatmak iOS'ta iç içe modal kapanışını
  // yarıda bırakıp ekranı dokunulamaz hâlde bırakabiliyor.
  const listNavigation = useMemo(() => {
    const go = (route, params) => {
      setTimeout(() => navigateTo(route, params), 260);
    };
    return { navigate: go, push: go };
  }, [navigateTo]);

  /* ── Liste adı / bildirim yardımcıları ──────────────────────────────────── */
  const listLabel = useCallback(
    (key) =>
      ({
        favorites: t.favorites,
        watchList: t.watchList,
        watchedMovies: t.watchedMovies,
        watchedTv: t.watchedTv,
      })[key] || key,
    [t],
  );

  const kindLabel = isTv
    ? i18nText("autoI18n.dizi", "Dizi")
    : i18nText("autoI18n.film", "Film");

  /* ── İzleme tarihi / geçmişi sayfaları ──────────────────────────────────
     `updateList`ten ÖNCE tanımlı: "İzledim" oraya da düşebiliyor (bkz. altı). */
  const requestWatchDate = useCallback(() => {
    if (!user?.uid) {
      Toast.show({
        type: "warning",
        text1: i18nText(
          "autoI18n.listeye_eklemek_icin_giris_yap",
          "Listeye eklemek için giriş yap",
        ),
      });
      return;
    }
    if (!details) {
      Toast.show({
        type: "info",
        text1: i18nText(
          "autoI18n.icerik_bilgisi_yukleniyor",
          "İçerik bilgisi yükleniyor…",
        ),
      });
      return;
    }
    closeThen(() => setDateSheetVisible(true));
  }, [user?.uid, details, closeThen]);

  const openHistory = useCallback(() => {
    closeThen(() => setHistoryVisible(true));
  }, [closeThen]);

  /* ── Listeye ekle / çıkar ───────────────────────────────────────────────── */
  const updateList = useCallback(
    async (listType, type, date = null) => {
      if (!user?.uid) {
        Toast.show({
          type: "warning",
          text1: i18nText(
            "autoI18n.listeye_eklemek_icin_giris_yap",
            "Listeye eklemek için giriş yap",
          ),
        });
        return;
      }
      if (!details) {
        Toast.show({
          type: "info",
          text1: i18nText(
            "autoI18n.icerik_bilgisi_yukleniyor",
            "İçerik bilgisi yükleniyor…",
          ),
        });
        return;
      }

      const kind = type || mediaType;
      // "İzledim" hiçbir zaman buradan geçmez (göz butonu tarih sayfasını
      // açar); yine de yeni bir çağrı yeri eklenirse tarihsiz yazmak yerine
      // doğru akışa yönlendirsin.
      if (listType === "watchedMovies") {
        requestWatchDate();
        return;
      }

      // Hedef durum GÖRÜNEN (bindirmeli) durumdan türer: art arda iki dokunuş
      // ekle→çıkar olur, ekle→ekle olmaz. Yazma (sıra, iyimser durum, hatada
      // geri alma, noktalı liste adları) services/libraryActions'ta.
      const desired = !listStates[listType];
      try {
        await setListMembership({
          uid: user.uid,
          listKey: listType,
          item: listItemFromDetails(
            {
              ...details,
              name: details.name || title,
              poster_path: details.poster_path ?? posterPath,
            },
            kind,
            { dateAdded: date || formatDateSave(new Date()) },
          ),
          desired,
        });
        Toast.show({
          type: desired ? "success" : "warning",
          text1: i18nText(
            desired ? "autoI18n.media_added_to_list" : "autoI18n.media_removed_from_list",
            desired
              ? "{{media}} {{list}} listesine eklendi!"
              : "{{media}} {{list}} listesinden kaldırıldı!",
            { media: kindLabel, list: listLabel(listType) },
          ),
        });
      } catch (error) {
        showLibraryError(error, { source: "quick_actions_list" });
      }
    },
    [
      user?.uid,
      details,
      mediaType,
      listStates,
      kindLabel,
      listLabel,
      title,
      posterPath,
      requestWatchDate,
    ],
  );

  const confirmMovieWatch = useCallback(
    async (date) => {
      if (!user?.uid || !details) return;
      const isRewatch = !!listStates.watchedMovies;
      setBusy(true);
      try {
        await markMovieWatched({
          uid: user.uid,
          movie: movieWatchItemFromDetails(details, { dateAdded: date }),
          watchDate: date,
        });
        setDateSheetVisible(false);
        Toast.show({
          type: "success",
          text1: isRewatch
            ? i18nText(
                "autoI18n.tekrar_izleme_eklendi",
                "Tekrar izleme geçmişe eklendi.",
              )
            : i18nText(
                "autoI18n.film_izlendi_eklendi",
                "Film izlendi olarak eklendi.",
              ),
        });
      } catch (error) {
        showLibraryError(error, { source: "quick_actions_movie_watch" });
      } finally {
        setBusy(false);
      }
    },
    [user?.uid, details, listStates.watchedMovies],
  );

  /* Diziyi komple işaretle: sezonların çekilmesi, "biri düşerse hiçbiri
     yazılmaz" kuralı ve tek olay yazımı services/libraryActions.markShowWatched'ta
     (detay ekranı ve listeye hızlı ekleme ile AYNI yol). */
  const confirmShowWatch = useCallback(
    async (date) => {
      if (!user?.uid || !Array.isArray(details?.seasons)) return;
      setBusy(true);
      try {
        const watchResult = await markShowWatched({
          uid: user.uid,
          details,
          watchDate: formatDateSave(date),
          apiKey: API_KEY,
          language,
        });
        const { status } = watchResult;
        if (status === "empty-show") {
          Toast.show({
            type: "warning",
            text1: i18nText(
              "autoI18n.bolum_bilgisi_bulunamadi",
              "Bu dizinin bölüm bilgisi bulunamadı.",
            ),
          });
          return;
        }
        setDateSheetVisible(false);
        if (!showWatchSpreadNotice(watchResult)) {
          Toast.show({
            type: "success",
            text1: i18nText(
              "autoI18n.dizi_bolumleri_izlendi_olarak_isaretlendi",
              "Dizi bölümleri izlendi olarak işaretlendi",
            ),
          });
        }
      } catch (error) {
        showLibraryError(error, { source: "quick_actions_show_watch" });
      } finally {
        setBusy(false);
      }
    },
    [user?.uid, details, language, API_KEY],
  );

  const deleteWatchEvent = useCallback(
    async (event) => {
      if (!user?.uid || id == null || !event?.id) return;
      const remaining = isTv ? watchEvents : movieEvents;
      setBusy(true);
      try {
        if (isTv) await removeTvWatch({ uid: user.uid, showId: id, eventId: event.id });
        else await removeMovieWatch({ uid: user.uid, movieId: id, eventId: event.id });
        Toast.show({
          type: "success",
          text1: i18nText(
            "autoI18n.izleme_kaydi_silindi",
            "Seçilen izleme kaydı silindi.",
          ),
        });
        if (remaining.length <= 1) setHistoryVisible(false);
      } catch (error) {
        showLibraryError(error, { source: "quick_actions_remove_watch" });
      } finally {
        setBusy(false);
      }
    },
    [user?.uid, id, isTv, watchEvents, movieEvents],
  );

  /* ── Film hatırlatması ──────────────────────────────────────────────────── */
  const toggleReminder = useCallback(async () => {
    if (!user?.uid || !details) return;
    // Yeni film hatırlatması ücretsiz planda sınırlı (kaldırmak serbest).
    // Yükseltme sayfası bir Modal: bu sayfa kapanmadan açılırsa iOS ikisini
    // birden sunamaz, bu yüzden önce kapan, sonra uyar (closeThen deseni).
    if (!isReminderSet && !reminderGate.canAdd({ type: "movie" })) {
      closeThen(() => reminderGate.checkAdd({ type: "movie" }));
      return;
    }
    try {
      // Yerel kopyaya + kalıcı günlüğe anında yazılır, buluta arka planda gider.
      if (isReminderSet) {
        remindersActions.removeMovie(user.uid, details.id);
      } else {
        remindersActions.setMovie(user.uid, {
          movieId: details.id || "",
          movieName: details.title || "",
          releaseDate: details.release_date || "",
          movieMinutes: details.runtime || 0,
          posterPath: details.poster_path || null,
          type: "movie",
          createdAt: formatDateSave(new Date()),
        });
      }
      Toast.show({
        type: isReminderSet ? "warning" : "success",
        text1: isReminderSet
          ? i18nText("autoI18n.hatirlatma_kaldirildi", "Hatırlatma kaldırıldı")
          : i18nText("autoI18n.hatirlatma_eklendi", "Hatırlatma eklendi"),
      });
      // Hatırlatma kuruldu ama OS izni yoksa bildirim ASLA düşmez. İzin sayfası
      // bir alt sayfa; bunu KENDİMİZ KAPANMADAN açmak iç içe modal olurdu — o
      // yüzden closeThen (diğer alt sayfa geçişlerindeki desenin aynısı).
      // Sayfayı yalnız gerçekten gösterilecekse kapatıyoruz; aksi hâlde
      // hatırlatma kurmak sırf bunun için sayfayı kapatan bir düğmeye dönerdi.
      if (!isReminderSet && needsPermissionPriming) {
        closeThen(primeNotificationPermission);
      }
    } catch (error) {
      Toast.show({
        type: "error",
        text1: i18nText("autoI18n.hata_2", "Hata: ") + (error?.message || ""),
      });
    }
  }, [
    user?.uid,
    details,
    isReminderSet,
    needsPermissionPriming,
    primeNotificationPermission,
    closeThen,
    reminderGate,
  ]);

  /* ── Yönlendirmeler ─────────────────────────────────────────────────────── */
  const openDetailScreen = useCallback(() => {
    navigateTo(isTv ? "TvShowsDetails" : "MovieDetails", { id });
  }, [navigateTo, isTv, id]);

  const openGraphScreen = useCallback(() => {
    navigateTo("TvGraphDetailScreen", { id });
  }, [navigateTo, id]);

  // Grafik ekranı özel bölümleri (sezon 0) saymaz; detay ekranındaki kapının
  // aynısı. Detay henüz gelmediyse satır iyimser gösterilir.
  const hasGraph =
    isTv &&
    (!details ||
      (details.seasons || []).filter((season) => season.season_number > 0)
        .length > 0);

  const metaLine = useMemo(() => {
    const parts = [];
    const year = releaseDate ? String(releaseDate).slice(0, 4) : "";
    if (year) parts.push(year);
    if (isTv) {
      if (details?.number_of_seasons) {
        parts.push(
          // `autoI18n.n_sezon` BAŞKA bir şey ("3. Sezon" sıra etiketi, {{n}}
          // ile); sayı bildiren ayrı anahtar gerekiyor.
          i18nText("autoI18n.sezon_sayisi", "{{count}} sezon", {
            count: details.number_of_seasons,
          }),
        );
      }
      if (details?.number_of_episodes) {
        parts.push(
          i18nText("autoI18n.n_bolum", "{{count}} bölüm", {
            count: details.number_of_episodes,
          }),
        );
      }
    } else if (details?.runtime) {
      parts.push(
        i18nText("autoI18n.n_dakika", "{{count}} dk", {
          count: details.runtime,
        }),
      );
    }
    return parts.join("  •  ");
  }, [releaseDate, isTv, details]);

  if (!media) return null;

  return (
    <>
      <Modal
        transparent
        statusBarTranslucent
        visible={mounted}
        animationType="none"
        onRequestClose={handleDismiss}
      >
        {/* Fade TÜM katmana: blur da sayfa da birlikte beliriyor. Sayfa buna
            EK OLARAK kayıyor — "Diğer Listeler" sayfasının deseni. */}
        <Animated.View style={[styles.root, { opacity: fadeAnim }]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={handleDismiss}
          >
            <ModalBlurBackdrop intensity={50} />
          </TouchableOpacity>

          <Animated.View
            onLayout={(event) => {
              const measured = Math.round(event.nativeEvent.layout.height);
              if (measured > 0) sheetHeightRef.current = measured;
            }}
            style={[
              styles.sheet,
              {
                // Detay ekranıyla aynı katman düzeni: sayfa zemini `primary`,
                // içindeki liste kartı `secondary`. Zemin `secondary` olsaydı
                // ListView'in kartı zeminle aynı renge düşüp kaybolurdu.
                backgroundColor: theme.primary,
                borderColor: theme.border,
                maxHeight: height * 0.88,
              },
              { transform: [{ translateY: slideAnim }] },
            ]}
          >
            <ScrollView
              ref={scrollRef}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollBody}
              bounces={false}
            >
              {/* ── ÜST ALAN (HERO + POSTER + BİLGİ) — DOKUNUNCA DETAYA GİDER ── */}
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={openDetailScreen}
                style={styles.topTouchArea}
              >
                {/* ── HERO / BACKDROP ── */}
                <View style={styles.hero}>
                  {backdropUri(mediaType, id, backdropPath) ? (
                    <Image
                      source={{ uri: backdropUri(mediaType, id, backdropPath) }}
                      style={styles.backdrop}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      transition={140}
                      blurRadius={3}
                    />
                  ) : (
                    <View
                      style={[styles.backdrop, { backgroundColor: theme.between }]}
                    />
                  )}
                  <LinearGradient
                    colors={["transparent", "rgba(0,0,0,0.18)", theme.primary]}
                    locations={[0.25, 0.6, 1]}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  />
                </View>

                {/* ── POSTER + BİLGİ BAŞLIĞI ── */}
                <View style={styles.infoHeader}>
                  <View style={styles.posterShadow}>
                    <PosterImage
                      path={posterPath}
                      type={mediaType}
                      mediaId={id}
                      size={200}
                      style={[styles.poster, { borderColor: alpha(theme.border, 0.5019607843137255) }]}
                      cachePolicy="memory-disk"
                      transition={140}
                    />
                  </View>

                  <View style={styles.titleBlock}>
                    <Text
                      allowFontScaling={false}
                      numberOfLines={2}
                      style={[styles.title, { color: theme.text.primary }]}
                    >
                      {title}
                    </Text>
                    {metaLine ? (
                      <Text
                        allowFontScaling={false}
                        numberOfLines={1}
                        style={[styles.meta, { color: theme.text.muted }]}
                      >
                        {metaLine}
                      </Text>
                    ) : null}
                    {details?.tagline ? (
                      <Text
                        allowFontScaling={false}
                        numberOfLines={2}
                        style={[styles.tagline, { color: theme.accent }]}
                      >
                        "{details.tagline}"
                      </Text>
                    ) : null}

                    <View style={styles.genreRow}>
                      {genres.slice(0, 3).map((genre) => (
                        <View
                          key={genre.id}
                          style={[
                            styles.genreChip,
                            {
                              backgroundColor: theme.accent + "22",
                              borderColor: theme.accent + "44",
                            },
                          ]}
                        >
                          <Text
                            allowFontScaling={false}
                            style={[styles.genreChipText, { color: theme.accent }]}
                          >
                            {genre.name}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              </TouchableOpacity>

              {/* Puan özeti — detay ekranındaki bileşenin aynısı */}
              <View style={styles.ratingRow}>
                <RatingSummary
                  mediaType={mediaType}
                  mediaId={id}
                  tmdbAvg={details?.vote_average ?? media.voteAverage}
                  tmdbCount={details?.vote_count ?? media.voteCount}
                  releaseDate={releaseDate}
                  onPressRate={() => closeThen(() => setRatingVisible(true))}
                />
              </View>

              {/* ── LİSTELER (KOMPAKT) ── */}
              <View style={styles.listWrap}>
              {isTv ? (
                <ListViewTv
                  type="tv"
                  compact={true}
                  navigation={listNavigation}
                  updateList={updateList}
                  openModal={requestWatchDate}
                  addShowToFirestore={confirmShowWatch}
                  onMarkWatched={requestWatchDate}
                  onUnmarkWatched={openHistory}
                  watchedOverride={
                    showWatchState === WATCH_STATE.UNAIRED && details ? (
                      <Reminder
                        showId={details.id}
                        showName={details.name}
                        showPosterPath={details.poster_path}
                        seasonNumber={1}
                        episodeNumber={1}
                        episodeName={details.name}
                        airDate={details.first_air_date}
                        seasonPosterPath={details.poster_path}
                        type="tv"
                        onLimitReached={(blocked) =>
                          closeThen(() => reminderGate.checkAdd(blocked))
                        }
                      />
                    ) : null
                  }
                  showWatchState={showWatchState}
                  isSeasonWatched={isSeasonWatched}
                  listStates={listStates}
                  isLoading={busy}
                  sharedItem={sharedItem}
                />
              ) : (
                <ListView
                  type="movie"
                  compact={true}
                  navigation={listNavigation}
                  updateList={updateList}
                  updateWatchedList={requestWatchDate}
                  openWatchedHistory={openHistory}
                  addReminder={toggleReminder}
                  isReminderSet={isReminderSet}
                  isRemaining={isRemaining}
                  watchLocked={watchLocked}
                  listStates={listStates}
                  isLoading={busy}
                  sharedItem={sharedItem}
                />
              )}
              </View>

              {/* ── BÖLÜM GRAFİĞİ & ÖZET (SİNOPSİS) ── */}
              <View style={styles.actionList}>
                {hasGraph ? (
                  <ActionRow
                    theme={theme}
                    icon="bar-chart"
                    tint={theme.colors.orange}
                    title={i18nText(
                      "autoI18n.bolum_puan_grafigi",
                      "Bölüm Puan Grafiği",
                    )}
                    subtitle={i18nText(
                      "autoI18n.sezon_sezon_bolum_puanlari",
                      "Sezon sezon tüm bölüm puanları",
                    )}
                    onPress={openGraphScreen}
                  />
                ) : null}

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setOverviewExpanded((prev) => !prev)}
                  style={[
                    styles.overviewBox,
                    {
                      backgroundColor: theme.secondary,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <View style={styles.overviewHeader}>
                    <View style={styles.overviewTitleRow}>
                      <Ionicons
                        name="document-text-outline"
                        size={14}
                        color={theme.accent}
                      />
                      <Text
                        allowFontScaling={false}
                        style={[styles.overviewTitle, { color: theme.text.primary }]}
                      >
                        {t.overview || i18nText("autoI18n.ozet", "Özet")}
                      </Text>
                    </View>
                    {overviewText ? (
                      <Ionicons
                        name={overviewExpanded ? "chevron-up" : "chevron-down"}
                        size={14}
                        color={theme.text.muted}
                      />
                    ) : null}
                  </View>
                  <Text
                    allowFontScaling={false}
                    numberOfLines={overviewExpanded ? undefined : 3}
                    style={[styles.overviewText, { color: theme.text.secondary }]}
                  >
                    {overviewText ||
                      i18nText(
                        "autoI18n.ozet_bulunmuyor",
                        "Özet bulunmuyor.",
                      )}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            {/* Tutamaç ve kapatma, ScrollView'in DIŞINDA: hero kaydırılıp
                gittiğinde de sayfayı kapatmanın görünür bir yolu kalsın. */}
            <View pointerEvents="none" style={styles.handleWrap}>
              <View style={styles.handle} />
            </View>
            <TouchableOpacity
              onPress={handleDismiss}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={17} color="#fff" />
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
        <ModalToastHost visible={!!target} />
      </Modal>

      {/* ── Kardeş sayfalar (iç içe modal yok) ── */}
      <WatchedDateSheet
        visible={dateSheetVisible}
        onClose={() => setDateSheetVisible(false)}
        subtitle={
          isTv
            ? i18nText(
                "autoI18n.bu_diziyi_ne_zaman_izlediniz",
                "Bu diziyi ne zaman izlediniz?",
              )
            : i18nText(
                "autoI18n.bu_filmi_ne_zaman_izlediniz",
                "Bu filmi ne zaman izlediniz?",
              )
        }
        pickerSubtitle={
          isTv
            ? i18nText(
                "autoI18n.bu_diziyi_ne_zaman_izlemeye_basladiniz",
                "Bu diziyi ne zaman izlemeye başladınız?",
              )
            : i18nText(
                "autoI18n.film_izleme_tarihini_sec",
                "Filmi izlediğiniz tarihi seçin",
              )
        }
        releaseDate={releaseDate}
        minDate={releaseDate}
        mediaType={mediaType}
        scope={isTv ? "show" : "movie"}
        mediaId={id}
        mediaTitle={title}
        posterPath={posterPath}
        busy={busy}
        onConfirm={isTv ? confirmShowWatch : confirmMovieWatch}
      />

      <WatchHistorySheet
        visible={historyVisible}
        onClose={() => setHistoryVisible(false)}
        title={title}
        events={isTv ? watchEvents : movieEvents}
        busy={busy}
        onAddAgain={() => {
          setHistoryVisible(false);
          setTimeout(() => setDateSheetVisible(true), 300);
        }}
        onDeleteEvent={deleteWatchEvent}
      />

      <Modal
        transparent
        statusBarTranslucent
        animationType="none"
        visible={ratingVisible}
        onRequestClose={() => setRatingVisible(false)}
      >
        <RatingSheetModal
          visible={ratingVisible}
          onClose={() => setRatingVisible(false)}
          mediaType={mediaType}
          mediaId={id}
          tmdbAvg={details?.vote_average ?? media.voteAverage}
          tmdbCount={details?.vote_count ?? media.voteCount}
          details={details || { title, poster_path: posterPath }}
          releaseDate={releaseDate}
        />
        <ModalToastHost visible={ratingVisible} />
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: "hidden",
  },
  scrollBody: { paddingBottom: 24 },

  /* Hero & Üst Tıklanabilir Alan */
  topTouchArea: {
    width: "100%",
  },
  hero: { height: BACKDROP_H, position: "relative" },
  backdrop: { width: "100%", height: "100%" },
  handleWrap: {
    position: "absolute",
    top: 9,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  closeBtn: {
    position: "absolute",
    top: 10,
    right: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    zIndex: 10,
  },

  /* Poster + başlık */
  infoHeader: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginTop: -BACKDROP_H * 0.36,
    gap: 12,
    alignItems: "flex-end",
  },
  posterShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  poster: {
    width: POSTER_W,
    height: POSTER_W * 1.5,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  titleBlock: { flex: 1, paddingBottom: 2, gap: 3 },
  title: { fontSize: 18, fontWeight: "800", letterSpacing: -0.4, lineHeight: 22 },
  meta: { fontSize: 11, fontWeight: "600" },
  tagline: { fontSize: 11, fontStyle: "italic", lineHeight: 15 },
  genreRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 2 },
  genreChip: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 16,
    borderWidth: 1,
  },
  genreChipText: { fontSize: 10, fontWeight: "600" },
  ratingRow: { paddingHorizontal: 16, marginTop: 10, marginBottom: 8 },

  listWrap: { paddingHorizontal: 16, marginBottom: 10 },

  /* Yönlendirme ve Özet */
  actionList: { paddingHorizontal: 16, gap: 8 },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  actionCopy: { flex: 1, minWidth: 0 },
  actionTitle: { fontSize: 13, fontWeight: "700" },
  actionSub: { fontSize: 10.5, fontWeight: "600", marginTop: 1 },

  /* Özet Kutusu */
  overviewBox: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },
  overviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  overviewTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  overviewTitle: {
    fontSize: 12.5,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  overviewText: {
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: 0.1,
  },
});
