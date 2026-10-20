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

const DAY_MS = 24 * 60 * 60 * 1000;

// Yayın anı KAÇMIŞ ama yayın günü hâlâ bugünse kullanılan sabit "geç kalmış
// hatırlatma" saati. Sabit olması şart: her senkronda aynı fireMs üretilir,
// dolayısıyla imza değişmez ve bildirim tekrar tekrar zamanlanıp yeniden
// tetiklenmez (now + x dakika kullanılsaydı her açılışta yeni bildirim düşerdi).
const CATCH_UP_HOUR = 20;

const isSameLocalDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/**
 * Bir tarih değerini (ms | ISO | "YYYY-MM-DD" | Firestore Timestamp) yerel
 * Date'e çevirir. Sadece tarih içeren değerlerde varsayılan saat uygulanır.
 *
 * `dateOnly`: kaynak değer bir SAAT taşımıyordu (yayın tarihi "2026-05-10" ya da
 * gece yarısı). Bu ayrım geç kalmış hatırlatmalarda gerekli — kullanıcı tam saat
 * seçtiyse (not hatırlatması) o saat kaçtığında başka bir saate kaydırılmamalı.
 *
 * @returns {{date:Date, dateOnly:boolean}|null}
 */
function parseReminderDate(dateValue, defaultHour) {
  if (dateValue === null || dateValue === undefined || dateValue === "") return null;

  let base;
  let dateOnly = false;
  if (typeof dateValue?.toMillis === "function") {
    // Firestore Timestamp güvencesi.
    base = new Date(dateValue.toMillis());
  } else if (typeof dateValue?.toDate === "function") {
    base = dateValue.toDate();
  } else if (typeof dateValue === "number") {
    base = new Date(dateValue);
  } else if (typeof dateValue === "string") {
    // "YYYY-MM-DD" → yerel saatle defaultHour; tam ISO ise kendi saatiyle.
    dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dateValue.trim());
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
    dateOnly = true;
  }
  return { date: base, dateOnly };
}

/**
 * Bir yayın tarihi için tetikleme zamanını ve GERÇEKLEŞEN lead-time'ı hesaplar.
 *
 * Kullanıcının seçtiği lead-time (ör. "1 hafta önce") çoğu zaman kaçmış olur:
 * 3 gün sonra vizyona giren bir filme hatırlatma kurulduğunda "1 hafta önce"
 * penceresi çoktan geçmiştir. Eskiden bu durumda HİÇ bildirim zamanlanmıyordu.
 * Sıralı geri çekilme:
 *   1) İstenen lead-time hâlâ gelecekte  → o an, istenen lead ile.
 *   2) Pencere kaçmış, yayın anı gelecek → yayın anı, lead 0 ("Bugün yayında!").
 *   3) Yayın anı da geçmiş ama yayın GÜNÜ bugün → aynı gün CATCH_UP_HOUR.
 *      Yalnız saat taşımayan değerlerde: kullanıcı tam saat seçtiyse (not
 *      hatırlatması) o saat kaçınca bildirimi başka saate kaydırmayız.
 *   4) Aksi halde (geçmiş yapım) → null.
 *
 * `leadDays` dönüşü çağıran tarafın bildirim metnini gerçeğe uydurması içindir;
 * 2. maddede "1 hafta sonra yayında" yazmak yanlış olurdu.
 *
 * @returns {{fireMs:number, leadDays:number}|null}
 */
export function computeReminderSchedule(
  dateValue,
  { leadTimeDays = 0, defaultHour = 9, now = Date.now() } = {},
) {
  const parsed = parseReminderDate(dateValue, defaultHour);
  if (!parsed) return null;

  const { date: base, dateOnly } = parsed;
  const releaseMs = base.getTime();
  const requestedLead = Math.max(0, Number(leadTimeDays) || 0);

  const targetMs = releaseMs - requestedLead * DAY_MS;
  if (targetMs > now) return { fireMs: targetMs, leadDays: requestedLead };

  if (releaseMs > now) return { fireMs: releaseMs, leadDays: 0 };

  if (dateOnly && isSameLocalDay(new Date(now), base)) {
    const catchUp = new Date(base);
    catchUp.setHours(CATCH_UP_HOUR, 0, 0, 0);
    if (catchUp.getTime() > now) return { fireMs: catchUp.getTime(), leadDays: 0 };
  }

  return null;
}

// Bir işin içerik imzası: fireMs + başlık + gövde. Yalnız fireMs değil metni de
// kapsar; böylece dil değişince (aynı tetik zamanı olsa da başlık/gövde değişir)
// imza değişir ve bildirim yeni dille yeniden zamanlanır. Aynı zamanda içerik
// (film adı, bölüm adı) değişirse de yakalanır.
function reminderSignature(job) {
  return `${job.fireMs}|${job.title || ""}|${job.body || ""}`;
}

/**
 * `desired`: Array<{ identifier, title, body, fireMs, channelId, data }>
 * Cihazda zamanlanmış reminder_* bildirimleriyle senkronize eder.
 *
 * `limit`: aynı anda zamanlanacak azami bildirim (en yakın tarihliler önce).
 * iOS'ta bekleyen local bildirim üst sınırı 64'tür; üstü SESSİZCE düşer. Sınır
 * çağıran tarafça verilir (Android'de pratik bir sınır yok).
 *
 * @returns {Promise<{scheduled:number, cancelled:number, kept:number, skipped:number}>}
 */
export async function syncReminderNotifications(desired = [], { limit = Infinity } = {}) {
  const now = Date.now();
  const eligible = desired
    .filter((job) => job && job.identifier && job.fireMs > now)
    .sort((a, b) => a.fireMs - b.fireMs);

  const desiredById = new Map();
  for (const job of eligible.slice(0, limit)) {
    desiredById.set(job.identifier, job);
  }
  const skipped = eligible.length - desiredById.size;

  // Mevcut zamanlanmış reminder_* bildirimleri (içerik imzasıyla).
  const all = await getAllScheduled();
  const existing = new Map();
  for (const n of all) {
    if (typeof n.identifier === "string" && n.identifier.startsWith(REMINDER_PREFIX)) {
      // Eski kayıtlarda sig yoksa null → bir kez yeniden zamanlanır, sonra oturur.
      existing.set(n.identifier, n?.content?.data?.sig ?? null);
    }
  }

  let scheduled = 0;
  let cancelled = 0;
  let kept = 0;

  // Ekle / güncelle.
  for (const [identifier, job] of desiredById) {
    const sig = reminderSignature(job);
    if (existing.has(identifier) && existing.get(identifier) === sig) {
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
      data: { ...(job.data || {}), fireMs: job.fireMs, sig },
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

  return { scheduled, cancelled, kept, skipped };
}
