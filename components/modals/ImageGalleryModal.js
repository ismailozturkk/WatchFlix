import { Image } from "expo-image";
import React, { useEffect, useState, useRef } from "react";
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
  Text
} from "react-native";
import ModalBlurBackdrop from "../common/ModalBlurBackdrop";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import Toast from "react-native-toast-message";
import { i18nText } from "@utils/i18nText";
import * as Haptics from "@services/hapticsService";


if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width, height } = Dimensions.get("window");

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

// Buyutulmus gorselin indirme geri bildirimi.
//
// Her satir kendi Animated deger setini tasiyor: `status` prop'u 'success' ya da
// 'error'a dondugu anda rozet + halka + parlama birlikte oynuyor. Boylece
// renderItem icinde ref sozlugu tutmaya gerek kalmiyor -- ayni anda tek gorsel
// indirildigi icin de fazladan maliyeti yok.
const GalleryImageItem = ({ item, status, isPoster, uri, onClose, onDownload }) => {
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
    onDownload(item.file_path);
  };

  const imageWidth = isPoster ? 300 : 380;
  const imageHeight = isPoster ? 450 : 380 * (9 / 16);

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
  }

  return (
    <TouchableOpacity
      style={styles.imageContainer}
      activeOpacity={1}
      onPress={onClose}
    >
      <Animated.View style={{ transform: [{ scale: pressScale }] }}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handlePress}
          disabled={isLoading}
        >
          <View
            style={[
              styles.imageClip,
              { width: imageWidth, height: imageHeight },
            ]}
          >
            <Image
              source={{ uri }}
              style={[
                styles.image,
                { width: imageWidth, height: imageHeight },
              ]}
            />

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

          {/* İndirme ipucu */}
          <View
            style={[
              styles.downloadHint,
              status === "success" && styles.downloadHintSuccess,
              isError && styles.downloadHintError,
            ]}
            pointerEvents="none"
          >
            {isLoading ? (
              <ActivityIndicator
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
}) => {
  const { API_KEY } = useApiSettings();
  const { imageQuality, getTmdbUrl } = useImageQualitySettings();
  const { language } = useLanguage();
  const insets = useSafeAreaInsets();
  const imageLanguageOrder = language === "tr" ? "tr,en,null" : "en,tr,null";
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

  const downloading = !!downloadingPath;

  const isPoster = imageType === "poster";
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
    if (!visible || !mediaId || !mediaType) return;

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
          const grouped = { tr: [], en: [], null: [] };
          dataArray.forEach((img) => {
            const lang = img.iso_639_1;
            if (lang === "tr") grouped.tr.push(img);
            else if (lang === "en") grouped.en.push(img);
            else if (lang === null) grouped.null.push(img);
          });

          // Puanlarına (vote_average) göre yüksekten düşüğe sıralama fonksiyonu
          const sortByVotes = (a, b) => b.vote_average - a.vote_average;

          // Adet siniri yok: TMDB'nin dondurdugu tum gorseller gosteriliyor.
          // Sadece siralama uygulanir (once kullanicinin dili, sonra diger dil,
          // en son dilsiz gorseller; her grup kendi icinde puana gore).
          const trSorted = grouped.tr.sort(sortByVotes);
          const enSorted = grouped.en.sort(sortByVotes);
          const nullSorted = grouped.null.sort(sortByVotes);

          const primaryImages = language === "tr" ? trSorted : enSorted;
          const secondaryImages = language === "tr" ? enSorted : trSorted;
          const finalImages = [...primaryImages, ...secondaryImages, ...nullSorted];

          setImages(finalImages);
        } else {
          // Fallback if API returned nothing
          if (initialImage) {
            setImages([{ file_path: initialImage }]);
          } else {
            setImages([]);
          }
        }
      } catch (error) {
        console.error("Error fetching images:", error);
        if (initialImage) {
          setImages([{ file_path: initialImage }]);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchImages();
  }, [visible, mediaId, mediaType, seasonNumber, imageType, API_KEY, initialImage, imageLanguageOrder, language]);

  // Handle reset state when modal closes
  useEffect(() => {
    if (!visible) {
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
  }, [visible]);

  // Modal kapali sayfa degistiginde de zamanlayici asili kalmasin.
  useEffect(
    () => () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    },
    []
  );

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
      const { status } = await MediaLibrary.requestPermissionsAsync();
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
    
    // Doğrudan noktanın konumunu da güncelleyelim
    scrollX.setValue(index * width);
    
    setTimeout(() => {
      if (flatListRef.current && images.length > 0) {
        // scrollToIndex yerine scrollToOffset kullanıyoruz. 
        // Öğeler henüz render edilmese bile X pikseline doğrudan zıplar ve çökme yapmaz.
        flatListRef.current.scrollToOffset({ offset: index * width, animated: false });
      }
    }, 150); // Yatay listin render olması için ufak gecikme
  };

  const renderItem = ({ item }) => {
    let status = "idle";
    if (downloadingPath === item.file_path) status = "loading";
    else if (feedback?.path === item.file_path) status = feedback.status;

    return (
      <GalleryImageItem
        item={item}
        status={status}
        isPoster={isPoster}
        uri={getTmdbUrl(
          item.file_path,
          isPoster ? "poster" : "backdrop",
          isPoster ? 500 : "original"
        )}
        onClose={onClose}
        onDownload={downloadImage}
      />
    );
  };

  const renderGridItem = ({ item, index }) => {
    const gridItemWidth =
      (width - GRID_EDGE * 2 - GRID_GAP * (gridCols - 1)) / gridCols;
    const gridItemHeight = isPoster ? gridItemWidth * 1.5 : gridItemWidth * (9 / 16);

    // Bosluklar contentContainer/columnWrapper `gap`'inden geliyor; hucrenin
    // kendi margin'i yok, yoksa iki bosluk toplanirdi.
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => handleGridItemPress(index)}
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
      </TouchableOpacity>
    );
  };

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
      inputRange.push(i * width);
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

  return (
    <Modal
      visible={visible}
      onRequestClose={onClose}
      animationType="fade"
      transparent
    >
      <ModalBlurBackdrop intensity={60} />
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        activeOpacity={1}
      />

      {/* Ust bar: solda bilgi (adet), sagda eylemler.
          Eylemler tek bir hap icinde gruplandi; onceden ekranin sagina yapisik
          dort ayri daire duruyordu. Konum artik guvenli alandan hesaplaniyor,
          iOS/Android icin sabit 50/30 degil. */}
      <View style={[styles.headerBar, { top: insets.top + 12 }]}>
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
        <View style={styles.actionCluster}>
          {!isGrid && (
            <TouchableOpacity
              style={styles.clusterButton}
              onPress={() => downloadImage(images[currentIndex]?.file_path)}
              disabled={downloading}
              accessibilityRole="button"
              accessibilityLabel={i18nText("autoI18n.indir", "İndir")}
            >
              {downloading ? (
                <ActivityIndicator size="small" color="#fff" />
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
        </View>
        )}

        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={i18nText("autoI18n.kapat", "Kapat")}
        >
          <Ionicons name="close" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.contentContainer} pointerEvents="box-none">
        {loading && !initialImage ? (
          <ActivityIndicator size="large" color="#FFD700" />
        ) : (
          <>
            <Animated.FlatList
              ref={flatListRef}
              key={isGrid ? `grid-${gridCols}` : "swipe"}
              style={{ flex: 1, width: "100%" }}
              data={images.length > 0 ? images : [{ file_path: initialImage }]}
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
                      { useNativeDriver: true }
                    )
                  : undefined
              }
              scrollEventThrottle={16}
              onMomentumScrollEnd={
                !isGrid
                  ? (e) =>
                      setCurrentIndex(
                        Math.round(e.nativeEvent.contentOffset.x / width)
                      )
                  : undefined
              }
              getItemLayout={
                !isGrid
                  ? (data, index) => ({ length: width, offset: width * index, index })
                  : undefined
              }
            />

            {/* Cok fazla gorsel varsa nokta yerine konum sayaci */}
            {!isGrid && showCounter && (
              <View style={styles.counterPill}>
                <Text allowFontScaling={false} style={styles.counterText}>
                  {currentIndex + 1} / {images.length}
                </Text>
              </View>
            )}

            {/* Pagination Dots (Sliding Window) */}
            {!isGrid && showDots && (
              <View style={styles.paginationWrapper}>
                <Animated.View
                  style={[
                    styles.paginationContainer,
                    { transform: [{ translateX }] },
                  ]}
                >
                  {images.map((_, i) => {
                    const inputRange = [
                      (i - 1) * width,
                      i * width,
                      (i + 1) * width,
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
      </View>
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
  actionCluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    padding: 3,
    borderRadius: 22,
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
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
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
  imageContainer: {
    width: width,
    height: height,
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    borderRadius: 20,
    contentFit: "cover",
  },
  // Parlama ve rozet katmanini gorselin kose yaricapina kirpar.
  imageClip: {
    borderRadius: 20,
    overflow: "hidden",
  },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#fff",
  },
  feedbackLayer: {
    ...StyleSheet.absoluteFillObject,
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
