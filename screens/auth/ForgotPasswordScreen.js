import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Dimensions,
  ScrollView,
} from "react-native";
import React, { useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import LottieView from "lottie-react-native";
import { useSnow } from "../../context/SnowContext";
import { getAuth, sendPasswordResetEmail } from "firebase/auth";
import Toast from "react-native-toast-message";
import { useLanguage } from "../../context/LanguageContext";
import Ionicons from "@expo/vector-icons/Ionicons";
const { width, height } = Dimensions.get("window");

export default function ForgotPasswordScreen({ navigation }) {
  const { theme } = useTheme();
  const { showSnow } = useSnow();
  const [email, setEmail] = useState("");
  const [isloading, setIsloading] = useState(false);
  const { t } = useLanguage();
  const resetPassword = async () => {
    setIsloading(true);
    const auth = getAuth(); // Firebase Auth nesnesini al
    try {
      const userCredentials = await sendPasswordResetEmail(auth, email).then(
        () => {
          Toast.show({
            type: "success",
            text1: email + t.ForgotPasswordScreen.forgotPasswordToast,
          });
        }
      );
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t.ForgotPasswordScreen.forgotPasswordToast1,
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
      <View style={[styles.container, { backgroundColor: theme.primary }]}>
        <LottieView
          style={[styles.lottie, { display: showSnow ? "flex" : "none" }]}
          source={require("../../LottieJson/snow.json")}
          autoPlay={true}
          loop
        />
        <LottieView
          source={require("../../LottieJson/forgot_password.json")}
          style={{ width: 300, height: 300 }}
          autoPlay
          loop
        />
        <Text style={[styles.title, { color: theme.text.primary }]}>
          {t.ForgotPasswordScreen.forgotPassword}
        </Text>
        <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
          {t.ForgotPasswordScreen.forgotPasswordText}
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
            placeholder={t.ForgotPasswordScreen.email}
            placeholderTextColor={theme.text.secondary}
            keyboardType="email-address"
            onChangeText={(text) => setEmail(text)}
          />
        </View>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.accent }]}
          onPress={() => resetPassword()}
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
              {t.ForgotPasswordScreen.send}
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.secondary }]}
          onPress={() => navigation.navigate("LoginScreen")}
        >
          <Text style={[styles.buttonText, { color: theme.text.primary }]}>
            {t.ForgotPasswordScreen.loginButton}
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
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: "gray",
    textAlign: "center",
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
});
