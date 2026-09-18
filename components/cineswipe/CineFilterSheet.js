// components/cineswipe/CineFilterSheet.js
//
// Solo ve Duo mod için dinamik deste filtreleme alt sayfası (bottom-sheet).
// Kategori, Film/Dizi seçimi ve Janr/Tür filtrelerini barındırır.
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
import { SWIPE_CATEGORIES, GENRE_OPTIONS } from "../../services/cineswipe/cineswipeService";

const { height: SCREEN_H } = Dimensions.get("window");
const SHEET_MAX_H = SCREEN_H * 0.85;

export default function CineFilterSheet({
  visible,
  onClose,
  currentCategory,
  currentMediaType,
  currentGenreId,
  onApplyFilters,
}) {
  const { theme } = useTheme();
  const sheet = useSheetTransition(visible);

  const [selectedCategory, setSelectedCategory] = useState(currentCategory || "trending");
  const [selectedMediaType, setSelectedMediaType] = useState(currentMediaType || "movie");
  const [selectedGenreId, setSelectedGenreId] = useState(currentGenreId || null);

  const handleApply = () => {
    triggerHaptic("impact");
    onApplyFilters({
      category: selectedCategory,
      mediaType: selectedMediaType,
      genreId: selectedGenreId,
    });
    onClose();
  };

  const handleReset = () => {
    triggerHaptic("selection");
    setSelectedCategory("trending");
    setSelectedMediaType("movie");
    setSelectedGenreId(null);
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
          <ModalBlurBackdrop intensity={35} />
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

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={[styles.headerIconCircle, { backgroundColor: alpha(theme.accent || "#138DF0", 0.15) }]}>
                <AppIcon family="Ionicons" name="options-outline" size={18} color={theme.accent || "#138DF0"} />
              </View>
              <Text style={[styles.headerTitle, { color: theme.text.primary }]}>
                Deste Filtreleme
              </Text>
            </View>
            <TouchableOpacity onPress={handleReset} style={styles.resetBtn}>
              <Text style={[styles.resetText, { color: theme.accent || "#138DF0" }]}>Sıfırla</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Medya Türü (Film / Dizi / Karışık) */}
            <Text style={[styles.sectionHeading, { color: theme.text.secondary }]}>
              İÇERİK TÜRÜ
            </Text>
            <View style={styles.mediaTypeRow}>
              {[
                { id: "movie", label: "Filmler", icon: "film-outline" },
                { id: "tv", label: "Diziler", icon: "tv-outline" },
                { id: "all", label: "Karışık", icon: "shuffle-outline" },
              ].map((item) => {
                const isActive = selectedMediaType === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.mediaTypeBtn,
                      {
                        backgroundColor: isActive
                          ? theme.accent || "#138DF0"
                          : alpha(theme.secondary || "#2C2C2E", 0.6),
                      },
                    ]}
                    onPress={() => {
                      triggerHaptic("selection");
                      setSelectedMediaType(item.id);
                    }}
                  >
                    <AppIcon
                      family="Ionicons"
                      name={item.icon}
                      size={16}
                      color={isActive ? "#FFF" : theme.text.secondary}
                    />
                    <Text
                      style={[
                        styles.mediaTypeBtnText,
                        { color: isActive ? "#FFF" : theme.text.primary },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Deste Kaynağı / Kategoriler */}
            <Text style={[styles.sectionHeading, { color: theme.text.secondary, marginTop: 16 }]}>
              NEREDEN SEÇİLSİN?
            </Text>
            <View style={styles.categoriesGrid}>
              {SWIPE_CATEGORIES.map((cat) => {
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

            {/* Tür / Janr Seçimi */}
            <Text style={[styles.sectionHeading, { color: theme.text.secondary, marginTop: 16 }]}>
              TÜR FİLTRESİ
            </Text>
            <View style={styles.genresWrap}>
              {GENRE_OPTIONS.map((genre) => {
                const isSelected = selectedGenreId === genre.id;
                return (
                  <TouchableOpacity
                    key={String(genre.id)}
                    style={[
                      styles.genreChip,
                      {
                        backgroundColor: isSelected
                          ? theme.accent || "#138DF0"
                          : alpha(theme.secondary || "#2C2C2E", 0.5),
                      },
                    ]}
                    onPress={() => {
                      triggerHaptic("selection");
                      setSelectedGenreId(genre.id);
                    }}
                  >
                    <Text
                      style={[
                        styles.genreChipText,
                        { color: isSelected ? "#FFF" : theme.text.secondary },
                      ]}
                    >
                      {genre.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Apply Action Button */}
          <TouchableOpacity
            style={[styles.applyBtn, { backgroundColor: theme.accent || "#138DF0" }]}
            onPress={handleApply}
          >
            <AppIcon family="Ionicons" name="checkmark-circle-outline" size={20} color="#FFF" />
            <Text style={styles.applyBtnText}>Filtreleri Uygula ve Başla</Text>
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
  resetBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  resetText: {
    fontSize: 13,
    fontWeight: "700",
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
  mediaTypeRow: {
    flexDirection: "row",
    gap: 8,
  },
  mediaTypeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  mediaTypeBtnText: {
    fontSize: 13,
    fontWeight: "700",
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
  genresWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  genreChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  genreChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  applyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 50,
    borderRadius: 16,
    gap: 8,
    marginTop: 10,
  },
  applyBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
});
