// hooks/useNoteReminderInbox.js
//
// Vadesi gelmiş not hatırlatmaları — uygulama içi bildirim kutusu
// (NotificationsScreen), profil başlığındaki bildirim rozeti ve profilin
// üstündeki etkileşimli şerit (NoteRemindersBar) buradan okur.
//
// Kayıtlar SUNUCUDA DEĞİL: notlar yerel-öncelikli veri (services/userData) ve
// hatırlatma cihaz bildirimi olarak zaten burada çalıyor; kutu kaydı nottan
// türetilir (utils/noteReminders.js). Okundu durumu cihazda
// (Keys.noteReminderSeen) — `useStored` sayesinde bir yüzeyde okununca diğerleri
// de anında güncellenir.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useProfileNotes } from "../context/ProfileNotesContext";
import { Keys, get, set, useStored } from "../services/storage";
import { dueNoteReminders, markRemindersSeen, noteReminderAt } from "../utils/noteReminders";

const TICK_MS = 30 * 1000;
// setTimeout üst sınırı (~24,8 gün) aşılmasın; uzak hatırlatma için arada uyanmak yeter.
const MAX_WAIT_MS = 6 * 60 * 60 * 1000;

export default function useNoteReminderInbox() {
  const notes = useProfileNotes()?.notes;
  const seen = useStored(Keys.noteReminderSeen);
  const [now, setNow] = useState(Date.now());

  // Yarım dakikada bir + bir sonraki hatırlatma anında yeniden hesapla: hatırlatma
  // çaldığında kutu ve şerit, ekran açıkken de beklemeden güncellensin.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const upcoming = (notes || [])
      .map(noteReminderAt)
      .filter((at) => at !== null && at > now)
      .sort((a, b) => a - b)[0];
    if (!upcoming) return undefined;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(upcoming - now + 50, MAX_WAIT_MS));
    return () => clearTimeout(timer);
  }, [notes, now]);

  const items = useMemo(() => dueNoteReminders(notes, seen || {}, now), [notes, seen, now]);
  const unread = useMemo(() => items.filter((item) => !item.read), [items]);

  const markSeen = useCallback(
    (targets) => {
      const list = (Array.isArray(targets) ? targets : [targets]).filter(Boolean);
      if (!list.length) return;
      // Güncel değer depodan okunur: art arda iki çağrı birbirini ezmesin.
      set(Keys.noteReminderSeen, markRemindersSeen(get(Keys.noteReminderSeen), list, notes));
    },
    [notes],
  );
  const markAllSeen = useCallback(() => markSeen(items.filter((item) => !item.read)), [items, markSeen]);

  return { items, unread, unreadCount: unread.length, markSeen, markAllSeen };
}
