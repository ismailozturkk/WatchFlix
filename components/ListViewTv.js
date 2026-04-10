import React, { useEffect, useState } from "react";
import {
  View,
  TouchableOpacity,
  Modal,
  Text,
  StyleSheet,
  FlatList,
  Animated,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import LottieView from "lottie-react-native";
import { useListStatusContext } from "../context/ListStatusContext";
import { BlurView } from "expo-blur";

const ListViewTv = ({
  updateList,
  type,
  navigation,
  openModal,
  addShowToFirestore,
  isSeasonWatched,
  listStates,
  isLoading,
}) => {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [otherLists, setOtherLists] = useState();
  const [fullLists, setFullLists] = useState();
  const trueCount = otherLists?.filter((list) => listStates[list]).length;

  const [scaleValues, setScaleValues] = useState({});
  useEffect(() => {
    const newScaleValues = {};
    (fullLists || []).forEach((listName) => {
      newScaleValues[listName] = new Animated.Value(1);
    });
    setScaleValues(newScaleValues);
  }, [fullLists]);

  const onPressIn = (listName) => {
    if (!scaleValues[listName]) return;
    Animated.spring(scaleValues[listName], {
      toValue: 0.6,
      friction: 3,
      tension: 200,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = (listName) => {
    if (!scaleValues[listName]) return;
    Animated.spring(scaleValues[listName], {
      toValue: 1,
      friction: 3,
      tension: 200,
      useNativeDriver: true,
    }).start();
  };

  const { allLists } = useListStatusContext();

  useEffect(() => {
    if (!allLists) {
      setFullLists([]);
      setOtherLists([]);
      return;
    }
    const predefinedLists = ["watchedTv", "favorites", "watchList", "watchedMovies"];
    setFullLists(Object.keys(allLists));
    setOtherLists(Object.keys(allLists).filter((list) => !predefinedLists.includes(list)));
  }, [allLists]);

  return (
    <View
      style={[
        styles.stats,
        { backgroundColor: theme.secondary, shadowColor: theme.shadow },
      ]}
    >
      {/* İzleme Listesi */}
      <TouchableOpacity
        onPressIn={() => onPressIn("watchList")}
        onPressOut={() => onPressOut("watchList")}
        onPress={() => updateList("watchList", type)}
      >
        <Animated.View style={{ transform: [{ scale: scaleValues["watchList"] || 1 }] }}>
          {listStates["watchList"] ? (
            <Ionicons name="bookmark" size={32} color={theme.colors.blue} />
          ) : (
            <Ionicons name="bookmark-outline" size={32} color={theme.text.secondary} />
          )}
        </Animated.View>
      </TouchableOpacity>

      {/* İzlendi */}
      <TouchableOpacity
        onPressIn={() => onPressIn("watchedTv")}
        onPressOut={() => onPressOut("watchedTv")}
        onPress={() => (!listStates["watchedTv"] ? openModal() : addShowToFirestore(new Date()))}
      >
        <Animated.View style={{ transform: [{ scale: scaleValues["watchedTv"] || 1 }] }}>
          {isLoading ? (
            <LottieView
              source={require("../LottieJson/loading15.json")}
              style={{ width: 32, height: 32 }}
              autoPlay
              loop
            />
          ) : listStates["watchedTv"] ? (
            <Ionicons
              name="eye"
              size={32}
              color={isSeasonWatched === 1 ? theme.colors.green : theme.colors.orange}
            />
          ) : (
            <Ionicons name="eye-outline" size={32} color={theme.text.secondary} />
          )}
        </Animated.View>
      </TouchableOpacity>

      {/* Favoriler */}
      <TouchableOpacity
        onPressIn={() => onPressIn("favorites")}
        onPressOut={() => onPressOut("favorites")}
        onPress={() => updateList("favorites", type)}
      >
        <Animated.View style={{ transform: [{ scale: scaleValues["favorites"] || 1 }] }}>
          {listStates["favorites"] ? (
            <Ionicons name="heart" size={32} color={theme.colors.red} />
          ) : (
            <Ionicons name="heart-outline" size={32} color={theme.text.secondary} />
          )}
        </Animated.View>
      </TouchableOpacity>

      {/* Diğer Listeler butonu */}
      <TouchableOpacity
        onPress={() => setModalVisible(true)}
        style={{ justifyContent: "center", alignItems: "center" }}
      >
        <View style={{ flexDirection: "row", gap: 0 }}>
          <Ionicons name="square" size={14} color={otherLists?.length > 0 ? (trueCount > 0 ? theme.colors.green : theme.accent) : theme.between} />
          <Ionicons name="square" size={14} color={otherLists?.length > 1 ? (trueCount > 1 ? theme.colors.green : theme.accent) : theme.between} />
        </View>
        <View style={{ flexDirection: "row", gap: 0 }}>
          <Ionicons name="square" size={14} color={otherLists?.length > 2 ? (trueCount > 2 ? theme.colors.green : theme.accent) : theme.between} />
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <View style={{ flexDirection: "row", gap: 0 }}>
              <Ionicons name="square" size={6} color={otherLists?.length > 3 ? (trueCount > 3 ? theme.colors.green : theme.accent) : theme.between} />
              <Ionicons name="square" size={6} color={otherLists?.length > 4 ? (trueCount > 4 ? theme.colors.green : theme.accent) : theme.between} />
            </View>
            <View style={{ flexDirection: "row", gap: 0 }}>
              <Ionicons name="square" size={6} color={otherLists?.length > 5 ? (trueCount > 5 ? theme.colors.green : theme.accent) : theme.between} />
              <Ionicons name="square" size={6} color={otherLists?.length > 6 ? (trueCount > 6 ? theme.colors.green : theme.accent) : theme.between} />
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {/* Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.overlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
          />
          <BlurView
            tint="dark"
            intensity={40}
            experimentalBlurMethod="dimezisBlurView"
            style={StyleSheet.absoluteFill}
          />

          <View style={[styles.sheet, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
            {/* Handle */}
            <View style={[styles.handle, { backgroundColor: theme.border }]} />

            {/* Başlık */}
            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleRow}>
                <View style={[styles.sheetIconWrap, { backgroundColor: theme.accent + "22" }]}>
                  <Ionicons name="grid" size={18} color={theme.accent} />
                </View>
                <Text allowFontScaling={false} style={[styles.sheetTitle, { color: theme.text.primary }]}>
                  Diğer Listeler
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={[styles.closeBtn, { backgroundColor: theme.primary }]}
              >
                <Ionicons name="close" size={16} color={theme.text.muted} />
              </TouchableOpacity>
            </View>

            {otherLists?.length > 0 ? (
              <>
                <FlatList
                  data={otherLists}
                  keyExtractor={(item) => item}
                  numColumns={3}
                  contentContainerStyle={styles.gridContainer}
                  showsVerticalScrollIndicator={false}
                  style={{ maxHeight: 320 }}
                  renderItem={({ item }) => {
                    const isIn = !!listStates[item];
                    return (
                      <TouchableOpacity
                        style={[
                          styles.gridItem,
                          {
                            backgroundColor: isIn ? theme.colors.green + "18" : theme.primary,
                            borderColor: isIn ? theme.colors.green + "55" : theme.border,
                          },
                        ]}
                        onPress={() => updateList(item, type)}
                        onPressIn={() => onPressIn(item)}
                        onPressOut={() => onPressOut(item)}
                        activeOpacity={0.75}
                      >
                        <Animated.View
                          style={{
                            transform: [{ scale: scaleValues[item] || 1 }],
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <View style={[styles.gridIconWrap, { backgroundColor: isIn ? theme.colors.green + "30" : theme.secondary }]}>
                            <Ionicons
                              name={isIn ? "checkmark-circle" : "grid-outline"}
                              size={28}
                              color={isIn ? theme.colors.green : theme.text.muted}
                            />
                          </View>
                          <Text
                            allowFontScaling={false}
                            style={[styles.gridLabel, { color: isIn ? theme.colors.green : theme.text.secondary }]}
                            numberOfLines={2}
                          >
                            {item}
                          </Text>
                        </Animated.View>
                      </TouchableOpacity>
                    );
                  }}
                />
                <View style={styles.sheetActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: theme.primary, borderColor: theme.border }]}
                    onPress={() => setModalVisible(false)}
                  >
                    <Ionicons name="close-circle-outline" size={16} color={theme.text.muted} />
                    <Text allowFontScaling={false} style={[styles.actionBtnText, { color: theme.text.muted }]}>Kapat</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: theme.accent, borderColor: theme.accent }]}
                    onPress={() => { setModalVisible(false); navigation.navigate("ListsViewScreen"); }}
                  >
                    <Ionicons name="list" size={16} color="#fff" />
                    <Text allowFontScaling={false} style={[styles.actionBtnText, { color: "#fff" }]}>Tüm Listeler</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={styles.emptyContainer}>
                <View style={[styles.emptyIconWrap, { backgroundColor: theme.primary }]}>
                  <Ionicons name="folder-open-outline" size={40} color={theme.text.muted} />
                </View>
                <Text allowFontScaling={false} style={[styles.emptyTitle, { color: theme.text.primary }]}>
                  Liste Bulunamadı
                </Text>
                <Text allowFontScaling={false} style={[styles.emptySubtitle, { color: theme.text.muted }]}>
                  Henüz özel liste oluşturmadın. Listeler ekranından yeni liste ekleyebilirsin.
                </Text>
                <View style={styles.sheetActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: theme.primary, borderColor: theme.border }]}
                    onPress={() => setModalVisible(false)}
                  >
                    <Ionicons name="close-circle-outline" size={16} color={theme.text.muted} />
                    <Text allowFontScaling={false} style={[styles.actionBtnText, { color: theme.text.muted }]}>{t.cancel}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: theme.accent, borderColor: theme.accent }]}
                    onPress={() => { setModalVisible(false); navigation.navigate("ListsViewScreen"); }}
                  >
                    <Ionicons name="add-circle-outline" size={16} color="#fff" />
                    <Text allowFontScaling={false} style={[styles.actionBtnText, { color: "#fff" }]}>Liste Oluştur</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  stats: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 15,
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sheetTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sheetIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  gridContainer: {
    gap: 10,
    paddingBottom: 4,
  },
  gridItem: {
    flex: 1,
    margin: 4,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  gridIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  gridLabel: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  sheetActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 10,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 20,
    lineHeight: 19,
  },
});

export default ListViewTv;
