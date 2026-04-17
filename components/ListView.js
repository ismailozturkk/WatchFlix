import React, { useEffect, useState, useRef } from "react";
import {
  View,
  TouchableOpacity,
  Modal,
  Text,
  StyleSheet,
  FlatList,
  Animated,
  Pressable,
  Dimensions,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import LottieView from "lottie-react-native";
import { useListStatusContext } from "../context/ListStatusContext";
import { BlurView } from "expo-blur";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
const { width: SCREEN_WIDTH } = Dimensions.get("window");

/* ─── Küçük yardımcı ─────────────────────────────────── */
const formatDateSave = (timestamp) => {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

/* ─── Ana buton bileşeni ──────────────────────────────── */
const ActionButton = ({
  onPress,
  onPressIn,
  onPressOut,
  scale,
  children,
  badge,
}) => (
  <TouchableOpacity
    onPress={onPress}
    onPressIn={onPressIn}
    onPressOut={onPressOut}
    activeOpacity={0.85}
    style={styles.actionButtonWrapper}
  >
    <Animated.View style={{ transform: [{ scale: scale || 1 }] }}>
      {children}
      {badge != null && badge > 0 && (
        <View style={styles.badgeWrap}>
          <Text allowFontScaling={false} style={styles.badgeText}>
            {badge}
          </Text>
        </View>
      )}
    </Animated.View>
  </TouchableOpacity>
);

/* ─── Grid liste kartı ────────────────────────────────── */
const GridCard = ({
  item,
  isIn,
  scale,
  theme,
  onPress,
  onPressIn,
  onPressOut,
}) => (
  <TouchableOpacity
    style={[
      styles.gridCard,
      {
        backgroundColor: isIn ? theme.colors.green + "15" : theme.primary,
        borderColor: isIn ? theme.colors.green + "60" : theme.border,
      },
    ]}
    onPress={onPress}
    onPressIn={onPressIn}
    onPressOut={onPressOut}
    activeOpacity={0.75}
  >
    <Animated.View
      style={{
        transform: [{ scale: scale || 1 }],
        alignItems: "center",
        gap: 8,
      }}
    >
      <View
        style={[
          styles.gridCardIcon,
          {
            backgroundColor: isIn ? theme.colors.green + "25" : theme.secondary,
          },
        ]}
      >
        <Ionicons
          name={isIn ? "checkmark-circle" : "folder-outline"}
          size={26}
          color={isIn ? theme.colors.green : theme.text.muted}
        />
      </View>
      <Text
        allowFontScaling={false}
        numberOfLines={2}
        style={[
          styles.gridCardLabel,
          { color: isIn ? theme.colors.green : theme.text.secondary },
        ]}
      >
        {item}
      </Text>
    </Animated.View>
  </TouchableOpacity>
);

/* ─── Ana bileşen ─────────────────────────────────────── */
const ListView = ({
  updateList,
  watchList,
  watched,
  favorite,
  type,
  navigation,
  updateWatchedList,
  isRemaining,
  isReminderSet,
  addReminder,
  listStates,
  isLoading,
}) => {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { allLists } = useListStatusContext();

  const [modalVisible, setModalVisible] = useState(false);
  const [otherLists, setOtherLists] = useState([]);
  const [fullLists, setFullLists] = useState([]);
  const [scaleValues, setScaleValues] = useState({});

  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const trueCount = otherLists?.filter((list) => listStates[list]).length;

  /* ── liste verisi ── */
  useEffect(() => {
    if (!allLists) {
      setFullLists([]);
      setOtherLists([]);
      return;
    }
    const predefined = ["watchedTv", "favorites", "watchList", "watchedMovies"];
    const keys = Object.keys(allLists);
    setFullLists(keys);
    setOtherLists(keys.filter((l) => !predefined.includes(l)));
  }, [allLists]);

  /* ── animasyon değerleri ── */
  useEffect(() => {
    const vals = {};
    (fullLists || []).forEach((name) => {
      vals[name] = new Animated.Value(1);
    });
    setScaleValues(vals);
  }, [fullLists]);

  const onPressIn = (name) => {
    if (!scaleValues[name]) return;
    Animated.spring(scaleValues[name], {
      toValue: 0.65,
      friction: 4,
      tension: 220,
      useNativeDriver: true,
    }).start();
  };
  const onPressOut = (name) => {
    if (!scaleValues[name]) return;
    Animated.spring(scaleValues[name], {
      toValue: 1,
      friction: 4,
      tension: 220,
      useNativeDriver: true,
    }).start();
  };

  /* ── modal aç/kapat ── */
  const openModal = () => {
    setModalVisible(true);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 7,
        tension: 60,
        useNativeDriver: true,
      }),
    ]).start();
  };
  const closeModal = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setModalVisible(false));
  };

  /* ── icon tanımları ── */
  const ICONS = [
    {
      key: "watchList",
      icon: listStates["watchList"] ? "bookmark" : "bookmark-outline",
      color: listStates["watchList"] ? theme.colors.blue : theme.text.secondary,
      label: t.watchlist || "Liste",
      onPress: () => updateList("watchList", type, formatDateSave(new Date())),
    },
    {
      key: "watchedMovies",
      isEye: true,
    },
    {
      key: "favorites",
      icon: listStates["favorites"] ? "heart" : "heart-outline",
      color: listStates["favorites"] ? theme.colors.red : theme.text.secondary,
      label: t.favorites || "Favori",
      onPress: () => updateList("favorites", type, formatDateSave(new Date())),
    },
  ];

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.secondary, shadowColor: theme.shadow },
      ]}
    >
      {/* ── Standart butonlar ── */}
      {ICONS.map(({ key, icon, color, label, onPress, isEye }) => {
        if (isEye) {
          const isReminderMode = isRemaining || isReminderSet;
          return (
            <View key={key} style={styles.iconCol}>
              <ActionButton
                scale={scaleValues[key]}
                onPressIn={() => onPressIn(key)}
                onPressOut={() => onPressOut(key)}
                onPress={
                  isReminderMode
                    ? addReminder
                    : () =>
                        listStates["watchedMovies"]
                          ? updateList(
                              "watchedMovies",
                              type,
                              formatDateSave(new Date()),
                            )
                          : updateWatchedList()
                }
              >
                {isReminderMode ? (
                  <MaterialCommunityIcons
                    name={isReminderSet ? "bell-ring" : "bell-ring-outline"}
                    size={30}
                    color={
                      isReminderSet ? theme.colors.orange : theme.text.secondary
                    }
                  />
                ) : listStates["watchedMovies"] ? (
                  <Ionicons name="eye" size={30} color={theme.colors.green} />
                ) : isLoading ? (
                  <LottieView
                    source={require("../LottieJson/loading15.json")}
                    style={{ width: 30, height: 30 }}
                    autoPlay
                    loop
                  />
                ) : (
                  <Ionicons
                    name="eye-outline"
                    size={30}
                    color={theme.text.secondary}
                  />
                )}
              </ActionButton>
              <Text
                allowFontScaling={false}
                style={[styles.iconLabel, { color: theme.text.muted }]}
              >
                {t.watched || "İzledim"}
              </Text>
            </View>
          );
        }
        return (
          <View key={key} style={styles.iconCol}>
            <ActionButton
              scale={scaleValues[key]}
              onPressIn={() => onPressIn(key)}
              onPressOut={() => onPressOut(key)}
              onPress={onPress}
            >
              <Ionicons name={icon} size={30} color={color} />
            </ActionButton>
            <Text
              allowFontScaling={false}
              style={[styles.iconLabel, { color: theme.text.muted }]}
            >
              {label}
            </Text>
          </View>
        );
      })}

      {/* ── Diğer listeler butonu ── */}
      <View style={styles.iconCol}>
        <ActionButton
          onPress={openModal}
          badge={
            trueCount > 0
              ? trueCount
              : otherLists?.length > 0
                ? trueCount
                : null
          }
        >
          <View
            style={[
              styles.appsIconWrap,
              {
                backgroundColor:
                  trueCount > 0
                    ? theme.colors.orange + "18"
                    : otherLists?.length > 0
                      ? theme.accent + "15"
                      : theme.primary,
                borderColor:
                  trueCount > 0
                    ? theme.colors.orange + "55"
                    : otherLists?.length > 0
                      ? theme.accent + "40"
                      : theme.border,
              },
            ]}
          >
            <Ionicons
              name={trueCount > 0 ? "grid" : "grid-outline"}
              size={22}
              color={
                trueCount > 0
                  ? theme.colors.orange
                  : otherLists?.length > 0
                    ? theme.accent
                    : theme.text.secondary
              }
            />
          </View>
        </ActionButton>
        <Text
          allowFontScaling={false}
          style={[styles.iconLabel, { color: theme.text.muted }]}
        >
          {t.otherLists || "Diğerleri"}
        </Text>
      </View>

      {/* ─────────── MODAL ─────────── */}
      <Modal
        transparent
        visible={modalVisible}
        animationType="none"
        onRequestClose={closeModal}
      >
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeModal} />
          <BlurView
            tint="dark"
            intensity={50}
            experimentalBlurMethod="dimezisBlurView"
            style={StyleSheet.absoluteFill}
          />

          <Animated.View
            style={[
              styles.sheet,
              { backgroundColor: theme.secondary, borderColor: theme.border },
              { transform: [{ translateY: slideAnim }] },
            ]}
          >
            {/* Handle */}
            <View style={[styles.handle, { backgroundColor: theme.border }]} />

            {/* Header */}
            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleRow}>
                <View
                  style={[
                    styles.headerIconBg,
                    { backgroundColor: theme.accent + "20" },
                  ]}
                >
                  <Ionicons name="grid" size={16} color={theme.accent} />
                </View>
                <View>
                  <Text
                    allowFontScaling={false}
                    style={[styles.sheetTitle, { color: theme.text.primary }]}
                  >
                    {t.otherLists || "Diğer Listeler"}
                  </Text>
                  {otherLists?.length > 0 && (
                    <Text
                      allowFontScaling={false}
                      style={[
                        styles.sheetSubtitle,
                        { color: theme.text.muted },
                      ]}
                    >
                      {otherLists.length} liste · {trueCount} seçili
                    </Text>
                  )}
                </View>
              </View>
              <TouchableOpacity
                onPress={closeModal}
                style={[styles.closeBtn, { backgroundColor: theme.primary }]}
              >
                <Ionicons name="close" size={15} color={theme.text.muted} />
              </TouchableOpacity>
            </View>

            {/* Separator */}
            <View
              style={[styles.separator, { backgroundColor: theme.border }]}
            />

            {otherLists?.length > 0 ? (
              <>
                <FlatList
                  data={otherLists}
                  keyExtractor={(item) => item}
                  numColumns={3}
                  contentContainerStyle={styles.gridContainer}
                  showsVerticalScrollIndicator={false}
                  style={{ maxHeight: 300 }}
                  columnWrapperStyle={{ gap: 10 }}
                  renderItem={({ item }) => (
                    <GridCard
                      item={item}
                      isIn={!!listStates[item]}
                      scale={scaleValues[item]}
                      theme={theme}
                      onPress={() =>
                        updateList(item, type, formatDateSave(new Date()))
                      }
                      onPressIn={() => onPressIn(item)}
                      onPressOut={() => onPressOut(item)}
                    />
                  )}
                />

                {/* Eylemler */}
                <View
                  style={[
                    styles.separator,
                    { backgroundColor: theme.border, marginBottom: 12 },
                  ]}
                />
                <View style={styles.sheetActions}>
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      {
                        backgroundColor: theme.primary,
                        borderColor: theme.border,
                      },
                    ]}
                    onPress={closeModal}
                  >
                    <Ionicons
                      name="close-circle-outline"
                      size={15}
                      color={theme.text.muted}
                    />
                    <Text
                      allowFontScaling={false}
                      style={[
                        styles.actionBtnText,
                        { color: theme.text.muted },
                      ]}
                    >
                      Kapat
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      { backgroundColor: theme.accent },
                    ]}
                    onPress={() => {
                      closeModal();
                      navigation.navigate("ListsViewScreen");
                    }}
                  >
                    <Ionicons name="list" size={15} color="#fff" />
                    <Text
                      allowFontScaling={false}
                      style={[styles.actionBtnText, { color: "#fff" }]}
                    >
                      Tüm Listeler
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              /* Boş durum */
              <View style={styles.emptyContainer}>
                <View
                  style={[
                    styles.emptyIconBg,
                    { backgroundColor: theme.primary },
                  ]}
                >
                  <Ionicons
                    name="folder-open-outline"
                    size={36}
                    color={theme.text.muted}
                  />
                </View>
                <Text
                  allowFontScaling={false}
                  style={[styles.emptyTitle, { color: theme.text.primary }]}
                >
                  Liste Bulunamadı
                </Text>
                <Text
                  allowFontScaling={false}
                  style={[styles.emptySubtitle, { color: theme.text.muted }]}
                >
                  Henüz özel liste oluşturmadın. Listeler ekranından yeni liste
                  ekleyebilirsin.
                </Text>
                <View
                  style={[
                    styles.separator,
                    { backgroundColor: theme.border, marginBottom: 4 },
                  ]}
                />
                <View style={styles.sheetActions}>
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      {
                        backgroundColor: theme.primary,
                        borderColor: theme.border,
                      },
                    ]}
                    onPress={closeModal}
                  >
                    <Ionicons
                      name="close-circle-outline"
                      size={15}
                      color={theme.text.muted}
                    />
                    <Text
                      allowFontScaling={false}
                      style={[
                        styles.actionBtnText,
                        { color: theme.text.muted },
                      ]}
                    >
                      {t.cancel || "İptal"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      { backgroundColor: theme.accent },
                    ]}
                    onPress={() => {
                      closeModal();
                      navigation.navigate("ListsViewScreen");
                    }}
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={15}
                      color="#fff"
                    />
                    <Text
                      allowFontScaling={false}
                      style={[styles.actionBtnText, { color: "#fff" }]}
                    >
                      Liste Oluştur
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </Animated.View>
        </Animated.View>
      </Modal>
    </View>
  );
};

/* ─── Styles ──────────────────────────────────────────── */
const styles = StyleSheet.create({
  /* Ana kart */
  container: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 18,
    marginBottom: 20,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 6,
  },

  /* İkon kolonları */
  iconCol: {
    alignItems: "center",
    gap: 5,
    flex: 1,
  },
  iconLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  actionButtonWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
  },

  /* Badge */
  badgeWrap: {
    position: "absolute",
    top: -3,
    right: -4,
    backgroundColor: "#FF6B35",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
  },

  /* Diğer listeler butonu */
  appsIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  /* ── MODAL ── */
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 18,
    paddingBottom: 36,
    paddingTop: 14,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 18,
  },
  separator: {
    height: 1,
    marginVertical: 14,
    borderRadius: 1,
  },

  /* Header */
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  sheetTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerIconBg: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  sheetSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Grid */
  gridContainer: {
    gap: 10,
    paddingBottom: 4,
  },
  gridCard: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  gridCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  gridCardLabel: {
    fontSize: 10.5,
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: 0.1,
  },

  /* Eylemler */
  sheetActions: {
    flexDirection: "row",
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "transparent",
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.1,
  },

  /* Boş durum */
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 8,
  },
  emptyIconBg: {
    width: 68,
    height: 68,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  emptySubtitle: {
    fontSize: 12.5,
    textAlign: "center",
    paddingHorizontal: 16,
    lineHeight: 18,
  },
});

export default ListView;
