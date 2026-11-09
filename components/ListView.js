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
import LottieView from "lottie-react-native";
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
import Toast from "@components/AppToast";
import { i18nText } from "../utils/i18nText";
import { alpha } from "../theme/colors";
import { isLightSurface } from "../utils/colorUtils";
import ModalToastHost from "@components/toast/ModalToastHost";
import GlassTouchable from "./common/GlassTouchable";
import { GLASS_PRESS_ROOM } from "../utils/liquidGlass";

/* ─── Küçük yardımcı ─────────────────────────────────── */
const formatDateSave = (timestamp) => {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

const SHEET_TRAVEL = Math.round(
  (Dimensions.get?.("window")?.height || 800) * 0.88,
);

/* ─── Grid liste kartı ────────────────────────────────── */
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

/* ─── Ana bileşen ─────────────────────────────────────── */
const ListView = ({
  updateList,
  type,
  navigation,
  updateWatchedList,
  openWatchedHistory,
  isRemaining,
  // Yayın tarihi BİLİNMİYOR (TMDB'de boş/geçersiz ve `status` da yayınlandı
  // demiyor). İleri tarihli içerikte hatırlatmaya dönen göz butonu burada
  // dönemez — hatırlatılacak bir tarih yok — bu yüzden kilitlenir.
  // Bkz. utils/watchState.js → getReleaseState.
  watchLocked = false,
  // Hatırlatma kurulu mu. Kurulu kaldığı sürece göz butonu zil olarak kalır —
  // içerik yayına girse bile. O durumda zil "Yayınlandı" görünümüne geçer
  // (aşağıda `isReleasedReminder`); dokunuş yine hatırlatmayı kaldırır ve
  // buton normal "İzle" göz butonuna döner.
  isReminderSet,
  addReminder,
  listStates,
  isLoading,
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
  }, [listStates, isReminderSet, isRemaining, watchLocked]);

  const safeListStates = listStates || {};
  const getIsActive = (key) => {
    if (optimisticStates[key] !== undefined) return optimisticStates[key];
    if (key === "reminder") return isReminderSet;
    return safeListStates[key];
  };

  const slideAnim = useRef(new Animated.Value(SHEET_TRAVEL)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleValuesRef = useRef({});
  const opacityValuesRef = useRef({});

  // Sabit + dinamik key'ler için Animated.Value'ları başlat
  const initKey = (k) => {
    if (!scaleValuesRef.current[k]) scaleValuesRef.current[k] = new Animated.Value(1);
    if (!opacityValuesRef.current[k]) opacityValuesRef.current[k] = new Animated.Value(1);
  };
  ["watchList", "watchedMovies", "reminder", "favorites", "apps"].forEach(initKey);
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
  // `mode`: "add" (listeye giriyor) | "remove" (çıkıyor) | "neutral" (modal açma
  // gibi durum değiştirmeyen dokunuşlar). Ekleme ile çıkarma AYNI hissi
  // vermemeli: ekleme daha derin bir squash + belirgin zıplama, çıkarma sığ ve
  // yaysız. Dokunsal geri bildirim de yönle birlikte değişir, böylece kullanıcı
  // ekrana bakmadan hangi yöne gittiğini ayırt edebilir.
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
    // Animasyonun donmaması için ana işlemi bir sonraki event loop'a bırak
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

  /* ── modal aç/kapat ── */
  const openModal = () => {
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
  const closeModal = () => {
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

  /* ── İzle / İzlendi / Hatırlat / Yayınlandı / Kilitli durumu ── */
  const isReminderMode = isRemaining || isReminderSet;
  const reminderOn = !!getIsActive("reminder");
  // Hatırlatma KALICIDIR: içerik yayına girse de kullanıcı silene kadar
  // durur (hatırlatıcılar ekranı böylece "yokluğumda neler çıkmış"
  // listesi olarak da işe yarar). Yayın tarihi GEÇMİŞSE buton bunu
  // söylesin — yeşil `bell-check` + "Yayınlandı".
  const isReleasedReminder = isReminderMode && !isRemaining && !watchLocked;
  // Kilit YALNIZ henüz işaretlenmemişken uygulanır: eski kayıtları
  // kullanıcı geçmişten kaldırabilmeli.
  const isWatchBlocked =
    !isReminderMode && watchLocked && !getIsActive("watchedMovies");
  const watchActionColor = isWatchBlocked
    ? theme.text.muted
    : isReminderMode
      ? isReleasedReminder
        ? theme.colors.green
        : theme.colors.orange
      : theme.colors.green;
  const watchActionLabel = isReminderMode
    ? isReleasedReminder
      ? i18nText("autoI18n.yayinlandi", "Yayınlandı")
      : t.remind || i18nText("autoI18n.hatirlat", "Hatırlat")
    : getIsActive("watchedMovies")
      ? t.watched || i18nText("autoI18n.izlendi", "İzlendi")
      : t.watch || i18nText("autoI18n.izle", "İzle");

  const watchAnimKey = isReminderMode ? "reminder" : "watchedMovies";
  const watchListActive = !!getIsActive("watchList");
  const favoriteActive = !!getIsActive("favorites");

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {/* ── Tek yatay satır: İzle/Hatırlat · İzleme Listesi · Favori · Diğerleri ── */}
      <View style={[styles.bentoRow, compact && styles.bentoRowCompact]}>
        <DetailListActionTile
          scale={scaleValuesRef.current[watchAnimKey]}
          opacity={opacityValuesRef.current[watchAnimKey]}
          compact={compact}
          theme={theme}
          color={watchActionColor}
          locked={isWatchBlocked}
          active={isReminderMode ? reminderOn : !!getIsActive("watchedMovies")}
          label={watchActionLabel}
          onPress={
            isWatchBlocked
              ? () =>
                  Toast.show({
                    type: "warning",
                    text1: i18nText(
                      "autoI18n.yayin_tarihi_bilinmiyor",
                      "Yayın tarihi bilinmiyor",
                    ),
                    text2: i18nText(
                      "autoI18n.yayin_tarihi_bilinmiyor_izlendi",
                      "Tarihi belli olmayan içerik izlendi olarak eklenemez.",
                    ),
                  })
              : isReminderMode
                ? () => handleOptimisticPress("reminder", addReminder)
                : () =>
                    getIsActive("watchedMovies")
                      ? handleOptimisticPress("watchedMovies", openWatchedHistory, false)
                      : handleOptimisticPress("watchedMovies", updateWatchedList, false)
          }
        >
          {isWatchBlocked ? (
            <ListActionIcon
              active={false}
              activeName="eye-off"
              inactiveName="eye-off-outline"
              activeColor={theme.text.muted}
              inactiveColor={theme.text.muted}
              size={iconSize}
            />
          ) : isReminderMode ? (
            <ListActionIcon
              active={reminderOn}
              IconSet={MaterialCommunityIcons}
              activeName={isReleasedReminder ? "bell-check" : "bell-ring"}
              inactiveName={
                isReleasedReminder ? "bell-check-outline" : "bell-ring-outline"
              }
              activeColor={
                isReleasedReminder ? theme.colors.green : theme.colors.orange
              }
              inactiveColor={
                isReleasedReminder ? theme.colors.green : theme.colors.orange
              }
              size={iconSize}
            />
          ) : /* Yükleme göstergesi YALNIZ henüz işaretlenmemişken çıkar. */
          isLoading && !getIsActive("watchedMovies") ? (
            <LottieView
              source={require("@lottie/loading15.json")}
              style={{ width: iconSize, height: iconSize }}
              autoPlay
              loop
            />
          ) : (
            <ListActionIcon
              active={!!getIsActive("watchedMovies")}
              activeName="eye"
              inactiveName="eye-outline"
              activeColor={theme.colors.green}
              inactiveColor={theme.colors.green}
              size={iconSize}
            />
          )}
        </DetailListActionTile>

        <DetailListActionTile
          scale={scaleValuesRef.current["watchList"]}
          opacity={opacityValuesRef.current["watchList"]}
          compact={compact}
          theme={theme}
          color={theme.colors.blue}
          active={watchListActive}
          label={
            watchListActive
              ? i18nText("autoI18n.listede", "Listede")
              : i18nText("autoI18n.izleme_listesi", "İzleme Listesi")
          }
          onPress={() =>
            handleOptimisticPress("watchList", () =>
              updateList("watchList", type, formatDateSave(new Date())),
            )
          }
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
          theme={theme}
          color={theme.colors.red}
          active={favoriteActive}
          label={
            favoriteActive
              ? i18nText("autoI18n.favorim", "Favorim")
              : i18nText("autoI18n.favori", "Favori")
          }
          onPress={() =>
            handleOptimisticPress("favorites", () =>
              updateList("favorites", type, formatDateSave(new Date())),
            )
          }
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
          onPress={() => {
            animateBounce("apps");
            openModal();
          }}
          scale={scaleValuesRef.current["apps"]}
          opacity={opacityValuesRef.current["apps"]}
          badge={totalSelectedCount > 0 ? totalSelectedCount : null}
          compact={compact}
          theme={theme}
          color={totalSelectedCount > 0 ? theme.colors.orange : theme.accent}
          active={totalSelectedCount > 0}
          label={i18nText("autoI18n.digerleri", "Diğerleri")}
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

      {/* ─────────── MODAL ─────────── */}
      <Modal
        transparent
        visible={modalVisible}
        animationType="none"
        onRequestClose={closeModal}
      >
        <View style={styles.overlay}>
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}
          >
            <ModalBlurBackdrop intensity={50} />
          </Animated.View>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeModal} />

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
                  <Ionicons name="grid" size={16} color={theme.accent} />
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
                onPress={closeModal}
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
                              updateList(item, type, formatDateSave(new Date())),
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

                {/* Eylemler */}
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
                    onPress={closeModal}
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
                      closeModal();
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
              /* Boş durum */
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
                    onPress={closeModal}
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
                      closeModal();
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

/* ─── Styles ──────────────────────────────────────────── */
const styles = StyleSheet.create({
  /* 2×2 Bento ızgarası */
  container: {
    marginBottom: 16,
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

export default ListView;
