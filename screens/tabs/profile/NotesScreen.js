import { isLightSurface } from "@utils/colorUtils";
/**
 * NotesScreen — Notların tam ekran yönetimi.
 *
 * Başlık (arama + liste/ızgara anahtarı) · sekmeler (Notlar / Yapılacaklar /
 * Film-Dizi) · yapılacaklarda durum süzgeci · kart listesi veya iki sütunlu
 * ızgara · genişletilmiş FAB · ekle/düzenle alt sayfası (notes/NoteEditorSheet)
 * · silme onayı. Sekme çubuğu, süzgeç ve arama kabuğunun hareketi
 * notes/NotesChrome.js'te; arama alanı iOS 26+'da Liquid Glass (GlassField).
 * Veri katmanı `useProfileNotes()` (Firestore) context'idir; kalıcılık `saveNote` (upsert), `handleDeleteNote`, `handleTogglePin` ve
 * `handleToggleTodoItem` ile yapılır. Sıralama/arama/ilerleme mantığı SAF
 * utils/notesView.js'te.
 */
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Keyboard,
  Modal,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, { FadeInDown, FadeInLeft, FadeInRight, FadeOutDown } from "react-native-reanimated";
import MediaNoteSheet from "@components/detail/MediaNoteSheet";
import GlassField from "@components/common/GlassField";
import GlassIconButton from "@components/common/GlassIconButton";
import { useGlassScheme } from "@components/common/GlassSurface";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../../context/ThemeContext";
import { useLanguage } from "../../../context/LanguageContext";
import { useProfileNotes } from "../../../context/ProfileNotesContext";
import { useMediaNotes } from "../../../context/MediaNotesContext";
import { useImageQualitySettings } from "../../../context/AppSettingsContext";
import { useDeviceNotifications } from "../../../context/DeviceNotificationsContext";
import ScreenDecor from "../../../components/ScreenDecor";
import { toast } from "@components/AppToast";
import { i18nText } from "../../../utils/i18nText";
import { PRIME_HANDOFF_MS } from "../../../utils/notificationPriming";
import { removeNoteTodoDraft, todoDraftKey } from "../../../services/noteTodoDraftService";
import { Keys, get, set } from "../../../services/storage";
import {
  buildNoteColorPairs,
  filterTodoNotes,
  matchesQuery,
  sortNotes,
  tabDirection,
} from "../../../utils/notesView";
import { alpha } from "../../../theme/colors";
import NoteEditorSheet from "./notes/NoteEditorSheet";
import { MediaNoteCard, NoteCard, NotesEmptyState, NotesSkeleton } from "./notes/NoteCards";
import { NotesFilterRow, NotesTabBar, RevealBox } from "./notes/NotesChrome";
import NotesMasonry from "./notes/NotesMasonry";
import BackButton from "@components/BackButton";
import useReduceMotion from "../../../hooks/useReduceMotion";
import { useLiquidGlass } from "../../../services/liquidGlass";

import ModalToastHost from "@components/toast/ModalToastHost";
const GRID_PAD = 16;
const GRID_GAP = 10;
// Izgarada kartlar arası dikey boşluk; liste kipindeki `styles.list.gap` ile aynı.
const GRID_ROW_GAP = 12;
const SEARCH_H = 46;
const SEARCH_GAP = 10;
const TAB_ORDER = ["note", "todo", "media"];

// ─── Silme Onay Modalı ────────────────────────────────────────────────────────
const DeleteModal = ({ visible, onConfirm, onClose, theme }) => (
  <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
    <View style={styles.deleteOverlay}>
      <View style={[styles.deleteContent, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
        <View style={styles.deleteIconWrap}>
          <Ionicons name="trash" size={30} color="#ef4444" />
        </View>
        <Text allowFontScaling={false} style={[styles.deleteTitle, { color: theme.text.primary }]}>
          {i18nText("autoI18n.notu_sil", "Notu Sil")}
        </Text>
        <Text allowFontScaling={false} style={[styles.deleteMsg, { color: theme.text.secondary }]}>
          {i18nText("autoI18n.notu_sil_onay", "Bu notu silmek istediğine emin misin? Bu işlem geri alınamaz.")}
        </Text>
        <View style={styles.deleteBtns}>
          <TouchableOpacity
            style={[styles.deleteBtn, { backgroundColor: theme.primary, borderColor: theme.border }]}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text allowFontScaling={false} style={[styles.deleteBtnText, { color: theme.text.primary }]}>
              {i18nText("autoI18n.iptal", "İptal")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.deleteBtn, { backgroundColor: "#ef4444", borderColor: "#ef4444" }]}
            onPress={onConfirm}
            activeOpacity={0.85}
          >
            <Text allowFontScaling={false} style={[styles.deleteBtnText, { color: "#fff" }]}>
              {i18nText("autoI18n.sil", "Sil")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
    <ModalToastHost visible={visible} />
  </Modal>
);

// ─── Ana Ekran ────────────────────────────────────────────────────────────────
export default function NotesScreen({ navigation }) {
  const { theme } = useTheme();
  const { t, language } = useLanguage();
  const {
    notes,
    loadingNotes,
    saveNote,
    handleDeleteNote,
    handleTogglePin,
    handleToggleTodoItem,
    canCreateNote,
    checkCanCreateNote,
  } = useProfileNotes();
  const { mediaNotes, loadingMediaNotes, deleteMediaNote } = useMediaNotes();
  const { getTmdbUrl } = useImageQualitySettings();
  const { primeNotificationPermission } = useDeviceNotifications();
  const { width: windowWidth } = useWindowDimensions();

  const colorPairs = useMemo(() => buildNoteColorPairs(theme.notesColor), [theme.notesColor]);
  const title = t.profileScreen?.Notes?.notes ?? i18nText("autoI18n.notlar", "Notlar");

  const glass = useLiquidGlass();
  const glassScheme = useGlassScheme();
  const reduceMotion = useReduceMotion();

  const [tab, setTab] = useState("note");
  // Sekme geçiş yönü (+1 sağa, -1 sola) ve "kullanıcı geçiş yaptı mı": ekran ilk
  // açılırken liste kayarak GELMESİN, yalnız sekme değişince.
  const tabDirRef = useRef(1);
  const tabChangedRef = useRef(false);
  const [layout, setLayout] = useState(() => (get(Keys.notesViewMode) === "grid" ? "grid" : "list"));
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [query, setQuery] = useState("");
  const [todoFilter, setTodoFilter] = useState("all");
  const [modalVisible, setModalVisible] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [mediaSheetVisible, setMediaSheetVisible] = useState(false);
  const [editingMediaNote, setEditingMediaNote] = useState(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [deleteTargetKind, setDeleteTargetKind] = useState("note");

  const allNotes = notes || [];
  const allMediaNotes = mediaNotes || [];

  // Sabitlenenler önde, her grup en yeni oluşturulandan eskiye (utils/notesView.js).
  const noteItems = useMemo(() => sortNotes(allNotes.filter((n) => n.type !== "todo")), [allNotes]);
  const todoItems = useMemo(() => sortNotes(allNotes.filter((n) => n.type === "todo")), [allNotes]);

  const todoCounts = useMemo(
    () => ({
      all: todoItems.length,
      active: filterTodoNotes(todoItems, "active").length,
      done: filterTodoNotes(todoItems, "done").length,
    }),
    [todoItems],
  );

  const tabCounts = { note: noteItems.length, todo: todoItems.length, media: allMediaNotes.length };
  const totalCount = tabCounts.note + tabCounts.todo + tabCounts.media;

  const isGrid = tab !== "media" && layout === "grid";
  const gridWidth = (windowWidth - GRID_PAD * 2 - GRID_GAP) / 2;
  const searching = searchOpen && query.trim().length > 0;

  // Sekmeye göre FlatList'e giden veri: "media" tam ayrı bir koleksiyondan
  // (MediaNotesContext) geliyor, düz not/todo şemasıyla karışmıyor.
  const listData = useMemo(() => {
    const base =
      tab === "media"
        ? allMediaNotes
        : tab === "todo"
          ? filterTodoNotes(todoItems, todoFilter)
          : noteItems;
    return searching ? base.filter((n) => matchesQuery(n, query)) : base;
  }, [tab, allMediaNotes, todoItems, noteItems, todoFilter, searching, query]);
  const isListLoading = tab === "media" ? loadingMediaNotes : loadingNotes;

  const toggleLayout = () => {
    const next = layout === "grid" ? "list" : "grid";
    setLayout(next);
    set(Keys.notesViewMode, next);
  };
  const toggleSearch = () => {
    if (searchOpen) {
      setQuery("");
      setSearchFocused(false);
      Keyboard.dismiss();
    }
    setSearchOpen((v) => !v);
  };
  const changeTab = useCallback(
    (next) => {
      tabDirRef.current = tabDirection(TAB_ORDER, tab, next);
      tabChangedRef.current = true;
      setTab(next);
    },
    [tab],
  );

  const handleSave = useCallback(
    async (note) => {
      const saved = await saveNote(note);
      if (saved === false) return false;
      setModalVisible(false);
      // `editingNote` burada temizlenMEZ: BottomSheetModal kapanış animasyonu
      // boyunca (~260ms) sayfayı çizmeye devam ediyor; initialNote null'a
      // düşerse tip seçici (Not/Yapılacak) o sırada yeniden belirip kayboluyor.
      // openNew/openEdit zaten bir sonraki açılışta doğru değeri set ediyor.
      // Tarihli not = hatırlatma; OS izni yoksa bildirim ASLA düşmez. İzin
      // sayfası da bir alt sayfa, düzenleme sayfasının kapanışını bekliyor —
      // iki alt sayfa üst üste binmesin.
      if (note?.scheduledDate) {
        setTimeout(primeNotificationPermission, PRIME_HANDOFF_MS);
      }
      return true;
    },
    [saveNote, primeNotificationPermission],
  );

  const requestDelete = useCallback((id, kind = "note") => {
    setDeleteTargetId(id);
    setDeleteTargetKind(kind);
    setDeleteModalVisible(true);
  }, []);
  const confirmDelete = () => {
    if (deleteTargetId) {
      if (deleteTargetKind === "media") {
        const target = allMediaNotes.find((n) => n.id === deleteTargetId);
        if (target) deleteMediaNote(target.type, target.mediaId);
      } else {
        handleDeleteNote(deleteTargetId);
        removeNoteTodoDraft(todoDraftKey(deleteTargetId));
      }
    }
    setDeleteModalVisible(false);
    setDeleteTargetId(null);
  };

  const openMediaEdit = useCallback((note) => {
    setEditingMediaNote(note);
    setMediaSheetVisible(true);
  }, []);
  const goToMedia = useCallback(
    (note) => {
      navigation.navigate(note.type === "tv" ? "TvShowsDetails" : "MovieDetails", {
        id: note.mediaId,
      });
    },
    [navigation],
  );

  /* Panoya kopyala: not = başlık + içerik, todo = başlık + ☐/☑ maddeler */
  const copyNote = useCallback(async (note) => {
    const text =
      note.type === "todo"
        ? [
            note.title,
            ...(note.todos || []).map(
              (item) => `${item.done ? "☑" : "☐"} ${item.text}`,
            ),
          ]
            .filter(Boolean)
            .join("\n")
        : [note.title, note.content].filter(Boolean).join("\n\n");
    if (!text.trim()) return;
    await Clipboard.setStringAsync(text);
    toast.success(i18nText("autoI18n.panoya_kopyalandi", "Panoya kopyalandı"));
  }, []);

  const openNew = () => {
    // Ücretsiz planda 5 not / 5 yapılacak: açık sekmenin tipi doluysa editör
    // hiç açılmaz, doğrudan yükseltme sayfası gelir (yazılan emek boşa gitmesin).
    if (!checkCanCreateNote(tab === "todo" ? "todo" : "note")) return;
    setEditingNote(null);
    setModalVisible(true);
  };

  // Editörde diğer tip (ör. Yapılacak) dolu ve ona basıldı: editörü kapat,
  // pencere gerçekten kalkınca yükseltme sayfasını aç (iOS iki Modal sunamaz).
  const pendingFullTypeRef = useRef(null);
  const fullTypes = ["note", "todo"].filter((tp) => !canCreateNote(tp));
  const handleFullTypePress = useCallback((type) => {
    pendingFullTypeRef.current = type;
    setModalVisible(false);
  }, []);
  const handleEditorDismissed = useCallback(() => {
    const type = pendingFullTypeRef.current;
    pendingFullTypeRef.current = null;
    if (type) checkCanCreateNote(type);
  }, [checkCanCreateNote]);
  const openEdit = useCallback((note) => {
    setEditingNote(note);
    setModalVisible(true);
  }, []);
  const requestNoteDelete = useCallback((note) => requestDelete(note.id, "note"), [requestDelete]);
  const requestMediaDelete = useCallback((note) => requestDelete(note.id, "media"), [requestDelete]);

  const renderItem = useCallback(
    ({ item }) =>
      tab === "media" ? (
        <MediaNoteCard
          note={item}
          theme={theme}
          language={language}
          getTmdbUrl={getTmdbUrl}
          onPress={openMediaEdit}
          onGoTo={goToMedia}
          onDelete={requestMediaDelete}
        />
      ) : (
        <NoteCard
          note={item}
          theme={theme}
          language={language}
          layout={isGrid ? "grid" : "list"}
          width={gridWidth}
          onPress={openEdit}
          onCopy={copyNote}
          onDelete={requestNoteDelete}
          onTogglePin={(note) => handleTogglePin(note.id)}
          onToggleTodo={handleToggleTodoItem}
        />
      ),
    [
      tab,
      theme,
      language,
      getTmdbUrl,
      isGrid,
      gridWidth,
      openMediaEdit,
      goToMedia,
      requestMediaDelete,
      openEdit,
      copyNote,
      requestNoteDelete,
      handleTogglePin,
      handleToggleTodoItem,
    ],
  );

  const tabs = [
    { key: "note", label: i18nText("autoI18n.notlar", "Notlar"), icon: "document-text" },
    { key: "todo", label: i18nText("autoI18n.yapilacaklar", "Yapılacaklar"), icon: "checkbox" },
    { key: "media", label: i18nText("autoI18n.film_dizi", "Film/Dizi"), icon: "film" },
  ];
  const todoFilters = [
    { key: "all", label: i18nText("autoI18n.tumu", "Tümü") },
    { key: "active", label: i18nText("autoI18n.notes_filtre_devam", "Devam eden") },
    { key: "done", label: i18nText("autoI18n.notes_filtre_biten", "Biten") },
  ];

  // Liste boşken ya da yüklenirken gösterilen düğüm (liste ve ızgara ortak).
  const emptyNode = isListLoading ? (
    <NotesSkeleton theme={theme} layout={isGrid ? "grid" : "list"} width={gridWidth} />
  ) : (
    <NotesEmptyState
      tab={tab}
      theme={theme}
      searching={searching}
      onCreate={tab === "media" ? undefined : openNew}
    />
  );

  const accent = theme.accent;
  const fabLabel =
    tab === "todo"
      ? i18nText("autoI18n.notes_yeni_liste", "Yeni liste")
      : i18nText("autoI18n.notes_yeni_not", "Yeni not");

  return (
    <View style={[styles.root, { backgroundColor: theme.primary }]}>
      <StatusBar barStyle={isLightSurface(theme.primary) ? "dark-content" : "light-content"} />
      <ScreenDecor scope="profile" iconOpacity={0.25} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <BackButton absolute={false} onPress={() => navigation.goBack()} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              allowFontScaling={false}
              style={[styles.headerTitle, { color: theme.text.primary }]}
              numberOfLines={1}
            >
              {title}
            </Text>
            <Text allowFontScaling={false} style={[styles.headerSub, { color: theme.text.muted }]} numberOfLines={1}>
              {i18nText("autoI18n.notes_toplam", "{{n}} kayıt", { n: totalCount })}
            </Text>
          </View>
          {/* Geri düğmesiyle aynı yapı taşı: iOS 26+'da cam, diğer yerlerde aynı köşeli
              kutu (eskiden geri düğmesi köşeli, bunlar daire kalıyordu). */}
          <GlassIconButton
            size={40}
            icon={searchOpen ? "close" : "search"}
            iconSize={19}
            color={searchOpen ? accent : undefined}
            tint={searchOpen ? alpha(accent, 0.28) : undefined}
            fallbackStyle={{
              backgroundColor: searchOpen ? alpha(accent, 0.16) : theme.secondary,
              borderColor: searchOpen ? alpha(accent, 0.5) : theme.border,
              borderWidth: 1,
            }}
            onPress={toggleSearch}
            accessibilityLabel={i18nText("autoI18n.notes_ara", "Notlarda ara…")}
            accessibilityState={{ selected: searchOpen }}
          />
          {/* Film/Dizi sekmesinde kaybolmaz, pasifleşir: düğme yok olunca başlık
              genişleyip yer değiştiriyordu. */}
          <GlassIconButton
            size={40}
            icon={layout === "grid" ? "list" : "grid"}
            iconSize={18}
            color={tab === "media" ? theme.text.muted : undefined}
            disabled={tab === "media"}
            onPress={toggleLayout}
            accessibilityLabel={
              layout === "grid"
                ? i18nText("autoI18n.notes_gorunum_liste", "Liste görünümü")
                : i18nText("autoI18n.notes_gorunum_izgara", "Izgara görünümü")
            }
          />
        </View>

        {/* Arama: iOS 26+'da hap biçimli Liquid Glass (odakta vurgu tonlu), diğer
            yerlerde eski kutu. Açılış/kapanış alttaki listeyi zıplatmaz; cam
            çizilirken saydamlık oynatılmaz (GlassSurface kuralı 1). */}
        <RevealBox open={searchOpen} height={SEARCH_H + SEARCH_GAP} fade={!glass}>
          <GlassField
            height={SEARCH_H}
            focused={searchFocused}
            accent={accent}
            fallbackStyle={[
              styles.searchBox,
              {
                backgroundColor: theme.secondary,
                borderColor: alpha(accent, searchFocused ? 0.7 : 0.45),
              },
            ]}
            style={styles.searchField}
          >
            <Ionicons name="search" size={17} color={searchFocused ? accent : theme.text.muted} />
            <TextInput
              allowFontScaling={false}
              style={[styles.searchInput, { color: theme.text.primary }]}
              placeholder={i18nText("autoI18n.notes_ara", "Notlarda ara…")}
              placeholderTextColor={theme.text.muted}
              value={query}
              onChangeText={setQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              autoFocus
              returnKeyType="search"
              autoCorrect={false}
              keyboardAppearance={glassScheme}
              selectionColor={accent}
            />
            {query.length > 0 && (
              <TouchableOpacity
                onPress={() => setQuery("")}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
              >
                <Ionicons name="close-circle" size={18} color={theme.text.muted} />
              </TouchableOpacity>
            )}
          </GlassField>
        </RevealBox>

        {/* Sekmeler: kayan seçim hapı, simge üstte etiket altta, sayı rozeti
            simgenin köşesinde (akışta yer tutmaz → hiçbir şey kaymaz). */}
        <NotesTabBar
          tabs={tabs}
          value={tab}
          counts={tabCounts}
          onChange={changeTab}
          theme={theme}
          accent={accent}
        />

        {/* Yapılacaklar: durum süzgeci — kayarak açılır/kapanır, liste zıplamaz. */}
        <NotesFilterRow
          visible={tab === "todo" && todoCounts.all > 0}
          filters={todoFilters}
          value={todoFilter}
          counts={todoCounts}
          onChange={setTodoFilter}
          theme={theme}
          accent={accent}
        />

        {/* Liste: sekme değişince yeni içerik geçiş yönünden kayarak gelir
            (`key={tab}` → her sekme kendi kaydırma konumuyla temiz başlar). */}
        <Animated.View
          key={tab}
          style={styles.listWrap}
          entering={
            reduceMotion || !tabChangedRef.current
              ? undefined
              : (tabDirRef.current > 0 ? FadeInRight : FadeInLeft).duration(260)
          }
        >
          {isGrid ? (
            // İki sütun, boşluksuz (masonry): kısa kartın altına sıradaki kart girer.
            <NotesMasonry
              data={listData}
              columnWidth={gridWidth}
              columnGap={GRID_GAP}
              rowGap={GRID_ROW_GAP}
              contentContainerStyle={styles.list}
              renderItem={renderItem}
              empty={emptyNode}
            />
          ) : (
            <FlatList
              data={listData}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              ListEmptyComponent={emptyNode}
              renderItem={renderItem}
            />
          )}
        </Animated.View>

        {/* FAB — "media" sekmesinde yok: bu notlar buradan değil, ilgili film/dizi
            detay sayfasındaki "Notum" kartından oluşturulur. Sekme/arama ile
            belirir ve kaybolur (eskiden aniden beliriyordu). */}
        {tab !== "media" && !searchOpen && (
          <Animated.View
            style={styles.fabWrap}
            entering={reduceMotion ? undefined : FadeInDown.duration(220)}
            exiting={reduceMotion ? undefined : FadeOutDown.duration(160)}
          >
            <TouchableOpacity onPress={openNew} activeOpacity={0.9} accessibilityRole="button">
              <LinearGradient
                colors={[accent, alpha(accent, 0.78)]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.fab, { shadowColor: accent }]}
              >
                <Ionicons name="add" size={24} color="#fff" />
                <Text allowFontScaling={false} style={styles.fabText}>
                  {fabLabel}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}
      </SafeAreaView>

      <NoteEditorSheet
        visible={modalVisible}
        initialNote={editingNote}
        defaultType={tab === "media" ? "note" : tab}
        theme={theme}
        colorPairs={colorPairs}
        language={language}
        onSave={handleSave}
        fullTypes={fullTypes}
        onFullTypePress={handleFullTypePress}
        onDismissed={handleEditorDismissed}
        onClose={() => {
          setModalVisible(false);
          // Kapanış animasyonu boyunca initialNote'un dolu kalması gerekiyor,
          // bkz. handleSave içindeki açıklama.
        }}
      />

      <MediaNoteSheet
        visible={mediaSheetVisible}
        onClose={() => {
          setMediaSheetVisible(false);
          setEditingMediaNote(null);
        }}
        type={editingMediaNote?.type}
        mediaId={editingMediaNote?.mediaId}
        title={editingMediaNote?.title}
        posterPath={editingMediaNote?.posterPath}
      />

      <DeleteModal
        visible={deleteModalVisible}
        onConfirm={confirmDelete}
        onClose={() => {
          setDeleteModalVisible(false);
          setDeleteTargetId(null);
        }}
        theme={theme}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 12,
    gap: 10,
  },
  headerTitle: { fontSize: 24, fontWeight: "800", letterSpacing: -0.4 },
  headerSub: { fontSize: 12.5, fontWeight: "600", marginTop: 1 },

  // Arama (iOS 26+: GlassField hap camı; `searchBox` yalnız cam yokken)
  searchField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginBottom: SEARCH_GAP,
    paddingHorizontal: 14,
  },
  searchBox: { borderRadius: 16, borderWidth: 1 },
  searchInput: { flex: 1, height: "100%", fontSize: 15, padding: 0 },

  // List
  listWrap: { flex: 1 },
  list: { paddingHorizontal: GRID_PAD, paddingBottom: 120, gap: 12, flexGrow: 1 },

  // FAB (genişletilmiş)
  fabWrap: { position: "absolute", bottom: 28, right: 20 },
  fab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 56,
    paddingLeft: 16,
    paddingRight: 22,
    borderRadius: 28,
    elevation: 7,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  fabText: { color: "#fff", fontSize: 15, fontWeight: "800" },

  // Delete Modal
  deleteOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  deleteContent: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    alignItems: "center",
    elevation: 5,
  },
  deleteIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(239,68,68,0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  deleteTitle: { fontSize: 20, fontWeight: "800", marginBottom: 8 },
  deleteMsg: { fontSize: 14, textAlign: "center", lineHeight: 21, marginBottom: 22 },
  deleteBtns: { flexDirection: "row", width: "100%", gap: 10 },
  deleteBtn: { flex: 1, height: 48, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  deleteBtnText: { fontWeight: "800", fontSize: 15 },
});
