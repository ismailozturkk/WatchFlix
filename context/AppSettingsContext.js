// useEffect artık gerekmiyor: ayarlar açılışta senkron okunduğu için hidrasyon
// effect'i kalktı (aşağıdaki useState başlangıç değerlerine bakın).
import React, {
  createContext,
  useState,
  useContext,
  useMemo,
  useCallback,
  useRef,
} from "react";
import Toast from "@components/AppToast";
import { buildTmdbUrl } from "../utils/tmdbImageUtils";
import { i18nText } from "../utils/i18nText";
import { Keys, get, set, useStored } from "../services/storage";
import { previewHaptic } from "../services/hapticsService";
import { usePremiumPlanSnapshot } from "../services/premiumState";
import { getFeatureLimit } from "../utils/premiumFeatures";
import { cozumlenmisDil } from "../translations";
import {
  normalizeDataTypes,
  setAutoDataCacheEnabled,
  setDataTypes,
} from "../utils/dataCacheSettings";
import { normalizeOnboardingGenrePreferences } from "../utils/onboardingPreferences";
import {
  normalizeDecorScopes,
  setDecorEffectVisible,
  setDecorVisible,
} from "../utils/decorScopes";


const AppSettingsContext = createContext();
const LanguageSettingsContext = createContext();
const ThemeSettingsContext = createContext();
const SnowSettingsContext = createContext();
const ContentSettingsContext = createContext();
const OngoingTvShowsSettingsContext = createContext();
const ImageQualitySettingsContext = createContext();
const IconBackgroundSettingsContext = createContext();
const AmbientBackgroundSettingsContext = createContext();
const DecorScopeSettingsContext = createContext();
const AvatarSettingsContext = createContext();
const ApiSettingsContext = createContext();
const HapticsSettingsContext = createContext();
const NotificationSettingsContext = createContext();
const AutoDataCacheSettingsContext = createContext();
const ListLayoutSettingsContext = createContext();
const StreamingProviderSettingsContext = createContext();
const DiscoveryPreferenceSettingsContext = createContext();

export const REMINDER_PREVIEW_LIMITS = Object.freeze([5, 10, 15, 20]);

export const STREAMING_PROVIDERS = Object.freeze([
  { id: 8, name: "Netflix", color: "#E50914" },
  { id: 337, name: "Disney+", color: "#113CCF" },
  { id: 119, name: "Prime Video", color: "#00A8E1" },
  { id: 350, name: "Apple TV+", color: "#6E6E73" },
  { id: 1899, name: "Max", color: "#5B34DA" },
  { id: 11, name: "MUBI", color: "#083B66" },
]);

/**
 * TMDB Image Quality Presets
 * Legacy map kept for UI labels only. The actual resolutions are now calculated dynamically
 * in `utils/tmdbImageUtils.js` based on component width.
 */
export const IMAGE_QUALITY_PRESETS = {
  low: { poster: "low", backdrop: "low", logo: "low" },
  medium: { poster: "medium", backdrop: "medium", logo: "medium" },
  good: { poster: "good", backdrop: "good", logo: "good" },
  high: { poster: "high", backdrop: "high", logo: "high" },
  original: { poster: "original", backdrop: "original", logo: "original" },
};

const RAW_KEY = process.env.EXPO_PUBLIC_API_KEY || "";
const API_KEY = RAW_KEY && !RAW_KEY.startsWith("Bearer ") ? `Bearer ${RAW_KEY}` : RAW_KEY;
const DEFAULT_NOTIFICATION_SETTINGS = {
  enabled: true,
  remindersEnabled: true,
  moviesEnabled: true,
  tvShowsEnabled: true,
  noteRemindersEnabled: true,
  friendRequestsEnabled: true,
  friendAcceptedEnabled: true,
  messagesEnabled: true,
  postLikesEnabled: true,
  postCommentsEnabled: true,
  mentionsEnabled: true,
  streamingEnabled: false,
  // Haftalık "Bu hafta çıkacaklar" özeti (functions/weeklyReleaseDigest). Opt-in, varsayılan kapalı.
  weeklyDigestEnabled: false,
  leadTimeDays: 0,
};

const DEFAULT_POSTER_BADGES = Object.freeze({
  watchlist: true,
  watched: true,
  favorite: true,
  other: true,
  shared: true,
  reminder: true,
  rated: true,
  commented: true,
  tmdbRating: true,
  voteCount: true,
  releaseDate: true,
  countdown: true,
});
const POSTER_BADGE_KEYS = Object.keys(DEFAULT_POSTER_BADGES);
const DEFAULT_LIST_POSTER_INFO = Object.freeze({
  mediaType: true,
  duration: true,
  title: false,
  addedBy: true,
  rating: true,
  comment: true,
});
const LIST_POSTER_INFO_KEYS = Object.keys(DEFAULT_LIST_POSTER_INFO);

const genThemeId = () =>
  `ct_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

const getBooleanSetting = (settings, key) =>
  typeof settings[key] === "boolean" ? settings[key] : DEFAULT_NOTIFICATION_SETTINGS[key];

const normalizeNotificationSettings = (settings) => {
  const next = {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...(settings && typeof settings === "object" ? settings : {}),
  };

  return {
    enabled: getBooleanSetting(next, "enabled"),
    remindersEnabled: getBooleanSetting(next, "remindersEnabled"),
    moviesEnabled: getBooleanSetting(next, "moviesEnabled"),
    tvShowsEnabled: getBooleanSetting(next, "tvShowsEnabled"),
    noteRemindersEnabled: getBooleanSetting(next, "noteRemindersEnabled"),
    friendRequestsEnabled: getBooleanSetting(next, "friendRequestsEnabled"),
    friendAcceptedEnabled: getBooleanSetting(next, "friendAcceptedEnabled"),
    messagesEnabled: getBooleanSetting(next, "messagesEnabled"),
    postLikesEnabled: getBooleanSetting(next, "postLikesEnabled"),
    postCommentsEnabled: getBooleanSetting(next, "postCommentsEnabled"),
    mentionsEnabled: getBooleanSetting(next, "mentionsEnabled"),
    streamingEnabled: getBooleanSetting(next, "streamingEnabled"),
    weeklyDigestEnabled: getBooleanSetting(next, "weeklyDigestEnabled"),
    leadTimeDays: [0, 1, 3, 7].includes(next.leadTimeDays)
      ? next.leadTimeDays
      : DEFAULT_NOTIFICATION_SETTINGS.leadTimeDays,
  };
};

const normalizePosterBadges = (settings) => {
  if (typeof settings === "boolean") {
    return POSTER_BADGE_KEYS.reduce((acc, key) => {
      acc[key] = settings;
      return acc;
    }, {});
  }

  const source =
    settings && typeof settings === "object" && !Array.isArray(settings)
      ? settings
      : {};

  return POSTER_BADGE_KEYS.reduce((acc, key) => {
    acc[key] =
      typeof source[key] === "boolean"
        ? source[key]
        : DEFAULT_POSTER_BADGES[key];
    return acc;
  }, {});
};

const normalizeListPosterInfo = (settings) => {
  const source =
    settings && typeof settings === "object" && !Array.isArray(settings)
      ? settings
      : {};

  return LIST_POSTER_INFO_KEYS.reduce((acc, key) => {
    acc[key] =
      typeof source[key] === "boolean"
        ? source[key]
        : DEFAULT_LIST_POSTER_INFO[key];
    return acc;
  }, {});
};

// Tek yazma yolu. MMKV senkron ve throw etmiyor; `set` yalnız tip/doğrulama
// reddinde ya da disk hatasında false döner — kullanıcıya ancak o zaman haber verilir.
const persist = (key, value, errorText) => {
  if (!set(key, value)) Toast.show({ type: "error", text1: errorText });
};

const TEMA_HATASI = i18nText("autoI18n.tema_kaydedilemedi", "Tema kaydedilemedi: ");
const IKON_HATASI = i18nText(
  "autoI18n.ikon_arka_plan_ayari_kaydedilemedi",
  "İkon arka plan ayarı kaydedilemedi: ",
);
const GORUNUM_HATASI = i18nText(
  "autoI18n.gorunum_ayari_kaydedilemedi",
  "Görünüm ayarı kaydedilemedi",
);

export const AppSettingsProvider = ({ children }) => {
  // MMKV GEÇİŞİ — açılışta ayar okuma artık SENKRON.
  //
  // Eskiden her state varsayılanla başlıyor, tek bir `AsyncStorage.multiGet`
  // effect'i onları ikinci render'da gerçek değerlerle eziyordu. Sonuç: her
  // açılışta mavi temanın ve Türkçe'nin bir kare görünüp kullanıcının gerçek
  // seçimine atlaması. MMKV senkron okuduğu için ilk render zaten doğru
  // değerlerle çiziliyor — o effect tamamen kalktı.
  const [showSnow, setShowSnow] = useState(() => get(Keys.showSnow));
  // i18next detector'ı ile AYNI çözümleme: ilk açılışta kayıt yoksa cihaz dili.
  // İkisi ayrışırsa LanguageContext bu değeri i18n'e geri yazar ve cihaz dili
  // anında Türkçe'ye ezilirdi — bu yüzden tek kaynak.
  const [selectedLanguage, setSelectedLanguage] = useState(cozumlenmisDil);
  const [selectedTheme, setSelectedTheme] = useState(() => get(Keys.theme));
  const [customThemes, setCustomThemes] = useState(() => get(Keys.customThemes));
  const [storedAdultContent, setAdultContent] = useState(() => get(Keys.adultContent));
  // Oturumdaki hesap 18 altı mı? Kaynağı Users/{uid}.birthDate; UserProfileContext
  // türetip depoya yazıyor (bkz. utils/ageGate.js). Bağlam üzerinden değil DEPO
  // üzerinden okunuyor çünkü UserProfileProvider bu sağlayıcının ALTINDA render
  // ediliyor — depo iki yönlü çalışan tek ortak kanal.
  const ageRestricted = useStored(Keys.ageRestricted);
  // Ayarın ETKİN değeri. Kayıtlı bayrak açık kalmış olabilir (aynı cihazda daha
  // önce yetişkin bir hesap kullanılmışsa); yaş kısıtı onu daima ezer.
  const adultContent = storedAdultContent && !ageRestricted;
  const [showOngoingTvShows, setShowOngoingTvShows] = useState(() =>
    get(Keys.showOngoingTvShows),
  );
  const [showIconBackground, setShowIconBackground] = useState(() =>
    get(Keys.showIconBackground),
  );
  // Ambiyans arka planı (bulanık rengârenk süzülen ışık lekeleri). Premium'a
  // bağlı DEĞİL: kar/ikon deseninden farklı olarak her planda açılabilir.
  const [showAmbientBackground, setShowAmbientBackground] = useState(() =>
    get(Keys.showAmbientBackground),
  );
  // Kar / ikon / ambiyansın ekran grubu bazında gizlenenleri (genel anahtarların
  // ÜSTÜNDE bir süzgeç; boş = her yerde). Kayıt bozuksa normalize boşa düşürür.
  const [decorHidden, setDecorHidden] = useState(() =>
    normalizeDecorScopes(get(Keys.decorScopes)),
  );
  // Ardışık hızlı dokunuşlar state'in güncel hâlinden türesin (kapanış değil).
  const decorHiddenRef = useRef(decorHidden);
  // İkon arka plan düzeni: "shared" (sabit, her ekranda aynı, performanslı) | "random" (her ekran farklı)
  const [iconBackgroundMode, setIconBackgroundMode] = useState(() =>
    get(Keys.iconBackgroundMode),
  );
  // İkon saydamlık çarpanı (0.1–1). Ekranların kendi opaklık değerini ölçekler; 1 = değişiklik yok.
  const [iconBackgroundOpacity, setIconBackgroundOpacity] = useState(() =>
    get(Keys.iconBackgroundOpacity),
  );
  const [imageQualityLevel, setImageQualityLevel] = useState(() => {
    const level = get(Keys.imageQualityLevel);
    return IMAGE_QUALITY_PRESETS[level] ? level : "good";
  });
  const [selectedAvatar, setSelectedAvatar] = useState(() => get(Keys.selectedAvatar));
  const [hapticsEnabled, setHapticsEnabled] = useState(() => get(Keys.haptics));
  const [autoDataCacheEnabled, setAutoDataCacheEnabledState] = useState(() =>
    get(Keys.autoDataCache),
  );
  // "Verileri indir" açıkken hangi türlerin indirileceği (hepsi varsayılan açık).
  // Kapalı tür ne otomatik cache'lenir ne de manuel indirmeye dahil edilir.
  const [dataCacheTypes, setDataCacheTypesState] = useState(() =>
    normalizeDataTypes(get(Keys.dataCacheTypes)),
  );
  const [notificationSettings, setNotificationSettings] = useState(() =>
    normalizeNotificationSettings(get(Keys.notificationSettings)),
  );
  // Liste görünümü: sütun sayısı (3 varsayılan | 4) ve afiş köşe yuvarlaklığı (2 | 10 varsayılan | 20)
  const [listsGridColumns, setListsGridColumns] = useState(() => get(Keys.listsGridColumns));
  const [listsPosterRadius, setListsPosterRadius] = useState(() =>
    get(Keys.listsPosterRadius),
  );
  const [listPosterInfo, setListPosterInfo] = useState(() =>
    normalizeListPosterInfo(get(Keys.listPosterInfo)),
  );
  // "Tümünü Gör" (poster grid) görünümü — listelerden bağımsız kendi ayarı
  const [seeAllGridColumns, setSeeAllGridColumns] = useState(() =>
    get(Keys.seeAllGridColumns),
  );
  const [seeAllPosterRadius, setSeeAllPosterRadius] = useState(() =>
    get(Keys.seeAllPosterRadius),
  );
  // TV/Film ana ekran yatay rail posterleri: boyut ("normal" | "small") ve köşe (4 | 15 varsayılan | 24)
  const [railPosterSize, setRailPosterSize] = useState(() => get(Keys.railPosterSize));
  const [railPosterRadius, setRailPosterRadius] = useState(() => get(Keys.railPosterRadius));
  // Paylaşım akışındaki liste postları: "spaced" (varsayılan aralıklı) | "joined" (bitişik şerit)
  const [postListPosterLayout, setPostListPosterLayout] = useState(() =>
    get(Keys.postListPosterLayout),
  );
  const [reminderPreviewLimit, setReminderPreviewLimit] = useState(() =>
    get(Keys.reminderPreviewLimit),
  );
  // Poster üzerindeki rozetlerin (ListBadges) TÜR BAZINDA görünürlüğü —
  // her rozet ayrı açılıp kapatılabilir; kapalı olan posterde çizilmez.
  const [posterBadges, setPosterBadges] = useState(() =>
    normalizePosterBadges(get(Keys.posterBadges)),
  );
  const [streamingProviderIds, setStreamingProviderIds] = useState(() =>
    [...new Set((get(Keys.streamingProviderIds) || []).map(Number))].filter(
      (id) => Number.isInteger(id) && id > 0,
    ),
  );
  const [onboardingGenreKeys, setOnboardingGenreKeys] = useState(() =>
    normalizeOnboardingGenrePreferences(get(Keys.onboardingGenreKeys)),
  );

  // NOT: burada eskiden 200 satırlık bir `AsyncStorage.multiGet` hidrasyon
  // effect'i vardı. Okuma senkron olduğu için tamamı yukarıdaki useState
  // başlangıç değerlerine taşındı. Eski anahtar dönüşümleri (imageQuality →
  // imageQualityLevel, reminderNotificationSettings → notificationSettings,
  // customThemeTokens → customThemes) artık tek seferlik göçün parçası:
  // services/storage/migration.js.

  const imageQuality = useMemo(
    () => IMAGE_QUALITY_PRESETS[imageQualityLevel] ?? IMAGE_QUALITY_PRESETS.good,
    [imageQualityLevel],
  );

  // Kar animasyonu, ambiyans ve ikon arka planı Premium'a özel. Plan Free'ye
  // düşünce (ya da hiç premium olmayan hesapta eski bir bayrak açık kalmışsa)
  // kayıtlı tercih SİLİNMEZ; yalnız çizilen değer kapalı olur, abonelik
  // yenilenince geri gelir — özel tema/yazı tipiyle aynı kural.
  // AppSettingsProvider PremiumProvider'ın ÜSTÜNDE olduğu için plan React dışı
  // store'dan okunur. Yeni bir dekor efekti eklenirse buraya VE
  // premiumFeatures kaydına girer (bekçi: __tests__/decorScopes.test.js).
  const premiumPlan = usePremiumPlanSnapshot();
  const snowAllowed = Boolean(getFeatureLimit("snow_effect", premiumPlan));
  const ambientAllowed = Boolean(getFeatureLimit("ambient_background", premiumPlan));
  const iconBackgroundAllowed = Boolean(getFeatureLimit("icon_background", premiumPlan));
  const effectiveShowSnow = showSnow && snowAllowed;
  const effectiveShowAmbientBackground = showAmbientBackground && ambientAllowed;
  const effectiveShowIconBackground = showIconBackground && iconBackgroundAllowed;

  // Kar, ambiyans ve ikon arka planı Free'de AÇILAMAZ. Ayarlar ekranı anahtarı
  // kilitleyip yükseltme sayfasına yönlendiriyor; buradaki kontrol ikinci kapı —
  // başka bir çağrı yeri (ör. ayar yedeği, yeni bir ekran) eklendiğinde kayıtlı
  // bayrak sessizce açılmasın. Kapatmak serbest.
  const changeShowSnow = useCallback(
    (newVal) => {
      if (newVal && !snowAllowed) return;
      setShowSnow(newVal);
      persist(Keys.showSnow, newVal, "ShowSnow kaydedilmedi");
    },
    [snowAllowed],
  );

  const changeLanguage = useCallback((newVal) => {
    setSelectedLanguage(newVal);
    persist(Keys.language, newVal, i18nText("autoI18n.dil_kaydedilemedi", "Dil kaydedilemedi: "));
  }, []);

  const changeTheme = useCallback((newVal) => {
    setSelectedTheme(newVal);
    persist(Keys.theme, newVal, TEMA_HATASI);
  }, []);

  // Özel tema (ad + token seti) ekler veya günceller. id verilmezse yeni üretilir.
  // Yalnızca isim ve token haritası (mutlak hex + bağıl) saklanır; tam tema nesnesi
  // ThemeContext içinde buildCustomTheme ile üretilir. Kaydedilen tema id'sini döner.
  const saveCustomTheme = useCallback((themeInput) => {
    const id = themeInput?.id || genThemeId();
    const entry = {
      id,
      name: (themeInput?.name || "").trim() || i18nText("autoI18n.ozel_tema", "Özel Tema"),
      tokens: themeInput?.tokens || {},
    };
    setCustomThemes((prev) => {
      const idx = prev.findIndex((x) => x.id === id);
      const next = idx >= 0 ? prev.map((x, i) => (i === idx ? entry : x)) : [...prev, entry];
      persist(Keys.customThemes, next, TEMA_HATASI);
      return next;
    });
    return id;
  }, []);

  const deleteCustomTheme = useCallback((id) => {
    setCustomThemes((prev) => {
      const next = prev.filter((x) => x.id !== id);
      persist(Keys.customThemes, next, TEMA_HATASI);
      return next;
    });
  }, []);

  const changeAvatar = useCallback((userId, newAvatar) => {
    setSelectedAvatar(newAvatar);
    // ESKİ HATA: burası `avatar_${uid}` anahtarına JSON yazıyordu, oysa
    // ProfileUiContext AYNI anahtara düz bir sayı (avatar index) yazıyor. İki
    // modül tek anahtarı iki farklı biçimde kullanıyordu; hangisi son yazarsa
    // diğerinin okuması bozuluyordu. Artık ayrı anahtar (bkz. registry).
    persist(Keys.selectedAvatar, newAvatar, "Avatar kaydedilemedi");
  }, []);

  // Yaş kısıtlıyken AÇILAMAZ. Ayarlar ekranı satırı zaten gizliyor; buradaki
  // kontrol ikinci kapı — başka bir çağrı yeri (ör. bir onboarding adımı)
  // eklendiğinde kısıt sessizce delinmesin.
  const chaneAdultContent = useCallback(
    (newVal) => {
      if (newVal && ageRestricted) return;
      setAdultContent(newVal);
      persist(Keys.adultContent, newVal, "Content kaydedilemedi");
    },
    [ageRestricted],
  );

  const changeShowOngoingTvShows = useCallback((newVal) => {
    setShowOngoingTvShows(newVal);
    persist(Keys.showOngoingTvShows, newVal, i18nText("autoI18n.devam_eden_diziler_ayari_kaydedilemedi", "Devam eden diziler ayarı kaydedilemedi: "));
  }, []);

  const changeShowIconBackground = useCallback(
    (newVal) => {
      if (newVal && !iconBackgroundAllowed) return;
      setShowIconBackground(newVal);
      persist(Keys.showIconBackground, newVal, IKON_HATASI);
    },
    [iconBackgroundAllowed],
  );

  const changeShowAmbientBackground = useCallback(
    (newVal) => {
      const enabled = !!newVal;
      if (enabled && !ambientAllowed) return;
      setShowAmbientBackground(enabled);
      persist(Keys.showAmbientBackground, enabled, GORUNUM_HATASI);
    },
    [ambientAllowed],
  );

  const applyDecorHidden = useCallback((next) => {
    decorHiddenRef.current = next;
    setDecorHidden(next);
    persist(Keys.decorScopes, next, GORUNUM_HATASI);
  }, []);

  const changeDecorVisible = useCallback(
    (effect, scope, visible) =>
      applyDecorHidden(setDecorVisible(decorHiddenRef.current, effect, scope, !!visible)),
    [applyDecorHidden],
  );

  const changeDecorEffectVisible = useCallback(
    (effect, visible) =>
      applyDecorHidden(setDecorEffectVisible(decorHiddenRef.current, effect, !!visible)),
    [applyDecorHidden],
  );

  const resetDecorScopes = useCallback(
    () => applyDecorHidden(normalizeDecorScopes(null)),
    [applyDecorHidden],
  );

  const changeIconBackgroundMode = useCallback((mode) => {
    if (mode !== "shared" && mode !== "random") return;
    setIconBackgroundMode(mode);
    persist(Keys.iconBackgroundMode, mode, IKON_HATASI);
  }, []);

  // Saydamlık kaydırıcısı her harekette tetiklenir → state'i anında günceller (canlı
  // önizleme), ama disk yazımını debounce eder (sürükleme sırasında yüzlerce
  // gereksiz yazımdan kaçınır; yalnız durunca/bırakınca kalıcılaştırır).
  const opacityPersistTimer = useRef(null);
  const changeIconBackgroundOpacity = useCallback((val) => {
    const v = Math.min(1, Math.max(0.1, Number(val) || 0.1));
    setIconBackgroundOpacity(v);
    if (opacityPersistTimer.current) clearTimeout(opacityPersistTimer.current);
    opacityPersistTimer.current = setTimeout(() => {
      persist(Keys.iconBackgroundOpacity, v, IKON_HATASI);
    }, 250);
  }, []);

  const changeImageQuality = useCallback((level) => {
    if (!IMAGE_QUALITY_PRESETS[level]) return;
    setImageQualityLevel(level);
    persist(Keys.imageQualityLevel, level, "Kalite kaydedilemedi");
  }, []);

  const changeHapticsEnabled = useCallback((newVal) => {
    const nextValue = !!newVal;
    setHapticsEnabled(nextValue);
    // hapticsService bu anahtara ABONE — ayrıca itmeye gerek yok. Eskiden iki
    // modül aynı anahtarı ayrı ayrı sahipleniyordu (bkz. services/hapticsService.js).
    persist(Keys.haptics, nextValue, i18nText("autoI18n.titresim_ayari_kaydedilemedi", "Titreşim ayarı kaydedilemedi: "));
    // Açılırken tek bir baskı: kullanıcı çalıştığını hissetsin. iOS'un sistem
    // anahtarı kendi titreşimini AYNI ANDA verir; çakışıp tek vuruşa karışmasın
    // diye biraz gecikmeli.
    if (nextValue) setTimeout(previewHaptic, 220);
  }, []);

  const changeNotificationSettings = useCallback((patch) => {
    const next = normalizeNotificationSettings({
      ...notificationSettings,
      ...patch,
    });
    setNotificationSettings(next);
    persist(Keys.notificationSettings, next, i18nText("autoI18n.bildirim_ayari_kaydedilemedi", "Bildirim ayarı kaydedilemedi: "));
  }, [notificationSettings]);

  const changeListsGridColumns = useCallback((n) => {
    if (n !== 3 && n !== 4) return;
    setListsGridColumns(n);
    persist(Keys.listsGridColumns, n, GORUNUM_HATASI);
  }, []);

  const changeListsPosterRadius = useCallback((n) => {
    if (n !== 2 && n !== 10 && n !== 20) return;
    setListsPosterRadius(n);
    persist(Keys.listsPosterRadius, n, GORUNUM_HATASI);
  }, []);

  const changeListPosterInfo = useCallback((key, value) => {
    if (!LIST_POSTER_INFO_KEYS.includes(key)) return;
    setListPosterInfo((current) => {
      const next = normalizeListPosterInfo({ ...current, [key]: !!value });
      persist(Keys.listPosterInfo, next, GORUNUM_HATASI);
      return next;
    });
  }, []);

  const changeSeeAllGridColumns = useCallback((n) => {
    if (n !== 3 && n !== 4) return;
    setSeeAllGridColumns(n);
    persist(Keys.seeAllGridColumns, n, GORUNUM_HATASI);
  }, []);

  const changeSeeAllPosterRadius = useCallback((n) => {
    if (n !== 2 && n !== 10 && n !== 20) return;
    setSeeAllPosterRadius(n);
    persist(Keys.seeAllPosterRadius, n, GORUNUM_HATASI);
  }, []);

  const changeRailPosterSize = useCallback((size) => {
    if (size !== "normal" && size !== "small") return;
    setRailPosterSize(size);
    persist(Keys.railPosterSize, size, GORUNUM_HATASI);
  }, []);

  const changeRailPosterRadius = useCallback((n) => {
    if (n !== 4 && n !== 15 && n !== 24) return;
    setRailPosterRadius(n);
    persist(Keys.railPosterRadius, n, GORUNUM_HATASI);
  }, []);

  const changePostListPosterLayout = useCallback((layout) => {
    if (layout !== "spaced" && layout !== "joined") return;
    setPostListPosterLayout(layout);
    persist(Keys.postListPosterLayout, layout, GORUNUM_HATASI);
  }, []);

  const changeReminderPreviewLimit = useCallback((limit) => {
    if (!REMINDER_PREVIEW_LIMITS.includes(limit)) return;
    setReminderPreviewLimit(limit);
    persist(Keys.reminderPreviewLimit, limit, GORUNUM_HATASI);
  }, []);

  const showPosterBadges = useMemo(
    () => POSTER_BADGE_KEYS.some((key) => posterBadges[key]),
    [posterBadges],
  );

  const persistPosterBadges = useCallback((next) => {
    persist(Keys.posterBadges, next, GORUNUM_HATASI);
  }, []);

  const changePosterBadges = useCallback((nextValue) => {
    const next = normalizePosterBadges(nextValue);
    setPosterBadges(next);
    persistPosterBadges(next);
  }, [persistPosterBadges]);

  const changePosterBadge = useCallback((key, val) => {
    if (!POSTER_BADGE_KEYS.includes(key)) return;
    const next = normalizePosterBadges({ ...posterBadges, [key]: !!val });
    setPosterBadges(next);
    persistPosterBadges(next);
  }, [posterBadges, persistPosterBadges]);

  const changeShowPosterBadges = useCallback((val) => {
    changePosterBadges(val);
  }, [changePosterBadges]);

  const changeAutoDataCacheEnabled = useCallback((newVal) => {
    const enabled = !!newVal;
    setAutoDataCacheEnabledState(enabled);
    // dataCacheSettings hem kalıcılaştırır hem senkron aynasını tazeler —
    // anahtarın TEK sahibi orası, burada ayrıca yazılmaz.
    setAutoDataCacheEnabled(enabled);
  }, []);

  // Tür seçimi — React state + senkron ayna (cache katmanları) + kalıcı kayıt.
  const persistDataCacheTypes = useCallback((next) => {
    const normalized = normalizeDataTypes(next);
    setDataCacheTypesState(normalized);
    setDataTypes(normalized);
  }, []);

  const changeDataCacheType = useCallback(
    (key, val) => {
      persistDataCacheTypes({ ...dataCacheTypes, [key]: !!val });
    },
    [dataCacheTypes, persistDataCacheTypes],
  );

  const changeDataCacheTypes = useCallback(
    (patch) => {
      persistDataCacheTypes({ ...dataCacheTypes, ...(patch || {}) });
    },
    [dataCacheTypes, persistDataCacheTypes],
  );

  const changeStreamingProviderIds = useCallback((providerIds) => {
    const next = [...new Set((providerIds || []).map(Number))].filter(
      (id) => Number.isInteger(id) && id > 0,
    );
    setStreamingProviderIds(next);
    persist(Keys.streamingProviderIds, next, i18nText("autoI18n.platform_uyelikleri_kaydedilemedi", "Platform üyelikleri kaydedilemedi: "));
  }, []);

  const changeOnboardingGenreKeys = useCallback((genreKeys) => {
    const next = normalizeOnboardingGenrePreferences(genreKeys);
    setOnboardingGenreKeys(next);
    persist(
      Keys.onboardingGenreKeys,
      next,
      i18nText("autoI18n.tur_tercihleri_kaydedilemedi", "Tür tercihleri kaydedilemedi: "),
    );
  }, []);

  const value = useMemo(
    () => ({
      showSnow: effectiveShowSnow,
      changeShowSnow,
      selectedLanguage,
      changeLanguage,
      selectedTheme,
      changeTheme,
      selectedAvatar,
      changeAvatar,
      adultContent,
      chaneAdultContent,
      ageRestricted,
      showOngoingTvShows,
      changeShowOngoingTvShows,
      imageQuality,
      imageQualityLevel,
      changeImageQuality,
      API_KEY,
      hapticsEnabled,
      changeHapticsEnabled,
      notificationSettings,
      changeNotificationSettings,
      autoDataCacheEnabled,
      changeAutoDataCacheEnabled,
      dataCacheTypes,
      changeDataCacheType,
      changeDataCacheTypes,
    }),
    [
      effectiveShowSnow,
      selectedLanguage,
      selectedTheme,
      selectedAvatar,
      adultContent,
      ageRestricted,
      imageQuality,
      imageQualityLevel,
      changeShowSnow,
      changeLanguage,
      changeTheme,
      changeAvatar,
      chaneAdultContent,
      showOngoingTvShows,
      changeShowOngoingTvShows,
      showIconBackground,
      changeShowIconBackground,
      changeImageQuality,
      hapticsEnabled,
      changeHapticsEnabled,
      notificationSettings,
      changeNotificationSettings,
      autoDataCacheEnabled,
      changeAutoDataCacheEnabled,
      dataCacheTypes,
      changeDataCacheType,
      changeDataCacheTypes,
    ],
  );

  const languageValue = useMemo(
    () => ({
      selectedLanguage,
      changeLanguage,
    }),
    [selectedLanguage, changeLanguage],
  );

  const themeValue = useMemo(
    () => ({
      selectedTheme,
      changeTheme,
      customThemes,
      saveCustomTheme,
      deleteCustomTheme,
    }),
    [selectedTheme, changeTheme, customThemes, saveCustomTheme, deleteCustomTheme],
  );

  const snowValue = useMemo(
    () => ({
      showSnow: effectiveShowSnow,
      // Ayarlar ekranı kilit rozetini ve yükseltme akışını buna göre çizer.
      snowAllowed,
      changeShowSnow,
    }),
    [effectiveShowSnow, snowAllowed, changeShowSnow],
  );

  const contentValue = useMemo(
    () => ({
      adultContent,
      chaneAdultContent,
      // Ayarlar ekranı satırı bu bayrakla gizliyor: 18 altı kullanıcı
      // kapatılmış bir anahtarı görüp neden açamadığını merak etmesin.
      ageRestricted,
    }),
    [adultContent, chaneAdultContent, ageRestricted],
  );

  const ongoingTvShowsValue = useMemo(
    () => ({
      showOngoingTvShows,
      changeShowOngoingTvShows,
    }),
    [showOngoingTvShows, changeShowOngoingTvShows],
  );

  const iconBackgroundValue = useMemo(
    () => ({
      showIconBackground: effectiveShowIconBackground,
      iconBackgroundAllowed,
      changeShowIconBackground,
      iconBackgroundMode,
      changeIconBackgroundMode,
      iconBackgroundOpacity,
      changeIconBackgroundOpacity,
    }),
    [
      effectiveShowIconBackground,
      iconBackgroundAllowed,
      changeShowIconBackground,
      iconBackgroundMode,
      changeIconBackgroundMode,
      iconBackgroundOpacity,
      changeIconBackgroundOpacity,
    ],
  );

  const ambientBackgroundValue = useMemo(
    () => ({
      showAmbientBackground: effectiveShowAmbientBackground,
      // Ayarlar ekranı kilit rozetini ve yükseltme akışını buna göre çizer.
      ambientAllowed,
      changeShowAmbientBackground,
    }),
    [effectiveShowAmbientBackground, ambientAllowed, changeShowAmbientBackground],
  );

  const decorScopeValue = useMemo(
    () => ({
      decorHidden,
      changeDecorVisible,
      changeDecorEffectVisible,
      resetDecorScopes,
    }),
    [decorHidden, changeDecorVisible, changeDecorEffectVisible, resetDecorScopes],
  );

  const getTmdbUrl = useCallback(
    (path, type, expectedWidth) => {
      return buildTmdbUrl(path, type, expectedWidth, imageQualityLevel);
    },
    [imageQualityLevel]
  );

  const imageQualityValue = useMemo(
    () => ({
      imageQuality,
      imageQualityLevel,
      changeImageQuality,
      getTmdbUrl,
    }),
    [imageQuality, imageQualityLevel, changeImageQuality, getTmdbUrl],
  );

  const avatarValue = useMemo(
    () => ({
      selectedAvatar,
      changeAvatar,
    }),
    [selectedAvatar, changeAvatar],
  );

  const hapticsValue = useMemo(
    () => ({
      hapticsEnabled,
      changeHapticsEnabled,
    }),
    [hapticsEnabled, changeHapticsEnabled],
  );

  const notificationValue = useMemo(
    () => ({
      notificationSettings,
      changeNotificationSettings,
    }),
    [notificationSettings, changeNotificationSettings],
  );

  const autoDataCacheValue = useMemo(
    () => ({
      autoDataCacheEnabled,
      changeAutoDataCacheEnabled,
      dataCacheTypes,
      changeDataCacheType,
      changeDataCacheTypes,
    }),
    [
      autoDataCacheEnabled,
      changeAutoDataCacheEnabled,
      dataCacheTypes,
      changeDataCacheType,
      changeDataCacheTypes,
    ],
  );

  const apiValue = useMemo(() => ({ API_KEY }), []);

  const streamingProviderValue = useMemo(
    () => ({ streamingProviderIds, changeStreamingProviderIds }),
    [streamingProviderIds, changeStreamingProviderIds],
  );
  const discoveryPreferenceValue = useMemo(
    () => ({ onboardingGenreKeys, changeOnboardingGenreKeys }),
    [onboardingGenreKeys, changeOnboardingGenreKeys],
  );

  const listLayoutValue = useMemo(
    () => ({
      listsGridColumns,
      changeListsGridColumns,
      listsPosterRadius,
      changeListsPosterRadius,
      listPosterInfo,
      changeListPosterInfo,
      seeAllGridColumns,
      changeSeeAllGridColumns,
      seeAllPosterRadius,
      changeSeeAllPosterRadius,
      railPosterSize,
      changeRailPosterSize,
      railPosterRadius,
      changeRailPosterRadius,
      postListPosterLayout,
      changePostListPosterLayout,
      reminderPreviewLimit,
      changeReminderPreviewLimit,
      showPosterBadges,
      changeShowPosterBadges,
      posterBadges,
      changePosterBadges,
      changePosterBadge,
    }),
    [
      listsGridColumns,
      changeListsGridColumns,
      listsPosterRadius,
      changeListsPosterRadius,
      listPosterInfo,
      changeListPosterInfo,
      seeAllGridColumns,
      changeSeeAllGridColumns,
      seeAllPosterRadius,
      changeSeeAllPosterRadius,
      railPosterSize,
      changeRailPosterSize,
      railPosterRadius,
      changeRailPosterRadius,
      postListPosterLayout,
      changePostListPosterLayout,
      reminderPreviewLimit,
      changeReminderPreviewLimit,
      showPosterBadges,
      changeShowPosterBadges,
      posterBadges,
      changePosterBadges,
      changePosterBadge,
    ],
  );

  return (
    <ApiSettingsContext.Provider value={apiValue}>
      <LanguageSettingsContext.Provider value={languageValue}>
        <ThemeSettingsContext.Provider value={themeValue}>
          <SnowSettingsContext.Provider value={snowValue}>
            <ContentSettingsContext.Provider value={contentValue}>
              <OngoingTvShowsSettingsContext.Provider value={ongoingTvShowsValue}>
                <IconBackgroundSettingsContext.Provider value={iconBackgroundValue}>
                  <ImageQualitySettingsContext.Provider value={imageQualityValue}>
                    <AvatarSettingsContext.Provider value={avatarValue}>
                      <HapticsSettingsContext.Provider value={hapticsValue}>
                        <NotificationSettingsContext.Provider
                          value={notificationValue}
                        >
                          <AutoDataCacheSettingsContext.Provider
                            value={autoDataCacheValue}
                          >
                            <ListLayoutSettingsContext.Provider
                              value={listLayoutValue}
                            >
                              <StreamingProviderSettingsContext.Provider
                                value={streamingProviderValue}
                              >
                                <DiscoveryPreferenceSettingsContext.Provider
                                  value={discoveryPreferenceValue}
                                >
                                  <AppSettingsContext.Provider value={value}>
                                    <AmbientBackgroundSettingsContext.Provider
                                      value={ambientBackgroundValue}
                                    >
                                      <DecorScopeSettingsContext.Provider
                                        value={decorScopeValue}
                                      >
                                        {children}
                                      </DecorScopeSettingsContext.Provider>
                                    </AmbientBackgroundSettingsContext.Provider>
                                  </AppSettingsContext.Provider>
                                </DiscoveryPreferenceSettingsContext.Provider>
                              </StreamingProviderSettingsContext.Provider>
                            </ListLayoutSettingsContext.Provider>
                          </AutoDataCacheSettingsContext.Provider>
                        </NotificationSettingsContext.Provider>
                      </HapticsSettingsContext.Provider>
                    </AvatarSettingsContext.Provider>
                  </ImageQualitySettingsContext.Provider>
                </IconBackgroundSettingsContext.Provider>
              </OngoingTvShowsSettingsContext.Provider>
            </ContentSettingsContext.Provider>
          </SnowSettingsContext.Provider>
        </ThemeSettingsContext.Provider>
      </LanguageSettingsContext.Provider>
    </ApiSettingsContext.Provider>
  );
};

export const useAppSettings = () => {
  const context = useContext(AppSettingsContext);
  if (context === undefined) {
    throw new Error("useAppSettings must be used within an AppSettingsProvider");
  }
  return context;
};

const useRequiredContext = (context, name) => {
  const value = useContext(context);
  if (value === undefined) {
    throw new Error(`${name} must be used within an AppSettingsProvider`);
  }
  return value;
};

export const useLanguageSettings = () =>
  useRequiredContext(LanguageSettingsContext, "useLanguageSettings");

export const useThemeSettings = () =>
  useRequiredContext(ThemeSettingsContext, "useThemeSettings");

export const useSnowSettings = () =>
  useRequiredContext(SnowSettingsContext, "useSnowSettings");

export const useContentSettings = () =>
  useRequiredContext(ContentSettingsContext, "useContentSettings");

export const useOngoingTvShowsSettings = () =>
  useRequiredContext(
    OngoingTvShowsSettingsContext,
    "useOngoingTvShowsSettings",
  );

export const useIconBackgroundSettings = () =>
  useRequiredContext(
    IconBackgroundSettingsContext,
    "useIconBackgroundSettings",
  );

export const useAmbientBackgroundSettings = () =>
  useRequiredContext(
    AmbientBackgroundSettingsContext,
    "useAmbientBackgroundSettings",
  );

export const useDecorScopeSettings = () =>
  useRequiredContext(DecorScopeSettingsContext, "useDecorScopeSettings");

export const useImageQualitySettings = () =>
  useRequiredContext(ImageQualitySettingsContext, "useImageQualitySettings");

export const useAvatarSettings = () =>
  useRequiredContext(AvatarSettingsContext, "useAvatarSettings");

export const useApiSettings = () =>
  useRequiredContext(ApiSettingsContext, "useApiSettings");

export const useHapticsSettings = () =>
  useRequiredContext(HapticsSettingsContext, "useHapticsSettings");

export const useNotificationSettings = () =>
  useRequiredContext(NotificationSettingsContext, "useNotificationSettings");

export const useAutoDataCacheSettings = () =>
  useRequiredContext(
    AutoDataCacheSettingsContext,
    "useAutoDataCacheSettings",
  );

export const useListLayoutSettings = () =>
  useRequiredContext(ListLayoutSettingsContext, "useListLayoutSettings");

export const useStreamingProviderSettings = () =>
  useRequiredContext(
    StreamingProviderSettingsContext,
    "useStreamingProviderSettings",
  );

export const useDiscoveryPreferenceSettings = () =>
  useRequiredContext(
    DiscoveryPreferenceSettingsContext,
    "useDiscoveryPreferenceSettings",
  );
