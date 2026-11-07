import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  FlatList,
  Animated,
  useWindowDimensions,
  } from "react-native";
import React, { useEffect, useMemo, useState } from "react";
import BottomSheetModal from "@components/common/BottomSheetModal";
import SheetScroll from "@components/common/SheetScroll";
import { SPLASH_POSTER_CATALOG } from "../../../data/splashPosterCatalog";
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
import ListCovers, {
  getNaturalCoverWidth,
  getSizingStyle,
  LAYOUT_COUNT_VARIANTS,
  LIST_LAYOUT,
} from "../../../components/lists/ListCovers";
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
  // 3/5 seçimi ve Film Şeridi/Vitrin kendi eşinin genişliğini kullanır.
  switch (getSizingStyle(gridStyle)) {
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
// Gerçek ListCovers bileşeni raydaki GERÇEK ölçüsünde (COVER_H × kart içi
// genişlik) çizilir, sonra kutuya sığacak kadar `scale` ile küçültülür: oranlar,
// kaymalar, köşe mantığı gerçek karttakiyle BİREBİR aynı kalır, küçük boyda
// sabit piksel kaymaları (yığın, polaroid) bozulmaz. Tüm düzenler AYNI ölçekle
// küçülür — aralarındaki gerçek genişlik farkı önizlemede de görünür.
//
// Afişler uygulamayla paketlenen açılış posterleri (ağ beklemez, boş liste de
// anlamlı görünür). listOrder verilir: ListCovers sırayı ona göre dizer.
const PREVIEW_SAMPLE_ITEMS = SPLASH_POSTER_CATALOG.slice(0, 8).map((p, i) => ({
  id: p.id,
  type: p.mediaType,
  localSource: p.source,
  listOrder: i,
}));
const PICKER_COLUMNS = 3;
const PICKER_GAP = 6;
// Sayfanın iki yanındaki boşluk (SheetScroll contentContainerStyle).
const PICKER_SIDE = 12;
// Kartın iç dolgusu + kenarlığı (styles.pickerTile).
const PICKER_TILE_INSET = 4;
const coverWidthAt = (gridStyle) => getRailCardWidth(gridStyle) - CARD_PADDING * 2;
const MAX_COVER_W = coverWidthAt(LIST_LAYOUT.BIG);

// Başlıktaki "Görünümü değiştir" düğmesinin simgesi — seçili düzeni gösterir.
const LAYOUT_ICONS = {
  [LIST_LAYOUT.BIG]: "grid-large",
  [LIST_LAYOUT.BIG_5]: "view-column",
  [LIST_LAYOUT.SMALL]: "grid",
  [LIST_LAYOUT.MIXED]: "view-dashboard",
  [LIST_LAYOUT.STACK]: "layers",
  [LIST_LAYOUT.STACK_3]: "layers-outline",
  [LIST_LAYOUT.FILMSTRIP]: "filmstrip",
  [LIST_LAYOUT.SHOWCASE]: "view-carousel",
  [LIST_LAYOUT.POLAROID]: "polaroid",
  [LIST_LAYOUT.DIAGONAL]: "view-parallel",
  [LIST_LAYOUT.WALL]: "view-quilt",
};

// Seçicideki tek düzen kartı (kompakt, 3 sütunlu ızgarada). `variants`
// verilirse ({3: id, 5: id}) önizlemenin sağ üst köşesinde 3/5 seçimi çıkar:
// karta basmak ailenin o anki (yoksa varsayılan) sayısını seçip sayfayı
// kapatır; sayıya basmak yalnız sayıyı değiştirir ve sayfa açık kalır —
// önizleme yerinde güncellenir.
const LayoutOption = ({
  layout,
  variants,
  defaultCount,
  label,
  icon,
  current,
  allCornersRounded,
  theme,
  scale,
  onSelect,
}) => {
  const familyIds = variants ? Object.values(variants) : [layout];
  const isActive = familyIds.includes(current);
  const activeCount = variants
    ? Number(Object.keys(variants).find((n) => variants[n] === current) ?? defaultCount)
    : null;
  const shown = variants ? variants[activeCount] : layout;
  const realW = coverWidthAt(shown);
  const boxH = COVER_H * scale;

  return (
    <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.8} onPress={() => onSelect(shown, true)}>
      <View
        style={[
          styles.pickerTile,
          {
            backgroundColor: theme.secondary,
            borderColor: isActive ? theme.colors.orange : theme.border,
          },
        ]}
      >
        <View style={{ width: "100%", height: boxH, alignItems: "center", opacity: isActive ? 1 : 0.75 }}>
          {/* Gerçek ölçüde çizip ölçekle: transform yerleşimi etkilemez, bu yüzden
              iç kutu dış kutunun ortasına mutlak konumlanır. */}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              width: realW,
              height: COVER_H,
              top: (boxH - COVER_H) / 2,
              left: "50%",
              marginLeft: -realW / 2,
              transform: [{ scale }],
            }}
          >
            <ListCovers
              items={PREVIEW_SAMPLE_ITEMS}
              gridStyle={shown}
              allCornersRounded={allCornersRounded}
              width={realW}
              height={COVER_H}
              theme={theme}
            />
          </View>
        </View>
        <View style={styles.pickerLabelRow}>
          {icon}
          <Text
            numberOfLines={1}
            style={{ flexShrink: 1, color: theme.text.primary, fontSize: 11, fontWeight: "600" }}
          >
            {label}
          </Text>
        </View>
        {variants && (
            <View
              style={[
                styles.countSwitch,
                { borderColor: theme.border, backgroundColor: theme.secondary },
              ]}
            >
              {Object.keys(variants).map((n) => {
                const on = Number(n) === activeCount;
                return (
                  <TouchableOpacity
                    key={n}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    onPress={() => onSelect(variants[n], false)}
                    style={[
                      styles.countChip,
                      on && { backgroundColor: theme.colors.orange },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "700",
                        color: on ? "#fff" : theme.text.secondary ?? theme.text.primary,
                      }}
                    >
                      {n}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const SHARED_KEY_PREFIX = "shared:";

export default function ProfileLists({ navigation }) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { lists, isLoading: isLoadingLists } = useProfileStats();
  const { user } = useAuth();
  const { gridStyle, saveListGridStyle, allCornersRounded, saveAllCornersRounded } = useProfileUi();
  const cardW = getCardWidth(gridStyle);
  // Seçici kartlarının ölçeği: 3 sütun, en geniş düzen (Büyük Kapaklar) kartın
  // iç genişliğine sığar; diğerleri aynı ölçekle küçülür.
  const { width: windowW } = useWindowDimensions();
  const pickerTileW = (windowW - PICKER_SIDE * 2 - PICKER_GAP * (PICKER_COLUMNS - 1)) / PICKER_COLUMNS;
  const pickerScale = Math.max(0.3, (pickerTileW - PICKER_TILE_INSET * 2) / MAX_COVER_W);
  const pickerOptions = [
    { key: "big", variants: LAYOUT_COUNT_VARIANTS.big, defaultCount: 3, label: i18nText("autoI18n.buyuk_kapaklar", "Büyük Kapaklar"), icon: <MaterialCommunityIcons name="movie" size={12} color={theme.colors.green} /> },
    { key: "stack", variants: LAYOUT_COUNT_VARIANTS.stack, defaultCount: 5, label: i18nText("autoI18n.yigin_gorunum", "Yığın"), icon: <MaterialCommunityIcons name="layers" size={12} color={theme.colors.purple || "#a78bfa"} /> },
    { key: "mixed", layout: LIST_LAYOUT.MIXED, label: i18nText("autoI18n.karisik_gorunum", "Karışık"), icon: <MaterialCommunityIcons name="view-dashboard" size={12} color={theme.colors.blue} /> },
    { key: "small", layout: LIST_LAYOUT.SMALL, label: i18nText("autoI18n.kucuk_kapaklar", "Küçük Kapaklar"), icon: <Ionicons name="grid" size={12} color={theme.colors.orange} /> },
    { key: "film", layout: LIST_LAYOUT.FILMSTRIP, label: i18nText("autoI18n.film_seridi_gorunum", "Film Şeridi"), icon: <MaterialCommunityIcons name="filmstrip" size={12} color={theme.colors.red || "#ef4444"} /> },
    { key: "showcase", layout: LIST_LAYOUT.SHOWCASE, label: i18nText("autoI18n.vitrin_gorunum", "Vitrin"), icon: <MaterialCommunityIcons name="view-carousel" size={12} color={theme.colors.yellow || "#facc15"} /> },
    { key: "polaroid", layout: LIST_LAYOUT.POLAROID, label: i18nText("autoI18n.polaroid_gorunum", "Polaroid"), icon: <MaterialCommunityIcons name="polaroid" size={12} color={theme.colors.pink || "#f472b6"} /> },
    { key: "diagonal", layout: LIST_LAYOUT.DIAGONAL, label: i18nText("autoI18n.diyagonal_gorunum", "Diyagonal"), icon: <MaterialCommunityIcons name="view-parallel" size={12} color={theme.colors.teal || "#2dd4bf"} /> },
    { key: "wall", layout: LIST_LAYOUT.WALL, label: i18nText("autoI18n.afis_duvari_gorunum", "Afiş Duvarı"), icon: <MaterialCommunityIcons name="view-quilt" size={12} color={theme.colors.orange || "#fb923c"} /> },
  ];
  const pickerRows = [];
  for (let i = 0; i < pickerOptions.length; i += PICKER_COLUMNS) {
    pickerRows.push(pickerOptions.slice(i, i + PICKER_COLUMNS));
  }
  const optionProps = {
    current: gridStyle,
    scale: pickerScale,
    allCornersRounded,
    theme,
    onSelect: (layout, close) => {
      saveListGridStyle(layout);
      if (close) setLayoutModalVisible(false);
    },
  };
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
              name={LAYOUT_ICONS[gridStyle] ?? "layers"}
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

            {/* 10 düzen + köşe anahtarı küçük ekranda sığmaz: bölge küçülüp kayar. */}
            <SheetScroll style={{ width: "100%" }} contentContainerStyle={{ paddingHorizontal: PICKER_SIDE, gap: PICKER_GAP }}>
              {/* Kompakt 3 sütunlu ızgara: 3/5 seçimli aileler önde, yeni düzenler arkada.
                  9 düzen = 3×3; ileride sayı değişip son satır eksik kalırsa boş hücreyle doldurulur (kartlar eşit genişlikte kalır). */}
              {pickerRows.map((row, r) => (
                <View key={r} style={{ flexDirection: "row", gap: PICKER_GAP }}>
                  {row.map(({ key, ...opt }) => (
                    <LayoutOption key={key} {...opt} {...optionProps} />
                  ))}
                  {Array.from({ length: PICKER_COLUMNS - row.length }, (_, i) => (
                    <View key={`pad-${i}`} style={{ flex: 1 }} />
                  ))}
                </View>
              ))}

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
                {/* Sol grup kalan boşluğu alır: uzun çeviride metin daralır, anahtar
                    (gerçek genişliğinde, küçülmez) kartın dışına taşmaz. */}
                <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10, paddingRight: 12 }}>
                  <Ionicons name="crop-outline" size={20} color={theme.text.primary} />
                  <Text style={{ flexShrink: 1, color: theme.text.primary, fontSize: 14, fontWeight: "600" }}>
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
            </SheetScroll>
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  pickerTile: {
    width: "100%",
    padding: 3,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    overflow: "hidden",
  },
  pickerLabelRow: {
    marginTop: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    maxWidth: "100%",
  },
  countSwitch: {
    position: "absolute",
    top: 3,
    right: 3,
    zIndex: 10,
    flexDirection: "row",
    padding: 2,
    gap: 2,
    borderRadius: 9,
    borderWidth: 1,
  },
  countChip: {
    minWidth: 17,
    height: 15,
    paddingHorizontal: 4,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  section: { width: "100%", marginBottom: 14 },
  sectionTitle: {
    fontSize: 14,
    textTransform: "uppercase",
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
    maxHeight: "88%",
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
