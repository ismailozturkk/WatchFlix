import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
  Modal,
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

export default function SettingsScreen() {
  const [enabled, setEnabled] = useState(false);
  //const { showSnow, changeShowSnow } = useSnow();
  const { t, language, toggleLanguage } = useLanguage();
  const { theme } = useTheme();
  const [notifications, setNotifications] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const { chaneAdultContent, adultContent, showSnow, changeShowSnow } =
    useAppSettings();
  const handleClearCache = async () => {
    try {
      await AsyncStorage.clear();
      Alert.alert(t.success, t.cacheCleared);
    } catch (error) {
      Alert.alert(t.error, t.errorClearingCache);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.primary }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <LottieView
        style={[styles.lottie, { display: showSnow ? "flex" : "none" }]}
        source={require("../../LottieJson/snow.json")}
        autoPlay={true}
        loop
      />
      <LottieView
        style={[styles.lottie1, { display: showSnow ? "flex" : "none" }]}
        source={require("../../LottieJson/snow.json")}
        autoPlay={true}
        loop
      />
      <Text style={[styles.title, { color: theme.text.primary }]}>
        {t.settings}
      </Text>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text.muted }]}>
          {t.general}
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
          activeOpacity={0.8}
        >
          <View style={styles.settingLeft}>
            <Ionicons
              name={"language-outline"}
              size={24}
              color={theme.text.primary}
            />
            <Text style={[styles.settingText, { color: theme.text.primary }]}>
              {t.language}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.languageButton, { backgroundColor: theme.accent }]}
            onPress={() => toggleLanguage(language === "tr" ? "en" : "tr")}
          >
            <Text style={styles.languageButtonText}>
              {language.toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text.muted }]}>
          {t.theme}
        </Text>
        <SettingsTheme />
      </View>
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text.muted }]}>
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
            <Text style={[styles.settingText, { color: theme.text.primary }]}>
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

            <Text style={[styles.settingText, { color: theme.text.primary }]}>
              Verileri Çevrimdışı Kullanmak için İndir
            </Text>
          </View>
          <View>
            <SwitchToggle value={() => {}} onValueChange={() => {}} size={36} />
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
            <MaterialIcons
              name="data-saver-on"
              size={24}
              color={theme.text.primary}
            />

            <Text style={[styles.settingText, { color: theme.text.primary }]}>
              Düşük Veri Modu
            </Text>
          </View>
          <View>
            <SwitchToggle value={() => {}} onValueChange={() => {}} size={36} />
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
              name={"eye-off-outline"}
              size={24}
              color={theme.text.primary}
            />
            <Text style={[styles.settingText, { color: theme.text.primary }]}>
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
              name={"notifications-outline"}
              size={24}
              color={theme.text.primary}
            />
            <Text style={[styles.settingText, { color: theme.text.primary }]}>
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
        <Text style={[styles.sectionTitle, { color: theme.text.muted }]}>
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
            <Text style={[styles.settingText, { color: theme.text.primary }]}>
              {t.clearCache}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
      <SwipeCard>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text.muted }]}>
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
            <Text style={[styles.version, { color: theme.text.primary }]}>
              Watch Flix {"     "}Version: 1.0.1
            </Text>

            <Text style={[styles.copyright, { color: theme.text.secondary }]}>
              Veriler TMDB API'sinden alınmıştır.
            </Text>
            <Text style={[styles.copyright, { color: theme.text.secondary }]}>
              © 2025 Watch Flix
            </Text>
          </View>
        </View>
      </SwipeCard>

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
          <LinearGradient
            colors={["transparent", theme.shadow, "transparent"]}
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              left: 0,
              bottom: 0,
              zIndex: -1,
            }}
          />
          <View style={[styles.modalView, { backgroundColor: theme.primary }]}>
            <Text style={[styles.modalText, { color: theme.text.primary }]}>
              {t.clearCacheMessage}
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.buttonCancel]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.textStyle}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.buttonConfirm]}
                onPress={() => {
                  handleClearCache();
                  setModalVisible(false);
                }}
              >
                <Text style={styles.textStyle}>{t.confirm}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
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
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
