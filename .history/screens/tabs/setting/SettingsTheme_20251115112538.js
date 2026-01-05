import React from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useLanguage } from "../../../context/LanguageContext";
import { useTheme } from "../../../context/ThemeContext";
export default function SettingsTheme() {
  const { t } = useLanguage();

  const { selectedTheme, changeTheme, theme } = useTheme();
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.secondary,
          borderColor: theme.border,
          shadowColor: theme.shdow,
        },
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.themeContainer}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          style={[
            styles.themeOption,
            styles.darkTheme,
            selectedTheme === "dark" && styles.selectedTheme,
          ]}
          onPress={() => changeTheme("dark")}
          activeOpacity={0.8}
        >
          <View style={styles.themePreview}>
            <View style={styles.themeHeader}>
              <View style={[styles.themeDot, { backgroundColor: "#2196F3" }]} />
              <View style={styles.themeDot} />
            </View>
            <View style={styles.themeContent}>
              <View style={[styles.themeBar, { width: "60%" }]} />
              <View style={[styles.themeBar, { width: "80%" }]} />
              <View style={[styles.themeBar, { width: "40%" }]} />
            </View>
          </View>
          <Text style={styles.themeText}>{t.darkTheme}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.themeOption,
            styles.grayTheme,
            selectedTheme === "gray" && styles.selectedTheme,
          ]}
          onPress={() => changeTheme("gray")}
          activeOpacity={0.8}
        >
          <View style={styles.themePreview}>
            <View style={styles.themeHeader}>
              <View style={[styles.themeDot, { backgroundColor: "#2196F3" }]} />
              <View style={[styles.themeDot, { backgroundColor: "#bababa" }]} />
            </View>
            <View style={styles.themeContent}>
              <View
                style={[
                  styles.themeBar,
                  { width: "60%", backgroundColor: "#bababa" },
                ]}
              />
              <View
                style={[
                  styles.themeBar,
                  { width: "80%", backgroundColor: "#bababa" },
                ]}
              />
              <View
                style={[
                  styles.themeBar,
                  { width: "40%", backgroundColor: "#bababa" },
                ]}
              />
            </View>
          </View>
          <Text style={[styles.themeText, { color: "#bababa" }]}>
            {t.grayTheme}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.themeOption,
            styles.blueTheme,
            selectedTheme === "blue" && styles.selectedTheme,
          ]}
          onPress={() => changeTheme("blue")}
          activeOpacity={0.8}
        >
          <View style={styles.themePreview}>
            <View style={styles.themeHeader}>
              <View
                style={[
                  styles.themeDot,
                  { backgroundColor: "rgb(20, 28, 51)" },
                ]}
              />
              <View
                style={[
                  styles.themeDot,
                  { backgroundColor: "rgb(83, 116, 172)" },
                ]}
              />
            </View>
            <View style={styles.themeContent}>
              <View
                style={[
                  styles.themeBar,
                  { width: "60%", backgroundColor: "rgb(47, 69, 111)" },
                ]}
              />
              <View
                style={[
                  styles.themeBar,
                  { width: "80%", backgroundColor: "rgb(83, 116, 172)" },
                ]}
              />
              <View
                style={[
                  styles.themeBar,
                  { width: "40%", backgroundColor: "rgb(83, 116, 172)" },
                ]}
              />
            </View>
          </View>
          <Text style={[styles.themeText, { color: "rgb(239, 245, 250)" }]}>
            {t.blueTheme}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.themeOption,
            styles.greenTheme,
            selectedTheme === "green" && styles.selectedTheme,
          ]}
          onPress={() => changeTheme("green")}
          activeOpacity={0.8}
        >
          <View style={styles.themePreview}>
            <View style={styles.themeHeader}>
              <View
                style={[
                  styles.themeDot,
                  { backgroundColor: "rgb(77, 199, 184)" },
                ]}
              />
              <View
                style={[
                  styles.themeDot,
                  { backgroundColor: "rgb(58, 158, 161)" },
                ]}
              />
            </View>
            <View style={styles.themeContent}>
              <View
                style={[
                  styles.themeBar,
                  {
                    width: "60%",
                    backgroundColor: "rgb(169,189,187)",
                  },
                ]}
              />
              <View
                style={[
                  styles.themeBar,
                  {
                    width: "80%",
                    backgroundColor: "rgb(169,189,187)",
                  },
                ]}
              />
              <View
                style={[
                  styles.themeBar,
                  {
                    width: "40%",
                    backgroundColor: "rgb(169,189,187)",
                  },
                ]}
              />
            </View>
          </View>
          <Text style={[styles.themeText, { color: "rgb(28, 79, 78)" }]}>
            {t.greenTheme}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.themeOption,
            styles.lightTheme,
            selectedTheme === "light" && styles.selectedTheme,
          ]}
          onPress={() => changeTheme("light")}
          activeOpacity={0.8}
        >
          <View style={styles.themePreview}>
            <View style={styles.themeHeader}>
              <View style={[styles.themeDot, { backgroundColor: "#2196F3" }]} />
              <View style={[styles.themeDot, { backgroundColor: "#444" }]} />
            </View>
            <View style={styles.themeContent}>
              <View
                style={[
                  styles.themeBar,
                  { width: "60%", backgroundColor: "#444" },
                ]}
              />
              <View
                style={[
                  styles.themeBar,
                  { width: "80%", backgroundColor: "#444" },
                ]}
              />
              <View
                style={[
                  styles.themeBar,
                  { width: "40%", backgroundColor: "#444" },
                ]}
              />
            </View>
          </View>
          <Text style={[styles.themeText, { color: "#444" }]}>
            {t.lightTheme}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "blue",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
  },

  themeContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  themeOption: {
    width: 100,
    height: 160,
    borderRadius: 12,
    padding: 15,
    marginRight: 15,
    borderWidth: 2,
  },
  darkTheme: {
    backgroundColor: "#1a1a1a",
    borderColor: "#333",
  },
  lightTheme: {
    backgroundColor: "#dddddd",
    borderColor: "#666",
  },
  grayTheme: {
    backgroundColor: "#424242",
    borderColor: "#666",
  },
  blueTheme: {
    backgroundColor: "rgb(20, 28, 51)", // #141c33

    borderColor: "rgb(139, 175, 208)", // #8bafd0
  },
  orangeTheme: {
    backgroundColor: "rgb(255, 245, 224)",
    borderColor: "rgb(255, 204, 173)",
  },
  greenTheme: {
    backgroundColor: "rgb(189,209,207)",
    borderColor: "rgb(83,117,116)",
  },
  selectedTheme: {
    borderColor: "#2196F3",
    transform: [{ scale: 1.1 }],
  },
  themePreview: {
    flex: 1,
    marginBottom: 10,
  },
  themeHeader: {
    flexDirection: "row",
    justifyContent: "flex-start",
    gap: 8,
    marginBottom: 15,
  },
  themeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ddd",
  },
  themeContent: {
    gap: 8,
  },
  themeBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ddd",
  },
  themeText: {
    fontSize: 14,
    color: "#ddd",
    textAlign: "left",
  },
});
