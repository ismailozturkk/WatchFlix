// components/storyShare/StoryExportModal.js
//
// Estetik sinema hikaye kartlarını şablon seçerek özelleştirme ve
// tek tıkla Instagram Story / WhatsApp / Galeriye dışa aktarma alt sayfası (bottom sheet).
// Yerinde solan Blur arka planı (useSheetTransition + ModalBlurBackdrop).

import React, { useState, useRef } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
} from "react-native";
import AppIcon from "../AppIcon";
import ModalBlurBackdrop from "../common/ModalBlurBackdrop";
import useSheetTransition from "../../hooks/useSheetTransition";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { alpha } from "../../theme/colors";
import { captureStoryCard, shareStoryImage, saveStoryToGallery } from "../../services/storyShare/storyShareService";
import StoryTemplateTicket from "./StoryTemplateTicket";
import StoryTemplateGlass from "./StoryTemplateGlass";
import StoryTemplatePolaroid from "./StoryTemplatePolaroid";
import StoryTemplateTop4 from "./StoryTemplateTop4";
import { triggerHaptic } from "../../services/hapticsService";
import Toast from "react-native-toast-message";

const { height: SCREEN_H } = Dimensions.get("window");
const SHEET_MAX_H = SCREEN_H * 0.90;

const TEMPLATES = [
  { id: "ticket", name: "Bilet", icon: "ticket-outline" },
  { id: "glass", name: "Neon Cam", icon: "sparkles-outline" },
  { id: "polaroid", name: "Polaroid", icon: "camera-outline" },
  { id: "top4", name: "Top 4", icon: "grid-outline" },
];

export default function StoryExportModal({
  visible,
  onClose,
  media,
  userRating,
  topMovies = [],
}) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const sheet = useSheetTransition(visible);
  const cardRef = useRef(null);

  const [selectedTemplate, setSelectedTemplate] = useState("ticket");
  const [userNote, setUserNote] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  // Paylaşım fonksiyonu
  const handleShare = async () => {
    if (!cardRef.current || isExporting) return;
    setIsExporting(true);
    triggerHaptic("impact");

    try {
      const uri = await captureStoryCard(cardRef);
      await shareStoryImage(uri);
      triggerHaptic("notification");
      onClose();
    } catch (e) {
      Toast.show({
        type: "error",
        text1: "Paylaşım açılamadı",
        text2: e.message || "Bilinmeyen bir hata oluştu.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Galeriye kaydetme
  const handleSaveToGallery = async () => {
    if (!cardRef.current || isExporting) return;
    setIsExporting(true);
    triggerHaptic("impact");

    try {
      const uri = await captureStoryCard(cardRef);
      await saveStoryToGallery(uri);
      triggerHaptic("notification");
      Toast.show({
        type: "success",
        text1: "Galeriye Kaydedildi!",
        text2: "Kart fotoğraf albümünüze eklendi.",
      });
    } catch (e) {
      Toast.show({
        type: "error",
        text1: "Kaydedilemedi",
        text2: e.message || "İzin verilmedi.",
      });
    } finally {
      setIsExporting(false);
    }
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
          <ModalBlurBackdrop intensity={38} />
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
                <AppIcon family="Ionicons" name="share-social" size={18} color={theme.accent || "#138DF0"} />
              </View>
              <Text style={[styles.headerTitle, { color: theme.text.primary }]}>
                Hikayede Paylaş
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <AppIcon family="Ionicons" name="close" size={20} color={theme.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Template Tabs */}
          <View style={[styles.templateTabBar, { backgroundColor: alpha(theme.secondary || "#2C2C2E", 0.5) }]}>
            {TEMPLATES.map((tpl) => {
              const isActive = selectedTemplate === tpl.id;
              return (
                <TouchableOpacity
                  key={tpl.id}
                  style={[
                    styles.templateTabBtn,
                    isActive && [
                      styles.templateTabBtnActive,
                      { backgroundColor: theme.accent || "#138DF0" },
                    ],
                  ]}
                  onPress={() => {
                    triggerHaptic("selection");
                    setSelectedTemplate(tpl.id);
                  }}
                >
                  <AppIcon
                    family="Ionicons"
                    name={tpl.icon}
                    size={15}
                    color={isActive ? "#FFF" : theme.text.secondary}
                  />
                  <Text
                    style={[
                      styles.templateTabText,
                      { color: isActive ? "#FFF" : theme.text.secondary },
                    ]}
                  >
                    {tpl.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Card Preview Container */}
          <ScrollView
            style={styles.previewScroll}
            contentContainerStyle={styles.previewScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View collapsable={false} ref={cardRef} style={styles.cardAnchor}>
              {selectedTemplate === "ticket" && (
                <StoryTemplateTicket
                  media={media}
                  userRating={userRating}
                  userNote={userNote}
                  theme={theme}
                />
              )}
              {selectedTemplate === "glass" && (
                <StoryTemplateGlass
                  media={media}
                  userRating={userRating}
                  userNote={userNote}
                  theme={theme}
                />
              )}
              {selectedTemplate === "polaroid" && (
                <StoryTemplatePolaroid
                  media={media}
                  userRating={userRating}
                  userNote={userNote}
                />
              )}
              {selectedTemplate === "top4" && (
                <StoryTemplateTop4
                  user={user}
                  topMovies={topMovies}
                  theme={theme}
                />
              )}
            </View>

            {/* Custom Quote/Note Input */}
            {selectedTemplate !== "top4" && (
              <View style={[styles.noteInputBox, { borderColor: theme.border || "#444", backgroundColor: alpha(theme.secondary || "#2C2C2E", 0.4) }]}>
                <TextInput
                  style={[styles.noteInput, { color: theme.text.primary }]}
                  placeholder="Karta özel not veya alıntı ekle..."
                  placeholderTextColor={theme.text.muted}
                  value={userNote}
                  onChangeText={setUserNote}
                  maxLength={90}
                />
              </View>
            )}
          </ScrollView>

          {/* Bottom Actions */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[
                styles.saveBtn,
                { backgroundColor: alpha(theme.secondary || "#333", 0.7) },
              ]}
              onPress={handleSaveToGallery}
              disabled={isExporting}
            >
              <AppIcon family="Ionicons" name="download-outline" size={20} color={theme.text.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.shareMainBtn,
                { backgroundColor: theme.accent || "#138DF0" },
              ]}
              onPress={handleShare}
              disabled={isExporting}
              activeOpacity={0.88}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <AppIcon family="Ionicons" name="logo-instagram" size={20} color="#FFF" />
                  <Text style={styles.shareMainBtnText}>Hikayede Paylaş</Text>
                </>
              )}
            </TouchableOpacity>
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
    fontSize: 16,
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
  templateTabBar: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
    marginVertical: 12,
  },
  templateTabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
    gap: 5,
  },
  templateTabBtnActive: {
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  templateTabText: {
    fontSize: 12,
    fontWeight: "700",
  },
  previewScroll: {
    maxHeight: 460,
  },
  previewScrollContent: {
    alignItems: "center",
    paddingVertical: 8,
  },
  cardAnchor: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  noteInputBox: {
    width: 310,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
  },
  noteInput: {
    fontSize: 12,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  },
  saveBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  shareMainBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    borderRadius: 14,
    gap: 8,
  },
  shareMainBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
