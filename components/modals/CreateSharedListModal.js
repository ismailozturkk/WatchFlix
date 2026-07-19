import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
} from "react-native";
import { BlurView } from "expo-blur";
import Ionicons from "@expo/vector-icons/Ionicons";
import Toast from "react-native-toast-message";
import { useTheme } from "@context/ThemeContext";
import { useFriends } from "@context/FriendsContext";
import { useUserProfile } from "@context/UserProfileContext";
import { createSharedList, addSharedListMembers } from "@services/sharedListsService";
import { getAvatarSource } from "@utils/avatars";
import { i18nText } from "@utils/i18nText";

// Ortak liste oluşturma / mevcut ortak listeye üye ekleme sayfası (bottom sheet).
//
// İki mod:
//   • Oluşturma (varsayılan): isim + arkadaş seçimi + arkadaş başına
//     "ekleyebilir / sadece görür" yetkisi → createSharedList.
//   • Üye ekleme (`addToList` prop'u verilirse): isim alanı gizlenir, seçilen
//     arkadaşlar mevcut listeye eklenir (kurucu akışı) → addSharedListMembers.
//
// Seçilen arkadaş varsayılan "sadece görür" (canAdd=false) başlar; kurucu
// dilerse çip üzerinden ekleme yetkisi verir. canRemove burada verilmez —
// içerik silme yetkisi SharedListScreen üye yönetiminden açılır.

export default function CreateSharedListModal({
  visible,
  onClose,
  onCreated,
  addToList = null, // {id, memberIds} — üye ekleme modu
}) {
  const { theme } = useTheme();
  const { friends } = useFriends();
  const { uid, displayName, username, avatarIndex } = useUserProfile();

  const [name, setName] = useState("");
  // uid → { canAdd } ; map'te olmak = seçili olmak
  const [selected, setSelected] = useState({});
  const [saving, setSaving] = useState(false);

  const isAddMode = !!addToList;
  const accent = "#fbbf24"; // özel liste vurgusu (ListsViewScreen ile aynı)

  // Üye ekleme modunda zaten üye olanları listeleme.
  const selectableFriends = useMemo(() => {
    const existing = new Set(addToList?.memberIds || []);
    return friends
      .map((f) => ({
        uid: f.friendUid || f.id,
        name: f.friendName || "",
        username: f.friendUsername || "",
        avatarIndex: f.friendAvatarIndex ?? 0,
      }))
      .filter((f) => f.uid && !existing.has(f.uid));
  }, [friends, addToList?.memberIds]);

  const selectedCount = Object.keys(selected).length;

  const toggleFriend = (fuid) =>
    setSelected((prev) => {
      const next = { ...prev };
      if (next[fuid]) delete next[fuid];
      else next[fuid] = { canAdd: false };
      return next;
    });

  const toggleCanAdd = (fuid) =>
    setSelected((prev) =>
      prev[fuid]
        ? { ...prev, [fuid]: { canAdd: !prev[fuid].canAdd } }
        : prev,
    );

  const reset = () => {
    setName("");
    setSelected({});
  };

  const handleSubmit = async () => {
    if (saving) return;
    const members = selectableFriends
      .filter((f) => selected[f.uid])
      .map((f) => ({ ...f, canAdd: selected[f.uid].canAdd, canRemove: false }));

    if (!isAddMode && !name.trim()) {
      Toast.show({ type: "warning", text1: i18nText("autoI18n.liste_adi_girin", "Liste adı girin") });
      return;
    }
    if (isAddMode && members.length === 0) {
      Toast.show({ type: "warning", text1: i18nText("autoI18n.arkadas_secin", "Arkadaş seçin") });
      return;
    }

    setSaving(true);
    try {
      if (isAddMode) {
        await addSharedListMembers(addToList.id, members);
        Toast.show({ type: "success", text1: i18nText("autoI18n.uyeler_eklendi", "Üyeler eklendi") });
      } else {
        const listId = await createSharedList({
          owner: { uid, displayName, username, avatarIndex },
          name,
          friends: members,
        });
        Toast.show({ type: "success", text1: i18nText("autoI18n.ortak_liste_olusturuldu", "Ortak liste oluşturuldu") });
        onCreated?.(listId);
      }
      reset();
      onClose();
    } catch (e) {
      Toast.show({ type: "error", text1: i18nText("autoI18n.hata_2", "Hata: ") + e.message });
    } finally {
      setSaving(false);
    }
  };

  const renderFriend = ({ item }) => {
    const sel = selected[item.uid];
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => toggleFriend(item.uid)}
        style={[
          styles.friendRow,
          {
            backgroundColor: sel ? accent + "12" : theme.primary,
            borderColor: sel ? accent + "55" : theme.border,
          },
        ]}
      >
        <Image source={getAvatarSource(item.avatarIndex)} style={styles.avatar} />
        <View style={styles.friendInfo}>
          <Text
            numberOfLines={1}
            style={[styles.friendName, { color: theme.text.primary }]}
          >
            {item.name || item.username}
          </Text>
          {!!item.username && (
            <Text
              numberOfLines={1}
              style={[styles.friendUsername, { color: theme.text.muted }]}
            >
              @{item.username}
            </Text>
          )}
        </View>

        {sel ? (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => toggleCanAdd(item.uid)}
            style={[
              styles.permChip,
              {
                backgroundColor: sel.canAdd
                  ? (theme.colors?.green ?? "#29b864") + "22"
                  : theme.secondary,
                borderColor: sel.canAdd
                  ? (theme.colors?.green ?? "#29b864") + "66"
                  : theme.border,
              },
            ]}
          >
            <Ionicons
              name={sel.canAdd ? "add-circle" : "eye"}
              size={12}
              color={sel.canAdd ? theme.colors?.green ?? "#29b864" : theme.text.muted}
            />
            <Text
              style={[
                styles.permChipText,
                {
                  color: sel.canAdd
                    ? theme.colors?.green ?? "#29b864"
                    : theme.text.muted,
                },
              ]}
            >
              {sel.canAdd
                ? i18nText("autoI18n.ekleyebilir", "Ekleyebilir")
                : i18nText("autoI18n.sadece_gorur", "Sadece görür")}
            </Text>
          </TouchableOpacity>
        ) : null}

        <Ionicons
          name={sel ? "checkmark-circle" : "ellipse-outline"}
          size={22}
          color={sel ? accent : theme.text.muted}
        />
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <BlurView tint="dark" intensity={40} style={StyleSheet.absoluteFill} />
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />

        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.secondary, borderColor: theme.border },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: theme.border }]} />

          {/* Başlık */}
          <View style={styles.headerRow}>
            <View style={[styles.headerIcon, { backgroundColor: accent + "20" }]}>
              <Ionicons name="people" size={18} color={accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: theme.text.primary }]}>
                {isAddMode
                  ? i18nText("autoI18n.uye_ekle", "Üye Ekle")
                  : i18nText("autoI18n.ortak_liste_olustur", "Ortak Liste Oluştur")}
              </Text>
              <Text style={[styles.subtitle, { color: theme.text.muted }]}>
                {i18nText(
                  "autoI18n.ortak_liste_aciklama",
                  "Arkadaşlarınla birlikte doldurduğunuz liste",
                )}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: theme.primary }]}
            >
              <Ionicons name="close" size={16} color={theme.text.muted} />
            </TouchableOpacity>
          </View>

          {/* Liste adı (yalnız oluşturma modu) */}
          {!isAddMode && (
            <View
              style={[
                styles.inputWrap,
                { backgroundColor: theme.primary, borderColor: theme.border },
              ]}
            >
              <Ionicons name="albums-outline" size={16} color={accent} />
              <TextInput
                style={[styles.input, { color: theme.text.primary }]}
                placeholder={i18nText("autoI18n.liste_adi", "Liste adı...")}
                placeholderTextColor={theme.text.muted}
                value={name}
                onChangeText={setName}
                maxLength={40}
              />
            </View>
          )}

          {/* Arkadaş seçimi */}
          <Text style={[styles.sectionLabel, { color: theme.text.muted }]}>
            {i18nText("autoI18n.arkadaslarini_sec", "ARKADAŞLARINI SEÇ")}
            {selectedCount > 0 ? `  ·  ${selectedCount}` : ""}
          </Text>

          {selectableFriends.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons
                name="person-add-outline"
                size={28}
                color={theme.text.muted}
              />
              <Text style={[styles.emptyText, { color: theme.text.muted }]}>
                {isAddMode
                  ? i18nText(
                      "autoI18n.eklenecek_arkadas_kalmadi",
                      "Eklenecek arkadaş kalmadı",
                    )
                  : i18nText(
                      "autoI18n.henuz_arkadasin_yok",
                      "Henüz arkadaşın yok. Önce arkadaş ekle.",
                    )}
              </Text>
            </View>
          ) : (
            <FlatList
              data={selectableFriends}
              keyExtractor={(f) => f.uid}
              style={{ maxHeight: 320 }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
              renderItem={renderFriend}
            />
          )}

          {/* Onay */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleSubmit}
            disabled={saving}
            style={[
              styles.submitBtn,
              { backgroundColor: accent, opacity: saving ? 0.6 : 1 },
            ]}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Ionicons name={isAddMode ? "person-add" : "people"} size={16} color="#000" />
            )}
            <Text style={styles.submitText}>
              {isAddMode
                ? i18nText("autoI18n.uyeleri_ekle", "Üyeleri Ekle")
                : i18nText("autoI18n.listeyi_olustur", "Listeyi Oluştur")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 30,
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 3,
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  title: { fontSize: 17, fontWeight: "800" },
  subtitle: { fontSize: 11, marginTop: 2 },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  input: { flex: 1, paddingVertical: 11, fontSize: 14 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 8,
  },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  avatar: { width: 34, height: 34, borderRadius: 17 },
  friendInfo: { flex: 1, minWidth: 0 },
  friendName: { fontSize: 13, fontWeight: "700" },
  friendUsername: { fontSize: 11, marginTop: 1 },
  permChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  permChipText: { fontSize: 10, fontWeight: "700" },
  emptyBox: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 26,
  },
  emptyText: { fontSize: 12, textAlign: "center" },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 14,
  },
  submitText: { color: "#000", fontSize: 14, fontWeight: "800" },
});
