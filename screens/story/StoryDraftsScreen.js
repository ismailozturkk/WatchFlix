import { isLightSurface } from "@utils/colorUtils";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  FlatList,
  StatusBar,
  Platform,
  useWindowDimensions,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Toast from "@components/AppToast";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@context/ThemeContext";
import { StoryDraftService } from "@services/StoryDraftService";
import { i18nText } from "@utils/i18nText";
import { storyDraftGrid } from "@utils/storyCanvasLayout";
import { appAlert } from "@components/AppAlert";
import ScreenDecor from "@components/ScreenDecor";
import BackButton from "@components/BackButton";


const GRID_PAD = 12;
const GRID_GAP = 10;

const formatDate = (ts) => {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleDateString() + " " + d.toLocaleTimeString().slice(0, 5);
};

export default function StoryDraftsScreen({ navigation }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  // Sütun sayısı/kart boyu pencereden hesaplanır (modül yüklenirken Dimensions
  // okumak katlanır ekran ve bölünmüş pencerede eskirdi); üst boşluk cihazın
  // gerçek güvenli alanından gelir (sabit 56/40, büyük çentikte butonları
  // durum çubuğunun altında bırakıyordu — StoryHeader ile aynı kural).
  const grid = useMemo(
    () => storyDraftGrid(winW, { pad: GRID_PAD, gap: GRID_GAP }),
    [winW]
  );
  const topInset = Math.max(
    insets.top,
    Platform.OS === "android" ? StatusBar.currentHeight || 0 : 0
  );
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
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => handleEdit(item)}
      style={{ width: grid.itemW }}
    >
      <View
        style={[
          styles.thumbWrap,
          {
            width: grid.itemW,
            height: grid.itemH,
            backgroundColor: theme.secondary,
            borderColor: theme.border,
          },
        ]}
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
      <ScreenDecor scope="social" iconOpacity={0.3} />
      <StatusBar barStyle={isLightSurface(theme.primary) ? "dark-content" : "light-content"} />
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <BackButton absolute={false} onPress={() => navigation.goBack()} />
        <Text allowFontScaling={false} style={[styles.title, { color: theme.text.primary }]}>{i18nText("autoI18n.taslaklarim", "Taslaklarım")}</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        // numColumns değişince FlatList'in yeniden kurulması gerekir.
        key={`cols-${grid.cols}`}
        data={drafts}
        keyExtractor={(d) => d.id}
        renderItem={renderItem}
        numColumns={grid.cols}
        columnWrapperStyle={{ gap: GRID_GAP }}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: GRID_PAD + insets.bottom + 8 },
        ]}
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
    paddingBottom: 10,
  },
  title: { fontSize: 18, fontWeight: "900" },
  list: { padding: GRID_PAD, gap: 14, flexGrow: 1 },
  /* width/height pencereden hesaplanır (storyDraftGrid) */
  thumbWrap: {
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
