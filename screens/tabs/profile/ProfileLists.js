import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  FlatList,
  Animated,
  } from "react-native";
import React, { useEffect, useMemo, useState } from "react";
import BottomSheetModal from "@components/common/BottomSheetModal";
import { useLanguage } from "../../../context/LanguageContext";
import { useTheme } from "../../../context/ThemeContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ListsSkeleton } from "../../../components/Skeleton";
import { useProfileStats } from "../../../context/ProfileStatsContext";
import { useProfileUi }    from "../../../context/ProfileUiContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useImageQualitySettings } from "../../../context/AppSettingsContext";
import { useSharedLists } from "../../../context/SharedListsContext";
import SwitchToggle from "../../../components/SwitchToggle";
import { i18nText } from "../../../utils/i18nText";
import { sortItemsByListOrder } from "../../../utils/listOrder";
import ListCovers from "../../../components/lists/ListCovers";
import ListManageSheet from "../../../components/lists/ListManageSheet";
import { useAuth } from "../../../context/AuthContext";
import {
  getListAccent,
  getListIcon,
  SHARED_LIST_ACCENT,
} from "../../../utils/listAppearance";
import { collection, getDocs, limit, query } from "firebase/firestore";
import { db } from "../../../firebase";

// Kart yüksekliği tüm düzenlerde sabit (poster bloğu 112 + ayırıcı/alt bilgi).
const CARD_H = 171;
// Kapak bloğunun yüksekliği ve kart iç dolgusu — genişlikler bunlardan türer.
const COVER_H = 112;
const CARD_PADDING = 10;

// Kart genişliği aktif poster düzenine orantılı: poster alanı + 2×10 dolgu.
// Aynı anda tek düzen aktif olduğundan raydaki tüm kartlar yine eşit kalır.
const getCardWidth = (gridStyle) => {
  switch (gridStyle) {
    case 1:
      return 204; // Büyük Kapaklar: 3×60 + 2×2 boşluk
    case 2:
      return 176; // Küçük Kapaklar: 4×37.5 + 3×2 boşluk
    case 3:
      return 134.5; // Karışık: 75 + 2 + 37.5
    default:
      return 158; // Yığın: 138 sabit blok
  }
};

const SHARED_ACCENT = SHARED_LIST_ACCENT;
const SHARED_KEY_PREFIX = "shared:";

export default function ProfileLists({ navigation }) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { lists, isLoading: isLoadingLists } = useProfileStats();
  const { user } = useAuth();
  const { gridStyle, setGridStyle, saveListGridStyle, allCornersRounded, saveAllCornersRounded } = useProfileUi();
  const cardW = getCardWidth(gridStyle);
  const [layoutModalVisible, setLayoutModalVisible] = useState(false);
  // Uzun basılan özel liste — yönetim sayfası (ad değiştir / sil) buna bakar.
  // Sayfa Listelerim ekranıyla ORTAK; iki yüzeyde aynı akış, aynı yazma yolu.
  const [manageList, setManageList] = useState(null);
  const existingListNames = useMemo(
    () => (lists || []).map(([name]) => name),
    [lists],
  );
  const manageListCount =
    (lists || []).find(([name]) => name === manageList)?.[1]?.length ?? 0;
  // ...existing code...
  const [scaleValues, setScaleValues] = useState({});
  const { getTmdbUrl } = useImageQualitySettings();

  // ── Ortak listeler — ListsViewScreen ile aynı önizleme deseni ────────────
  // listId → ilk 8 öğe (küçük kapaklar düzeni 8 poster gösterir).
  // updatedAt değişince tazelenir.
  const { sharedLists } = useSharedLists();
  const [sharedPreviews, setSharedPreviews] = useState({});
  const sharedPreviewKey = sharedLists
    .map((l) => `${l.id}:${l.updatedAt?.toMillis?.() ?? 0}`)
    .join("|");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const previews = {};
      await Promise.all(
        sharedLists.map(async (l) => {
          try {
            const snap = await getDocs(
              query(collection(db, "SharedLists", l.id, "items"), limit(8)),
            );
            previews[l.id] = snap.docs.map((d) => d.data());
          } catch {
            previews[l.id] = [];
          }
        }),
      );
      if (!cancelled) setSharedPreviews(previews);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedPreviewKey]);

  useEffect(() => {
    const newScaleValues = {};
    lists.forEach((list) => {
      newScaleValues[list[0]] = new Animated.Value(1);
    });
    sharedLists.forEach((l) => {
      newScaleValues[SHARED_KEY_PREFIX + l.id] = new Animated.Value(1);
    });
    setScaleValues(newScaleValues);
  }, [lists, sharedLists]);

  const onPressIn = (listName) => {
    if (!scaleValues[listName]) return;
    Animated.timing(scaleValues[listName], {
      toValue: 0.9,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = (listName) => {
    if (!scaleValues[listName]) return;
    Animated.timing(scaleValues[listName], {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };
  const protectedLists = [
    "watchedTv",
    "watchedMovies",
    "watchList",
    "favorites",
  ];

  return (
    <View style={styles.section}>
      <View style={styles.container}>
        <Text
          allowFontScaling={false}
          style={[styles.sectionTitle, { color: theme.text.muted }]}
        >
          {t.profileScreen.ProfileLists.lists}
        </Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity
            style={[
              styles.addButton,
              { backgroundColor: theme.secondary, borderColor: theme.border },
            ]}
            onPress={() => setLayoutModalVisible(true)}
          >
            <MaterialCommunityIcons
              name={gridStyle === 1 ? "grid-large" : gridStyle === 2 ? "grid" : gridStyle === 3 ? "view-dashboard" : "layers"}
              size={18}
              color={theme.text.primary ?? "white"}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.addButton,
              { backgroundColor: theme.secondary, borderColor: theme.border },
            ]}
            onPress={() => {
              navigation.navigate("ListsViewScreen");
            }}
          >
            <Ionicons name="arrow-forward-outline" size={18} color={theme.text.primary ?? "white"} />
          </TouchableOpacity>
        </View>
      </View>
      {isLoadingLists ? (
        <ListsSkeleton />
      ) : (
        <View style={styles.sectionView}>
          <FlatList
            data={[
              ...protectedLists
                .map((name) => lists.find(([listName]) => listName === name))
                .filter(Boolean),
              ...lists
                .filter(([listName]) => !protectedLists.includes(listName))
                .sort((a, b) => a[0].localeCompare(b[0])),
              // Ortak listeler rayın sonunda; context zaten isme göre sıralı.
              ...sharedLists.map((l) => [
                SHARED_KEY_PREFIX + l.id,
                sharedPreviews[l.id] || [],
              ]),
            ]}
            keyExtractor={([listName]) => listName}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 15, gap: 10 }}
            renderItem={({ item }) => {
              const [listName, items] = item;
              // Ortak liste kartı — üye sayısı rozeti ve SharedListScreen yönlendirmesi
              // dışında kişisel kartla aynı çerçeveyi kullanır.
              const shared = listName.startsWith(SHARED_KEY_PREFIX)
                ? sharedLists.find(
                    (l) => SHARED_KEY_PREFIX + l.id === listName,
                  )
                : null;
              const orderedItems = sortItemsByListOrder(items);
              const accent = shared ? SHARED_ACCENT : getListAccent(listName);
              const icon = shared ? "people" : getListIcon(listName);
              const displayName = shared
                ? shared.name
                : listName === "watchedMovies"
                  ? t.profileScreen.ProfileLists.watchedMovies
                  : listName === "watchedTv"
                    ? t.profileScreen.ProfileLists.watchedTvSeries
                    : listName === "favorites"
                      ? t.profileScreen.ProfileLists.favorite
                      : listName === "watchList"
                        ? t.profileScreen.ProfileLists.watchList
                        : listName;
              return (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPressIn={() => onPressIn(listName)} // Add arrow function
                  onPressOut={() => onPressOut(listName)} // Add arrow function
                  onPress={() => {
                    if (shared) {
                      navigation.navigate("SharedListScreen", {
                        listId: shared.id,
                      });
                    } else {
                      navigation.navigate("ListsScreen", { listName });
                    }
                  }}
                  onLongPress={() => {
                    // Öntanımlı dörtte ve ortak listelerde ad/silme yok.
                    if (!shared && !protectedLists.includes(listName)) {
                      setManageList(listName);
                    }
                  }}
                >
                  <Animated.View
                    style={{
                      paddingBottom: 4,
                      transform: [{ scale: scaleValues[listName] || 1 }],
                    }}
                  >
                    {/* Aksan gölgesi — ListsViewScreen.cardGlow ile aynı çerçeve */}
                    <View
                      style={[
                        styles.cardGlow,
                        { backgroundColor: accent + "18", borderColor: accent + "25" },
                      ]}
                    />
                    <View style={[styles.card, { width: cardW }]}>
                    <ListCovers
                      items={orderedItems}
                      gridStyle={gridStyle}
                      allCornersRounded={allCornersRounded}
                      width={cardW - CARD_PADDING * 2}
                      height={COVER_H}
                      getTmdbUrl={getTmdbUrl}
                      theme={theme}
                    />

                    {/* Ayırıcı + alt bilgi — ListsViewScreen kart yapısıyla aynı */}
                    <View
                      style={[styles.divider, { backgroundColor: accent + "30" }]}
                    />
                    <View style={styles.cardFooter}>
                      <View
                        style={[styles.iconDot, { backgroundColor: accent + "20" }]}
                      >
                        <Ionicons name={icon} size={12} color={accent} />
                      </View>
                      <Text
                        allowFontScaling={false}
                        style={styles.cardName}
                        numberOfLines={1}
                      >
                        {displayName}
                      </Text>
                      {shared ? (
                        <View style={styles.sharedCountWrap}>
                          <Ionicons
                            name="person"
                            size={11}
                            color="rgba(255,255,255,0.4)"
                          />
                          <Text
                            allowFontScaling={false}
                            style={[
                              styles.countBadge,
                              { color: accent, marginLeft: 0 },
                            ]}
                          >
                            {shared.memberIds?.length ?? 1}
                          </Text>
                        </View>
                      ) : (
                        <Text
                          allowFontScaling={false}
                          style={[styles.countBadge, { color: accent }]}
                        >
                          {orderedItems.length}
                        </Text>
                      )}
                    </View>
                    </View>
                  </Animated.View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}
      {/* Uzun basış: liste yönetim sayfası (ad değiştir / sil) — Listelerim
          ekranıyla ORTAK bileşen. */}
      <ListManageSheet
        listName={manageList}
        itemCount={manageListCount}
        existingNames={existingListNames}
        uid={user?.uid}
        onClose={() => setManageList(null)}
      />

      {/* Görünüm Seçimi Modalı */}
      <BottomSheetModal
        visible={layoutModalVisible}
        onClose={() => setLayoutModalVisible(false)}
        intensity={35}
        dimColor="rgba(0,0,0,0.38)"
        sheetStyle={[styles.bottomModalSheet, { backgroundColor: theme.secondary, borderColor: theme.border }]}
      >
            <View style={[styles.modalDragHandle, { backgroundColor: theme.text.muted }]} />
            <Text style={[styles.bottomModalTitle, { color: theme.text.primary }]}>
              {i18nText("autoI18n.liste_gorunumu_secin", "Liste Görünümü Seçin")}
            </Text>

            <View style={{ width: "100%", paddingHorizontal: 20, gap: 10 }}>
              {/* Üst Sıra */}
              <View style={{ flexDirection: "row", gap: 10 }}>
                {/* Option 1: Büyük Kapaklar */}
                <TouchableOpacity
                  style={{ flex: 1 }}
                  activeOpacity={0.8}
                  onPress={() => {
                    saveListGridStyle(1);
                    setLayoutModalVisible(false);
                  }}
                >
                  <View
                    style={[
                      styles.listContainer,
                      {
                        width: "100%",
                        backgroundColor: theme.secondary,
                        borderColor: gridStyle === 1 ? theme.colors.orange : theme.border,
                        opacity: gridStyle === 1 ? 1 : 0.6,
                      },
                    ]}
                  >
                    <View style={{ flexDirection: "row", gap: 2, justifyContent: "center", width: "100%" }}>
                      {[0, 1, 2].map((index) => (
                        <View
                          key={index}
                          style={[
                            styles.placeholder,
                            { width: 54, height: 101 },
                            allCornersRounded ? { borderRadius: 10 } : [index === 0 && { borderTopLeftRadius: 10, borderBottomLeftRadius: 10 }, index === 2 && { borderTopRightRadius: 10, borderBottomRightRadius: 10 }],
                            { backgroundColor: theme.primary },
                          ]}
                        />
                      ))}
                    </View>
                    <View style={{ marginTop: 6, flexDirection: "row", alignItems: "center", gap: 5 }}>
                      <MaterialCommunityIcons name="movie" size={16} color={theme.colors.green} />
                      <Text style={{ color: theme.text.primary, fontSize: 13, fontWeight: "600" }}>
                        {i18nText("autoI18n.buyuk_kapaklar", "Büyük Kapaklar")}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Option 3: Karışık Kapaklar */}
                <TouchableOpacity
                  style={{ flex: 1 }}
                  activeOpacity={0.8}
                  onPress={() => {
                    saveListGridStyle(3);
                    setLayoutModalVisible(false);
                  }}
                >
                  <View
                    style={[
                      styles.listContainer,
                      {
                        width: "100%",
                        backgroundColor: theme.secondary,
                        borderColor: gridStyle === 3 ? theme.colors.orange : theme.border,
                        opacity: gridStyle === 3 ? 1 : 0.6,
                      },
                    ]}
                  >
                    <View style={{ flexDirection: "row", gap: 2, justifyContent: "center", width: "100%" }}>
                      <View style={[styles.placeholder, { width: 68, height: 101 }, allCornersRounded ? { borderRadius: 10 } : { borderTopLeftRadius: 10, borderBottomLeftRadius: 10 }, { backgroundColor: theme.primary }]} />
                      <View style={{ gap: 2, justifyContent: "center" }}>
                        <View style={[styles.placeholder, { width: 34, height: 49.5 }, allCornersRounded ? { borderRadius: 10 } : { borderTopRightRadius: 10 }, { backgroundColor: theme.primary }]} />
                        <View style={[styles.placeholder, { width: 34, height: 49.5 }, allCornersRounded ? { borderRadius: 10 } : { borderBottomRightRadius: 10 }, { backgroundColor: theme.primary }]} />
                      </View>
                    </View>
                    <View style={{ marginTop: 6, flexDirection: "row", alignItems: "center", gap: 5 }}>
                      <MaterialCommunityIcons name="view-dashboard" size={16} color={theme.colors.blue} />
                      <Text style={{ color: theme.text.primary, fontSize: 13, fontWeight: "600" }}>
                        {i18nText("autoI18n.karisik_gorunum", "Karışık")}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Alt Sıra */}
              <View style={{ flexDirection: "row", gap: 10 }}>
                {/* Option 4: Yığın Kapaklar */}
                <TouchableOpacity
                  style={{ flex: 1 }}
                  activeOpacity={0.8}
                  onPress={() => {
                    saveListGridStyle(4);
                    setLayoutModalVisible(false);
                  }}
                >
                  <View
                    style={[
                      styles.listContainer,
                      {
                        width: "100%",
                        backgroundColor: theme.secondary,
                        borderColor: gridStyle === 4 ? theme.colors.orange : theme.border,
                        opacity: gridStyle === 4 ? 1 : 0.6,
                      },
                    ]}
                  >
                    <View style={{ width: 124, height: 101, alignItems: "center", justifyContent: "center" }}>
                      {[2, 1, 0].map((i) => {
                        const angles = [0, -6, 6];
                        const offsets = [0, -20, 20];
                        const zIndexes = [3, 2, 1];
                        return (
                          <View
                            key={i}
                            style={[
                              styles.placeholder,
                              {
                                position: "absolute",
                                transform: [
                                  { rotate: `${angles[i]}deg` },
                                  { translateX: offsets[i] },
                                ],
                                zIndex: zIndexes[i],
                                width: 68,
                                height: 101,
                                borderRadius: 10,
                                backgroundColor: theme.primary,
                                borderWidth: 1,
                                borderColor: "rgba(255,255,255,0.1)",
                              }
                            ]}
                          />
                        );
                      })}
                    </View>
                    <View style={{ marginTop: 6, flexDirection: "row", alignItems: "center", gap: 5 }}>
                      <MaterialCommunityIcons name="layers" size={16} color={theme.colors.purple || "#a78bfa"} />
                      <Text style={{ color: theme.text.primary, fontSize: 13, fontWeight: "600" }}>
                        {i18nText("autoI18n.yigin_gorunum", "Yığın")}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Option 2: Küçük Kapaklar */}
                <TouchableOpacity
                  style={{ flex: 1 }}
                  activeOpacity={0.8}
                  onPress={() => {
                    saveListGridStyle(2);
                    setLayoutModalVisible(false);
                  }}
                >
                  <View
                    style={[
                      styles.listContainer,
                      {
                        width: "100%",
                        backgroundColor: theme.secondary,
                        borderColor: gridStyle === 2 ? theme.colors.orange : theme.border,
                        opacity: gridStyle === 2 ? 1 : 0.6,
                      },
                    ]}
                  >
                    <View style={{ gap: 2, alignItems: "center", width: "100%" }}>
                      <View style={{ flexDirection: "row", gap: 2 }}>
                        {[0, 1, 2, 3].map((index) => (
                          <View
                            key={index}
                            style={[
                              styles.placeholder,
                              { width: 34, height: 49.5 },
                              allCornersRounded ? { borderRadius: 10 } : [index === 0 && { borderTopLeftRadius: 10 }, index === 3 && { borderTopRightRadius: 10 }],
                              { backgroundColor: theme.primary },
                            ]}
                          />
                        ))}
                      </View>
                      <View style={{ flexDirection: "row", gap: 2 }}>
                        {[4, 5, 6, 7].map((index) => (
                          <View
                            key={index}
                            style={[
                              styles.placeholder,
                              { width: 34, height: 49.5 },
                              allCornersRounded ? { borderRadius: 10 } : [index === 4 && { borderBottomLeftRadius: 10 }, index === 7 && { borderBottomRightRadius: 10 }],
                              { backgroundColor: theme.primary },
                            ]}
                          />
                        ))}
                      </View>
                    </View>
                    <View style={{ marginTop: 6, flexDirection: "row", alignItems: "center", gap: 5 }}>
                      <Ionicons name="grid" size={16} color={theme.colors.orange} />
                      <Text style={{ color: theme.text.primary, fontSize: 13, fontWeight: "600" }}>
                        {i18nText("autoI18n.kucuk_kapaklar", "Küçük Kapaklar")}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>

              <View 
                style={{ 
                  width: "100%",
                  marginTop: 5, 
                  paddingHorizontal: 16, 
                  paddingVertical: 14, 
                  flexDirection: "row", 
                  alignItems: "center", 
                  justifyContent: "space-between",
                  backgroundColor: theme.secondary,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: theme.border || "rgba(255,255,255,0.05)"
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Ionicons name="crop-outline" size={20} color={theme.text.primary} />
                  <Text style={{ color: theme.text.primary, fontSize: 14, fontWeight: "600" }}>
                    {i18nText("autoI18n.ayri_koseli_afisler", "Ayrı Köşeli Afişler")}
                  </Text>
                </View>
                <SwitchToggle
                  value={allCornersRounded}
                  onValueChange={saveAllCornersRounded}
                  size={28}
                  onColor={theme.colors.orange || "#f59e0b"}
                  offColor={theme.border || "#cacacaad"}
                />
              </View>
            </View>
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { width: "100%", marginBottom: 14 },
  sectionTitle: {
    fontSize: 14,
    textTransform: "uppercase",
  },
  // Görünüm modalındaki önizleme kartları hâlâ bu stili kullanır.
  listContainer: {
    padding: 7,
    alignItems: "center",
    borderRadius: 15,
    marginBottom: 10,
    gap: 2,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
  },

  // ── Raydaki liste kartı çerçevesi — ListsViewScreen kartlarıyla aynı ──────
  cardGlow: {
    position: "absolute",
    top: 4,
    left: 4,
    right: 4,
    bottom: 0,
    borderRadius: 20,
    borderWidth: 1,
  },
  card: {
    height: CARD_H,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: CARD_PADDING,
    alignItems: "center",
    gap: 2,
  },
  divider: {
    height: 1,
    alignSelf: "stretch",
    marginHorizontal: 4,
    marginTop: 7,
    marginBottom: 5,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    gap: 6,
  },
  iconDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  cardName: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: -0.2,
    flexShrink: 1,
    maxWidth: 120,
  },
  countBadge: {
    fontSize: 12,
    fontWeight: "800",
    marginLeft: "auto",
  },
  sharedCountWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginLeft: "auto",
  },
  // Kart kapakları artık ListCovers'ta; bu ölçü yalnız görünüm modalındaki
  // önizleme kutuları için duruyor.
  placeholder: { width: 37.5, height: 55 },
  sectionView: {
    justifyContent: "center",
    alignItems: "center",
    minHeight: 140,
  },
  container: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 10,
  },
  addButton: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  // Silme onayı artık ListManageSheet'te (Listelerim ekranıyla ortak sayfa).

  // ── Layout Modal Styles ──────────────────────────────────────────────────
  bottomModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  bottomModalSheet: {
    width: "100%",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingTop: 24,
    paddingBottom: 40,
    alignItems: "center",
  },
  modalDragHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    marginBottom: 20,
  },
  bottomModalTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 24,
    textAlign: "center",
  },
  layoutOptionsRow: {
    flexDirection: "row",
    gap: 16,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
});
