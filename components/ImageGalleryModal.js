import React, { useEffect, useState, useRef } from "react";
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
  Text,
} from "react-native";
import { BlurView } from "expo-blur";
import axios from "axios";
import {
  useApiSettings,
  useImageQualitySettings,
} from "../context/AppSettingsContext";
import Ionicons from "@expo/vector-icons/Ionicons";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width, height } = Dimensions.get("window");

const DOT_SIZE = 8;
const DOT_SPACING = 4;
const DOT_FULL_WIDTH = DOT_SIZE + DOT_SPACING * 2; // 16
const MAX_VISIBLE_DOTS = 3;

const ImageGalleryModal = ({
  visible,
  onClose,
  mediaId,
  mediaType, // 'movie' or 'tv'
  imageType, // 'poster' or 'backdrop'
  initialImage, // fallback/initial path
}) => {
  const { API_KEY } = useApiSettings();
  const { imageQuality, getTmdbUrl } = useImageQualitySettings();
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isGrid, setIsGrid] = useState(false);

  const scrollX = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef(null);

  const isPoster = imageType === "poster";
  const gridCols = isPoster ? 3 : 2;

  useEffect(() => {
    if (!visible || !mediaId || !mediaType) return;

    const fetchImages = async () => {
      setLoading(true);
      try {
        const response = await axios.get(
          `https://api.themoviedb.org/3/${mediaType}/${mediaId}/images?include_image_language=tr,en,null`,
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

          const isBackdrop = imageType === "backdrop";
          
          // Yeni limitler (Posterler için: 10 TR, 25 EN, 10 Null)
          // Arka planlar (backdrop) genelde dilsiz olduğu için onlara özel limit
          const trLimit = isBackdrop ? 5 : 10;
          const enLimit = isBackdrop ? 5 : 25;
          const nullLimit = isBackdrop ? 35 : 10;

          // Çöp (kalitesiz/boş) resimlerin gelmesini önlemek için, 
          // sadece en iyi oyu almış üst kısımdan (örneğin en iyi %60) seçim yapıyoruz.
          const getDiverseSample = (arr, limit) => {
            if (arr.length <= limit) return arr;
            
            // Sadece en kaliteli resimlerin olduğu havuzdan (ilk %60'lık kısım veya en az limit kadarından) örnek al.
            const safeLength = Math.max(limit, Math.floor(arr.length * 0.6));
            const qualityPool = arr.slice(0, safeLength);
            
            const result = [];
            const step = Math.floor(qualityPool.length / limit);
            for (let i = 0; i < limit; i++) {
              result.push(qualityPool[i * step]);
            }
            return result;
          };

          const trSorted = grouped.tr.sort(sortByVotes);
          const enSorted = grouped.en.sort(sortByVotes);
          const nullSorted = grouped.null.sort(sortByVotes);

          const trBest = getDiverseSample(trSorted, trLimit);
          const enBest = getDiverseSample(enSorted, enLimit);
          const nullBest = getDiverseSample(nullSorted, nullLimit);

          // TR -> EN -> Null sırasıyla birleştir
          const finalImages = [...trBest, ...enBest, ...nullBest];

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
  }, [visible, mediaId, mediaType, imageType, API_KEY, initialImage]);

  // Handle reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setImages([]);
      setLoading(true);
      scrollX.setValue(0);
      setIsGrid(false);
    }
  }, [visible]);

  const toggleGrid = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsGrid(!isGrid);
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
    return (
      <TouchableOpacity
        style={styles.imageContainer}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <Image
            source={{ uri: getTmdbUrl(item.file_path, isPoster ? 'poster' : 'backdrop', isPoster ? 500 : 'original') }}
            style={[
              styles.image,
              {
                width: isPoster ? 300 : 380,
                height: isPoster ? 450 : 380 * (9 / 16),
              },
            ]}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderGridItem = ({ item, index }) => {
    const gridItemWidth = width / gridCols - 8;
    const gridItemHeight = isPoster ? gridItemWidth * 1.5 : gridItemWidth * (9 / 16);

    return (
      <TouchableOpacity
        style={styles.gridImageContainer}
        activeOpacity={0.8}
        onPress={() => handleGridItemPress(index)}
      >
        <Image
          source={{ uri: getTmdbUrl(item.file_path, isPoster ? 'poster' : 'backdrop', 500) }}
          style={[
            styles.gridImage,
            { width: gridItemWidth, height: gridItemHeight },
          ]}
        />
      </TouchableOpacity>
    );
  };

  const getTranslateX = () => {
    if (images.length <= MAX_VISIBLE_DOTS) {
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
      <BlurView
        tint="dark"
        intensity={60}
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        activeOpacity={1}
      />

      {/* Header Buttons */}
      <View style={styles.header}>
        {images.length > 0 && (
          <View style={styles.countBadge}>
            <Text allowFontScaling={false} style={styles.countText}>
              {images.length}
            </Text>
            <Ionicons name="image-outline" size={14} color="#fff" style={{ marginLeft: 4 }} />
          </View>
        )}
        {images.length > 1 && (
          <TouchableOpacity style={styles.iconButton} onPress={toggleGrid}>
            <Ionicons
              name={isGrid ? "images-outline" : "grid-outline"}
              size={20}
              color="#fff"
            />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.iconButton} onPress={onClose}>
          <Ionicons name="close" size={24} color="#fff" />
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
              horizontal={!isGrid}
              pagingEnabled={!isGrid}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={
                isGrid ? styles.gridListContent : styles.flatListContent
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
              getItemLayout={
                !isGrid
                  ? (data, index) => ({ length: width, offset: width * index, index })
                  : undefined
              }
            />

            {/* Pagination Dots (Sliding Window) */}
            {!isGrid && images.length > 1 && (
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
  header: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 30,
    right: 16,
    zIndex: 100,
    flexDirection: "row",
    gap: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  countBadge: {
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  countText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  contentContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  flatListContent: {
    flexGrow: 1,
  },
  gridListContent: {
    paddingTop: 100,
    paddingBottom: 40,
    alignItems: "center", // Center the grid rows horizontally
  },
  imageContainer: {
    width: width,
    height: height,
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    borderRadius: 20,
    resizeMode: "cover",
  },
  gridImageContainer: {
    margin: 4,
  },
  gridImage: {
    borderRadius: 8,
    resizeMode: "cover",
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
