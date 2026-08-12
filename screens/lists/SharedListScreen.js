import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  Keyboard,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BottomSheetModal from "@components/common/BottomSheetModal";
import Ionicons from "@expo/vector-icons/Ionicons";
import Feather from "@expo/vector-icons/Feather";
import Toast from "react-native-toast-message";
import * as Haptics from "@services/hapticsService";
import BackButton from "../../components/BackButton";
import PosterImage from "@components/PosterImage";
import SwitchToggle from "../../components/SwitchToggle";
import appAlert from "../../components/AppAlert";
import { useTheme } from "@context/ThemeContext";
import { useAuth } from "@context/AuthContext";
import { getAvatarSource } from "@utils/avatars";
import { i18nText } from "@utils/i18nText";
import CreateSharedListModal from "../../components/modals/CreateSharedListModal";
import ScreenDecor from "@components/ScreenDecor";
import ListItemActionsSheet from "@components/lists/ListItemActionsSheet";
import ListSearchBar from "@components/lists/ListSearchBar";
import GlobalSearchResults from "@components/lists/GlobalSearchResults";
import ListPosterInfoControls from "@components/lists/ListPosterInfoControls";
import {
  useApiSettings,
  useContentSettings,
  useListLayoutSettings,
} from "@context/AppSettingsContext";
import { useLanguage } from "@context/LanguageContext";
import { useUserProfile } from "@context/UserProfileContext";
import { buildGenreMap } from "@utils/genreLabels";
import {
  buildListKeySet,
  GLOBAL_SEARCH_MIN_CHARS,
  LIST_SEARCH_MODE,
  matchesListQuery,
  topListGenres,
} from "@utils/listSearch";
import {
  addMediaToSharedList,
  fetchSuggestionsForList,
  searchForList,
} from "@services/listQuickAdd";
import {
  subscribeToSharedList,
  subscribeToSharedListItems,
  removeItemFromSharedList,
  removeSharedListMember,
  updateSharedListPermission,
  leaveSharedList,
  deleteSharedList,
  isSharedListOwner,
  canAddToSharedList,
  canRemoveFromSharedList,
  canReorderSharedList,
  reorderSharedListItems,
} from "@services/sharedListsService";

const ACCENT = "#38bdf8"; // ListsViewScreen'deki ortak liste vurgusuyla aynı
const SHARED_SEARCH_LIST = "__shared__";
const GRID_SIDE_PADDING = 12;
const GRID_COLUMN_GAP = 8;
const POSTER_ASPECT_RATIO = 1.52;

// Diziyi 3'lük satırlara böl (ListsScreen'deki elle grid deseni — Android'de
// dinamik numColumns çökmesine karşı).
const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const FilterChip = ({ label, selected, onPress, theme }) => (
  <TouchableOpacity
    activeOpacity={0.82}
    onPress={onPress}
    style={[
      styles.filterChip,
      {
        backgroundColor: selected ? ACCENT + "22" : theme.primary,
        borderColor: selected ? ACCENT : theme.border,
      },
    ]}
  >
    {selected ? <Ionicons name="checkmark" size={13} color={ACCENT} /> : null}
    <Text style={[styles.filterChipText, { color: selected ? ACCENT : theme.text.secondary }]}>
      {label}
    </Text>
  </TouchableOpacity>
);

export default function SharedListScreen({ route, navigation }) {
  const { width } = useWindowDimensions();
  const { listId } = route.params || {};
  const { theme } = useTheme();
  const { user } = useAuth();
  const uid = user?.uid;
  const { language, t } = useLanguage();
  const { API_KEY } = useApiSettings();
  const { adultContent } = useContentSettings();
  const {
    listsGridColumns: gridColumns,
    changeListsGridColumns: changeGridColumns,
    listsPosterRadius: posterRadius,
    changeListsPosterRadius: changePosterRadius,
    listPosterInfo,
    changeListPosterInfo,
  } = useListLayoutSettings();
  const posterW =
    (width - GRID_SIDE_PADDING * 2 - GRID_COLUMN_GAP * (gridColumns - 1)) /
    gridColumns;
  const posterH = posterW * POSTER_ASPECT_RATIO;
  const profile = useUserProfile();
  const genreMap = useMemo(() => buildGenreMap(), [language]);

  const [list, setList] = useState(undefined); // undefined=yükleniyor, null=yok/erişim yok
  const [items, setItems] = useState([]);
  const [membersVisible, setMembersVisible] = useState(false);
  const [addMemberVisible, setAddMemberVisible] = useState(false);
  const [queryText, setQueryText] = useState("");
  const [searchMode, setSearchMode] = useState(LIST_SEARCH_MODE.IN_LIST);
  const [globalResults, setGlobalResults] = useState([]);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalError, setGlobalError] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [addingKey, setAddingKey] = useState(null);
  const [itemsReady, setItemsReady] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("default");
  const [genreFilter, setGenreFilter] = useState([]);
  const [memberFilter, setMemberFilter] = useState("all");
  const [memberFiltersExpanded, setMemberFiltersExpanded] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [actionItem, setActionItem] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const suppressPressRef = useRef(false);

  useEffect(() => {
    const unsubList = subscribeToSharedList(listId, setList);
    const unsubItems = subscribeToSharedListItems(listId, (next) => {
      setItems(next);
      setItemsReady(true);
    });
    return () => {
      unsubList();
      unsubItems();
    };
  }, [listId]);

  const isOwner = isSharedListOwner(list, uid);

  // Üyeler: kurucu en üstte, kalanlar eklenme sırasına göre.
  const memberRows = useMemo(() => {
    if (!list?.members) return [];
    return Object.entries(list.members)
      .map(([mUid, m]) => ({ uid: mUid, ...m }))
      .sort((a, b) => {
        if (a.uid === list.ownerId) return -1;
        if (b.uid === list.ownerId) return 1;
        return (a.addedAt || 0) - (b.addedAt || 0);
      });
  }, [list]);

  const availableGenres = useMemo(() => {
    const genres = new Set();
    items.forEach((item) =>
      (item.genres || []).forEach((genre) => genre && genres.add(genre)),
    );
    return Array.from(genres).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const memberContentCounts = useMemo(() => {
    const counts = {};
    items.forEach((item) => {
      if (!item.addedBy) return;
      counts[item.addedBy] = (counts[item.addedBy] || 0) + 1;
    });
    return counts;
  }, [items]);

  useEffect(() => {
    if (
      memberFilter !== "all" &&
      !memberRows.some((member) => member.uid === memberFilter)
    )
      setMemberFilter("all");
  }, [memberFilter, memberRows]);

  const filteredItems = useMemo(() => {
    const next = items.filter((item) => {
      if (!matchesListQuery(item, queryText)) return false;
      if (typeFilter !== "all" && item.type !== typeFilter) return false;
      if (memberFilter !== "all" && item.addedBy !== memberFilter) return false;
      if (
        genreFilter.length > 0 &&
        !(item.genres || []).some((genre) => genreFilter.includes(genre))
      )
        return false;
      return true;
    });
    if (sortBy === "name")
      return next.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    if (sortBy === "newest")
      return next.sort(
        (a, b) =>
          (b.addedAt?.toMillis?.() ?? 0) - (a.addedAt?.toMillis?.() ?? 0),
      );
    return next;
  }, [items, queryText, typeFilter, memberFilter, genreFilter, sortBy]);

  const gridRows = useMemo(
    () => chunk(filteredItems, gridColumns),
    [filteredItems, gridColumns],
  );
  const activeFilterCount =
    (typeFilter !== "all" ? 1 : 0) +
    (memberFilter !== "all" ? 1 : 0) +
    (genreFilter.length > 0 ? 1 : 0) +
    (sortBy !== "default" ? 1 : 0);
  const actionIndex = actionItem
    ? items.findIndex((item) => item.key === actionItem.key)
    : -1;
  const visibleMemberFilters = useMemo(() => {
    if (memberFiltersExpanded || memberRows.length <= 6) return memberRows;
    const first = memberRows.slice(0, 6);
    if (
      memberFilter === "all" ||
      first.some((member) => member.uid === memberFilter)
    )
      return first;
    const selected = memberRows.find((member) => member.uid === memberFilter);
    return selected ? [...first.slice(0, 5), selected] : first;
  }, [memberFilter, memberFiltersExpanded, memberRows]);

  const existingKeys = useMemo(() => buildListKeySet(items), [items]);
  const suggestionGenres = useMemo(
    () => topListGenres(items, { limit: 3 }),
    [items],
  );
  const canAdd = canAddToSharedList(list, uid);
  const canReorder = canReorderSharedList(list, uid);

  const globalReqRef = useRef(0);
  useEffect(() => {
    if (searchMode !== LIST_SEARCH_MODE.GLOBAL) {
      globalReqRef.current += 1;
      setGlobalLoading(false);
      setGlobalError(false);
      return undefined;
    }
    const text = queryText.trim();
    if (text.length < GLOBAL_SEARCH_MIN_CHARS) {
      globalReqRef.current += 1;
      setGlobalResults([]);
      setGlobalLoading(false);
      setGlobalError(false);
      return undefined;
    }
    const requestId = ++globalReqRef.current;
    setGlobalLoading(true);
    setGlobalError(false);
    const timer = setTimeout(async () => {
      try {
        const found = await searchForList({
          listName: SHARED_SEARCH_LIST,
          query: text,
          apiKey: API_KEY,
          language,
          adultContent,
        });
        if (requestId === globalReqRef.current) setGlobalResults(found);
      } catch {
        if (requestId === globalReqRef.current) {
          setGlobalResults([]);
          setGlobalError(true);
        }
      } finally {
        if (requestId === globalReqRef.current) setGlobalLoading(false);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [searchMode, queryText, API_KEY, language, adultContent]);

  const suggestionsRef = useRef(null);
  useEffect(() => {
    if (searchMode !== LIST_SEARCH_MODE.GLOBAL || !API_KEY) return undefined;
    const key = `${listId}|${suggestionGenres.join(",")}`;
    if (suggestionsRef.current === key) return undefined;
    suggestionsRef.current = key;
    let alive = true;
    fetchSuggestionsForList({
      listName: SHARED_SEARCH_LIST,
      apiKey: API_KEY,
      language,
      genreNames: suggestionGenres,
    })
      .then((next) => alive && setSuggestions(next))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [searchMode, listId, API_KEY, language, suggestionGenres]);

  const autoModeRef = useRef(null);
  useEffect(() => {
    if (!itemsReady || autoModeRef.current === listId) return;
    autoModeRef.current = listId;
    setSearchMode(
      items.length === 0 ? LIST_SEARCH_MODE.GLOBAL : LIST_SEARCH_MODE.IN_LIST,
    );
  }, [itemsReady, items.length, listId]);

  // ── Eylemler ────────────────────────────────────────────────────────────────

  const openMediaDetails = (media) => {
    Keyboard.dismiss();
    navigation.navigate(
      media.type === "movie" ? "MovieDetails" : "TvShowsDetails",
      { id: media.id },
    );
  };

  const addGlobalMedia = async (media) => {
    if (!canAdd) {
      Toast.show({
        type: "warning",
        text1: i18nText("autoI18n.ekleme_yetkin_yok", "Bu listeye ekleme yetkin yok"),
      });
      return;
    }
    setAddingKey(media.key);
    try {
      await addMediaToSharedList({
        listId,
        user: {
          uid,
          displayName: profile?.displayName || user?.displayName || "",
          username: profile?.username || "",
          avatarIndex: profile?.avatarIndex ?? 0,
        },
        media,
        apiKey: API_KEY,
        language,
        genreMap,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Toast.show({
        type: "success",
        text1: i18nText("autoI18n.ortak_listeye_eklendi", "Ortak listeye eklendi"),
      });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: i18nText("autoI18n.islem_tamamlanamadi", "İşlem tamamlanamadı"),
      });
    } finally {
      setAddingKey(null);
    }
  };

  const moveSharedItem = async (targetIndex) => {
    if (!actionItem || actionIndex < 0 || actionBusy || !canReorder) return;
    const previous = items;
    const ordered = [...items];
    const [moved] = ordered.splice(actionIndex, 1);
    ordered.splice(targetIndex, 0, moved);
    setActionBusy(true);
    setItems(ordered);
    try {
      await reorderSharedListItems(listId, ordered, actionIndex, targetIndex);
      setActionItem(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Toast.show({
        type: "success",
        text1: i18nText("autoI18n.sira_guncellendi", "Sıra güncellendi"),
      });
    } catch (error) {
      setItems(previous);
      Toast.show({
        type: "error",
        text1: i18nText("autoI18n.islem_tamamlanamadi", "İşlem tamamlanamadı"),
      });
    } finally {
      setActionBusy(false);
    }
  };

  const removeSharedItem = async () => {
    if (!actionItem || actionBusy) return;
    if (!canRemoveFromSharedList(list, uid, actionItem)) return;
    setActionBusy(true);
    try {
      await removeItemFromSharedList(listId, actionItem.type, actionItem.id);
      setActionItem(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Toast.show({
        type: "success",
        text1: i18nText("autoI18n.listeden_kaldirildi", "Listeden kaldırıldı"),
      });
    } catch (error) {
      Toast.show({ type: "error", text1: error?.message });
    } finally {
      setActionBusy(false);
    }
  };

  const confirmRemoveMember = (member) => {
    appAlert(
      i18nText("autoI18n.uyeyi_cikar", "Üyeyi çıkar"),
      i18nText(
        "autoI18n.uyeyi_listeden_cikar_onay",
        "{{name}} listeden çıkarılsın mı?",
        { name: member.name || member.username },
      ),
      [
        { text: i18nText("autoI18n.iptal", "İptal"), style: "cancel" },
        {
          text: i18nText("autoI18n.cikar", "Çıkar"),
          style: "destructive",
          onPress: () =>
            removeSharedListMember(listId, member.uid).catch((e) =>
              Toast.show({ type: "error", text1: e.message }),
            ),
        },
      ],
    );
  };

  const confirmLeave = () => {
    appAlert(
      i18nText("autoI18n.listeden_ayril", "Listeden ayrıl"),
      i18nText(
        "autoI18n.listeden_ayril_onay",
        "Bu ortak listeden ayrılmak istiyor musun?",
      ),
      [
        { text: i18nText("autoI18n.iptal", "İptal"), style: "cancel" },
        {
          text: i18nText("autoI18n.ayril", "Ayrıl"),
          style: "destructive",
          onPress: async () => {
            try {
              await leaveSharedList(listId, uid);
              navigation.goBack();
            } catch (e) {
              Toast.show({ type: "error", text1: e.message });
            }
          },
        },
      ],
    );
  };

  const confirmDeleteList = () => {
    appAlert(
      i18nText("autoI18n.listeyi_sil", "Listeyi Sil"),
      i18nText(
        "autoI18n.ortak_liste_sil_onay",
        '"{{name}}" ortak listesi tüm üyeler için silinecek. Emin misin?',
        { name: list?.name },
      ),
      [
        { text: i18nText("autoI18n.iptal", "İptal"), style: "cancel" },
        {
          text: i18nText("autoI18n.sil", "Sil"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteSharedList(listId);
              Toast.show({
                type: "success",
                text1: i18nText("autoI18n.liste_silindi", "Liste silindi"),
              });
              navigation.goBack();
            } catch (e) {
              Toast.show({ type: "error", text1: e.message });
            }
          },
        },
      ],
    );
  };

  const togglePermission = (member, key) => {
    updateSharedListPermission(listId, member.uid, {
      [key]: !member[key],
    }).catch((e) => Toast.show({ type: "error", text1: e.message }));
  };

  // ── Durumlar ───────────────────────────────────────────────────────────────

  if (list === undefined) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          styles.center,
          { backgroundColor: theme.primary },
        ]}
      >
        <ActivityIndicator size="large" color={ACCENT} />
      </SafeAreaView>
    );
  }

  if (list === null) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          styles.center,
          { backgroundColor: theme.primary },
        ]}
      >
        <Ionicons name="lock-closed-outline" size={40} color={theme.text.muted} />
        <Text style={[styles.emptyText, { color: theme.text.secondary }]}>
          {i18nText(
            "autoI18n.liste_bulunamadi_veya_erisim_yok",
            "Liste bulunamadı veya erişimin kaldırıldı.",
          )}
        </Text>
        <BackButton />
      </SafeAreaView>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const renderPoster = (item) => (
    <TouchableOpacity
      key={item.key}
      activeOpacity={0.85}
      onPress={() => {
        if (suppressPressRef.current) {
          suppressPressRef.current = false;
          return;
        }
        navigation.navigate(
          item.type === "movie" ? "MovieDetails" : "TvShowsDetails",
          { id: item.id },
        );
      }}
      onLongPress={() => {
        suppressPressRef.current = true;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        setActionItem(item);
      }}
      style={[styles.posterItem, { width: posterW }]}
    >
      <View
        style={[
          styles.posterWrap,
          { width: posterW, height: posterH, borderRadius: posterRadius },
        ]}
      >
        <PosterImage
          path={item.imagePath}
          type={item.type}
          size={200}
          style={[styles.poster, { borderRadius: posterRadius }]}
        />
        {listPosterInfo.mediaType ? (
          <Text
            style={[
              styles.typeBadge,
              {
                backgroundColor:
                  item.type === "movie"
                    ? theme.notesColor?.blueBackground ?? "#138df040"
                    : theme.notesColor?.greenBackground ?? "#29b86440",
              },
            ]}
          >
            {item.type === "movie"
              ? i18nText("autoI18n.film", "Film")
              : i18nText("autoI18n.dizi", "Dizi")}
          </Text>
        ) : null}
        {listPosterInfo.duration && (item.totalMinutes || item.minutes) ? (
          <Text style={styles.durationBadge}>
            {(item.totalMinutes || item.minutes) + " " + (t?.minutes || i18nText("autoI18n.dakika", "dk"))}
          </Text>
        ) : null}
        {listPosterInfo.addedBy ? (
          <View style={styles.addedByChip}>
            <Image
              source={getAvatarSource(item.addedByAvatarIndex)}
              style={styles.addedByAvatar}
            />
            <Text numberOfLines={1} style={styles.addedByName}>
              {item.addedBy === uid
                ? i18nText("autoI18n.sen", "Sen")
                : item.addedByName ||
                  i18nText("autoI18n.uye", "Üye")}
            </Text>
          </View>
        ) : null}
      </View>
      {listPosterInfo.title ? (
        <Text
          numberOfLines={1}
          style={[styles.posterTitle, { color: theme.text.secondary }]}
        >
          {item.name}
        </Text>
      ) : null}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.primary }]}>
      {/* Arka plan dekoru (ikon deseni + kar) — içeriğin ARKASINDA */}
      <ScreenDecor iconOpacity={0.3} />
      {/* ── Başlık ── */}
      <View style={styles.header}>
        <BackButton absolute={false} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.headerTopRow}>
            <Ionicons name="people" size={13} color={ACCENT} />
            <Text style={[styles.headerSub, { color: ACCENT }]}>
              {i18nText("autoI18n.ortak_liste", "ORTAK LİSTE")}
            </Text>
          </View>
          <Text
            numberOfLines={1}
            style={[styles.headerTitle, { color: theme.text.primary }]}
          >
            {list.name}
          </Text>
        </View>

        {/* Üyeler butonu — avatar destesi + sayı */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setMembersVisible(true)}
          style={[
            styles.membersBtn,
            { backgroundColor: theme.secondary, borderColor: theme.border },
          ]}
        >
          <View style={styles.avatarStack}>
            {memberRows.slice(0, 3).map((m, i) => (
              <Image
                key={m.uid}
                source={getAvatarSource(m.avatarIndex)}
                style={[
                  styles.stackAvatar,
                  { marginLeft: i === 0 ? 0 : -10, zIndex: 3 - i },
                ]}
              />
            ))}
          </View>
          <Text style={[styles.membersBtnText, { color: theme.text.primary }]}>
            {memberRows.length}
          </Text>
        </TouchableOpacity>
      </View>

      <ListSearchBar
        theme={theme}
        accent={ACCENT}
        listName={SHARED_SEARCH_LIST}
        mode={searchMode}
        onModeChange={setSearchMode}
        query={queryText}
        onQueryChange={setQueryText}
        onOpenFilters={() => setFilterVisible(true)}
        activeFilterCount={activeFilterCount}
        inListCount={filteredItems.length}
        globalCount={globalResults.length}
        globalLoading={globalLoading}
      />

      {/* ── İçerik ── */}
      {searchMode === LIST_SEARCH_MODE.GLOBAL ? (
        <GlobalSearchResults
          theme={theme}
          accent={ACCENT}
          listName={SHARED_SEARCH_LIST}
          query={queryText}
          results={globalResults}
          suggestions={suggestions}
          loading={globalLoading}
          error={globalError}
          existingKeys={existingKeys}
          addingKey={addingKey}
          genreMap={genreMap}
          addDisabled={!canAdd}
          onAdd={addGlobalMedia}
          onOpen={openMediaDetails}
        />
      ) : items.length === 0 ? (
        <View style={[styles.center, { flex: 1 }]}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.secondary }]}>
            <Ionicons name="film-outline" size={30} color={theme.text.muted} />
          </View>
          <Text style={[styles.emptyText, { color: theme.text.secondary }]}>
            {i18nText("autoI18n.bu_liste_bos", "Bu liste boş.")}
          </Text>
          <Text style={[styles.emptyHint, { color: theme.text.muted }]}>
            {i18nText(
              "autoI18n.ortak_liste_bos_ipucu",
              "Film/dizi detayındaki \"Diğerleri\" menüsünden ekleyebilirsiniz",
            )}
          </Text>
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={[styles.center, { flex: 1 }]}>
          <Ionicons name="search-outline" size={34} color={theme.text.muted} />
          <Text style={[styles.emptyText, { color: theme.text.secondary }]}>
            {i18nText("autoI18n.sonuc_bulunamadi", "Sonuç bulunamadı")}
          </Text>
          <TouchableOpacity
            onPress={() => {
              setQueryText("");
              setTypeFilter("all");
              setMemberFilter("all");
              setGenreFilter([]);
              setSortBy("default");
            }}
          >
            <Text style={{ color: ACCENT, fontWeight: "700" }}>
              {i18nText("autoI18n.filtreleri_temizle", "Filtreleri temizle")}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={gridRows}
          keyExtractor={(row, i) => `${row[0]?.key ?? "r"}-${i}`}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: GRID_SIDE_PADDING, paddingBottom: 40 }}
          initialNumToRender={8}
          windowSize={7}
          renderItem={({ item: row }) => (
            <View style={styles.gridRow}>
              {row.map(renderPoster)}
              {row.length < gridColumns
                ? Array.from({ length: gridColumns - row.length }).map((_, i) => (
                    <View key={`sp-${i}`} style={{ width: posterW }} />
                  ))
                : null}
            </View>
          )}
        />
      )}

      <ListItemActionsSheet
        visible={!!actionItem}
        item={actionItem}
        currentIndex={Math.max(actionIndex, 0)}
        itemCount={items.length}
        accent={ACCENT}
        busy={actionBusy}
        canMove={canReorder}
        moveDisabledHint={i18nText(
          "autoI18n.yer_degistirme_yetkin_yok",
          "Bu listede yer değiştirme yetkin yok",
        )}
        canDelete={canRemoveFromSharedList(list, uid, actionItem)}
        deleteDisabledHint={i18nText(
          "autoI18n.silme_yetkin_yok",
          "Bu öğeyi silme yetkin yok",
        )}
        onClose={() => !actionBusy && setActionItem(null)}
        onMove={moveSharedItem}
        onDelete={removeSharedItem}
      />

      <BottomSheetModal
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        sheetStyle={[
          styles.filterSheet,
          { backgroundColor: theme.secondary, borderColor: theme.border },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: theme.border }]} />
        <View style={styles.filterHeader}>
          <View style={[styles.sheetHeaderIcon, { backgroundColor: ACCENT + "20" }]}>
            <Feather name="sliders" size={18} color={ACCENT} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sheetTitle, { color: theme.text.primary }]}>
              {i18nText("autoI18n.sirala_ve_filtrele", "Sırala ve filtrele")}
            </Text>
            <Text style={[styles.sheetSub, { color: theme.text.muted }]}>
              {i18nText("autoI18n.n_sonuc", "{{n}} sonuç", { n: filteredItems.length })}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              setTypeFilter("all");
              setMemberFilter("all");
              setGenreFilter([]);
              setSortBy("default");
            }}
          >
            <Text style={{ color: ACCENT, fontSize: 12, fontWeight: "800" }}>
              {i18nText("autoI18n.temizle", "Temizle")}
            </Text>
          </TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={[styles.filterSection, { color: theme.text.muted }]}>
            {i18nText("autoI18n.siralama", "SIRALAMA")}
          </Text>
          <View style={styles.chipRow}>
            {[
              ["default", i18nText("autoI18n.liste_sirasi", "Liste sırası")],
              ["newest", i18nText("autoI18n.en_yeni", "En yeni")],
              ["name", i18nText("autoI18n.ada_gore", "Ada göre")],
            ].map(([key, label]) => (
              <FilterChip
                key={key}
                label={label}
                selected={sortBy === key}
                onPress={() => setSortBy(key)}
                theme={theme}
              />
            ))}
          </View>
          <Text style={[styles.filterSection, { color: theme.text.muted }]}>
            {i18nText("autoI18n.gorunum", "GÖRÜNÜM")}
          </Text>
          <View style={styles.appearanceRow}>
            {[
              { key: 3, label: i18nText("autoI18n.uclu_dizilim", "3'lü") },
              { key: 4, label: i18nText("autoI18n.dortlu_dizilim", "4'lü") },
            ].map((option) => {
              const selected = gridColumns === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  activeOpacity={0.82}
                  onPress={() => changeGridColumns(option.key)}
                  style={[
                    styles.appearanceButton,
                    {
                      backgroundColor: selected ? ACCENT : theme.primary,
                      borderColor: selected ? ACCENT : theme.border,
                    },
                  ]}
                >
                  <Feather
                    name="grid"
                    size={15}
                    color={selected ? "#001018" : theme.text.secondary}
                  />
                  <Text
                    style={[
                      styles.appearanceText,
                      { color: selected ? "#001018" : theme.text.secondary },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={[styles.appearanceRow, { marginTop: 8 }]}>
            {[
              { key: 2, label: i18nText("autoI18n.kose_koseli", "Köşeli"), preview: 3 },
              { key: 10, label: i18nText("autoI18n.kose_normal", "Normal"), preview: 8 },
              { key: 20, label: i18nText("autoI18n.kose_yuvarlak", "Yuvarlak"), preview: 14 },
            ].map((option) => {
              const selected = posterRadius === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  activeOpacity={0.82}
                  onPress={() => changePosterRadius(option.key)}
                  style={[
                    styles.appearanceButton,
                    {
                      backgroundColor: selected ? ACCENT : theme.primary,
                      borderColor: selected ? ACCENT : theme.border,
                    },
                  ]}
                >
                  <View
                    style={{
                      width: 15,
                      height: 19,
                      borderRadius: option.preview,
                      borderWidth: 1.6,
                      borderColor: selected ? "#001018" : theme.text.secondary,
                    }}
                  />
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.appearanceText,
                      { color: selected ? "#001018" : theme.text.secondary },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={[styles.filterSection, { color: theme.text.muted }]}>
            {i18nText("autoI18n.poster_bilgileri", "POSTER BİLGİLERİ")}
          </Text>
          <ListPosterInfoControls
            theme={theme}
            accent={ACCENT}
            value={listPosterInfo}
            onValueChange={changeListPosterInfo}
            showAddedBy
          />
          <Text style={[styles.filterSection, { color: theme.text.muted }]}>
            {i18nText("autoI18n.tur", "TÜR")}
          </Text>
          <View style={styles.chipRow}>
            {[
              ["all", i18nText("autoI18n.hepsi", "Hepsi")],
              ["movie", i18nText("autoI18n.film", "Film")],
              ["tv", i18nText("autoI18n.dizi", "Dizi")],
            ].map(([key, label]) => (
              <FilterChip
                key={key}
                label={label}
                selected={typeFilter === key}
                onPress={() => setTypeFilter(key)}
                theme={theme}
              />
            ))}
          </View>
          <Text style={[styles.filterSection, { color: theme.text.muted }]}>
            {i18nText("autoI18n.paylasan_uye", "PAYLAŞAN ÜYE")}
          </Text>
          <View style={styles.memberFilterList}>
            <TouchableOpacity
              activeOpacity={0.82}
              onPress={() => setMemberFilter("all")}
              style={[
                styles.memberFilterRow,
                {
                  backgroundColor:
                    memberFilter === "all" ? ACCENT + "18" : theme.primary,
                  borderColor: memberFilter === "all" ? ACCENT : theme.border,
                },
              ]}
            >
              <View style={[styles.memberFilterAllIcon, { backgroundColor: ACCENT + "22" }]}>
                <Ionicons name="people" size={16} color={ACCENT} />
              </View>
              <Text style={[styles.memberFilterName, { color: theme.text.primary, flex: 1 }]}>
                {i18nText("autoI18n.tum_uyeler", "Tüm üyeler")}
              </Text>
              <Text style={[styles.memberFilterTotal, { color: theme.text.muted }]}>
                {items.length}
              </Text>
              {memberFilter === "all" ? (
                <Ionicons name="checkmark-circle" size={20} color={ACCENT} />
              ) : null}
            </TouchableOpacity>
            <View style={styles.memberFilterGrid}>
            {visibleMemberFilters.map((member) => {
              const selected = memberFilter === member.uid;
              const sharedCount = memberContentCounts[member.uid] || 0;
              return (
                <TouchableOpacity
                  key={member.uid}
                  activeOpacity={0.82}
                  onPress={() => setMemberFilter(member.uid)}
                  style={[
                    styles.memberFilterCard,
                    {
                      backgroundColor: selected ? ACCENT + "18" : theme.primary,
                      borderColor: selected ? ACCENT : theme.border,
                    },
                  ]}
                >
                  <Image
                    source={getAvatarSource(member.avatarIndex)}
                    style={styles.memberFilterCardAvatar}
                  />
                  <Text
                    numberOfLines={1}
                    style={[styles.memberFilterCardName, { color: theme.text.primary }]}
                  >
                    {member.uid === uid
                      ? i18nText("autoI18n.sen", "Sen")
                      : member.name || member.username ||
                        i18nText("autoI18n.uye", "Üye")}
                  </Text>
                  <Text style={[styles.memberFilterCardTotal, { color: theme.text.muted }]}>
                    {sharedCount}
                  </Text>
                  {selected ? (
                    <View style={[styles.memberFilterCheck, { backgroundColor: ACCENT }]}>
                      <Ionicons name="checkmark" size={11} color="#001018" />
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
            </View>
            {memberRows.length > 6 ? (
              <TouchableOpacity
                activeOpacity={0.82}
                onPress={() => setMemberFiltersExpanded((current) => !current)}
                style={[styles.memberFilterToggle, { backgroundColor: theme.primary, borderColor: theme.border }]}
              >
                <Ionicons
                  name={memberFiltersExpanded ? "chevron-up" : "chevron-down"}
                  size={15}
                  color={ACCENT}
                />
                <Text style={[styles.memberFilterToggleText, { color: ACCENT }]}>
                  {memberFiltersExpanded
                    ? i18nText("autoI18n.daralt", "Daralt")
                    : i18nText("autoI18n.tum_uyeleri_goster", "Tüm üyeleri göster")}
                </Text>
                {!memberFiltersExpanded ? (
                  <View style={[styles.memberFilterMoreCount, { backgroundColor: ACCENT + "20" }]}>
                    <Text style={[styles.memberFilterMoreCountText, { color: ACCENT }]}>
                      +{memberRows.length - 6}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            ) : null}
          </View>
          {availableGenres.length ? (
            <>
              <Text style={[styles.filterSection, { color: theme.text.muted }]}>
                {i18nText("autoI18n.turler", "TÜRLER")}
              </Text>
              <View style={styles.chipRow}>
                {availableGenres.map((genre) => (
                  <FilterChip
                    key={genre}
                    label={genre}
                    selected={genreFilter.includes(genre)}
                    onPress={() =>
                      setGenreFilter((current) =>
                        current.includes(genre)
                          ? current.filter((value) => value !== genre)
                          : [...current, genre],
                      )
                    }
                    theme={theme}
                  />
                ))}
              </View>
            </>
          ) : null}
        </ScrollView>
        <TouchableOpacity
          onPress={() => setFilterVisible(false)}
          style={[styles.applyButton, { backgroundColor: ACCENT }]}
        >
          <Text style={styles.applyText}>
            {i18nText("autoI18n.n_sonuc_goster", "{{n}} sonuç göster", {
              n: filteredItems.length,
            })}
          </Text>
        </TouchableOpacity>
      </BottomSheetModal>

      {/* ── Üyeler modalı ── */}
      <BottomSheetModal
        visible={membersVisible}
        onClose={() => setMembersVisible(false)}
        sheetStyle={[
          styles.sheet,
          { backgroundColor: theme.secondary, borderColor: theme.border },
        ]}
      >
            <View style={[styles.handle, { backgroundColor: theme.border }]} />

            <View style={styles.sheetHeaderRow}>
              <View style={[styles.sheetHeaderIcon, { backgroundColor: ACCENT + "20" }]}>
                <Ionicons name="people" size={18} color={ACCENT} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetTitle, { color: theme.text.primary }]}>
                  {i18nText("autoI18n.uyeler", "Üyeler")}
                </Text>
                <Text style={[styles.sheetSub, { color: theme.text.muted }]}>
                  {isOwner
                    ? i18nText(
                      "autoI18n.uye_yetki_aciklama",
                        "Ekleme, silme ve yer değiştirme yetkilerini yönetebilirsin",
                      )
                    : i18nText(
                        "autoI18n.uye_listesi",
                        "Bu listeyi paylaşan kişiler",
                      )}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setMembersVisible(false)}
                style={[styles.closeBtn, { backgroundColor: theme.primary }]}
              >
                <Ionicons name="close" size={16} color={theme.text.muted} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={memberRows}
              keyExtractor={(m) => m.uid}
              style={{ maxHeight: 360 }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
              renderItem={({ item: m }) => {
                const memberIsOwner = m.uid === list.ownerId;
                return (
                  <View
                    style={[
                      styles.memberRow,
                      { backgroundColor: theme.primary, borderColor: theme.border },
                    ]}
                  >
                    <Image
                      source={getAvatarSource(m.avatarIndex)}
                      style={styles.memberAvatar}
                    />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text
                          numberOfLines={1}
                          style={[styles.memberName, { color: theme.text.primary }]}
                        >
                          {m.uid === uid
                            ? i18nText("autoI18n.sen", "Sen")
                            : m.name || m.username}
                        </Text>
                        {memberIsOwner && (
                          <View style={[styles.ownerChip, { backgroundColor: "#fbbf2422" }]}>
                            <Ionicons name="key" size={9} color="#fbbf24" />
                            <Text style={styles.ownerChipText}>
                              {i18nText("autoI18n.kurucu", "Kurucu")}
                            </Text>
                          </View>
                        )}
                      </View>
                      {!!m.username && (
                        <Text
                          numberOfLines={1}
                          style={[styles.memberUsername, { color: theme.text.muted }]}
                        >
                          @{m.username}
                        </Text>
                      )}
                      {/* Yetki satırı */}
                      {!memberIsOwner &&
                        (isOwner ? (
                          <View style={styles.permRow}>
                            <View style={styles.permItem}>
                              <Text style={[styles.permLabel, { color: theme.text.muted }]}>
                                {i18nText("autoI18n.ekleme", "Ekleme")}
                              </Text>
                              <SwitchToggle
                                value={!!m.canAdd}
                                onValueChange={() => togglePermission(m, "canAdd")}
                                size={20}
                                onColor={theme.colors?.green ?? "#29b864"}
                                offColor={theme.border || "#555"}
                              />
                            </View>
                            <View style={styles.permItem}>
                              <Text style={[styles.permLabel, { color: theme.text.muted }]}>
                                {i18nText("autoI18n.silme", "Silme")}
                              </Text>
                              <SwitchToggle
                                value={!!m.canRemove}
                                onValueChange={() => togglePermission(m, "canRemove")}
                                size={20}
                                onColor={theme.colors?.red ?? "#e33"}
                                offColor={theme.border || "#555"}
                              />
                            </View>
                            <View style={styles.permItem}>
                              <Text style={[styles.permLabel, { color: theme.text.muted }]}>
                                {i18nText("autoI18n.yer_degistirme", "Taşıma")}
                              </Text>
                              <SwitchToggle
                                value={!!m.canReorder}
                                onValueChange={() => togglePermission(m, "canReorder")}
                                size={20}
                                onColor={ACCENT}
                                offColor={theme.border || "#555"}
                              />
                            </View>
                          </View>
                        ) : (
                          <View style={styles.permRow}>
                            <View
                              style={[
                                styles.permBadge,
                                {
                                  backgroundColor: m.canAdd
                                    ? (theme.colors?.green ?? "#29b864") + "18"
                                    : theme.secondary,
                                },
                              ]}
                            >
                              <Ionicons
                                name={m.canAdd ? "add-circle" : "eye"}
                                size={10}
                                color={
                                  m.canAdd
                                    ? theme.colors?.green ?? "#29b864"
                                    : theme.text.muted
                                }
                              />
                              <Text
                                style={[
                                  styles.permBadgeText,
                                  {
                                    color: m.canAdd
                                      ? theme.colors?.green ?? "#29b864"
                                      : theme.text.muted,
                                  },
                                ]}
                              >
                                {m.canAdd
                                  ? i18nText("autoI18n.ekleyebilir", "Ekleyebilir")
                                  : i18nText("autoI18n.sadece_gorur", "Sadece görür")}
                              </Text>
                            </View>
                            {m.canRemove ? (
                              <View
                                style={[
                                  styles.permBadge,
                                  { backgroundColor: (theme.colors?.red ?? "#e33") + "18" },
                                ]}
                              >
                                <Ionicons name="trash" size={10} color={theme.colors?.red ?? "#e33"} />
                                <Text style={[styles.permBadgeText, { color: theme.colors?.red ?? "#e33" }]}>
                                  {i18nText("autoI18n.silebilir", "Silebilir")}
                                </Text>
                              </View>
                            ) : null}
                            {m.canReorder ? (
                              <View style={[styles.permBadge, { backgroundColor: ACCENT + "18" }]}>
                                <Feather name="move" size={10} color={ACCENT} />
                                <Text style={[styles.permBadgeText, { color: ACCENT }]}>
                                  {i18nText("autoI18n.yer_degistirebilir", "Taşıyabilir")}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        ))}
                    </View>

                    {/* Kurucu: üye çıkar */}
                    {isOwner && !memberIsOwner && (
                      <TouchableOpacity
                        onPress={() => confirmRemoveMember(m)}
                        hitSlop={8}
                        style={[styles.removeMemberBtn, { backgroundColor: "#f8717118" }]}
                      >
                        <Feather name="user-minus" size={15} color="#f87171" />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              }}
            />

            {/* Alt eylemler */}
            <View style={styles.sheetActions}>
              {isOwner ? (
                <>
                  <TouchableOpacity
                    style={[styles.sheetActionBtn, { backgroundColor: "#f8717115", borderColor: "#f8717144" }]}
                    onPress={() => {
                      setMembersVisible(false);
                      confirmDeleteList();
                    }}
                  >
                    <Ionicons name="trash-outline" size={15} color="#f87171" />
                    <Text style={[styles.sheetActionText, { color: "#f87171" }]}>
                      {i18nText("autoI18n.listeyi_sil", "Listeyi Sil")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sheetActionBtn, { backgroundColor: ACCENT }]}
                    onPress={() => {
                      setMembersVisible(false);
                      setAddMemberVisible(true);
                    }}
                  >
                    <Ionicons name="person-add" size={15} color="#000" />
                    <Text style={[styles.sheetActionText, { color: "#000" }]}>
                      {i18nText("autoI18n.uye_ekle", "Üye Ekle")}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[styles.sheetActionBtn, { backgroundColor: "#f8717115", borderColor: "#f8717144" }]}
                  onPress={() => {
                    setMembersVisible(false);
                    confirmLeave();
                  }}
                >
                  <Ionicons name="exit-outline" size={15} color="#f87171" />
                  <Text style={[styles.sheetActionText, { color: "#f87171" }]}>
                    {i18nText("autoI18n.listeden_ayril", "Listeden Ayrıl")}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
      </BottomSheetModal>

      {/* ── Üye ekleme (kurucu) ── */}
      <CreateSharedListModal
        visible={addMemberVisible}
        onClose={() => setAddMemberVisible(false)}
        addToList={{ id: listId, memberIds: list.memberIds || [] }}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: "center", alignItems: "center", gap: 10 },

  // ── Header ──
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 16,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 3,
  },
  headerSub: { fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  headerTitle: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  membersBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 2,
  },
  avatarStack: { flexDirection: "row", alignItems: "center" },
  stackAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "rgba(0,0,0,0.4)",
  },
  membersBtnText: { fontSize: 13, fontWeight: "800" },

  // ── Grid ──
  gridRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    gap: GRID_COLUMN_GAP,
    marginBottom: 14,
  },
  posterItem: {},
  posterWrap: {
    overflow: "hidden",
  },
  poster: { width: "100%", height: "100%" },
  typeBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: "hidden",
  },
  durationBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    color: "#fff",
    backgroundColor: "rgba(0,0,0,0.68)",
    fontSize: 9,
    fontWeight: "700",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: "hidden",
  },
  addedByChip: {
    position: "absolute",
    left: 5,
    right: 5,
    bottom: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.62)",
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 5,
  },
  addedByAvatar: { width: 16, height: 16, borderRadius: 8 },
  addedByName: {
    flex: 1,
    color: "#fff",
    fontSize: 9.5,
    fontWeight: "700",
  },
  posterTitle: { fontSize: 11, fontWeight: "600", marginTop: 5 },

  // ── Boş durum ──
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: { fontSize: 14, fontWeight: "600", textAlign: "center" },
  emptyHint: {
    fontSize: 12,
    textAlign: "center",
    paddingHorizontal: 40,
  },

  // ── Üyeler modalı ──
  overlay: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 30,
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 3,
    marginBottom: 14,
  },
  sheetHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  sheetHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  sheetTitle: { fontSize: 17, fontWeight: "800" },
  sheetSub: { fontSize: 11, marginTop: 2 },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
  },
  memberAvatar: { width: 38, height: 38, borderRadius: 19 },
  memberName: { fontSize: 13, fontWeight: "700", flexShrink: 1 },
  memberUsername: { fontSize: 11, marginTop: 1 },
  ownerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  ownerChipText: { color: "#fbbf24", fontSize: 9, fontWeight: "800" },
  permRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 6,
  },
  permItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  permLabel: { fontSize: 11, fontWeight: "600" },
  permBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  permBadgeText: { fontSize: 10, fontWeight: "700" },
  removeMemberBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  sheetActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  sheetActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  sheetActionText: { fontSize: 13, fontWeight: "800" },
  filterSheet: {
    maxHeight: "78%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 24,
  },
  filterHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  filterSection: { fontSize: 10.5, fontWeight: "800", letterSpacing: 1, marginTop: 16, marginBottom: 9 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  appearanceRow: { flexDirection: "row", gap: 8 },
  appearanceButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  appearanceText: { flexShrink: 1, fontSize: 11.5, fontWeight: "800" },
  filterChip: { minHeight: 36, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  filterChipText: { fontSize: 12.5, fontWeight: "700" },
  memberFilterList: { gap: 8 },
  memberFilterGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  memberFilterRow: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  memberFilterAllIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  memberFilterAvatar: { width: 32, height: 32, borderRadius: 16 },
  memberFilterName: { flexShrink: 1, fontSize: 12.5, fontWeight: "800" },
  memberFilterUsername: { fontSize: 10.5, marginTop: 1 },
  memberFilterTotal: { minWidth: 22, textAlign: "center", fontSize: 11, fontWeight: "800" },
  memberFilterCard: {
    width: "31.8%",
    minHeight: 76,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 6,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  memberFilterCardAvatar: { width: 30, height: 30, borderRadius: 15, marginBottom: 4 },
  memberFilterCardName: { width: "100%", textAlign: "center", fontSize: 10.5, fontWeight: "800" },
  memberFilterCardTotal: { fontSize: 9.5, fontWeight: "700", marginTop: 2 },
  memberFilterCheck: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 17,
    height: 17,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  memberFilterToggle: {
    minHeight: 38,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  memberFilterToggleText: { fontSize: 11.5, fontWeight: "800" },
  memberFilterMoreCount: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  memberFilterMoreCountText: { fontSize: 9.5, fontWeight: "900" },
  applyButton: { height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 18 },
  applyText: { color: "#001018", fontSize: 14, fontWeight: "900" },
});
