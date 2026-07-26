import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "@expo/vector-icons/Ionicons";
import { updateProfile } from "firebase/auth";
import Toast from "react-native-toast-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { alpha } from "../../theme/colors";
import {
  createUserProfile,
  isUsernameAvailable,
  isValidUsername,
  UserProfileErrorCode,
} from "../../services/userService";
import {
  cancelGoogleRegistration,
  GOOGLE_PROFILE_PENDING_KEY,
} from "../../services/googleAuthService";

export default function GoogleProfileCompletionScreen({ navigation }) {
  const { theme, selectedTheme } = useTheme();
  const { language } = useLanguage();
  const { markProfileCompleted } = useAuth();
  const insets = useSafeAreaInsets();
  const user = auth.currentUser;
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [username, setUsername] = useState("");
  const [available, setAvailable] = useState(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const checkId = useRef(0);
  const tr = language === "tr";
  const isLight = selectedTheme === "light" || selectedTheme === "green";

  useEffect(() => {
    const normalized = username.trim();
    const currentCheck = ++checkId.current;
    if (!isValidUsername(normalized)) {
      setAvailable(null);
      setChecking(false);
      return;
    }
    setChecking(true);
    const timer = setTimeout(async () => {
      try {
        // excludeUid: kendi rezervasyonun sana "alınmış" görünmemeli — yeniden
        // deneme akışında kullanıcı kendi username'ine takılıp kalıyordu.
        const result = await isUsernameAvailable(normalized, {
          excludeUid: user?.uid,
        });
        if (checkId.current === currentCheck) setAvailable(result);
      } catch {
        if (checkId.current === currentCheck) setAvailable(null);
      } finally {
        if (checkId.current === currentCheck) setChecking(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [username, user?.uid]);

  const canSave = useMemo(
    () =>
      !!user &&
      displayName.trim().length >= 2 &&
      isValidUsername(username) &&
      available === true &&
      !saving,
    [available, displayName, saving, user, username]
  );

  const completeProfile = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const cleanName = displayName.trim();
      await createUserProfile({
        uid: user.uid,
        username: username.trim(),
        email: user.email,
        displayName: cleanName,
        avatarIndex: 0,
      });
      // Profil yazıldı → kapıyı HEMEN aç. Bunu updateProfile'dan sonraya
      // bırakmak, o ağ çağrısı hata aldığında kullanıcıyı tamamlanmış bir
      // profille bu ekrana kalıcı olarak kilitliyordu.
      await AsyncStorage.removeItem(GOOGLE_PROFILE_PENDING_KEY).catch(() => {});
      // onAuthStateChanged bu noktada yeniden tetiklenmez; AuthContext'e
      // profilin hazır olduğunu biz söylüyoruz (Lists/{uid} kapısını da açar).
      markProfileCompleted();
      // Auth displayName kozmetik — asıl kaynak Firestore'daki profil.
      // Başarısız olması akışı bloklamamalı.
      updateProfile(user, { displayName: cleanName }).catch(() => {});
      Toast.show({
        type: "success",
        text1: tr
          ? "Profilin hazır. Hoş geldin!"
          : "Your profile is ready. Welcome!",
      });
      navigation.reset({ index: 0, routes: [{ name: "TabScreen" }] });
    } catch (error) {
      // Metne regex atmak yerine koda bak; ham Firebase metni ("FirebaseError:
      // Missing or insufficient permissions.") kullanıcıya gösterilmez.
      const taken = error?.code === UserProfileErrorCode.USERNAME_TAKEN;
      if (taken) setAvailable(false);
      Toast.show({
        type: "error",
        text1: tr ? "Profil oluşturulamadı" : "Could not create profile",
        text2: taken
          ? tr
            ? "Bu kullanıcı adı az önce alındı, başka bir tane dene."
            : "That username was just taken, try another."
          : tr
          ? "Bağlantını kontrol edip tekrar dene."
          : "Check your connection and try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const cancel = async () => {
    setSaving(true);
    try {
      await cancelGoogleRegistration();
      navigation.reset({ index: 0, routes: [{ name: "LoginScreen" }] });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.primary }]}>
      <StatusBar barStyle={isLight ? "dark-content" : "light-content"} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={[
              styles.icon,
              { backgroundColor: alpha(theme.accent, 0.14) },
            ]}
          >
            <Ionicons
              name="person-add-outline"
              size={30}
              color={theme.accent}
            />
          </View>
          <Text style={[styles.title, { color: theme.text.primary }]}>
            {tr
              ? "Seelogd profilini tamamla"
              : "Complete your Seelogd profile"}
          </Text>
          <Text style={[styles.subtitle, { color: theme.text.muted }]}>
            {tr
              ? "Google hesabın doğrulandı. Uygulamada görünecek bilgilerini bir kez belirle."
              : "Your Google account is verified. Choose the details shown in the app."}
          </Text>

          <View
            style={[
              styles.card,
              { backgroundColor: theme.secondary, borderColor: theme.border },
            ]}
          >
            <View
              style={[styles.googleAccount, { backgroundColor: theme.between }]}
            >
              <View style={styles.googleBadge}>
                <Text style={styles.googleLetter}>G</Text>
              </View>
              <View style={styles.flex}>
                <Text
                  numberOfLines={1}
                  style={[styles.accountName, { color: theme.text.primary }]}
                >
                  {user?.displayName ||
                    (tr ? "Google hesabı" : "Google account")}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[styles.accountEmail, { color: theme.text.muted }]}
                >
                  {user?.email}
                </Text>
              </View>
              <Ionicons name="checkmark-circle" size={21} color="#34A853" />
            </View>

            <Text style={[styles.label, { color: theme.text.muted }]}>
              {tr ? "GÖRÜNEN AD" : "DISPLAY NAME"}
            </Text>
            <View
              style={[
                styles.inputShell,
                { backgroundColor: theme.between, borderColor: theme.border },
              ]}
            >
              <Ionicons
                name="person-outline"
                size={18}
                color={theme.text.muted}
              />
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                maxLength={40}
                style={[styles.input, { color: theme.text.primary }]}
                placeholder={tr ? "Adın ve soyadın" : "Your name"}
                placeholderTextColor={theme.text.muted}
                returnKeyType="next"
              />
            </View>

            <Text style={[styles.label, { color: theme.text.muted }]}>
              {tr ? "KULLANICI ADI" : "USERNAME"}
            </Text>
            <View
              style={[
                styles.inputShell,
                {
                  backgroundColor: theme.between,
                  borderColor:
                    available === true
                      ? "#34A853"
                      : available === false
                      ? theme.colors.red
                      : theme.border,
                },
              ]}
            >
              <Ionicons name="at-outline" size={18} color={theme.text.muted} />
              <TextInput
                value={username}
                onChangeText={setUsername}
                style={[styles.input, { color: theme.text.primary }]}
                placeholder={tr ? "benzersiz_kullanici_adi" : "unique_username"}
                placeholderTextColor={theme.text.muted}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={20}
                returnKeyType="done"
                onSubmitEditing={completeProfile}
              />
              {checking ? (
                <ActivityIndicator size="small" color={theme.accent} />
              ) : available !== null ? (
                <Ionicons
                  name={available ? "checkmark-circle" : "close-circle"}
                  size={20}
                  color={available ? "#34A853" : theme.colors.red}
                />
              ) : null}
            </View>
            <Text
              style={[
                styles.hint,
                {
                  color:
                    available === false ? theme.colors.red : theme.text.muted,
                },
              ]}
            >
              {available === false
                ? tr
                  ? "Bu kullanıcı adı alınmış."
                  : "This username is taken."
                : tr
                ? "3–20 karakter; harf, sayı ve alt çizgi kullanabilirsin."
                : "3–20 characters; letters, numbers, and underscore."}
            </Text>

            <TouchableOpacity
              disabled={!canSave}
              onPress={completeProfile}
              style={[
                styles.primary,
                { backgroundColor: theme.accent },
                !canSave && styles.disabled,
              ]}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.primaryText}>
                    {tr ? "Profili oluştur" : "Create profile"}
                  </Text>
                  <Ionicons name="arrow-forward" size={17} color="#fff" />
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              disabled={saving}
              onPress={cancel}
              style={styles.cancel}
            >
              <Text style={[styles.cancelText, { color: theme.text.muted }]}>
                {tr ? "Başka hesap kullan" : "Use another account"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 22,
    alignItems: "center",
  },
  icon: {
    width: 62,
    height: 62,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: { fontSize: 25, fontWeight: "900", textAlign: "center" },
  subtitle: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
    textAlign: "center",
    maxWidth: 360,
    marginTop: 8,
    marginBottom: 22,
  },
  card: {
    width: "100%",
    maxWidth: 440,
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 10,
  },
  googleAccount: {
    minHeight: 62,
    borderRadius: 16,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  googleBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  googleLetter: { color: "#4285F4", fontSize: 18, fontWeight: "900" },
  accountName: { fontSize: 14, fontWeight: "800" },
  accountEmail: { fontSize: 11.5, marginTop: 2 },
  label: {
    fontSize: 10.5,
    fontWeight: "900",
    letterSpacing: 0.7,
    marginTop: 5,
    marginLeft: 3,
  },
  inputShell: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: { flex: 1, fontSize: 14.5, fontWeight: "700", paddingVertical: 12 },
  hint: { fontSize: 11, fontWeight: "600", marginLeft: 4 },
  primary: {
    height: 52,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },
  disabled: { opacity: 0.5 },
  primaryText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  cancel: { alignItems: "center", paddingVertical: 8 },
  cancelText: { fontSize: 13, fontWeight: "700" },
});
