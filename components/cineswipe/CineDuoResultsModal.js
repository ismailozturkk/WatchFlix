// components/cineswipe/CineDuoResultsModal.js
//
// Duo modunda kartlar tamamlandığında veya eşleşmeler incelenmek istendiğinde
// iki tarafın da ortak beğendiği tüm içerikleri listeleyen sonuç ekranı alt sayfası (bottom-sheet).
// Yerinde solan Blur arka planı (useSheetTransition + ModalBlurBackdrop).

import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Animated,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import AppIcon from "../AppIcon";
import ModalBlurBackdrop from "../common/ModalBlurBackdrop";
import useSheetTransition from "../../hooks/useSheetTransition";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { alpha } from "../../theme/colors";
import { triggerHaptic } from "../../services/hapticsService";

const { height: SCREEN_H } = Dimensions.get("window");
const SHEET_MAX_H = SCREEN_H * 0.88;

export default function CineDuoResultsModal({
  visible,
  onClose,
  matches = [],
  partnerName,
  summary,
  isHost,
  cleanupError,
  onRetrySave,
  onSelectMedia,
  onAddAllToWatchlist,
  onSaveAsSharedList,
}) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const text = t.cineRoomResults;
  const insets = useSafeAreaInsets();
  const you = (isHost ? summary?.host : summary?.guest) || {};
  const partner = (isHost ? summary?.guest : summary?.host) || {};
  const sheet = useSheetTransition(visible);

  return (
    <Modal
      animationType="none"
      transparent
      visible={sheet.mounted}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay} onLayout={sheet.onOverlayLayout}>
        {/* Blur YERİNDE solar */}
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: sheet.backdropOpacity }]}
        >
          <ModalBlurBackdrop intensity={40} />
        </Animated.View>

        {/* Backdrop Dismiss */}
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
              paddingBottom: Math.max(insets.bottom, 16),
            },
            sheet.sheetStyle,
          ]}
        >
          {/* Drag Indicator Handle */}
          <View style={[styles.handle, { backgroundColor: theme.border }]} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={[styles.headerIconCircle, { backgroundColor: alpha("#FFD700", 0.18) }]}>
                <AppIcon family="Ionicons" name="trophy" size={20} color="#FFD700" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.headerTitle, { color: theme.text.primary }]}>
                  {text.title}
                </Text>
                <Text style={[styles.headerSub, { color: theme.text.secondary }]}>
                  {text.subtitle}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <AppIcon family="Ionicons" name="close" size={20} color={theme.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
          {summary && (
            <View style={styles.stats}>
              {[
                [text.total, summary.total],
                [text.matches, matches.length],
                [text.matchRate, `%${summary.matchRate}`],
              ].map(([label, value]) => (
                <View key={label} style={[styles.stat, { backgroundColor: alpha(theme.accent, 0.1) }]}>
                  <Text style={[styles.statValue, { color: theme.accent }]}>{value}</Text>
                  <Text style={[styles.statLabel, { color: theme.text.secondary }]}>{label}</Text>
                </View>
              ))}
              <Text style={[styles.personStats, { color: theme.text.primary }]}>
                {text.you}: {you.likes || 0} {text.likes} · {you.passes || 0} {text.passes}
              </Text>
              <Text style={[styles.personStats, { color: theme.text.primary }]}>
                {partnerName || text.partner}: {partner.likes || 0} {text.likes} · {partner.passes || 0} {text.passes}
              </Text>
            </View>
          )}
          {cleanupError && (
            <View style={{ gap: 8, paddingVertical: 12 }}>
              <Text accessibilityLiveRegion="polite" style={{ color: theme.text.secondary }}>{text.saveError}</Text>
              <TouchableOpacity onPress={onRetrySave} style={styles.watchlistBtn}>
                <Text style={{ color: theme.accent }}>{text.retrySave}</Text>
              </TouchableOpacity>
            </View>
          )}
          {/* Matches List */}
          {matches.length === 0 ? (
            <View style={styles.emptyState}>
              <AppIcon family="Ionicons" name="film-outline" size={48} color={theme.text.muted} />
              <Text style={[styles.emptyTitle, { color: theme.text.secondary }]}>
                {text.emptyTitle}
              </Text>
              <Text style={[styles.emptySub, { color: theme.text.muted }]}>
                {text.emptyBody}
              </Text>
            </View>
          ) : (
            <View style={[styles.scrollContent, { marginTop: 10 }]}>
              {matches.map((item, idx) => {
                const rawPath = item.poster_path || item.poster;
                const posterUri = rawPath
                  ? rawPath.startsWith("http")
                    ? rawPath
                    : `https://image.tmdb.org/t/p/w342${rawPath}`
                  : null;
                const year = item.release_date ? item.release_date.split("-")[0] : "";
                const rating = item.vote_average ? Number(item.vote_average).toFixed(1) : "";

                return (
                  <TouchableOpacity
                    key={`${item.mediaType || "movie"}_${item.id || idx}`}
                    style={[
                      styles.matchCard,
                      { backgroundColor: alpha(theme.secondary || "#2C2C2E", 0.6) },
                    ]}
                    onPress={() => {
                      triggerHaptic("selection");
                      onClose();
                      onSelectMedia?.(item);
                    }}
                  >
                    <View style={styles.posterBox}>
                      {posterUri ? (
                        <Image source={{ uri: posterUri }} style={styles.poster} contentFit="cover" />
                      ) : (
                        <View style={[styles.posterPlaceholder, { backgroundColor: theme.between }]}>
                          <AppIcon family="Ionicons" name="film-outline" size={24} color={theme.text.muted} />
                        </View>
                      )}
                    </View>

                    <View style={styles.cardDetails}>
                      <Text style={[styles.cardTitle, { color: theme.text.primary }]} numberOfLines={2}>
                        {item.title || item.name}
                      </Text>
                      <View style={styles.metaLine}>
                        {year ? <Text style={[styles.cardYear, { color: theme.text.secondary }]}>{year}</Text> : null}
                        {rating && rating !== "0.0" ? (
                          <View style={styles.ratingBox}>
                            <AppIcon family="Ionicons" name="star" size={11} color="#FFD700" />
                            <Text style={styles.ratingText}>{rating}</Text>
                          </View>
                        ) : null}
                      </View>
                      {item.overview ? (
                        <Text style={[styles.cardOverview, { color: theme.text.muted }]} numberOfLines={2}>
                          {item.overview}
                        </Text>
                      ) : null}
                    </View>

                    <View style={styles.arrowBox}>
                      <AppIcon family="Ionicons" name="chevron-forward" size={18} color={theme.text.muted} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Action Buttons */}
          {matches.length > 0 && (
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={[styles.sharedListBtn, { backgroundColor: theme.accent || "#138DF0" }]}
                onPress={() => {
                  triggerHaptic("impact");
                  onSaveAsSharedList?.(matches);
                }}
              >
                <AppIcon family="Ionicons" name="people" size={18} color="#FFF" />
                <Text style={styles.sharedListBtnText}>{text.sharedList}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.watchlistBtn,
                  { backgroundColor: alpha(theme.secondary || "#333", 0.7), borderColor: theme.border },
                ]}
                onPress={() => {
                  triggerHaptic("notification");
                  onAddAllToWatchlist?.(matches);
                }}
              >
                <AppIcon family="Ionicons" name="bookmark-outline" size={18} color={theme.text.primary} />
                <Text style={[styles.watchlistBtnText, { color: theme.text.primary }]}>
                  {text.watchlist}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingVertical: 14 },
  stat: { flex: 1, minWidth: 80, alignItems: "center", padding: 12, borderRadius: 14 },
  statValue: { fontSize: 24, fontWeight: "900" },
  statLabel: { fontSize: 11, textAlign: "center", marginTop: 4 },
  personStats: { width: "100%", fontSize: 13, marginTop: 6 },
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  headerTitleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  headerSub: {
    fontSize: 11,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 50,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  emptySub: {
    fontSize: 12,
    textAlign: "center",
    maxWidth: 240,
  },
  scrollArea: {
    maxHeight: 340,
    marginTop: 10,
  },
  scrollContent: {
    paddingBottom: 10,
    gap: 10,
  },
  matchCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 16,
    gap: 12,
  },
  posterBox: {
    width: 55,
    height: 80,
    borderRadius: 10,
    overflow: "hidden",
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
    backgroundColor: "#202024",
  },
  cardDetails: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 4,
  },
  metaLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  cardYear: {
    fontSize: 11,
    fontWeight: "600",
  },
  ratingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  ratingText: {
    color: "#FFD700",
    fontSize: 11,
    fontWeight: "800",
  },
  cardOverview: {
    fontSize: 11,
    lineHeight: 15,
  },
  actionsContainer: {
    marginTop: 14,
    gap: 10,
  },
  sharedListBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    borderRadius: 14,
    gap: 8,
  },
  sharedListBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  watchlistBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  watchlistBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
});
