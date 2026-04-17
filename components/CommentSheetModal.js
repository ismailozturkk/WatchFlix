/**
 * CommentSheetModal.jsx
 *
 * MovieDetails içindeki yorum modalinin tüm UI katmanı.
 * Kullanım:
 *
 *   import CommentSheetModal from "../../components/CommentSheetModal";
 *
 *   <CommentSheetModal
 *     visible={commandModalVisible}
 *     onClose={() => setCommentModalVisible(false)}
 *     movieId={id}
 *     details={details}        // film adı + poster için (opsiyonel)
 *   />
 *
 * MovieDetails içindeki eski Modal bloğunu tamamen bu bileşenle değiştir:
 *
 *   <Modal
 *     animationType="none"
 *     transparent
 *     visible={commandModalVisible}
 *     onRequestClose={() => setCommentModalVisible(false)}
 *     statusBarTranslucent
 *   >
 *     <CommentSheetModal
 *       visible={commandModalVisible}
 *       onClose={() => setCommentModalVisible(false)}
 *       movieId={id}
 *       details={details}
 *     />
 *   </Modal>
 */

import React, { useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  Image,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import Comment from "./Comment"; // kendi Comment bileşenin
import { useTheme } from "../context/ThemeContext";
import { useAppSettings } from "../context/AppSettingsContext";

const SHEET_HEIGHT = SCREEN_H * 0.82;
const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get("window");

// ── Renk sabitleri ───────────────────────────────────────
const ACCENT = "#6C63FF";
const SHEET_BG = "#0E0E1C";
const BORDER = "rgba(255,255,255,0.07)";

export default function CommentSheetModal({
  visible,
  onClose,
  movieId,
  details,
}) {
  const { imageQuality } = useAppSettings();
  const { theme } = useTheme();

  // Sheet slide-up animasyonu
  const SHEET_H = SCREEN_H * 0.82;
  const slideAnim = useRef(new Animated.Value(SHEET_H)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 22,
          stiffness: 180,
          mass: 0.9,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SHEET_H,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: SHEET_H,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  }, [onClose]);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* ── Karartma overlay ── */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <BlurView
          tint="dark"
          intensity={28}
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
        {/* Alt gradient — sheet'e doğru koyulaşır */}
        <LinearGradient
          colors={["rgba(0,0,0,0.1)", "rgba(0,0,0,0.55)", "rgba(0,0,0,0.82)"]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Backdrop'a dokununca kapat */}
      <TouchableOpacity
        style={styles.backdropTouchable}
        activeOpacity={1}
        onPress={handleClose}
      />

      {/* ── Bottom Sheet ── */}
      <Animated.View
        style={[
          styles.sheet,
          {
            transform: [{ translateY: slideAnim }],
            backgroundColor: theme.secondary,
          },
        ]}
      >
        {/* Üst kenar glow şeridi */}
        <View
          style={[styles.sheetTopGlow, { backgroundColor: theme.accent }]}
        />

        {/* Tutamaç */}
        <View style={styles.handleWrapper}>
          <View style={styles.handle} />
        </View>

        {/* ── Header ── */}
        <View style={styles.header}>
          {/* Film küçük kartı */}
          <View style={styles.moviePill}>
            {details?.poster_path ? (
              <Image
                source={{
                  uri: `https://image.tmdb.org/t/p/${imageQuality?.poster || "w185"}${details.poster_path}`,
                }}
                style={styles.moviePillPoster}
              />
            ) : (
              <View style={styles.moviePillPosterPlaceholder}>
                <Ionicons
                  name="film-outline"
                  size={14}
                  color="rgba(255,255,255,0.4)"
                />
              </View>
            )}
            <Text
              allowFontScaling={false}
              style={styles.moviePillTitle}
              numberOfLines={1}
            >
              {details?.title || details?.name || "Film"}
            </Text>
            {details?.vote_average > 0 && (
              <View style={styles.moviePillRating}>
                <Ionicons name="star" size={9} color="#FFD54F" />
                <Text
                  allowFontScaling={false}
                  style={styles.moviePillRatingText}
                >
                  {details.vote_average.toFixed(1)}
                </Text>
              </View>
            )}
          </View>

          {/* Sağ: Başlık + kapat */}
          <View style={styles.headerRight}>
            <View style={styles.headerTitleGroup}>
              <MaterialCommunityIcons
                name="comment-text-multiple-outline"
                size={18}
                color={theme.text.secondary}
              />
              <Text allowFontScaling={false} style={styles.headerTitle}>
                Yorumlar
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={handleClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={18} color="rgba(255,255,255,0.55)" />
            </TouchableOpacity>
          </View>
        </View>

        {/* İnce ayırıcı */}
        <View style={styles.divider} />

        {/* ── Comment bileşeni ── */}
        <View style={styles.commentArea}>
          <Comment contextId={movieId} />
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },

  // Backdrop
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropTouchable: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    // Sadece sheet'in üzerindeki boşluğu kapla
    bottom: SCREEN_H * 0.82,
  },

  // ── Sheet ──────────────────────────────────────────────
  sheet: {
    height: SCREEN_H * 0.82,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: "hidden",
    // iOS gölge
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 28,
  },

  // Üst kenar mor ışıltı
  sheetTopGlow: {
    position: "absolute",
    top: 0,
    left: "15%",
    right: "15%",
    height: 1.5,
    opacity: 0.7,
    borderRadius: 1,
  },

  // Tutamaç
  handleWrapper: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 6,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.14)",
  },

  // ── Header ──────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 12,
    gap: 10,
  },

  // Film bilgi pill (sol)
  moviePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    paddingVertical: 5,
    paddingHorizontal: 8,
    gap: 6,
    flex: 1,
    maxWidth: SCREEN_W * 0.5,
  },
  moviePillPoster: {
    width: 26,
    height: 39,
    borderRadius: 5,
    flexShrink: 0,
  },
  moviePillPosterPlaceholder: {
    width: 26,
    height: 39,
    borderRadius: 5,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  moviePillTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.75)",
    letterSpacing: 0.1,
  },
  moviePillRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 8,
  },
  moviePillRatingText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#ffad4fff",
  },

  // Sağ grup
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },

  // Ayırıcı
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.07)",
    marginHorizontal: 0,
  },

  // Comment alanı
  commentArea: {
    flex: 1,
  },
});
