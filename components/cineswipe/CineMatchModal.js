// components/cineswipe/CineMatchModal.js
//
// İki kullanıcı aynı içeriği beğendiğinde (Duo) veya Solo modda eşleşme anında
// açılan heyecan verici kutlama ve aksiyon alt sayfası (bottom sheet).
// Yerinde solan Blur arka planı (useSheetTransition + ModalBlurBackdrop).

import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "../AppIcon";
import ModalBlurBackdrop from "../common/ModalBlurBackdrop";
import useSheetTransition from "../../hooks/useSheetTransition";
import { useTheme } from "../../context/ThemeContext";
import { alpha } from "../../theme/colors";
import { triggerHaptic } from "../../services/hapticsService";

const { height: SCREEN_H } = Dimensions.get("window");
const SHEET_MAX_H = SCREEN_H * 0.85;

export default function CineMatchModal({
  visible,
  matchedMedia,
  partnerName,
  onClose,
  onViewDetails,
  onAddToWatchlist,
}) {
  const { theme } = useTheme();
  const sheet = useSheetTransition(visible);

  if (!sheet.mounted) return null;

  const media = matchedMedia || {};
  const posterUri = media.poster_path
    ? `https://image.tmdb.org/t/p/w780${media.poster_path}`
    : null;

  const handleAddWatchlist = () => {
    if (!matchedMedia) return;
    triggerHaptic("notification");
    onAddToWatchlist?.(matchedMedia);
  };

  const handleDetails = () => {
    if (!matchedMedia) return;
    onClose();
    setTimeout(() => {
      onViewDetails?.(matchedMedia);
    }, 280);
  };

  return (
    <Modal
      animationType="none"
      transparent
      visible={sheet.mounted}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay} onLayout={sheet.onOverlayLayout}>
        {/* Blur YERİNDE solar — sayfayla birlikte kaymaz */}
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: sheet.backdropOpacity }]}
        >
          <ModalBlurBackdrop intensity={40} />
        </Animated.View>

        {/* Backdrop Touchable to Dismiss */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />

        {/* Slide-Up Bottom Sheet */}
        <Animated.View
          onLayout={sheet.onSheetLayout}
          style={[
            styles.sheet,
            {
              backgroundColor: theme.primary,
              borderColor: theme.border,
            },
            sheet.sheetStyle,
          ]}
        >
          {/* Drag Indicator Handle */}
          <View style={[styles.handle, { backgroundColor: theme.border }]} />

          {/* Confetti / Match Header */}
          <View style={styles.header}>
            <View style={[styles.sparkleBadge, { backgroundColor: alpha(theme.accent || "#138DF0", 0.15) }]}>
              <AppIcon family="Ionicons" name="sparkles" size={24} color={theme.accent || "#138DF0"} />
            </View>
            <Text style={[styles.matchTitle, { color: theme.accent || "#138DF0" }]}>
              {partnerName ? "BİRLİKTE EŞLEŞTİNİZ!" : "FİLM SEÇİLDİ!"}
            </Text>
            <Text style={[styles.matchSubtitle, { color: theme.text.secondary }]}>
              {partnerName
                ? `${partnerName} ile bu akşam izleyeceğiniz film bulundu!`
                : "Bu filmi izleme listenize ekleyebilir veya hemen detaylarına bakabilirsiniz."}
            </Text>
          </View>

          {/* Poster & Info Card */}
          <View style={[styles.mediaCard, { backgroundColor: alpha(theme.secondary || "#2C2C2E", 0.6) }]}>
            <View style={[styles.posterContainer, { backgroundColor: theme.between }]}>
              {posterUri ? (
                <Image source={{ uri: posterUri }} style={styles.poster} contentFit="cover" />
              ) : (
                <View style={[styles.posterPlaceholder, { backgroundColor: theme.between }]}>
                  <AppIcon family="Ionicons" name="film-outline" size={36} color={theme.text.muted} />
                </View>
              )}
            </View>

            <View style={styles.mediaDetails}>
              <Text style={[styles.mediaTitle, { color: theme.text.primary }]} numberOfLines={2}>
                {matchedMedia.title || matchedMedia.name}
              </Text>

              {matchedMedia.release_date && (
                <Text style={[styles.mediaYear, { color: theme.text.secondary }]}>
                  {matchedMedia.release_date.split("-")[0]}
                </Text>
              )}

              {matchedMedia.vote_average ? (
                <View style={styles.ratingRow}>
                  <AppIcon family="Ionicons" name="star" size={14} color="#FFD700" />
                  <Text style={styles.ratingText}>
                    {matchedMedia.vote_average.toFixed(1)} / 10
                  </Text>
                </View>
              ) : null}

              {matchedMedia.overview ? (
                <Text style={[styles.overviewText, { color: theme.text.secondary }]}>
                  {matchedMedia.overview}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                { backgroundColor: theme.accent || "#138DF0" },
              ]}
              onPress={handleDetails}
            >
              <AppIcon family="Ionicons" name="information-circle-outline" size={20} color="#FFF" />
              <Text style={styles.primaryBtnText}>Detayları Gör</Text>
            </TouchableOpacity>

            <View style={styles.secondaryRow}>
              <TouchableOpacity
                style={[
                  styles.secondaryBtn,
                  { backgroundColor: alpha(theme.secondary || "#333", 0.8) },
                ]}
                onPress={handleAddWatchlist}
              >
                <AppIcon family="Ionicons" name="bookmark-outline" size={18} color={theme.text.primary} />
                <Text style={[styles.secondaryBtnText, { color: theme.text.primary }]}>
                  İzleme Listesine Ekle
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.closeActionBtn,
                  { backgroundColor: alpha(theme.secondary || "#333", 0.6) },
                ]}
                onPress={onClose}
              >
                <Text style={[styles.closeActionText, { color: theme.text.secondary }]}>
                  Kapat
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: SHEET_MAX_H,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 16,
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 3,
    marginBottom: 10,
    opacity: 0.6,
  },
  header: {
    alignItems: "center",
    marginBottom: 16,
  },
  sparkleBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  matchTitle: {
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 1,
    textAlign: "center",
    marginBottom: 4,
  },
  matchSubtitle: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  mediaCard: {
    flexDirection: "row",
    borderRadius: 18,
    padding: 12,
    marginBottom: 18,
    gap: 14,
  },
  posterContainer: {
    width: 90,
    height: 130,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#202024",
  },
  poster: {
    width: "100%",
    height: "100%",
  },
  posterPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  mediaDetails: {
    flex: 1,
    justifyContent: "center",
  },
  mediaTitle: {
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 20,
    marginBottom: 4,
  },
  mediaYear: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 6,
  },
  ratingText: {
    color: "#FFD700",
    fontSize: 12,
    fontWeight: "700",
  },
  overviewText: {
    fontSize: 11,
    lineHeight: 15,
  },
  buttonGroup: {
    gap: 10,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    borderRadius: 14,
    gap: 8,
  },
  primaryBtnText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryRow: {
    flexDirection: "row",
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 44,
    borderRadius: 12,
    gap: 6,
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  closeActionBtn: {
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  closeActionText: {
    fontSize: 13,
    fontWeight: "700",
  },
});
