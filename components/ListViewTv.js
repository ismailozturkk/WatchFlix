import React, { useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import LensLoader from "./LensLoader";
import { useTheme } from "../context/ThemeContext";
import GlassCloseButton from "./common/GlassCloseButton";
import { useLanguage } from "../context/LanguageContext";
import { useListStatusContext } from "../context/ListStatusContext";
import { useSharedLists } from "../context/SharedListsContext";
import SharedListsSection from "./SharedListsSection";
import { useHapticsSettings } from "../context/AppSettingsContext";
import ModalBlurBackdrop from "./common/ModalBlurBackdrop";
import ListActionIcon from "./common/ListActionIcon";
import DetailListActionTile from "./detail/DetailListActionTile";
import * as Haptics from "@services/hapticsService";
import { i18nText } from "../utils/i18nText";
import {
  WATCH_STATE,
  WATCH_STATE_LABEL_KEY,
  watchStateColor,
} from "../utils/watchState";
import { alpha } from "../theme/colors";
import { isLightSurface } from "../utils/colorUtils";
import ModalToastHost from "@components/toast/ModalToastHost";
import GlassTouchable from "./common/GlassTouchable";
import { GLASS_PRESS_ROOM } from "../utils/liquidGlass";

const SHEET_TRAVEL = Math.round(
  (Dimensions.get?.("window")?.height || 800) * 0.88,
);

/* ─── Grid liste kartı ──────────────────────────── */
const GridCard = ({
  item,
  isIn,
  scale,
  opacity,
  theme,
  light,
  onPress,
}) => {
  const tone = theme.colors.green;
  return (
    <GlassTouchable
      style={[
        styles.gridCard,
        {
          backgroundColor: isIn
            ? alpha(tone, light ? 0.13 : 0.16)
            : theme.primary,
          borderColor: isIn
            ? alpha(tone, light ? 0.45 : 0.55)
            : theme.border,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ selected: isIn }}
      accessibilityLabel={item}
    >
      <Animated.View
        style={[
          styles.gridCardContent,
          {
            transform: [{ scale: scale || 1 }],
            opacity: opacity !== undefined ? opacity : 1,
          },
        ]}
      >
        <View
          style={[
            styles.gridCardIcon,
            {
              backgroundColor: isIn
                ? alpha(tone, light ? 0.18 : 0.24)
                : theme.secondary,
            },
          ]}
        >
          <ListActionIcon
            active={isIn}
            activeName="folder"
            inactiveName="folder-outline"
            activeColor={tone}
            inactiveColor={theme.text.muted}
            size={18}
          />
        </View>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[
            styles.gridCardLabel,
            { color: isIn ? tone : theme.text.primary },
          ]}
        >
          {item}
        </Text>
        <View
          style={[
            styles.gridTrailingOrb,
            {
              backgroundColor: isIn
                ? tone
                : alpha(theme.text.primary, light ? 0.055 : 0.075),
            },
          ]}
        >
          <Ionicons
            name={isIn ? "checkmark" : "add"}
            size={isIn ? 12 : 13}
            color={isIn ? "#FFFFFF" : theme.text.muted}
          />
        </View>
      </Animated.View>
    </GlassTouchable>
  );
};

/* ─── Ana bileşen ───────────────────────────────── */
const ListViewTv = ({
  updateList,
  type,
  navigation,
  isSeasonWatched,
  listStates,
  isLoading,
  // İzlendi butonu 4 durumlu: showWatchState + handler'lar
  showWatchState = WATCH_STATE.NONE,
  onMarkWatched,
  onUnmarkWatched,
  watchedOverride = null,
  sharedItem, // ortak listeler için medya payload'ı ({id,type,name,imagePath,...})
  compact = false,
}) => {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const light = isLightSurface(theme.primary);
  const { otherListKeys = [], allListKeys = [] } = useListStatusContext() || {};
  const { sharedLists = [], sharedItemsByList = null } = useSharedLists() || {};
  const { hapticsEnabled } = useHapticsSettings();

  const [modalVisible, setModalVisible] = useState(false);
  const [optimisticStates, setOptimisticStates] = useState({});

  React.useEffect(() => {
    setOptimisticStates({});
  }, [listStates, isSeasonWatched]);

  const safeListStates = listStates || {};
  const getIsActive = (key) => {
    if (optimisticStates[key] !== undefined) return optimisticStates[key];
    if (key === "seasonWatched") return isSeasonWatched === 1;
    return safeListStates[key];
  };

  const slideAnim = useRef(new Animated.Value(SHEET_TRAVEL)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleValuesRef = useRef({});
  const opacityValuesRef = useRef({});

  // Sabit + dinamik key'ler için Animated.Value başlat
  const initKey = (k) => {
    if (!scaleValuesRef.current[k]) scaleValuesRef.current[k] = new Animated.Value(1);
    if (!opacityValuesRef.current[k]) opacityValuesRef.current[k] = new Animated.Value(1);
  };
  ["watchList", "watchedTv", "favorites", "apps"].forEach(initKey);
  allListKeys.forEach(initKey);

  const trueCount = otherListKeys.filter((list) => getIsActive(list)).length;
  const sharedSelectedCount = useMemo(() => {
    if (!sharedItem || sharedItem.id == null || !sharedItemsByList) return 0;
    const targetKey = `${sharedItem.type || type}_${sharedItem.id}`;
    return sharedLists.reduce((acc, list) => {
      const items = sharedItemsByList[list.id];
      return (
        acc +
        (Array.isArray(items) && items.some((it) => it?.key === targetKey) ? 1 : 0)
      );
    }, 0);
  }, [sharedLists, sharedItemsByList, sharedItem, type]);

  const totalSelectedCount = trueCount + sharedSelectedCount;
  const totalAvailableCount =
    (otherListKeys?.length || 0) + (sharedItem ? sharedLists.length : 0);

  /* ── Animasyonlar ── */
  // `mode`: "add" (listeye giriyor) | "remove" (çıkıyor) | "neutral" (durum
  // değiştirmeyen dokunuş). Film tarafıyla (components/ListView.js) birebir
  // aynı davranış — iki detay ekranı arasında his farkı olmamalı.
  const animateBounce = (name, mode = "neutral") => {
    if (hapticsEnabled) {
      Haptics.impactAsync(
        mode === "add"
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Light,
      );
    }
    const sc = scaleValuesRef.current[name];
    if (!sc) return;

    // Animasyonu anında resetle ve küçült
    sc.stopAnimation();
    sc.setValue(mode === "add" ? 0.72 : 0.86);

    Animated.spring(sc, {
      toValue: 1,
      mass: 1,
      stiffness: mode === "add" ? 260 : 300,
      damping: mode === "add" ? 10 : 19, // düşük damping = daha fazla zıplama
      useNativeDriver: true,
    }).start();
  };

  const handleOptimisticPress = (key, action, toggle = true) => {
    const currentState = getIsActive(key);
    animateBounce(key, toggle ? (currentState ? "remove" : "add") : "neutral");

    if (toggle) {
      setOptimisticStates((prev) => ({ ...prev, [key]: !currentState }));
    }
    // Animasyonun donmaması için ana işlemi erteliyoruz
    setTimeout(() => {
      // Eylem açıkça `false` dönerse (yazım yapılmadı: çevrimdışı, oturum yok,
      // hata) iyimser durum geri alınır; aksi halde düğme "eklendi" kalıp
      // kullanıcıyı yanıltıyordu (T3 B14). undefined dönen eski eylemler etkilenmez.
      Promise.resolve(action()).then((done) => {
        if (done === false && toggle) {
          setOptimisticStates((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
        }
      }, () => {});
    }, 15);
  };

  /* ── modal animasyonları ── */
  const openSheet = () => {
    fadeAnim.setValue(0);
    slideAnim.setValue(SHEET_TRAVEL);
    setModalVisible(true);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        mass: 0.9,
        stiffness: 220,
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
        toValue: SHEET_TRAVEL,
        duration: 220,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => setModalVisible(false));
  };

  const iconSize = compact ? 15 : 18;

  /* ── İzlenme durumu rengi/etiketi (4 durum) ── */
  const watchedColor = watchStateColor(showWatchState, theme);
  const watchedLabel =
    t[WATCH_STATE_LABEL_KEY[showWatchState]] ||
    i18nText("autoI18n.izledim", "İzledim");
  const isWatchedActive =
    showWatchState === WATCH_STATE.PARTIAL ||
    showWatchState === WATCH_STATE.FULL;

  const watchListActive = !!getIsActive("watchList");
  const favoriteActive = !!getIsActive("favorites");
  const canCloneOverride =
    React.isValidElement(watchedOverride) &&
    typeof watchedOverride.type === "function";

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {/* ── Tek yatay satır: İzle/İzleniyor/İzlendi/Hatırlat · İzleme Listesi · Favori · Diğerleri ── */}
      <View style={[styles.bentoRow, compact && styles.bentoRowCompact]}>
        {watchedOverride ? (
          canCloneOverride ? (
            React.cloneElement(watchedOverride, {
              renderTrigger: ({
                isReminderSet: remActive,
                onPress: onToggleReminder,
              }) => (
                <DetailListActionTile
                  scale={scaleValuesRef.current["watchedTv"]}
                  opacity={opacityValuesRef.current["watchedTv"]}
                  compact={compact}
                  theme={theme}
                  color={theme.colors.orange}
                  active={!!remActive}
                  label={t.remind || i18nText("autoI18n.hatirlat", "Hatırlat")}
                  onPress={() =>
                    handleOptimisticPress("watchedTv", onToggleReminder, false)
                  }
                >
                  <ListActionIcon
                    active={!!remActive}
                    IconSet={MaterialCommunityIcons}
                    activeName="bell-ring"
                    inactiveName="bell-ring-outline"
                    activeColor={theme.colors.orange}
                    inactiveColor={theme.colors.orange}
                    size={iconSize}
                  />
                </DetailListActionTile>
              ),
            })
          ) : (
            <DetailListActionTile
              compact={compact}
              theme={theme}
              color={theme.colors.orange}
              label={t.remind || i18nText("autoI18n.hatirlat", "Hatırlat")}
            >
              {watchedOverride}
            </DetailListActionTile>
          )
        ) : (
          <DetailListActionTile
            scale={scaleValuesRef.current["watchedTv"]}
            opacity={opacityValuesRef.current["watchedTv"]}
            compact={compact}
            color={isWatchedActive ? watchedColor : theme.colors.green}
            active={isWatchedActive}
            activeIcon={
              showWatchState === WATCH_STATE.PARTIAL ? "play" : "checkmark"
            }
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
            {isLoading && !isWatchedActive ? (
              <LensLoader size={compact ? 22 : 26} />
            ) : (
              // `pulseKey`: dizi 4 durumlu (izlenmedi / kısmen / tamamen …).
              // Kısmen → tamamen geçişinde ikon "eye" olarak AYNI kalır, yalnız
              // renk değişir; pulseKey olmasa bu geçiş sessiz geçerdi.
              <ListActionIcon
                active={isWatchedActive}
                activeName="eye"
                inactiveName="eye-outline"
                activeColor={watchedColor}
                inactiveColor={theme.colors.green}
                pulseKey={showWatchState}
                size={iconSize}
              />
            )}
          </DetailListActionTile>
        )}

        <DetailListActionTile
          scale={scaleValuesRef.current["watchList"]}
          opacity={opacityValuesRef.current["watchList"]}
          compact={compact}
          color={theme.colors.blue}
          active={watchListActive}
          onPress={() =>
            handleOptimisticPress("watchList", () =>
              updateList("watchList", type),
            )
          }
          label={
            watchListActive
              ? i18nText("autoI18n.listede", "Listede")
              : i18nText("autoI18n.izleme_listesi", "İzleme Listesi")
          }
          theme={theme}
        >
          <ListActionIcon
            active={watchListActive}
            activeName="bookmark"
            inactiveName="bookmark-outline"
            activeColor={theme.colors.blue}
            inactiveColor={theme.colors.blue}
            size={iconSize}
          />
        </DetailListActionTile>
        <DetailListActionTile
          scale={scaleValuesRef.current["favorites"]}
          opacity={opacityValuesRef.current["favorites"]}
          compact={compact}
          color={theme.colors.red}
          active={favoriteActive}
          onPress={() =>
            handleOptimisticPress("favorites", () =>
              updateList("favorites", type),
            )
          }
          label={
            favoriteActive
              ? i18nText("autoI18n.favorim", "Favorim")
              : i18nText("autoI18n.favori", "Favori")
          }
          theme={theme}
        >
          <ListActionIcon
            active={favoriteActive}
            activeName="heart"
            inactiveName="heart-outline"
            activeColor={theme.colors.red}
            inactiveColor={theme.colors.red}
            size={iconSize}
          />
        </DetailListActionTile>

        <DetailListActionTile
          kind="sheet"
          scale={scaleValuesRef.current["apps"]}
          opacity={opacityValuesRef.current["apps"]}
          compact={compact}
          color={totalSelectedCount > 0 ? theme.colors.orange : theme.accent}
          active={totalSelectedCount > 0}
          badge={totalSelectedCount > 0 ? totalSelectedCount : undefined}
          onPress={() => {
            animateBounce("apps");
            openSheet();
          }}
          label={i18nText("autoI18n.digerleri", "Diğerleri")}
          theme={theme}
        >
          <Ionicons
            name={totalSelectedCount > 0 ? "grid" : "grid-outline"}
            size={iconSize}
            color={
              totalSelectedCount > 0
                ? theme.colors.orange
                : totalAvailableCount > 0
                  ? theme.accent
                  : theme.text.secondary
            }
          />
        </DetailListActionTile>
      </View>

      {/* ─── MODAL ─── */}
      <Modal
        transparent
        visible={modalVisible}
        animationType="none"
        onRequestClose={closeSheet}
      >
        <View style={styles.overlay}>
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}
          >
            <ModalBlurBackdrop intensity={50} />
          </Animated.View>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />

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
                    { backgroundColor: alpha(theme.accent, light ? 0.14 : 0.18) },
                  ]}
                >
                  <Ionicons name="tv-outline" size={16} color={theme.accent} />
                </View>
                <View>
                  <Text
                    allowFontScaling={false}
                    style={[styles.sheetTitle, { color: theme.text.primary }]}
                  >
                    {i18nText("autoI18n.diger_listeler", "Diğer Listeler")}
                  </Text>
                  {totalAvailableCount > 0 && (
                    <Text
                      allowFontScaling={false}
                      style={[styles.sheetSubtitle, { color: theme.text.muted }]}
                    >
                      {totalAvailableCount}{" "}
                      {i18nText("autoI18n.liste_3", "liste ·")}{" "}
                      {totalSelectedCount}{" "}
                      {i18nText("autoI18n.secili", "seçili")}
                    </Text>
                  )}
                </View>
              </View>
              <GlassCloseButton
                size={28}
                fallbackRadius={14}
                iconSize={15}
                onPress={closeSheet}
              />
            </View>

            {/* Separator */}
            <View style={[styles.separator, { backgroundColor: theme.border }]} />

            {otherListKeys?.length > 0 ||
            (sharedLists.length > 0 && sharedItem) ? (
              <>
                <ScrollView
                  style={styles.listsScroll}
                  contentContainerStyle={styles.listsScrollContent}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled
                >
                  {otherListKeys?.length > 0 && (
                    <View style={styles.gridContainer}>
                      {otherListKeys.map((item) => (
                        <GridCard
                          key={item}
                          item={item}
                          isIn={!!getIsActive(item)}
                          scale={scaleValuesRef.current[item]}
                          opacity={opacityValuesRef.current[item]}
                          theme={theme}
                          light={light}
                          onPress={() =>
                            handleOptimisticPress(item, () =>
                              updateList(item, type),
                            )
                          }
                        />
                      ))}
                    </View>
                  )}

                  {/* Ortak listeler */}
                  <SharedListsSection
                    sharedItem={sharedItem}
                    visible={modalVisible}
                  />
                </ScrollView>
                <View
                  style={[
                    styles.separator,
                    { backgroundColor: theme.border, marginBottom: 12 },
                  ]}
                />
                <View style={styles.sheetActions}>
                  <GlassTouchable
                    activeOpacity={0.85}
                    style={[
                      styles.actionBtn,
                      {
                        backgroundColor: theme.primary,
                        borderColor: theme.border,
                      },
                    ]}
                    onPress={closeSheet}
                  >
                    <Ionicons
                      name="close-circle-outline"
                      size={15}
                      color={theme.text.muted}
                    />
                    <Text
                      allowFontScaling={false}
                      style={[styles.actionBtnText, { color: theme.text.muted }]}
                    >
                      {i18nText("autoI18n.kapat", "Kapat")}
                    </Text>
                  </GlassTouchable>
                  <GlassTouchable
                    activeOpacity={0.85}
                    style={[styles.actionBtn, { backgroundColor: theme.accent }]}
                    onPress={() => {
                      closeSheet();
                      navigation.navigate("ListsViewScreen");
                    }}
                  >
                    <Ionicons name="list" size={15} color="#fff" />
                    <Text
                      allowFontScaling={false}
                      style={[styles.actionBtnText, { color: "#fff" }]}
                    >
                      {i18nText("autoI18n.tum_listeler", "Tüm Listeler")}
                    </Text>
                  </GlassTouchable>
                </View>
              </>
            ) : (
              <View style={styles.emptyContainer}>
                <View
                  style={[styles.emptyIconBg, { backgroundColor: theme.primary }]}
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
                  {i18nText("autoI18n.liste_bulunamadi", "Liste Bulunamadı")}
                </Text>
                <Text
                  allowFontScaling={false}
                  style={[styles.emptySubtitle, { color: theme.text.muted }]}
                >
                  {i18nText(
                    "autoI18n.henuz_ozel_liste_olusturmadin_listeler_ekranindan_",
                    "Henüz özel liste oluşturmadın. Listeler ekranından yeni liste ekleyebilirsin.",
                  )}
                </Text>
                <View
                  style={[
                    styles.separator,
                    { backgroundColor: theme.border, marginBottom: 4 },
                  ]}
                />
                <View style={styles.sheetActions}>
                  <GlassTouchable
                    activeOpacity={0.85}
                    style={[
                      styles.actionBtn,
                      {
                        backgroundColor: theme.primary,
                        borderColor: theme.border,
                      },
                    ]}
                    onPress={closeSheet}
                  >
                    <Ionicons
                      name="close-circle-outline"
                      size={15}
                      color={theme.text.muted}
                    />
                    <Text
                      allowFontScaling={false}
                      style={[styles.actionBtnText, { color: theme.text.muted }]}
                    >
                      {t.cancel || i18nText("autoI18n.iptal", "İptal")}
                    </Text>
                  </GlassTouchable>
                  <GlassTouchable
                    activeOpacity={0.85}
                    style={[styles.actionBtn, { backgroundColor: theme.accent }]}
                    onPress={() => {
                      closeSheet();
                      navigation.navigate("ListsViewScreen");
                    }}
                  >
                    <Ionicons name="add-circle-outline" size={15} color="#fff" />
                    <Text
                      allowFontScaling={false}
                      style={[styles.actionBtnText, { color: "#fff" }]}
                    >
                      {i18nText("autoI18n.liste_olustur", "Liste Oluştur")}
                    </Text>
                  </GlassTouchable>
                </View>
              </View>
            )}
          </Animated.View>
        </View>
        <ModalToastHost visible={modalVisible} />
      </Modal>
    </View>
  );
};

/* ─── Styles ─────────────────────────────────────── */
const styles = StyleSheet.create({
  /* 2×2 Bento ızgarası */
  container: {
    marginBottom: 0,
  },
  containerCompact: {
    marginBottom: 0,
  },
  bentoRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
  },
  bentoRowCompact: {
    gap: 6,
  },

  /* ── MODAL ── */
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "88%",
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

  /* Liste seçimi: tüm özel + ortak listeler tek kaydırılabilir alanda kalır. */
  listsScroll: {
    flexShrink: 1,
    marginHorizontal: -GLASS_PRESS_ROOM,
  },
  listsScrollContent: {
    paddingHorizontal: GLASS_PRESS_ROOM,
    paddingVertical: GLASS_PRESS_ROOM,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  gridCard: {
    width: "48%",
    minHeight: 62,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 15,
    borderWidth: 1,
    justifyContent: "center",
  },
  gridCardContent: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  gridCardIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  gridCardLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: -0.1,
  },
  gridTrailingOrb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
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
