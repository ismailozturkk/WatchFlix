import { Image } from "expo-image";
import PosterImage from "../PosterImage";
import * as Haptics from "@services/hapticsService";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppIcon from "@components/AppIcon";
import { useImageQualitySettings } from "@context/AppSettingsContext";
import { i18nText } from "@utils/i18nText";

const CARD_WIDTH = 104;
const CARD_HEIGHT = 156;
const CARD_GAP = 10;
const CARD_SLOT = CARD_WIDTH + CARD_GAP;
const REEL_COUNT = 26;
const WINNER_POSITION = REEL_COUNT - 4;

const TYPE_THEME = {
  movie: {
    accent: "#5B8CFF",
    secondary: "#38BDF8",
    label: i18nText("autoI18n.film_2", "Film"),
    icon: "film-outline",
  },
  tv: {
    accent: "#A78BFA",
    secondary: "#EC4899",
    label: i18nText("autoI18n.dizi_2", "Dizi"),
    icon: "tv-outline",
  },
  mixed: {
    accent: "#F5B942",
    secondary: "#FB7185",
    label: i18nText("autoI18n.karisik", "Karışık"),
    icon: "sparkles-outline",
  },
};

function getPool(items, filterType) {
  if (!Array.isArray(items)) return [];
  return filterType === "mixed"
    ? items
    : items.filter((item) => item.type === filterType);
}

function pickWinner(items, filterType) {
  const pool = getPool(items, filterType);
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
}

function buildReel(items, filterType, winner) {
  const pool = getPool(items, filterType);
  if (!pool.length || !winner) return [];

  return Array.from({ length: REEL_COUNT }, (_, index) => {
    if (index === WINNER_POSITION) {
      return { ...winner, _reelKey: `winner-${winner.id}` };
    }

    let candidate = pool[Math.floor(Math.random() * pool.length)];
    if (pool.length > 1 && index === WINNER_POSITION - 1) {
      // Deneme sayısı sınırlı: havuzdaki HER öğe kazananla aynı id'yi
      // paylaşıyorsa (film/dizi id uzayları çakışabilir) koşulsuz while
      // sonsuz döngüye girip JS thread'ini kilitlerdi.
      for (
        let attempt = 0;
        candidate.id === winner.id && attempt < 20;
        attempt++
      ) {
        candidate = pool[Math.floor(Math.random() * pool.length)];
      }
    }

    return { ...candidate, _reelKey: `reel-${index}-${candidate.id}` };
  });
}

export default function CaseOpeningModal({
  visible,
  onClose,
  items,
  filterType,
  onNavigate,
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { getTmdbUrl } = useImageQualitySettings();
  const typeTheme = TYPE_THEME[filterType] ?? TYPE_THEME.mixed;

  const [phase, setPhase] = useState("idle");
  const [reel, setReel] = useState([]);
  const [winner, setWinner] = useState(null);

  const entrance = useRef(new Animated.Value(0)).current;
  const reelX = useRef(new Animated.Value(0)).current;
  const focusPulse = useRef(new Animated.Value(0)).current;
  const resultOpacity = useRef(new Animated.Value(0)).current;
  const resultScale = useRef(new Animated.Value(0.94)).current;
  const resultY = useRef(new Animated.Value(24)).current;
  const shineX = useRef(new Animated.Value(-180)).current;
  const activeAnimations = useRef([]);

  const stopAnimations = useCallback(() => {
    activeAnimations.current.forEach((animation) => animation?.stop?.());
    activeAnimations.current = [];
    reelX.stopAnimation();
    focusPulse.stopAnimation();
    resultOpacity.stopAnimation();
    resultScale.stopAnimation();
    resultY.stopAnimation();
    shineX.stopAnimation();
  }, [focusPulse, reelX, resultOpacity, resultScale, resultY, shineX]);

  const resetAnimatedValues = useCallback(() => {
    reelX.setValue(0);
    focusPulse.setValue(0);
    resultOpacity.setValue(0);
    resultScale.setValue(0.94);
    resultY.setValue(24);
    shineX.setValue(-180);
  }, [focusPulse, reelX, resultOpacity, resultScale, resultY, shineX]);

  const startSelection = useCallback(
    (nextWinner) => {
      if (!nextWinner) return;

      stopAnimations();
      resetAnimatedValues();
      setWinner(nextWinner);
      setReel(buildReel(items, filterType, nextWinner));
      setPhase("spinning");

      Haptics.selectionAsync().catch(() => {});

      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(focusPulse, {
            toValue: 1,
            duration: 620,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(focusPulse, {
            toValue: 0,
            duration: 620,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );

      const reelWidth = Math.min(width - 28, 520);
      const centerOffset = reelWidth / 2 - CARD_WIDTH / 2;
      const target = WINNER_POSITION * CARD_SLOT - centerOffset;
      const spin = Animated.timing(reelX, {
        toValue: -target,
        duration: 3300,
        easing: Easing.bezier(0.08, 0.78, 0.16, 1),
        useNativeDriver: true,
      });

      activeAnimations.current = [pulse, spin];
      pulse.start();
      spin.start(({ finished }) => {
        if (!finished) return;

        pulse.stop();
        focusPulse.setValue(1);
        setPhase("result");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => {},
        );

        const reveal = Animated.parallel([
          Animated.timing(resultOpacity, {
            toValue: 1,
            duration: 260,
            useNativeDriver: true,
          }),
          Animated.spring(resultScale, {
            toValue: 1,
            damping: 15,
            stiffness: 180,
            mass: 0.7,
            useNativeDriver: true,
          }),
          Animated.spring(resultY, {
            toValue: 0,
            damping: 16,
            stiffness: 170,
            mass: 0.7,
            useNativeDriver: true,
          }),
        ]);

        activeAnimations.current = [reveal];
        reveal.start(() => {
          const shine = Animated.timing(shineX, {
            toValue: width + 180,
            duration: 800,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          });
          activeAnimations.current = [shine];
          shine.start();
        });
      });
    },
    [
      filterType,
      focusPulse,
      items,
      reelX,
      resetAnimatedValues,
      resultOpacity,
      resultScale,
      resultY,
      shineX,
      stopAnimations,
      width,
    ],
  );

  useEffect(() => {
    if (!visible) {
      stopAnimations();
      entrance.setValue(0);
      setPhase("idle");
      return;
    }

    const nextWinner = pickWinner(items, filterType);
    if (!nextWinner) return;

    const opening = Animated.spring(entrance, {
      toValue: 1,
      damping: 18,
      stiffness: 170,
      mass: 0.8,
      useNativeDriver: true,
    });
    opening.start();

    const timer = setTimeout(() => startSelection(nextWinner), 220);
    return () => clearTimeout(timer);
  }, [entrance, filterType, items, startSelection, stopAnimations, visible]);

  useEffect(() => () => stopAnimations(), [stopAnimations]);

  const handleClose = useCallback(() => {
    stopAnimations();
    Animated.timing(entrance, {
      toValue: 0,
      duration: 160,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      setPhase("idle");
      onClose();
    });
  }, [entrance, onClose, stopAnimations]);

  const handleReplay = useCallback(() => {
    const nextWinner = pickWinner(items, filterType);
    startSelection(nextWinner);
  }, [filterType, items, startSelection]);

  const backdropSource = winner?.imagePath
    ? { uri: getTmdbUrl(winner.imagePath, "poster", 500) }
    : null;

  const typeLabel =
    winner?.type === "movie"
      ? i18nText("autoI18n.film_2", "Film")
      : i18nText("autoI18n.dizi_2", "Dizi");

  const genreText = useMemo(() => {
    if (!Array.isArray(winner?.genres)) return null;
    return winner.genres.slice(0, 2).join("  •  ");
  }, [winner?.genres]);

  const sheetScale = entrance.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1],
  });
  const focusScale = focusPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.98, 1.025],
  });
  const focusOpacity = focusPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 1],
  });

  const compact = height < 720;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.modalRoot}>
        <BlurView
          tint="dark"
          intensity={80}
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={["rgba(3,6,14,0.74)", "rgba(7,10,22,0.96)"]}
          style={StyleSheet.absoluteFill}
        />
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

        <Animated.View
          style={[
            styles.sheet,
            {
              marginTop: insets.top + 14,
              marginBottom: insets.bottom + 14,
              opacity: entrance,
              transform: [{ scale: sheetScale }],
            },
          ]}
        >
          <LinearGradient
            colors={["rgba(24,29,44,0.98)", "rgba(10,14,27,0.99)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          {backdropSource && phase === "result" ? (
            <View style={styles.backdropWrap} pointerEvents="none">
              <Image
                source={backdropSource}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                blurRadius={24}
              />
              <LinearGradient
                colors={["rgba(10,14,27,0.44)", "rgba(10,14,27,0.98)"]}
                style={StyleSheet.absoluteFill}
              />
            </View>
          ) : null}

          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>
                {i18nText("autoI18n.rastgele_ne_izlesem", "Rastgele Ne İzlesem?")}
              </Text>
              <Text style={styles.title}>
                {phase === "result"
                  ? i18nText("autoI18n.bu_gecenin_secimi", "Bu gecenin seçimi")
                  : i18nText("autoI18n.senin_icin_seciyoruz", "Senin için seçiyoruz")}
              </Text>
            </View>
            <View style={styles.headerActions}>
              <View
                style={[
                  styles.typeBadge,
                  { backgroundColor: `${typeTheme.accent}18` },
                ]}
              >
                <AppIcon
                  family="Ionicons"
                  name={typeTheme.icon}
                  size={15}
                  color={typeTheme.accent}
                />
                <Text style={[styles.typeBadgeText, { color: typeTheme.accent }]}>
                  {typeTheme.label}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}
                activeOpacity={0.75}
              >
                <AppIcon family="Ionicons" name="close" size={20} color="#D7DCE8" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.reelSection, compact && styles.reelSectionCompact]}>
            <View style={styles.reelViewport}>
              <Animated.View
                style={[styles.reelTrack, { transform: [{ translateX: reelX }] }]}
              >
                {reel.map((item) => (
                  <View key={item._reelKey} style={styles.reelCard}>
                    <PosterImage
                      path={item?.imagePath}
                      type={item?.type}
                      size={200}
                      style={styles.reelPoster}
                      contentFit="cover"
                      transition={120}
                    />
                    <LinearGradient
                      colors={["transparent", "rgba(4,7,15,0.9)"]}
                      style={styles.reelCardShade}
                    />
                    <Text style={styles.reelName} numberOfLines={2}>
                      {item.name}
                    </Text>
                  </View>
                ))}
              </Animated.View>

              <LinearGradient
                colors={["#101524", "rgba(16,21,36,0)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.edgeFade, styles.edgeFadeLeft]}
                pointerEvents="none"
              />
              <LinearGradient
                colors={["rgba(16,21,36,0)", "#101524"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.edgeFade, styles.edgeFadeRight]}
                pointerEvents="none"
              />

              <Animated.View
                pointerEvents="none"
                style={[
                  styles.focusFrame,
                  {
                    borderColor: typeTheme.accent,
                    opacity: focusOpacity,
                    transform: [{ scale: focusScale }],
                  },
                ]}
              >
                <LinearGradient
                  colors={[`${typeTheme.accent}22`, "transparent"]}
                  style={StyleSheet.absoluteFill}
                />
                <View
                  style={[styles.focusNotch, { backgroundColor: typeTheme.accent }]}
                />
              </Animated.View>
            </View>

            {phase !== "result" ? (
              <View style={styles.scanningRow}>
                <View style={styles.scanningLine}>
                  <LinearGradient
                    colors={[typeTheme.accent, typeTheme.secondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                  />
                </View>
                <Text style={styles.scanningText}>
                  {i18nText(
                    "autoI18n.izleme_listen_taraniyor",
                    "İzleme listen taranıyor",
                  )}
                </Text>
              </View>
            ) : null}
          </View>

          {phase === "result" && winner ? (
            <Animated.View
              style={[
                styles.resultArea,
                {
                  opacity: resultOpacity,
                  transform: [{ translateY: resultY }, { scale: resultScale }],
                },
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.92}
                style={styles.resultCard}
                onPress={() => {
                  handleClose();
                  setTimeout(() => onNavigate(winner), 170);
                }}
              >
                <View style={styles.posterWrap}>
                  <PosterImage
                    path={winner?.imagePath}
                    type={winner?.type}
                    size={300}
                    style={styles.resultPoster}
                    contentFit="cover"
                    transition={180}
                  />
                  <View
                    style={[
                      styles.posterAccent,
                      { backgroundColor: typeTheme.accent },
                    ]}
                  />
                </View>

                <View style={styles.resultInfo}>
                  <View style={styles.selectedRow}>
                    <View
                      style={[
                        styles.selectedDot,
                        { backgroundColor: typeTheme.accent },
                      ]}
                    />
                    <Text style={[styles.selectedText, { color: typeTheme.accent }]}>
                      {i18nText("autoI18n.secildi", "Seçildi")}
                    </Text>
                  </View>
                  <Text style={styles.resultTitle} numberOfLines={3}>
                    {winner.name}
                  </Text>
                  <Text style={styles.resultMeta} numberOfLines={2}>
                    {[typeLabel, genreText].filter(Boolean).join("  •  ")}
                  </Text>
                  <View style={styles.detailAction}>
                    <Text style={styles.detailActionText}>
                      {i18nText("autoI18n.detaylari_gor", "Detayları gör")}
                    </Text>
                    <AppIcon
                      family="Ionicons"
                      name="arrow-forward"
                      size={17}
                      color="#FFFFFF"
                    />
                  </View>
                </View>

                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.shine,
                    { transform: [{ translateX: shineX }, { rotate: "18deg" }] },
                  ]}
                />
              </TouchableOpacity>

              <View style={styles.actions}>
                <TouchableOpacity
                  activeOpacity={0.78}
                  style={styles.secondaryButton}
                  onPress={handleReplay}
                >
                  <AppIcon
                    family="Ionicons"
                    name="shuffle"
                    size={18}
                    color="#DDE3EF"
                  />
                  <Text style={styles.secondaryButtonText}>
                    {i18nText("autoI18n.yeniden", "Yeniden seç")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.82}
                  style={styles.primaryButton}
                  onPress={() => {
                    handleClose();
                    setTimeout(() => onNavigate(winner), 170);
                  }}
                >
                  <LinearGradient
                    colors={[typeTheme.accent, typeTheme.secondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <Text style={styles.primaryButtonText}>
                    {i18nText("autoI18n.detaylari_gor", "Detaya git")}
                  </Text>
                  <AppIcon
                    family="Ionicons"
                    name="arrow-forward"
                    size={18}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>
              </View>
            </Animated.View>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  sheet: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
    paddingTop: 18,
    paddingBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.45,
    shadowRadius: 28,
    elevation: 24,
  },
  backdropWrap: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.42,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    marginBottom: 18,
    gap: 12,
  },
  headerCopy: { flex: 1 },
  eyebrow: {
    color: "rgba(222,228,240,0.56)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  title: {
    color: "#F7F9FC",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.45,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  typeBadge: {
    height: 34,
    paddingHorizontal: 11,
    borderRadius: 17,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  typeBadgeText: { fontSize: 11, fontWeight: "800" },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  reelSection: { marginBottom: 14 },
  reelSectionCompact: { marginBottom: 8 },
  reelViewport: {
    height: CARD_HEIGHT,
    overflow: "hidden",
    position: "relative",
  },
  reelTrack: {
    height: CARD_HEIGHT,
    flexDirection: "row",
    gap: CARD_GAP,
  },
  reelCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#181D2B",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  reelPoster: { width: "100%", height: "100%" },
  reelCardShade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 58,
  },
  reelName: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 8,
    color: "rgba(255,255,255,0.88)",
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 13,
  },
  edgeFade: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 72,
    zIndex: 4,
  },
  edgeFadeLeft: { left: 0 },
  edgeFadeRight: { right: 0 },
  focusFrame: {
    position: "absolute",
    top: 0,
    left: "50%",
    marginLeft: -CARD_WIDTH / 2,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 18,
    borderWidth: 2,
    zIndex: 6,
    overflow: "hidden",
  },
  focusNotch: {
    position: "absolute",
    top: 0,
    left: "50%",
    marginLeft: -14,
    width: 28,
    height: 3,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  scanningRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    marginTop: 14,
  },
  scanningLine: {
    width: 30,
    height: 3,
    borderRadius: 3,
    overflow: "hidden",
  },
  scanningText: {
    color: "rgba(220,226,238,0.58)",
    fontSize: 12,
    fontWeight: "600",
  },
  resultArea: { paddingHorizontal: 14 },
  resultCard: {
    minHeight: 214,
    borderRadius: 24,
    flexDirection: "row",
    padding: 12,
    gap: 16,
    backgroundColor: "rgba(18,23,37,0.9)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.11)",
    overflow: "hidden",
  },
  posterWrap: {
    width: 126,
    aspectRatio: 2 / 3,
    borderRadius: 17,
    overflow: "hidden",
    backgroundColor: "#171C29",
    alignSelf: "center",
  },
  resultPoster: { width: "100%", height: "100%" },
  posterAccent: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 4,
  },
  resultInfo: {
    flex: 1,
    paddingVertical: 8,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  selectedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 10,
  },
  selectedDot: { width: 7, height: 7, borderRadius: 4 },
  selectedText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  resultTitle: {
    color: "#FFFFFF",
    fontSize: 21,
    lineHeight: 25,
    fontWeight: "800",
    letterSpacing: -0.35,
    marginBottom: 9,
  },
  resultMeta: {
    color: "rgba(220,226,238,0.6)",
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 18,
  },
  detailAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  detailActionText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  shine: {
    position: "absolute",
    top: -70,
    bottom: -70,
    width: 44,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  secondaryButton: {
    height: 50,
    paddingHorizontal: 17,
    borderRadius: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
  },
  secondaryButtonText: { color: "#DDE3EF", fontSize: 13, fontWeight: "700" },
  primaryButton: {
    flex: 1,
    height: 50,
    borderRadius: 17,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
});
