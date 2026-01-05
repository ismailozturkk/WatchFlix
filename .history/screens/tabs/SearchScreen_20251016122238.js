import React from "react";
import { StyleSheet, View, Text, TouchableOpacity } from "react-native";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import Feather from "@expo/vector-icons/Feather";
import LottieView from "lottie-react-native";
import { useSnow } from "../../context/SnowContext";
import ListsTvShowScreen from "../ListsTvShowScreen";
import Toast from "react-native-toast-message";
import { useAppSettings } from "../../context/AppSettingsContext";

export default function SearchScreen({ navigation }) {
  const { showSnow } = useAppSettings();

  const { t } = useLanguage();
  const { theme } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.primary }]}>
      <LottieView
        style={[styles.lottie, { display: showSnow ? "flex" : "none" }]}
        source={require("../../LottieJson/snow.json")}
        autoPlay={true}
        loop
      />
      <Text style={[styles.title, { color: theme.text.primary }]}>
        {t.SearchScreen.search}
      </Text>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <LottieView
          style={{ width: "90%", height: "90%" }}
          source={require("../../LottieJson/SearchScreen.json")}
          autoPlay
          loop
        />
      </View>
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: theme.secondary, shadowColor: theme.shadow },
          ]}
          onPress={() => navigation.navigate("MovieSearch")}
        >
          <MaterialCommunityIcons
            name="movie-outline"
            size={24}
            color={theme.text.primary}
          />
          <Text style={[styles.buttonText, { color: theme.text.primary }]}>
            {t.SearchScreen.searchMovies}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: theme.secondary, shadowColor: theme.shadow },
          ]}
          onPress={() => navigation.navigate("TvShowSearch")}
        >
          <Feather name="tv" size={24} color={theme.text.primary} />
          <Text style={[styles.buttonText, { color: theme.text.primary }]}>
            {t.SearchScreen.searchTvShows}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: theme.secondary, shadowColor: theme.shadow },
          ]}
          onPress={() => navigation.navigate("ActorSearch")}
        >
          <Feather name="user" size={24} color={theme.text.primary} />
          <Text style={[styles.buttonText, { color: theme.text.primary }]}>
            {t.SearchScreen.searchActrist}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: theme.secondary, shadowColor: theme.shadow },
          ]}
          onPress={() => navigation.navigate("SearchAll")}
        >
          <Feather name="search" size={24} color={theme.text.primary} />
          <Text style={[styles.buttonText, { color: theme.text.primary }]}>
            {t.SearchScreen.searchActrist}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 40,
    paddingHorizontal: 20,
  },
  lottie: {
    position: "absolute",
    top: 0,
    left: -60,
    right: -60,
    bottom: -200,
    zIndex: 0,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
  },
  buttonContainer: {
    flex: 1,
    gap: 20,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderRadius: 15,
    gap: 15,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.44,
    shadowRadius: 10.32,
    elevation: 16,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
