import { Image } from "expo-image";
import React, { useMemo } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import { useIconBackgroundSettings } from "../context/AppSettingsContext";
import { perfPreset } from "../services/deviceTier";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Desen görselleri ayrı modülde ve LAZY yükleniyor (bkz. iconBackgroundSources.js).
// Bu dosya 10 ekrandan import edildiği için listeyi burada tutmak, ikon arka
// planını hiç açmayan kullanıcıya da 174 asset kaydını açılışta ödetiyordu.
export const ICON_BACKGROUND_COUNT = 174;

let cachedSources = null;
function getSources() {
  if (!cachedSources) {
    // eslint-disable-next-line global-require
    cachedSources = require("./iconBackgroundSources").default;
  }
  return cachedSources;
}

export function getIconBackgroundSource(index) {
  return Number.isInteger(index) && index >= 0
    ? getSources()[index] || null
    : null;
}

// Izgara yoğunluğu cihaz sınıfına göre: düşük katmanda 4x6 = 24 öğe,
// diğerlerinde 5x9 = 45 öğe (bkz. utils/deviceTier.js).
const COLS = perfPreset.iconBackgroundCols;
const ROWS = perfPreset.iconBackgroundRows;

// Izgara (Grid) mantığı ile öğeleri dağıtır (üst üste binmeyi önler, boşlukları doldurur).
// Her hücreyi baz alıp hücre içinde rastgele kaydırır; ardından sırayı karıştırır.
function buildItems() {
  const cellWidth = SCREEN_WIDTH / COLS;
  const cellHeight = SCREEN_HEIGHT / ROWS;
  const generatedItems = [];

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const size = Math.random() * 15 + 25; // 25px - 40px arası küçük, zarif boyutlar
      const top = r * cellHeight + Math.random() * (cellHeight - size);
      const left = c * cellWidth + Math.random() * (cellWidth - size);
      const imgIndex = Math.floor(Math.random() * ICON_BACKGROUND_COUNT);
      generatedItems.push({ top, left, size, imgIndex });
    }
  }
  // Görsel sıralama tamamen rastgele görünsün diye karıştır.
  return generatedItems.sort(() => Math.random() - 0.5);
}

// Verilen öğe listesini desen View'larına dönüştürür.
function renderItems(items, opacity) {
  const sources = getSources();
  return (
    <View style={styles.background} pointerEvents="none">
      {items.map((item, index) => (
        <View
          key={index}
          style={[
            styles.desen,
            {
              width: item.size,
              height: item.size,
              top: item.top,
              left: item.left,
              opacity,
            },
          ]}
        >
          <Image
            source={sources[item.imgIndex]}
            style={styles.fill}
            contentFit="contain"
          />
        </View>
      ))}
    </View>
  );
}

// ── Paylaşımlı ("shared") mod ────────────────────────────────────────────────
// Düzen UYGULAMA OTURUMUNDA BİR KEZ üretilir ve tüm ekranlarda AYNI kullanılır.
// Ayrıca render edilen element ağacı opaklığa göre bir kez kurulup her ekranda
// aynı referansla yeniden kullanılır → her ekran mount'unda 45 öğeyi yeniden
// hesaplamak/kurmak yerine hazır ağaç paylaşılır (rastgele moddan daha hafif).
let sharedItems = null;
const sharedElementCache = new Map();

function getSharedElement(opacity) {
  if (!sharedItems) sharedItems = buildItems();
  // Anahtarı 2 ondalığa yuvarla: saydamlık sürüklenirken sonsuz farklı float
  // değeriyle cache'in şişmesini engeller (fark görsel olarak belirsiz).
  const key = Math.round(opacity * 100) / 100;
  if (!sharedElementCache.has(key)) {
    sharedElementCache.set(key, renderItems(sharedItems, key));
  }
  return sharedElementCache.get(key);
}

const IconBacground = React.memo(({ opacity = 0.5 }) => {
  const {
    showIconBackground,
    iconBackgroundMode,
    iconBackgroundOpacity = 1,
  } = useIconBackgroundSettings();

  // Ekranın kendi opaklığı, kullanıcının saydamlık çarpanıyla ölçeklenir (çarpan 1 = değişiklik yok).
  const effectiveOpacity = opacity * iconBackgroundOpacity;

  // Rastgele mod: bu ekran örneğine özel düzen (mevcut davranış — mount başına bir kez).
  // `showIconBackground` de bağımlılık: desen kapalıyken her ekran mount'unda
  // boşuna 45 öğe hesaplanmasın.
  const randomItems = useMemo(
    () =>
      showIconBackground && iconBackgroundMode === "random" ? buildItems() : null,
    [showIconBackground, iconBackgroundMode],
  );

  if (!showIconBackground) {
    return null;
  }

  if (iconBackgroundMode === "random") {
    return renderItems(randomItems, effectiveOpacity);
  }

  // Paylaşımlı (varsayılan, performanslı): bir kez üretilmiş ortak element (opaklığa göre cache'li).
  return getSharedElement(effectiveOpacity);
});

export default IconBacground;

const styles = StyleSheet.create({
  desen: {
    position: "absolute",
  },
  fill: {
    width: "100%",
    height: "100%",
  },
  background: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
