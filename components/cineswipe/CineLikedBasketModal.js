// components/cineswipe/CineLikedBasketModal.js
//
// Solo modda sağa kaydırılarak beğenilen tüm filmlerin biriktiği "Beğeni Sepeti".
// 1:1.5 sinema afişi oranında, isim yazısız, ultra temiz ve modern görsel galeri.
// Rastgele 1 Tane Seçme (🎲), 2. Tur Eleme (🔄), Yeni Liste Yapma (📑) ve İzleme Listesi (➕).
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
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "../AppIcon";
import ModalBlurBackdrop from "../common/ModalBlurBackdrop";
import useSheetTransition from "../../hooks/useSheetTransition";
import { useTheme } from "../../context/ThemeContext";
import { alpha } from "../../theme/colors";
import { triggerHaptic } from "../../services/hapticsService";
import Toast from "react-native-toast-message";

const { height: SCREEN_H } = Dimensions.get("window");
const SHEET_MAX_H = SCREEN_H * 0.88;

export default function CineLikedBasketModal({
  visible,
  onClose,
  likedItems = [],
  onRandomPick,
  onPlaySecondRound,
  onSaveAsCustomList,
  onAddAllToWatchlist,
  onClearBasket,
  onRemoveItem,
}) {
  const { theme } = useTheme();
  const sheet = useSheetTransition(visible);

  const handleRandom = () => {
    if (likedItems.length === 0) return;
    triggerHaptic("notification");
    const picked = likedItems[Math.floor(Math.random() * likedItems.length)];
    onRandomPick?.(picked);
    onClose();
  };

  const handleSecondRound = () => {
    if (likedItems.length < 2) {
      Toast.show({
        type: "info",
        text1: "Yetersiz İçerik",
        text2: "2. tur eleme için en az 2 film beğenmelisiniz.",
      });
      return;
    }
    triggerHaptic("impact");
    onPlaySecondRound?.(likedItems);
    onClose();
  };

  const handleSaveList = () => {
    if (likedItems.length === 0) return;
    triggerHaptic("impact");
    onSaveAsCustomList?.(likedItems);
    onClose();
  };

  const handleAddWatchlist = () => {
    if (likedItems.length === 0) return;
    triggerHaptic("notification");
    onAddAllToWatchlist?.(likedItems);
    onClose();
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
        {/* Blur YERİNDE solar */}
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: sheet.backdropOpacity }]}
        >
          <ModalBlurBackdrop intensity={38} />
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
            },
            sheet.sheetStyle,
          ]}
        >
          {/* Drag Indicator Handle */}
          <View style={[styles.handle, { backgroundColor: theme.border }]} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerIconCircle}>
                <AppIcon family="Ionicons" name="heart" size={18} color="#FF3B5C" />
              </View>
              <View>
                <Text style={[styles.headerTitle, { color: theme.text.primary }]}>
                  Beğenilenler Sepeti
                </Text>
                <Text style={[styles.headerSub, { color: theme.text.secondary }]}>
                  {likedItems.length} içerik seçildi
                </Text>
              </View>
            </View>

            {likedItems.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  triggerHaptic("selection");
                  onClearBasket?.();
                }}
                style={styles.clearBtn}
              >
                <AppIcon family="Ionicons" name="trash-outline" size={16} color="#FF3B30" />
                <Text style={styles.clearText}>Temizle</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Liked Items Grid (1:1.5 Aspect Ratio Pure Posters) */}
          {likedItems.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconCircle, { backgroundColor: alpha("#FF3B5C", 0.1) }]}>
                <AppIcon family="Ionicons" name="heart-dislike-outline" size={42} color="#FF3B5C" />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>
                Sepetiniz Boş
              </Text>
              <Text style={[styles.emptySub, { color: theme.text.secondary }]}>
                Kartları sağa kaydırarak beğendiğiniz filmleri buraya toplayabilirsiniz.
              </Text>
            </View>
          ) : (
            <>
              <ScrollView
                style={styles.scrollArea}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.grid}>
                  {likedItems.map((item) => {
                    const rawPath = item.poster_path || item.poster;
                    const posterUri = rawPath
                      ? rawPath.startsWith("http")
                        ? rawPath
                        : `https://image.tmdb.org/t/p/w342${rawPath}`
                      : null;
                    const rating = item.vote_average ? Number(item.vote_average).toFixed(1) : "";

                    return (
                      <View
                        key={String(item.id)}
                        style={[
                          styles.itemCard,
                          { backgroundColor: alpha(theme.secondary || "#2C2C2E", 0.6) },
                        ]}
                      >
                        {posterUri ? (
                          <Image
                            source={{ uri: posterUri }}
                            style={styles.poster}
                            contentFit="cover"
                            transition={150}
                          />
                        ) : (
                          <View style={[styles.posterPlaceholder, { backgroundColor: theme.between }]}>
                            <AppIcon family="Ionicons" name="film-outline" size={28} color={theme.text.muted} />
                          </View>
                        )}

                        {/* Subtle Bottom Gradient */}
                        <LinearGradient
                          colors={["transparent", "rgba(0,0,0,0.65)"]}
                          style={styles.cardGradient}
                        />

                        {/* Floating Rating Badge */}
                        {rating && rating !== "0.0" ? (
                          <View style={styles.floatingRating}>
                            <AppIcon family="Ionicons" name="star" size={9} color="#FFD700" />
                            <Text style={styles.floatingRatingText}>{rating}</Text>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </ScrollView>

              {/* Action Buttons Hub */}
              <View style={styles.actionsContainer}>
                {/* Random Pick (Highlight 1 Movie) */}
                <TouchableOpacity
                  style={styles.primaryActionBtn}
                  onPress={handleRandom}
                  activeOpacity={0.88}
                >
                  <LinearGradient
                    colors={["#FF3B5C", "#E01E43"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primaryActionGradient}
                  >
                    <AppIcon family="Ionicons" name="dice-outline" size={20} color="#FFF" />
                    <Text style={styles.primaryActionText}>
                      Rastgele Birini Seç (Şanslı Seçim)
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>

                {/* Secondary Actions in 3 Columns */}
                <View style={styles.secondaryActionRow}>
                  <TouchableOpacity
                    style={[
                      styles.secondaryActionBtn,
                      {
                        backgroundColor: alpha(theme.accent || "#138DF0", 0.15),
                        borderColor: alpha(theme.accent || "#138DF0", 0.4),
                      },
                    ]}
                    onPress={handleSecondRound}
                  >
                    <AppIcon family="Ionicons" name="repeat" size={16} color={theme.accent || "#138DF0"} />
                    <Text style={[styles.secondaryActionText, { color: theme.accent || "#138DF0" }]}>
                      2. Tur Eleme
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.secondaryActionBtn,
                      {
                        backgroundColor: alpha(theme.secondary || "#333", 0.7),
                        borderColor: theme.border,
                      },
                    ]}
                    onPress={handleSaveList}
                  >
                    <AppIcon family="Ionicons" name="list" size={16} color={theme.text.primary} />
                    <Text style={[styles.secondaryActionText, { color: theme.text.primary }]}>
                      Liste Yap
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.secondaryActionBtn,
                      {
                        backgroundColor: alpha(theme.secondary || "#333", 0.7),
                        borderColor: theme.border,
                      },
                    ]}
                    onPress={handleAddWatchlist}
                  >
                    <AppIcon family="Ionicons" name="bookmark" size={16} color={theme.text.primary} />
                    <Text style={[styles.secondaryActionText, { color: theme.text.primary }]}>
                      İzleme Listesi
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
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
    paddingHorizontal: 18,
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
    backgroundColor: "rgba(255, 59, 92, 0.15)",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "900",
  },
  headerSub: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 1,
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "rgba(255, 59, 48, 0.12)",
  },
  clearText: {
    color: "#FF3B30",
    fontSize: 12,
    fontWeight: "800",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 50,
    gap: 8,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  emptySub: {
    fontSize: 13,
    textAlign: "center",
    maxWidth: 260,
    lineHeight: 18,
  },
  scrollArea: {
    maxHeight: SCREEN_H * 0.42,
    marginTop: 12,
  },
  scrollContent: {
    paddingBottom: 6,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  itemCard: {
    width: "31%",
    aspectRatio: 1 / 1.5, // 1:1.5 en/boy oranı
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
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
  cardGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "40%",
  },
  floatingRating: {
    position: "absolute",
    bottom: 6,
    right: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.3)",
  },
  floatingRatingText: {
    color: "#FFD700",
    fontSize: 10,
    fontWeight: "900",
  },
  actionsContainer: {
    marginTop: 14,
    gap: 10,
  },
  primaryActionBtn: {
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#FF3B5C",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  primaryActionGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 50,
    gap: 8,
  },
  primaryActionText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  secondaryActionRow: {
    flexDirection: "row",
    gap: 8,
  },
  secondaryActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    gap: 5,
  },
  secondaryActionText: {
    fontSize: 11,
    fontWeight: "800",
  },
});
