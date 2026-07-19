import React, { useState, useRef } from "react";
import {
  View,
  TouchableOpacity,
  Modal,
  Text,
  StyleSheet,
  FlatList,
  Animated,
  Easing,
  Pressable,
  Dimensions,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import LottieView from "lottie-react-native";
import { useListStatusContext } from "../context/ListStatusContext";
import { useSharedLists } from "../context/SharedListsContext";
import SharedListsSection from "./SharedListsSection";
import { useHapticsSettings } from "../context/AppSettingsContext";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { i18nText } from "../utils/i18nText";
import {
  WATCH_STATE,
  WATCH_STATE_LABEL_KEY,
  watchStateColor,
} from "../utils/watchState";


/* ─── Küçük buton sarmalayıcı ─────────────────── */
const ActionButton = ({
  onPress,
  scale,
  opacity,
  children,
  label,
  theme,
}) => (
  <View style={styles.iconCol}>
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={1}
      style={styles.actionButtonWrapper}
    >
      <Animated.View
        style={{
          transform: [{ scale: scale || 1 }],
          opacity: opacity !== undefined ? opacity : 1,
        }}
      >
        {children}
      </Animated.View>
    </TouchableOpacity>
    {label ? (
      <Text
        allowFontScaling={false}
        style={[styles.iconLabel, { color: theme?.text?.muted || "#999" }]}
      >
        {label}
      </Text>
    ) : null}
  </View>
);

/* ─── Grid liste kartı ──────────────────────────── */
const GridCard = ({
  item,
  isIn,
  scale,
  opacity,
  theme,
  onPress,
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
    activeOpacity={1}
  >
    <Animated.View
      style={{
        transform: [{ scale: scale || 1 }],
        opacity: opacity !== undefined ? opacity : 1,
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

/* ─── Ana bileşen ───────────────────────────────── */
const ListViewTv = ({
  updateList,
  type,
  navigation,
  openModal,
  addShowToFirestore,
  isSeasonWatched,
  listStates,
  isLoading,
  // İzlendi butonu 4 durumlu: showWatchState + handler'lar
  showWatchState = WATCH_STATE.NONE,
  onMarkWatched,
  onUnmarkWatched,
  watchedOverride = null,
  sharedItem, // ortak listeler için medya payload'ı ({id,type,name,imagePath,...})
}) => {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { otherListKeys, allListKeys } = useListStatusContext();
  const { sharedLists } = useSharedLists();
  const { hapticsEnabled } = useHapticsSettings();

  const [modalVisible, setModalVisible] = useState(false);
  const [optimisticStates, setOptimisticStates] = useState({});

  React.useEffect(() => {
    setOptimisticStates({});
  }, [listStates, isSeasonWatched]);

  const getIsActive = (key) => {
    if (optimisticStates[key] !== undefined) return optimisticStates[key];
    if (key === "seasonWatched") return isSeasonWatched === 1;
    return listStates[key];
  };

  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleValuesRef   = useRef({});
  const opacityValuesRef = useRef({});

  // Sabit + dinamik key'ler için Animated.Value başlat
  const initKey = (k) => {
    if (!scaleValuesRef.current[k])   scaleValuesRef.current[k]   = new Animated.Value(1);
    if (!opacityValuesRef.current[k]) opacityValuesRef.current[k] = new Animated.Value(1);
  };
  ["watchList", "watchedTv", "favorites", "apps"].forEach(initKey);
  allListKeys.forEach(initKey);

  const trueCount = otherListKeys.filter((list) => getIsActive(list)).length;

  /* ── Animasyonlar ── */
  const animateBounce = (name) => {
    if (hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const sc = scaleValuesRef.current[name];
    if (!sc) return;
    
    // Animasyonu anında resetle ve küçült
    sc.stopAnimation();
    sc.setValue(0.75);
    
    // Zıplayarak geri dön
    Animated.spring(sc, {
      toValue: 1,
      mass: 1,
      stiffness: 250,
      damping: 12, // Düşük damping = daha fazla zıplama (bounce)
      useNativeDriver: true,
    }).start();
  };

  const handleOptimisticPress = (key, action, toggle = true) => {
    animateBounce(key);
    
    if (toggle) {
      const currentState = getIsActive(key);
      setOptimisticStates((prev) => ({ ...prev, [key]: !currentState }));
    }
    // Animasyonun donmaması için ana işlemi erteliyoruz
    setTimeout(() => {
      action();
    }, 15);
  };

  /* ── modal animasyonları ── */
  const openSheet = () => {
    setModalVisible(true);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        mass: 1,
        stiffness: 250,
        damping: 22,
        useNativeDriver: true,
      }),
    ]).start();
  };
  const closeSheet = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 200,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => setModalVisible(false));
  };

  /* ── İzlenme durumu rengi/etiketi (4 durum) ── */
  const watchedColor = watchStateColor(showWatchState, theme);
  const watchedLabel =
    t[WATCH_STATE_LABEL_KEY[showWatchState]] ||
    i18nText("autoI18n.izledim", "İzledim");
  const isWatchedActive =
    showWatchState === WATCH_STATE.PARTIAL ||
    showWatchState === WATCH_STATE.FULL;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.secondary, shadowColor: theme.shadow },
      ]}
    >
      {/* İzleme Listesi */}
      <ActionButton
        scale={scaleValuesRef.current["watchList"]}
        opacity={opacityValuesRef.current["watchList"]}
        onPress={() => handleOptimisticPress("watchList", () => updateList("watchList", type))}
        label={getIsActive("watchList")
          ? i18nText("autoI18n.listede", "Listede")
          : i18nText("autoI18n.izleme_listesi", "İzleme Listesi")}
        theme={theme}
      >
        <Ionicons
          name={getIsActive("watchList") ? "bookmark" : "bookmark-outline"}
          size={30}
          color={getIsActive("watchList") ? theme.colors.blue : theme.text.secondary}
        />
      </ActionButton>

      {/* İzlendi / İzleniyor / İzle / Hatırlat (4 durum) */}
      {watchedOverride ? (
        // Yayınlanmadı → çan / Hatırlat (Reminder bileşeni dışarıdan gelir)
        <View style={styles.iconCol}>
          <View style={styles.actionButtonWrapper}>{watchedOverride}</View>
          <Text
            allowFontScaling={false}
            style={[styles.iconLabel, { color: theme?.text?.muted || "#999" }]}
          >
            {t.remind || i18nText("autoI18n.hatirlat", "Hatırlat")}
          </Text>
        </View>
      ) : (
        <ActionButton
          scale={scaleValuesRef.current["watchedTv"]}
          opacity={opacityValuesRef.current["watchedTv"]}
          onPress={() =>
            handleOptimisticPress(
              "watchedTv",
              isWatchedActive ? onUnmarkWatched : onMarkWatched,
              false,
            )
          }
          label={watchedLabel}
          theme={theme}
        >
          {isLoading ? (
            <LottieView
              source={require("@lottie/loading15.json")}
              style={{ width: 30, height: 30 }}
              autoPlay
              loop
            />
          ) : (
            <Ionicons
              name={isWatchedActive ? "eye" : "eye-outline"}
              size={30}
              color={isWatchedActive ? watchedColor : theme.text.secondary}
            />
          )}
        </ActionButton>
      )}

      {/* Favoriler */}
      <ActionButton
        scale={scaleValuesRef.current["favorites"]}
        opacity={opacityValuesRef.current["favorites"]}
        onPress={() => handleOptimisticPress("favorites", () => updateList("favorites", type))}
        label={getIsActive("favorites")
          ? i18nText("autoI18n.favorim", "Favorim")
          : i18nText("autoI18n.favori", "Favori")}
        theme={theme}
      >
        <Ionicons
          name={getIsActive("favorites") ? "heart" : "heart-outline"}
          size={30}
          color={getIsActive("favorites") ? theme.colors.red : theme.text.secondary}
        />
      </ActionButton>

      {/* Diğer listeler butonu */}
      <ActionButton
        scale={scaleValuesRef.current["apps"]}
        opacity={opacityValuesRef.current["apps"]}
        onPress={() => { animateBounce("apps"); openSheet(); }}
        label={t.otherListKeys || i18nText("autoI18n.digerleri", "Diğerleri")}
        theme={theme}
      >
        <View
          style={[
            styles.appsIconWrap,
            {
              backgroundColor:
                trueCount > 0
                  ? theme.colors.orange + "18"
                  : otherListKeys?.length > 0
                    ? theme.accent + "15"
                    : theme.primary,
              borderColor:
                trueCount > 0
                  ? theme.colors.orange + "55"
                  : otherListKeys?.length > 0
                    ? theme.accent + "40"
                    : theme.border,
            },
          ]}
        >
          <Ionicons
            name="apps-outline"
            size={22}
            color={
              trueCount > 0
                ? theme.colors.orange
                : otherListKeys?.length > 0
                  ? theme.accent
                  : theme.text.secondary
            }
          />
          {(trueCount > 0 || otherListKeys?.length > 0) && (
            <View
              style={[
                styles.badge,
                {
                  backgroundColor:
                    trueCount > 0 ? theme.colors.orange : theme.accent,
                },
              ]}
            >
              <Text allowFontScaling={false} style={styles.badgeText}>
                {trueCount > 0 ? trueCount : otherListKeys.length}
              </Text>
            </View>
          )}
        </View>
      </ActionButton>

      {/* ─── MODAL ─── */}
      <Modal
        transparent
        visible={modalVisible}
        animationType="none"
        onRequestClose={closeSheet}
      >
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
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
                <View style={[styles.headerIconBg, { backgroundColor: theme.accent + "20" }]}>
                  <Ionicons name="tv-outline" size={16} color={theme.accent} />
                </View>
                <View>
                  <Text allowFontScaling={false} style={[styles.sheetTitle, { color: theme.text.primary }]}>{i18nText("autoI18n.diger_listeler", "Diğer Listeler")}</Text>
                  {otherListKeys?.length > 0 && (
                    <Text allowFontScaling={false} style={[styles.sheetSubtitle, { color: theme.text.muted }]}>
                      {otherListKeys.length}{i18nText("autoI18n.liste_3", "liste ·")}{trueCount}{i18nText("autoI18n.secili", "seçili")}</Text>
                  )}
                </View>
              </View>
              <TouchableOpacity
                onPress={closeSheet}
                style={[styles.closeBtn, { backgroundColor: theme.primary }]}
              >
                <Ionicons name="close" size={15} color={theme.text.muted} />
              </TouchableOpacity>
            </View>

            {/* Separator */}
            <View style={[styles.separator, { backgroundColor: theme.border }]} />

            {otherListKeys?.length > 0 ||
            (sharedLists.length > 0 && sharedItem) ? (
              <>
                {otherListKeys?.length > 0 && (
                  <FlatList
                    data={otherListKeys}
                    keyExtractor={(item) => item}
                    numColumns={3}
                    contentContainerStyle={styles.gridContainer}
                    showsVerticalScrollIndicator={false}
                    style={{ maxHeight: 300 }}
                    columnWrapperStyle={{ gap: 10 }}
                    renderItem={({ item }) => (
                      <GridCard
                        item={item}
                        isIn={!!getIsActive(item)}
                        scale={scaleValuesRef.current[item]}
                        opacity={opacityValuesRef.current[item]}
                        theme={theme}
                        onPress={() => handleOptimisticPress(item, () => updateList(item, type))}
                      />
                    )}
                  />
                )}

                {/* Ortak listeler */}
                <SharedListsSection
                  sharedItem={sharedItem}
                  visible={modalVisible}
                />
                <View style={[styles.separator, { backgroundColor: theme.border, marginBottom: 12 }]} />
                <View style={styles.sheetActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: theme.primary, borderColor: theme.border }]}
                    onPress={closeSheet}
                  >
                    <Ionicons name="close-circle-outline" size={15} color={theme.text.muted} />
                    <Text allowFontScaling={false} style={[styles.actionBtnText, { color: theme.text.muted }]}>
                      Kapat
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: theme.accent }]}
                    onPress={() => { closeSheet(); navigation.navigate("ListsViewScreen"); }}
                  >
                    <Ionicons name="list" size={15} color="#fff" />
                    <Text allowFontScaling={false} style={[styles.actionBtnText, { color: "#fff" }]}>{i18nText("autoI18n.tum_listeler", "Tüm Listeler")}</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={styles.emptyContainer}>
                <View style={[styles.emptyIconBg, { backgroundColor: theme.primary }]}>
                  <Ionicons name="folder-open-outline" size={36} color={theme.text.muted} />
                </View>
                <Text allowFontScaling={false} style={[styles.emptyTitle, { color: theme.text.primary }]}>{i18nText("autoI18n.liste_bulunamadi", "Liste Bulunamadı")}</Text>
                <Text allowFontScaling={false} style={[styles.emptySubtitle, { color: theme.text.muted }]}>{i18nText("autoI18n.henuz_ozel_liste_olusturmadin_listeler_ekranindan_", "Henüz özel liste oluşturmadın. Listeler ekranından yeni liste ekleyebilirsin.")}</Text>
                <View style={[styles.separator, { backgroundColor: theme.border, marginBottom: 4 }]} />
                <View style={styles.sheetActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: theme.primary, borderColor: theme.border }]}
                    onPress={closeSheet}
                  >
                    <Ionicons name="close-circle-outline" size={15} color={theme.text.muted} />
                    <Text allowFontScaling={false} style={[styles.actionBtnText, { color: theme.text.muted }]}>
                      {t.cancel || i18nText("autoI18n.iptal", "İptal")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: theme.accent }]}
                    onPress={() => { closeSheet(); navigation.navigate("ListsViewScreen"); }}
                  >
                    <Ionicons name="add-circle-outline" size={15} color="#fff" />
                    <Text allowFontScaling={false} style={[styles.actionBtnText, { color: "#fff" }]}>{i18nText("autoI18n.liste_olustur", "Liste Oluştur")}</Text>
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

/* ─── Styles ─────────────────────────────────────── */
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
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
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

  /* Badge */
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
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

export default ListViewTv;
