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
import GlassIconButton from "@components/common/GlassIconButton";
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
import ListCovers, { getNaturalCoverWidth } from "../../../components/lists/ListCovers";
import ListManageSheet from "../../../components/lists/ListManageSheet";
import CreateListModal from "../../../components/lists/CreateListModal";
import { useAuth } from "../../../context/AuthContext";
import {
  getListAccent,
  getListIcon,
  getSharedListAccent,
} from "../../../utils/listAppearance";
import { collection, getDocs, limit, query } from "firebase/firestore";
import { db } from "../../../firebase";
import { trackFirestoreRead } from "../../../services/usageTrackerService";

// Kart yüksekliği tüm düzenlerde sabit (poster bloğu 112 + ayırıcı/alt bilgi).
// FriendProfileScreen'in paylaşılan listeler rayı da AYNI ölçüleri kullanır
// (bkz. RAIL_CARD_H/RAIL_COVER_H/RAIL_CARD_PADDING/getRailCardWidth export'u) —
// iki yüzey kopya sabitlerle sessizce ayrışmasın diye tek kaynak burası.
export const RAIL_CARD_H = 171;
const CARD_H = RAIL_CARD_H;
// Kapak bloğunun yüksekliği ve kart iç dolgusu — genişlikler bunlardan türer.
export const RAIL_COVER_H = 112;
const COVER_H = RAIL_COVER_H;
export const RAIL_CARD_PADDING = 10;
const CARD_PADDING = RAIL_CARD_PADDING;

// Karışık/Yığın'da afişler küçültülmez (bkz. ListCovers.getNaturalCoverWidth) —
// kart bu doğal genişliğe göre büyütülür, aksi halde eklenen afişler eskileri
// sıkıştırırdı.
const NATURAL_W_3 = getNaturalCoverWidth(3, COVER_H); // Karışık: büyük + 2×küçük çifti
const NATURAL_W_4 = getNaturalCoverWidth(4, COVER_H); // Yığın: 5'li yelpaze

// Kart genişliği aktif poster düzenine orantılı: poster alanı + 2×10 dolgu.
// Aynı anda tek düzen aktif olduğundan raydaki tüm kartlar yine eşit kalır.
export const getRailCardWidth = (gridStyle) => {
  switch (gridStyle) {
    case 1:
      return 204; // Büyük Kapaklar: 3×60 + 2×2 boşluk
    case 2:
      return 176; // Küçük Kapaklar: 4×37.5 + 3×2 boşluk
    case 3:
      return NATURAL_W_3 + CARD_PADDING * 2;
    default:
      return NATURAL_W_4 + CARD_PADDING * 2;
  }
};
const getCardWidth = getRailCardWidth;

// ── "Liste Görünümü Seçin" modalındaki önizlemeler ──────────────────────────
// Gerçek ListCovers bileşeni boş bir listeyle (items=[]) çizilir: her afiş
// otomatik olarak yer tutucu kutuya düşer, oranlar/köşe mantığı/kenarlıklar
// gerçek karttakiyle BİREBİR aynı kalır — burada ayrıca kopyalanmaz.
const PREVIEW_H = 101;
const PREVIEW_W_1 = 166; // Büyük Kapaklar: 3 eşit afiş
const PREVIEW_W_2 = 142; // Küçük Kapaklar: 4×2 afiş
const PREVIEW_W_3 = getNaturalCoverWidth(3, PREVIEW_H); // Karışık
const PREVIEW_W_4 = getNaturalCoverWidth(4, PREVIEW_H); // Yığın
const noPreviewTmdbUrl = () => undefined;

const SHARED_KEY_PREFIX = "shared:";

export default function ProfileLists({ navigation }) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { lists, isLoading: isLoadingLists } = useProfileStats();
  const { user } = useAuth();
  const { gridStyle, saveListGridStyle, allCornersRounded, saveAllCornersRounded } = useProfileUi();
  const cardW = getCardWidth(gridStyle);
  const [layoutModalVisible, setLayoutModalVisible] = useState(false);
  const [createListVisible, setCreateListVisible] = useState(false);
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
            trackFirestoreRead("SharedLists/items", snap.docs.length);
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
          <GlassIconButton
            icon="add"
            iconSize={18}
            size={34}
            fallbackRadius={10}
            color={theme.text.primary ?? "white"}
            accessibilityLabel={i18nText("autoI18n.ekle", "Ekle")}
            onPress={() => setCreateListVisible(true)}
          />
          <GlassIconButton
            size={34}
            fallbackRadius={10}
            accessibilityLabel={i18nText("autoI18n.gorunumu_degistir", "Görünümü değiştir")}
            onPress={() => setLayoutModalVisible(true)}
          >
            <MaterialCommunityIcons
              name={gridStyle === 1 ? "grid-large" : gridStyle === 2 ? "grid" : gridStyle === 3 ? "view-dashboard" : "layers"}
              size={18}
              color={theme.text.primary ?? "white"}
            />
          </GlassIconButton>
          <GlassIconButton
            icon="arrow-forward-outline"
            iconSize={18}
            size={34}
            fallbackRadius={10}
            color={theme.text.primary ?? "white"}
            accessibilityLabel={i18nText("autoI18n.tum_listeler", "Tüm Listeler")}
            onPress={() => {
              navigation.navigate("ListsViewScreen");
            }}
          />
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
              const accent = shared ? getSharedListAccent(theme.secondary) : getListAccent(listName, theme.secondary);
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
                    {/* 1) Arka plan — kartın taban rengi, en arkada */}
                    <View
                      pointerEvents="none"
                      style={[styles.cardBg, { width: cardW, backgroundColor: theme.secondary }]}
                    />
                    {/* 2) Aksan yüzeyi — arka planın ÜSTÜNDE, kart dışına (alta) taşabilir */}
                    <View
                      pointerEvents="none"
                      style={[
                        styles.cardGlow,
                        { backgroundColor: accent + "18", borderColor: accent + "25" },
                      ]}
                    />
                    {/* 3) İçerikler — en üstte, kart şekliyle kırpılır */}
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
                        style={[styles.cardName, { color: theme.text.primary }]}
                        numberOfLines={1}
                      >
                        {displayName}
                      </Text>
                      {shared ? (
                        <View style={styles.sharedCountWrap}>
                          <Ionicons
                            name="person"
                            size={11}
                            color={theme.text.muted}
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
      {/* Artı butonu: yeni özel liste oluşturma */}
      <CreateListModal
        visible={createListVisible}
        onClose={() => setCreateListVisible(false)}
        existingNames={existingListNames}
        uid={user?.uid}
        onCreated={(listName) => {
          navigation.navigate("ListsScreen", { listName });
        }}
      />

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
                    <ListCovers
                      items={[]}
                      gridStyle={1}
                      allCornersRounded={allCornersRounded}
                      width={PREVIEW_W_1}
                      height={PREVIEW_H}
                      getTmdbUrl={noPreviewTmdbUrl}
                      theme={theme}
                    />
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
                    <ListCovers
                      items={[]}
                      gridStyle={3}
                      allCornersRounded={allCornersRounded}
                      width={PREVIEW_W_3}
                      height={PREVIEW_H}
                      getTmdbUrl={noPreviewTmdbUrl}
                      theme={theme}
                    />
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
                    <ListCovers
                      items={[]}
                      gridStyle={4}
                      allCornersRounded={allCornersRounded}
                      width={PREVIEW_W_4}
                      height={PREVIEW_H}
                      getTmdbUrl={noPreviewTmdbUrl}
                      theme={theme}
                    />
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
                    <ListCovers
                      items={[]}
                      gridStyle={2}
                      allCornersRounded={allCornersRounded}
                      width={PREVIEW_W_2}
                      height={PREVIEW_H}
                      getTmdbUrl={noPreviewTmdbUrl}
                      theme={theme}
                    />
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
  // 1) Arka plan — kartla birebir aynı kutu, en arkada durur.
  cardBg: {
    position: "absolute",
    top: 0,
    left: 0,
    height: CARD_H,
    borderRadius: 20,
  },
  // 2) Aksan yüzeyi — arka planın üstünde; kart dışına (alta) 4px taşar.
  cardGlow: {
    position: "absolute",
    top: 4,
    left: 4,
    right: 4,
    bottom: 0,
    borderRadius: 20,
    borderWidth: 1,
  },
  // 3) İçerik kapsayıcısı — en üstte, kendi arka planı YOK (alttaki katmanlar görünsün diye).
  card: {
    height: CARD_H,
    borderRadius: 20,
    overflow: "hidden",
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
  // Silme onayı artık ListManageSheet'te (Listelerim ekranıyla ortak sayfa).

  // ── Layout Modal Styles ──────────────────────────────────────────────────
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
});
