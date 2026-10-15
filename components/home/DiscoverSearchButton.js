// components/home/DiscoverSearchButton.js
//
// Film ve Dizi ana ekranlarının ortak arama girişi. Arama ekranındaki alanla
// (screens/tabs/SearchScreen.js → GlassField) AYNI dili konuşan bir hap: iOS 26+'da
// Liquid Glass, cam çizilemeyen yerde (Android, iOS 18–25, Efektler: Kapalı) tema
// yüzeyli, çerçeveli, hafif gölgeli kutu. Böylece dokununca açılan arama ekranı
// düğmenin kendisinden büyüyormuş gibi görünür (köşe yarıçapı `searchOrigin.radius`
// ile arama ekranına taşınır).
//
// Sol: arama simgesi + etiket ("Film Ara" / "Dizi Ara"). Sağ: vurgu renginde
// yuvarlak rozet — hangi içeriği aradığını söyler (film / dizi simgesi).
//
// ── NEDEN BU DÜĞMEDE OPAKLIK / GİRİŞ ANİMASYONU YOK ──────────────────────────
//
// Eski sürüm düğmeyi `opacity: 0`dan başlayıp 430 ms'de 1'e çıkan bir giriş
// animasyonuyla açıyordu ve BAZEN HİÇ görünmüyordu. Neden:
//
//  • Reanimated 4.5 (FORCE_REACT_RENDER_FOR_SETTLED_ANIMATIONS), animasyonlu bir
//    bileşen her yeniden çizildiğinde stilin İLK değerini (`PropsFilter`,
//    `_initialPropsMap`) görünümün JS stiline yazar. Gerçek değeri iki yoldan geri
//    getirir: yerel commit hook'u (kayıtta değer varken) ve 500 ms'lik JS
//    zamanlayıcısı (`PropsRegistryGarbageCollector`; yerleşmiş değeri bileşen
//    state'ine yazar).
//  • Yerel kayıt bir değeri son güncellemesinden 2 sn sonra SİLER; JS yalnızca
//    1–2 sn yaşındaki kayıtları okuyabilir (ReanimatedModuleProxy::getSettledUpdates,
//    kaynakta "TODO: fix bug when threshold difference is smaller than 1 second").
//    Film/Dizi ana ekranı açılırken JS iş parçacığı TMDB verisini işlemekle meşgul,
//    sekmeler arka planda ısıtılıp donduruluyor (AdaptiveTabShell warm +
//    enableFreeze), uygulama arka plana gidebiliyor: zamanlayıcı o 1 sn'lik
//    pencereyi kaçırınca `opacity: 1` kaydı hiç state'e yazılmadan silinir.
//  • Sonraki ilk yeniden çizim (tema, dil, başlık…) düğmeye `opacity: 0` yazar ve
//    geri getirecek kayıt kalmamıştır → düğme, bileşen yeniden kurulana dek yok.
//
// Bu yüzden KURAL: bu düğmedeki her animasyonlu stilin İLK/DİNLENME değeri
// görünür durumdur (scale 1, opaklık hiç animasyonlanmaz). Yarış kaybedilse bile
// ekranda kalan şey doğru görünümdür. Ayrıca her ana görünüm EN FAZLA BİR animasyonlu
// stil taşır (kabuk: çekerek-yenile ölçeği, iç kap: basma ölçeği); iki stil aynı
// `transform` anahtarını paylaşınca kayıtta birbirini ezerdi.
//
// Cam kuralı da aynı yönde: cam yüzeyin atalarında opaklık animasyonu olmaz
// (components/common/GlassSurface.js, kural 1).
import React, { forwardRef } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "../AppIcon";
import GlassField from "../common/GlassField";
import { useTheme } from "../../context/ThemeContext";
import { alpha } from "../../theme/colors";

/** Hap yüksekliği; cam yolunda sabit, eski yolda minimum. */
export const DISCOVER_SEARCH_HEIGHT = 52;
/** Hap köşesi — arama ekranı açılış geçişi aynı yarıçapla başlar. */
export const DISCOVER_SEARCH_RADIUS = DISCOVER_SEARCH_HEIGHT / 2;

const BADGE_SIZE = 38;
const PRESS_SCALE = 0.975;
const PRESS_SPRING = { damping: 16, stiffness: 260, mass: 0.45 };

/** İçerik türüne göre sağdaki rozet simgesi (SearchScreen sekmeleriyle aynı çiftler). */
export const DISCOVER_SEARCH_ICONS = {
  movie: { family: "MaterialCommunityIcons", name: "movie-outline", size: 20 },
  tv: { family: "Feather", name: "tv", size: 18 },
};

const DiscoverSearchButton = forwardRef(function DiscoverSearchButton(
  { placeholder, onPress, animatedStyle, mediaType = "movie" },
  ref,
) {
  const { theme } = useTheme();
  const pressScale = useSharedValue(1);
  const accent = theme.accent ?? theme.colors?.blue ?? "#3B82F6";
  const muted = theme.text?.muted ?? "#8A8A8E";
  const badgeIcon = DISCOVER_SEARCH_ICONS[mediaType] ?? DISCOVER_SEARCH_ICONS.movie;

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const onPressIn = () => {
    pressScale.value = withSpring(PRESS_SCALE, PRESS_SPRING);
  };
  const onPressOut = () => {
    pressScale.value = withSpring(1, PRESS_SPRING);
  };

  return (
    // Kabuk ölçülebilir (`measureInWindow` → arama ekranı açılış geçişi) ve YALNIZ
    // çekerek-yenile ölçeğini taşır.
    <Animated.View ref={ref} collapsable={false} style={animatedStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={placeholder}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      >
        <Animated.View style={pressStyle}>
          <GlassField
            height={DISCOVER_SEARCH_HEIGHT}
            accent={accent}
            style={styles.row}
            fallbackStyle={[
              styles.fallbackBox,
              {
                backgroundColor: theme.secondary,
                borderColor: theme.border,
                borderRadius: DISCOVER_SEARCH_RADIUS,
              },
            ]}
          >
            <AppIcon family="Ionicons" name="search" size={20} color={muted} />
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                { color: theme.text?.secondary ?? muted },
              ]}
            >
              {placeholder}
            </Text>
            <LinearGradient
              colors={[accent, alpha(accent, 0.74)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.badge}
            >
              <AppIcon
                family={badgeIcon.family}
                name={badgeIcon.name}
                size={badgeIcon.size}
                color="#FFFFFF"
              />
            </LinearGradient>
          </GlassField>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
});

export default DiscoverSearchButton;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 18,
    paddingRight: (DISCOVER_SEARCH_HEIGHT - BADGE_SIZE) / 2,
  },
  // Yalnız cam OLMAYAN yol: tema yüzeyi + çerçeve + yumuşak gölge. Cam kendi
  // derinliğini çizer, RN gölgesi cam yoluna EKLENMEZ (GlassSurface, kural 4).
  fallbackBox: {
    borderWidth: 1,
    shadowColor: "#000000",
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  label: {
    flex: 1,
    marginLeft: 10,
    marginRight: 10,
    fontSize: 16,
    fontWeight: "500",
    letterSpacing: 0.1,
  },
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
