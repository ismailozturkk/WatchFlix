import React, { useState, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  Animated,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLanguage } from "../../context/LanguageContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../../context/ThemeContext";
import LottieView from "lottie-react-native";
import SettingsTheme from "./setting/SettingsTheme";
import { useSnow } from "../../context/SnowContext";
import { LinearGradient } from "expo-linear-gradient";
import { useAppSettings } from "../../context/AppSettingsContext";
import SwitchToggle from "../../modules/SwitchToggle";
import SwipeCard from "../../modules/SwipeCard";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import CountryFlag from "react-native-country-flag";
import IconBacground from "../../components/IconBacground";
const LANGUAGES = [
  { code: "tr", name: "Türkçe", nativeName: "Türkçe", flag: "tr" },
  { code: "en", name: "English", nativeName: "English", flag: "us" },
  // İleride daha fazla dil eklenebilir:
  // { code: "de", name: "German", nativeName: "Deutsch", flag: "de" },
  // { code: "fr", name: "French", nativeName: "Français", flag: "fr" },
  // { code: "es", name: "Spanish", nativeName: "Español", flag: "es" },
];

const IMAGE_QUALITIES = [
  { label: "Düşük", value: "low", icon: "image-outline" },
  { label: "Orta", value: "medium", icon: "image" },
  { label: "İyi", value: "good", icon: "image" },
  { label: "Çok İyi", value: "high", icon: "images-outline" },
  { label: "Orijinal", value: "original", icon: "diamond-outline" },
];

export default function SettingsScreen() {
  const [enabled, setEnabled] = useState(false);
  //const { showSnow, changeShowSnow } = useSnow();
  const { t, language, toggleLanguage } = useLanguage();
  const { theme } = useTheme();
  const [notifications, setNotifications] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [langSearch, setLangSearch] = useState("");
  const {
    chaneAdultContent,
    adultContent,
    showSnow,
    changeShowSnow,
    imageQuality,
    imageQualityLevel,
    changeImageQuality,
  } = useAppSettings();

  const filteredLanguages = LANGUAGES.filter(
    (lang) =>
      lang.name.toLowerCase().includes(langSearch.toLowerCase()) ||
      lang.nativeName.toLowerCase().includes(langSearch.toLowerCase()),
  );

  const currentLang =
    LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  const handleClearCache = async () => {
    try {
      await AsyncStorage.clear();
      Alert.alert(t.success, t.cacheCleared);
    } catch (error) {
      Alert.alert(t.error, t.errorClearingCache);
    }
  };

  const handleSelectLanguage = (langCode) => {
    toggleLanguage(langCode);
    setLangModalVisible(false);
    setLangSearch("");
  };

  return (
    <View style={[{ backgroundColor: theme.primary, flex: 1 }]}>
      <IconBacground opacity={0.3} />
      <ScrollView
        style={[styles.container, { backgroundColor: "transparent" }]}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {showSnow && (
          <>
            <LottieView
              style={styles.lottie}
              source={require("../../LottieJson/snow.json")}
              autoPlay={true}
              loop
            />
            <LottieView
              style={styles.lottie1}
              source={require("../../LottieJson/snow.json")}
              autoPlay={true}
              loop
            />
          </>
        )}
        <Text
          allowFontScaling={false}
          style={[styles.title, { color: theme.text.primary }]}
        >
          {t.settings}
        </Text>

        <View style={styles.section}>
          <Text
            allowFontScaling={false}
            style={[styles.sectionTitle, { color: theme.text.muted }]}
          >
            {t.language}
          </Text>
          <TouchableOpacity
            style={[
              styles.langCard,
              {
                backgroundColor: theme.secondary,
                borderColor: theme.border,
                shadowColor: theme.shadow,
              },
            ]}
            onPress={() => {
              setLangSearch("");
              setLangModalVisible(true);
            }}
            activeOpacity={0.75}
          >
            <View style={styles.langCardLeft}>
              <View
                style={[
                  styles.langCardIconWrap,
                  { backgroundColor: theme.notesColor.blueBackground },
                ]}
              >
                <Ionicons
                  name="language-outline"
                  size={22}
                  color={theme.notesColor.blue}
                />
              </View>
              <View style={{ gap: 2 }}>
                <Text
                  allowFontScaling={false}
                  style={[styles.langCardSubLabel, { color: theme.text.muted }]}
                >
                  {t.language}
                </Text>
                <Text
                  allowFontScaling={false}
                  style={[styles.langCardValue, { color: theme.text.primary }]}
                >
                  {currentLang.nativeName}
                </Text>
              </View>
            </View>
            <View style={styles.langCardRight}>
              <View
                style={[styles.langFlagWrap, { borderColor: theme.border }]}
              >
                <CountryFlag
                  isoCode={currentLang.flag}
                  size={28}
                  style={{ borderRadius: 6 }}
                />
              </View>
              <View
                style={[
                  styles.langChevronWrap,
                  { backgroundColor: theme.primary },
                ]}
              >
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={theme.text.muted}
                />
              </View>
            </View>
          </TouchableOpacity>
        </View>
        <View style={styles.section}>
          <Text
            allowFontScaling={false}
            style={[styles.sectionTitle, { color: theme.text.muted }]}
          >
            {t.theme}
          </Text>
          <SettingsTheme />
        </View>
        <View style={styles.section}>
          <Text
            allowFontScaling={false}
            style={[styles.sectionTitle, { color: theme.text.muted }]}
          >
            {t.content}
          </Text>
          <View
            style={[
              styles.context,
              {
                backgroundColor: theme.secondary,
                borderColor: theme.border,
                shadowColor: theme.shadow,
              },
            ]}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 15,
              }}
            >
              <Ionicons
                name={"snow-sharp"}
                size={24}
                color={theme.text.primary}
              />
              <Text
                allowFontScaling={false}
                style={[styles.settingText, { color: theme.text.primary }]}
              >
                {t.snow}
              </Text>
            </View>
            <View>
              <SwitchToggle
                value={showSnow}
                onValueChange={changeShowSnow}
                size={36}
              />
            </View>
          </View>
          <View
            style={[
              styles.context,
              {
                backgroundColor: theme.secondary,
                borderColor: theme.border,
                shadowColor: theme.shadow,
              },
            ]}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 15,
              }}
            >
              <MaterialCommunityIcons
                name="database-arrow-down"
                size={24}
                color={theme.text.primary}
              />

              <Text
                allowFontScaling={false}
                style={[styles.settingText, { color: theme.text.primary }]}
              >
                Verileri İndir
              </Text>
            </View>
            <View>
              <SwitchToggle
                value={() => {}}
                onValueChange={() => {}}
                size={36}
              />
            </View>
          </View>
          {/* Poster Kalitesi Seçici */}
          <View
            style={[
              styles.qualityCard,
              {
                backgroundColor: theme.secondary,
                borderColor: theme.border,
                shadowColor: theme.shadow,
              },
            ]}
          >
            <View style={styles.qualityHeader}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <MaterialIcons
                  name="high-quality"
                  size={24}
                  color={theme.text.primary}
                />
                <View>
                  <Text
                    allowFontScaling={false}
                    style={[styles.settingText, { color: theme.text.primary }]}
                  >
                    Poster Kalitesi
                  </Text>
                  <Text
                    allowFontScaling={false}
                    style={[styles.qualitySubText, { color: theme.text.muted }]}
                  >
                    {
                      IMAGE_QUALITIES.find((q) => q.value === imageQualityLevel)
                        ?.label
                    }{" "}
                    · poster:{imageQuality.poster} · backdrop:
                    {imageQuality.backdrop}
                  </Text>
                </View>
              </View>
            </View>

            {/* Segmented Selector */}
            <View
              style={[
                styles.qualitySegment,
                { backgroundColor: theme.primary, borderColor: theme.border },
              ]}
            >
              {IMAGE_QUALITIES.map((q, index) => {
                const isSelected = imageQualityLevel === q.value;
                return (
                  <TouchableOpacity
                    key={q.value}
                    style={[
                      styles.qualityOption,
                      {
                        backgroundColor: isSelected
                          ? theme.accent
                          : "transparent",
                        borderRadius: 10,
                      },
                    ]}
                    onPress={() => changeImageQuality(q.value)}
                    activeOpacity={0.7}
                  >
                    <Text
                      allowFontScaling={false}
                      style={[
                        styles.qualityOptionText,
                        {
                          color: isSelected ? "#fff" : theme.text.muted,
                          fontWeight: isSelected ? "700" : "400",
                        },
                      ]}
                    >
                      {q.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Progress dots */}
            <View style={styles.qualityDots}>
              {IMAGE_QUALITIES.map((q) => (
                <View
                  key={q.value}
                  style={[
                    styles.qualityDot,
                    {
                      backgroundColor:
                        imageQualityLevel === q.value
                          ? theme.accent
                          : theme.border,
                      width: imageQualityLevel === q.value ? 18 : 6,
                    },
                  ]}
                />
              ))}
            </View>
          </View>
          <View
            style={[
              styles.context,
              {
                backgroundColor: theme.secondary,
                borderColor: theme.border,
                shadowColor: theme.shadow,
              },
            ]}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 15,
              }}
            >
              <Ionicons name={"eye-off"} size={24} color={theme.text.primary} />
              <Text
                allowFontScaling={false}
                style={[styles.settingText, { color: theme.text.primary }]}
              >
                {t.adultContent}
              </Text>
            </View>
            <View>
              <SwitchToggle
                value={adultContent}
                onValueChange={() => chaneAdultContent(!adultContent)}
                size={36}
              />
            </View>
          </View>
          <View
            style={[
              styles.context,
              {
                backgroundColor: theme.secondary,
                borderColor: theme.border,
                shadowColor: theme.shadow,
              },
            ]}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 15,
              }}
            >
              <Ionicons
                name={"notifications"}
                size={24}
                color={theme.text.primary}
              />
              <Text
                allowFontScaling={false}
                style={[styles.settingText, { color: theme.text.primary }]}
              >
                {t.notifications}
              </Text>
            </View>
            <View>
              <SwitchToggle
                value={notifications}
                onValueChange={setNotifications}
                size={36}
                disabled={true}
              />
            </View>
          </View>
        </View>
        <View style={styles.section}>
          <Text
            allowFontScaling={false}
            style={[styles.sectionTitle, { color: theme.text.muted }]}
          >
            {t.data}
          </Text>
          <TouchableOpacity
            style={[
              styles.context,
              {
                backgroundColor: theme.secondary,
                borderColor: theme.border,
                shadowColor: theme.shadow,
                justifyContent: "center",
              },
            ]}
            onPress={() => setModalVisible(true)}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 15,
              }}
            >
              <Ionicons name={"trash-outline"} size={24} color={"red"} />
              <Text
                allowFontScaling={false}
                style={[styles.settingText, { color: theme.text.primary }]}
              >
                {t.clearCache}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
        <SwipeCard>
          <View style={styles.section}>
            <Text
              allowFontScaling={false}
              style={[styles.sectionTitle, { color: theme.text.muted }]}
            >
              {t.about}
            </Text>
            <View
              style={[
                styles.context,
                {
                  backgroundColor: theme.secondary,
                  borderColor: theme.border,
                  shadowColor: theme.shadow,
                  justifyContent: "center",
                  flexDirection: "column",
                  gap: 5,
                },
              ]}
            >
              <Text
                allowFontScaling={false}
                style={[styles.version, { color: theme.text.primary }]}
              >
                Watch Flix {"     "}Version: 1.1.0
              </Text>

              <Text
                allowFontScaling={false}
                style={[styles.copyright, { color: theme.text.secondary }]}
              >
                Veriler TMDB API'sinden alınmıştır.
              </Text>
              <Text
                allowFontScaling={false}
                style={[styles.copyright, { color: theme.text.secondary }]}
              >
                created by ismail ozturk{" "}
              </Text>
              <Text
                allowFontScaling={false}
                style={[styles.copyright, { color: theme.text.secondary }]}
              >
                © 2025 Watch Flix
              </Text>
            </View>
          </View>
        </SwipeCard>

        {/* Cache Temizle Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <TouchableOpacity
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
              onPress={() => setModalVisible(false)}
            />
            <BlurView
              tint="dark"
              intensity={50}
              experimentalBlurMethod="dimezisBlurView"
              style={StyleSheet.absoluteFill}
            />

            <View
              style={[styles.modalView, { backgroundColor: theme.primary }]}
            >
              <Text
                allowFontScaling={false}
                style={[styles.modalText, { color: theme.text.primary }]}
              >
                {t.clearCacheMessage}
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.button, styles.buttonCancel]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text allowFontScaling={false} style={styles.textStyle}>
                    {t.cancel}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.buttonConfirm]}
                  onPress={() => {
                    handleClearCache();
                    setModalVisible(false);
                  }}
                >
                  <Text allowFontScaling={false} style={styles.textStyle}>
                    {t.confirm}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Dil Seçim Modal - Bottom Sheet */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={langModalVisible}
          onRequestClose={() => {
            setLangModalVisible(false);
            setLangSearch("");
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
          >
            <View style={styles.langModalOverlay}>
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                activeOpacity={1}
                onPress={() => {
                  setLangModalVisible(false);
                  setLangSearch("");
                }}
              />
              <BlurView
                tint="dark"
                intensity={40}
                experimentalBlurMethod="dimezisBlurView"
                style={StyleSheet.absoluteFill}
              />

              <View
                style={[
                  styles.langModalSheet,
                  {
                    backgroundColor: theme.secondary,
                    borderColor: theme.border,
                  },
                ]}
              >
                {/* Handle Bar */}
                <View style={styles.langHandleBar} />

                {/* Başlık */}
                <View style={styles.langModalHeader}>
                  <View style={styles.langModalTitleRow}>
                    <Ionicons
                      name="language-outline"
                      size={22}
                      color={theme.text.primary}
                    />
                    <Text
                      allowFontScaling={false}
                      style={[
                        styles.langModalTitle,
                        { color: theme.text.primary },
                      ]}
                    >
                      {t.language}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setLangModalVisible(false);
                      setLangSearch("");
                    }}
                    style={[
                      styles.langCloseBtn,
                      { backgroundColor: theme.primary },
                    ]}
                  >
                    <Ionicons name="close" size={18} color={theme.text.muted} />
                  </TouchableOpacity>
                </View>

                {/* Arama */}
                <View
                  style={[
                    styles.langSearchBox,
                    {
                      backgroundColor: theme.primary,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Ionicons
                    name="search-outline"
                    size={18}
                    color={theme.text.muted}
                  />
                  <TextInput
                    allowFontScaling={false}
                    style={[
                      styles.langSearchInput,
                      { color: theme.text.primary },
                    ]}
                    placeholder="Dil ara..."
                    placeholderTextColor={theme.text.muted}
                    value={langSearch}
                    onChangeText={setLangSearch}
                    autoCorrect={false}
                    autoCapitalize="none"
                  />
                  {langSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setLangSearch("")}>
                      <Ionicons
                        name="close-circle"
                        size={18}
                        color={theme.text.muted}
                      />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Dil Listesi */}
                <FlatList
                  data={filteredLanguages}
                  keyExtractor={(item) => item.code}
                  style={{ maxHeight: 320 }}
                  showsVerticalScrollIndicator={false}
                  ListEmptyComponent={
                    <View style={styles.langEmptyContainer}>
                      <Ionicons
                        name="search-outline"
                        size={32}
                        color={theme.text.muted}
                      />
                      <Text
                        allowFontScaling={false}
                        style={[
                          styles.langEmptyText,
                          { color: theme.text.muted },
                        ]}
                      >
                        Dil bulunamadı
                      </Text>
                    </View>
                  }
                  renderItem={({ item }) => {
                    const isSelected = item.code === language;
                    return (
                      <TouchableOpacity
                        style={[
                          styles.langItem,
                          {
                            backgroundColor: isSelected
                              ? theme.accent + "22"
                              : "transparent",
                            borderColor: isSelected
                              ? theme.accent
                              : "transparent",
                          },
                        ]}
                        onPress={() => handleSelectLanguage(item.code)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.langItemLeft}>
                          <CountryFlag
                            isoCode={item.flag}
                            size={30}
                            style={{ borderRadius: 6 }}
                          />
                          <View style={styles.langItemTextGroup}>
                            <Text
                              allowFontScaling={false}
                              style={[
                                styles.langItemName,
                                {
                                  color: isSelected
                                    ? theme.accent
                                    : theme.text.primary,
                                  fontWeight: isSelected ? "700" : "500",
                                },
                              ]}
                            >
                              {item.nativeName}
                            </Text>
                            <Text
                              allowFontScaling={false}
                              style={[
                                styles.langItemSub,
                                { color: theme.text.muted },
                              ]}
                            >
                              {item.name}
                            </Text>
                          </View>
                        </View>
                        {isSelected && (
                          <Ionicons
                            name="checkmark-circle"
                            size={22}
                            color={theme.accent}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  }}
                />
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 15,
  },
  contentContainer: {
    paddingBottom: 100,
  },
  lottie: {
    position: "absolute",
    top: 0,
    height: 1000,
    left: -60,
    right: -60,
    zIndex: 0,
  },
  lottie1: {
    position: "absolute",
    top: 1000,
    height: 1000,
    left: -60,
    right: -60,
    zIndex: 0,
  },
  title: {
    fontSize: 24,
    textAlign: "center",
    fontWeight: "bold",
    marginTop: 40,
    marginBottom: 20,
  },
  section: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    marginBottom: 10,
    marginLeft: 10,
    textTransform: "uppercase",
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
  },
  settingText: {
    fontSize: 16,
  },
  languageButton: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 15,
  },
  languageButtonText: {
    color: "white",
    fontWeight: "bold",
  },
  langCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
  },
  langCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },
  langCardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  langCardSubLabel: {
    fontSize: 11,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  langCardValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  langCardRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  langFlagWrap: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
  },
  langChevronWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  context: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 15,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 15,
    marginBottom: 8,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
  },
  // Poster Kalitesi Stiller
  qualityCard: {
    borderRadius: 15,
    marginBottom: 8,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
    gap: 12,
  },
  qualityHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  qualitySubText: {
    fontSize: 11,
    marginTop: 2,
  },
  qualitySegment: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    gap: 2,
  },
  qualityOption: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  qualityOptionText: {
    fontSize: 12,
    textAlign: "center",
  },
  qualityDots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  qualityDot: {
    height: 6,
    borderRadius: 3,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  // Dil Modal Stilleri
  langModalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  langModalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 16,
    paddingBottom: 30,
    paddingTop: 12,
  },
  langHandleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#555",
    alignSelf: "center",
    marginBottom: 16,
  },
  langModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  langModalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  langModalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  langCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  langSearchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  langSearchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  langItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 8,
  },
  langItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  langItemTextGroup: {
    gap: 2,
  },
  langItemName: {
    fontSize: 15,
  },
  langItemSub: {
    fontSize: 12,
  },
  langEmptyContainer: {
    alignItems: "center",
    paddingVertical: 30,
    gap: 10,
  },
  langEmptyText: {
    fontSize: 14,
  },
  modalView: {
    margin: 20,
    borderRadius: 20,
    padding: 35,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalText: {
    marginBottom: 15,
    textAlign: "center",
    fontSize: 18,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  button: {
    borderRadius: 20,
    padding: 10,
    elevation: 2,
    width: "45%",
    alignItems: "center",
  },
  buttonCancel: {
    backgroundColor: "#f44336",
  },
  buttonConfirm: {
    backgroundColor: "#4CAF50",
  },
  textStyle: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center",
  },
});
