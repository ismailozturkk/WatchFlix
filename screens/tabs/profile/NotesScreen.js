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
  Clipboard,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../../context/ThemeContext";
import { useLanguage } from "../../../context/LanguageContext";
import { useProfileNotes } from "../../../context/ProfileNotesContext";
import ScreenDecor from "../../../components/ScreenDecor";
import DatePickerModal from "@components/modals/DatePickerModal";
import { toast } from "@components/AppToast";
import { i18nText } from "../../../utils/i18nText";

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

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
const EmptyState = ({ tab, theme }) => (
  <View style={{ alignItems: "center", marginTop: 80, gap: 12 }}>
    <Ionicons
      name={tab === "note" ? "document-text-outline" : "checkbox-outline"}
      size={56}
      color={theme.text.muted}
    />
    <Text allowFontScaling={false} style={{ color: theme.text.secondary, fontSize: 16, fontWeight: "600" }}>
      {tab === "note"
        ? i18nText("autoI18n.henuz_not_yok", "Henüz not yok")
        : i18nText("autoI18n.henuz_yapilacak_yok", "Henüz yapılacak yok")}
    </Text>
    <Text
      allowFontScaling={false}
      style={{ color: theme.text.muted, fontSize: 13, textAlign: "center", paddingHorizontal: 40 }}
    >
      {tab === "note"
        ? i18nText("autoI18n.yeni_not_ekle_ipucu", "Sağ alttaki + butonuyla yeni bir not ekle")
        : i18nText("autoI18n.yeni_yapilacak_ekle_ipucu", "Sağ alttaki + butonuyla yeni bir yapılacak listesi ekle")}
    </Text>
  </View>
);

// ─── Not Kartı ────────────────────────────────────────────────────────────────
const NoteCard = ({ note, theme, language, onPress, onEdit, onCopy, onDelete }) => {
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
            style={[styles.cardTitle, { color: theme.text.primary }]}
            numberOfLines={1}
          >
            {note.title ||
              (isTodo
                ? i18nText("autoI18n.basliksiz_liste", "Başlıksız Liste")
                : i18nText("autoI18n.basliksiz_not", "Başlıksız Not"))}
          </Text>
          {/* Kart aksiyonları: todo'da düzenle + kopyala + sil, notta kopyala + sil
              (karta dokunmak da düzenleme modalını açar) */}
          <View style={styles.cardActions}>
            {isTodo && (
              <TouchableOpacity onPress={onEdit} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
                <Ionicons name="pencil-outline" size={16} color={theme.text.muted} />
              </TouchableOpacity>
            )}
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
  const todoInputRef = useRef(null);

  const todayStr = new Date().toISOString().split("T")[0];
  const dateLabel = scheduledDate
    ? new Date(scheduledDate + "T12:00:00").toLocaleDateString(language === "tr" ? "tr-TR" : "en-US", {
        day: "numeric",
        month: "short",
      })
    : i18nText("autoI18n.tarih_sec", "Tarih Seç");

  useEffect(() => {
    if (!visible) return;
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
  }, [visible, initialNote, defaultType]);

  const color = pair.color;

  const addTodo = () => {
    if (!newTodoText.trim()) return;
    setTodos((prev) => [...prev, { id: uid(), text: newTodoText.trim(), done: false }]);
    setNewTodoText("");
    setTimeout(() => todoInputRef.current?.focus(), 50);
  };
  const toggleTodo = (id) =>
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  const deleteTodo = (id) => setTodos((prev) => prev.filter((t) => t.id !== id));

  const handleSave = () => {
    const base = initialNote || { id: uid(), createdAt: Date.now() };
    const cleanContent = type === "note" ? content : "";
    const cleanTodos = type === "todo" ? todos : [];
    // Tarih yalnızca todo UI'ında düzenlenir; mevcut not tarihleri korunur.
    const cleanScheduled =
      type === "todo"
        ? scheduledDate || null
        : initialNote && initialNote.type === "note"
          ? initialNote.scheduledDate || null
          : null;

    const note = {
      id: base.id,
      createdAt: base.createdAt,
      type,
      title: title.trim(),
      content: cleanContent,
      todos: cleanTodos,
      color: pair.color,
      backgroundColor: pair.background,
      scheduledDate: cleanScheduled,
    };
    onSave(note);
  };

  const activeTodos = todos.filter((t) => !t.done);
  const doneTodos = todos.filter((t) => t.done);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={[styles.editSheet, { backgroundColor: theme.secondary }]}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />

          {/* Tip seçici */}
          <View style={[styles.typeSwitch, { backgroundColor: theme.primary }]}>
            {["note", "todo"].map((tp) => (
              <TouchableOpacity
                key={tp}
                style={[styles.typeBtn, type === tp && { backgroundColor: color }]}
                onPress={() => setType(tp)}
              >
                <Ionicons
                  name={tp === "note" ? "document-text" : "checkbox"}
                  size={14}
                  color={type === tp ? "#fff" : theme.text.secondary}
                />
                <Text
                  allowFontScaling={false}
                  style={[styles.typeBtnText, { color: type === tp ? "#fff" : theme.text.secondary }]}
                >
                  {tp === "note"
                    ? i18nText("autoI18n.not", "Not")
                    : i18nText("autoI18n.yapilacak", "Yapılacak")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Renk paleti */}
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

          {/* Başlık */}
          <TextInput
            allowFontScaling={false}
            style={[styles.titleInput, { color: theme.text.primary, borderBottomColor: color }]}
            placeholder={i18nText("autoI18n.baslik", "Başlık")}
            placeholderTextColor={theme.text.muted}
            value={title}
            onChangeText={setTitle}
            maxLength={60}
          />

          {/* Tarih seçici — sadece todo tipinde */}
          {type === "todo" && (
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              style={[
                styles.dueDatePicker,
                {
                  backgroundColor: scheduledDate ? color + "22" : theme.primary,
                  borderColor: scheduledDate ? color : theme.border,
                },
              ]}
            >
              <Ionicons name="calendar-outline" size={16} color={scheduledDate ? color : theme.text.muted} />
              <Text
                allowFontScaling={false}
                style={{ color: scheduledDate ? color : theme.text.muted, fontSize: 13, fontWeight: "600", flex: 1 }}
              >
                {dateLabel}
              </Text>
              {scheduledDate && (
                <TouchableOpacity
                  onPress={() => setScheduledDate(null)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={16} color={theme.text.muted} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          )}

          {type === "note" ? (
            <TextInput
              allowFontScaling={false}
              style={[styles.contentInput, { color: theme.text.secondary, backgroundColor: theme.primary }]}
              placeholder={i18nText("autoI18n.notunu_yaz", "Notunuzu buraya yazın…")}
              placeholderTextColor={theme.text.muted}
              multiline
              value={content}
              onChangeText={setContent}
              maxLength={2000}
              textAlignVertical="top"
            />
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
                    {activeTodos.map((item) => (
                      <View key={item.id} style={styles.todoRow}>
                        <TouchableOpacity onPress={() => toggleTodo(item.id)}>
                          <Ionicons name="ellipse-outline" size={22} color={color} />
                        </TouchableOpacity>
                        <Text
                          allowFontScaling={false}
                          style={[styles.todoItemText, { color: theme.text.primary, flex: 1 }]}
                        >
                          {item.text}
                        </Text>
                        <TouchableOpacity onPress={() => deleteTodo(item.id)}>
                          <Ionicons name="close" size={16} color={theme.text.muted} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </>
                )}

                {doneTodos.length > 0 && (
                  <>
                    <View style={[styles.doneDivider, { borderColor: theme.border }]}>
                      <Text allowFontScaling={false} style={[styles.sectionLabel, { color }]}>
                        {i18nText("autoI18n.yapilanlar_upper", "YAPILANLAR")}
                      </Text>
                    </View>
                    {doneTodos.map((item) => (
                      <View key={item.id} style={styles.todoRow}>
                        <TouchableOpacity onPress={() => toggleTodo(item.id)}>
                          <Ionicons name="checkmark-circle" size={22} color={color} />
                        </TouchableOpacity>
                        <Text
                          allowFontScaling={false}
                          style={[
                            styles.todoItemText,
                            { color: theme.text.muted, flex: 1, textDecorationLine: "line-through" },
                          ]}
                        >
                          {item.text}
                        </Text>
                        <TouchableOpacity onPress={() => deleteTodo(item.id)}>
                          <Ionicons name="close" size={16} color={theme.text.muted} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </>
                )}
              </ScrollView>

              <View style={[styles.addTodoRow, { borderColor: color + "66", backgroundColor: theme.primary }]}>
                <TextInput
                  ref={todoInputRef}
                  allowFontScaling={false}
                  style={[styles.addTodoInput, { color: theme.text.primary }]}
                  placeholder={i18nText("autoI18n.yeni_madde_ekle", "Yeni madde ekle…")}
                  placeholderTextColor={theme.text.muted}
                  value={newTodoText}
                  onChangeText={setNewTodoText}
                  maxLength={60}
                  onSubmitEditing={addTodo}
                  returnKeyType="done"
                  blurOnSubmit={false}
                />
                <TouchableOpacity onPress={addTodo} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="add-circle" size={26} color={color} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          <TouchableOpacity style={[styles.saveBtn, { backgroundColor: color }]} onPress={handleSave}>
            <Text allowFontScaling={false} style={styles.saveBtnText}>
              {i18nText("autoI18n.kaydet", "Kaydet")}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

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
    </Modal>
  );
};

// ─── Ana Ekran ────────────────────────────────────────────────────────────────
export default function NotesScreen({ navigation }) {
  const { theme } = useTheme();
  const { t, language } = useLanguage();
  const { notes, loadingNotes, saveNote, handleDeleteNote } = useProfileNotes();

  const colorPairs = useMemo(() => buildColorPairs(theme.notesColor), [theme.notesColor]);
  const title = t.profileScreen?.Notes?.notes ?? i18nText("autoI18n.notlar", "Notlar");

  const [tab, setTab] = useState("note");
  const [modalVisible, setModalVisible] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  const allNotes = notes || [];
  const filtered = allNotes.filter((n) =>
    tab === "note" ? n.type !== "todo" : n.type === "todo",
  );

  const handleSave = useCallback(
    (note) => {
      saveNote(note);
      setModalVisible(false);
      setEditingNote(null);
    },
    [saveNote],
  );

  const requestDelete = (id) => {
    setDeleteTargetId(id);
    setDeleteModalVisible(true);
  };
  const confirmDelete = () => {
    if (deleteTargetId) handleDeleteNote(deleteTargetId);
    setDeleteModalVisible(false);
    setDeleteTargetId(null);
  };

  /* Panoya kopyala: not = başlık + içerik, todo = başlık + ☐/☑ maddeler */
  const copyNote = useCallback((note) => {
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
    Clipboard.setString(text);
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
      <StatusBar barStyle="light-content" />
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
          ].map((tabItem) => {
            const isActive = tab === tabItem.key;
            const count = allNotes.filter((n) =>
              tabItem.key === "note" ? n.type !== "todo" : n.type === "todo",
            ).length;
            return (
              <TouchableOpacity
                key={tabItem.key}
                style={[styles.tabBtn, isActive && { backgroundColor: theme.accent }]}
                onPress={() => setTab(tabItem.key)}
              >
                <Ionicons name={tabItem.icon} size={16} color={isActive ? "#fff" : theme.text.secondary} />
                <Text
                  allowFontScaling={false}
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
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={loadingNotes ? null : <EmptyState tab={tab} theme={theme} />}
          renderItem={({ item }) => (
            <NoteCard
              note={item}
              theme={theme}
              language={language}
              onPress={() => openEdit(item)}
              onEdit={() => openEdit(item)}
              onCopy={() => copyNote(item)}
              onDelete={() => requestDelete(item.id)}
            />
          )}
        />

        {/* FAB */}
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: theme.accent }]}
          onPress={openNew}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </SafeAreaView>

      <EditModal
        visible={modalVisible}
        initialNote={editingNote}
        defaultType={tab}
        theme={theme}
        colorPairs={colorPairs}
        language={language}
        onSave={handleSave}
        onClose={() => {
          setModalVisible(false);
          setEditingNote(null);
        }}
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
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  tabBtnText: { fontSize: 13, fontWeight: "700" },
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

  titleInput: {
    fontSize: 18,
    fontWeight: "700",
    borderBottomWidth: 2,
    paddingVertical: 8,
    paddingHorizontal: 2,
  },

  contentInput: {
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 120,
    maxHeight: 200,
  },

  todoContainer: { gap: 8 },
  todoScroll: { maxHeight: 240 },
  sectionLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginBottom: 4, marginTop: 4 },
  doneDivider: { borderTopWidth: 1, marginTop: 8, marginBottom: 4, paddingTop: 6 },
  todoRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 5 },
  todoItemText: { fontSize: 14 },
  addTodoRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  addTodoInput: { flex: 1, fontSize: 14, paddingVertical: 8 },

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
});
