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
import {
  createUserWithEmailAndPassword,
  getAuth,
  sendEmailVerification,
  updateProfile,
} from "firebase/auth";
import Toast from "react-native-toast-message";
import { useLanguage } from "../../context/LanguageContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  doc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "../../firebase";

const { width, height } = Dimensions.get("window");

export default function RegisterScreen({ navigation }) {
  const { theme } = useTheme();
  const { showSnow } = useSnow();
  const [email, setEmail] = useState();
  const [username, setUsername] = useState();
  const [usernameAvailable, setUsernameAvailable] = useState(null); // null: bilinmiyor, true: kullanılabilir, false: alınmış
  const [name, setName] = useState();
  const [lastname, setLastname] = useState();
  const [password, setPassword] = useState();
  const [passwordAgain, setPasswordAgain] = useState();
  const [isloading, setIsloading] = useState(false);
  const { t } = useLanguage();
  let border = theme.border;
  const [passwordCorrect, setPasswordCorrect] = useState(border);
  const [passwordCorrectAgain, setPasswordCorrectAgain] = useState(border);

  // Debounce mekanizması için timeout
  let usernameTimeout;

  const checkUsername = async (name) => {
    const q = query(collection(db, "Users"), where("username", "==", name));
    const snapshot = await getDocs(q);
    setUsernameAvailable(snapshot.empty);
  };

  const validateUsername = (text) => {
    // Sadece harf, rakam ve alt çizgi (_) olabilir, boşluk yok
    const regex = /^[a-zA-Z0-9_]+$/;
    return regex.test(text);
  };

  // Kullanım örneği
  const handleUsernameChange = (text) => {
    setUsername(text);

    if (!text || text.length < 3) {
      setUsernameAvailable(null); // geçersiz username
      return;
    } else if (text.length > 20) {
      setUsernameAvailable(false); // geçerli ama henüz kontrol edilmedi
      return;
    } else if (!validateUsername(text)) {
      setUsernameAvailable(false); // geçerli ama henüz kontrol edilmedi
      return;
    }

    setUsernameAvailable(null); // geçerli ama henüz kontrol edilmedi

    if (usernameTimeout) clearTimeout(usernameTimeout);
    usernameTimeout = setTimeout(() => {
      checkUsername(text.toLowerCase()); // Firestore kontrolü
    }, 500);
  };

  const inputPassword = (text) => {
    if (text.length >= 6) {
      setPasswordCorrect("rgb(37, 211, 102)");
    } else if (text.length == 0) {
      setPasswordCorrect(border);
    } else {
      setPasswordCorrect("rgb(189, 8, 28)");
    }
    setPassword(text);
  };
  const inputPasswordAgain = (text) => {
    if (text.length == 0) {
      setPasswordCorrectAgain(border);
    } else if (text == password) {
      setPasswordCorrectAgain("rgb(37, 211, 102)");
    } else {
      setPasswordCorrectAgain("rgb(189, 8, 28)");
    }
    setPasswordAgain(text);
  };

  const createAccount = async () => {
    if (!username || username.length < 3) {
      Toast.show({
        type: "error",
        text1: "Lütfen kullanıcı adını düzenleyiniz!",
      });
      return;
    }

    if (usernameAvailable === false) {
      Toast.show({ type: "error", text1: "Bu kullanıcı adı alınmış!" });
      return;
    }

    if (!name || !lastname) {
      Toast.show({ type: "error", text1: "Lütfen isim ve soyisim giriniz!" });
      return;
    }

    if (password !== passwordAgain) {
      Toast.show({ type: "error", text1: "Şifreler eşleşmiyor!" });
      return;
    }

    setIsloading(true);

    try {
      const auth = getAuth();
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      await updateProfile(user, { displayName: name + " " + lastname });
      await sendEmailVerification(user);

      const userRef = doc(db, "Users", user.uid);
      await setDoc(userRef, {
        username,
        email,
        displayName: user.displayName,
        avatar: null,
        createdAt: new Date(),
        friends: [],
        friendRequestsSent: [],
        friendRequestsReceived: [],
      });

      Toast.show({
        type: "success",
        text1: `${username} olarak kayıt başarılı! Email doğrulaması gönderildi: ${email}`,
      });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Kayıt sırasında hata oluştu: " + error.message,
      });
    } finally {
      setIsloading(false);
      navigation.navigate("LoginScreen");
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
          autoPlay
          loop
        />
        <LottieView
          source={require("../../LottieJson/register.json")}
          style={{ width: 300, height: 300 }}
          autoPlay
          loop
        />
        <Text style={[styles.title, { color: theme.text.primary }]}>
          {t.RegisterScreen.registerButton}
        </Text>

        <View
          style={[
            styles.input,
            {
              backgroundColor: theme.secondary,
              borderColor:
                usernameAvailable === null
                  ? theme.border
                  : usernameAvailable
                    ? "rgb(37, 211, 102)"
                    : "rgb(189, 8, 28)",
            },
          ]}
        >
          <Ionicons name="at-outline" size={24} color={theme.border} />
          <TextInput
            style={[
              {
                width: "90%",
                height: "100%",
                color: usernameAvailable === false ? "red" : theme.text.primary,
              },
              {
                textDecorationLine:
                  usernameAvailable === false ? "line-through" : "none",
              },
            ]}
            placeholderTextColor={theme.text.secondary}
            placeholder="Kullanıcı Adı"
            onChangeText={handleUsernameChange}
            autoCapitalize="none"
          />
          {usernameAvailable === false && (
            <Text style={{ position: "absolute", right: 10, color: "red" }}>
              Bu kullanıcı adı alınamaz!
            </Text>
          )}
          {usernameAvailable === true && (
            <Text style={{ position: "absolute", bottom: 10, color: "red" }}>
              Bu kullanıcı adı alınamaz!
            </Text>
          )}
        </View>

        <View
          style={[
            styles.input,
            { backgroundColor: theme.secondary, borderColor: theme.border },
          ]}
        >
          <Ionicons name="person-outline" size={24} color={theme.border} />
          <TextInput
            style={{ width: "90%", height: "100%", color: theme.text.primary }}
            placeholderTextColor={theme.text.secondary}
            placeholder={t.RegisterScreen.name}
            onChangeText={(text) => setName(text)}
          />
        </View>

        <View
          style={[
            styles.input,
            { backgroundColor: theme.secondary, borderColor: theme.border },
          ]}
        >
          <Ionicons name="person" size={24} color={theme.border} />
          <TextInput
            style={{ width: "90%", height: "100%", color: theme.text.primary }}
            placeholderTextColor={theme.text.secondary}
            placeholder={t.RegisterScreen.lastName}
            onChangeText={(text) => setLastname(text)}
          />
        </View>

        <View
          style={[
            styles.input,
            { backgroundColor: theme.secondary, borderColor: theme.border },
          ]}
        >
          <Ionicons name="mail-outline" size={24} color={theme.border} />
          <TextInput
            style={{ width: "90%", height: "100%", color: theme.text.primary }}
            placeholderTextColor={theme.text.secondary}
            placeholder={t.RegisterScreen.email}
            keyboardType="email-address"
            onChangeText={(text) => setEmail(text)}
          />
        </View>

        <View
          style={[
            styles.input,
            { backgroundColor: theme.secondary, borderColor: passwordCorrect },
          ]}
        >
          <Ionicons name="lock-closed-outline" size={24} color={theme.border} />
          <TextInput
            style={{ width: "90%", height: "100%", color: theme.text.primary }}
            placeholderTextColor={theme.text.secondary}
            placeholder={t.RegisterScreen.password}
            secureTextEntry
            onChangeText={(text) => inputPassword(text)}
          />
        </View>

        <View
          style={[
            styles.input,
            {
              backgroundColor: theme.secondary,
              borderColor: passwordCorrectAgain,
            },
          ]}
        >
          <Ionicons name="lock-closed" size={24} color={theme.border} />
          <TextInput
            style={{ width: "90%", height: "100%", color: theme.text.primary }}
            placeholderTextColor={theme.text.secondary}
            placeholder={t.RegisterScreen.passwordAgain}
            secureTextEntry
            onChangeText={(text) => inputPasswordAgain(text)}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.accent }]}
          onPress={() => createAccount()}
          disabled={usernameAvailable === false}
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
              {t.RegisterScreen.registerButton}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.secondary }]}
          onPress={() => navigation.navigate("LoginScreen")}
        >
          <Text style={[styles.buttonText, { color: theme.text.primary }]}>
            {t.RegisterScreen.loginButton}
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
    marginTop: 10,
  },
  buttonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
});
