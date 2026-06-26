// services/reminderNotificationScheduler.js
//
// Reminder (film / dizi / not) local bildirimlerinin zamanlanması ve
// reconciliation'ı. Saf mantık — i18n / formatlama çağıran (React) tarafta.
//
// Akış:
//   1) React katmanı reminder + not verisini + ayarları okur, `desired` listesi
//      kurar ({ identifier, title, body, fireMs, channelId, data }).
//   2) syncReminderNotifications(desired) cihazda zamanlanmış reminder_* ile
//      karşılaştırır: değişmeyenleri bırakır, yenileri/değişenleri (yeniden)
//      zamanlar, listede olmayanları iptal eder. Idempotent.

import {
  REMINDER_PREFIX,
  scheduleLocalNotification,
  cancelScheduledNotification,
  getAllScheduled,
} from "./pushNotificationsService";

/**
 * Bir tarih değerini (ms | ISO | "YYYY-MM-DD") tetikleme zamanına (ms) çevirir.
 * - Sadece tarih içeren değerlerde (gece yarısı) varsayılan saat uygulanır.
 * - leadTimeDays kadar gün öncesine alınır.
 * - Sonuç geçmişteyse null döner (zamanlanmaz).
 *
 * @returns {number|null} epoch ms
 */
export function computeReminderFireMs(
  dateValue,
  { leadTimeDays = 0, defaultHour = 9 } = {},
) {
  if (dateValue === null || dateValue === undefined || dateValue === "") return null;

  let base;
  if (typeof dateValue?.toMillis === "function") {
    // Firestore Timestamp güvencesi.
    base = new Date(dateValue.toMillis());
  } else if (typeof dateValue?.toDate === "function") {
    base = dateValue.toDate();
  } else if (typeof dateValue === "number") {
    base = new Date(dateValue);
  } else if (typeof dateValue === "string") {
    // "YYYY-MM-DD" → yerel saatle defaultHour; tam ISO ise kendi saatiyle.
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dateValue.trim());
    base = dateOnly
      ? new Date(`${dateValue.trim()}T${String(defaultHour).padStart(2, "0")}:00:00`)
      : new Date(dateValue);
  } else {
    base = new Date(dateValue);
  }

  if (isNaN(base.getTime())) return null;

  // Gece yarısı (00:00) ise — büyük ihtimalle saat seçilmemiş — defaultHour uygula.
  if (base.getHours() === 0 && base.getMinutes() === 0 && base.getSeconds() === 0) {
    base.setHours(defaultHour, 0, 0, 0);
  }

  const fireMs = base.getTime() - leadTimeDays * 24 * 60 * 60 * 1000;
  if (fireMs <= Date.now()) return null;
  return fireMs;
}

/**
 * `desired`: Array<{ identifier, title, body, fireMs, channelId, data }>
 * Cihazda zamanlanmış reminder_* bildirimleriyle senkronize eder.
 *
 * @returns {Promise<{scheduled:number, cancelled:number, kept:number}>}
 */
export async function syncReminderNotifications(desired = []) {
  const desiredById = new Map();
  for (const job of desired) {
    if (job && job.identifier && job.fireMs && job.fireMs > Date.now()) {
      desiredById.set(job.identifier, job);
    }
  }

  // Mevcut zamanlanmış reminder_* bildirimleri.
  const all = await getAllScheduled();
  const existing = new Map();
  for (const n of all) {
    if (typeof n.identifier === "string" && n.identifier.startsWith(REMINDER_PREFIX)) {
      existing.set(n.identifier, n?.content?.data?.fireMs ?? null);
    }
  }

  let scheduled = 0;
  let cancelled = 0;
  let kept = 0;

  // Ekle / güncelle.
  for (const [identifier, job] of desiredById) {
    const existingFireMs = existing.get(identifier);
    if (existing.has(identifier) && existingFireMs === job.fireMs) {
      kept += 1;
      continue;
    }
    // Değişmiş veya yeni — (varsa) iptal edip yeniden zamanla.
    if (existing.has(identifier)) {
      await cancelScheduledNotification(identifier);
    }
    const ok = await scheduleLocalNotification({
      identifier,
      title: job.title,
      body: job.body,
      date: new Date(job.fireMs),
      channelId: job.channelId,
      data: { ...(job.data || {}), fireMs: job.fireMs },
    });
    if (ok) scheduled += 1;
  }

  // Artık istenmeyen reminder_* bildirimlerini iptal et.
  for (const identifier of existing.keys()) {
    if (!desiredById.has(identifier)) {
      await cancelScheduledNotification(identifier);
      cancelled += 1;
    }
  }

  return { scheduled, cancelled, kept };
}
