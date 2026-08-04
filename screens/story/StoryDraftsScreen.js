import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  FlatList,
  StatusBar,
  Platform,
  Alert,
  Dimensions,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Toast from "react-native-toast-message";
import { useTheme } from "@context/ThemeContext";
import { StoryDraftService } from "@services/StoryDraftService";
import { i18nText } from "@utils/i18nText";
import { appAlert } from "@components/AppAlert";
import ScreenDecor from "@components/ScreenDecor";


const COLS = 3;
const GRID_PAD = 12;
const GRID_GAP = 10;
const ITEM_W = (Dimensions.get("window").width - GRID_PAD * 2 - GRID_GAP * (COLS - 1)) / COLS;
const ITEM_H = (ITEM_W * 16) / 9;

const formatDate = (ts) => {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleDateString() + " " + d.toLocaleTimeString().slice(0, 5);
};

export default function StoryDraftsScreen({ navigation }) {
  const { theme } = useTheme();
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const list = await StoryDraftService.getDrafts();
    setDrafts(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener("focus", load);
    load();
    return unsub;
  }, [navigation, load]);

  const handleEdit = (draft) => {
    navigation.navigate("StoryShareScreen", {
      ...(draft.params || {}),
      draftId: draft.id,
    });
  };

  const handleDelete = (draft) => {
    appAlert(
      i18nText("autoI18n.taslagi_sil", "Taslağı sil"),
      i18nText("autoI18n.taslak_sil_onay", "\"{{name}}\" silinsin mi?", { name: draft.name }),
      [
      { text: i18nText("autoI18n.iptal", "İptal"), style: "cancel" },
      {
        text: i18nText("autoI18n.sil", "Sil"),
        style: "destructive",
        onPress: async () => {
          await StoryDraftService.deleteDraft(draft.id);
          setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
          Toast.show({ type: "success", text1: i18nText("autoI18n.taslak_silindi", "Taslak silindi") });
        },
      },
      ],
    );
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity activeOpacity={0.85} onPress={() => handleEdit(item)} style={styles.card}>
      <View
        style={[styles.thumbWrap, { backgroundColor: theme.secondary, borderColor: theme.border }]}
      >
        {item.thumbnailUri ? (
          <Image source={{ uri: item.thumbnailUri }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={styles.thumbEmpty}>
            <Ionicons name="image-outline" size={26} color={theme.text.muted} />
          </View>
        )}
        {/* Sil */}
        <TouchableOpacity
          onPress={() => handleDelete(item)}
          style={styles.delBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="trash" size={13} color="#fff" />
        </TouchableOpacity>
        {/* Düzenle rozeti */}
        <View style={[styles.editBadge, { backgroundColor: theme.accent }]}>
          <Ionicons name="create-outline" size={12} color="#fff" />
        </View>
      </View>
      <Text allowFontScaling={false} numberOfLines={1} style={[styles.name, { color: theme.text.primary }]}>
        {item.name}
      </Text>
      <Text allowFontScaling={false} numberOfLines={1} style={[styles.date, { color: theme.text.muted }]}>
        {formatDate(item.updatedAt)}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.primary }]}>
      <ScreenDecor iconOpacity={0.3} />
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { backgroundColor: theme.secondary }]}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={22} color={theme.text.primary} />
        </TouchableOpacity>
        <Text allowFontScaling={false} style={[styles.title, { color: theme.text.primary }]}>{i18nText("autoI18n.taslaklarim", "Taslaklarım")}</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={drafts}
        keyExtractor={(d) => d.id}
        renderItem={renderItem}
        numColumns={COLS}
        columnWrapperStyle={{ gap: GRID_GAP }}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Ionicons name="albums-outline" size={48} color={theme.text.muted} />
              <Text allowFontScaling={false} style={[styles.emptyText, { color: theme.text.muted }]}>{i18nText("autoI18n.henuz_taslak_yok", "Henüz taslak yok.")}{"\n"}{i18nText("autoI18n.bir_story_tasarlayip_kaydet", "Bir story tasarlayıp kaydet.")}</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 56 : 40,
    paddingBottom: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: "900" },
  list: { padding: GRID_PAD, gap: 14, flexGrow: 1 },
  card: { width: ITEM_W },
  thumbWrap: {
    width: ITEM_W,
    height: ITEM_H,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
  },
  thumb: { width: "100%", height: "100%" },
  thumbEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
  delBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  editBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontSize: 12, fontWeight: "800", marginTop: 6 },
  date: { fontSize: 10, marginTop: 1 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 80 },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
});
