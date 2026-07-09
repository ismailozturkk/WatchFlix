import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  FlatList,
  Modal,
  Animated,
  ScrollView,
} from "react-native";
import React, { useEffect, useState } from "react";
import { useLanguage } from "../../../context/LanguageContext";
import { useTheme } from "../../../context/ThemeContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ListsSkeleton } from "../../../components/Skeleton";
import { LinearGradient } from "expo-linear-gradient";
import { useProfileStats } from "../../../context/ProfileStatsContext";
import { useProfileUi }    from "../../../context/ProfileUiContext";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useImageQualitySettings } from "../../../context/AppSettingsContext";
import SwitchToggle from "../../../components/SwitchToggle";

const sortItemsByListOrder = (items) =>
  (Array.isArray(items) ? items : []).slice().sort((a, b) => {
    const aHasOrder = Number.isFinite(a?.listOrder);
    const bHasOrder = Number.isFinite(b?.listOrder);

    if (aHasOrder && bHasOrder) {
      const orderDiff = a.listOrder - b.listOrder;
      if (orderDiff !== 0) return orderDiff;
    } else if (aHasOrder !== bHasOrder) {
      return aHasOrder ? -1 : 1;
    }

    const aDate = new Date(a?.dateAdded || 0).getTime() || 0;
    const bDate = new Date(b?.dateAdded || 0).getTime() || 0;
    return aDate - bDate || String(a?.id ?? "").localeCompare(String(b?.id ?? ""));
  });

// Sabit kart boyutu: en geniş poster düzeni referans alınır (Büyük Kapaklar:
// 3×60 poster + 2×2 boşluk + 2×10 dolgu = 204). Yükseklik tüm stillerde aynı
// (poster bloğu 112 + ayırıcı/alt bilgi). Kartlar içerikten bağımsız aynı kalır.
const CARD_W = 204;
const CARD_H = 171;

// ── Listeye özgü vurgu rengi/ikon — ListsViewScreen kartlarıyla birebir aynı ──
const getListAccent = (listName) => {
  switch (listName) {
    case "watchedMovies":
      return "#4fc3f7";
    case "watchedTv":
      return "#a78bfa";
    case "favorites":
      return "#f87171";
    case "watchList":
      return "#34d399";
    default:
      return "#fbbf24";
  }
};

const getListIcon = (listName) => {
  switch (listName) {
    case "watchedMovies":
      return "film";
    case "watchedTv":
      return "tv";
    case "favorites":
      return "heart";
    case "watchList":
      return "bookmark";
    default:
      return "list";
  }
};

export default function ProfileLists({ navigation }) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const {
    lists, isLoading: isLoadingLists,
    selectedList, setSelectedList,
    modalDeleteVisible, setModalDeleteVisible, deleteList,
  } = useProfileStats();
  const { gridStyle, setGridStyle, saveListGridStyle, allCornersRounded, saveAllCornersRounded } = useProfileUi();
  const [layoutModalVisible, setLayoutModalVisible] = useState(false);
  // ...existing code...
  const [scaleValues, setScaleValues] = useState({});
  const { imageQuality, getTmdbUrl } = useImageQualitySettings();
  useEffect(() => {
    const newScaleValues = {};
    lists.forEach((list) => {
      newScaleValues[list[0]] = new Animated.Value(1);
    });
    setScaleValues(newScaleValues);
  }, [lists]);

  const onPressIn = (listName) => {
    Animated.timing(scaleValues[listName], {
      toValue: 0.9,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = (listName) => {
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
            ]}
            keyExtractor={([listName]) => listName}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 15, gap: 10 }}
            renderItem={({ item }) => {
              const [listName, items] = item;
              const orderedItems = sortItemsByListOrder(items);
              const accent = getListAccent(listName);
              const icon = getListIcon(listName);
              const displayName =
                listName === "watchedMovies"
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
                    navigation.navigate("ListsScreen", { listName });
                  }}
                  onLongPress={() => {
                    if (!protectedLists.includes(listName)) {
                      setSelectedList(listName);
                      setModalDeleteVisible(true);
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
                    <View style={styles.card}>
                    {gridStyle === 1 ? (
                      <View
                        style={{
                          flexDirection: "row",
                          gap: 2,
                        }}
                      >
                        {[0, 1, 2].map((index) => {
                          const item = orderedItems[index];
                          if (item && item.imagePath) {
                            return (
                              <Image
                                key={index}
                                source={{
                                  uri: getTmdbUrl(item.imagePath, 'poster', 200),
                                }}
                                style={[
                                  styles.image,
                                  { width: 60, height: 112 },
                                  allCornersRounded ? { borderRadius: 10 } : index === 0 ? { borderTopLeftRadius: 10,
                                        borderBottomLeftRadius: 10,
                                      }
                                    : index === 1
                                      ? {}
                                      : {
                                          borderTopRightRadius: 10,
                                          borderBottomRightRadius: 10,
                                        },
                                ]}
                              />
                            );
                          } else {
                            return (
                              <View
                                key={index}
                                style={[
                                  styles.placeholder,
                                  { width: 60, height: 112 },

                                  allCornersRounded ? { borderRadius: 10 } : index === 0 ? { borderTopLeftRadius: 10,
                                        borderBottomLeftRadius: 10,
                                      }
                                    : index === 1
                                      ? {}
                                      : {
                                          borderTopRightRadius: 10,
                                          borderBottomRightRadius: 10,
                                        },
                                  { backgroundColor: theme.primary },
                                ]}
                              />
                            );
                          }
                        })}
                      </View>
                    ) : gridStyle === 2 ? (
                      <>
                        <View
                          style={{
                            flexDirection: "row",
                            gap: 2,
                          }}
                        >
                          {[0, 1, 2, 3].map((index) => {
                            const item = orderedItems[index];
                            if (item && item.imagePath) {
                              return (
                                <Image
                                  key={index}
                                  source={{
                                    uri: getTmdbUrl(item.imagePath, 'poster', 200),
                                  }}
                                  style={[
                                    styles.image,
                                    allCornersRounded ? { borderRadius: 10 } : index === 0 ? { borderTopLeftRadius: 10,
                                          borderBottomLeftRadius: gridStyle
                                            ? 10
                                            : 0,
                                        }
                                      : index === 3
                                        ? {
                                            borderTopRightRadius: 10,
                                            borderBottomRightRadius: gridStyle
                                              ? 10
                                              : 0,
                                          }
                                        : {},
                                  ]}
                                />
                              );
                            } else {
                              return (
                                <View
                                  key={index}
                                  style={[
                                    styles.placeholder,
                                    allCornersRounded ? { borderRadius: 10 } : index === 0 ? { borderTopLeftRadius: 10,
                                          borderBottomLeftRadius: gridStyle
                                            ? 10
                                            : 0,
                                        }
                                      : index === 3
                                        ? {
                                            borderTopRightRadius: 10,
                                            borderBottomRightRadius: gridStyle
                                              ? 10
                                              : 0,
                                          }
                                        : {},
                                    { backgroundColor: theme.primary },
                                  ]}
                                />
                              );
                            }
                          })}
                        </View>

                        <View
                          style={{
                            flexDirection: "row",
                            gap: 2,
                          }}
                        >
                          {[4, 5, 6, 7].map((index) => {
                            const item = orderedItems[index];
                            if (item && item.imagePath) {
                              return (
                                <Image
                                  key={index}
                                  source={{
                                    uri: getTmdbUrl(item.imagePath, 'poster', 200),
                                  }}
                                  style={[
                                    styles.image,
                                    allCornersRounded ? { borderRadius: 10 } : index === 4 ? { borderTopLeftRadius: gridStyle ? 10 : 0,
                                          borderBottomLeftRadius: 10,
                                        }
                                      : index === 7
                                        ? {
                                            borderTopRightRadius: gridStyle
                                              ? 10
                                              : 0,
                                            borderBottomRightRadius: 10,
                                          }
                                        : {},
                                  ]}
                                />
                              );
                            } else {
                              return (
                                <View
                                  key={index}
                                  style={[
                                    styles.placeholder,
                                    allCornersRounded ? { borderRadius: 10 } : index === 4 ? { borderTopLeftRadius: gridStyle ? 10 : 0,
                                          borderBottomLeftRadius: 10,
                                        }
                                      : index === 7
                                        ? {
                                            borderTopRightRadius: gridStyle
                                              ? 10
                                              : 0,
                                            borderBottomRightRadius: 10,
                                          }
                                        : {},
                                    { backgroundColor: theme.primary },
                                  ]}
                                />
                              );
                            }
                          })}
                        </View>
                      </>
                    ) : gridStyle === 3 ? (
                      <View style={{ flexDirection: "row", gap: 2 }}>
                        <View style={{ width: 75, height: 112 }}>
                          {orderedItems[0]?.imagePath ? (
                            <Image
                              source={{ uri: getTmdbUrl(orderedItems[0].imagePath, 'poster', 200) }}
                              style={[styles.image, { width: 75, height: 112 }, allCornersRounded ? { borderRadius: 10 } : { borderTopLeftRadius: 10, borderBottomLeftRadius: 10 }]}
                            />
                          ) : (
                            <View style={[styles.placeholder, { width: 75, height: 112 }, allCornersRounded ? { borderRadius: 10 } : { borderTopLeftRadius: 10, borderBottomLeftRadius: 10 }, { backgroundColor: theme.primary }]} />
                          )}
                        </View>
                        <View style={{ gap: 2 }}>
                          <View style={{ width: 37.5, height: 55 }}>
                            {orderedItems[1]?.imagePath ? (
                              <Image
                                source={{ uri: getTmdbUrl(orderedItems[1].imagePath, 'poster', 200) }}
                                style={[styles.image, { width: 37.5, height: 55 }, allCornersRounded ? { borderRadius: 10 } : { borderTopRightRadius: 10 }]}
                              />
                            ) : (
                              <View style={[styles.placeholder, { width: 37.5, height: 55 }, allCornersRounded ? { borderRadius: 10 } : { borderTopRightRadius: 10 }, { backgroundColor: theme.primary }]} />
                            )}
                          </View>
                          <View style={{ width: 37.5, height: 55 }}>
                            {orderedItems[2]?.imagePath ? (
                              <Image
                                source={{ uri: getTmdbUrl(orderedItems[2].imagePath, 'poster', 200) }}
                                style={[styles.image, { width: 37.5, height: 55 }, allCornersRounded ? { borderRadius: 10 } : { borderBottomRightRadius: 10 }]}
                              />
                            ) : (
                              <View style={[styles.placeholder, { width: 37.5, height: 55 }, allCornersRounded ? { borderRadius: 10 } : { borderBottomRightRadius: 10 }, { backgroundColor: theme.primary }]} />
                            )}
                          </View>
                        </View>
                      </View>
                    ) : (
                      <View style={{ width: 138, height: 112, alignItems: "center", justifyContent: "center" }}>
                        {[2, 1, 0].map((i) => {
                          const item = orderedItems[i];
                          const angles = [0, -6, 6];
                          const offsets = [0, -22, 22];
                          const zIndexes = [3, 2, 1];
                          return (
                            <View
                              key={i}
                              style={{
                                position: "absolute",
                                transform: [
                                  { rotate: `${angles[i]}deg` },
                                  { translateX: offsets[i] },
                                ],
                                zIndex: zIndexes[i],
                                width: 75,
                                height: 112,
                                borderRadius: 10,
                                overflow: "hidden",
                                borderWidth: 1,
                                borderColor: "rgba(255,255,255,0.1)",
                              }}
                            >
                              {item && item.imagePath ? (
                                <Image
                                  source={{ uri: getTmdbUrl(item.imagePath, 'poster', 200) }}
                                  style={{ width: "100%", height: "100%" }}
                                />
                              ) : (
                                <View style={[styles.placeholder, { width: "100%", height: "100%", backgroundColor: theme.primary }]} />
                              )}
                            </View>
                          );
                        })}
                      </View>
                    )}

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
                      <Text
                        allowFontScaling={false}
                        style={[styles.countBadge, { color: accent }]}
                      >
                        {orderedItems.length}
                      </Text>
                    </View>
                    </View>
                  </Animated.View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalDeleteVisible}
        onRequestClose={() => setModalDeleteVisible(false)}
      >
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={["transparent", theme.shadow, "transparent"]}
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              left: 0,
              bottom: 0,
              zIndex: 0,
            }}
          />
          <TouchableOpacity
            style={styles.modalBackdrop}
            onPress={() => setModalDeleteVisible(false)}
          />
          <View style={[styles.modalView, { backgroundColor: theme.primary }]}>
            <Text
              allowFontScaling={false}
              style={[styles.modalText, { color: theme.text.primary }]}
            >
              "{selectedList}" listesini silmek istiyor musunuz?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.buttonCancel]}
                onPress={() => setModalDeleteVisible(false)}
              >
                <Text allowFontScaling={false} style={styles.textStyle}>
                  {t.cancel}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.buttonConfirm]}
                onPress={deleteList}
              >
                <Text allowFontScaling={false} style={styles.textStyle}>
                  {t.confirm}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Görünüm Seçimi Modalı */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={layoutModalVisible}
        onRequestClose={() => setLayoutModalVisible(false)}
      >
        <View style={styles.bottomModalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setLayoutModalVisible(false)} />
          <View style={[styles.bottomModalSheet, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
            <View style={[styles.modalDragHandle, { backgroundColor: theme.text.muted }]} />
            <Text style={[styles.bottomModalTitle, { color: theme.text.primary }]}>Liste Görünümü Seçin</Text>

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
                      <Text style={{ color: theme.text.primary, fontSize: 13, fontWeight: "600" }}>Büyük Kapaklar</Text>
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
                      <Text style={{ color: theme.text.primary, fontSize: 13, fontWeight: "600" }}>Karışık</Text>
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
                      <Text style={{ color: theme.text.primary, fontSize: 13, fontWeight: "600" }}>Yığın</Text>
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
                      <Text style={{ color: theme.text.primary, fontSize: 13, fontWeight: "600" }}>Küçük Kapaklar</Text>
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
                  <Text style={{ color: theme.text.primary, fontSize: 14, fontWeight: "600" }}>Ayrı Köşeli Afişler</Text>
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
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { width: "100%" },
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
    width: CARD_W,
    height: CARD_H,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 10,
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
  image: { width: 37.5, height: 55 },
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
  modalContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  modalBackdrop: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  modalView: { padding: 20, borderRadius: 10, alignItems: "center" },
  modalButtons: { flexDirection: "row", marginTop: 10 },
  button: { padding: 10, marginHorizontal: 5, borderRadius: 5 },

  buttonCancel: {
    backgroundColor: "#f44336",
  },
  buttonConfirm: {
    backgroundColor: "#4CAF50",
  },
  textStyle: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center",
  },

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
