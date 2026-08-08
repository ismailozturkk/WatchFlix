// components/SplashPosterWave.js
//
// Splash ekranı: ortada uygulama logosu (adaptive icon foreground), etrafında
// posterlerden oluşan neredeyse bitişik eş merkezli DAİRESEL halkalar. TEK bir
// native döngülü sürücü değer 0→1 dönerken her halka bu değerden faz kaydırmalı
// interpolate ile kendi büyüyüp-küçülme (scale) salınımını türetir → dalga
// merkezden dışarıya doğru halka halka yayılır ve splash kapanana kadar döngüde
// kalır. Fazlar sürücüden MATEMATİKSEL olarak türediği için açılış sırasındaki
// JS thread blokları (navigator mount, cache parse...) halkaların senkronunu
// bozamaz; setTimeout/sequence tabanlı kurgu bu pencerede dalgayı düzleştirdiği
// için bilinçli olarak kullanılmadı.
//
// Poster kaynağı: önce apiCache'in AsyncStorage'a yazdığı trend/keşfet
// kayıtları; önbellek boşsa/yetersizse landing sayfasıyla aynı sabit TMDB
// poster listesi devreye girer — kutucuklar hiçbir durumda boş kalmaz.
import { cachedKeys, rawCachedEntry } from "../utils/apiCache";
import { Image } from "expo-image";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, Easing, StyleSheet, View } from "react-native";
import { buildTmdbUrl } from "../utils/tmdbImageUtils";

// İlk render için tahmin; gerçek ölçü onLayout ile gelir. Android'de "window"
// ölçüsü sistem çubuklarını dışlayabilirken splash overlay'i gerçek tam ekranı
// kaplar — merkez bu yüzden onLayout ölçüsünden hesaplanır, yoksa logo ile
// halkaların merkezi birbirinden kayar.
const WINDOW = Dimensions.get("window");

// ── Dairesel yerleşim geometrisi ─────────────────────────────────────────────
const TILE_W = 78;
const TILE_H = 117;
const FIRST_RING_RADIUS = 150; // logo boşluğu → ilk halkanın merkezi
const RING_STEP = TILE_H + 6; // halkalar radyal olarak neredeyse bitişik
const TANGENTIAL_GAP = 4; // aynı halkadaki posterler neredeyse bitişik
const ICON_SIZE = 230;

// ── Dalga zamanlaması ────────────────────────────────────────────────────────
const WAVE_SCALE_AMP = 0.14; // tepe noktasında poster 1.14x büyür
const WAVE_PERIOD_MS = 2800; // dalganın tam tur süresi (sakin tempo)
// Meksika dalgası karakteri: her halka döngünün yalnızca bu kesrinde hareket
// eder (kalk-otur), kalanında bekler → tepe dar bir bant halinde merkezden
// dışarıya süzülür.
const WAVE_CREST = 0.4;
const WAVE_SAMPLES = 32; // faz kaydırmalı dalganın interpolate örnek sayısı

// Halkanın scale'i: sürücünün [0,1] turu üzerinde faza kaydırılmış dar
// yükseltilmiş-kosinüs tepeciği (1 → 1+WAVE_SCALE_AMP → 1, sonra bekleme).
// f(0) = f(1) olduğundan döngü sarımında sıçrama olmaz; komşu halkalar arası
// faz farkı sabittir.
function buildRingScale(driver, phase) {
  const inputRange = [];
  const outputRange = [];
  for (let s = 0; s <= WAVE_SAMPLES; s++) {
    const t = s / WAVE_SAMPLES;
    const local = (t - phase + 1) % 1;
    const bump =
      local < WAVE_CREST
        ? 0.5 * (1 - Math.cos((2 * Math.PI * local) / WAVE_CREST))
        : 0;
    inputRange.push(t);
    outputRange.push(1 + WAVE_SCALE_AMP * bump);
  }
  return driver.interpolate({ inputRange, outputRange });
}

// Önbellek boş/yetersizken kullanılan garanti liste — website/index.html'deki
// landing kahramanıyla aynı posterler. expo-image ilk yüklemede diske alır;
// sonraki açılışlarda çevrimdışı bile anında gelir.
const FALLBACK_POSTER_PATHS = [
  "/d5NXSklXo0qyIYkgV94XAgMIckC.jpg",
  "/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
  "/9yxep7oJdkj3Pla9TD9gKflRApY.jpg",
  "/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
  "/49WJfeN0moxb9IPfGn8AIqMGskD.jpg",
  "/uKvVjHNqB5VmOrdxqAt2F7J78ED.jpg",
  "/8UlWHLMpgZm9bx6QYh0NFoq67TZ.jpg",
  "/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
  "/34FaY8qpjBAVysSfrJ1l7nrAQaD.jpg",
  "/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg",
  "/6kbAMLteGO8yyewYau6bJ683sw7.jpg",
  "/rqeYMLryjcawh2JeRpCVUDXYM5b.jpg",
  "/2CAL2433ZeIihfX1Hb2139CX0pW.jpg",
  "/u3bZgnGQ9T01sWNhyveQz0wH0Hl.jpg",
  "/xlaY2zyzMfkhk0HSC5VUwzoZPU1.jpg", // Inception (eski: 2. GoT posteri)
  "/6UH52Fmau8RPsMAbQbjwN3wJSCj.jpg",
  "/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg", // Stranger Things (eski: 3. GoT posteri)
  "/5MwkWH9tYHv3mV9OdYTMR5qreIz.jpg",
];

const POSTER_LIMIT = 40;
// Önek artık burada DEĞİL: apiCache kendi anahtar alanını açıyor (registry'deki
// Namespaces.apiCache). Eskiden "apicache_" üç dosyada elle yazılıydı.
// Poster barındırdığı bilinen önbellek anahtarı önekleri, tazelik önceliğiyle.
const KEY_PRIORITY = [
  "movie_trends",
  "tv_trends",
  "discovery_v2",
  "movie_bests",
  "tv_bests",
];

const keyPriorityIndex = (key) => {
  const i = KEY_PRIORITY.findIndex((p) => key.startsWith(p));
  return i === -1 ? KEY_PRIORITY.length : i;
};

// Önceki oturumlarda diske düşen trend/keşfet kayıtlarından poster yolları
// toplar. Hata durumunda boş liste döner; splash asla bunu beklemeye düşmez.
async function collectCachedPosterPaths() {
  try {
    const candidates = cachedKeys()
      .filter((k) => keyPriorityIndex(k) < KEY_PRIORITY.length)
      .sort((a, b) => keyPriorityIndex(a) - keyPriorityIndex(b))
      .slice(0, 8);
    if (!candidates.length) return [];

    const seen = new Set();
    const paths = [];
    for (const key of candidates) {
      // apiCache bozuk JSON'u kendi ayıklıyor (kaydı silip undefined dönüyor),
      // bu yüzden buradaki eski per-kayıt try/catch'e gerek kalmadı.
      const entry = rawCachedEntry(key);
      if (!entry) continue;

      // Kayıt şekli { data: { results: [...] } } ya da eski { data: [...] }.
      const data = entry?.data;
      const results = Array.isArray(data) ? data : data?.results;
      if (!Array.isArray(results)) continue;
      for (const item of results) {
        const path = item?.poster_path;
        if (typeof path === "string" && path && !seen.has(path)) {
          seen.add(path);
          paths.push(path);
          if (paths.length >= POSTER_LIMIT) return paths;
        }
      }
    }
    return paths;
  } catch {
    return [];
  }
}

function shuffle(list) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// İkonun etrafında eş merkezli daireler: her halkada posterler çember üzerine
// eşit açıyla dizilir, komşu halkalar yarım adım kaydırılır. Halkalar ekran
// köşelerini de kapsayana dek dışarıya doğru devam eder; tamamen ekran dışında
// kalan posterler hiç üretilmez. Üretim sırası zaten merkezden dışa doğru →
// en popüler posterler iç halkalara düşer.
function buildTiles(screenW, screenH) {
  const cx = screenW / 2;
  const cy = screenH / 2;
  const maxRadius = Math.hypot(cx, cy) + TILE_H / 2;
  const tiles = [];
  for (let ring = 0; FIRST_RING_RADIUS + ring * RING_STEP <= maxRadius; ring++) {
    const radius = FIRST_RING_RADIUS + ring * RING_STEP;
    const count = Math.max(
      6,
      Math.round((2 * Math.PI * radius) / (TILE_W + TANGENTIAL_GAP)),
    );
    const angleOffset = ring % 2 ? Math.PI / count : 0;
    for (let s = 0; s < count; s++) {
      const angle = angleOffset + (s / count) * 2 * Math.PI;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      if (
        x + TILE_W / 2 < 0 ||
        x - TILE_W / 2 > screenW ||
        y + TILE_H / 2 < 0 ||
        y - TILE_H / 2 > screenH
      ) {
        continue;
      }
      tiles.push({ left: x - TILE_W / 2, top: y - TILE_H / 2, ring });
    }
  }
  return tiles;
}

const SplashPosterWave = () => {
  // Yedek liste anında render edilir; önbellekten gerçek trend posterleri
  // gelirse öne eklenerek listeyi devralır (yedekler artakalanı doldurur).
  const [posterPaths, setPosterPaths] = useState(FALLBACK_POSTER_PATHS);

  // Overlay'in GERÇEK ölçüsü: hem halkalar hem logo bu ölçünün merkezinden
  // konumlanır — iki merkez asla ayrışamaz, her ekran boyutuna uyum sağlar.
  const [layout, setLayout] = useState({
    width: WINDOW.width,
    height: WINDOW.height,
  });
  const handleLayout = (e) => {
    const { width, height } = e.nativeEvent.layout;
    setLayout((prev) =>
      Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1
        ? prev
        : { width, height },
    );
  };

  const tiles = useMemo(
    () => buildTiles(layout.width, layout.height),
    [layout.width, layout.height],
  );
  const ringCount = useMemo(
    () => tiles.reduce((max, t) => Math.max(max, t.ring), 0) + 1,
    [tiles],
  );

  const waveDriver = useRef(new Animated.Value(0)).current;
  // Faz farkı 1/ringCount: tam turda dalga kesintisiz biçimde merkezden en dış
  // halkaya akar (en dış halkanın fazı sarımla merkezinkine bağlanır).
  const ringScales = useMemo(
    () =>
      Array.from({ length: ringCount }, (_, ring) =>
        buildRingScale(waveDriver, ring / ringCount),
      ),
    [waveDriver, ringCount],
  );

  useEffect(() => {
    let alive = true;
    collectCachedPosterPaths().then((paths) => {
      if (!alive || !paths.length) return;
      const merged = shuffle(paths);
      const seen = new Set(merged);
      for (const p of FALLBACK_POSTER_PATHS) {
        if (!seen.has(p)) {
          seen.add(p);
          merged.push(p);
        }
      }
      setPosterPaths(merged);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    // Tek timing'li Animated.loop yinelemeyi tamamen native tarafta yürütür
    // (sequence'li kurgunun aksine yarım döngüde bir JS'e uğramaz) → açılış
    // jankları dalgayı donduramaz. isInteraction: false şart — sonsuz döngü
    // aksi halde InteractionManager'ı meşgul tutar ve runAfterInteractions'a
    // bağlı açılış işleri hiç başlamaz.
    const anim = Animated.loop(
      Animated.timing(waveDriver, {
        toValue: 1,
        duration: WAVE_PERIOD_MS,
        easing: Easing.linear,
        useNativeDriver: true,
        isInteraction: false,
      }),
    );
    anim.start();
    return () => anim.stop();
  }, [waveDriver]);

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={handleLayout}
    >
      <View style={styles.posterField}>
        {tiles.map((tile, index) => (
          <Animated.View
            key={`${tile.left.toFixed(1)}-${tile.top.toFixed(1)}`}
            style={[
              styles.tile,
              {
                left: tile.left,
                top: tile.top,
                transform: [{ scale: ringScales[tile.ring] }],
              },
            ]}
          >
            <Image
              source={{
                // Uygulama içindeki poster boyutlandırmasıyla aynı URL — disk
                // önbelleği paylaşılır, daha önce görülen posterler anında gelir.
                uri: buildTmdbUrl(
                  posterPaths[index % posterPaths.length],
                  "poster",
                  TILE_W,
                ),
              }}
              style={styles.tileImage}
              contentFit="cover"
              transition={250}
              cachePolicy="memory-disk"
            />
          </Animated.View>
        ))}
      </View>

      {/* Adaptive icon foreground'u şeffaf zeminli — halkaların ortası zaten
          boş olduğundan arkasına ayrıca zemin konmaz. Halkalarla AYNI merkezden
          absolute konumlanır (flex-center değil). */}
      <Image
        source={require("../assets/android-icon-foreground.png")}
        style={[
          styles.icon,
          {
            left: layout.width / 2 - ICON_SIZE / 2,
            top: layout.height / 2 - ICON_SIZE / 2,
          },
        ]}
        contentFit="contain"
      />
    </View>
  );
};

export default React.memo(SplashPosterWave);

const styles = StyleSheet.create({
  posterField: {
    ...StyleSheet.absoluteFill,
    opacity: 0.9, // posterlerde çok hafif saydamlık
  },
  tile: {
    position: "absolute",
    width: TILE_W,
    height: TILE_H,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "rgba(127, 127, 127, 0.14)",
  },
  tileImage: {
    width: "100%",
    height: "100%",
  },
  // Adaptive foreground PNG'nin kendi güvenli-alan dolgusu var; görünür logo
  // kutunun ~%60'ı olduğundan kutu, halkaların ortasındaki boşluğa göre büyük
  // tutulur.
  icon: {
    position: "absolute",
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
});
