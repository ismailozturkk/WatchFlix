import React from "react";
import { TouchableOpacity, StyleSheet, Platform } from "react-native";
import { BlurView } from "expo-blur";
import Ionicons from "@expo/vector-icons/Ionicons";

/* Hero üzerindeki sabit üst butonlar: geri + story paylaş.
   ScrollView DIŞINDA render edilmeli ki her zaman tıklanabilir kalsın. */
export default function DetailTopBar({ navigation, storyParams }) {
  return (
    <>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => navigation.goBack()}
        activeOpacity={0.8}
      >
        <BlurView tint="dark" intensity={60} style={styles.backBtnBlur}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </BlurView>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.storyBtn}
        onPress={() => navigation.navigate("StoryShareScreen", storyParams)}
        activeOpacity={0.8}
      >
        <BlurView tint="dark" intensity={60} style={styles.backBtnBlur}>
          <Ionicons name="share-social-outline" size={20} color="#fff" />
        </BlurView>
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  backBtn: {
    position: "absolute",
    top: Platform.OS === "ios" ? 52 : 36,
    left: 16,
    zIndex: 50,
    elevation: 50,
  },
  storyBtn: {
    position: "absolute",
    top: Platform.OS === "ios" ? 52 : 36,
    right: 16,
    zIndex: 50,
    elevation: 50,
  },
  backBtnBlur: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
