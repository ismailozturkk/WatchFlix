// components/import/ImportHelpModal.js
//
// Letterboxd ve IMDb'den CSV dışa aktarım adımlarını gösteren görsel yardım alt sayfası.
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
import GlassCloseButton from "../common/GlassCloseButton";
import { alpha } from "../../theme/colors";
import { triggerHaptic } from "../../services/hapticsService";

const { height: SCREEN_H } = Dimensions.get("window");
const SHEET_MAX_H = SCREEN_H * 0.85;

export default function ImportHelpModal({ visible, onClose }) {
  const { theme } = useTheme();
  const sheet = useSheetTransition(visible);
  const [activeTab, setActiveTab] = useState("letterboxd"); // "letterboxd" | "imdb"

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
                <AppIcon
                  family="MaterialCommunityIcons"
                  name="file-import-outline"
                  size={20}
                  color={theme.accent || "#138DF0"}
                />
              </View>
              <Text style={[styles.headerTitle, { color: theme.text.primary }]}>
                Dışa Aktarma Rehberi
              </Text>
            </View>
            <GlassCloseButton
              size={32}
              fallbackRadius={16}
              iconSize={20}
              color={theme.text.secondary}
              backgroundColor="rgba(255,255,255,0.06)"
              hitSlop={12}
              onPress={onClose}
            />
          </View>

          {/* Segmented Tab */}
          <View style={[styles.tabBar, { backgroundColor: alpha(theme.secondary || "#2C2C2E", 0.5) }]}>
            <TouchableOpacity
              style={[
                styles.tabBtn,
                activeTab === "letterboxd" && [
                  styles.tabBtnActive,
                  { backgroundColor: theme.accent || "#138DF0" },
                ],
              ]}
              onPress={() => {
                triggerHaptic("selection");
                setActiveTab("letterboxd");
              }}
            >
              <AppIcon
                family="Ionicons"
                name="film"
                size={16}
                color={activeTab === "letterboxd" ? "#FFF" : theme.text.secondary}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  { color: activeTab === "letterboxd" ? "#FFF" : theme.text.secondary },
                ]}
              >
                Letterboxd
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabBtn,
                activeTab === "imdb" && [
                  styles.tabBtnActive,
                  { backgroundColor: theme.accent || "#138DF0" },
                ],
              ]}
              onPress={() => {
                triggerHaptic("selection");
                setActiveTab("imdb");
              }}
            >
              <AppIcon
                family="Ionicons"
                name="star"
                size={16}
                color={activeTab === "imdb" ? "#FFF" : theme.text.secondary}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  { color: activeTab === "imdb" ? "#FFF" : theme.text.secondary },
                ]}
              >
                IMDb
              </Text>
            </TouchableOpacity>
          </View>

          {/* Guide Steps */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {activeTab === "letterboxd" ? (
              <View style={styles.stepsContainer}>
                {/* Step 1 */}
                <View style={styles.stepCard}>
                  <View style={[styles.stepNumber, { backgroundColor: alpha(theme.accent, 0.18) }]}>
                    <Text style={[styles.stepNumberText, { color: theme.accent }]}>1</Text>
                  </View>
                  <View style={styles.stepTextContent}>
                    <Text style={[styles.stepTitle, { color: theme.text.primary }]}>
                      Ayarlar Menüsüne Gidin
                    </Text>
                    <Text style={[styles.stepBody, { color: theme.text.secondary }]}>
                      Letterboxd web sitesinde profil simgenize tıklayın ve <Text style={{ fontWeight: "700" }}>Settings (Ayarlar)</Text> sayfasına girin.
                    </Text>
                  </View>
                </View>

                {/* Step 2 */}
                <View style={styles.stepCard}>
                  <View style={[styles.stepNumber, { backgroundColor: alpha(theme.accent, 0.18) }]}>
                    <Text style={[styles.stepNumberText, { color: theme.accent }]}>2</Text>
                  </View>
                  <View style={styles.stepTextContent}>
                    <Text style={[styles.stepTitle, { color: theme.text.primary }]}>
                      Export Your Data (Verilerinizi Dışa Aktarın)
                    </Text>
                    <Text style={[styles.stepBody, { color: theme.text.secondary }]}>
                      <Text style={{ fontWeight: "700" }}>Import & Export</Text> sekmesine tıklayın ve <Text style={{ fontWeight: "700" }}>Export Your Data</Text> butonuna basın.
                    </Text>
                  </View>
                </View>

                {/* Step 3 */}
                <View style={styles.stepCard}>
                  <View style={[styles.stepNumber, { backgroundColor: alpha(theme.accent, 0.18) }]}>
                    <Text style={[styles.stepNumberText, { color: theme.accent }]}>3</Text>
                  </View>
                  <View style={styles.stepTextContent}>
                    <Text style={[styles.stepTitle, { color: theme.text.primary }]}>
                      ZIP veya CSV Dosyasını Seçin
                    </Text>
                    <Text style={[styles.stepBody, { color: theme.text.secondary }]}>
                      İndirilen <Text style={{ fontWeight: "700" }}>.zip</Text> dosyasını doğrudan seçebilirsiniz. Uygulama <Text style={{ fontWeight: "700" }}>watched.csv</Text>, <Text style={{ fontWeight: "700" }}>diary.csv</Text>, <Text style={{ fontWeight: "700" }}>ratings.csv</Text> ve <Text style={{ fontWeight: "700" }}>watchlist.csv</Text> dosyalarını otomatik tarar.
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.stepsContainer}>
                {/* Step 1 */}
                <View style={styles.stepCard}>
                  <View style={[styles.stepNumber, { backgroundColor: alpha(theme.accent, 0.18) }]}>
                    <Text style={[styles.stepNumberText, { color: theme.accent }]}>1</Text>
                  </View>
                  <View style={styles.stepTextContent}>
                    <Text style={[styles.stepTitle, { color: theme.text.primary }]}>
                      IMDb Listenize Gidin
                    </Text>
                    <Text style={[styles.stepBody, { color: theme.text.secondary }]}>
                      IMDb web sitesinde <Text style={{ fontWeight: "700" }}>Your Ratings (Puanlarınız)</Text> veya <Text style={{ fontWeight: "700" }}>Your Watchlist</Text> sayfasına gidin.
                    </Text>
                  </View>
                </View>

                {/* Step 2 */}
                <View style={styles.stepCard}>
                  <View style={[styles.stepNumber, { backgroundColor: alpha(theme.accent, 0.18) }]}>
                    <Text style={[styles.stepNumberText, { color: theme.accent }]}>2</Text>
                  </View>
                  <View style={styles.stepTextContent}>
                    <Text style={[styles.stepTitle, { color: theme.text.primary }]}>
                      Dışa Aktar (Export) Butonuna Tıklayın
                    </Text>
                    <Text style={[styles.stepBody, { color: theme.text.secondary }]}>
                      Listenin sağ üst köşesindeki üç nokta menüsünden veya sayfa sonundaki <Text style={{ fontWeight: "700" }}>Export</Text> seçeneğine tıklayın.
                    </Text>
                  </View>
                </View>

                {/* Step 3 */}
                <View style={styles.stepCard}>
                  <View style={[styles.stepNumber, { backgroundColor: alpha(theme.accent, 0.18) }]}>
                    <Text style={[styles.stepNumberText, { color: theme.accent }]}>3</Text>
                  </View>
                  <View style={styles.stepTextContent}>
                    <Text style={[styles.stepTitle, { color: theme.text.primary }]}>
                      Seelogd'a Yükleyin
                    </Text>
                    <Text style={[styles.stepBody, { color: theme.text.secondary }]}>
                      İnen <Text style={{ fontWeight: "700" }}>ratings.csv</Text> dosyasını "Dosyalardan Seç" butonuna dokunarak doğrudan seçin.
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Quick Tip Box */}
            <View style={[styles.tipBox, { backgroundColor: alpha(theme.accent, 0.1), borderColor: alpha(theme.accent, 0.3) }]}>
              <AppIcon family="Ionicons" name="bulb-outline" size={20} color={theme.accent} />
              <Text style={[styles.tipText, { color: theme.text.secondary }]}>
                <Text style={{ fontWeight: "800", color: theme.accent }}>İpucu: </Text>
                CSV dosyanızı doğrudan telefonunuza indirip "Dosyalardan Seç" butonuna tıklayarak saniyeler içinde içe aktarabilirsiniz.
              </Text>
            </View>
          </ScrollView>
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
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  tabBar: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
    marginVertical: 12,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  tabBtnActive: {
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  scrollArea: {
    marginTop: 4,
  },
  scrollContent: {
    paddingVertical: 8,
  },
  stepsContainer: {
    gap: 12,
    marginBottom: 16,
  },
  stepCard: {
    flexDirection: "row",
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.03)",
    gap: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: {
    fontSize: 13,
    fontWeight: "800",
  },
  stepTextContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  stepBody: {
    fontSize: 12,
    lineHeight: 17,
  },
  tipBox: {
    flexDirection: "row",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    alignItems: "center",
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
});
