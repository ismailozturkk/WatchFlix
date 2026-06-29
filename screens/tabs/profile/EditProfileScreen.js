import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import Toast from "react-native-toast-message";
import { useTheme } from "../../../context/ThemeContext";
import { useUserProfile } from "../../../context/UserProfileContext";
import { useProfileUi } from "../../../context/ProfileUiContext";
import { AVATARS, getAvatarSource, clampAvatarIndex } from "../../../utils/avatars";
import {
  isValidUsername,
  isUsernameAvailable,
  normalizeUsername,
} from "../../../services/userService";
import { deleteAccount } from "../../../services/accountService";
import { propagateProfileChange } from "../../../services/profilePropagation";
import { i18nText } from "../../../utils/i18nText";


const BIO_MAX = 160;

export default function EditProfileScreen({ navigation }) {
  const { theme } = useTheme();
  const { profile, loading, updateField, changeUsername } = useUserProfile();
  const { selectAvatarIndex, selectAvatar } = useProfileUi();

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarIndex, setAvatarIndex] = useState(0);
  const [usernameStatus, setUsernameStatus] = useState("idle"); // idle|same|invalid|checking|available|taken
  const [saving, setSaving] = useState(false);

  // Hesap silme
  const [showDelete, setShowDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  const initRef = useRef(false);

  // Profil yüklenince alanları doldur
  useEffect(() => {
    if (profile && !initRef.current) {
      setDisplayName(profile.displayName || "");
      setUsername(profile.username || "");
      setBio(profile.bio || "");
      setAvatarIndex(
        clampAvatarIndex(
          typeof profile.avatarIndex === "number"
            ? profile.avatarIndex
            : selectAvatarIndex,
        ),
      );
      initRef.current = true;
    }
  }, [profile, selectAvatarIndex]);

  // Kullanıcı adı: format + müsaitlik (debounce)
  useEffect(() => {
    if (!initRef.current) return;
    const u = username.trim();
    if (normalizeUsername(u) === normalizeUsername(profile?.username || "")) {
      setUsernameStatus("same");
      return;
    }
    if (!isValidUsername(u)) {
      setUsernameStatus("invalid");
      return;
    }
    setUsernameStatus("checking");
    const id = setTimeout(async () => {
      try {
        const ok = await isUsernameAvailable(u);
        setUsernameStatus(ok ? "available" : "taken");
      } catch {
        setUsernameStatus("idle");
      }
    }, 500);
    return () => clearTimeout(id);
  }, [username, profile?.username]);

  const usernameBlocked =
    usernameStatus === "invalid" ||
    usernameStatus === "taken" ||
    usernameStatus === "checking";

  const onSave = async () => {
    if (saving) return;
    const dn = displayName.trim();
    const un = username.trim();
    const bo = bio.trim();

    if (!dn) {
      Toast.show({ type: "error", text1: i18nText("autoI18n.isim_bos_olamaz", "İsim boş olamaz") });
      return;
    }
    const usernameChanged =
      normalizeUsername(un) !== normalizeUsername(profile?.username || "");
    if (usernameChanged && !isValidUsername(un)) {
      Toast.show({
        type: "error",
        text1: i18nText("autoI18n.gecersiz_kullanici_adi_3_20_karakter_a_z_0_9", "Geçersiz kullanıcı adı (3-20 karakter, a-z 0-9 _)"),
      });
      return;
    }
    if (usernameChanged && usernameStatus === "taken") {
      Toast.show({ type: "error", text1: i18nText("autoI18n.bu_kullanici_adi_alinmis_2", "Bu kullanıcı adı alınmış") });
      return;
    }

    setSaving(true);
    try {
      if (usernameChanged) {
        await changeUsername(un);
      }
      const patch = {};
      if (dn !== (profile?.displayName || "")) patch.displayName = dn;
      if (bo !== (profile?.bio || "")) patch.bio = bo;
      if (Object.keys(patch).length) await updateField(patch);

      const avatarChanged = avatarIndex !== clampAvatarIndex(profile?.avatarIndex);
      if (avatarChanged) {
        await selectAvatar(avatarIndex);
      }

      // İsim/avatar değiştiyse postlara ve arkadaşlık kayıtlarına yay (best-effort).
      const nameChanged = patch.displayName !== undefined;
      if ((nameChanged || avatarChanged) && profile?.uid) {
        propagateProfileChange(profile.uid, {
          displayName: nameChanged ? dn : undefined,
          avatarIndex: avatarChanged ? avatarIndex : undefined,
        }).catch(() => {});
      }

      Toast.show({ type: "success", text1: i18nText("autoI18n.profil_guncellendi", "Profil güncellendi") });
      navigation.goBack();
    } catch (e) {
      Toast.show({ type: "error", text1: e?.message || i18nText("autoI18n.guncellenemedi", "Güncellenemedi") });
    } finally {
      setSaving(false);
    }
  };

  const onDeleteAccount = async () => {
    if (deleting) return;
    if (!deletePassword) {
      Toast.show({ type: "error", text1: i18nText("autoI18n.devam_etmek_icin_sifreni_gir", "Devam etmek için şifreni gir") });
      return;
    }
    setDeleting(true);
    try {
      await deleteAccount({ password: deletePassword });
      // Başarılı: Firebase oturumu kapattı. Login'e dön.
      Toast.show({ type: "success", text1: i18nText("autoI18n.hesabin_silindi", "Hesabın silindi") });
      navigation.reset({ index: 0, routes: [{ name: "LoginScreen" }] });
    } catch (e) {
      const code = e?.code || "";
      let msg = e?.message || "Hesap silinemedi";
      if (code === "auth/wrong-password" || code === "auth/invalid-credential")
        msg = i18nText("autoI18n.sifre_yanlis", "Şifre yanlış");
      else if (code === "auth/too-many-requests")
        msg = i18nText("autoI18n.cok_fazla_deneme", "Çok fazla deneme. Biraz sonra tekrar dene");
      Toast.show({ type: "error", text1: msg });
      setDeleting(false);
    }
  };

  const usernameHint = () => {
    switch (usernameStatus) {
      case "invalid":
        return { text: "3-20 karakter · a-z, 0-9, _", color: theme.colors.red };
      case "checking":
        return { text: "Kontrol ediliyor…", color: theme.text.muted };
      case "taken":
        return { text: i18nText("autoI18n.bu_kullanici_adi_alinmis_2", "Bu kullanıcı adı alınmış"), color: theme.colors.red };
      case "available":
        return { text: i18nText("autoI18n.kullanilabilir", "Kullanılabilir"), color: theme.colors.green };
      default:
        return null;
    }
  };
  const hint = usernameHint();

  if (loading && !profile) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: theme.primary }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.primary }]}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        {/* Başlık */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
            style={[styles.backBtn, { backgroundColor: theme.secondary }]}
          >
            <Ionicons name="chevron-back" size={22} color={theme.text.primary} />
          </TouchableOpacity>
          <Text
            allowFontScaling={false}
            style={[styles.headerTitle, { color: theme.text.primary }]}
          >{i18nText("autoI18n.profili_duzenle", "Profili Düzenle")}</Text>
          <TouchableOpacity
            onPress={onSave}
            disabled={saving || usernameBlocked}
            activeOpacity={0.85}
            style={[
              styles.saveBtn,
              {
                backgroundColor:
                  saving || usernameBlocked ? theme.border : theme.accent,
              },
            ]}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>{i18nText("autoI18n.kaydet", "Kaydet")}</Text>
            )}
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Avatar önizleme */}
            <View style={styles.avatarPreviewWrap}>
              <View style={[styles.avatarRing, { borderColor: theme.accent }]}>
                <Image
                  source={getAvatarSource(avatarIndex)}
                  style={styles.avatarPreview}
                  contentFit="cover"
                />
              </View>
              <Text style={[styles.avatarHint, { color: theme.text.muted }]}>{i18nText("autoI18n.avatar_sec", "Avatar seç")}</Text>
            </View>

            {/* Avatar seçici */}
            <FlatList
              data={AVATARS}
              keyExtractor={(_, i) => String(i)}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.avatarList}
              initialNumToRender={10}
              maxToRenderPerBatch={8}
              windowSize={4}
              removeClippedSubviews={Platform.OS === "android"}
              getItemLayout={(_, index) => ({
                length: 70,
                offset: 70 * index,
                index,
              })}
              renderItem={({ item, index }) => {
                const selected = index === avatarIndex;
                return (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setAvatarIndex(index)}
                    style={[
                      styles.avatarThumbWrap,
                      {
                        borderColor: selected ? theme.accent : "transparent",
                        backgroundColor: theme.secondary,
                      },
                    ]}
                  >
                    <Image
                      source={item}
                      style={styles.avatarThumb}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                  </TouchableOpacity>
                );
              }}
            />

            {/* İsim */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.text.secondary }]}>{i18nText("autoI18n.isim", "İsim")}</Text>
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder={i18nText("autoI18n.adin", "Adın")}
                placeholderTextColor={theme.text.muted}
                maxLength={40}
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.secondary,
                    borderColor: theme.border,
                    color: theme.text.primary,
                  },
                ]}
              />
            </View>

            {/* Kullanıcı adı */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.text.secondary }]}>{i18nText("autoI18n.kullanici_adi_2", "Kullanıcı adı")}</Text>
              <View
                style={[
                  styles.usernameRow,
                  {
                    backgroundColor: theme.secondary,
                    borderColor:
                      usernameStatus === "taken" || usernameStatus === "invalid"
                        ? theme.colors.red
                        : usernameStatus === "available"
                          ? theme.colors.green
                          : theme.border,
                  },
                ]}
              >
                <Text style={[styles.atSign, { color: theme.text.muted }]}>@</Text>
                <TextInput
                  value={username}
                  onChangeText={(v) => setUsername(v.replace(/\s/g, ""))}
                  placeholder="kullanici_adi"
                  placeholderTextColor={theme.text.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={20}
                  style={[styles.usernameInput, { color: theme.text.primary }]}
                />
                {usernameStatus === "checking" && (
                  <ActivityIndicator size="small" color={theme.text.muted} />
                )}
                {usernameStatus === "available" && (
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color={theme.colors.green}
                  />
                )}
                {usernameStatus === "taken" && (
                  <Ionicons
                    name="close-circle"
                    size={18}
                    color={theme.colors.red}
                  />
                )}
              </View>
              {hint && (
                <Text style={[styles.hint, { color: hint.color }]}>
                  {hint.text}
                </Text>
              )}
            </View>

            {/* Bio */}
            <View style={styles.field}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, { color: theme.text.secondary }]}>{i18nText("autoI18n.hakkinda", "Hakkında")}</Text>
                <Text style={[styles.counter, { color: theme.text.muted }]}>
                  {bio.length}/{BIO_MAX}
                </Text>
              </View>
              <TextInput
                value={bio}
                onChangeText={(v) => setBio(v.slice(0, BIO_MAX))}
                placeholder="Kendinden bahset…"
                placeholderTextColor={theme.text.muted}
                multiline
                maxLength={BIO_MAX}
                style={[
                  styles.input,
                  styles.bioInput,
                  {
                    backgroundColor: theme.secondary,
                    borderColor: theme.border,
                    color: theme.text.primary,
                  },
                ]}
              />
            </View>

            {/* Tehlikeli bölge */}
            <View style={styles.dangerZone}>
              <Text style={[styles.dangerLabel, { color: theme.text.muted }]}>{i18nText("autoI18n.tehlikeli_bolge", "Tehlikeli bölge")}</Text>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  setDeletePassword("");
                  setShowDelete(true);
                }}
                style={[
                  styles.deleteBtn,
                  {
                    borderColor: theme.colors.red,
                    backgroundColor: theme.colors.red + "14",
                  },
                ]}
              >
                <Ionicons name="trash-outline" size={18} color={theme.colors.red} />
                <Text style={[styles.deleteBtnText, { color: theme.colors.red }]}>{i18nText("autoI18n.hesabi_sil", "Hesabı Sil")}</Text>
              </TouchableOpacity>
              <Text style={[styles.dangerHint, { color: theme.text.muted }]}>{i18nText("autoI18n.hesabin_listelerin_hatirlaticilarin_notlarin_gonde", "Hesabın, listelerin, hatırlatıcıların, notların, gönderilerin ve arkadaşlık bağların kalıcı olarak silinir. Bu işlem geri alınamaz.")}</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Hesap silme onay modalı */}
      <Modal
        visible={showDelete}
        transparent
        animationType="fade"
        onRequestClose={() => !deleting && setShowDelete(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.secondary }]}>
            <View
              style={[
                styles.modalIcon,
                { backgroundColor: theme.colors.red + "1F" },
              ]}
            >
              <Ionicons name="warning-outline" size={26} color={theme.colors.red} />
            </View>
            <Text style={[styles.modalTitle, { color: theme.text.primary }]}>{i18nText("autoI18n.hesabi_sil_2", "Hesabı sil")}</Text>
            <Text style={[styles.modalDesc, { color: theme.text.secondary }]}>{i18nText("autoI18n.bu_islem_geri_alinamaz_devam_etmek_icin_sifreni_gi", "Bu işlem geri alınamaz. Devam etmek için şifreni gir.")}</Text>

            <TextInput
              value={deletePassword}
              onChangeText={setDeletePassword}
              placeholder={i18nText("autoI18n.sifre", "Şifre")}
              placeholderTextColor={theme.text.muted}
              secureTextEntry
              autoCapitalize="none"
              editable={!deleting}
              style={[
                styles.input,
                {
                  width: "100%",
                  marginTop: 14,
                  backgroundColor: theme.primary,
                  borderColor: theme.border,
                  color: theme.text.primary,
                },
              ]}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={deleting}
                onPress={() => setShowDelete(false)}
                style={[styles.modalBtn, { backgroundColor: theme.primary }]}
              >
                <Text style={[styles.modalBtnText, { color: theme.text.primary }]}>{i18nText("autoI18n.vazgec", "Vazgeç")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={deleting}
                onPress={onDeleteAccount}
                style={[
                  styles.modalBtn,
                  { backgroundColor: theme.colors.red, opacity: deleting ? 0.7 : 1 },
                ]}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: "#fff" }]}>{i18nText("autoI18n.hesabi_sil_2", "Hesabı sil")}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { justifyContent: "center", alignItems: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { flex: 1, fontSize: 19, fontWeight: "800", letterSpacing: -0.3 },
  saveBtn: {
    minWidth: 72,
    height: 38,
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  avatarPreviewWrap: { alignItems: "center", marginTop: 8, marginBottom: 14, gap: 8 },
  avatarRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 3,
    padding: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarPreview: { width: "100%", height: "100%", borderRadius: 48 },
  avatarHint: { fontSize: 12, fontWeight: "600" },

  avatarList: { paddingHorizontal: 16, gap: 10, paddingVertical: 4 },
  avatarThumbWrap: {
    width: 60,
    height: 60,
    borderRadius: 14,
    borderWidth: 2,
    padding: 3,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarThumb: { width: "100%", height: "100%", borderRadius: 11 },

  field: { paddingHorizontal: 16, marginTop: 18 },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: { fontSize: 13, fontWeight: "700", marginBottom: 8 },
  counter: { fontSize: 11, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  bioInput: { minHeight: 96, textAlignVertical: "top" },

  usernameRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    gap: 6,
  },
  atSign: { fontSize: 16, fontWeight: "700" },
  usernameInput: { flex: 1, paddingVertical: 12, fontSize: 15 },
  hint: { fontSize: 12, marginTop: 6, fontWeight: "600" },

  // Tehlikeli bölge
  dangerZone: { paddingHorizontal: 16, marginTop: 34 },
  dangerLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 13,
  },
  deleteBtnText: { fontSize: 15, fontWeight: "800" },
  dangerHint: { fontSize: 12, lineHeight: 17, marginTop: 10 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    borderRadius: 22,
    padding: 22,
    alignItems: "center",
  },
  modalIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitle: { fontSize: 19, fontWeight: "800", letterSpacing: -0.3 },
  modalDesc: {
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 6,
  },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 18, width: "100%" },
  modalBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  modalBtnText: { fontSize: 15, fontWeight: "700" },
});
