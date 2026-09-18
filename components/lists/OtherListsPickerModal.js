// components/lists/OtherListsPickerModal.js
//
// "Diğer Listeler" seçicisi — arama kartlarındaki hızlı ekleme butonundan
// (bkz. components/search/QuickListButtons.js) doğrudan açılır: kullanıcının
// kendi oluşturduğu özel listeler arasında bu içeriği ekle/çıkar.
//
// NEDEN AYRI BİLEŞEN: ListView.js/ListViewTv.js'in kendi "Diğer Listeler"
// ızgarası var, ama o bileşenin içine gömülü ve komple detay-ekranı akışının
// (izlenecekler/favoriler/izledim butonları, animasyon referansları) bir
// parçası. Onu buradan tetiklemek için ListView'i BÜTÜN OLARAK açmak (uzun
// basma davranışı) gerekirdi — oysa bu buton yalnız Diğer Listeler'e gitmeli.
// Bu yüzden aynı veriyi (ListStatusContext.otherListKeys/allLists) ve aynı
// yazma yollarını (addToCustomRootList/removeFromCustomRootList) kullanan,
// tek işi bu olan küçük bir sayfa.

import React, { useEffect, useRef, useState, memo } from "react";
import {
  Animated,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Toast from "react-native-toast-message";
import BottomSheetModal from "@components/common/BottomSheetModal";
import { useTheme } from "@context/ThemeContext";
import { useLanguage } from "@context/LanguageContext";
import { useAuth } from "@context/AuthContext";
import { useListStatusContext } from "@context/ListStatusContext";
import { useHapticsSettings } from "@context/AppSettingsContext";
import * as Haptics from "@services/hapticsService";
import {
  addToCustomRootList,
  removeFromCustomRootList,
} from "@services/listItemsService";
import { todayListDate } from "@utils/mediaFacts";
import { i18nText } from "@utils/i18nText";

const GridCard = memo(function GridCard({ label, active, onPress, theme }) {
  const scale = useRef(new Animated.Value(1)).current;
  const handlePress = () => {
    scale.stopAnimation();
    scale.setValue(0.92);
    Animated.spring(scale, {
      toValue: 1,
      speed: 20,
      bounciness: 8,
      useNativeDriver: true,
    }).start();
    onPress();
  };
  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={handlePress}
      style={[
        styles.gridCard,
        {
          backgroundColor: active ? theme.colors.green + "15" : theme.primary,
          borderColor: active ? theme.colors.green + "60" : theme.border,
        },
      ]}
    >
      <Animated.View style={{ transform: [{ scale }], alignItems: "center", gap: 8 }}>
        <View
          style={[
            styles.gridCardIcon,
            { backgroundColor: active ? theme.colors.green + "25" : theme.secondary },
          ]}
        >
          <Ionicons
            name={active ? "checkmark-circle" : "folder-outline"}
            size={26}
            color={active ? theme.colors.green : theme.text.muted}
          />
        </View>
        <Text
          allowFontScaling={false}
          numberOfLines={2}
          style={[
            styles.gridCardLabel,
            { color: active ? theme.colors.green : theme.text.secondary },
          ]}
        >
          {label}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
});

export default function OtherListsPickerModal({
  visible,
  onClose,
  mediaId,
  mediaType,
  title,
  posterPath,
  navigation,
}) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { hapticsEnabled } = useHapticsSettings();
  const { allLists, otherListKeys } = useListStatusContext() || {};

  const [optimistic, setOptimistic] = useState({});
  useEffect(() => {
    setOptimistic({});
  }, [allLists]);

  const isIn = (key) => {
    if (optimistic[key] !== undefined) return optimistic[key];
    const items = allLists?.[key];
    return (
      Array.isArray(items) &&
      items.some(
        (entry) =>
          entry &&
          String(entry.id) === String(mediaId) &&
          (entry.type || "movie") === mediaType,
      )
    );
  };

  const kindLabel = mediaType === "tv"
    ? i18nText("autoI18n.dizi", "Dizi")
    : i18nText("autoI18n.film", "Film");

  const trueCount = (otherListKeys || []).filter((key) => isIn(key)).length;

  const toggle = async (key) => {
    if (mediaId == null) return;
    if (!user?.uid) {
      Toast.show({
        type: "warning",
        text1: i18nText(
          "autoI18n.listeye_eklemek_icin_giris_yap",
          "Listeye eklemek için giriş yap",
        ),
      });
      return;
    }
    const current = isIn(key);
    const next = !current;
    setOptimistic((prev) => ({ ...prev, [key]: next }));
    if (hapticsEnabled) {
      Haptics.impactAsync(
        next
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Light,
      );
    }
    try {
      if (next) {
        await addToCustomRootList(user.uid, key, {
          id: mediaId,
          type: mediaType,
          name: title,
          imagePath: posterPath,
          dateAdded: todayListDate(),
        });
        Toast.show({
          type: "success",
          text1: i18nText(
            "autoI18n.media_added_to_list",
            "{{media}} {{list}} listesine eklendi!",
            { media: kindLabel, list: key },
          ),
        });
      } else {
        await removeFromCustomRootList(user.uid, key, mediaType, mediaId);
        Toast.show({
          type: "warning",
          text1: i18nText(
            "autoI18n.media_removed_from_list",
            "{{media}} {{list}} listesinden kaldırıldı!",
            { media: kindLabel, list: key },
          ),
        });
      }
    } catch (error) {
      setOptimistic((prev) => ({ ...prev, [key]: current }));
      Toast.show({
        type: "error",
        text1: i18nText("autoI18n.hata_2", "Hata: ") + (error?.message || ""),
      });
    }
  };

  const goToLists = () => {
    onClose?.();
    navigation?.navigate("ListsViewScreen");
  };

  const hasLists = (otherListKeys || []).length > 0;

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      intensity={50}
      sheetStyle={[
        styles.sheet,
        { backgroundColor: theme.secondary, borderColor: theme.border },
      ]}
    >
      <View style={[styles.handle, { backgroundColor: theme.border }]} />

      <View style={styles.sheetHeader}>
        <View style={styles.sheetTitleRow}>
          <View style={[styles.headerIconBg, { backgroundColor: theme.accent + "20" }]}>
            <Ionicons name="grid" size={16} color={theme.accent} />
          </View>
          <View>
            <Text allowFontScaling={false} style={[styles.sheetTitle, { color: theme.text.primary }]}>
              {i18nText("autoI18n.diger_listeler", "Diğer Listeler")}
            </Text>
            {hasLists && (
              <Text allowFontScaling={false} style={[styles.sheetSubtitle, { color: theme.text.muted }]}>
                {otherListKeys.length}{i18nText("autoI18n.liste_3", "liste ·")}{trueCount}{i18nText("autoI18n.secili", "seçili")}
              </Text>
            )}
          </View>
        </View>
        <TouchableOpacity
          onPress={onClose}
          style={[styles.closeBtn, { backgroundColor: theme.primary }]}
        >
          <Ionicons name="close" size={15} color={theme.text.muted} />
        </TouchableOpacity>
      </View>

      <View style={[styles.separator, { backgroundColor: theme.border }]} />

      {hasLists ? (
        <>
          <FlatList
            data={otherListKeys}
            keyExtractor={(key) => key}
            numColumns={3}
            contentContainerStyle={styles.gridContainer}
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: 300 }}
            columnWrapperStyle={{ gap: 10 }}
            renderItem={({ item: key }) => (
              <GridCard
                label={key}
                active={isIn(key)}
                theme={theme}
                onPress={() => toggle(key)}
              />
            )}
          />
          <View style={[styles.separator, { backgroundColor: theme.border, marginTop: 12, marginBottom: 12 }]} />
          <View style={styles.sheetActions}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: theme.primary, borderColor: theme.border }]}
              onPress={onClose}
            >
              <Ionicons name="close-circle-outline" size={15} color={theme.text.muted} />
              <Text allowFontScaling={false} style={[styles.actionBtnText, { color: theme.text.muted }]}>
                {i18nText("autoI18n.kapat", "Kapat")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: theme.accent }]}
              onPress={goToLists}
            >
              <Ionicons name="list" size={15} color="#fff" />
              <Text allowFontScaling={false} style={[styles.actionBtnText, { color: "#fff" }]}>
                {i18nText("autoI18n.tum_listeler", "Tüm Listeler")}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconBg, { backgroundColor: theme.primary }]}>
            <Ionicons name="folder-open-outline" size={36} color={theme.text.muted} />
          </View>
          <Text allowFontScaling={false} style={[styles.emptyTitle, { color: theme.text.primary }]}>
            {i18nText("autoI18n.liste_bulunamadi", "Liste Bulunamadı")}
          </Text>
          <Text allowFontScaling={false} style={[styles.emptySubtitle, { color: theme.text.muted }]}>
            {i18nText(
              "autoI18n.henuz_ozel_liste_olusturmadin_listeler_ekranindan_",
              "Henüz özel liste oluşturmadın. Listeler ekranından yeni liste ekleyebilirsin.",
            )}
          </Text>
          <View style={[styles.separator, { backgroundColor: theme.border, marginBottom: 4 }]} />
          <View style={styles.sheetActions}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: theme.primary, borderColor: theme.border }]}
              onPress={onClose}
            >
              <Ionicons name="close-circle-outline" size={15} color={theme.text.muted} />
              <Text allowFontScaling={false} style={[styles.actionBtnText, { color: theme.text.muted }]}>
                {t.cancel || i18nText("autoI18n.iptal", "İptal")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: theme.accent }]}
              onPress={goToLists}
            >
              <Ionicons name="add-circle-outline" size={15} color="#fff" />
              <Text allowFontScaling={false} style={[styles.actionBtnText, { color: "#fff" }]}>
                {i18nText("autoI18n.liste_olustur", "Liste Oluştur")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    maxHeight: "82%",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
  },
  handle: { width: 42, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 14 },
  sheetHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  sheetTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerIconBg: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  sheetTitle: { fontSize: 16, fontWeight: "800" },
  sheetSubtitle: { fontSize: 11, marginTop: 2, fontWeight: "600" },
  closeBtn: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  separator: { height: StyleSheet.hairlineWidth, marginVertical: 12 },
  gridContainer: { gap: 10, paddingBottom: 4 },
  gridCard: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  gridCardIcon: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  gridCardLabel: { fontSize: 11, fontWeight: "700", textAlign: "center" },
  sheetActions: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "transparent",
  },
  actionBtnText: { fontSize: 13, fontWeight: "700" },
  emptyContainer: { alignItems: "center", paddingVertical: 10, gap: 10 },
  emptyIconBg: { width: 68, height: 68, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 15, fontWeight: "800" },
  emptySubtitle: { fontSize: 12.5, textAlign: "center", lineHeight: 17, paddingHorizontal: 10 },
});
