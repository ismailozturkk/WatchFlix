// utils/noteReminders.js
//
// Not / yapılacak hatırlatmalarının SAF hesabı. Not şeması:
//   scheduledDate: "YYYY-MM-DD" (yerel gün) | null
//   scheduledTime: "HH:MM" (yerel saat)     | null — yoksa DEFAULT_REMINDER_TIME
// Saat alanı sonradan geldi; saatsiz eski kayıtlar 09:00'da çalmaya devam eder
// (cihaz bildirimi zamanlayıcısının varsayılanıyla aynı).
//
// Kullananlar:
//   • DeviceNotificationsContext → cihaz bildirimi zamanı (noteReminderDateValue)
//   • hooks/useNoteReminderInbox → uygulama içi bildirim kutusu + profil şeridi
//     (vadesi gelmiş hatırlatmalar, okundu durumu cihazda)

import { parseISODate } from "./notesView";

export const DEFAULT_REMINDER_TIME = "09:00";
// Bildirim kutusunda vadesi geçmiş hatırlatmalar bu kadar gün görünür.
export const NOTE_REMINDER_INBOX_DAYS = 14;
export const NOTE_REMINDER_TYPE = "note_reminder";
const ID_PREFIX = "note-reminder:";
const DAY_MS = 24 * 60 * 60 * 1000;

const pad = (n) => String(n).padStart(2, "0");

export function isValidReminderTime(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value || ""));
  return !!match && Number(match[1]) < 24 && Number(match[2]) < 60;
}

export const formatReminderTime = (hour, minute) => `${pad(hour)}:${pad(minute)}`;

/** "HH:MM" → { hour, minute } (geçersizse null). */
export function splitReminderTime(value) {
  if (!isValidReminderTime(value)) return null;
  const [hour, minute] = value.split(":").map(Number);
  return { hour, minute };
}

/** Notun hatırlatma anı (ms) — tarih yoksa null. */
export function noteReminderAt(note) {
  const day = parseISODate(note?.scheduledDate);
  if (!day) return null;
  const time = splitReminderTime(note?.scheduledTime) || splitReminderTime(DEFAULT_REMINDER_TIME);
  day.setHours(time.hour, time.minute, 0, 0);
  return day.getTime();
}

/**
 * Cihaz bildirimi zamanlayıcısına verilecek değer. Saat seçilmişse
 * "YYYY-MM-DDTHH:MM" (saniyesiz biçim zamanlayıcıda AÇIK SAAT sayılır; 00:00
 * bile varsayılan saate kaydırılmaz), seçilmemişse yalnız gün.
 */
export function noteReminderDateValue(note) {
  if (!parseISODate(note?.scheduledDate)) return null;
  return isValidReminderTime(note?.scheduledTime)
    ? `${note.scheduledDate}T${note.scheduledTime}`
    : note.scheduledDate;
}

/** Seçilen gün için önerilen saat: bugünse bir sonraki tam saat, değilse 09:00. */
export function suggestedReminderTime(isoDate, now = new Date()) {
  const day = parseISODate(isoDate);
  if (!day) return DEFAULT_REMINDER_TIME;
  const sameDay =
    day.getFullYear() === now.getFullYear() &&
    day.getMonth() === now.getMonth() &&
    day.getDate() === now.getDate();
  if (!sameDay) return DEFAULT_REMINDER_TIME;
  const next = now.getHours() + 1;
  return next <= 23 ? formatReminderTime(next, 0) : formatReminderTime(23, 59);
}

/** Gün + saat şu andan önce mi? (Bugün için geçmiş saatleri soldurmakta.) */
export function isReminderPast(isoDate, time, now = Date.now()) {
  const at = noteReminderAt({ scheduledDate: isoDate, scheduledTime: time });
  return at !== null && at <= now;
}

/** Kutudaki kaydın kimliği: not + hatırlatma anı (yeniden kurulan hatırlatma yeni kayıttır). */
export const noteReminderItemId = (noteId, fireMs) => `${ID_PREFIX}${noteId}@${fireMs}`;
export const isNoteReminderItem = (item) => item?.type === NOTE_REMINDER_TYPE;

function previewOf(note) {
  if (note?.type === "todo") {
    const open = (note.todos || []).filter((todo) => todo && !todo.done && todo.text);
    return open.slice(0, 3).map((todo) => `• ${todo.text}`).join("\n");
  }
  return String(note?.content || "").trim().slice(0, 160);
}

const isCompleteList = (note) =>
  note?.type === "todo" &&
  (note.todos || []).length > 0 &&
  (note.todos || []).every((todo) => todo?.done);

/**
 * Vadesi gelmiş hatırlatmalar, bildirim kutusu kaydı şeklinde (en yeni başta).
 * `seen`: { [noteId]: okunan hatırlatma anı } — aynı an okunduysa `read: true`.
 * Tamamlanmış listeler okunmuş sayılır (hatırlatılacak iş kalmadı).
 */
export function dueNoteReminders(notes, seen = {}, now = Date.now(), days = NOTE_REMINDER_INBOX_DAYS) {
  const since = now - days * DAY_MS;
  const out = [];
  (Array.isArray(notes) ? notes : []).forEach((note) => {
    if (!note?.id) return;
    const fireMs = noteReminderAt(note);
    if (fireMs === null || fireMs > now || fireMs < since) return;
    out.push({
      id: noteReminderItemId(note.id, fireMs),
      type: NOTE_REMINDER_TYPE,
      local: true,
      noteId: String(note.id),
      noteType: note.type === "todo" ? "todo" : "note",
      title: String(note.title || "").trim(),
      text: previewOf(note),
      color: note.color || null,
      createdAt: fireMs,
      read: Number(seen?.[note.id]) === fireMs || isCompleteList(note),
    });
  });
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

/** Okundu haritası: yalnız hâlâ var olan notlar tutulur (silinen notun izi kalmaz). */
export function markRemindersSeen(seen, items, notes) {
  const alive = new Set((Array.isArray(notes) ? notes : []).map((note) => String(note?.id)));
  const next = {};
  Object.entries(seen && typeof seen === "object" ? seen : {}).forEach(([noteId, fireMs]) => {
    if (alive.has(noteId)) next[noteId] = fireMs;
  });
  (items || []).forEach((item) => {
    if (item?.noteId) next[item.noteId] = item.createdAt;
  });
  return next;
}

// Saat yalnız günle birlikte anlamlı; geçersiz saat "saatsiz" (09:00) sayılır.
const scheduleOf = (note) => {
  const day = parseISODate(note?.scheduledDate) ? note.scheduledDate : null;
  return { day, time: day && isValidReminderTime(note?.scheduledTime) ? note.scheduledTime : null };
};

/**
 * `next` YENİ bir hatırlatıcı kuruyor ya da mevcudun gününü/saatini değiştiriyor mu?
 * Kaldırmak (gün yok) ve aynı hatırlatıcıyla kaydetmek false — Premium kapısı
 * (registry: note_reminders) yalnız kurmayı durdurur, kaldırmayı değil.
 */
export function reminderScheduleChanged(next, previous) {
  const after = scheduleOf(next);
  if (!after.day) return false;
  const before = scheduleOf(previous);
  return after.day !== before.day || after.time !== before.time;
}

/**
 * Yükseltme sayfasının bildirim kartı için önizleme (utils/premiumUpsellContent
 * buildReminderPreview): notun başlığı (yoksa notta ilk satır) + hatırlatma zamanı.
 * `schedule` denenen yeni zamanı verir (ör. ertelenmiş saat).
 */
export function noteReminderPreview(note, schedule = {}) {
  const list = note?.type === "todo";
  return {
    kind: "reminder",
    noteType: list ? "todo" : "note",
    title: String(note?.title || "").trim() || (list ? "" : String(note?.content || "").trim().split("\n")[0]),
    scheduledDate: note?.scheduledDate ?? null,
    scheduledTime: note?.scheduledTime ?? null,
    ...schedule,
  };
}

/** Ertele: hatırlatmayı şimdiden `minutes` sonraya taşır → { scheduledDate, scheduledTime }. */
export function snoozedSchedule(minutes, now = new Date()) {
  const at = new Date(now.getTime() + minutes * 60 * 1000);
  // Saat dakika hassasiyetinde; aşağı yuvarlamak ertelemeyi kısaltmasın.
  if (at.getSeconds() > 0 || at.getMilliseconds() > 0) at.setMinutes(at.getMinutes() + 1, 0, 0);
  return {
    scheduledDate: `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`,
    scheduledTime: formatReminderTime(at.getHours(), at.getMinutes()),
  };
}
