import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Pressable,
} from "react-native";
import React, { useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import LottieView from "lottie-react-native";
import { useSnow } from "../../context/SnowContext";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import Ionicons from "@expo/vector-icons/Ionicons";
import Toast from "react-native-toast-message";
import { useLanguage } from "../../context/LanguageContext";
import Checkbox from "expo-checkbox";
const { width, height } = Dimensions.get("window");

export default function LoginScreen({ navigation }) {
  const { theme } = useTheme();
  const { showSnow } = useSnow();
  const [email, setEmail] = useState();
  const { t, language, toggleLanguage } = useLanguage();
  const [password, setPassword] = useState();
  const [isloading, setIsloading] = useState(false);
  const [isChecked, setChecked] = useState(false);
  const signIn = async () => {
    setIsloading(true);
    try {
      const auth = getAuth();
      const userCredentials = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      let userName = userCredentials.user.displayName;
      Toast.show({
        type: "success",
        text1: t.LoginScreen.loginToast + userName,
      });
      navigation.navigate("TabScreen", userCredentials.user);
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t.LoginScreen.loginToast1,
      });
    } finally {
      setIsloading(false);
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.primary }}
      keyboardShouldPersistTaps="handled"
    >
      <TouchableOpacity
        style={[styles.languageButton, { backgroundColor: theme.secondary }]}
        onPress={() => {
          console.log("Press");
          toggleLanguage(language === "tr" ? "en" : "tr");
        }}
      >
        <Text
          style={[styles.languageButtonText, { color: theme.text.primary }]}
        >
          {language.toUpperCase()}
        </Text>
      </TouchableOpacity>
      <View style={[styles.container, { backgroundColor: theme.primary }]}>
        <LottieView
          style={[styles.lottie, { display: showSnow ? "flex" : "none" }]}
          source={require("../../LottieJson/snow.json")}
          autoPlay={true}
          loop
        />
        <LottieView
          source={require("../../LottieJson/login.json")}
          style={{ width: 400, height: 400, zIndex: 5 }}
          autoPlay
          loop
        />
        <Text style={[styles.title, { color: theme.text.primary }]}>
          {t.LoginScreen.loginButton}
        </Text>
        <View
          style={[
            styles.input,
            {
              backgroundColor: theme.secondary,
              borderColor: theme.border,
            },
          ]}
        >
          <Ionicons name="mail-outline" size={24} color={theme.border} />
          <TextInput
            style={{ width: "90%", height: "100%", color: theme.text.primary }}
            placeholder={t.LoginScreen.email}
            placeholderTextColor={theme.text.secondary}
            keyboardType="email-address"
            onChangeText={(text) => setEmail(text)}
          />
        </View>
        <View
          style={[
            styles.input,
            {
              backgroundColor: theme.secondary,
              borderColor: theme.border,
            },
          ]}
        >
          <Ionicons name="lock-closed-outline" size={24} color={theme.border} />
          <TextInput
            style={{ width: "90%", height: "100%", color: theme.text.primary }}
            placeholderTextColor={theme.text.secondary}
            placeholder={t.LoginScreen.password}
            secureTextEntry
            onChangeText={(text) => setPassword(text)}
          />
        </View>
        <View style={styles.section}>
          <Checkbox
            style={styles.checkbox}
            value={isChecked}
            onValueChange={setChecked}
            color={isChecked ? theme.accent : undefined}
          />
          <Text style={styles.paragraph}>Beni Hatırla</Text>
        </View>
        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: theme.accent, borderColor: theme.border },
          ]}
          onPress={() => signIn()}
        >
          {isloading ? (
            <LottieView
              source={require("../../LottieJson/loading15.json")}
              style={{ width: 40, height: 40 }}
              autoPlay
              loop
            />
          ) : (
            <Text style={[styles.buttonText, { color: theme.text.primary }]}>
              {t.LoginScreen.loginButton}
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: theme.secondary, borderColor: theme.border },
          ]}
          onPress={() => navigation.navigate("RegisterScreen")}
        >
          <Text style={[styles.buttonText, { color: theme.text.primary }]}>
            {t.LoginScreen.registerButton}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate("ForgotPasswordScreen")}
        >
          <Text style={[styles.forgotPassword, { color: theme.text.muted }]}>
            {t.LoginScreen.forgotPassword}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: width,
    height: height,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  languageButton: {
    position: "absolute",
    top: 40,
    right: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 10,
  },
  languageButtonText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  lottie: {
    position: "absolute",
    height: 1000,
    top: 0,
    left: -60,
    right: -60,
    zIndex: 0,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  input: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 50,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    paddingHorizontal: 10,
    backgroundColor: "white",
    marginBottom: 15,
  },
  button: {
    width: "100%",
    height: 50,
    backgroundColor: "#007bff",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
    marginBottom: 10,
  },
  buttonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  forgotPassword: {
    color: "#007bff",
    fontSize: 16,
  },

  section: {
    flexDirection: "row",
    // alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  paragraph: {
    fontSize: 15,
    color: "#666",
  },
  checkbox: {
    marginBottom: 8,
  },
});
