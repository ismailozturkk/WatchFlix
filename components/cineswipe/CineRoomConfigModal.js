// components/cineswipe/CineRoomConfigModal.js
//
// Duo modda oda kurmadan önce ev sahibine deste boyutu (kart sayısı)
// ve içerik kategorisi seçtiren yapılandırma alt sayfası (bottom-sheet).
// Yerinde solan Blur arka planı (useSheetTransition + ModalBlurBackdrop).

import React, { useState } from "react";
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
import AppIcon from "../AppIcon";
import ModalBlurBackdrop from "../common/ModalBlurBackdrop";
import useSheetTransition from "../../hooks/useSheetTransition";
import { useTheme } from "../../context/ThemeContext";
import { alpha } from "../../theme/colors";
import { triggerHaptic } from "../../services/hapticsService";
import { SWIPE_CATEGORIES } from "../../services/cineswipe/cineswipeService";

const { height: SCREEN_H } = Dimensions.get("window");
const SHEET_MAX_H = SCREEN_H * 0.82;

const CARD_COUNTS = [10, 20, 30, 50];

export default function CineRoomConfigModal({
  visible,
  onClose,
  onConfirmCreate,
}) {
  const { theme } = useTheme();
  const sheet = useSheetTransition(visible);

  const [selectedCount, setSelectedCount] = useState(20);
  const [selectedCategory, setSelectedCategory] = useState("trending");

  const handleCreate = () => {
    triggerHaptic("impact");
    onConfirmCreate({
      targetCardsCount: selectedCount,
      category: selectedCategory,
    });
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
              <View style={[styles.headerIconCircle, { backgroundColor: alpha(theme.accent || "#138DF0", 0.15) }]}>
                <AppIcon family="Ionicons" name="settings-outline" size={18} color={theme.accent || "#138DF0"} />
              </View>
              <Text style={[styles.headerTitle, { color: theme.text.primary }]}>
                Oda Ayarları
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <AppIcon family="Ionicons" name="close" size={20} color={theme.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Kart / Tur Sayısı */}
            <Text style={[styles.sectionHeading, { color: theme.text.secondary }]}>
              KART / TUR SAYISI
            </Text>
            <View style={styles.countRow}>
              {CARD_COUNTS.map((cnt) => {
                const isSelected = selectedCount === cnt;
                return (
                  <TouchableOpacity
                    key={cnt}
                    style={[
                      styles.countBtn,
                      {
                        backgroundColor: isSelected
                          ? theme.accent || "#138DF0"
                          : alpha(theme.secondary || "#2C2C2E", 0.6),
                      },
                    ]}
                    onPress={() => {
                      triggerHaptic("selection");
                      setSelectedCount(cnt);
                    }}
                  >
                    <Text
                      style={[
                        styles.countBtnText,
                        { color: isSelected ? "#FFF" : theme.text.primary },
                      ]}
                    >
                      {cnt} Kart
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* İçerik Havuzu / Kategori */}
            <Text style={[styles.sectionHeading, { color: theme.text.secondary, marginTop: 16 }]}>
              İÇERİK HAVUZU
            </Text>
            <View style={styles.categoriesGrid}>
              {SWIPE_CATEGORIES.filter((c) => c.id !== "watchlist").map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryCard,
                      {
                        backgroundColor: isSelected
                          ? alpha(theme.accent || "#138DF0", 0.18)
                          : alpha(theme.secondary || "#2C2C2E", 0.4),
                        borderColor: isSelected
                          ? theme.accent || "#138DF0"
                          : "transparent",
                      },
                    ]}
                    onPress={() => {
                      triggerHaptic("selection");
                      setSelectedCategory(cat.id);
                    }}
                  >
                    <AppIcon
                      family="Ionicons"
                      name={cat.icon}
                      size={18}
                      color={isSelected ? theme.accent || "#138DF0" : theme.text.secondary}
                    />
                    <Text
                      style={[
                        styles.categoryLabel,
                        {
                          color: isSelected ? theme.accent || "#138DF0" : theme.text.primary,
                          fontWeight: isSelected ? "800" : "600",
                        },
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Confirm Button */}
          <TouchableOpacity
            style={[styles.createBtn, { backgroundColor: theme.accent || "#138DF0" }]}
            onPress={handleCreate}
          >
            <AppIcon family="Ionicons" name="arrow-forward-circle" size={20} color="#FFF" />
            <Text style={styles.createBtnText}>Odayı Kur ve Kodu Al</Text>
          </TouchableOpacity>
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
    gap: 8,
  },
  headerIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  scrollArea: {
    marginTop: 10,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  countRow: {
    flexDirection: "row",
    gap: 8,
  },
  countBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
  },
  countBtnText: {
    fontSize: 13,
    fontWeight: "800",
  },
  categoriesGrid: {
    gap: 8,
  },
  categoryCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 12,
  },
  categoryLabel: {
    fontSize: 14,
  },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 50,
    borderRadius: 16,
    gap: 8,
    marginTop: 10,
  },
  createBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
});
