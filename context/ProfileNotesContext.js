import React, {
  createContext, useContext, useEffect, useState, useMemo, useRef,
} from "react";
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, onSnapshot, writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./AuthContext";
import { useTheme } from "./ThemeContext";
import { useLanguage } from "./LanguageContext";
import Toast from "react-native-toast-message";

const ProfileNotesContext = createContext();
export const useProfileNotes = () => useContext(ProfileNotesContext);

export const ProfileNotesProvider = ({ children }) => {
  const { user } = useAuth();
  const uid = user?.uid;
  const { theme } = useTheme();
  const { language } = useLanguage();

  const [notes,               setNotes]               = useState([]);
  const [loadingNotes,        setLoadingNotes]        = useState(false);
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

  // Keep a ref so async handlers always read the latest notes without stale closures
  const notesRef = useRef([]);
  useEffect(() => { notesRef.current = notes; }, [notes]);

  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return typeof timestamp === "string" ? timestamp : "Bilinmeyen Tarih";
    return new Intl.DateTimeFormat(language, { day: "numeric", month: "long", year: "numeric" }).format(date);
  };

  const itemsCol = (u) => collection(db, "Notes", u, "items");
  const itemDoc  = (u, noteId) => doc(db, "Notes", u, "items", noteId);

  // Migrate old Notes/{uid}.notes array → Notes/{uid}/items subcollection
  const migrateOldNotes = async (u, oldNotes) => {
    try {
      const batch = writeBatch(db);
      oldNotes.forEach((note) => {
        batch.set(doc(db, "Notes", u, "items", note.id), note);
      });
      await batch.commit();
    } catch (err) {
      console.error("Migration error:", err);
    }
  };

  useEffect(() => {
    if (!uid) return;
    setLoadingNotes(true);

    const unsub = onSnapshot(
      itemsCol(uid),
      async (snap) => {
        if (snap.empty) {
          // Dual read: check old array and migrate if present
          try {
            const oldDoc = await getDoc(doc(db, "Notes", uid));
            if (oldDoc.exists()) {
              const oldNotes = oldDoc.data().notes || [];
              if (oldNotes.length > 0) {
                await migrateOldNotes(uid, oldNotes);
                // onSnapshot will fire again with migrated data
                return;
              }
            }
          } catch (err) {
            console.error("Error checking old notes:", err);
          }
          setNotes([]);
          setLoadingNotes(false);
        } else {
          const fetched = snap.docs
            .map((d) => ({ ...d.data(), id: d.id }))
            .sort((a, b) => b.createdAt - a.createdAt);
          setNotes(fetched);
          setLoadingNotes(false);
        }
      },
      (err) => {
        console.error("Notes snapshot error:", err);
        setLoadingNotes(false);
      },
    );

    return () => unsub();
  }, [uid]);

  const handleAddNote = async () => {
    try {
      if (noteType === "note" && message.trim().length === 0) {
        Toast.show({ type: "warning", text1: "Boş not oluşturulamaz" }); return;
      }
      if (noteType === "todo" && todoItems.every((t) => t.text.trim() === "")) {
        Toast.show({ type: "warning", text1: "En az bir todo maddesi giriniz" }); return;
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

      // Optimistic update
      setNotes((prev) => [newNote, ...prev]);
      setMessage(""); setTodoTitle("");
      setTodoItems([{ id: Date.now().toString(), text: "", done: false }]);
      setScheduledDate(null); setModalVisibleNotesAdd(false);

      await setDoc(itemDoc(uid, newId), newNote);
    } catch (err) { Toast.show({ type: "error", text1: "Not eklenemedi", text2: err.message }); }
  };

  const handleToggleTodoItem = async (noteId, todoId) => {
    const applyToggle = (n) =>
      n.id !== noteId ? n : {
        ...n,
        todos: (n.todos || []).map((t) => t.id === todoId ? { ...t, done: !t.done } : t),
        updatedAt: Date.now(),
      };

    // Optimistic update
    setNotes((prev) => prev.map(applyToggle));
    setSelectedNote((prev) => prev && prev.id === noteId ? applyToggle(prev) : prev);

    try {
      const note = notesRef.current.find((n) => n.id === noteId);
      if (!note) return;
      const updatedTodos = (note.todos || []).map((t) =>
        t.id === todoId ? { ...t, done: !t.done } : t,
      );
      await updateDoc(itemDoc(uid, noteId), { todos: updatedTodos, updatedAt: Date.now() });
    } catch (err) { Toast.show({ type: "error", text1: "Todo güncellenemedi" }); }
  };

  const handleAddTodoItem = async (noteId, newItemText) => {
    if (!newItemText.trim()) return;
    const newItem = { id: Date.now().toString(), text: newItemText.trim(), done: false };

    const applyAdd = (n) =>
      n.id !== noteId ? n : {
        ...n, todos: [...(n.todos || []), newItem], updatedAt: Date.now(),
      };

    setNotes((prev) => prev.map(applyAdd));
    setSelectedNote((prev) => prev && prev.id === noteId ? applyAdd(prev) : prev);

    try {
      const note = notesRef.current.find((n) => n.id === noteId);
      if (!note) return;
      await updateDoc(itemDoc(uid, noteId), {
        todos: [...(note.todos || []), newItem], updatedAt: Date.now(),
      });
    } catch (err) { Toast.show({ type: "error", text1: "Madde eklenemedi" }); }
  };

  const handleDeleteTodoItem = async (noteId, todoId) => {
    const applyDelete = (n) =>
      n.id !== noteId ? n : {
        ...n, todos: (n.todos || []).filter((t) => t.id !== todoId), updatedAt: Date.now(),
      };

    setNotes((prev) => prev.map(applyDelete));
    setSelectedNote((prev) => prev && prev.id === noteId ? applyDelete(prev) : prev);

    try {
      const note = notesRef.current.find((n) => n.id === noteId);
      if (!note) return;
      await updateDoc(itemDoc(uid, noteId), {
        todos: (note.todos || []).filter((t) => t.id !== todoId), updatedAt: Date.now(),
      });
    } catch (err) { Toast.show({ type: "error", text1: "Madde silinemedi" }); }
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

    setNotes((prev) => prev.map(applyUpdate));
    setSelectedNote((prev) => prev && prev.id === noteId ? applyUpdate(prev) : prev);
    setModalVisibleNotes(false); setIsEditable(false);

    try {
      await updateDoc(itemDoc(uid, noteId), {
        content: noteContent, color: borderColorNotes,
        backgroundColor: backgroundColorNotes,
        scheduledDate: scheduledDate !== undefined ? scheduledDate : null,
        updatedAt: now,
      });
    } catch (err) { Toast.show({ type: "error", text1: "Not güncellenemedi" }); }
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

    setNotes((prev) => prev.map(applyUpdate));
    setSelectedNote((prev) => prev && prev.id === noteId ? applyUpdate(prev) : prev);
    setModalVisibleNotes(false); setIsEditable(false);

    try {
      await updateDoc(itemDoc(uid, noteId), {
        title: (newTitle || "").trim(), todos: newTodos,
        color: newColor || borderColorNotes,
        backgroundColor: newBg || backgroundColorNotes,
        scheduledDate: scheduledDate !== undefined ? scheduledDate : null,
        updatedAt: now,
      });
    } catch (err) { Toast.show({ type: "error", text1: "Not güncellenemedi" }); }
  };

  const handleDeleteNote = async (noteId) => {
    // Optimistic update
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    setSelectedNote(null);
    setModalVisibleNotes(false);

    try {
      await deleteDoc(itemDoc(uid, noteId));
    } catch (err) { Toast.show({ type: "error", text1: "Not silinemedi" }); }
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
    handleAddNote, handleUpdateNote, handleDeleteNote,
    handleToggleTodoItem, handleAddTodoItem, handleDeleteTodoItem, handleUpdateTodoNote,
    formatDate,
  }), [
    notes, loadingNotes, selectedNote, noteContent, message,
    modalVisibleNotesAdd, modalVisibleNotes, isEditable,
    borderColorNotes, backgroundColorNotes,
    noteType, todoItems, todoTitle, scheduledDate, language,
  ]);

  return (
    <ProfileNotesContext.Provider value={value}>
      {children}
    </ProfileNotesContext.Provider>
  );
};
