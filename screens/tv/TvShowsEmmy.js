import React, { memo, useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Dimensions,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Modal,
  SafeAreaView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { i18nText } from "../../utils/i18nText";
import PosterImage from "../../components/PosterImage";
import AppIcon from "../../components/AppIcon";
import GlassIconButton from "../../components/common/GlassIconButton";
import { useTheme } from "../../context/ThemeContext";
import { useMediaQuickActions } from "../../context/MediaQuickActionsContext";
import { useLanguage } from "../../context/LanguageContext";
import { TvShowsEmmySkeleton } from "../../components/Skeleton";
import { useListLayoutSettings } from "../../context/AppSettingsContext";
import { useTvShow } from "../../context/TvShowContex";
import ListBadges from "../../components/ListBadges";
import { RatingBadge, POSTER_BADGE_POS } from "../../components/PosterInfoBadges";
import SectionHeader, { SECTION_GOLD } from "../../components/home/SectionHeader";
import { SectionChipRail, SectionSegmented } from "../../components/home/SectionChips";
import DiscoverFilterChip from "../../components/home/DiscoverFilterChip";
import useRailPosterStyle from "../../hooks/useRailPosterStyle";
import { toast } from "../../components/AppToast";
import { triggerHaptic } from "../../services/hapticsService";

import ModalToastHost from "@components/toast/ModalToastHost";
const { width, height } = Dimensions.get("window");

// Dikey yıl metni
const DikeyMetin = memo(function DikeyMetin({ metin }) {
  return (
    <View style={styles.containerYears}>
      {metin.split("").map((karakter, index) => (
        <Text allowFontScaling={false} key={index} style={styles.verticalText}>
          {karakter}
        </Text>
      ))}
    </View>
  );
});

// Emmy Dizi Kartı (Kategori ve Yıl modlarını dinamik destekler)
const TvShowsEmmyCard = memo(function TvShowsEmmyCard({
  item,
  navigation,
  theme,
  t,
  mode = "category",
}) {
  const rp = useRailPosterStyle();
  const { posterBadges } = useListLayoutSettings();
  const { openQuickActions } = useMediaQuickActions();
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.timing(scale, { toValue: 0.92, duration: 150, useNativeDriver: true }).start();
  const onPressOut = () =>
    Animated.timing(scale, { toValue: 1, duration: 150, useNativeDriver: true }).start();

  const isPending = !item.isConfirmed || !item.poster_path;

  // Kategori adı belirleme
  const catLabel = item.categoryLabelTr || (item.categoryLabelKey ? i18nText(item.categoryLabelKey, "") : "");

  if (isPending) {
    const handlePendingPress = () => {
      const msg = i18nText(
        "autoI18n.emmy_pending_toast",
        "{{year}} yılı Emmy kazananı henüz açıklanmadı.",
      ).replace("{{year}}", String(item.year || 2027));
      toast.info(msg);
    };

    return (
      <TouchableOpacity
        style={[
          styles.similarItem,
          { width: rp.posterWidth + (mode === "category" ? 22 : 0), height: rp.posterHeight },
        ]}
        activeOpacity={0.85}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={handlePendingPress}
      >
        <Animated.View style={[{ transform: [{ scale }] }]}>
          <View style={{ flexDirection: "row" }}>
            {mode === "category" ? (
              <View style={styles.sideYearCol}>
                <AppIcon family="MaterialCommunityIcons" name="trophy-award" size={16} color="#ffd700" />
                <DikeyMetin metin={`${item.year}`} />
              </View>
            ) : null}
            <LinearGradient
              colors={["#2D2305", "#1B1402", "#0A0801"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.pendingPoster,
                {
                  width: rp.posterWidth,
                  height: rp.posterHeight,
                  borderRadius: rp.radius,
                },
              ]}
            >
              <View style={styles.pendingGlow}>
                <AppIcon family="MaterialCommunityIcons" name="trophy-award" size={28} color="#ffd700" />
              </View>
              <Text allowFontScaling={false} style={styles.pendingYear}>
                {item.year}
              </Text>
              <Text allowFontScaling={false} style={styles.pendingTitle} numberOfLines={2}>
                {catLabel || i18nText("autoI18n.emmy_pending_title", "Emmy Ödülleri")}
              </Text>
              <View style={styles.pendingBadge}>
                <Text allowFontScaling={false} style={styles.pendingBadgeText}>
                  {i18nText("autoI18n.emmy_pending_subtitle", "Çok Yakında")}
                </Text>
              </View>
            </LinearGradient>
          </View>
        </Animated.View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[
        styles.similarItem,
        { width: rp.posterWidth + (mode === "category" ? 22 : 0), height: rp.posterHeight },
      ]}
      activeOpacity={0.8}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={() => navigation.push("TvShowsDetails", { id: item.id })}
      onLongPress={() => openQuickActions({ item, mediaType: "tv", navigation })}
      delayLongPress={350}
    >
      <Animated.View style={[{ transform: [{ scale }] }]}>
        <View style={{ flexDirection: "row" }}>
          {mode === "category" ? (
            <View style={styles.sideYearCol}>
              <AppIcon family="MaterialCommunityIcons" name="trophy-award" size={16} color="#ffd700" />
              <DikeyMetin metin={`${item.year}`} />
            </View>
          ) : null}
          <View style={{ position: "relative" }}>
            <PosterImage
              path={item.poster_path}
              type="tv"
              size={200}
              style={[
                styles.similarPoster,
                {
                  width: rp.posterWidth,
                  height: rp.posterHeight,
                  borderRadius: rp.radius,
                  shadowColor: theme.shadow,
                },
              ]}
              cachePolicy="memory-disk"
              recyclingKey={`tvemmy-${item.year}-${item.categoryKey || "drama"}`}
              transition={120}
            />

            {/* Yıl modunda kartın üstünde Kategori Rozeti */}
            {mode === "year" && catLabel ? (
              <View style={styles.catBadge}>
                <Text allowFontScaling={false} style={styles.catBadgeText} numberOfLines={1}>
                  {catLabel}
                </Text>
              </View>
            ) : null}

            {posterBadges?.tmdbRating !== false && (
              <RatingBadge
                value={item.vote_average}
                votes={item.vote_count}
                style={POSTER_BADGE_POS.bottomRight}
              />
            )}

            <ListBadges
              mediaId={item.id}
              mediaType="tv"
              theme={theme}
              posterWidth={rp.posterWidth}
              style={{ position: "absolute", left: 4, bottom: 8 }}
            />
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
});

export default function TvShowsEmmy({ navigation }) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const {
    emmyMode,
    changeEmmyMode,
    selectedEmmyCategory,
    changeEmmyCategory,
    EMMY_CATEGORIES,
    selectedEmmyYear,
    changeEmmyYear,
    tvShowsEmmy,
    tvShowsEmmyYear,
    loadingEmmy,
    loadingEmmyYear,
    errorEmmy,
    loadMoreEmmy,
    loadingMoreEmmy,
    activateTvSection,
  } = useTvShow();

  const [yearModalVisible, setYearModalVisible] = useState(false);

  useEffect(() => {
    activateTvSection("emmy");
  }, [activateTvSection]);

  // 1970 - 2027 Yıllar listesi
  const availableYears = React.useMemo(() => {
    const arr = [];
    for (let y = 2027; y >= 1970; y--) arr.push(y);
    return arr;
  }, []);

  const handleModeChange = (mode) => {
    try { triggerHaptic("selection"); } catch (e) {}
    changeEmmyMode?.(mode);
  };

  const handleCategorySelect = (catKey) => {
    try { triggerHaptic("selection"); } catch (e) {}
    changeEmmyCategory?.(catKey);
  };

  const handleYearSelect = (year) => {
    try { triggerHaptic("selection"); } catch (e) {}
    changeEmmyYear?.(year);
    setYearModalVisible(false);
  };

  const emmyTitle = t.tvShowScreens?.emmy || i18nText("tvShowScreens.emmy", "Emmy Ödüllü Diziler");

  // Dil değişince etiketler yenilensin diye `t`ye bağlı.
  const modeOptions = React.useMemo(
    () => [
      { key: "category", label: i18nText("autoI18n.emmy_mode_category", "Kategori") },
      { key: "year", label: i18nText("autoI18n.emmy_mode_year", "Yıl") },
    ],
    [t],
  );

  // Başlık = altın kupa kutusu + ad + "Tümü"; altında TEK satırlık denetimler: Kategori | Yıl anahtarı
  // ve yanında moda göre kategori çipleri ya da yıl seçici (Oscar rafıyla birebir aynı düzen).
  const headerComponent = (
    <SectionHeader
      section="emmy"
      mediaType="tv"
      title={emmyTitle}
      onPressAction={() =>
        navigation.navigate("SeeAllScreen", {
          mediaType: "tv",
          section: "emmy",
          title: emmyTitle,
        })
      }
    >
      <View style={styles.controlsRow}>
        {/* Mod Seçici (Kategori | Yıl) */}
        <SectionSegmented
          options={modeOptions}
          value={emmyMode}
          onChange={handleModeChange}
        />

        {emmyMode === "category" ? (
          /* MOD 1: Kategori çipleri */
          <SectionChipRail
            style={styles.controlsRail}
            contentContainerStyle={styles.controlsRailContent}
            data={EMMY_CATEGORIES || []}
            keyExtractor={(item) => item.key}
            extraData={selectedEmmyCategory}
            renderChip={(item) => {
              const isSelected = selectedEmmyCategory === item.key;
              return (
                <DiscoverFilterChip
                  label={i18nText(item.labelKey, item.tr)}
                  selected={isSelected}
                  onPress={() => handleCategorySelect(item.key)}
                  leading={
                    <AppIcon
                      family="MaterialCommunityIcons"
                      name={item.icon || "trophy"}
                      size={15}
                      color={isSelected ? theme.accent : theme.text.muted}
                    />
                  }
                />
              );
            }}
          />
        ) : (
          /* MOD 2: Yıl seçici */
          <DiscoverFilterChip
            style={styles.yearChip}
            label={`${selectedEmmyYear} ${i18nText("autoI18n.emmy_year_title", "Emmy Kazananları").replace("{{year}}", "").trim()}`}
            trailingIcon="chevron-down"
            onPress={() => {
              triggerHaptic("selection");
              setYearModalVisible(true);
            }}
            leading={
              <AppIcon family="MaterialCommunityIcons" name="calendar-star" size={16} color={SECTION_GOLD} />
            }
          />
        )}
      </View>
    </SectionHeader>
  );

  const isLoading = emmyMode === "category" ? loadingEmmy : loadingEmmyYear;
  const currentData = emmyMode === "category" ? tvShowsEmmy : tvShowsEmmyYear;

  if (isLoading && (!currentData || currentData.length === 0)) {
    return (
      <View style={styles.container}>
        {headerComponent}
        <FlatList
          data={[1, 2, 3]}
          renderItem={() => <TvShowsEmmySkeleton />}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 15 }}
          initialNumToRender={3}
          maxToRenderPerBatch={3}
          windowSize={3}
          removeClippedSubviews
        />
      </View>
    );
  }

  if (errorEmmy) {
    return <Text>{i18nText("error", "Hata")}: {errorEmmy}</Text>;
  }

  const renderTvItem = ({ item }) => {
    return (
      <TvShowsEmmyCard
        item={item}
        navigation={navigation}
        theme={theme}
        t={t}
        mode={emmyMode}
      />
    );
  };

  const renderFooter = () => {
    if (emmyMode !== "category" || !loadingMoreEmmy) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#ffd700" />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {headerComponent}
      <FlatList
        data={currentData}
        contentContainerStyle={{ paddingHorizontal: 15 }}
        showsHorizontalScrollIndicator={false}
        renderItem={renderTvItem}
        keyExtractor={(item, index) =>
          item?.year
            ? `emmy-${item.year}-${item.categoryKey || emmyMode || "cat"}-${item.id || index}`
            : `emmy-${item?.id || index}`
        }
        horizontal
        initialNumToRender={4}
        maxToRenderPerBatch={5}
        updateCellsBatchingPeriod={80}
        windowSize={5}
        onEndReached={emmyMode === "category" ? loadMoreEmmy : undefined}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        removeClippedSubviews
      />

      {/* Yıl Seçim Modalı */}
      <Modal
        visible={yearModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setYearModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setYearModalVisible(false)}
        >
          <SafeAreaView style={styles.modalSafeArea}>
            <View style={[styles.modalContent, { backgroundColor: theme.primary, borderColor: theme.border }]}>
              <View style={styles.modalHeader}>
                <Text allowFontScaling={false} style={[styles.modalTitle, { color: theme.text.primary }]}>
                  {i18nText("autoI18n.emmy_select_year", "Emmy Yılı Seçin")}
                </Text>
                <GlassIconButton
                  variant="plain"
                  icon="close"
                  iconSize={22}
                  size={34}
                  color={theme.text.secondary}
                  accessibilityLabel={i18nText("autoI18n.kapat", "Kapat")}
                  onPress={() => setYearModalVisible(false)}
                />
              </View>

              <FlatList
                data={availableYears}
                keyExtractor={(item) => String(item)}
                numColumns={4}
                contentContainerStyle={styles.yearGrid}
                renderItem={({ item: yr }) => {
                  const isSelected = selectedEmmyYear === yr;
                  return (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => handleYearSelect(yr)}
                      style={[
                        styles.yearGridItem,
                        {
                          backgroundColor: isSelected ? theme.accent : theme.secondary,
                          borderColor: isSelected ? theme.accent : theme.border,
                        },
                      ]}
                    >
                      <Text
                        allowFontScaling={false}
                        style={[
                          styles.yearGridText,
                          {
                            color: isSelected ? "#ffffff" : theme.text.primary,
                            fontWeight: isSelected ? "800" : "600",
                          },
                        ]}
                      >
                        {yr}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
          </SafeAreaView>
        </TouchableOpacity>
        <ModalToastHost visible={yearModalVisible} />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 10,
  },
  // Kategori | Yıl anahtarı solda sabit; yanındaki çip satırı (ya da yıl seçici) kalan genişliği alır.
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 15,
  },
  controlsRail: { flex: 1 },
  controlsRailContent: { paddingLeft: 8, paddingRight: 15 },
  yearChip: { marginLeft: 8, marginRight: 15, flexShrink: 1 },
  sideYearCol: {
    width: 22,
    justifyContent: "space-around",
    alignItems: "center",
    marginRight: 4,
  },
  containerYears: {
    marginRight: 2,
    justifyContent: "center",
  },
  verticalText: {
    fontWeight: "800",
    fontSize: 10,
    color: "#ffd700",
    textAlign: "center",
  },
  similarItem: {
    marginRight: 14,
  },
  similarPoster: {
    borderRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
    elevation: 4,
  },
  catBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: "rgba(255, 215, 0, 0.6)",
    maxWidth: width * 0.36,
  },
  catBadgeText: {
    color: "#ffd700",
    fontSize: 10,
    fontWeight: "800",
  },
  pendingPoster: {
    backgroundColor: "#16130b",
    borderWidth: 1,
    borderColor: "rgba(255, 215, 0, 0.35)",
    justifyContent: "center",
    alignItems: "center",
    padding: 10,
  },
  pendingGlow: {
    marginBottom: 6,
  },
  pendingYear: {
    color: "#ffd700",
    fontSize: 18,
    fontWeight: "800",
  },
  pendingTitle: {
    color: "#e6c65c",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 4,
  },
  pendingBadge: {
    backgroundColor: "rgba(255, 215, 0, 0.15)",
    borderColor: "rgba(255, 215, 0, 0.5)",
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 8,
  },
  pendingBadgeText: {
    color: "#ffd700",
    fontSize: 9,
    fontWeight: "700",
  },
  footerLoader: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalSafeArea: {
    maxHeight: height * 0.65,
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 16,
    maxHeight: "100%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  yearGrid: {
    paddingBottom: 24,
    gap: 8,
  },
  yearGridItem: {
    flex: 1,
    margin: 4,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  yearGridText: {
    fontSize: 14,
  },
});
