import { isLightSurface } from "@utils/colorUtils";
/**
 * NotesScreen — Notların tam ekran yönetimi (IslamicGuide NotesScreen düzeni).
 *
 * Dikey tam-genişlik kart listesi + sekme çubuğu (Notlar / Yapılacaklar) +
 * FAB + alt-sheet ekle/düzenle modalı + silme onay modalı. Veri katmanı
 * Seelogd'in mevcut `useProfileNotes()` (Firestore) context'idir; kalıcılık
 * tek noktadan `saveNote` (upsert) ve `handleDeleteNote` ile yapılır.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Image,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import BottomSheetModal from "@components/common/BottomSheetModal";
import MediaNoteSheet from "@components/detail/MediaNoteSheet";
import * as Clipboard from "expo-clipboard";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../../context/ThemeContext";
import { useLanguage } from "../../../context/LanguageContext";
import { useProfileNotes } from "../../../context/ProfileNotesContext";
import { useMediaNotes } from "../../../context/MediaNotesContext";
import { useImageQualitySettings } from "../../../context/AppSettingsContext";
import { useDeviceNotifications } from "../../../context/DeviceNotificationsContext";
import ScreenDecor from "../../../components/ScreenDecor";
import DatePickerModal from "@components/modals/DatePickerModal";
import { toast } from "@components/AppToast";
import { i18nText } from "../../../utils/i18nText";
import { PRIME_HANDOFF_MS } from "../../../utils/notificationPriming";
import {
  getNoteTodoDraft,
  removeNoteTodoDraft,
  saveNoteTodoDraft,
  todoDraftKey,
} from "../../../services/noteTodoDraftService";
import {
  getTodoMoveAvailability,
  moveTodoItem,
} from "../../../utils/todoOrder";

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

// Küçük ikon butonları için ortak dokunma alanı payı.
const ICON_HIT_SLOP = { top: 8, bottom: 8, left: 6, right: 6 };
const NOTE_CONTENT_LIMIT = 5000;
const TODO_ITEM_LIMIT = 240;
const NOTE_TITLE_LIMIT = 120;

const RemainingCounter = ({ value, limit, theme, inside = false }) => {
  const remaining = Math.max(0, limit - String(value || "").length);
  const nearLimit = remaining <= Math.ceil(limit * 0.1);
  return (
    <Text
      allowFontScaling={false}
      numberOfLines={1}
      pointerEvents="none"
      style={[
        inside
          ? inside === "edit"
            ? styles.todoEditCounter
            : inside === "note"
              ? styles.noteInputCounter
              : styles.todoInputCounter
          : styles.remainingCounter,
        { color: nearLimit ? theme.colors?.orange || theme.accent : theme.text.muted },
      ]}
    >
      {remaining}
    </Text>
  );
};

// Tema'nın notesColor paletinden { color, background } çiftleri üret.
const buildColorPairs = (notesColor) => [
  { color: notesColor.blue, background: notesColor.blueBackground },
  { color: notesColor.green, background: notesColor.greenBackground },
  { color: notesColor.red, background: notesColor.redBackground },
  { color: notesColor.orange, background: notesColor.orangeBackground },
  { color: notesColor.yellow, background: notesColor.yellowBackground },
  { color: notesColor.purple, background: notesColor.purpleBackground },
  { color: notesColor.pink, background: notesColor.pinkBackground },
  { color: notesColor.aqua, background: notesColor.aquaBackground },
  { color: notesColor.teal, background: notesColor.tealBackground },
];

// ─── Silme Onay Modalı ────────────────────────────────────────────────────────
const DeleteModal = ({ visible, onConfirm, onClose, theme }) => (
  <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
    <View style={styles.deleteOverlay}>
      <View style={[styles.deleteContent, { backgroundColor: theme.secondary }]}>
        <View style={[styles.deleteIconWrap, { backgroundColor: theme.primary }]}>
          <Ionicons name="trash" size={32} color="#ef4444" />
        </View>
        <Text allowFontScaling={false} style={[styles.deleteTitle, { color: theme.text.primary }]}>
          {i18nText("autoI18n.notu_sil", "Notu Sil")}
        </Text>
        <Text allowFontScaling={false} style={[styles.deleteMsg, { color: theme.text.secondary }]}>
          {i18nText("autoI18n.notu_sil_onay", "Bu notu silmek istediğine emin misin? Bu işlem geri alınamaz.")}
        </Text>
        <View style={styles.deleteBtns}>
          <TouchableOpacity
            style={[styles.deleteCancelBtn, { backgroundColor: theme.between }]}
            onPress={onClose}
          >
            <Text allowFontScaling={false} style={[styles.deleteCancelText, { color: theme.text.primary }]}>
              {i18nText("autoI18n.iptal", "İptal")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.deleteConfirmBtn, { backgroundColor: "#ef4444" }]}
            onPress={onConfirm}
          >
            <Text allowFontScaling={false} style={styles.deleteConfirmText}>
              {i18nText("autoI18n.sil", "Sil")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

// ─── Boş Durum ────────────────────────────────────────────────────────────────
const EMPTY_STATE_META = {
  note: {
    icon: "document-text-outline",
    title: () => i18nText("autoI18n.henuz_not_yok", "Henüz not yok"),
    hint: () => i18nText("autoI18n.yeni_not_ekle_ipucu", "Sağ alttaki + butonuyla yeni bir not ekle"),
  },
  todo: {
    icon: "checkbox-outline",
    title: () => i18nText("autoI18n.henuz_yapilacak_yok", "Henüz yapılacak yok"),
    hint: () => i18nText("autoI18n.yeni_yapilacak_ekle_ipucu", "Sağ alttaki + butonuyla yeni bir yapılacak listesi ekle"),
  },
  media: {
    icon: "film-outline",
    title: () => i18nText("autoI18n.henuz_film_dizi_notu_yok", "Henüz film/dizi notu yok"),
    hint: () => i18nText(
      "autoI18n.film_dizi_notu_ipucu",
      "Bir film veya dizinin detay sayfasındaki \"Notum\" kartından not ekleyebilirsin",
    ),
  },
};

const EmptyState = ({ tab, theme }) => {
  const meta = EMPTY_STATE_META[tab] || EMPTY_STATE_META.note;
  return (
    <View style={{ alignItems: "center", marginTop: 80, gap: 12 }}>
      <Ionicons name={meta.icon} size={56} color={theme.text.muted} />
      <Text allowFontScaling={false} style={{ color: theme.text.secondary, fontSize: 16, fontWeight: "600" }}>
        {meta.title()}
      </Text>
      <Text
        allowFontScaling={false}
        style={{ color: theme.text.muted, fontSize: 13, textAlign: "center", paddingHorizontal: 40 }}
      >
        {meta.hint()}
      </Text>
    </View>
  );
};

// ─── Not Kartı ────────────────────────────────────────────────────────────────
const NoteCard = ({ note, theme, language, onPress, onCopy, onDelete }) => {
  const todos = note.todos || [];
  const activeTodos = todos.filter((t) => !t.done);
  const doneTodos = todos.filter((t) => t.done);
  const progress = todos.length ? doneTodos.length / todos.length : 0;
  const isTodo = note.type === "todo";

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.secondary, borderColor: note.color + "44" }]}
      onPress={onPress}
      activeOpacity={0.78}
    >
      <View style={[styles.cardBar, { backgroundColor: note.color }]} />

      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <Text
            allowFontScaling={false}
            // Kullanıcının yazdığı not başlığı: "başlık" kelimesini taşısa da
            // içerik kullanıcı metnidir, başlık fontuna girmemeli.
            fontRole="body"
            style={[styles.cardTitle, { color: theme.text.primary }]}
            numberOfLines={1}
          >
            {note.title ||
              (isTodo
                ? i18nText("autoI18n.basliksiz_liste", "Başlıksız Liste")
                : i18nText("autoI18n.basliksiz_not", "Başlıksız Not"))}
          </Text>
          {/* Kart aksiyonları: kopyala + sil. Düzenleme karta dokununca açılan
              modalda yapılır, bu yüzden ayrı bir düzenle butonu yok. */}
          <View style={styles.cardActions}>
            <TouchableOpacity onPress={onCopy} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
              <Ionicons name="copy-outline" size={16} color={theme.text.muted} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 6, right: 8 }}>
              <Ionicons name="trash-outline" size={16} color={theme.text.muted} />
            </TouchableOpacity>
          </View>
        </View>

        {note.scheduledDate ? (
          <View style={[styles.dueDateBadge, { backgroundColor: note.color + "22" }]}>
            <Ionicons name="calendar-outline" size={11} color={note.color} />
            <Text allowFontScaling={false} style={[styles.dueDateText, { color: note.color }]}>
              {new Date(note.scheduledDate + "T12:00:00").toLocaleDateString(
                language === "tr" ? "tr-TR" : "en-US",
                { day: "numeric", month: "short" },
              )}
            </Text>
          </View>
        ) : null}

        {!isTodo ? (
          <Text
            allowFontScaling={false}
            style={[styles.cardContent, { color: theme.text.secondary }]}
            numberOfLines={2}
          >
            {note.content || i18nText("autoI18n.icerik_yok", "İçerik yok")}
          </Text>
        ) : (
          <>
            {activeTodos.slice(0, 3).map((todo) => (
              <View key={todo.id} style={styles.todoPreviewRow}>
                <Ionicons name="ellipse-outline" size={13} color={note.color} />
                <Text
                  allowFontScaling={false}
                  style={[styles.todoPreviewText, { color: theme.text.secondary }]}
                  numberOfLines={1}
                >
                  {todo.text}
                </Text>
              </View>
            ))}
            {activeTodos.length > 3 && (
              <Text allowFontScaling={false} style={{ color: theme.text.muted, fontSize: 11, marginTop: 2 }}>
                {i18nText("autoI18n.n_yapilacak_daha", "+{{count}} yapılacak daha…", {
                  count: activeTodos.length - 3,
                })}
              </Text>
            )}
            {doneTodos.length > 0 && (
              <Text
                allowFontScaling={false}
                style={{ color: note.color, fontSize: 11, marginTop: 4, fontWeight: "600" }}
              >
                {i18nText("autoI18n.n_tamamlandi", "✓ {{count}} tamamlandı", { count: doneTodos.length })}
              </Text>
            )}
            {todos.length > 0 && (
              <View style={[styles.progressTrack, { backgroundColor: theme.between }]}>
                <View
                  style={[
                    styles.progressFill,
                    { backgroundColor: note.color, width: `${progress * 100}%` },
                  ]}
                />
              </View>
            )}
          </>
        )}

        <Text allowFontScaling={false} style={[styles.cardDate, { color: theme.text.muted }]}>
          {new Date(note.updatedAt).toLocaleDateString(language === "tr" ? "tr-TR" : "en-US", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

// ─── Film/Dizi Not Kartı ────────────────────────────────────────────────────
// Düz NoteCard'dan farklı şema (`text`, `posterPath`, `mediaId`, `type`) taşıdığı
// için ayrı bir kart: poster küçük resmi + tür rozeti + "git" (ilgili detay
// sayfasına git) ve sil aksiyonları. Düzenleme, MediaNoteSheet'i (detay
// sayfalarındaki "Notum" kartıyla AYNI bileşen) açarak yapılır.
const MediaNoteCard = ({ note, theme, language, getTmdbUrl, onPress, onGoTo, onDelete }) => (
  <TouchableOpacity
    style={[styles.mediaCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}
    onPress={onPress}
    activeOpacity={0.78}
  >
    {note.posterPath ? (
      <Image source={{ uri: getTmdbUrl(note.posterPath, "poster", 200) }} style={styles.mediaPoster} />
    ) : (
      <View style={[styles.mediaPosterFallback, { backgroundColor: theme.between }]}>
        <Ionicons name={note.type === "tv" ? "tv-outline" : "film-outline"} size={20} color={theme.text.muted} />
      </View>
    )}
    <View style={styles.mediaCardBody}>
      <View style={[styles.cardHeader, { paddingTop: 0, marginBottom: 4 }]}>
        <Text
          allowFontScaling={false}
          fontRole="body"
          style={[styles.cardTitle, { color: theme.text.primary }]}
          numberOfLines={1}
        >
          {note.title || i18nText("autoI18n.basliksiz_yapim", "Başlıksız Yapım")}
        </Text>
        <View style={styles.cardActions}>
          <TouchableOpacity onPress={onGoTo} hitSlop={ICON_HIT_SLOP}>
            <Ionicons name="arrow-redo-outline" size={16} color={theme.text.muted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 6, right: 8 }}>
            <Ionicons name="trash-outline" size={16} color={theme.text.muted} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.mediaTypeBadge, { backgroundColor: theme.accent + "22" }]}>
        <Ionicons name={note.type === "tv" ? "tv-outline" : "film-outline"} size={10} color={theme.accent} />
        <Text allowFontScaling={false} style={[styles.mediaTypeBadgeText, { color: theme.accent }]}>
          {note.type === "tv" ? i18nText("autoI18n.dizi", "Dizi") : i18nText("autoI18n.film", "Film")}
        </Text>
      </View>

      <Text
        allowFontScaling={false}
        style={[styles.cardContent, { color: theme.text.secondary }]}
        numberOfLines={2}
      >
        {note.text || i18nText("autoI18n.icerik_yok", "İçerik yok")}
      </Text>

      <Text allowFontScaling={false} style={[styles.cardDate, { color: theme.text.muted, paddingBottom: 0, marginTop: 4 }]}>
        {new Date(note.updatedAt).toLocaleDateString(language === "tr" ? "tr-TR" : "en-US", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
      </Text>
    </View>
  </TouchableOpacity>
);

// ─── Ekle / Düzenle Modalı ────────────────────────────────────────────────────
const EditModal = ({ visible, initialNote, defaultType, theme, colorPairs, language, onSave, onClose }) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [todos, setTodos] = useState([]);
  const [pair, setPair] = useState(colorPairs[0]);
  const [type, setType] = useState(defaultType);
  const [newTodoText, setNewTodoText] = useState("");
  const [scheduledDate, setScheduledDate] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  /* Satır içi madde düzenleme: düzenlenen maddenin id'si + taslak metni */
  const [editingTodoId, setEditingTodoId] = useState(null);
  const [editingTodoText, setEditingTodoText] = useState("");
  /* Kopyalanan maddede kısa süre gösterilen onay ikonu */
  const [copiedTodoId, setCopiedTodoId] = useState(null);
  const [draftReadyKey, setDraftReadyKey] = useState(null);
  const copyTimerRef = useRef(null);
  const todoInputRef = useRef(null);
  // Mevcut kaydın tipi düzenleme sırasında değiştirilemez. `type` state'i yalnızca
  // yeni kayıt oluştururken üstteki Not/Todo seçicisini yönetir.
  const activeType = initialNote
    ? initialNote.type === "todo" ? "todo" : "note"
    : type;
  const draftStorageKey = todoDraftKey(initialNote?.id);

  useEffect(() => () => clearTimeout(copyTimerRef.current), []);

  const todayStr = new Date().toISOString().split("T")[0];
  const dateLabel = scheduledDate
    ? new Date(scheduledDate + "T12:00:00").toLocaleDateString(language === "tr" ? "tr-TR" : "en-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : i18nText("autoI18n.tarih_sec", "Tarih Seç");

  useEffect(() => {
    if (!visible) return;
    setDraftReadyKey(null);
    if (initialNote) {
      setTitle(initialNote.title || "");
      setContent(initialNote.content || "");
      setTodos((initialNote.todos || []).map((t) => ({ ...t })));
      const found =
        colorPairs.find((p) => p.color === initialNote.color) || {
          color: initialNote.color,
          background: initialNote.backgroundColor,
        };
      setPair(found);
      setType(initialNote.type || "note");
      setScheduledDate(initialNote.scheduledDate || null);
    } else {
      setTitle("");
      setContent("");
      setTodos([]);
      setPair(colorPairs[Math.floor(Math.random() * colorPairs.length)]);
      setType(defaultType);
      setScheduledDate(null);
    }
    setNewTodoText("");
    setEditingTodoId(null);
    setEditingTodoText("");
    setCopiedTodoId(null);
  }, [visible, initialNote, defaultType]);

  // Todo değişiklikleri buluta gönderilmeden önce cihazdaki kullanıcı kapsamlı
  // taslaktan geri yüklenir. Buluttaki kayıt taslaktan daha yeniyse eski taslak
  // kullanılmaz.
  useEffect(() => {
    if (!visible || activeType !== "todo" || draftReadyKey === draftStorageKey) return;
    const draft = getNoteTodoDraft(draftStorageKey);
    const cloudUpdatedAt = Number(initialNote?.updatedAt || 0);
    const draftSourceUpdatedAt = Number(draft?.sourceUpdatedAt || 0);
    const staleDraft = !!initialNote && draftSourceUpdatedAt > 0 && cloudUpdatedAt > draftSourceUpdatedAt;

    if (staleDraft) {
      removeNoteTodoDraft(draftStorageKey);
    } else if (draft) {
      setTitle(typeof draft.title === "string" ? draft.title : initialNote?.title || "");
      setTodos(Array.isArray(draft.todos) ? draft.todos.map((item) => ({ ...item })) : []);
      setNewTodoText(typeof draft.newTodoText === "string" ? draft.newTodoText : "");
      setScheduledDate(draft.scheduledDate || null);
      setEditingTodoId(draft.editingTodoId || null);
      setEditingTodoText(typeof draft.editingTodoText === "string" ? draft.editingTodoText : "");
      const savedPair = colorPairs.find((item) => item.color === draft.color);
      if (savedPair) setPair(savedPair);
    }
    setDraftReadyKey(draftStorageKey);
  }, [
    activeType,
    colorPairs,
    draftReadyKey,
    draftStorageKey,
    initialNote,
    visible,
  ]);

  // Her madde ekleme/silme, tamamlandı işareti, sıralama ve metin değişikliği
  // senkron MMKV taslağına gider. Firestore'a yalnız alttaki Kaydet basar.
  useEffect(() => {
    if (!visible || activeType !== "todo" || draftReadyKey !== draftStorageKey) return;
    saveNoteTodoDraft(draftStorageKey, {
      title,
      todos,
      newTodoText,
      scheduledDate,
      editingTodoId,
      editingTodoText,
      color: pair.color,
      backgroundColor: pair.background,
      sourceUpdatedAt: initialNote?.updatedAt || null,
      updatedAt: Date.now(),
    });
  }, [
    activeType,
    draftReadyKey,
    draftStorageKey,
    editingTodoId,
    editingTodoText,
    initialNote?.updatedAt,
    newTodoText,
    pair.background,
    pair.color,
    scheduledDate,
    title,
    todos,
    visible,
  ]);

  const color = pair.color;

  const addTodo = () => {
    if (!newTodoText.trim()) return;
    setTodos((prev) => [...prev, { id: uid(), text: newTodoText.trim(), done: false }]);
    setNewTodoText("");
    setTimeout(() => todoInputRef.current?.focus(), 50);
  };
  const toggleTodo = (id) =>
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  const deleteTodo = (id) => {
    if (editingTodoId === id) {
      setEditingTodoId(null);
      setEditingTodoText("");
    }
    setTodos((prev) => prev.filter((t) => t.id !== id));
  };

  /* ── Madde aksiyonları: düzenle / kopyala ── */
  const startEditTodo = (item) => {
    // Başka bir madde düzenleniyorsa taslağı çöpe atma, önce onu yaz.
    const pending = editingTodoText.trim();
    if (editingTodoId && editingTodoId !== item.id && pending) {
      setTodos((prev) =>
        prev.map((t) => (t.id === editingTodoId ? { ...t, text: pending } : t)),
      );
    }
    setEditingTodoId(item.id);
    setEditingTodoText(item.text);
  };
  const cancelEditTodo = () => {
    setEditingTodoId(null);
    setEditingTodoText("");
  };
  const commitEditTodo = () => {
    const text = editingTodoText.trim();
    // Boş bırakılırsa düzenleme iptal edilir; silmek için çöp kutusu kullanılır.
    if (text) {
      setTodos((prev) =>
        prev.map((t) => (t.id === editingTodoId ? { ...t, text } : t)),
      );
    }
    cancelEditTodo();
  };
  const copyTodo = async (item) => {
    if (!item.text?.trim()) return;
    await Clipboard.setStringAsync(item.text);
    toast.success(i18nText("autoI18n.panoya_kopyalandi", "Panoya kopyalandı"));
    // Toast kök seviyede duruyor ve alt-sheet'in altında kalabiliyor; satırda da
    // kısa bir onay göster.
    setCopiedTodoId(item.id);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopiedTodoId(null), 1200);
  };

  const moveTodo = (id, direction) => {
    setTodos((prev) => moveTodoItem(prev, id, direction));
  };

  /* Tek satır: yapılacak / yapılan ayrımı `item.done` ile yapılır. */
  const renderTodoRow = (item) => {
    const isEditing = editingTodoId === item.id;
    const isCopied = copiedTodoId === item.id;
    const { canMoveUp, canMoveDown } = getTodoMoveAvailability(todos, item.id);
    return (
      <View key={item.id} style={styles.todoRow}>
        <TouchableOpacity onPress={() => toggleTodo(item.id)} disabled={isEditing}>
          <Ionicons
            name={item.done ? "checkmark-circle" : "ellipse-outline"}
            size={22}
            color={isEditing ? theme.text.muted : color}
          />
        </TouchableOpacity>

        {isEditing ? (
          <View style={styles.todoEditField}>
            <TextInput
              allowFontScaling={false}
              style={[
                styles.todoItemText,
                styles.todoEditInput,
                { color: theme.text.primary, borderBottomColor: color },
              ]}
              value={editingTodoText}
              onChangeText={setEditingTodoText}
              maxLength={TODO_ITEM_LIMIT}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={commitEditTodo}
            />
            <RemainingCounter
              inside="edit"
              value={editingTodoText}
              limit={TODO_ITEM_LIMIT}
              theme={theme}
            />
          </View>
        ) : (
          <Text
            allowFontScaling={false}
            style={[
              styles.todoItemText,
              {
                flex: 1,
                color: item.done ? theme.text.muted : theme.text.primary,
                textDecorationLine: item.done ? "line-through" : "none",
              },
            ]}
          >
            {item.text}
          </Text>
        )}

        <View style={styles.todoRowActions}>
          {isEditing ? (
            <>
              <TouchableOpacity onPress={commitEditTodo} hitSlop={ICON_HIT_SLOP}>
                <Ionicons name="checkmark-circle" size={20} color={color} />
              </TouchableOpacity>
              <TouchableOpacity onPress={cancelEditTodo} hitSlop={ICON_HIT_SLOP}>
                <Ionicons name="close-circle" size={20} color={theme.text.muted} />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                onPress={() => moveTodo(item.id, "up")}
                disabled={!canMoveUp}
                hitSlop={ICON_HIT_SLOP}
                style={{ opacity: canMoveUp ? 1 : 0.28 }}
                accessibilityRole="button"
                accessibilityLabel={i18nText("autoI18n.maddeyi_yukari_tasi", "Maddeyi yukarı taşı")}
              >
                <Ionicons
                  name="chevron-up"
                  size={17}
                  color={canMoveUp ? theme.text.secondary : theme.text.muted}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => moveTodo(item.id, "down")}
                disabled={!canMoveDown}
                hitSlop={ICON_HIT_SLOP}
                style={{ opacity: canMoveDown ? 1 : 0.28 }}
                accessibilityRole="button"
                accessibilityLabel={i18nText("autoI18n.maddeyi_asagi_tasi", "Maddeyi aşağı taşı")}
              >
                <Ionicons
                  name="chevron-down"
                  size={17}
                  color={canMoveDown ? theme.text.secondary : theme.text.muted}
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => startEditTodo(item)} hitSlop={ICON_HIT_SLOP}>
                <Ionicons name="pencil-outline" size={16} color={theme.text.muted} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => copyTodo(item)} hitSlop={ICON_HIT_SLOP}>
                <Ionicons
                  name={isCopied ? "checkmark-done" : "copy-outline"}
                  size={16}
                  color={isCopied ? color : theme.text.muted}
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteTodo(item.id)} hitSlop={ICON_HIT_SLOP}>
                <Ionicons name="trash-outline" size={16} color={theme.text.muted} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  const handleSave = async () => {
    const base = initialNote || { id: uid(), createdAt: Date.now() };
    const cleanContent = activeType === "note" ? content : "";
    // Bir madde düzenlenirken kaydedilirse taslak metin kaybolmasın.
    const pendingText = editingTodoText.trim();
    const cleanTodos =
      activeType === "todo"
        ? todos.map((t) =>
            t.id === editingTodoId && pendingText ? { ...t, text: pendingText } : t,
          )
        : [];
    // Tarih yalnızca todo UI'ında düzenlenir; mevcut not tarihleri korunur.
    const cleanScheduled =
      activeType === "todo"
        ? scheduledDate || null
        : initialNote && initialNote.type === "note"
          ? initialNote.scheduledDate || null
          : null;

    const note = {
      id: base.id,
      createdAt: base.createdAt,
      type: activeType,
      title: title.trim(),
      content: cleanContent,
      todos: cleanTodos,
      color: pair.color,
      backgroundColor: pair.background,
      scheduledDate: cleanScheduled,
    };
    const saved = await onSave(note);
    if (saved !== false && activeType === "todo") {
      removeNoteTodoDraft(draftStorageKey);
    }
  };

  const activeTodos = todos.filter((t) => !t.done);
  const doneTodos = todos.filter((t) => t.done);

  // Klavye kaldırması artık BottomSheetModal'ın içinde
  // (hooks/useSheetTransition.js) — ayrı KeyboardAvoidingView gerekmiyor.
  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      intensity={35}
      dimColor="rgba(0,0,0,0.35)"
      sheetStyle={[styles.editSheet, { backgroundColor: theme.secondary }]}
    >
          <View style={[styles.handle, { backgroundColor: theme.border }]} />

          {/* Tip yalnızca ilk kez kayıt oluşturulurken seçilebilir. */}
          {!initialNote && (
            <View style={[styles.typeSwitch, { backgroundColor: theme.primary }]}>
              {["note", "todo"].map((tp) => (
                <TouchableOpacity
                  key={tp}
                  style={[styles.typeBtn, activeType === tp && { backgroundColor: color }]}
                  onPress={() => setType(tp)}
                >
                  <Ionicons
                    name={tp === "note" ? "document-text" : "checkbox"}
                    size={14}
                    color={activeType === tp ? "#fff" : theme.text.secondary}
                  />
                  <Text
                    allowFontScaling={false}
                    style={[styles.typeBtnText, { color: activeType === tp ? "#fff" : theme.text.secondary }]}
                  >
                    {tp === "note"
                      ? i18nText("autoI18n.not", "Not")
                      : i18nText("autoI18n.yapilacak", "Yapılacak")}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Todo'da tarih ve renkler aynı kompakt satırı paylaşır. */}
          {activeType === "todo" ? (
            <View style={styles.todoOptionsRow}>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                style={[
                  styles.dueDatePicker,
                  styles.compactDueDatePicker,
                  {
                    backgroundColor: scheduledDate ? color + "22" : theme.primary,
                    borderColor: scheduledDate ? color : theme.border,
                  },
                ]}
              >
                <Ionicons name="calendar-outline" size={14} color={scheduledDate ? color : theme.text.muted} />
                <Text
                  allowFontScaling={false}
                  numberOfLines={2}
                  style={[styles.compactDueDateText, { color: scheduledDate ? color : theme.text.muted }]}
                >
                  {dateLabel}
                </Text>
                {scheduledDate && (
                  <TouchableOpacity
                    onPress={() => setScheduledDate(null)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={14} color={theme.text.muted} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              <View style={[styles.colorRow, styles.compactColorRow]}>
                {colorPairs.map((p) => (
                  <TouchableOpacity
                    key={p.color}
                    style={[
                      styles.colorDot,
                      styles.compactColorDot,
                      { backgroundColor: p.color },
                      pair.color === p.color && styles.compactColorDotSelected,
                    ]}
                    onPress={() => setPair(p)}
                  />
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.colorRow}>
              {colorPairs.map((p) => (
                <TouchableOpacity
                  key={p.color}
                  style={[
                    styles.colorDot,
                    { backgroundColor: p.color },
                    pair.color === p.color && styles.colorDotSelected,
                  ]}
                  onPress={() => setPair(p)}
                />
              ))}
            </View>
          )}

          {/* Başlık */}
          <TextInput
            allowFontScaling={false}
            style={[styles.titleInput, { color: theme.text.primary, borderBottomColor: color }]}
            placeholder={i18nText("autoI18n.baslik", "Başlık")}
            placeholderTextColor={theme.text.muted}
            value={title}
            onChangeText={setTitle}
            maxLength={NOTE_TITLE_LIMIT}
          />

          {activeType === "note" ? (
            <View style={[styles.noteContentField, { backgroundColor: theme.primary }]}>
              <TextInput
                allowFontScaling={false}
                style={[styles.contentInput, { color: theme.text.secondary }]}
                placeholder={i18nText("autoI18n.notunu_yaz", "Notunuzu buraya yazın…")}
                placeholderTextColor={theme.text.muted}
                multiline
                value={content}
                onChangeText={setContent}
                maxLength={NOTE_CONTENT_LIMIT}
                textAlignVertical="top"
              />
              <RemainingCounter
                inside="note"
                value={content}
                limit={NOTE_CONTENT_LIMIT}
                theme={theme}
              />
            </View>
          ) : (
            <View style={styles.todoContainer}>
              <ScrollView
                style={styles.todoScroll}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                {activeTodos.length > 0 && (
                  <>
                    <Text allowFontScaling={false} style={[styles.sectionLabel, { color: theme.text.muted }]}>
                      {i18nText("autoI18n.yapilacaklar_upper", "YAPILACAKLAR")}
                    </Text>
                    {activeTodos.map(renderTodoRow)}
                  </>
                )}

                {doneTodos.length > 0 && (
                  <>
                    <View style={[styles.doneDivider, { borderColor: theme.border }]}>
                      <Text allowFontScaling={false} style={[styles.sectionLabel, { color }]}>
                        {i18nText("autoI18n.yapilanlar_upper", "YAPILANLAR")}
                      </Text>
                    </View>
                    {doneTodos.map(renderTodoRow)}
                  </>
                )}
              </ScrollView>

              <View style={styles.todoComposer}>
                <View style={styles.addTodoRow}>
                  <View
                    style={[
                      styles.addTodoInputShell,
                      { borderColor: color + "66", backgroundColor: theme.primary },
                    ]}
                  >
                    <TextInput
                      ref={todoInputRef}
                      allowFontScaling={false}
                      style={[styles.addTodoInput, { color: theme.text.primary }]}
                      placeholder={i18nText("autoI18n.yeni_madde_ekle", "Yeni madde ekle…")}
                      placeholderTextColor={theme.text.muted}
                      value={newTodoText}
                      onChangeText={setNewTodoText}
                      maxLength={TODO_ITEM_LIMIT}
                      onSubmitEditing={addTodo}
                      returnKeyType="done"
                      blurOnSubmit={false}
                    />
                    <RemainingCounter
                      inside
                      value={newTodoText}
                      limit={TODO_ITEM_LIMIT}
                      theme={theme}
                    />
                  </View>
                  <TouchableOpacity
                    onPress={addTodo}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={[styles.addTodoButton, { backgroundColor: color + "1F" }]}
                  >
                    <Ionicons name="add-circle" size={26} color={color} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          <TouchableOpacity style={[styles.saveBtn, { backgroundColor: color }]} onPress={handleSave}>
            <Text allowFontScaling={false} style={styles.saveBtnText}>
              {i18nText("autoI18n.kaydet", "Kaydet")}
            </Text>
          </TouchableOpacity>
      <DatePickerModal
        visible={showDatePicker}
        value={scheduledDate || todayStr}
        onConfirm={(d) => {
          const iso = typeof d === "string" ? d : d.toISOString().split("T")[0];
          setScheduledDate(iso);
          setShowDatePicker(false);
        }}
        onClose={() => setShowDatePicker(false)}
        title={i18nText("autoI18n.hatirlatici_tarihi", "Hatırlatıcı Tarihi")}
        subtitle={i18nText("autoI18n.bu_not_icin_hatirlatma_tarihi_secin", "Bu not için hatırlatma tarihi seçin")}
        confirmLabel={i18nText("autoI18n.tarih_sec", "Tarihi Seç")}
        minDate={new Date()}
        minDateErrorMsg={i18nText("autoI18n.gecmis_bir_tarih_secilemez", "Geçmiş bir tarih seçilemez")}
      />
    </BottomSheetModal>
  );
};

// ─── Ana Ekran ────────────────────────────────────────────────────────────────
export default function NotesScreen({ navigation }) {
  const { theme } = useTheme();
  const { t, language } = useLanguage();
  const { notes, loadingNotes, saveNote, handleDeleteNote } = useProfileNotes();
  const { mediaNotes, loadingMediaNotes, deleteMediaNote } = useMediaNotes();
  const { getTmdbUrl } = useImageQualitySettings();
  const { primeNotificationPermission } = useDeviceNotifications();

  const colorPairs = useMemo(() => buildColorPairs(theme.notesColor), [theme.notesColor]);
  const title = t.profileScreen?.Notes?.notes ?? i18nText("autoI18n.notlar", "Notlar");

  const [tab, setTab] = useState("note");
  const [modalVisible, setModalVisible] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [mediaSheetVisible, setMediaSheetVisible] = useState(false);
  const [editingMediaNote, setEditingMediaNote] = useState(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [deleteTargetKind, setDeleteTargetKind] = useState("note");

  const allNotes = notes || [];
  const allMediaNotes = mediaNotes || [];
  const filtered = allNotes.filter((n) =>
    tab === "todo" ? n.type === "todo" : n.type !== "todo",
  );
  // Sekmeye göre FlatList'e giden veri: "media" tam ayrı bir koleksiyondan
  // (MediaNotesContext) geliyor, düz not/todo şemasıyla karışmıyor.
  const listData = tab === "media" ? allMediaNotes : filtered;
  const isListLoading = tab === "media" ? loadingMediaNotes : loadingNotes;

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

  const requestDelete = (id, kind = "note") => {
    setDeleteTargetId(id);
    setDeleteTargetKind(kind);
    setDeleteModalVisible(true);
  };
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

  const openMediaEdit = (note) => {
    setEditingMediaNote(note);
    setMediaSheetVisible(true);
  };
  const goToMedia = (note) => {
    navigation.navigate(note.type === "tv" ? "TvShowsDetails" : "MovieDetails", {
      id: note.mediaId,
    });
  };

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
    setEditingNote(null);
    setModalVisible(true);
  };
  const openEdit = (note) => {
    setEditingNote(note);
    setModalVisible(true);
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.primary }]}>
      <StatusBar barStyle={isLightSurface(theme.primary) ? "dark-content" : "light-content"} />
      <ScreenDecor iconOpacity={0.25} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
            style={[styles.backBtn, { backgroundColor: theme.secondary }]}
          >
            <Ionicons name="chevron-back" size={22} color={theme.text.primary} />
          </TouchableOpacity>
          <Text
            allowFontScaling={false}
            style={[styles.headerTitle, { color: theme.text.primary }]}
            numberOfLines={1}
          >
            {title}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Tab Bar */}
        <View style={[styles.tabBar, { backgroundColor: theme.secondary }]}>
          {[
            { key: "note", label: i18nText("autoI18n.notlar", "Notlar"), icon: "document-text" },
            { key: "todo", label: i18nText("autoI18n.yapilacaklar", "Yapılacaklar"), icon: "checkbox" },
            { key: "media", label: i18nText("autoI18n.film_dizi", "Film/Dizi"), icon: "film" },
          ].map((tabItem) => {
            const isActive = tab === tabItem.key;
            const count =
              tabItem.key === "media"
                ? allMediaNotes.length
                : allNotes.filter((n) =>
                    tabItem.key === "todo" ? n.type === "todo" : n.type !== "todo",
                  ).length;
            return (
              <TouchableOpacity
                key={tabItem.key}
                style={[styles.tabBtn, isActive && { backgroundColor: theme.accent }]}
                onPress={() => setTab(tabItem.key)}
              >
                <Ionicons name={tabItem.icon} size={15} color={isActive ? "#fff" : theme.text.secondary} />
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={[styles.tabBtnText, { color: isActive ? "#fff" : theme.text.secondary }]}
                >
                  {tabItem.label}
                </Text>
                {count > 0 && (
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: isActive ? "#ffffff44" : theme.accent + "33" },
                    ]}
                  >
                    <Text
                      allowFontScaling={false}
                      style={[styles.badgeText, { color: isActive ? "#fff" : theme.accent }]}
                    >
                      {count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Liste */}
        <FlatList
          data={listData}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={isListLoading ? null : <EmptyState tab={tab} theme={theme} />}
          renderItem={({ item }) =>
            tab === "media" ? (
              <MediaNoteCard
                note={item}
                theme={theme}
                language={language}
                getTmdbUrl={getTmdbUrl}
                onPress={() => openMediaEdit(item)}
                onGoTo={() => goToMedia(item)}
                onDelete={() => requestDelete(item.id, "media")}
              />
            ) : (
              <NoteCard
                note={item}
                theme={theme}
                language={language}
                onPress={() => openEdit(item)}
                onCopy={() => copyNote(item)}
                onDelete={() => requestDelete(item.id, "note")}
              />
            )
          }
        />

        {/* FAB — "media" sekmesinde yok: bu notlar buradan değil, ilgili film/dizi
            detay sayfasındaki "Notum" kartından oluşturulur. */}
        {tab !== "media" && (
          <TouchableOpacity
            style={[styles.fab, { backgroundColor: theme.accent }]}
            onPress={openNew}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={28} color="#fff" />
          </TouchableOpacity>
        )}
      </SafeAreaView>

      <EditModal
        visible={modalVisible}
        initialNote={editingNote}
        defaultType={tab === "media" ? "note" : tab}
        theme={theme}
        colorPairs={colorPairs}
        language={language}
        onSave={handleSave}
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
    paddingVertical: 10,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: "800", letterSpacing: -0.3 },
  headerSpacer: { width: 40 },

  // Tabs
  tabBar: {
    flexDirection: "row",
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 4,
    gap: 4,
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderRadius: 12,
  },
  tabBtnText: { fontSize: 12, fontWeight: "700" },
  badge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: "800" },

  // List
  list: { paddingHorizontal: 16, paddingBottom: 100, gap: 12 },

  // Card
  card: { borderRadius: 16, borderWidth: 1, flexDirection: "row", overflow: "hidden" },
  cardBar: { width: 4 },
  cardBody: { flex: 1, paddingLeft: 10, paddingRight: 12 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
    paddingTop: 12,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", flex: 1, marginRight: 8 },
  cardActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardContent: { fontSize: 13, lineHeight: 18, marginBottom: 6 },
  cardDate: { fontSize: 10, marginTop: 8, paddingBottom: 10 },
  todoPreviewRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 },
  todoPreviewText: { fontSize: 13, flex: 1 },
  progressTrack: { height: 3, borderRadius: 2, marginTop: 6, marginBottom: 2, overflow: "hidden" },
  progressFill: { height: 3, borderRadius: 2 },

  // Film/Dizi kartı
  mediaCard: {
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
    padding: 10,
    gap: 10,
  },
  mediaPoster: { width: 54, height: 78, borderRadius: 10 },
  mediaPosterFallback: {
    width: 54,
    height: 78,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  mediaCardBody: { flex: 1, minWidth: 0 },
  mediaTypeBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 5,
  },
  mediaTypeBadgeText: { fontSize: 9.5, fontWeight: "800" },

  // FAB
  fab: {
    position: "absolute",
    bottom: 32,
    right: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },

  // Edit Modal
  overlay: { flex: 1, backgroundColor: "#00000088", justifyContent: "flex-end" },
  editSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: 36,
    maxHeight: "92%",
    gap: 12,
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 4 },

  typeSwitch: { flexDirection: "row", borderRadius: 12, padding: 4, gap: 4 },
  typeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
  },
  typeBtnText: { fontSize: 13, fontWeight: "700" },

  colorRow: { flexDirection: "row", gap: 8, justifyContent: "center", flexWrap: "wrap" },
  colorDot: { width: 26, height: 26, borderRadius: 13 },
  colorDotSelected: { borderWidth: 3, borderColor: "#fff", transform: [{ scale: 1.15 }] },
  todoOptionsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  compactColorRow: {
    flex: 1,
    minWidth: 0,
    gap: 5,
    justifyContent: "flex-start",
    alignContent: "center",
  },
  compactColorDot: { width: 18, height: 18, borderRadius: 9 },
  compactColorDotSelected: {
    borderWidth: 2,
    borderColor: "#fff",
    transform: [{ scale: 1.08 }],
  },

  titleInput: {
    fontSize: 18,
    fontWeight: "700",
    borderBottomWidth: 2,
    paddingVertical: 8,
    paddingHorizontal: 2,
  },

  noteContentField: {
    position: "relative",
    borderRadius: 12,
    overflow: "hidden",
  },
  contentInput: {
    width: "100%",
    paddingTop: 12,
    paddingHorizontal: 12,
    paddingBottom: 28,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 120,
    maxHeight: 200,
  },
  remainingCounter: {
    alignSelf: "flex-end",
    fontSize: 10.5,
    fontWeight: "700",
    marginTop: 4,
    marginRight: 3,
  },
  todoInputCounter: {
    position: "absolute",
    right: 7,
    bottom: 3,
    width: 30,
    fontSize: 9.5,
    fontWeight: "700",
    textAlign: "right",
  },
  noteInputCounter: {
    width: 42,
    position: "absolute",
    right: 8,
    bottom: 6,
    fontSize: 10,
    fontWeight: "700",
    textAlign: "right",
  },
  todoEditCounter: {
    width: 27,
    position: "absolute",
    right: 1,
    bottom: 1,
    fontSize: 9,
    fontWeight: "700",
    textAlign: "right",
  },

  todoContainer: { gap: 8 },
  todoComposer: { gap: 2 },
  todoScroll: { maxHeight: 240 },
  sectionLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginBottom: 4, marginTop: 4 },
  doneDivider: { borderTopWidth: 1, marginTop: 8, marginBottom: 4, paddingTop: 6 },
  todoRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 5 },
  todoItemText: { fontSize: 14 },
  todoRowActions: { flexDirection: "row", alignItems: "center", gap: 9 },
  todoEditField: { flex: 1, position: "relative" },
  todoEditInput: {
    width: "100%",
    borderBottomWidth: 1,
    paddingTop: 2,
    paddingBottom: 11,
    paddingHorizontal: 0,
  },
  addTodoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addTodoInputShell: {
    flex: 1,
    height: 44,
    position: "relative",
    borderRadius: 12,
    borderWidth: 1,
    paddingLeft: 12,
  },
  addTodoInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 8,
    paddingLeft: 0,
    paddingRight: 8,
  },
  addTodoButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  saveBtn: { paddingVertical: 14, borderRadius: 16, alignItems: "center" },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  // Delete Modal
  deleteOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  deleteContent: { width: "80%", borderRadius: 20, padding: 24, alignItems: "center", elevation: 5 },
  deleteIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  deleteTitle: { fontSize: 20, fontWeight: "800", marginBottom: 8 },
  deleteMsg: { fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 20 },
  deleteBtns: { flexDirection: "row", width: "100%", gap: 10 },
  deleteCancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: "center" },
  deleteCancelText: { fontWeight: "700", fontSize: 15 },
  deleteConfirmBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: "center" },
  deleteConfirmText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  // dueDate
  dueDateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginBottom: 4,
  },
  dueDateText: { fontSize: 11, fontWeight: "700" },
  dueDatePicker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  compactDueDatePicker: {
    width: 144,
    flexShrink: 0,
    gap: 4,
    minHeight: 42,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  compactDueDateText: {
    flex: 1,
    minWidth: 0,
    fontSize: 10.5,
    lineHeight: 12.5,
    fontWeight: "700",
    textAlign: "center",
  },
});
