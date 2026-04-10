import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import React, { useState, useRef, useCallback, useMemo } from "react";
import { useLanguage } from "../../../context/LanguageContext";
import { useTheme } from "../../../context/ThemeContext";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useProfileScreen } from "../../../context/ProfileScreenContext";
import { BlurView } from "expo-blur";
import DateTimePickerModal from "react-native-modal-datetime-picker";

// ─── Renk seçici sabitleri ────────────────────────────────────────────────────
const COLOR_PAIRS = [
  { color: "blue", background: "blueBackground" },
  { color: "green", background: "greenBackground" },
  { color: "red", background: "redBackground" },
  { color: "orange", background: "orangeBackground" },
  { color: "yellow", background: "yellowBackground" },
  { color: "purple", background: "purpleBackground" },
  { color: "pink", background: "pinkBackground" },
  { color: "aqua", background: "aquaBackground" },
  { color: "teal", background: "tealBackground" },
];

const NOTE_CARD_W = 150;
const NOTE_CARD_H = 150;
const TODO_CARD_W = 190;
const TODO_CARD_H = 150;

// ─── Renk seçici (memo) ───────────────────────────────────────────────────────
const ColorPicker = React.memo(
  ({
    theme,
    borderColorNotes,
    setBorderColorNotes,
    setBackgroundColorNotes,
  }) => (
    <View style={styles.colorRow}>
      {COLOR_PAIRS.map(({ color, background }) => {
        const colorVal = theme.notesColor[color];
        const isSelected = borderColorNotes === colorVal;
        return (
          <TouchableOpacity
            key={color}
            onPress={() => {
              setBorderColorNotes(colorVal);
              setBackgroundColorNotes(theme.notesColor[background]);
            }}
            style={styles.colorDotWrapper}
            activeOpacity={0.7}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <View
              style={[
                styles.colorDot,
                {
                  backgroundColor: colorVal,
                  borderWidth: isSelected ? 2.5 : 0,
                  borderColor: theme.text.primary,
                  transform: [{ scale: isSelected ? 1.2 : 1 }],
                },
              ]}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  ),
);

// ─── Ana bileşen ──────────────────────────────────────────────────────────────
export default function ProfileNotes() {
  const { t } = useLanguage();
  const { theme } = useTheme();

  const {
    message,
    setMessage,
    notes,
    loadingNotes,
    isEditable,
    setIsEditable,
    formatDate,
    modalVisibleNotesAdd,
    modalVisibleNotes,
    setModalVisibleNotesAdd,
    setModalVisibleNotes,
    handleAddNote,
    handleUpdateNote,
    handleDeleteNote,
    selectedNote,
    setSelectedNote,
    setNoteContent,
    noteContent,
    backgroundColorNotes,
    borderColorNotes,
    setBorderColorNotes,
    setBackgroundColorNotes,
    noteType,
    setNoteType,
    todoItems,
    setTodoItems,
    todoTitle,
    setTodoTitle,
    scheduledDate,
    setScheduledDate,
    handleToggleTodoItem,
    handleUpdateTodoNote,
  } = useProfileScreen();

  /* ── Tab ── */
  const [activeTab, setActiveTab] = useState("note");

  /* ── Date Picker ── */
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleDateConfirm = useCallback(
    (date) => {
      const iso = date.toISOString().split("T")[0];
      setScheduledDate(iso);
      setShowDatePicker(false);
    },
    [setScheduledDate],
  );

  const formatScheduledDate = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  /* ── Kart scale animasyonları ── */
  const scaleMap = useRef({});
  const getScale = useCallback((id) => {
    if (!scaleMap.current[id]) scaleMap.current[id] = new Animated.Value(1);
    return scaleMap.current[id];
  }, []);
  const onCardPressIn = useCallback(
    (id) =>
      Animated.spring(getScale(id), {
        toValue: 0.93,
        useNativeDriver: true,
        speed: 30,
        bounciness: 2,
      }).start(),
    [getScale],
  );
  const onCardPressOut = useCallback(
    (id) =>
      Animated.spring(getScale(id), {
        toValue: 1,
        useNativeDriver: true,
        speed: 20,
        bounciness: 4,
      }).start(),
    [getScale],
  );

  /* ── View modal içi LOCAL todo düzenleme state'i ── */
  const [localEditTodos, setLocalEditTodos] = useState([]);
  const [localEditTitle, setLocalEditTitle] = useState("");
  const [localNewItemText, setLocalNewItemText] = useState("");

  /* ── View modal açıcılar ── */
  const openViewModal = useCallback(
    (note) => {
      setSelectedNote(note);
      setNoteContent(note.content || "");
      setBorderColorNotes(note.color);
      setBackgroundColorNotes(note.backgroundColor);
      setTodoTitle(note.title || "");
      // local edit state
      setLocalEditTodos((note.todos || []).map((t) => ({ ...t }))); // shallow copy
      setLocalEditTitle(note.title || "");
      setIsEditable(false);
      setModalVisibleNotes(true);
    },
    [
      setSelectedNote,
      setNoteContent,
      setBorderColorNotes,
      setBackgroundColorNotes,
      setTodoTitle,
      setIsEditable,
      setModalVisibleNotes,
    ],
  );

  const closeViewModal = useCallback(() => {
    setModalVisibleNotes(false);
    setIsEditable(false);
    setLocalNewItemText("");
  }, [setModalVisibleNotes, setIsEditable]);

  /* ── Add modal: todo satır yönetimi ── */
  const addTodoItem = useCallback(
    () =>
      setTodoItems((prev) => [
        ...prev,
        { id: Date.now().toString(), text: "", done: false },
      ]),
    [setTodoItems],
  );
  const removeTodoItem = useCallback(
    (id) => setTodoItems((prev) => prev.filter((t) => t.id !== id)),
    [setTodoItems],
  );
  const updateTodoItemText = useCallback(
    (id, text) =>
      setTodoItems((prev) =>
        prev.map((t) => (t.id === id ? { ...t, text } : t)),
      ),
    [setTodoItems],
  );

  /* ── LOCAL edit todo yönetimi (view modal içi) ── */
  const localToggleTodo = useCallback(
    (id) =>
      setLocalEditTodos((prev) =>
        prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
      ),
    [],
  );

  const localRemoveTodo = useCallback(
    (id) => setLocalEditTodos((prev) => prev.filter((t) => t.id !== id)),
    [],
  );

  const localAddTodo = useCallback(() => {
    if (!localNewItemText.trim()) return;
    setLocalEditTodos((prev) => [
      ...prev,
      { id: Date.now().toString(), text: localNewItemText.trim(), done: false },
    ]);
    setLocalNewItemText("");
  }, [localNewItemText]);

  /* ── Kaydet (todo) ── */
  const saveTodoEdits = useCallback(() => {
    if (!selectedNote) return;
    handleUpdateTodoNote(
      selectedNote.id,
      localEditTitle,
      localEditTodos,
      borderColorNotes,
      backgroundColorNotes,
    );
  }, [
    selectedNote,
    localEditTitle,
    localEditTodos,
    borderColorNotes,
    backgroundColorNotes,
    handleUpdateTodoNote,
  ]);

  /* ── Filtrelenmiş notlar ── */
  const filteredNotes = useMemo(
    () =>
      (notes || []).filter((n) =>
        activeTab === "note" ? n.type !== "todo" : n.type === "todo",
      ),
    [notes, activeTab],
  );

  /* ── Not kartı ── */
  const renderNoteCard = useCallback(
    (note) => (
      <Animated.View
        key={note.id}
        style={[
          styles.noteCard,
          {
            borderColor: note.color,
            backgroundColor: note.backgroundColor || theme.secondary,
            transform: [{ scale: getScale(note.id) }],
          },
        ]}
      >
        <TouchableOpacity
          onPressIn={() => onCardPressIn(note.id)}
          onPressOut={() => onCardPressOut(note.id)}
          activeOpacity={1}
          onPress={() => openViewModal(note)}
          style={{ flex: 1 }}
        >
          <Text
            style={[styles.noteText, { color: theme.text.primary }]}
            //numberOfLines={8}
          >
            {note.content}
          </Text>
          <Text
            style={[styles.noteDate, { color: note.color }]}
            numberOfLines={1}
          >
            {note.updatedAt !== note.createdAt
              ? `✏ ${formatDate(note.updatedAt)}`
              : formatDate(note.createdAt)}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    ),
    [theme, getScale, onCardPressIn, onCardPressOut, formatDate, openViewModal],
  );

  /* ── Todo kartı ── */
  const renderTodoCard = useCallback(
    (note) => {
      const todos = note.todos || [];
      const doneCount = todos.filter((t) => t.done).length;
      const progressPct =
        todos.length > 0 ? Math.round((doneCount / todos.length) * 100) : 0;

      return (
        <View
          key={note.id}
          style={[
            styles.todoCard,
            {
              borderColor: note.color,
              backgroundColor: note.backgroundColor || theme.secondary,
            },
          ]}
        >
          {/* Başlık + badge + 3-nokta */}
          <View style={styles.todoHeader}>
            {!!note.title && (
              <Text
                style={[styles.todoTitle, { color: note.color }]}
                numberOfLines={1}
              >
                {note.title}
              </Text>
            )}

            {/* 3-nokta → view modal'ı direkt açar */}
            <TouchableOpacity
              onPress={() => openViewModal(note)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.todoMenuBtn}
            >
              <Ionicons
                name="ellipsis-vertical"
                size={16}
                color={theme.text.muted}
              />
            </TouchableOpacity>
          </View>
          {/* Progress bar */}
          <View style={styles.todoProgressBg}>
            <View
              style={[
                styles.todoProgressFill,
                { backgroundColor: note.color, width: `${progressPct}%` },
              ]}
            />
          </View>

          {/* Maddeler */}
          <ScrollView
            style={{ maxHeight: 110 }}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            {todos.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => handleToggleTodoItem(note.id, item.id)}
                style={styles.todoItemRow}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.todoCheckbox,
                    {
                      borderColor: note.color,
                      backgroundColor: item.done ? note.color : "transparent",
                    },
                  ]}
                >
                  {item.done && (
                    <Ionicons name="checkmark" size={10} color="#fff" />
                  )}
                </View>
                <Text
                  style={[
                    styles.todoMinifiedItemText,
                    {
                      color: theme.text.primary,
                      textDecorationLine: item.done ? "line-through" : "none",
                      opacity: item.done ? 0.5 : 1,
                    },
                  ]}
                  numberOfLines={2}
                >
                  {item.text}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Ekle kısayolu → modal açıp edit modda başlatır */}
          <TouchableOpacity
            style={styles.addTodoInlineBtn}
            onPress={() => {
              openViewModal(note);
              // edit modunu setTimeout ile aç (modal animasyonu beklenir)
              setTimeout(() => setIsEditable(true), 300);
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <Ionicons name="add" size={14} color={note.color} />
              <Text
                allowFontScaling={false}
                style={[styles.addTodoInlineText, { color: note.color }]}
              >
                Ekle
              </Text>
            </View>
            <View
              style={[
                styles.todoBadge,
                {
                  backgroundColor: note.color + "33",
                  borderColor: note.color,
                },
              ]}
            >
              <Ionicons name="checkmark-done" size={10} color={note.color} />
              <Text
                allowFontScaling={false}
                style={[styles.todoBadgeText, { color: note.color }]}
              >
                {doneCount}/{todos.length}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Tarih */}
          <Text
            allowFontScaling={false}
            style={[styles.noteDate, { color: note.color, marginTop: 0 }]}
          >
            {formatDate(
              note.updatedAt !== note.createdAt
                ? note.updatedAt
                : note.createdAt,
            )}
          </Text>
        </View>
      );
    },
    [theme, formatDate, handleToggleTodoItem, openViewModal],
  );

  return (
    <View style={styles.section}>
      {/* ─── Başlık + Tab ─── */}
      <View style={styles.headerRow}>
        <Text
          allowFontScaling={false}
          style={[styles.sectionTitle, { color: theme.text.muted }]}
        >
          {t.profileScreen.Notes.notes}
        </Text>
        <View
          style={[
            styles.tabPill,
            { backgroundColor: theme.secondary, borderColor: theme.border },
          ]}
        >
          <TouchableOpacity
            onPress={() => setActiveTab("note")}
            style={[
              styles.tabBtn,
              activeTab === "note" && { backgroundColor: theme.accent },
            ]}
            activeOpacity={0.8}
          >
            <Ionicons
              name="document-text-outline"
              size={12}
              color={activeTab === "note" ? "#fff" : theme.text.muted}
            />
            <Text
              style={[
                styles.tabBtnText,
                { color: activeTab === "note" ? "#fff" : theme.text.muted },
              ]}
            >
              Not
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab("todo")}
            style={[
              styles.tabBtn,
              activeTab === "todo" && { backgroundColor: theme.accent },
            ]}
            activeOpacity={0.8}
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={12}
              color={activeTab === "todo" ? "#fff" : theme.text.muted}
            />
            <Text
              style={[
                styles.tabBtnText,
                { color: activeTab === "todo" ? "#fff" : theme.text.muted },
              ]}
            >
              Todo
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── Kart listesi ─── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Ekle butonu */}
        <TouchableOpacity
          onPress={() => {
            setNoteType(activeTab);
            setTodoItems([
              { id: Date.now().toString(), text: "", done: false },
            ]);
            setTodoTitle("");
            setMessage("");
            setScheduledDate(null);
            setModalVisibleNotesAdd(true);
          }}
          style={[
            styles.addCard,
            { borderColor: theme.border, backgroundColor: theme.secondary },
          ]}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={[theme.accent + "20", "transparent"]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <Ionicons
            name={
              activeTab === "note"
                ? "document-text-outline"
                : "checkmark-circle-outline"
            }
            size={22}
            color={theme.accent}
          />
          <Ionicons
            name="add"
            size={16}
            color={theme.accent}
            style={{ marginTop: 2 }}
          />
        </TouchableOpacity>

        {/* Notlar */}
        {loadingNotes ? (
          <ActivityIndicator
            size="small"
            color={theme.accent}
            style={{ marginLeft: 16, alignSelf: "center" }}
          />
        ) : filteredNotes.length > 0 ? (
          filteredNotes.map((note) =>
            activeTab === "note" ? renderNoteCard(note) : renderTodoCard(note),
          )
        ) : (
          <View style={styles.emptyRow}>
            <Ionicons
              name={
                activeTab === "note" ? "document-outline" : "checkbox-outline"
              }
              size={26}
              color={theme.text.muted}
            />
            <Text
              allowFontScaling={false}
              style={[styles.emptyText, { color: theme.text.muted }]}
            >
              {activeTab === "note"
                ? "Henüz not eklenmedi"
                : "Henüz todo eklenmedi"}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ──────── ADD MODAL ──────── */}
      <Modal
        animationType="slide"
        transparent
        visible={modalVisibleNotesAdd}
        onRequestClose={() => setModalVisibleNotesAdd(false)}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.modalOverlay}>
            <LinearGradient
              colors={["transparent", theme.shadow + "ee", theme.shadow]}
              style={StyleSheet.absoluteFill}
            />
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              onPress={() => setModalVisibleNotesAdd(false)}
            />

            <View
              style={[
                styles.modalBox,
                {
                  backgroundColor: backgroundColorNotes,
                  borderColor: borderColorNotes,
                  borderWidth: 2,
                },
              ]}
            >
              {/* Type tab + Zil */}
              <View style={styles.modalTopRow}>
                <View
                  style={[
                    styles.modalTypeRow,
                    {
                      backgroundColor: theme.primary + "88",
                      borderColor: theme.border,
                      //flex: 1,
                    },
                  ]}
                >
                  <TouchableOpacity
                    onPress={() => setNoteType("note")}
                    style={[
                      styles.modalTypeBtn,
                      noteType === "note" && {
                        backgroundColor: borderColorNotes,
                      },
                    ]}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="document-text-outline"
                      size={14}
                      color={noteType === "note" ? "#fff" : theme.text.muted}
                    />
                    <Text
                      style={[
                        styles.modalTypeBtnText,
                        {
                          color:
                            noteType === "note" ? "#fff" : theme.text.muted,
                        },
                      ]}
                    >
                      Not
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setNoteType("todo")}
                    style={[
                      styles.modalTypeBtn,
                      noteType === "todo" && {
                        backgroundColor: borderColorNotes,
                      },
                    ]}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={14}
                      color={noteType === "todo" ? "#fff" : theme.text.muted}
                    />
                    <Text
                      style={[
                        styles.modalTypeBtnText,
                        {
                          color:
                            noteType === "todo" ? "#fff" : theme.text.muted,
                        },
                      ]}
                    >
                      Todo
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* 🔔 Zil (Tarih Seç) */}
                <TouchableOpacity
                  onPress={() => setShowDatePicker(true)}
                  style={[
                    styles.bellBtn,
                    scheduledDate
                      ? { backgroundColor: borderColorNotes + "33" }
                      : {},
                  ]}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Ionicons
                    name={
                      scheduledDate ? "notifications" : "notifications-outline"
                    }
                    size={20}
                    color={scheduledDate ? borderColorNotes : theme.text.muted}
                  />
                </TouchableOpacity>
              </View>

              {/* Seçilen tarih gösterimi */}
              {scheduledDate && (
                <View
                  style={[
                    styles.scheduledDateRow,
                    {
                      borderColor: borderColorNotes + "55",
                      backgroundColor: borderColorNotes + "11",
                    },
                  ]}
                >
                  <Ionicons
                    name="calendar"
                    size={13}
                    color={borderColorNotes}
                  />
                  <Text
                    style={[
                      styles.scheduledDateText,
                      { color: borderColorNotes },
                    ]}
                  >
                    {formatScheduledDate(scheduledDate)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setScheduledDate(null)}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  >
                    <Ionicons
                      name="close-circle"
                      size={15}
                      color={borderColorNotes}
                    />
                  </TouchableOpacity>
                </View>
              )}

              {/* İçerik */}
              {noteType === "note" ? (
                <TextInput
                  style={[
                    styles.addInput,
                    {
                      color: theme.text.primary,
                      borderColor: theme.border + "55",
                    },
                  ]}
                  multiline
                  placeholder="Notunu yaz..."
                  placeholderTextColor={theme.text.muted}
                  value={message}
                  onChangeText={setMessage}
                />
              ) : (
                <View>
                  <TextInput
                    style={[
                      styles.todoTitleInput,
                      {
                        color: theme.text.primary,
                        borderColor: borderColorNotes,
                      },
                    ]}
                    placeholder="Başlık (opsiyonel)"
                    placeholderTextColor={theme.text.muted}
                    value={todoTitle}
                    onChangeText={setTodoTitle}
                    returnKeyType="next"
                    maxLength={40}
                  />
                  <ScrollView
                    style={{ maxHeight: 200 }}
                    showsVerticalScrollIndicator={false}
                  >
                    {todoItems.map((item, idx) => (
                      <View key={item.id} style={styles.addTodoRow}>
                        <View
                          style={[
                            styles.addTodoBullet,
                            { backgroundColor: borderColorNotes },
                          ]}
                        />
                        <TextInput
                          style={[
                            styles.addTodoInput,
                            {
                              color: theme.text.primary,
                              borderColor: borderColorNotes + "55",
                            },
                          ]}
                          placeholder={`Madde ${idx + 1}`}
                          placeholderTextColor={theme.text.muted}
                          value={item.text}
                          onChangeText={(txt) =>
                            updateTodoItemText(item.id, txt)
                          }
                          returnKeyType="next"
                          onSubmitEditing={addTodoItem}
                        />
                        {todoItems.length > 1 && (
                          <TouchableOpacity
                            onPress={() => removeTodoItem(item.id)}
                            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                          >
                            <Ionicons
                              name="close-circle"
                              size={18}
                              color={theme.text.muted}
                            />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                    <TouchableOpacity
                      onPress={addTodoItem}
                      style={styles.addMoreBtn}
                    >
                      <Ionicons
                        name="add-circle-outline"
                        size={16}
                        color={borderColorNotes}
                      />
                      <Text
                        style={[
                          styles.addMoreText,
                          { color: borderColorNotes },
                        ]}
                      >
                        Madde ekle
                      </Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              )}

              <ColorPicker
                theme={theme}
                borderColorNotes={borderColorNotes}
                setBorderColorNotes={setBorderColorNotes}
                setBackgroundColorNotes={setBackgroundColorNotes}
              />
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: borderColorNotes }]}
              onPress={handleAddNote}
              activeOpacity={0.85}
            >
              <Ionicons name="save-outline" size={16} color="#fff" />
              <Text allowFontScaling={false} style={styles.saveBtnText}>
                {t.profileScreen.Notes.notesSave || "Kaydet"}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* DateTimePicker */}
      <DateTimePickerModal
        isVisible={showDatePicker}
        mode="date"
        minimumDate={new Date()}
        onConfirm={handleDateConfirm}
        onCancel={() => setShowDatePicker(false)}
        locale="tr"
        confirmTextIOS="Seç"
        cancelTextIOS="İptal"
      />

      {/* ──────── VIEW / EDIT MODAL ──────── */}
      <Modal
        animationType="slide"
        transparent
        visible={modalVisibleNotes}
        onRequestClose={closeViewModal}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.modalOverlay}>
            <LinearGradient
              colors={["transparent", theme.shadow + "ee", theme.shadow]}
              style={StyleSheet.absoluteFill}
            />
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              onPress={closeViewModal}
            />

            {selectedNote && (
              <>
                <View
                  style={[
                    styles.modalBox,
                    {
                      borderColor: borderColorNotes,
                      borderWidth: 2,
                      overflow: "hidden",
                      backgroundColor: theme.secondary,
                    },
                  ]}
                >
                  <BlurView
                    tint="dark"
                    intensity={60}
                    experimentalBlurMethod="dimezisBlurView"
                    style={StyleSheet.absoluteFill}
                  />

                  {/* ── TODO VIEW / EDIT ── */}
                  {selectedNote.type === "todo" ? (
                    <View>
                      {/* Başlık */}
                      {isEditable ? (
                        <TextInput
                          style={[
                            styles.todoTitleInput,
                            {
                              color: theme.text.primary,
                              borderColor: borderColorNotes,
                              marginBottom: 8,
                            },
                          ]}
                          placeholder="Başlık..."
                          placeholderTextColor={theme.text.muted}
                          value={localEditTitle}
                          onChangeText={setLocalEditTitle}
                          maxLength={40}
                        />
                      ) : (
                        !!selectedNote.title && (
                          <Text
                            style={[
                              styles.todoModalTitle,
                              { color: borderColorNotes },
                            ]}
                          >
                            {selectedNote.title}
                          </Text>
                        )
                      )}

                      {/* Progress bar */}
                      {(() => {
                        const src = isEditable
                          ? localEditTodos
                          : selectedNote.todos || [];
                        const done = src.filter((t) => t.done).length;
                        const pct =
                          src.length > 0
                            ? Math.round((done / src.length) * 100)
                            : 0;
                        return (
                          <View
                            style={[styles.todoProgressBg, { marginBottom: 8 }]}
                          >
                            <View
                              style={[
                                styles.todoProgressFill,
                                {
                                  backgroundColor: borderColorNotes,
                                  width: `${pct}%`,
                                },
                              ]}
                            />
                          </View>
                        );
                      })()}

                      {/* Todo maddeler */}
                      <ScrollView
                        style={{ maxHeight: 220 }}
                        showsVerticalScrollIndicator={false}
                      >
                        {(isEditable
                          ? localEditTodos
                          : selectedNote.todos || []
                        ).map((item) => (
                          <View key={item.id} style={styles.todoItemRow}>
                            <TouchableOpacity
                              onPress={() =>
                                isEditable
                                  ? localToggleTodo(item.id)
                                  : handleToggleTodoItem(
                                      selectedNote.id,
                                      item.id,
                                    )
                              }
                              activeOpacity={0.7}
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                flex: 1,
                                gap: 10,
                              }}
                            >
                              <View
                                style={[
                                  styles.todoCheckbox,
                                  {
                                    borderColor: borderColorNotes,
                                    backgroundColor: item.done
                                      ? borderColorNotes
                                      : "transparent",
                                  },
                                ]}
                              >
                                {item.done && (
                                  <Ionicons
                                    name="checkmark"
                                    size={10}
                                    color="#fff"
                                  />
                                )}
                              </View>
                              <Text
                                style={[
                                  styles.todoItemText,
                                  {
                                    color: theme.text.primary,
                                    textDecorationLine: item.done
                                      ? "line-through"
                                      : "none",
                                    opacity: item.done ? 0.5 : 1,
                                  },
                                ]}
                              >
                                {item.text}
                              </Text>
                            </TouchableOpacity>
                            {/* Edit modda silme butonu */}
                            {isEditable && (
                              <TouchableOpacity
                                onPress={() => localRemoveTodo(item.id)}
                                hitSlop={{
                                  top: 6,
                                  bottom: 6,
                                  left: 6,
                                  right: 6,
                                }}
                                style={styles.todoDeleteBtn}
                              >
                                <Ionicons
                                  name="close-circle"
                                  size={18}
                                  color="#ef4444"
                                />
                              </TouchableOpacity>
                            )}
                          </View>
                        ))}
                      </ScrollView>

                      {/* Edit modda yeni madde ekleme */}
                      {isEditable && (
                        <View style={[styles.inlineRow, { marginTop: 6 }]}>
                          <TextInput
                            style={[
                              styles.inlineInput,
                              {
                                color: theme.text.primary,
                                borderColor: borderColorNotes,
                                flex: 1,
                              },
                            ]}
                            value={localNewItemText}
                            onChangeText={setLocalNewItemText}
                            placeholder="Yeni madde..."
                            placeholderTextColor={theme.text.muted}
                            returnKeyType="done"
                            onSubmitEditing={localAddTodo}
                          />
                          <TouchableOpacity
                            onPress={localAddTodo}
                            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                          >
                            <Ionicons
                              name="add-circle"
                              size={24}
                              color={borderColorNotes}
                            />
                          </TouchableOpacity>
                        </View>
                      )}

                      {/* Renk seçici (her iki modda) */}
                      <ColorPicker
                        theme={theme}
                        borderColorNotes={borderColorNotes}
                        setBorderColorNotes={setBorderColorNotes}
                        setBackgroundColorNotes={setBackgroundColorNotes}
                      />
                    </View>
                  ) : (
                    /* ── NOT VIEW / EDIT ── */
                    <>
                      <TextInput
                        style={[
                          styles.addInput,
                          {
                            color: theme.text.primary,
                            borderColor: theme.border + "33",
                          },
                        ]}
                        multiline
                        editable={isEditable}
                        placeholder="Not içeriği..."
                        placeholderTextColor={theme.text.muted}
                        value={noteContent}
                        onChangeText={setNoteContent}
                      />
                      <View style={styles.toolRow}>
                        <TouchableOpacity
                          onPress={() => setIsEditable(!isEditable)}
                          style={styles.toolBtn}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <FontAwesome
                            name="pencil-square"
                            size={20}
                            color={
                              isEditable
                                ? theme.colors?.green || "#4ade80"
                                : borderColorNotes
                            }
                          />
                        </TouchableOpacity>
                        <ColorPicker
                          theme={theme}
                          borderColorNotes={borderColorNotes}
                          setBorderColorNotes={setBorderColorNotes}
                          setBackgroundColorNotes={setBackgroundColorNotes}
                        />
                      </View>
                    </>
                  )}

                  {/* Tarihler */}
                  <View style={styles.dateRow}>
                    <Text
                      style={[styles.noteDate, { color: theme.text.muted }]}
                    >
                      Oluşturuldu: {formatDate(selectedNote.createdAt)}
                    </Text>
                    {selectedNote.updatedAt !== selectedNote.createdAt && (
                      <Text
                        style={[
                          styles.noteDate,
                          { color: theme.text.muted, fontStyle: "italic" },
                        ]}
                      >
                        Düzenlendi: {formatDate(selectedNote.updatedAt)}
                      </Text>
                    )}
                  </View>
                </View>

                {/* ── Alt aksiyon butonları ── */}
                <View style={styles.actionRow}>
                  {selectedNote.type === "todo" ? (
                    /* TODO aksiyonları */
                    isEditable ? (
                      /* Edit modu: Kaydet | Sil */
                      <>
                        <TouchableOpacity
                          style={[
                            styles.actionBtn,
                            { backgroundColor: borderColorNotes },
                          ]}
                          onPress={saveTodoEdits}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="save" size={15} color="#fff" />
                          <Text
                            allowFontScaling={false}
                            style={styles.actionBtnText}
                          >
                            Kaydet
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.actionBtn,
                            { backgroundColor: "#ef4444" },
                          ]}
                          onPress={() => handleDeleteNote(selectedNote.id)}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="trash" size={15} color="#fff" />
                          <Text
                            allowFontScaling={false}
                            style={styles.actionBtnText}
                          >
                            {t.profileScreen.Notes.notesDelete || "Sil"}
                          </Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      /* View modu: Düzenle | Sil */
                      <>
                        <TouchableOpacity
                          style={[
                            styles.actionBtn,
                            { backgroundColor: borderColorNotes },
                          ]}
                          onPress={() => setIsEditable(true)}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="pencil" size={15} color="#fff" />
                          <Text
                            allowFontScaling={false}
                            style={styles.actionBtnText}
                          >
                            {t.profileScreen.Notes.notesEdit || "Düzenle"}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.actionBtn,
                            { backgroundColor: "#ef4444" },
                          ]}
                          onPress={() => handleDeleteNote(selectedNote.id)}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="trash" size={15} color="#fff" />
                          <Text
                            allowFontScaling={false}
                            style={styles.actionBtnText}
                          >
                            {t.profileScreen.Notes.notesDelete || "Sil"}
                          </Text>
                        </TouchableOpacity>
                      </>
                    )
                  ) : (
                    /* NOT aksiyonları: Düzenle | Kaydet | Sil */
                    <>
                      <TouchableOpacity
                        style={[
                          styles.actionBtn,
                          { backgroundColor: borderColorNotes },
                        ]}
                        onPress={() => setIsEditable(!isEditable)}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="pencil" size={15} color="#fff" />
                        <Text
                          allowFontScaling={false}
                          style={styles.actionBtnText}
                        >
                          {t.profileScreen.Notes.notesEdit || "Düzenle"}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.actionBtn,
                          { backgroundColor: borderColorNotes },
                        ]}
                        onPress={() => handleUpdateNote(selectedNote.id)}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="save" size={15} color="#fff" />
                        <Text
                          allowFontScaling={false}
                          style={styles.actionBtnText}
                        >
                          {t.profileScreen.Notes.notesSave || "Kaydet"}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.actionBtn,
                          { backgroundColor: "#ef4444" },
                        ]}
                        onPress={() => handleDeleteNote(selectedNote.id)}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="trash" size={15} color="#fff" />
                        <Text
                          allowFontScaling={false}
                          style={styles.actionBtnText}
                        >
                          {t.profileScreen.Notes.notesDelete || "Sil"}
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { width: "100%", marginBottom: 10 },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 13, textTransform: "uppercase", letterSpacing: 1 },

  tabPill: {
    flexDirection: "row",
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    padding: 2,
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 18,
  },
  tabBtnText: { fontSize: 11, fontWeight: "600" },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 10,
    flexDirection: "row",
    alignItems: "flex-start",
  },

  addCard: {
    width: 70,
    height: NOTE_CARD_H,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },

  /* Not kartı */
  noteCard: {
    width: NOTE_CARD_W,
    maxHeight: NOTE_CARD_H,
    paddingTop: 5,
    paddingHorizontal: 8,
    paddingBottom: 15,
    borderRadius: 14,
    borderBottomRightRadius: 28,
    borderBottomWidth: 10,
    borderWidth: 1,
    position: "relative",
  },
  dogEar: {
    position: "absolute",
    right: -10,
    bottom: -10,
    width: 0,
    height: 0,
    borderBottomWidth: 20,
    borderRightWidth: 20,
    borderTopColor: "transparent",
    borderLeftColor: "transparent",
    borderBottomRightRadius: 14,
  },
  noteText: { fontSize: 11, lineHeight: 14 },
  noteDate: { fontSize: 8, fontStyle: "italic", marginTop: 2 },

  /* Todo kartı */
  todoCard: {
    width: NOTE_CARD_W,
    maxHeight: NOTE_CARD_H,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: 10,
    paddingTop: 3,
    gap: 2,
  },
  todoProgressBg: {
    height: 3,
    backgroundColor: "#ffffff22",
    borderRadius: 4,
    overflow: "hidden",
  },
  todoProgressFill: { height: "100%", borderRadius: 4 },
  todoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  todoHeaderLeft: { flex: 1, gap: 4, paddingRight: 6 },
  todoTitle: { fontSize: 12, fontWeight: "700", letterSpacing: 0.3 },
  todoMenuBtn: {
    width: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  todoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 4,
    paddingVertical: 0,
    borderRadius: 10,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  todoBadgeText: { fontSize: 10, fontWeight: "700" },
  todoItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginVertical: 2,
  },
  todoCheckbox: {
    width: 10,
    height: 10,
    borderRadius: 3,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  todoItemText: { fontSize: 14, fontWeight: "500", flex: 1, lineHeight: 14 },
  todoMinifiedItemText: { fontSize: 10, flex: 1, lineHeight: 10 },
  todoDeleteBtn: { padding: 2 },
  inlineRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  inlineInput: { fontSize: 12, borderBottomWidth: 1, paddingVertical: 3 },
  addTodoInlineBtn: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 3,
    marginTop: 0,
    opacity: 0.75,
  },
  addTodoInlineText: { fontSize: 11, fontWeight: "600" },

  emptyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 10,
    alignSelf: "center",
  },
  emptyText: { fontSize: 13 },

  /* Modal */
  modalOverlay: { flex: 1, justifyContent: "flex-end", alignItems: "center" },
  modalBox: {
    width: "95%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 4,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  modalTypeRow: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    alignSelf: "center",
  },
  modalTypeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 12,
  },
  modalTypeBtnText: { fontSize: 13, fontWeight: "600" },

  /* Input */
  addInput: {
    maxHeight: 200,
    fontSize: 14,
    lineHeight: 20,
    padding: 6,
    borderBottomWidth: 1,
  },
  todoTitleInput: {
    fontSize: 14,
    fontWeight: "700",
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 1.5,
    marginBottom: 10,
  },
  todoModalTitle: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
    marginBottom: 6,
  },

  addTodoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  addTodoBullet: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  addTodoInput: {
    flex: 1,
    fontSize: 14,
    borderBottomWidth: 1,
    paddingVertical: 4,
  },
  addMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    opacity: 0.75,
  },
  addMoreText: { fontSize: 13, fontWeight: "600" },

  colorRow: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
  },
  colorDotWrapper: { padding: 4 },
  colorDot: { width: 22, height: 22, borderRadius: 11 },

  saveBtn: {
    width: "95%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginBottom: 10,
    elevation: 4,
  },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  actionRow: {
    flexDirection: "row",
    width: "95%",
    marginBottom: 10,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: "hidden",
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 14,
  },
  actionBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  toolRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    justifyContent: "center",
  },
  toolBtn: { padding: 4 },
  dateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 4,
  },

  /* Tarih seçici */
  modalTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  bellBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  scheduledDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: -4,
  },
  scheduledDateText: {
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },
});
