import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from "react-native";
import React, { useState, useEffect } from "react";
import { useTheme } from "../../context/ThemeContext";
import LottieView from "lottie-react-native";
import { useSnow } from "../../context/SnowContext";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import Ionicons from "@expo/vector-icons/Ionicons";
import Toast from "react-native-toast-message";
import { useLanguage } from "../../context/LanguageContext";
import Checkbox from "expo-checkbox";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width, height } = Dimensions.get("window");

export default function LoginScreen({ navigation }) {
  const { theme } = useTheme();
  const { showSnow } = useSnow();
  const { t, language, toggleLanguage } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isloading, setIsloading] = useState(false);
  const [isChecked, setChecked] = useState(false);
  const [recentUsers, setRecentUsers] = useState([]);

  // ✅ AsyncStorage'dan son 3 kullanıcıyı çek
  useEffect(() => {
    const loadUsers = async () => {
      const stored = await AsyncStorage.getItem("recentUsers");
      if (stored) setRecentUsers(JSON.parse(stored));
    };
    loadUsers();
  }, []);

  // ✅ Kullanıcı giriş yapınca bilgiyi kaydet
  const storeUser = async (email) => {
    try {
      const newUser = {
        email,
        date: new Date().toLocaleString("tr-TR"),
      };

      // Mevcut kullanıcıları al
      let updatedUsers = [newUser, ...recentUsers];

      // Aynı e-posta varsa eskiyi kaldır
      updatedUsers = updatedUsers.filter(
        (u, i, arr) => arr.findIndex((x) => x.email === u.email) === i
      );

      // En fazla 3 kullanıcı kalsın
      if (updatedUsers.length > 3) updatedUsers.pop();

      await AsyncStorage.setItem("recentUsers", JSON.stringify(updatedUsers));
      setRecentUsers(updatedUsers);
    } catch (e) {
      console.error("Kullanıcı kaydedilemedi", e);
    }
  };

  // ✅ Oturum açma işlemi
  const signIn = async (selectedUser) => {
    setIsloading(true);
    try {
      const auth = getAuth();
      const userEmail = selectedUser ? selectedUser.email : email;
      const userPassword = selectedUser ? selectedUser.password : password;

      const userCredentials = await signInWithEmailAndPassword(
        auth,
        userEmail,
        userPassword
      );

      if (isChecked) {
        await storeUser(userEmail);
        await AsyncStorage.setItem(`password_${userEmail}`, userPassword);
      }

      let userName = userCredentials.user.displayName || userEmail;
      Toast.show({
        type: "success",
        text1: t.LoginScreen.loginToast + " " + userName,
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

  // ✅ Kayıtlı kullanıcıya basılınca otomatik doldur
  const handleUserPress = async (user) => {
    const savedPass = await AsyncStorage.getItem(`password_${user.email}`);
    if (savedPass) {
      setEmail(user.email);
      setPassword(savedPass);
      signIn({ email: user.email, password: savedPass });
    } else {
      Toast.show({
        type: "info",
        text1: "Bu kullanıcı için parola kayıtlı değil.",
      });
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.primary }}
      keyboardShouldPersistTaps="handled"
    >
      <TouchableOpacity
        style={[styles.languageButton, { backgroundColor: theme.secondary }]}
        onPress={() => toggleLanguage(language === "tr" ? "en" : "tr")}
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
          autoPlay
          loop
        />
        <LottieView
          source={require("../../LottieJson/login.json")}
          style={{ width: 400, height: 400 }}
          autoPlay
          loop
        />

        <Text style={[styles.title, { color: theme.text.primary }]}>
          {t.LoginScreen.loginButton}
        </Text>

        {/* Email */}
        <View
          style={[
            styles.input,
            { backgroundColor: theme.secondary, borderColor: theme.border },
          ]}
        >
          <Ionicons name="mail-outline" size={24} color={theme.border} />
          <TextInput
            style={{ width: "90%", height: "100%", color: theme.text.primary }}
            placeholder={t.LoginScreen.email}
            placeholderTextColor={theme.text.secondary}
            keyboardType="email-address"
            onChangeText={setEmail}
            value={email}
          />
        </View>

        {/* Şifre */}
        <View
          style={[
            styles.input,
            { backgroundColor: theme.secondary, borderColor: theme.border },
          ]}
        >
          <Ionicons name="lock-closed-outline" size={24} color={theme.border} />
          <TextInput
            style={{ width: "90%", height: "100%", color: theme.text.primary }}
            placeholderTextColor={theme.text.secondary}
            placeholder={t.LoginScreen.password}
            secureTextEntry
            onChangeText={setPassword}
            value={password}
          />
        </View>

        {/* Beni Hatırla */}
        <View style={styles.section}>
          <Checkbox
            style={styles.checkbox}
            value={isChecked}
            onValueChange={setChecked}
            color={isChecked ? theme.accent : undefined}
          />
          <Text style={[styles.paragraph, { color: theme.text.secondary }]}>
            Beni Hatırla
          </Text>
        </View>

        {/* Giriş Butonu */}
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

        {/* Son 3 kullanıcı */}
        {recentUsers.length > 0 && (
          <View style={styles.recentContainer}>
            <Text style={[styles.recentTitle, { color: theme.text.primary }]}>
              Son Giriş Yapanlar:
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {recentUsers.map((user, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.recentUser,
                    {
                      backgroundColor: theme.secondary,
                      borderColor: theme.border,
                    },
                  ]}
                  onPress={() => handleUserPress(user)}
                >
                  <Text
                    style={{ color: theme.text.primary, fontWeight: "600" }}
                  >
                    {user.email}
                  </Text>
                  <Text style={{ color: theme.text.muted, fontSize: 12 }}>
                    {user.date}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Kayıt & Şifre Unutma */}
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
    width,
    height,
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
  languageButtonText: { fontSize: 14, fontWeight: "bold" },
  lottie: { position: "absolute", height: 1000, top: 0, left: -60, right: -60 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20 },
  input: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 50,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    marginBottom: 15,
  },
  section: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  paragraph: { fontSize: 15 },
  button: {
    width: "100%",
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
    marginBottom: 10,
  },
  buttonText: { fontSize: 18, fontWeight: "bold" },
  forgotPassword: { fontSize: 16 },
  recentContainer: { width: "100%", marginVertical: 12 },
  recentTitle: { fontSize: 16, marginBottom: 6 },
  recentUser: {
    padding: 10,
    borderWidth: 1,
    borderRadius: 10,
    marginRight: 10,
    minWidth: width * 0.5,
  },
});
