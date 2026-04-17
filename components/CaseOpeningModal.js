import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
  Image,
  Easing,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useAppSettings } from "../context/AppSettingsContext";

const { width, height } = Dimensions.get("window");

const ITEM_WIDTH = 110;
const ITEM_HEIGHT = 165;

const RARITY = [
  { bg: "#1a1a2e", border: "#5e98d9" },
  { bg: "#1a1a2e", border: "#4b69ff" },
  { bg: "#1e1030", border: "#8847ff" },
  { bg: "#1a0020", border: "#d32ee6" },
  { bg: "#200010", border: "#eb4b4b" },
  { bg: "#1a1200", border: "#e4ae39" },
  { bg: "#001818", border: "#00e5ff" },
];

// filterType → accent colors
const ACCENT_MAP = {
  movie: {
    accent: "#4b69ff",
    secondary: "#00e5ff",
    label: "FİLM",
    emoji: "🎬",
  },
  tv: {
    accent: "#8847ff",
    secondary: "#d32ee6",
    label: "DİZİ",
    emoji: "📺",
  },
  mixed: {
    accent: "#e4ae39",
    secondary: "#ff6b35",
    label: "KARIŞIK",
    emoji: "🎲",
  },
};

function pickWinner(items, filterType) {
  const pool =
    filterType === "mixed" ? items : items.filter((i) => i.type === filterType);
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function buildReel(items, filterType, winner) {
  const pool =
    filterType === "mixed" ? items : items.filter((i) => i.type === filterType);
  if (pool.length === 0) return { reel: [], winnerPos: 0 };

  const reelCount = 32;
  const reel = [];
  const winnerPos = reelCount - 4;

  for (let i = 0; i < reelCount; i++) {
    if (i === winnerPos) {
      reel.push({ ...winner, _uid: `winner-${winner.id}` });
      continue;
    }

    let ri;
    let attempts = 0;
    let isDuplicate = false;
    do {
      ri = pool[Math.floor(Math.random() * pool.length)];
      attempts++;

      const prevId = i > 0 ? reel[i - 1].id : null;
      const nextId = i === winnerPos - 1 ? winner.id : null;

      isDuplicate = ri.id === prevId || ri.id === nextId;
    } while (isDuplicate && attempts < pool.length * 3);

    reel.push({ ...ri, _uid: `r-${i}-${ri.id}` });
  }

  return { reel, winnerPos };
}

// Floating particle
function Particle({ delay, accentColor }) {
  const y = useRef(new Animated.Value(height)).current;
  const x = useRef(new Animated.Value(Math.random() * width)).current;
  const op = useRef(new Animated.Value(0)).current;
  const sc = useRef(new Animated.Value(Math.random() * 0.7 + 0.3)).current;

  useEffect(() => {
    const dur = 3000 + Math.random() * 3000;
    const loop = () => {
      y.setValue(height);
      x.setValue(Math.random() * width);
      op.setValue(0);
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(y, {
            toValue: -60,
            duration: dur,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(op, {
              toValue: 0.9,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.timing(op, {
              toValue: 0,
              duration: 800,
              delay: dur - 1200,
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]).start(loop);
    };
    loop();
  }, []);

  const palette = ["#ffd700", "#ff6b9d", accentColor, "#00e5ff", "#fff"];
  const color = palette[Math.floor(Math.random() * palette.length)];

  return (
    <Animated.View
      style={{
        position: "absolute",
        width: 5,
        height: 5,
        borderRadius: 3,
        backgroundColor: color,
        opacity: op,
        transform: [{ translateY: y }, { translateX: x }, { scale: sc }],
      }}
      pointerEvents="none"
    />
  );
}

// ─────────────────────────────────────────────
export default function CaseOpeningModal({
  visible,
  onClose,
  items, // tüm izleme listesi öğeleri
  filterType, // "movie" | "tv" | "mixed"
  onNavigate,
}) {
  const { imageQuality } = useAppSettings();
  const posterBase = `https://image.tmdb.org/t/p/${imageQuality?.poster || "w185"}`;

  const {
    accent,
    secondary: accentSecondary,
    label: headerLabel,
    emoji,
  } = ACCENT_MAP[filterType] ?? ACCENT_MAP.mixed;

  const [phase, setPhase] = useState("idle");
  const [reel, setReel] = useState([]);
  const [currentWinner, setCurrentWinner] = useState(null);
  const [showParticles, setShowParticles] = useState(false);

  // Animated refs
  const scrollX = useRef(new Animated.Value(0)).current;
  const resultOpacity = useRef(new Animated.Value(0)).current;
  const resultTY = useRef(new Animated.Value(60)).current;
  const resultScale = useRef(new Animated.Value(0.7)).current;
  const shineX = useRef(new Animated.Value(-300)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const centerGlow = useRef(new Animated.Value(0.3)).current;
  const scanLine = useRef(new Animated.Value(0)).current; // replaces centerPulse
  const bgGlow = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  // ── Core spin logic ──
  const startSpin = useCallback(
    (winner) => {
      if (!winner || items.length === 0) return;

      const { reel: builtReel } = buildReel(items, filterType, winner);
      setReel(builtReel);
      setCurrentWinner(winner);
      setPhase("spinning");
      setShowParticles(false);

      // Reset all animated values
      scrollX.setValue(0);
      resultOpacity.setValue(0);
      resultTY.setValue(60);
      resultScale.setValue(0.7);
      shineX.setValue(-300);
      glow.setValue(0);
      bgGlow.setValue(0);
      rotateAnim.setValue(0);
      centerGlow.setValue(0.3);

      // Scan line inside center selector
      scanLine.setValue(0);
      const scanLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(scanLine, {
            toValue: ITEM_HEIGHT - 4,
            duration: 550,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scanLine, {
            toValue: 0,
            duration: 550,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      scanLoop.start();

      const winnerPos = 32 - 4;
      const centerOff = width / 2 - ITEM_WIDTH / 2;
      const targetX = winnerPos * ITEM_WIDTH - centerOff;

      Animated.timing(scrollX, {
        toValue: targetX,
        duration: 5000,
        easing: Easing.bezier(0.05, 0.82, 0.18, 1.0),
        useNativeDriver: true,
      }).start(() => {
        scanLoop.stop();
        scanLine.setValue(0);
        setPhase("result");
        setShowParticles(true);

        Animated.timing(centerGlow, {
          toValue: 1,
          duration: 600,
          useNativeDriver: false,
        }).start();

        Animated.loop(
          Animated.sequence([
            Animated.timing(bgGlow, {
              toValue: 1,
              duration: 1200,
              useNativeDriver: false,
            }),
            Animated.timing(bgGlow, {
              toValue: 0.3,
              duration: 1200,
              useNativeDriver: false,
            }),
          ]),
        ).start();

        Animated.parallel([
          Animated.spring(resultScale, {
            toValue: 1,
            tension: 70,
            friction: 7,
            useNativeDriver: true,
          }),
          Animated.spring(resultTY, {
            toValue: 0,
            tension: 70,
            friction: 7,
            useNativeDriver: true,
          }),
          Animated.timing(resultOpacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ]).start(() => {
          Animated.timing(shineX, {
            toValue: width + 300,
            duration: 900,
            easing: Easing.ease,
            useNativeDriver: true,
          }).start();
          Animated.loop(
            Animated.sequence([
              Animated.timing(glow, {
                toValue: 1,
                duration: 800,
                useNativeDriver: false,
              }),
              Animated.timing(glow, {
                toValue: 0.2,
                duration: 800,
                useNativeDriver: false,
              }),
            ]),
          ).start();
          Animated.loop(
            Animated.timing(rotateAnim, {
              toValue: 1,
              duration: 8000,
              easing: Easing.linear,
              useNativeDriver: true,
            }),
          ).start();
        });
      });
    },
    [items, filterType],
  );

  // Trigger on open
  useEffect(() => {
    if (visible && items.length > 0) {
      const winner = pickWinner(items, filterType);
      if (!winner) return;
      const t = setTimeout(() => startSpin(winner), 300);
      return () => clearTimeout(t);
    }
    if (!visible) {
      setPhase("idle");
      setShowParticles(false);
    }
  }, [visible]);

  // ── Yeniden / Replay ──
  const handleReplay = () => {
    const winner = pickWinner(items, filterType);
    if (!winner) return;
    startSpin(winner);
  };

  const handleClose = () => {
    setPhase("idle");
    setShowParticles(false);
    onClose();
  };

  const glowColor = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [`${accent}00`, `${accent}55`],
  });
  const bgGlowColor = bgGlow.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(0,0,0,0)", `${accent}18`],
  });

  const particles = useMemo(
    () =>
      Array.from({ length: 20 }, (_, i) => (
        <Particle key={i} delay={i * 160} accentColor={accent} />
      )),
    [accent],
  );

  const isMovie = currentWinner?.type === "movie";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      {/* BG */}
      <View style={StyleSheet.absoluteFill}>
        <BlurView tint="dark" intensity={95} style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={[
            "rgba(0,0,0,0.80)",
            "rgba(5,5,20,0.90)",
            "rgba(5,5,20,0.97)",
            "rgba(5,5,20,0.90)",
            "rgba(0,0,0,0.80)",
          ]}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: bgGlowColor }]}
        pointerEvents="none"
      />

      {/* Particles */}
      {showParticles && particles}

      {/* Grid */}
      <View style={styles.gridOverlay} pointerEvents="none">
        {Array.from({ length: 8 }).map((_, i) => (
          <View key={i} style={[styles.gridLine, { left: (width / 8) * i }]} />
        ))}
      </View>

      {phase === "result" && (
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={handleClose}
        />
      )}

      <View style={styles.root}>
        {/* ── HEADER ── */}
        <View style={styles.headerArea}>
          <View style={[styles.divider, { backgroundColor: accent }]} />
          <View style={styles.headerContent}>
            <LinearGradient
              colors={[accent + "33", accentSecondary + "22"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.headerBadge}
            >
              <Text style={[styles.headerEmoji, { color: accent }]}>
                {emoji}
              </Text>
              <Text style={styles.headerTitle}>{headerLabel}</Text>
            </LinearGradient>
            <Text style={styles.statusText}>
              {phase === "idle" && "Hazırlanıyor..."}
              {phase === "spinning" && "◆  SPINNING  ◆"}
              {phase === "result" && "✦  SELECTED  ✦"}
            </Text>
          </View>
          <View
            style={[styles.divider, { backgroundColor: accentSecondary }]}
          />
        </View>

        {/* ── REEL ── */}
        <View style={styles.reelOuter}>
          <LinearGradient
            colors={[accent, accentSecondary, accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.reelTopLine}
          />
          <LinearGradient
            colors={["rgba(0,0,0,1)", "rgba(0,0,0,0)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.fadeEdge, { left: 0 }]}
            pointerEvents="none"
          />
          <LinearGradient
            colors={["rgba(0,0,0,0)", "rgba(0,0,0,1)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.fadeEdge, { right: 0 }]}
            pointerEvents="none"
          />

          {/* Center selector frame - with sweep scan line & glow */}
          <Animated.View
            style={[
              styles.centerSelector,
              {
                borderColor: centerGlow.interpolate({
                  inputRange: [0, 1],
                  outputRange: [accent + "44", accent],
                }),
                backgroundColor: centerGlow.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["rgba(0,0,0,0)", accent + "22"],
                }),
              },
            ]}
            pointerEvents="none"
          >
            <LinearGradient
              colors={[accent + "44", "transparent", accent + "44"]}
              style={StyleSheet.absoluteFill}
            />
            {/* Sweep scan line */}
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                {
                  opacity: centerGlow.interpolate({
                    inputRange: [0.3, 1],
                    outputRange: [1, 0],
                  }),
                },
              ]}
              pointerEvents="none"
            >
              <Animated.View
                style={[
                  styles.scanLineAnim,
                  {
                    backgroundColor: accent,
                    shadowColor: accent,
                    transform: [{ translateY: scanLine }],
                  },
                ]}
                pointerEvents="none"
              />
            </Animated.View>
            <View
              style={[styles.selLine, { backgroundColor: accent, left: 0 }]}
            />
            <View
              style={[styles.selLine, { backgroundColor: accent, right: 0 }]}
            />
            {[
              {
                top: -2,
                left: -2,
                borderTopColor: accent,
                borderLeftColor: accent,
              },
              {
                top: -2,
                right: -2,
                borderTopColor: accent,
                borderRightColor: accent,
              },
              {
                bottom: -2,
                left: -2,
                borderBottomColor: accent,
                borderLeftColor: accent,
              },
              {
                bottom: -2,
                right: -2,
                borderBottomColor: accent,
                borderRightColor: accent,
              },
            ].map((s, i) => (
              <View key={i} style={[styles.selCorner, s]} />
            ))}
          </Animated.View>

          <LinearGradient
            colors={[accentSecondary, accent, accentSecondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.reelBottomLine}
          />

          <View style={styles.reelClip}>
            <Animated.View
              style={[
                styles.reelTrack,
                { transform: [{ translateX: Animated.multiply(scrollX, -1) }] },
              ]}
            >
              {reel.map((item, idx) => {
                const r = RARITY[idx % RARITY.length];
                return (
                  <View
                    key={item._uid}
                    style={[
                      styles.reelCard,
                      { backgroundColor: r.bg, borderBottomColor: r.border },
                    ]}
                  >
                    <Image
                      source={
                        item.imagePath
                          ? { uri: `${posterBase}${item.imagePath}` }
                          : require("../assets/image/no_image.png")
                      }
                      style={styles.reelCardImage}
                      resizeMode="cover"
                    />
                    <LinearGradient
                      colors={[r.border + "00", r.border + "cc"]}
                      style={styles.reelCardGrad}
                    />
                    <Text
                      style={[styles.reelCardName, { color: r.border }]}
                      numberOfLines={2}
                    >
                      {item.name}
                    </Text>
                  </View>
                );
              })}
            </Animated.View>
          </View>
        </View>

        {/* ── RESULT CARD ── */}
        {phase === "result" && currentWinner && (
          <Animated.View
            style={[
              styles.resultOuter,
              {
                opacity: resultOpacity,
                transform: [{ translateY: resultTY }, { scale: resultScale }],
              },
            ]}
          >
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                {
                  borderRadius: 24,
                  borderWidth: 1.5,
                  borderColor: glowColor,
                  shadowColor: accent,
                  shadowRadius: 30,
                  shadowOpacity: 1,
                  shadowOffset: { width: 0, height: 0 },
                },
              ]}
              pointerEvents="none"
            />

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                handleClose();
                onNavigate(currentWinner);
              }}
              style={styles.resultCard}
            >
              <LinearGradient
                colors={["#0d0d1a", "#12101e", "#0a0a15"]}
                style={StyleSheet.absoluteFill}
              />
              <Animated.View
                style={[
                  styles.shine,
                  { transform: [{ translateX: shineX }, { rotate: "20deg" }] },
                ]}
                pointerEvents="none"
              />

              <View style={styles.resultContent}>
                {/* Poster */}
                <View style={styles.posterSide}>
                  <Animated.View
                    style={[styles.posterGlow, { backgroundColor: glowColor }]}
                  />
                  <Image
                    source={
                      currentWinner.imagePath
                        ? {
                            uri: `${posterBase}${currentWinner.imagePath}`,
                            cache: "force-cache",
                          }
                        : require("../assets/image/no_image.png")
                    }
                    style={styles.resultPoster}
                    resizeMode="cover"
                  />
                  <LinearGradient
                    colors={["transparent", accent + "55"]}
                    style={StyleSheet.absoluteFill}
                  />
                </View>

                {/* Info */}
                <View style={styles.infoSide}>
                  <Animated.View
                    style={[
                      styles.ringBadge,
                      { transform: [{ rotate: rotation }] },
                    ]}
                  >
                    <LinearGradient
                      colors={[accent, accentSecondary, accent]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{ flex: 1 }}
                    />
                  </Animated.View>

                  <LinearGradient
                    colors={[accent, accentSecondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.selectedBadge}
                  >
                    <Text style={styles.selectedBadgeText}>✦ SEÇİLDİ</Text>
                  </LinearGradient>

                  <Text style={styles.resultTitle} numberOfLines={3}>
                    {currentWinner.name}
                  </Text>

                  <View
                    style={[styles.typePill, { borderColor: accent + "66" }]}
                  >
                    <Text style={[styles.typeText, { color: accent }]}>
                      {isMovie ? "🎬  Film" : "📺  Dizi"}
                    </Text>
                  </View>

                  {currentWinner.genres?.length > 0 && (
                    <View style={styles.genreRow}>
                      {currentWinner.genres.slice(0, 3).map((g, i) => (
                        <View
                          key={i}
                          style={[
                            styles.genreChip,
                            {
                              backgroundColor: accent + "22",
                              borderColor: accent + "55",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.genreChipText,
                              { color: accentSecondary },
                            ]}
                          >
                            {g}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <LinearGradient
                    colors={[accent, accentSecondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.ctaBtn}
                  >
                    <Text style={styles.ctaBtnText}>Detayları Gör →</Text>
                  </LinearGradient>
                </View>
              </View>

              <LinearGradient
                colors={[accent, accentSecondary, accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.resultBottomLine}
              />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── ACTION BUTTONS ── */}
        {phase === "result" && (
          <View style={styles.actionRow}>
            {/* Yeniden */}
            <TouchableOpacity
              onPress={handleReplay}
              activeOpacity={0.75}
              style={styles.replayBtn}
            >
              <LinearGradient
                colors={[accent + "33", accentSecondary + "22"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.replayBtnInner}
              >
                <Text style={[styles.replayIcon, { color: accent }]}>🎲</Text>
                <Text style={[styles.replayText, { color: accent }]}>
                  Yeniden
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Kapat */}
            <TouchableOpacity
              onPress={handleClose}
              activeOpacity={0.7}
              style={styles.closeBtn}
            >
              <View style={styles.closeBtnInner}>
                <Text style={styles.closeBtnText}>✕ Kapat</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Spinning hint */}
        {phase === "spinning" && (
          <Text style={[styles.spinHint, { color: accent + "88" }]}>
            ◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆
          </Text>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "center", alignItems: "center", gap: 18 },

  gridOverlay: { ...StyleSheet.absoluteFillObject, flexDirection: "row" },
  gridLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.03)",
  },

  // Header
  headerArea: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
  },
  divider: { flex: 1, height: 1, opacity: 0.5 },
  headerContent: { alignItems: "center", gap: 5 },
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  headerEmoji: { fontSize: 16 },
  headerTitle: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 13,
    letterSpacing: 3,
  },
  statusText: {
    color: "rgba(255,255,255,0.32)",
    fontSize: 10,
    letterSpacing: 4,
    fontWeight: "600",
  },

  // Reel
  reelOuter: { width, height: ITEM_HEIGHT + 6, position: "relative" },
  reelTopLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    zIndex: 5,
  },
  reelBottomLine: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    zIndex: 5,
  },
  reelClip: { flex: 1, overflow: "hidden", marginVertical: 2 },
  reelTrack: { flexDirection: "row", height: "100%" },
  reelCard: {
    width: ITEM_WIDTH,
    height: ITEM_HEIGHT,
    borderBottomWidth: 3,
    overflow: "hidden",
  },
  reelCardImage: { width: ITEM_WIDTH, height: ITEM_HEIGHT - 24 },
  reelCardGrad: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    height: 50,
  },
  reelCardName: {
    fontSize: 8,
    textAlign: "center",
    paddingHorizontal: 3,
    paddingVertical: 3,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
  fadeEdge: { position: "absolute", top: 0, bottom: 0, width: 100, zIndex: 3 },

  // Center selector
  centerSelector: {
    position: "absolute",
    top: 2,
    bottom: 2,
    left: width / 2 - ITEM_WIDTH / 2,
    width: ITEM_WIDTH,
    borderWidth: 1.5,
    zIndex: 4,
    borderRadius: 4,
    overflow: "hidden",
  },
  selLine: { position: "absolute", top: 0, bottom: 0, width: 2, zIndex: 5 },
  selCorner: {
    position: "absolute",
    width: 10,
    height: 10,
    borderWidth: 2,
    zIndex: 5,
  },
  scanLineAnim: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
    zIndex: 6,
    shadowRadius: 8,
    shadowOpacity: 0.9,
    shadowOffset: { width: 0, height: 0 },
    elevation: 5,
  },

  // Result
  resultOuter: { width: width - 28, borderRadius: 24, overflow: "visible" },
  resultCard: {
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  shine: {
    position: "absolute",
    top: -100,
    left: -120,
    width: 100,
    height: "300%",
    backgroundColor: "rgba(255,255,255,0.06)",
    zIndex: 20,
  },
  resultContent: {
    flexDirection: "row",
    padding: 16,
    gap: 16,
    alignItems: "center",
  },
  posterSide: {
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
    elevation: 15,
    shadowColor: "#000",
    shadowRadius: 20,
    shadowOpacity: 0.8,
    shadowOffset: { width: 0, height: 8 },
  },
  posterGlow: {
    position: "absolute",
    bottom: -15,
    left: -10,
    right: -10,
    height: 30,
    borderRadius: 50,
    zIndex: 0,
    opacity: 0.6,
  },
  resultPoster: { width: 120, height: 180, borderRadius: 14 },
  infoSide: { flex: 1, gap: 9, position: "relative" },
  ringBadge: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    opacity: 0.35,
  },
  selectedBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  selectedBadgeText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 10,
    letterSpacing: 2,
  },
  resultTitle: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.3,
  },
  typePill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  typeText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  genreRow: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  genreChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  genreChipText: { fontSize: 10, fontWeight: "600" },
  ctaBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 22,
    marginTop: 4,
    elevation: 8,
    shadowRadius: 12,
    shadowOpacity: 0.6,
  },
  ctaBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 13,
    letterSpacing: 0.5,
  },
  resultBottomLine: { height: 2, width: "100%" },

  // Action row (Yeniden + Kapat)
  actionRow: { flexDirection: "row", gap: 12, alignItems: "center" },

  replayBtn: { borderRadius: 26, overflow: "hidden" },
  replayBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  replayIcon: { fontSize: 16 },
  replayText: { fontWeight: "700", fontSize: 14, letterSpacing: 0.5 },

  closeBtn: {},
  closeBtnInner: {
    paddingHorizontal: 26,
    paddingVertical: 12,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.13)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  closeBtnText: {
    color: "rgba(255,255,255,0.45)",
    fontWeight: "600",
    fontSize: 13,
    letterSpacing: 0.5,
  },

  spinHint: { fontSize: 11, letterSpacing: 2, marginTop: -6 },
});
