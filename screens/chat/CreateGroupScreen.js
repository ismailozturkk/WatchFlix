// screens/chat/CreateGroupScreen.js
//
// Grup oluşturma: ad + renk + arkadaş seçimi. memberInfo (ad/avatar) denormalize
// edilir (grup sohbetinde gönderen gösterimi için). Grup avatarı iconBacground
// görsellerinden seçilip 0-based avatarIndex olarak kaydedilir.

import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getAuth } from "firebase/auth";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { useTheme } from "@context/ThemeContext";
import { useProfileUi } from "@context/ProfileUiContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import BackButton from "@components/BackButton";
import ScreenDecor from "@components/ScreenDecor";
import GroupAvatar from "@components/chat/GroupAvatar";
import GroupAvatarPickerModal from "@components/chat/GroupAvatarPickerModal";
import { i18nText } from "@utils/i18nText";
import { toast } from "@components/AppToast";
import { createGroup } from "@services/groupsService";
import { ICON_BACKGROUND_COUNT } from "@components/IconBacground";
import { randomInt, randomPick } from "@utils/randomPick";

const GROUP_COLORS = [
  "#6C63FF", "#FF8A65", "#4FC3F7", "#81C784",
  "#BA68C8", "#F06292", "#FFD54F", "#4DB6AC",
];

export default function CreateGroupScreen({ navigation }) {
  const auth = getAuth();
  const user = auth.currentUser;
  const { theme } = useTheme();
  const { avatars, selectAvatarIndex } = useProfileUi();

  const [friends, setFriends] = useState([]);
  const [selected, setSelected] = useState({}); // uid -> friend
  const [name, setName] = useState("");
  // Ekran her açıldığında görsel + renk rastgele başlar; kullanıcı isterse
  // aşağıdaki seçicilerden değiştirir. Sabit "0 + ilk renk" ile açılınca
  // grupların çoğu aynı görünüyordu.
  const [color, setColor] = useState(() => randomPick(GROUP_COLORS));
  const [avatarIndex, setAvatarIndex] = useState(() =>
    randomInt(ICON_BACKGROUND_COUNT),
  );
  const [avatarPickerVisible, setAvatarPickerVisible] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      collection(db, "Users", user.uid, "friends"),
      (snap) => {
        setFriends(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              uid: data.friendUid || d.id,
              displayName: data.friendName || "",
              username: data.friendUsername || "",
              avatarIndex: data.friendAvatarIndex ?? 0,
            };
          }),
        );
      },
    );
    return () => unsub();
  }, [user]);

  const toggle = useCallback((friend) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[friend.uid]) delete next[friend.uid];
      else next[friend.uid] = friend;
      return next;
    });
  }, []);

  const selectedList = Object.values(selected);
  const canCreate = selectedList.length >= 1 && name.trim().length > 0;

  const handleCreate = useCallback(async () => {
    if (!canCreate || creating) return;
    setCreating(true);
    try {
      const members = [user.uid, ...selectedList.map((f) => f.uid)];
      const memberInfo = {
        [user.uid]: {
          name: user.displayName || "",
          avatarIndex: typeof selectAvatarIndex === "number" ? selectAvatarIndex : 0,
        },
      };
      selectedList.forEach((f) => {
        memberInfo[f.uid] = { name: f.displayName, avatarIndex: f.avatarIndex ?? 0 };
      });

      const groupId = await createGroup({
        name: name.trim(),
        color,
        avatarIndex,
        members,
        memberInfo,
        createdBy: user.uid,
      });

      navigation.replace("ChatScreen", {
        groupId,
        groupName: name.trim(),
        groupAvatarIndex: avatarIndex,
      });
    } catch (err) {
      console.error("createGroup:", err);
      toast.error(
        i18nText("autoI18n.hata", "Hata"),
        i18nText("autoI18n.grup_olusturulamadi", "Grup oluşturulamadı"),
      );
      setCreating(false);
    }
  }, [canCreate, creating, user, selectedList, name, color, avatarIndex, selectAvatarIndex, navigation]);

  const renderFriend = ({ item }) => {
    const isSel = !!selected[item.uid];
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => toggle(item)}
        style={[
          styles.friendCard,
          { backgroundColor: theme.secondary, borderColor: isSel ? color : theme.border },
        ]}
      >
        <View style={[styles.avatarWrap, { borderColor: theme.accent + "66" }]}>
          {avatars?.[item.avatarIndex] ? (
            <Image source={avatars[item.avatarIndex]} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPh, { backgroundColor: theme.primary }]}>
              <Ionicons name="person" size={20} color={theme.text?.muted ?? "#555"} />
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.friendName, { color: theme.text?.primary ?? "#fff" }]} numberOfLines={1}>
            {item.displayName}
          </Text>
          <Text style={[styles.friendUser, { color: theme.text?.secondary ?? "#aaa" }]} numberOfLines={1}>
            @{item.username}
          </Text>
        </View>
        <View style={[styles.checkDot, isSel && { backgroundColor: color, borderColor: color }]}>
          {isSel && <Ionicons name="checkmark" size={15} color="#fff" />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.primary }]}>
      <ScreenDecor iconOpacity={0.3} />

      <View style={styles.headerRow}>
        <View style={styles.headerSide}>
          <BackButton absolute={false} />
        </View>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[styles.title, { color: theme.text?.primary ?? "#fff" }]}
        >
          {i18nText("autoI18n.yeni_grup", "Yeni Grup")}
        </Text>
        {/* Başlık geri butonuna rağmen ortalı kalsın diye simetrik boşluk */}
        <View style={styles.headerSide} />
      </View>

      {/* Grup adı + renk önizleme */}
      <View style={styles.topSection}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setAvatarPickerVisible(true)}
          style={styles.groupAvatarButton}
          accessibilityLabel={i18nText("autoI18n.grup_avatari_sec", "Grup avatarı seç")}
        >
          <GroupAvatar avatarIndex={avatarIndex} color={color} size={56} iconSize={37} />
          <View style={[styles.editAvatarBadge, { backgroundColor: theme.accent }]}>
            <Ionicons name="pencil" size={10} color="#fff" />
          </View>
        </TouchableOpacity>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={i18nText("autoI18n.grup_adi", "Grup adı")}
          placeholderTextColor={theme.text?.muted ?? "#777"}
          maxLength={40}
          style={[styles.nameInput, { color: theme.text?.primary ?? "#fff", borderColor: theme.border }]}
        />
      </View>

      {/* Renk seçimi */}
      <View style={styles.colorRow}>
        {GROUP_COLORS.map((c) => (
          <TouchableOpacity
            key={c}
            onPress={() => setColor(c)}
            style={[
              styles.colorDot,
              { backgroundColor: c, borderColor: color === c ? "#fff" : "transparent" },
            ]}
          />
        ))}
      </View>

      <Text style={[styles.sectionLabel, { color: theme.text?.secondary ?? "#aaa" }]}>
        {i18nText("autoI18n.uyeler", "Üyeler")} ({selectedList.length})
      </Text>

      {friends.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="people-outline" size={48} color={theme.text?.muted ?? "#444"} />
          <Text style={[styles.emptyText, { color: theme.text?.secondary ?? "#aaa" }]}>
            {i18nText("autoI18n.once_arkadas_ekle", "Önce arkadaş eklemelisin")}
          </Text>
        </View>
      ) : (
        <FlatList
          data={friends}
          keyExtractor={(it) => it.uid}
          renderItem={renderFriend}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Oluştur butonu */}
      <TouchableOpacity
        onPress={handleCreate}
        disabled={!canCreate || creating}
        activeOpacity={0.85}
        style={[
          styles.createBtn,
          { backgroundColor: color, opacity: canCreate && !creating ? 1 : 0.4 },
        ]}
      >
        {creating ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.createBtnText}>
              {i18nText("autoI18n.grubu_olustur", "Grubu Oluştur")}
            </Text>
          </>
        )}
      </TouchableOpacity>

      <GroupAvatarPickerModal
        visible={avatarPickerVisible}
        selectedIndex={avatarIndex}
        color={color}
        onSelect={setAvatarIndex}
        onClose={() => setAvatarPickerVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 10 },
  // Geri butonu satır içinde: eskiden absolute olduğu için başlığın üstüne
  // biniyordu. headerSide iki yanda eşit boşluk bırakıp başlığı ortalı tutar.
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
    marginTop: 4,
  },
  headerSide: { width: 40 },
  title: {
    flex: 1,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
    textAlign: "center",
  },

  topSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  groupAvatarButton: { position: "relative" },
  editAvatarBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  nameInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    borderBottomWidth: 1.5,
    paddingVertical: 8,
  },

  colorRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 18,
    flexWrap: "wrap",
  },
  colorDot: { width: 30, height: 30, borderRadius: 15, borderWidth: 2.5 },

  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    paddingHorizontal: 16,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  friendCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 11,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 8,
  },
  avatarWrap: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, overflow: "hidden" },
  avatar: { width: "100%", height: "100%", borderRadius: 23 },
  avatarPh: { justifyContent: "center", alignItems: "center" },
  friendName: { fontSize: 15, fontWeight: "700" },
  friendUser: { fontSize: 12.5, marginTop: 2 },
  checkDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },

  empty: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, paddingHorizontal: 32 },
  emptyText: { fontSize: 14, textAlign: "center" },

  createBtn: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  createBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
