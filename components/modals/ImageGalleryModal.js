import { Image } from "expo-image";
import React, { useEffect, useState, useRef } from "react";
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  // Kaynak görselin alt katmanı: detay ekranındakiyle AYNI bileşen ve URL, bellek
  // önbelleğinden anında çizilir (bkz. GalleryImageItem `underlayUri`).
  Image as NativeImage,
  LayoutAnimation,
  Platform,
  UIManager,
  Text
} from "react-native";
import LensLoader from "../LensLoader";
import GalleryFlier from "./gallery/GalleryFlier";
import useGalleryTransition from "./gallery/useGalleryTransition";
import {
  VIEW_RADIUS,
  centeredRect,
  flightStart,
  heroViewSize,
} from "./gallery/galleryGeometry";
import ModalBlurBackdrop from "../common/ModalBlurBackdrop";
import GlassSurface from "../common/GlassSurface";
import GlassIconButton from "../common/GlassIconButton";
// Pencere kenarına çizilir: ekranın Premium şeridiyle büyütülmüş üst boşluğunu değil gerçeğini al.
import { useWindowSafeAreaInsets } from "@context/ScreenInsetsContext";
import axios from "axios";
import {
  useApiSettings,
  useImageQualitySettings,
} from "@context/AppSettingsContext";
import { useLanguage } from "@context/LanguageContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as MediaLibrary from "expo-media-library";
// SDK 57: `saveToLibraryAsync` ana giriste artik yalnizca CALISMA ANINDA HATA
// FIRLATAN bir kabuk (bkz. expo-media-library/build/legacyWarnings.js). Izin
// fonksiyonlari ana giriste desteklenmeye devam ediyor, sadece bu cagri legacy
// girisinden alinmali. Alternatifi yeni sinif tabanli `Asset.create()` API'si.
import { saveToLibraryAsync } from "expo-media-library/legacy";
import { File, Paths } from "expo-file-system";
import Toast from "@components/AppToast";
import { i18nText } from "@utils/i18nText";
import { tmdbImageLanguageOrderOf, tmdbImageLanguagesOf } from "@utils/appLanguages";
import * as Haptics from "@services/hapticsService";
import GlassPillButton from "../common/GlassPillButton";
import { POSTER_CHOICE_RESULT, usePosterChoices } from "@context/PosterChoicesContext";
import { showPremiumLimitAlert } from "@services/premiumUpsell";
import { createCloseGate } from "@services/premiumUpsellHost";
import { PREMIUM_PLAN } from "@utils/premium";
import { CHOICE_KIND, MAX_POSTER_CHOICES, orderGalleryForChoice } from "@utils/posterChoices";
import { getPosterChoicesCopy } from "@utils/posterChoicesCopy";


import ModalToastHost from "@components/toast/ModalToastHost";
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}


const DOT_SIZE = 8;
const DOT_SPACING = 4;
const DOT_FULL_WIDTH = DOT_SIZE + DOT_SPACING * 2; // 16
const MAX_VISIBLE_DOTS = 3;
// Bu sayinin ustunde her gorsel icin bir animasyonlu nokta basmak yerine
// "12 / 340" sayaci gosteriliyor; aksi halde yuzlerce Animated.View aciliyor.
const MAX_DOT_COUNT = 40;

// Izgara olculeri. Once `width / gridCols - 8` yaziliyordu; satir tam olarak
// ekran genisligini dolduruyor, kenarlarda hic bosluk kalmiyordu. Artik kenar
// payi ve hucreler arasi bosluk hesaptan DUSULUYOR.
const GRID_EDGE = 16;
const GRID_GAP = 8;

// Ozel afis secici cubugu (alt kenar): dugme + altinda "Varsayilana don" baglantisi.
const PICKER_BOTTOM = 16;
const PICKER_HEIGHT = 48;
const PICKER_LINK_HEIGHT = 34;


// Buyutulmus gorselin indirme geri bildirimi.
//
// Her satir kendi Animated deger setini tasiyor: `status` prop'u 'success' ya da
// 'error'a dondugu anda rozet + halka + parlama birlikte oynuyor. Boylece
// renderItem icinde ref sozlugu tutmaya gerek kalmiyor -- ayni anda tek gorsel
// indirildigi icin de fazladan maliyeti yok.
// `viewSize` / `pageSize` galeriyle AYNI hesaptan gelir (galleryGeometry): uçan
// kopya tam bu kutuya iner. `underlayUri` yalnız kaynak görselde dolu: yüksek
// çözünürlüklü görsel yüklenene kadar altta önbellekteki kaynak görsel durur, bu
// yüzden kopya söküldüğünde ekranda hiçbir şey değişmez.
const GalleryImageItem = ({ item, status, uri, viewSize, pageSize, underlayUri, onClose, onDownload, onSelect, pickerActive, isSelected, selectionLabel }) => {
  const pressScale = useRef(new Animated.Value(1)).current;
  const popAnim = useRef(new Animated.Value(0)).current; // rozetin girisi/cikisi
  const ringAnim = useRef(new Animated.Value(0)).current; // disa acilan halka
  const flashAnim = useRef(new Animated.Value(0)).current; // kisa beyaz parlama

  const isLoading = status === "loading";
  const isError = status === "error";
  const isDone = status === "success" || isError;

  useEffect(() => {
    if (!isDone) return;

    popAnim.setValue(0);
    ringAnim.setValue(0);
    flashAnim.setValue(0);

    const animation = Animated.parallel([
      Animated.sequence([
        Animated.spring(popAnim, {
          toValue: 1,
          friction: 5,
          tension: 120,
          useNativeDriver: true,
        }),
        Animated.delay(750),
        Animated.timing(popAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(ringAnim, {
        toValue: 1,
        duration: 650,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(flashAnim, {
          toValue: 1,
          duration: 90,
          useNativeDriver: true,
        }),
        Animated.timing(flashAnim, {
          toValue: 0,
          duration: 320,
          useNativeDriver: true,
        }),
      ]),
    ]);

    animation.start();
    return () => animation.stop();
  }, [isDone, status, popAnim, ringAnim, flashAnim]);

  const handlePress = () => {
    if (isLoading) return;
    // Dokunusun kendisi de bir tepki versin: hafif ic ceken bir olcek.
    Animated.sequence([
      Animated.timing(pressScale, {
        toValue: 0.96,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.spring(pressScale, {
        toValue: 1,
        friction: 4,
        tension: 140,
        useNativeDriver: true,
      }),
    ]).start();
    if (pickerActive) {
      if (!isSelected) onSelect(item.file_path);
    } else {
      onDownload(item.file_path);
    }
  };

  const imageWidth = viewSize.width;
  const imageHeight = viewSize.height;

  const badgeScale = popAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });
  const badgeOpacity = popAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const ringScale = ringAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 2.2],
  });
  const ringOpacity = ringAnim.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [0, 0.55, 0],
  });
  const flashOpacity = flashAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.35],
  });

  let hintIcon = "download-outline";
  let hintLabel = i18nText("autoI18n.indirmek_icin_dokun", "İndirmek için dokun");
  if (isLoading) {
    hintLabel = i18nText("autoI18n.indiriliyor", "İndiriliyor");
  } else if (isError) {
    hintIcon = "alert-circle";
    hintLabel = i18nText("autoI18n.gorsel_indirilemedi", "İndirilemedi");
  } else if (status === "success") {
    hintIcon = "checkmark-circle";
    hintLabel = i18nText("autoI18n.galeriye_kaydedildi", "Galeriye kaydedildi");
  } else if (pickerActive) {
    hintIcon = isSelected ? "checkmark-circle" : "image-outline";
    hintLabel = selectionLabel;
  }

  return (
    <TouchableOpacity
      style={[styles.imageContainer, { width: pageSize.width, height: pageSize.height }]}
      activeOpacity={1}
      onPress={onClose}
    >
      <Animated.View style={{ transform: [{ scale: pressScale }] }}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handlePress}
          disabled={isLoading}
          accessibilityRole="button"
          accessibilityLabel={pickerActive ? selectionLabel : hintLabel}
          accessibilityState={pickerActive ? { selected: isSelected } : undefined}
        >
          <View
            style={[
              styles.imageClip,
              { width: imageWidth, height: imageHeight },
            ]}
          >
            {underlayUri ? (
              <NativeImage
                source={{ uri: underlayUri }}
                style={styles.underlay}
                resizeMode="cover"
                fadeDuration={0}
              />
            ) : null}
            <Image
              source={{ uri }}
              transition={underlayUri ? 160 : 0}
              style={[
                styles.image,
                { width: imageWidth, height: imageHeight },
              ]}
            />

            {isSelected && <View pointerEvents="none" style={styles.selectedBorder} />}

            <Animated.View
              pointerEvents="none"
              style={[styles.flashOverlay, { opacity: flashOpacity }]}
            />

            {isDone && (
              <View pointerEvents="none" style={styles.feedbackLayer}>
                <Animated.View
                  style={[
                    styles.feedbackRing,
                    isError && styles.feedbackRingError,
                    {
                      opacity: ringOpacity,
                      transform: [{ scale: ringScale }],
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.feedbackBadge,
                    isError && styles.feedbackBadgeError,
                    {
                      opacity: badgeOpacity,
                      transform: [{ scale: badgeScale }],
                    },
                  ]}
                >
                  <Ionicons
                    name={isError ? "close" : "checkmark"}
                    size={36}
                    color="#fff"
                  />
                </Animated.View>
              </View>
            )}
          </View>

          {/* Dokunma eylemi: seçim ya da indirme. */}
          <View
            style={[
              styles.downloadHint,
              status === "success" && styles.downloadHintSuccess,
              isError && styles.downloadHintError,
            ]}
            pointerEvents="none"
          >
            {isLoading ? (
              <LensLoader tone="mono"
                size="small"
                color="#fff"
                style={styles.hintSpinner}
              />
            ) : (
              <Ionicons name={hintIcon} size={14} color="#fff" />
            )}
            <Text allowFontScaling={false} style={styles.downloadHintText}>
              {hintLabel}
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </TouchableOpacity>
  );
};

const ImageGalleryModal = ({
  visible,
  onClose,
  mediaId,
  mediaType, // 'movie', 'tv' or 'season'
  seasonNumber, // used when mediaType is 'season'
  imageType, // 'poster' or 'backdrop'
  initialImage, // fallback/initial path
  originalLanguage, // yapımın özgün dili: görseller seçili dil → İngilizce → özgün dil → dilsiz sıralanır
  // Film/dizi detayından açılınca: "Afiş / Arka plan olarak kullan" (özel görsel, Premium).
  posterPicker = false,
  // Paylaşılan öğe geçişi (isteğe bağlı): dokunulan görselin PENCERE koordinatındaki
  // dikdörtgeni, ekranda çizilen URL'si ve köşe yarıçapı. Verilirse görsel
  // yerinden kalkıp ortaya uçar, kapanışta (aynı görseldeyse) yuvasına döner.
  origin = null,
  originUri = null,
  originRadius = 0,
  // Kaynak görselin opaklığı (Animated.Value): uçuş boyunca yuva boş kalsın diye
  // 0'a çekilir, görsel geri oturunca 1 olur. Ekran yeniden çizilmez.
  originOpacity = null,
}) => {
  const { API_KEY } = useApiSettings();
  const { getTmdbUrl } = useImageQualitySettings();
  const { language } = useLanguage();
  const insets = useWindowSafeAreaInsets();
  const posterChoices = usePosterChoices();
  const pickerCopy = getPosterChoicesCopy(language);
  const pickerActive =
    posterPicker &&
    (imageType === "poster" || imageType === "backdrop") &&
    (mediaType === "movie" || mediaType === "tv");
  const choiceKind = imageType === "poster" ? CHOICE_KIND.POSTER : CHOICE_KIND.BACKDROP;
  const isPosterChoice = choiceKind === CHOICE_KIND.POSTER;
  const chosenPath = pickerActive ? posterChoices.chosenFor(mediaType, mediaId, choiceKind) : null;
  // Galeri açılırken kullanılan görsel listenin başına alınır; açıkken yapılan seçim
  // sırayı DEĞİŞTİRMEZ (yoksa kaydırılan liste elin altında kayardı).
  const chosenRef = useRef(chosenPath);
  chosenRef.current = chosenPath;
  // Free kullanıcı "Afiş olarak kullan"a basınca: önce galeri kapanır, yükseltme
  // sayfası pencere kalktıktan SONRA açılır (iOS iki Modal'ı aynı anda sunamaz).
  const upsellGateRef = useRef(null);
  if (!upsellGateRef.current) upsellGateRef.current = createCloseGate(700);
  const imageLanguages = tmdbImageLanguagesOf(language, originalLanguage);
  const imageLanguageOrder = tmdbImageLanguageOrderOf(language, originalLanguage);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isGrid, setIsGrid] = useState(false);
  const [denseGrid, setDenseGrid] = useState(false);
  // Hangi gorselin indirildigini/sonuclandigini yol bazinda tutuyoruz ki
  // geri bildirim animasyonu dogru karede oynasin.
  const [downloadingPath, setDownloadingPath] = useState(null);
  const [feedback, setFeedback] = useState(null); // { path, status }
  const [currentIndex, setCurrentIndex] = useState(0);

  const scrollX = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef(null);
  const feedbackTimer = useRef(null);
  // Kaydırmalı listenin anlık ofseti ve sürükleme durumu: kapanışta görsel
  // yuvaya dönsün mü kararı (yarım kalmış kaydırmada dönmez).
  const scrollOffsetRef = useRef(0);
  const draggingRef = useRef(false);
  // Açılış uçuşu sürerken gelen liste bekletilir; iniş bitince uygulanır (UI
  // iş parçacığı uçuşu çizerken yüzlerce görünüm bağlanmasın).
  const pendingImagesRef = useRef(null);
  const returnToSlotRef = useRef(() => false);

  const transition = useGalleryTransition({
    visible,
    origin,
    originUri,
    originRadius,
    originOpacity,
    shouldReturnToSlot: () => returnToSlotRef.current(),
    onOpened: () => {
      if (pendingImagesRef.current) {
        setImages(pendingImagesRef.current);
        pendingImagesRef.current = null;
      }
    },
  });
  const { mounted, page } = transition;
  const pageW = page.width;
  const pageH = page.height;

  const downloading = !!downloadingPath;

  const isPoster = imageType === "poster";
  // Kaydırmalı kipteki büyük görselin kutusu (uçuşun hedefi ile aynı hesap).
  const heroView = heroViewSize(isPoster, pageW, pageH);
  // Izgara yogunlugu: varsayilan (poster 3 / backdrop 2) ya da sik (4 / 3).
  // Adet siniri kalkinca yuzlerce gorsel gelebiliyor; sik kip kaydirmayi
  // belirgin sekilde kisaltiyor. Secim modal kapaninca sifirlanmiyor.
  const gridCols = isPoster
    ? denseGrid
      ? 4
      : 3
    : denseGrid
      ? 3
      : 2;

  useEffect(() => {
    if (!visible || !mediaId || !mediaType) return undefined;
    let cancelled = false;
    // Kaynak görsel (özel seçim varsa o) her zaman başta: liste gelince kaydırma
    // konumu ve uçuşun indiği görsel değişmez.
    const heroFirst = (list) => orderGalleryForChoice(list, chosenRef.current || initialImage);
    const apply = (list) => {
      if (cancelled) return;
      if (transition.isOpening()) pendingImagesRef.current = list;
      else setImages(list);
    };

    const fetchImages = async () => {
      setLoading(true);
      try {
        const url = mediaType === "season"
          ? `https://api.themoviedb.org/3/tv/${mediaId}/season/${seasonNumber}/images?include_image_language=${imageLanguageOrder}`
          : `https://api.themoviedb.org/3/${mediaType}/${mediaId}/images?include_image_language=${imageLanguageOrder}`;

        const response = await axios.get(
          url,
          {
            headers: {
              accept: "application/json",
              Authorization: API_KEY,
            },
          }
        );

        const dataArray =
          imageType === "poster" ? response.data.posters : response.data.backdrops;

        if (dataArray && dataArray.length > 0) {
          // Dile göre grupla
          // Gruplar uygulama dilinin görsel öncelik sırasını izler (utils/appLanguages).
          const grouped = Object.fromEntries([...imageLanguages, "null"].map((code) => [code, []]));
          dataArray.forEach((img) => {
            const code = img.iso_639_1 === null ? "null" : img.iso_639_1;
            if (grouped[code]) grouped[code].push(img);
          });

          // Puanlarına (vote_average) göre yüksekten düşüğe sıralama fonksiyonu
          const sortByVotes = (a, b) => b.vote_average - a.vote_average;

          // Adet siniri yok: TMDB'nin dondurdugu tum gorseller gosteriliyor.
          // Sadece siralama uygulanir (once kullanicinin dili, sonra Ingilizce, sonra
          // yapimin ozgun dili, en son dilsiz gorseller; her grup kendi icinde puana gore).
          const finalImages = [...imageLanguages, "null"].flatMap((code) =>
            grouped[code].sort(sortByVotes),
          );

          apply(heroFirst(finalImages));
        } else {
          // Fallback if API returned nothing
          const fallback = initialImage ? [{ file_path: initialImage }] : [];
          apply(heroFirst(fallback));
        }
      } catch (error) {
        console.error("Error fetching images:", error);
        if (initialImage) {
          apply(heroFirst([{ file_path: initialImage }]));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchImages();
    return () => {
      cancelled = true;
    };
  }, [visible, mediaId, mediaType, seasonNumber, imageType, API_KEY, initialImage, imageLanguageOrder, language, pickerActive]);

  // Modal tamamen kalkınca durumu sıfırla. `visible` değil `mounted`: kapanış
  // animasyonu boyunca görsel/kip yerinde kalmalı (yoksa uçan görsel boşa döner).
  useEffect(() => {
    if (!mounted) {
      pendingImagesRef.current = null;
      scrollOffsetRef.current = 0;
      draggingRef.current = false;
      setImages([]);
      setLoading(true);
      scrollX.setValue(0);
      setIsGrid(false);
      setCurrentIndex(0);
      if (feedbackTimer.current) {
        clearTimeout(feedbackTimer.current);
        feedbackTimer.current = null;
      }
      setFeedback(null);
      setDownloadingPath(null);
    }
  }, [mounted]);

  // Modal kapali sayfa degistiginde de zamanlayici asili kalmasin.
  useEffect(
    () => () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      upsellGateRef.current?.cancel();
    },
    []
  );

  /* Ozel gorsel: dokunulan gorseli bu yapimin afisi / arka plani yap (Premium). */
  const chooseImage = (path) => {
    if (!path) return;
    if (!posterChoices.allowed && posterChoices.uid) {
      Haptics.selectionAsync().catch(() => {});
      // Yükseltme sayfası denenen görseli gösterir: "Şimdi" (çizilen) → "Seçtiğin".
      const imageKind = isPosterChoice ? "poster" : "backdrop";
      const width = isPosterChoice ? 120 : 300;
      const shown = chosenPath || initialImage;
      const preview = {
        kind: choiceKind,
        fromUri: shown ? getTmdbUrl(shown, imageKind, width) : null,
        toUri: getTmdbUrl(path, imageKind, width),
      };
      upsellGateRef.current.begin(() =>
        showPremiumLimitAlert("custom_posters", PREMIUM_PLAN.FREE, { preview }),
      );
      onClose();
      return;
    }
    const result = posterChoices.choose(mediaType, mediaId, path, choiceKind);
    if (result === POSTER_CHOICE_RESULT.OK) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Toast.show({
        type: "success",
        text1: isPosterChoice ? pickerCopy.chosenToast : pickerCopy.backdropChosenToast,
        text2: isPosterChoice ? pickerCopy.chosenToastSub : pickerCopy.backdropChosenToastSub,
      });
    } else if (result === POSTER_CHOICE_RESULT.FULL) {
      Toast.show({
        type: "error",
        text1: isPosterChoice
          ? pickerCopy.fullToast(MAX_POSTER_CHOICES)
          : pickerCopy.backdropFullToast(MAX_POSTER_CHOICES),
        text2: pickerCopy.fullToastSub,
      });
    } else if (result === POSTER_CHOICE_RESULT.SIGNED_OUT) {
      Toast.show({ type: "info", text1: pickerCopy.signInNeeded });
    }
  };

  const resetChoice = () => {
    if (posterChoices.reset(mediaType, mediaId, choiceKind) !== POSTER_CHOICE_RESULT.OK) return;
    Haptics.selectionAsync().catch(() => {});
    Toast.show({
      type: "success",
      text1: isPosterChoice ? pickerCopy.resetToast : pickerCopy.backdropResetToast,
    });
  };

  /* Sonucu bir sure ekranda tut, sonra ipucunu normale dondur. */
  const flashFeedback = (path, status) => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    setFeedback({ path, status });
    feedbackTimer.current = setTimeout(() => {
      setFeedback(null);
      feedbackTimer.current = null;
    }, 1600);
  };

  /* Poster/backdrop'u cihaz galerisine indir */
  const downloadImage = async (filePath) => {
    if (!filePath || downloading) return;
    try {
      setDownloadingPath(filePath);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const { status } = await MediaLibrary.requestPermissionsAsync(true);
      if (status !== "granted") {
        // Izin reddi bir hata degil, yapilacak is var: mesaji toast tasisin.
        Toast.show({
          type: "error",
          text1: i18nText("autoI18n.galeriye_kaydetmek_icin_izin_gerekli", "Galeriye kaydetmek için izin gerekli"),
        });
        return;
      }
      const url = getTmdbUrl(filePath, isPoster ? "poster" : "backdrop", "original");
      const fileName = filePath.replace(/^\//, "").replace(/\//g, "_");
      const dest = new File(Paths.cache, fileName);
      if (dest.exists) dest.delete();
      const out = await File.downloadFileAsync(url, dest);
      await saveToLibraryAsync(out.uri);
      // Basari toast'i yok: geri bildirimi gorselin uzerindeki rozet veriyor.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      flashFeedback(filePath, "success");
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      flashFeedback(filePath, "error");
      Toast.show({ type: "error", text1: i18nText("autoI18n.indirme_hatasi", "İndirme hatası: ") + e.message });
    } finally {
      setDownloadingPath(null);
    }
  };

  const toggleGrid = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsGrid(!isGrid);
  };

  const toggleDensity = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setDenseGrid((prev) => !prev);
    Haptics.selectionAsync().catch(() => {});
  };

  const handleGridItemPress = (index) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsGrid(false);
    // Indir / "Afis olarak kullan" ekrandaki gorsele uygulanir: sira burada da
    // guncellenmeli (kaydirma sonu olayi programatik atlamada gelmez).
    setCurrentIndex(index);

    // Doğrudan noktanın konumunu da güncelleyelim
    scrollX.setValue(index * pageW);
    
    setTimeout(() => {
      if (flatListRef.current && images.length > 0) {
        // scrollToIndex yerine scrollToOffset kullanıyoruz. 
        // Öğeler henüz render edilmese bile X pikseline doğrudan zıplar ve çökme yapmaz.
        scrollOffsetRef.current = index * pageW;
        flatListRef.current.scrollToOffset({ offset: index * pageW, animated: false });
      }
    }, 150); // Yatay listin render olması için ufak gecikme
  };

  // Özel seçim yoksa TMDB'nin varsayılan görseli de "kullanılan" görseldir.
  const shownImage = chosenPath || initialImage;

  const renderItem = ({ item }) => {
    let status = "idle";
    if (downloadingPath === item.file_path) status = "loading";
    else if (feedback?.path === item.file_path) status = feedback.status;
    // Detay ekranında çizilen görsel: altında önbellekteki kaynak görsel durur.
    const isHero = Boolean(item.file_path) && item.file_path === shownImage;

    return (
      <GalleryImageItem
        item={item}
        status={status}
        viewSize={heroView}
        pageSize={page}
        underlayUri={isHero && originUri ? originUri : null}
        // 3. argüman EKRANDAKİ genişlik (TMDB boyutu değil): eskiden afişe 500,
        // arka plana "original" (4K'ya varan) gidiyordu — her kaydırmada dev
        // görsel çözülüyordu. İndirme düğmesi yine "original"i ayrıca ister.
        uri={getTmdbUrl(
          item.file_path,
          isPoster ? "poster" : "backdrop",
          heroView.width
        )}
        onClose={onClose}
        onDownload={downloadImage}
        onSelect={chooseImage}
        pickerActive={pickerActive}
        isSelected={pickerActive && item.file_path === shownImage}
        selectionLabel={item.file_path === shownImage
          ? (isPosterChoice ? pickerCopy.currentPoster : pickerCopy.currentBackdrop)
          : (isPosterChoice ? pickerCopy.useAsPoster : pickerCopy.useAsBackdrop)}
      />
    );
  };

  const renderGridItem = ({ item, index }) => {
    const gridItemWidth =
      (pageW - GRID_EDGE * 2 - GRID_GAP * (gridCols - 1)) / gridCols;
    const gridItemHeight = isPoster ? gridItemWidth * 1.5 : gridItemWidth * (9 / 16);
    const isSelected = pickerActive && item.file_path === shownImage;

    // Bosluklar contentContainer/columnWrapper `gap`'inden geliyor; hucrenin
    // kendi margin'i yok, yoksa iki bosluk toplanirdi.
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => handleGridItemPress(index)}
        accessibilityRole="button"
        accessibilityLabel={i18nText("autoI18n.onizleme", "Önizleme")}
        accessibilityState={pickerActive ? { selected: isSelected } : undefined}
      >
        {/* getTmdbUrl'in 3. argumani TMDB boyutu degil, EKRANDAKI genislik.
            Sabit 500 gecilince hedef 500*pixelRatio'ya cikiyor ve hicbir poster
            boyutu yetmedigi icin `original` iniyordu: kucucuk kucuk resimler
            icin tam cozunurluk. Gercek genisligi veriyoruz. */}
        <Image
          source={{
            uri: getTmdbUrl(
              item.file_path,
              isPoster ? "poster" : "backdrop",
              gridItemWidth
            ),
          }}
          style={[
            styles.gridImage,
            { width: gridItemWidth, height: gridItemHeight },
          ]}
        />
        {isSelected && <View pointerEvents="none" style={[styles.selectedBorder, { width: gridItemWidth, height: gridItemHeight, borderRadius: 8 }]} />}
        {isSelected && (
          <View
            style={styles.chosenBadge}
            accessible
            accessibilityLabel={isPosterChoice ? pickerCopy.chosenBadge : pickerCopy.chosenBackdropBadge}
          >
            <Ionicons name="checkmark" size={14} color="#1a1a1a" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // Ekrandaki gorsel su an cizilen afis/arka plan mi (secim yoksa TMDB varsayilani).
  const currentPath = images[currentIndex]?.file_path || (images.length === 0 ? initialImage : null);
  const currentIsShown = Boolean(currentPath) && currentPath === shownImage;
  const useLabel = isPosterChoice ? pickerCopy.useAsPoster : pickerCopy.useAsBackdrop;
  const currentLabel = isPosterChoice ? pickerCopy.currentPoster : pickerCopy.currentBackdrop;
  const showPicker = pickerActive && !isGrid && !loading && Boolean(currentPath);
  // Secici cubugu altta yer kaplar: noktalar/sayac onun ustune cikar.
  const pickerReserve = insets.bottom + PICKER_BOTTOM + PICKER_HEIGHT + PICKER_LINK_HEIGHT;
  const indicatorBottom = showPicker ? pickerReserve + 12 : 40;

  const showDots = images.length > 1 && images.length <= MAX_DOT_COUNT;
  const showCounter = images.length > MAX_DOT_COUNT;

  const getTranslateX = () => {
    if (!showDots || images.length <= MAX_VISIBLE_DOTS) {
      return scrollX.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0],
      });
    }

    const inputRange = [];
    const outputRange = [];

    for (let i = 0; i < images.length; i++) {
      inputRange.push(i * pageW);
      let shift = 0;
      if (i > 0 && i < images.length - 1) {
        shift = -(i - 1) * DOT_FULL_WIDTH;
      } else if (i === images.length - 1) {
        shift = -(images.length - MAX_VISIBLE_DOTS) * DOT_FULL_WIDTH;
      }
      outputRange.push(shift);
    }

    return scrollX.interpolate({
      inputRange,
      outputRange,
      extrapolate: "clamp",
    });
  };

  const translateX = getTranslateX();

  // Kapanışta görsel yuvasına dönsün mü: kaydırmalı kipte, kaynak görselin
  // sayfasında ve kaydırma ortada kalmamışken.
  returnToSlotRef.current = () => {
    if (isGrid || draggingRef.current) return false;
    const data = images.length > 0 ? images : [{ file_path: shownImage }];
    const heroIndex = data.findIndex((it) => it.file_path === shownImage);
    if (heroIndex < 0) return false;
    return Math.abs(scrollOffsetRef.current - heroIndex * pageW) < 2;
  };

  // Uçan kopyanın hedefi = listedeki kaynak görselin kutusu (aynı formül).
  const heroTarget = centeredRect(heroView, pageW, pageH);
  const flight = transition.flight;
  const flierStart = flight ? flightStart(flight.rect, heroTarget) : null;

  return (
    <Modal
      visible={mounted}
      onRequestClose={onClose}
      onShow={transition.onModalShow}
      onDismiss={() => upsellGateRef.current?.finish()}
      // Geçiş elle (useGalleryTransition): blur + çubuklar yerinde solar, görsel
      // kaynağından uçar.
      animationType="none"
      transparent
      // Pencere tüm ekranı kaplasın. Kaynak yuva yine de KÖKE göre çevrilir
      // (kök de ölçülür): Android'de measureInWindow durum çubuğu kadar kayık döner.
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View
        ref={transition.rootRef}
        collapsable={false}
        style={styles.root}
        onLayout={transition.onRootLayout}
        // Geçiş sürerken dokunuş yok: yarım uçuşta ızgaraya geçmek / ikinci kez
        // kapatmak durum makinesini karıştırmasın. Android geri tuşu yine çalışır.
        pointerEvents={transition.interactive ? "auto" : "none"}
      >
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { opacity: transition.backdropOpacity }]}
      >
        <ModalBlurBackdrop intensity={60} />
      </Animated.View>
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        activeOpacity={1}
      />

      {/* Ust bar: solda bilgi (adet), sagda eylemler.
          Eylemler tek bir hap icinde gruplandi; onceden ekranin sagina yapisik
          dort ayri daire duruyordu. Konum artik guvenli alandan hesaplaniyor,
          iOS/Android icin sabit 50/30 degil. */}
      <Animated.View style={[styles.headerBar, { top: insets.top + 12, opacity: transition.backdropOpacity }]}>
        {images.length > 0 && (
          <View style={styles.countBadge}>
            <Ionicons name="images-outline" size={14} color="rgba(255,255,255,0.75)" />
            <Text allowFontScaling={false} style={styles.countText}>
              {images.length}
            </Text>
          </View>
        )}

        <View style={styles.headerSpacer} />

        {/* Yuklenirken hic buton yok; bos bir hap gorunmesin. */}
        {images.length > 0 && (
        <GlassSurface
          radius={22}
          scheme="dark"
          style={styles.actionCluster}
          fallbackStyle={styles.actionClusterFallback}
        >
          {!isGrid && (
            <TouchableOpacity
              style={styles.clusterButton}
              onPress={() => downloadImage(images[currentIndex]?.file_path)}
              disabled={downloading}
              accessibilityRole="button"
              accessibilityLabel={i18nText("autoI18n.indir", "İndir")}
            >
              {downloading ? (
                <LensLoader tone="mono" size="small" color="#fff" />
              ) : (
                <Ionicons name="download-outline" size={19} color="#fff" />
              )}
            </TouchableOpacity>
          )}

          {/* Sutun sayisi: varsayilan <-> sik. Yalnizca izgara kipinde anlamli. */}
          {isGrid && images.length > 1 && (
            <TouchableOpacity
              style={[
                styles.clusterButton,
                styles.densityButton,
                denseGrid && styles.clusterButtonActive,
              ]}
              onPress={toggleDensity}
              accessibilityRole="button"
              accessibilityState={{ selected: denseGrid }}
              accessibilityLabel={i18nText(
                "autoI18n.sutun_sayisi_degistir",
                "Sütun sayısını değiştir"
              )}
            >
              <Ionicons
                name="apps-outline"
                size={15}
                color={denseGrid ? "#FFD700" : "#fff"}
              />
              <Text
                allowFontScaling={false}
                style={[styles.densityText, denseGrid && styles.densityTextActive]}
              >
                {gridCols}
              </Text>
            </TouchableOpacity>
          )}

          {images.length > 1 && (
            <TouchableOpacity
              style={[styles.clusterButton, isGrid && styles.clusterButtonActive]}
              onPress={toggleGrid}
              accessibilityRole="button"
              accessibilityState={{ selected: isGrid }}
              accessibilityLabel={i18nText("autoI18n.izgara_gorunumu", "Izgara görünümü")}
            >
              <Ionicons
                name={isGrid ? "images-outline" : "grid-outline"}
                size={19}
                color={isGrid ? "#FFD700" : "#fff"}
              />
            </TouchableOpacity>
          )}
        </GlassSurface>
        )}

        <GlassIconButton
          icon="close"
          iconSize={22}
          size={38}
          fallbackRadius={19}
          variant="blur"
          flatFallback
          fallbackStyle={styles.closeButtonFallback}
          accessibilityLabel={i18nText("autoI18n.kapat", "Kapat")}
          onPress={onClose}
        />
      </Animated.View>

      <Animated.View
        style={[styles.contentContainer, { opacity: transition.contentOpacity }]}
        pointerEvents="box-none"
      >
        {loading && !initialImage ? (
          <LensLoader size="large" color="#FFD700" />
        ) : (
          <>
            <Animated.FlatList
              ref={flatListRef}
              key={isGrid ? `grid-${gridCols}` : "swipe"}
              style={{ flex: 1, width: "100%" }}
              // Liste gelene kadar ekrandaki görsel (özel seçim varsa o) gösterilir.
              data={images.length > 0 ? images : [{ file_path: shownImage }]}
              onScrollBeginDrag={!isGrid ? () => { draggingRef.current = true; } : undefined}
              onScrollEndDrag={!isGrid ? () => { draggingRef.current = false; } : undefined}
              // Kaydırmalı kipte her sayfa tam ekran görsel: yalnız komşular bağlı kalsın.
              initialNumToRender={isGrid ? 12 : 1}
              maxToRenderPerBatch={isGrid ? 12 : 2}
              windowSize={isGrid ? 7 : 3}
              removeClippedSubviews={Platform.OS === "android"}
              extraData={chosenPath}
              keyExtractor={(item, index) => item.file_path || String(index)}
              renderItem={isGrid ? renderGridItem : renderItem}
              numColumns={isGrid ? gridCols : 1}
              // numColumns 1 iken columnWrapperStyle vermek RN'de uyari uretir.
              columnWrapperStyle={isGrid ? styles.gridRow : undefined}
              horizontal={!isGrid}
              pagingEnabled={!isGrid}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={
                isGrid
                  ? [styles.gridListContent, { paddingTop: insets.top + 76 }]
                  : styles.flatListContent
              }
              onScroll={
                !isGrid
                  ? Animated.event(
                      [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                      {
                        useNativeDriver: true,
                        listener: (e) => {
                          scrollOffsetRef.current = e.nativeEvent.contentOffset.x;
                        },
                      }
                    )
                  : undefined
              }
              scrollEventThrottle={16}
              onMomentumScrollEnd={
                !isGrid
                  ? (e) => {
                      draggingRef.current = false;
                      scrollOffsetRef.current = e.nativeEvent.contentOffset.x;
                      setCurrentIndex(
                        Math.round(e.nativeEvent.contentOffset.x / pageW)
                      );
                    }
                  : undefined
              }
              getItemLayout={
                !isGrid
                  ? (data, index) => ({ length: pageW, offset: pageW * index, index })
                  : undefined
              }
            />

            {/* Cok fazla gorsel varsa nokta yerine konum sayaci */}
            {!isGrid && showCounter && (
              <View style={[styles.counterPill, { bottom: indicatorBottom }]}>
                <Text allowFontScaling={false} style={styles.counterText}>
                  {currentIndex + 1} / {images.length}
                </Text>
              </View>
            )}

            {/* Pagination Dots (Sliding Window) */}
            {!isGrid && showDots && (
              <View style={[styles.paginationWrapper, { bottom: indicatorBottom }]}>
                <Animated.View
                  style={[
                    styles.paginationContainer,
                    { transform: [{ translateX }] },
                  ]}
                >
                  {images.map((_, i) => {
                    const inputRange = [
                      (i - 1) * pageW,
                      i * pageW,
                      (i + 1) * pageW,
                    ];

                    const opacity = scrollX.interpolate({
                      inputRange,
                      outputRange: [0.3, 1, 0.3],
                      extrapolate: "clamp",
                    });

                    const scale = scrollX.interpolate({
                      inputRange,
                      outputRange: [0.8, 1.3, 0.8],
                      extrapolate: "clamp",
                    });

                    return (
                      <Animated.View
                        key={i.toString()}
                        style={[
                          styles.dot,
                          { opacity, transform: [{ scale }] },
                        ]}
                      />
                    );
                  })}
                </Animated.View>
              </View>
            )}
          </>
        )}
      </Animated.View>

      {/* Uçan kopya: kaynak yuvadan ortaya (ve geri). Her uçuşta yeni anahtar. */}
      {flight && flierStart ? (
        <GalleryFlier
          key={flight.id}
          uri={flight.uri}
          target={heroTarget}
          start={flierStart}
          fromRadius={flight.radius || 0}
          toRadius={VIEW_RADIUS}
          progress={transition.progress}
          onMounted={() => transition.onFlierMounted(flight.id)}
          onReady={() => transition.onFlierReady(flight.id)}
          onFailed={() => transition.onFlierFailed(flight.id)}
          onCoverChange={(covering) => transition.onFlierCover(flight.id, covering)}
        />
      ) : null}

      {/* Ozel gorsel secici: ekrandaki gorsel = cizilen afis/arka plansa "... bu",
          degilse "... olarak kullan" (Free'de kilit + Premium etiketi → yukseltme). */}
      {showPicker && (
        <Animated.View
          style={[styles.pickerBar, { bottom: insets.bottom + PICKER_BOTTOM, opacity: transition.backdropOpacity }]}
          pointerEvents="box-none"
        >
          <GlassPillButton
            height={PICKER_HEIGHT}
            paddingHorizontal={22}
            fallbackStyle={styles.pickerFallback}
            onPress={currentIsShown ? undefined : () => chooseImage(currentPath)}
            accessibilityLabel={currentIsShown ? currentLabel : useLabel}
          >
            {currentIsShown ? (
              <>
                <Ionicons name="checkmark-circle" size={19} color="#3DDC84" />
                <Text allowFontScaling={false} style={styles.pickerLabel}>
                  {currentLabel}
                </Text>
              </>
            ) : (
              <>
                <Ionicons
                  name={posterChoices.allowed ? "image-outline" : "lock-closed"}
                  size={18}
                  color="#fff"
                />
                <Text allowFontScaling={false} style={styles.pickerLabel}>
                  {useLabel}
                </Text>
                {!posterChoices.allowed && posterChoices.uid ? (
                  <Text allowFontScaling={false} style={styles.premiumTag}>
                    {pickerCopy.premiumTag}
                  </Text>
                ) : null}
              </>
            )}
          </GlassPillButton>
          <View style={styles.pickerLinkSlot}>
            {chosenPath ? (
              <TouchableOpacity
                onPress={resetChoice}
                hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
                accessibilityRole="button"
              >
                <Text allowFontScaling={false} style={styles.pickerLink}>
                  {pickerCopy.resetPoster}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </Animated.View>
      )}
      </View>
      <ModalToastHost visible={visible} />
    </Modal>
  );
};

const styles = StyleSheet.create({
  headerBar: {
    position: "absolute",
    left: GRID_EDGE,
    right: GRID_EDGE,
    zIndex: 100,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerSpacer: {
    flex: 1,
  },
  countBadge: {
    height: 34,
    paddingHorizontal: 11,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.45)",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  countText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  // Eylemler tek kapsayici icinde: dagilmis daireler yerine tek bir kume.
  // Eylem hapı iOS 26+'da tek bir Liquid Glass kapsül; içindeki düğmeler
  // saydam kalır (cam içine cam konmaz). Zemin/çerçeve yalnız eski yolda.
  actionCluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    padding: 3,
  },
  actionClusterFallback: {
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  clusterButton: {
    minWidth: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  clusterButtonActive: {
    backgroundColor: "rgba(255,215,0,0.16)",
  },
  densityButton: {
    flexDirection: "row",
    gap: 3,
    paddingHorizontal: 10,
  },
  densityText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  densityTextActive: {
    color: "#FFD700",
  },
  // Kapat ayri duruyor: eylem degil, cikis.
  closeButtonFallback: {
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  root: {
    flex: 1,
  },
  underlay: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
  },
  contentContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  flatListContent: {
    flexGrow: 1,
  },
  // paddingTop calisma aninda guvenli alana gore veriliyor.
  gridListContent: {
    paddingHorizontal: GRID_EDGE,
    paddingBottom: 40,
    gap: GRID_GAP, // satirlar arasi
  },
  gridRow: {
    gap: GRID_GAP, // sutunlar arasi
  },
  // Boyut çalışma anında kök görünümün ölçüsünden (sayfa) verilir.
  imageContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    borderRadius: VIEW_RADIUS,
    contentFit: "cover",
  },
  // Parlama ve rozet katmanini gorselin kose yaricapina kirpar.
  imageClip: {
    borderRadius: VIEW_RADIUS,
    overflow: "hidden",
  },
  selectedBorder: {
    ...StyleSheet.absoluteFill,
    borderWidth: 1.5,
    borderColor: "#3DDC84",
    borderRadius: 20,
  },
  flashOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#fff",
  },
  feedbackLayer: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
  },
  feedbackRing: {
    position: "absolute",
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: "#3DDC84",
  },
  feedbackRingError: {
    borderColor: "#FF5A5F",
  },
  feedbackBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(61,220,132,0.92)",
  },
  feedbackBadgeError: {
    backgroundColor: "rgba(255,90,95,0.92)",
  },
  downloadHint: {
    position: "absolute",
    bottom: 12,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  downloadHintSuccess: {
    backgroundColor: "rgba(31,120,72,0.85)",
  },
  downloadHintError: {
    backgroundColor: "rgba(150,40,44,0.85)",
  },
  // Ikon 14px; spinner'i ayni kutuya sigdirmazsak ipucu hapi zipliyor.
  hintSpinner: { width: 14, height: 14, transform: [{ scale: 0.7 }] },
  downloadHintText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  gridImage: {
    borderRadius: 8,
    contentFit: "cover",
  },
  chosenBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#3DDC84",
    justifyContent: "center",
    alignItems: "center",
  },
  pickerBar: {
    position: "absolute",
    left: GRID_EDGE,
    right: GRID_EDGE,
    alignItems: "center",
  },
  pickerFallback: {
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  pickerLabel: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
  premiumTag: {
    color: "#1a1a1a",
    backgroundColor: "#FFD700",
    fontSize: 11,
    fontWeight: "800",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: "hidden",
  },
  pickerLinkSlot: {
    height: PICKER_LINK_HEIGHT,
    justifyContent: "flex-end",
  },
  pickerLink: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  counterPill: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  counterText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  paginationWrapper: {
    position: "absolute",
    bottom: 40,
    width: DOT_FULL_WIDTH * MAX_VISIBLE_DOTS, // tam olarak 3 nokta genişliğinde görünür alan
    overflow: "hidden",
    alignSelf: "center",
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    height: 20,
  },
  paginationContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: "#FFD700",
    marginHorizontal: DOT_SPACING,
  },
});

export default ImageGalleryModal;
