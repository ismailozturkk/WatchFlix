import React, {
  createContext, useContext, useEffect, useState, useMemo, useRef,
} from "react";
import {
  doc, setDoc, deleteDoc, collection, onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./AuthContext";
import { isAuthTransitionError } from "../utils/firestoreError";
import Toast from "react-native-toast-message";
import { i18nText } from "../utils/i18nText";
import { cacheKeys } from "../utils/cacheKeys";
import { publish, seed } from "../services/snapshotCache";
import { getActiveUser } from "../services/storage";
import useStartupGate from "../hooks/useStartupGate";

// Film/dizi detay sayfasından yazılan, TEK bir medya öğesine bağlı kişisel not.
// Genel "Notlar" (context/ProfileNotesContext.js, Notes/{uid}/items) koleksiyonundan
// BİLİNÇLİ olarak ayrı: bu notların mediaId/mediaType/poster gibi ekstra alanları
// var ve düz not/todo şemasına zorlanması NotesScreen'in kart/düzenleme UI'ını
// karmaşıklaştırırdı (docs: Notlar ekranındaki Notlar/Yapılacaklar sekme deseni
// aynen korunuyor, üçüncü bir "Film/Dizi" sekmesi bu context'ten besleniyor).
//
// Firestore: MediaNotes/{uid}/items/{itemKey}, itemKey = "{type}_{mediaId}" —
// listItemsService.js'teki `type_id` doc-id kuralıyla aynı: bir medyanın en
// fazla bir notu olur, detay sayfası ekstra sorgu yapmadan doğrudan okuyabilir.
export const mediaNoteItemKey = (type, mediaId) => `${type === "tv" ? "tv" : "movie"}_${mediaId}`;

const MediaNotesContext = createContext();
export const useMediaNotes = () => useContext(MediaNotesContext);

export const MediaNotesProvider = ({ children }) => {
  const { user } = useAuth();
  const uid = user?.uid;

  // Açılış tohumu: diğer profil context'leriyle (bkz. ProfileNotesContext.js)
  // aynı desen — son oturumun verisi diskten SENKRON okunur, ilk karede çizilir.
  const ilkTohum = useMemo(() => {
    const tohumUid = uid ?? getActiveUser();
    return tohumUid ? seed(cacheKeys.mediaNotes(tohumUid)).data : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [mediaNotes, setMediaNotes] = useState(Array.isArray(ilkTohum) ? ilkTohum : []);
  const [loadingMediaNotes, setLoadingMediaNotes] = useState(false);

  const mediaNotesRef = useRef([]);
  useEffect(() => { mediaNotesRef.current = mediaNotes; }, [mediaNotes]);

  const itemsCol = (u) => collection(db, "MediaNotes", u, "items");
  const itemDoc = (u, key) => doc(db, "MediaNotes", u, "items", key);

  // Açılış kademesi: hooks/useStartupGate.js'teki KADEME TABLOSU'na göre
  // ProfileNotesContext'ten (2400) sonraki, NotificationsContext'ten (2800)
  // önceki boş dilim — aynı anda iki listener birden açılmasın.
  const startupReady = useStartupGate(2600);

  useEffect(() => {
    if (!startupReady) return;
    if (!uid) {
      setMediaNotes([]);
      setLoadingMediaNotes(false);
      return;
    }
    const cached = seed(cacheKeys.mediaNotes(uid)).data;
    if (Array.isArray(cached)) {
      setMediaNotes(cached);
      setLoadingMediaNotes(false);
    } else {
      setLoadingMediaNotes(true);
    }

    const unsub = onSnapshot(
      itemsCol(uid),
      (snap) => {
        const fetched = snap.docs
          .map((d) => ({ ...d.data(), id: d.id }))
          .sort((a, b) => b.updatedAt - a.updatedAt);
        setMediaNotes(fetched);
        publish(cacheKeys.mediaNotes(uid), fetched);
        setLoadingMediaNotes(false);
      },
      (err) => {
        if (!isAuthTransitionError(err) && __DEV__)
          console.warn("[MediaNotes] snapshot error:", err?.message);
        setLoadingMediaNotes(false);
      },
    );

    return () => unsub();
  }, [uid, startupReady]);

  const saveMediaNote = async ({ type, mediaId, title, posterPath, text }) => {
    if (!uid || !mediaId) return false;
    const key = mediaNoteItemKey(type, mediaId);
    const existing = mediaNotesRef.current.find((n) => n.id === key);
    const now = Date.now();
    const cleanText = String(text || "").trim();
    if (!cleanText) return false;

    const finalNote = {
      id: key,
      type: type === "tv" ? "tv" : "movie",
      mediaId,
      title: title || existing?.title || "",
      posterPath: posterPath ?? existing?.posterPath ?? null,
      text: cleanText,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    // Optimistic update
    setMediaNotes((prev) => {
      const exists = prev.some((n) => n.id === key);
      return exists
        ? prev.map((n) => (n.id === key ? finalNote : n))
        : [finalNote, ...prev];
    });

    try {
      await setDoc(itemDoc(uid, key), finalNote);
      return true;
    } catch (err) {
      Toast.show({ type: "error", text1: i18nText("autoI18n.not_kaydedilemedi", "Not kaydedilemedi") });
      return false;
    }
  };

  const deleteMediaNote = async (type, mediaId) => {
    if (!uid || !mediaId) return;
    const key = mediaNoteItemKey(type, mediaId);
    setMediaNotes((prev) => prev.filter((n) => n.id !== key));
    try {
      await deleteDoc(itemDoc(uid, key));
    } catch (err) {
      Toast.show({ type: "error", text1: i18nText("autoI18n.not_silinemedi", "Not silinemedi") });
    }
  };

  const value = useMemo(() => ({
    // `mediaNotes` reaktif dizi olarak dışarı veriliyor (ref değil): tüketiciler
    // render sırasında `mediaNotes.find(n => n.id === mediaNoteItemKey(...))`
    // ile "bu medyanın notu var mı" diye SENKRON ve her zaman güncel sorabilir.
    mediaNotes, loadingMediaNotes,
    saveMediaNote, deleteMediaNote,
  }), [mediaNotes, loadingMediaNotes]);

  return (
    <MediaNotesContext.Provider value={value}>
      {children}
    </MediaNotesContext.Provider>
  );
};
