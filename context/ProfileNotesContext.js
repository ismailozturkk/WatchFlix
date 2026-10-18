import React, {
  createContext, useContext, useState, useMemo,
} from "react";
import { useAuth } from "./AuthContext";
import { useTheme } from "./ThemeContext";
import { useLanguage } from "./LanguageContext";
import Toast from "@components/AppToast";
import { i18nText } from "../utils/i18nText";
import { addTodoOnTop, toggleTodoItem } from "../utils/todoOrder";
import { usePremiumGate } from "../hooks/usePremiumGate";
import useUserDataDomain from "../hooks/useUserDataDomain";
import { notesDomain } from "../services/userData";


const ProfileNotesContext = createContext();
export const useProfileNotes = () => useContext(ProfileNotesContext);

export const ProfileNotesProvider = ({ children }) => {
  const { user } = useAuth();
  const uid = user?.uid;
  const { theme } = useTheme();
  const { language } = useLanguage();

  // YEREL-ÖNCELİKLİ: notlar buluttan dinlenmez. Okuma yerel kopyadan SENKRON
  // (ilk karede dolu), yazma önce yerelde + kalıcı günlükte, buluta arka planda.
  // Buluttan çekim yalnız yerel kopya yokken TEK SEFER (yeni cihaz, sıfırlama,
  // hesap değişimi). Bkz. services/userData ve docs/mimari/YEREL_ONCELIKLI_VERI_KATMANI.md
  const view = useUserDataDomain(notesDomain);
  const notes = view.lists.items;
  // Yalnız tek seferlik indirme sürerken "yükleniyor": normal açılışta hep false.
  const loadingNotes = !view.ready && view.hydrating;

  /** Bir notun GÜNCEL hâli (bayat kapanış riski yok: motorun senkron görünümü). */
  const currentNote = (noteId) => notesDomain.getSnapshot(uid).get("items", noteId);
  const writeNote = (note) => notesDomain.apply(uid, [{ kind: "items", doc: note }]);

  const [selectedNote,        setSelectedNote]        = useState(null);
  const [noteContent,         setNoteContent]         = useState("");
  const [message,             setMessage]             = useState("");
  const [modalVisibleNotesAdd, setModalVisibleNotesAdd] = useState(false);
  const [modalVisibleNotes,    setModalVisibleNotes]    = useState(false);
  const [isEditable,           setIsEditable]           = useState(false);
  const [borderColorNotes,     setBorderColorNotes]     = useState(theme.border);
  const [backgroundColorNotes, setBackgroundColorNotes] = useState(theme.secondary);
  const [noteType,   setNoteType]   = useState("note");
  const [todoItems,  setTodoItems]  = useState([{ id: Date.now().toString(), text: "", done: false }]);
  const [todoTitle,  setTodoTitle]  = useState("");
  const [scheduledDate, setScheduledDate] = useState(null);

  // Not ve yapılacak SAYISI ücretsiz planda sınırlı (registry: notes, todos).
  // Yalnız YENİ kayıt sayılır; düzenlemek ve silmek hiçbir zaman engellenmez,
  // abonelik bitince mevcut kayıtlar da silinmez. `type` alanı olmayan eski
  // kayıtlar not sayılır (NotesScreen ile aynı kural).
  const notesGate = usePremiumGate("notes");
  const todosGate = usePremiumGate("todos");
  const noteCounts = useMemo(() => {
    let todo = 0;
    for (const n of notes) if (n?.type === "todo") todo += 1;
    return { note: notes.length - todo, todo };
  }, [notes]);
  const gateFor = (type) => (type === "todo" ? todosGate : notesGate);
  const countFor = (type) => (type === "todo" ? noteCounts.todo : noteCounts.note);
  /** Bu tipte yeni kayıt açılabilir mi? (Sessiz; uyarı göstermez.) */
  const canCreateNote = (type) => gateFor(type).allows(countFor(type));
  /** Açılabilirse true; doluysa yükseltme sayfasını gösterip false döner. */
  const checkCanCreateNote = (type, options) =>
    gateFor(type).check(countFor(type), options);

  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return typeof timestamp === "string" ? timestamp : "Bilinmeyen Tarih";
    return new Intl.DateTimeFormat(language, { day: "numeric", month: "long", year: "numeric" }).format(date);
  };

  // Eski şema göçü (Notes/{uid}.notes[]) artık tek seferlik indirmenin içinde:
  // services/userData/domains.js → fetchNotesFromCloud.

  const handleAddNote = async () => {
    try {
      if (!uid) {
        Toast.show({ type: "error", text1: i18nText("autoI18n.not_eklenemedi", "Not eklenemedi") });
        return;
      }
      if (noteType === "note" && message.trim().length === 0) {
        Toast.show({ type: "warning", text1: i18nText("autoI18n.bos_not_olusturulamaz", "Boş not oluşturulamaz") }); return;
      }
      if (noteType === "todo" && todoItems.every((t) => t.text.trim() === "")) {
        Toast.show({ type: "warning", text1: i18nText("autoI18n.en_az_bir_todo_maddesi_girin", "En az bir yapılacak madde girin") }); return;
      }

      const newId = Date.now().toString();
      const newNote = {
        id: newId, type: noteType,
        title:   noteType === "todo" ? todoTitle.trim() : "",
        content: noteType === "note" ? message : "",
        todos:   noteType === "todo" ? todoItems.filter((t) => t.text.trim() !== "") : [],
        color: borderColorNotes, backgroundColor: backgroundColorNotes,
        scheduledDate: scheduledDate || null, createdAt: Date.now(), updatedAt: Date.now(),
      };

      // Yerel kopya + kalıcı günlük ANINDA; buluta arka planda gider. Ağ
      // hatası artık kullanıcıya hata olarak yansımaz (çevrimdışıyken de kayıt çalışır).
      writeNote(newNote);
      setMessage(""); setTodoTitle("");
      setTodoItems([{ id: Date.now().toString(), text: "", done: false }]);
      setScheduledDate(null); setModalVisibleNotesAdd(false);
    } catch (err) { Toast.show({ type: "error", text1: i18nText("autoI18n.not_eklenemedi", "Not eklenemedi"), text2: err.message }); }
  };

  // Aşağıdaki işleyicilerde DEĞİŞİKLİK TAM BELGE olarak yazılır (kısmi updateDoc
  // değil): yerel kopya belgenin tamamını taşıyor ve `set` belge bulutta
  // silinmişse bile çalışır; `updateDoc` "not-found" ile düşerdi.
  const handleToggleTodoItem = async (noteId, todoId) => {
    const applyToggle = (n) =>
      n.id !== noteId ? n : {
        ...n,
        todos: toggleTodoItem(n.todos, todoId),
        updatedAt: Date.now(),
      };

    try {
      const note = currentNote(noteId);
      if (!note) return;
      writeNote(applyToggle(note));
      setSelectedNote((prev) => prev && prev.id === noteId ? applyToggle(prev) : prev);
    } catch (err) { Toast.show({ type: "error", text1: i18nText("autoI18n.todo_guncellenemedi", "Todo güncellenemedi") }); }
  };

  const handleAddTodoItem = async (noteId, newItemText) => {
    if (!newItemText.trim()) return;
    const newItem = { id: Date.now().toString(), text: newItemText.trim(), done: false };

    const applyAdd = (n) =>
      n.id !== noteId ? n : {
        ...n, todos: addTodoOnTop(n.todos, newItem), updatedAt: Date.now(),
      };

    try {
      const note = currentNote(noteId);
      if (!note) return;
      writeNote(applyAdd(note));
      setSelectedNote((prev) => prev && prev.id === noteId ? applyAdd(prev) : prev);
    } catch (err) { Toast.show({ type: "error", text1: i18nText("autoI18n.madde_eklenemedi", "Madde eklenemedi") }); }
  };

  const handleDeleteTodoItem = async (noteId, todoId) => {
    const applyDelete = (n) =>
      n.id !== noteId ? n : {
        ...n, todos: (n.todos || []).filter((t) => t.id !== todoId), updatedAt: Date.now(),
      };

    try {
      const note = currentNote(noteId);
      if (!note) return;
      writeNote(applyDelete(note));
      setSelectedNote((prev) => prev && prev.id === noteId ? applyDelete(prev) : prev);
    } catch (err) { Toast.show({ type: "error", text1: i18nText("autoI18n.madde_silinemedi", "Madde silinemedi") }); }
  };

  const handleUpdateNote = async (noteId) => {
    const now = Date.now();
    const applyUpdate = (n) =>
      n.id !== noteId ? n : {
        ...n,
        content: n.type === "note" ? noteContent : n.content,
        title:   n.type === "todo" ? todoTitle.trim() : n.title,
        color: borderColorNotes,
        backgroundColor: backgroundColorNotes,
        scheduledDate: scheduledDate !== undefined ? scheduledDate : (n.scheduledDate || null),
        updatedAt: now,
      };

    try {
      const note = currentNote(noteId);
      if (note) writeNote(applyUpdate(note));
      setSelectedNote((prev) => prev && prev.id === noteId ? applyUpdate(prev) : prev);
      setModalVisibleNotes(false); setIsEditable(false);
    } catch (err) { Toast.show({ type: "error", text1: i18nText("autoI18n.not_guncellenemedi", "Not güncellenemedi") }); }
  };

  const handleUpdateTodoNote = async (noteId, newTitle, newTodos, newColor, newBg) => {
    const now = Date.now();
    const applyUpdate = (n) =>
      n.id !== noteId ? n : {
        ...n,
        title: (newTitle || "").trim(), todos: newTodos,
        color: newColor || borderColorNotes,
        backgroundColor: newBg || backgroundColorNotes,
        scheduledDate: scheduledDate !== undefined ? scheduledDate : (n.scheduledDate || null),
        updatedAt: now,
      };

    try {
      const note = currentNote(noteId);
      if (note) writeNote(applyUpdate(note));
      setSelectedNote((prev) => prev && prev.id === noteId ? applyUpdate(prev) : prev);
      setModalVisibleNotes(false); setIsEditable(false);
    } catch (err) { Toast.show({ type: "error", text1: i18nText("autoI18n.not_guncellenemedi", "Not güncellenemedi") }); }
  };

  const handleDeleteNote = async (noteId) => {
    try {
      if (uid) notesDomain.apply(uid, [{ kind: "items", key: noteId }]);
      setSelectedNote(null);
      setModalVisibleNotes(false);
    } catch (err) { Toast.show({ type: "error", text1: i18nText("autoI18n.not_silinemedi", "Not silinemedi") }); }
  };

  // Sabitle / sabitlemeyi kaldır. `updatedAt`'e BİLEREK dokunmaz: sabitlemek bir
  // düzenleme değil — kartın "son düzenleme" tarihi ve grup içi sırası bozulmasın.
  const handleTogglePin = async (noteId) => {
    if (!uid) return;
    const current = currentNote(noteId);
    if (!current) return;
    const pinned = !current.pinned;

    try {
      writeNote({ ...current, pinned });
      setSelectedNote((prev) => (prev && prev.id === noteId ? { ...prev, pinned } : prev));
    } catch (err) {
      Toast.show({ type: "error", text1: i18nText("autoI18n.not_guncellenemedi", "Not güncellenemedi") });
    }
  };

  /**
   * Tek noktadan upsert (ekle veya güncelle). Yeni NotesScreen (IslamicGuide
   * düzeni) bunu kullanır: tam not objesini alır, createdAt/updatedAt'i ayarlar,
   * yerel kopyaya yazar (buluta arka planda gider). Hem "note" hem "todo" için çalışır.
   */
  const saveNote = async (note) => {
    if (!uid || !note?.id) return false;
    const now = Date.now();
    const existingNote = currentNote(note.id);
    const exists = !!existingNote;
    const requestedType = note.type === "todo" ? "todo" : "note";
    // Son savunma hattı: ekranlar limiti zaten açılışta/tip seçerken denetler,
    // ama başka cihazdan eklenen kayıt sayıyı aradan değiştirmiş olabilir.
    // Editör bir Modal'dır; yükseltme sayfasını üstüne açamayız, bu yüzden toast.
    if (!exists && !canCreateNote(requestedType)) {
      Toast.show({
        type: "warning",
        text1:
          language === "tr"
            ? requestedType === "todo"
              ? "Yapılacaklar limitin doldu"
              : "Not limitin doldu"
            : requestedType === "todo"
              ? "You've reached your to-do limit"
              : "You've reached your notes limit",
      });
      return false;
    }
    const existingType = existingNote
      ? existingNote.type === "todo" ? "todo" : "note"
      : null;
    // Düzenlenen bir belge Not ↔ Todo arasında dönüştürülemez. UI yanlışlıkla
    // farklı tip gönderse bile mevcut tipe ait içerik/maddeler korunur.
    const typeChangeBlocked = !!existingNote && requestedType !== existingType;
    const finalNote = {
      ...note,
      type: typeChangeBlocked ? existingType : requestedType,
      ...(typeChangeBlocked
        ? {
            title: existingNote.title || "",
            content: existingNote.content || "",
            todos: existingNote.todos || [],
            scheduledDate: existingNote.scheduledDate || null,
          }
        : {}),
      createdAt: note.createdAt || now,
      updatedAt: now,
    };

    try {
      writeNote(finalNote);
      setSelectedNote((prev) => (prev && prev.id === note.id ? finalNote : prev));
      return true;
    } catch (err) {
      Toast.show({ type: "error", text1: i18nText("autoI18n.not_kaydedilemedi", "Not kaydedilemedi") });
      return false;
    }
  };

  const value = useMemo(() => ({
    notes, loadingNotes, selectedNote, setSelectedNote,
    noteContent, setNoteContent, message, setMessage,
    modalVisibleNotesAdd, setModalVisibleNotesAdd,
    modalVisibleNotes, setModalVisibleNotes,
    isEditable, setIsEditable,
    borderColorNotes, setBorderColorNotes,
    backgroundColorNotes, setBackgroundColorNotes,
    noteType, setNoteType, todoItems, setTodoItems,
    todoTitle, setTodoTitle, scheduledDate, setScheduledDate,
    handleAddNote, handleUpdateNote, handleDeleteNote, saveNote, handleTogglePin,
    handleToggleTodoItem, handleAddTodoItem, handleDeleteTodoItem, handleUpdateTodoNote,
    formatDate,
    noteCounts, canCreateNote, checkCanCreateNote,
  }), [
    notes, loadingNotes, selectedNote, noteContent, message,
    modalVisibleNotesAdd, modalVisibleNotes, isEditable,
    borderColorNotes, backgroundColorNotes,
    noteType, todoItems, todoTitle, scheduledDate, language, uid,
    noteCounts, notesGate, todosGate,
  ]);

  return (
    <ProfileNotesContext.Provider value={value}>
      {children}
    </ProfileNotesContext.Provider>
  );
};
