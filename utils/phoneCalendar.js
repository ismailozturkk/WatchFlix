import * as Calendar from "expo-calendar";
import Toast from "@components/AppToast";
import { Platform } from "react-native";
import { i18nText } from "./i18nText";
import { Keys, get, set } from "../services/storage";

const CALENDAR_NAME = "Seelogd";

// "Geri Al" düğmeli toast'ın süresi: varsayılan 3 sn, düğmeyi bulup basmaya yetmez.
const UNDO_TOAST_MS = 6000;

// Ekleme/silme sonucu toast'ı. `onUndo` varsa kartta "Geri Al" düğmesi çıkar.
// `silent`: yalnız BAŞARI toast'ını susturur (geri alma gibi iç çağrılar kendi
// mesajını verir); hata toast'ları her zaman gösterilir.
function notify({ silent, onUndo, ...toast }) {
  if (silent) return;
  if (!onUndo) {
    Toast.show(toast);
    return;
  }
  Toast.show({
    ...toast,
    visibilityTime: UNDO_TOAST_MS,
    props: {
      action: { label: i18nText("autoI18n.geri_al", "Geri Al"), icon: "arrow-undo", onPress: onUndo },
    },
  });
}

function notifyUndone() {
  Toast.show({ type: "info", text1: i18nText("autoI18n.takvim_geri_alindi", "Geri alındı") });
}

// Eklemeyi geri almak = o etkinlikleri takvimden kaldırmak. Geri almanın kendisi
// tekrar geri alınmaz (sonsuz ileri-geri zinciri olmasın), yalnız "Geri alındı" denir.
function undoAddition(items, onSavedChange) {
  return async () => {
    const res = await removeManyEventsFromPhoneCalendar(items, { silent: true });
    if (!res.removedKeys?.length) return;
    res.removedKeys.forEach((key) => onSavedChange(key, false));
    notifyUndone();
  };
}

// Silmeyi geri almak = silinenleri aynı kayıtla yeniden eklemek (yeni etkinlik
// kimliğiyle; telefon takvimi silinen etkinliği geri getirmez).
function undoRemoval(items, onSavedChange) {
  return async () => {
    const res = await saveManyEventsToPhoneCalendar(items, { silent: true });
    if (!res.addedKeys?.length) return;
    res.addedKeys.forEach((key) => onSavedChange(key, true));
    notifyUndone();
  };
}

// Kayıt bilerek uid'siz: burada cihazın takvimine YAZILMIŞ etkinliklerin
// kimlikleri duruyor. Kullanıcıya göre kapsansaydı, hesap değişiminde eski
// kayıtlar erişilemez olur ve takvimde sahipsiz etkinlikler kalırdı.
async function getSavedMap() {
  return get(Keys.phoneCalendarEvents) || {};
}

async function setSavedMap(map) {
  set(Keys.phoneCalendarEvents, map);
}

export function buildEventKey(item) {
  if (!item) return "";
  if (item.eventType === "note") return `note_${item.id}`;
  if (item.eventType === "reminder_movie") return `movie_${item.id}_${item.date}`;
  if (item.eventType === "reminder_tv") {
    return `tv_${item.id}_${item.seasonNumber ?? 0}_${item.episodeNumber ?? 0}_${item.date}`;
  }
  return `etk_${item.id}_${item.date}`;
}

export async function loadSavedKeysSet() {
  const map = await getSavedMap();
  return new Set(Object.keys(map));
}

// Seelogd'un telefonun takvimine yazdığı etkinlik sayısı (kayıtlı kimlikler).
export async function countSavedPhoneEvents() {
  return Object.keys(await getSavedMap()).length;
}

// Ayarlar > İzinlerim > Takvim. `request...` değil `get...`: durumu okumak
// kullanıcıya sistem diyaloğu çıkarmamalı.
export async function getCalendarPermissionState() {
  const res = await Calendar.getCalendarPermissions();
  return {
    status: res?.status ?? "undetermined",
    canAskAgain: res?.canAskAgain !== false,
  };
}

export async function requestCalendarAccess() {
  return Calendar.requestCalendarPermissions();
}

// expo-calendar 57'de `...Async` fonksiyonları bilerek hata fırlatıyor
// ("deprecated"); izin/takvim/etkinlik işleri nesne tabanlı API'den yapılır.
async function hasCalendarPermission() {
  const res = await Calendar.requestCalendarPermissions();
  return res?.granted === true || res?.status === "granted";
}

// Seelogd takvimi oluşturulamazsa (iOS'ta varsayılan kaynak takvim eklemeye
// izin vermeyebilir) kullanıcının yazılabilir bir takvimine düşülür; etkinlik
// kimliği saklandığı için kaldırma yine aynı yoldan çalışır.
function pickFallbackCalendar(calendars) {
  if (Platform.OS === "ios") {
    try {
      const def = Calendar.getDefaultCalendarSync();
      if (def?.allowsModifications) return def;
    } catch {
      // varsayılan takvim yoksa listeden seçilir
    }
  }
  const writable = calendars.filter((c) => c.allowsModifications);
  return writable.find((c) => c.isPrimary) || writable[0] || null;
}

async function getOrCreateCalendar() {
  const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
  const existing = calendars.find(
    (c) => c.title === CALENDAR_NAME && c.allowsModifications,
  );
  if (existing) return existing;

  try {
    return await Calendar.createCalendar({
      title: CALENDAR_NAME,
      name: CALENDAR_NAME,
      color: "#138df0",
      entityType: Calendar.EntityTypes.EVENT,
      // iOS'ta kaynak verilmezse yerel taraf varsayılan takvimin kaynağını kullanır.
      ...(Platform.OS === "android"
        ? { source: { isLocalAccount: true, name: CALENDAR_NAME } }
        : null),
      ownerAccount: "personal",
      accessLevel: Calendar.CalendarAccessLevel.OWNER,
    });
  } catch (err) {
    const fallback = pickFallbackCalendar(calendars);
    if (fallback) return fallback;
    throw err;
  }
}

async function createPhoneEvent(calendar, item) {
  const event = await calendar.createEvent(buildEventPayload(item));
  return event.id;
}

async function deletePhoneEvent(eventId) {
  const event = await Calendar.ExpoCalendarEvent.get(eventId);
  await event.delete();
}

function buildEventPayload(item) {
  const dateStr = item.date;
  const start = new Date(dateStr + "T09:00:00");
  const end = new Date(dateStr + "T10:00:00");

  let title = item.title || i18nText("autoI18n.hatirlatma", "Hatırlatma");
  let notes = "";
  if (item.eventType === "note") {
    title = item.title || item.content?.slice(0, 40) || i18nText("autoI18n.not", "Not");
    notes = item.content || "";
  } else if (item.eventType === "reminder_movie") {
    title = `🎬 ${item.title}`;
    notes = i18nText("autoI18n.film_vizyon_takvim_notu", "Film vizyona giriyor (Seelogd hatırlatması)");
  } else if (item.eventType === "reminder_tv") {
    title = `📺 ${item.title}`;
    notes = i18nText("autoI18n.yeni_bolum_takvim_notu", "Yeni bölüm yayınlanıyor (Seelogd hatırlatması)");
  }

  return {
    title,
    startDate: start,
    endDate: end,
    notes,
    alarms: [{ relativeOffset: -60 }],
    allDay: false,
  };
}

// `onSavedChange(key, saved)` verilirse başarı toast'ında "Geri Al" çıkar ve geri
// alınınca ekranın kayıt kümesini güncellemek için çağrılır.
export async function saveEventToPhoneCalendar(item, { onSavedChange, silent } = {}) {
  try {
    if (!(await hasCalendarPermission())) {
      Toast.show({ type: "error", text1: i18nText("autoI18n.takvim_izni_reddedildi", "Takvim izni reddedildi") });
      return { ok: false };
    }

    const key = buildEventKey(item);
    const map = await getSavedMap();
    if (map[key]) {
      Toast.show({
        type: "info",
        text1: i18nText("autoI18n.zaten_telefon_takviminde", "Zaten telefonun takvimine eklendi"),
      });
      return { ok: false, alreadySaved: true };
    }

    const calendar = await getOrCreateCalendar();
    const eventId = await createPhoneEvent(calendar, item);

    map[key] = { eventId, savedAt: Date.now() };
    await setSavedMap(map);

    notify({
      silent,
      type: "success",
      text1: i18nText("autoI18n.telefon_takvimine_eklendi", "Telefonun takvimine eklendi"),
      onUndo: onSavedChange && undoAddition([item], onSavedChange),
    });
    return { ok: true, eventId };
  } catch (err) {
    console.error("Phone calendar save error:", err);
    Toast.show({
      type: "error",
      text1: i18nText("autoI18n.takvime_eklenemedi", "Takvime eklenemedi"),
      text2: err.message,
    });
    return { ok: false, error: err };
  }
}

export async function saveManyEventsToPhoneCalendar(items, { onSavedChange, silent } = {}) {
  if (!items || items.length === 0) {
    return { added: 0, skipped: 0, failed: 0, total: 0 };
  }

  try {
    if (!(await hasCalendarPermission())) {
      Toast.show({ type: "error", text1: i18nText("autoI18n.takvim_izni_reddedildi", "Takvim izni reddedildi") });
      return { added: 0, skipped: 0, failed: 0, total: items.length };
    }

    let calendar;
    try {
      calendar = await getOrCreateCalendar();
    } catch (err) {
      Toast.show({
        type: "error",
        text1: i18nText("autoI18n.takvim_hazirlanamadi", "Takvim hazırlanamadı"),
        text2: err.message,
      });
      return { added: 0, skipped: 0, failed: items.length, total: items.length };
    }

    const map = await getSavedMap();
    let added = 0;
    let skipped = 0;
    let failed = 0;
    const addedKeys = [];
    const addedItems = [];

    for (const item of items) {
      const key = buildEventKey(item);
      if (map[key]) {
        skipped++;
        continue;
      }
      try {
        const eventId = await createPhoneEvent(calendar, item);
        map[key] = { eventId, savedAt: Date.now() };
        addedKeys.push(key);
        addedItems.push(item);
        added++;
      } catch (err) {
        console.warn("Bulk save failed for item:", item, err);
        failed++;
      }
    }

    await setSavedMap(map);

    const parts = [];
    if (added > 0)   parts.push(i18nText("autoI18n.n_eklendi", "{{count}} eklendi", { count: added }));
    if (skipped > 0) parts.push(i18nText("autoI18n.n_zaten_vardi", "{{count}} zaten vardı", { count: skipped }));
    if (failed > 0)  parts.push(i18nText("autoI18n.n_basarisiz", "{{count}} başarısız", { count: failed }));

    notify({
      silent,
      type: added > 0 ? "success" : "info",
      text1:
        added > 0
          ? i18nText("autoI18n.telefon_takvimine_aktarildi", "Telefonun takvimine aktarıldı")
          : skipped === items.length
            ? i18nText("autoI18n.hepsi_zaten_ekliydi", "Hepsi zaten ekliydi")
            : i18nText("autoI18n.aktarim_tamamlandi", "Aktarım tamamlandı"),
      text2: parts.join(" • "),
      onUndo: added > 0 && onSavedChange ? undoAddition(addedItems, onSavedChange) : undefined,
    });

    return { added, skipped, failed, total: items.length, addedKeys };
  } catch (err) {
    console.error("Bulk save error:", err);
    Toast.show({
      type: "error",
      text1: i18nText("autoI18n.aktarim_basarisiz", "Aktarım başarısız"),
      text2: err.message,
    });
    return { added: 0, skipped: 0, failed: items.length, total: items.length };
  }
}

// `onSavedChange(key, saved)` verilirse başarı toast'ında "Geri Al" çıkar (silineni
// yeniden ekler) ve geri alınınca ekranın kayıt kümesini güncellemek için çağrılır.
export async function removeEventFromPhoneCalendar(item, { onSavedChange, silent } = {}) {
  try {
    const key = buildEventKey(item);
    const map = await getSavedMap();
    if (!map[key]) return { ok: false };
    // İzin kapalıyken silme sessizce başarısız olur; kaydı yine de silmek
    // etkinliği takvimde SAHİPSİZ bırakırdı (bkz. getSavedMap). Toplu silmeyle aynı kural.
    if (!(await hasCalendarPermission())) {
      Toast.show({ type: "error", text1: i18nText("autoI18n.takvim_izni_reddedildi", "Takvim izni reddedildi") });
      return { ok: false };
    }
    try {
      await deletePhoneEvent(map[key].eventId);
    } catch (err) {
      console.warn("Phone calendar delete error:", err);
    }
    delete map[key];
    await setSavedMap(map);
    notify({
      silent,
      type: "info",
      text1: i18nText("autoI18n.telefon_takviminden_kaldirildi", "Telefonun takviminden kaldırıldı"),
      onUndo: onSavedChange && undoRemoval([item], onSavedChange),
    });
    return { ok: true };
  } catch (err) {
    console.error("Phone calendar remove error:", err);
    return { ok: false, error: err };
  }
}

// Seelogd'un eklediği TÜM etkinlikleri telefonun takviminden siler (Ayarlar >
// İzinlerim > Takvim). Toast göstermez; sonucu çağıran ekran kendi anlatır.
//
// İzin kapalıyken silinemez. Bu yüzden izin YOKSA kayda dokunmadan `blocked`
// döner: kaydı silip etkinlikleri takvimde bırakmak, sahipsiz etkinlik yaratırdı
// (bkz. getSavedMap). İzin açıkken telefonda artık bulunamayan etkinlik
// (kullanıcı takvim uygulamasından kendisi silmiş olabilir) kayıttan da
// temizlenir — yoksa sayaç hiç sıfırlanmazdı; `removeManyEventsFromPhoneCalendar`
// ile aynı kural.
export async function removeAllEventsFromPhoneCalendar() {
  const map = await getSavedMap();
  const keys = Object.keys(map);
  if (keys.length === 0) return { removed: 0, missing: 0, total: 0 };

  let granted = false;
  try {
    granted = (await getCalendarPermissionState()).status === "granted";
  } catch {
    granted = false;
  }
  if (!granted) {
    return { blocked: "no-permission", removed: 0, missing: 0, total: keys.length };
  }

  let removed = 0;
  let missing = 0;
  for (const key of keys) {
    try {
      await deletePhoneEvent(map[key].eventId);
      removed++;
    } catch (err) {
      console.warn("Phone calendar delete error:", err);
      missing++;
    }
    delete map[key];
  }
  await setSavedMap(map);
  return { removed, missing, total: keys.length };
}

export async function removeManyEventsFromPhoneCalendar(items, { onSavedChange, silent } = {}) {
  if (!items || items.length === 0) {
    return { removed: 0, skipped: 0, failed: 0, total: 0 };
  }

  try {
    if (!(await hasCalendarPermission())) {
      Toast.show({ type: "error", text1: i18nText("autoI18n.takvim_izni_reddedildi", "Takvim izni reddedildi") });
      return { removed: 0, skipped: 0, failed: 0, total: items.length };
    }

    const map = await getSavedMap();
    let removed = 0;
    let skipped = 0;
    let failed = 0;
    const removedKeys = [];

    for (const item of items) {
      const key = buildEventKey(item);
      if (!map[key]) {
        skipped++;
        continue;
      }
      try {
        await deletePhoneEvent(map[key].eventId);
        delete map[key];
        removedKeys.push(key);
        removed++;
      } catch (err) {
        // Telefonda yoksa bile local map'ten temizle
        console.warn("Bulk remove failed for item:", item, err);
        delete map[key];
        removedKeys.push(key);
        removed++;
        failed++;
      }
    }

    await setSavedMap(map);

    const parts = [];
    if (removed > 0) parts.push(i18nText("autoI18n.n_silindi", "{{count}} silindi", { count: removed }));
    if (skipped > 0) parts.push(i18nText("autoI18n.n_zaten_yoktu", "{{count}} zaten yoktu", { count: skipped }));

    const removedKeySet = new Set(removedKeys);
    notify({
      silent,
      type: removed > 0 ? "success" : "info",
      text1:
        removed > 0
          ? i18nText("autoI18n.telefon_takviminden_silindi", "Telefon takviminden silindi")
          : i18nText("autoI18n.silinecek_kayit_yok", "Silinecek kayıt yok"),
      text2: parts.join(" • ") || undefined,
      onUndo:
        removed > 0 && onSavedChange
          ? undoRemoval(
              items.filter((item) => removedKeySet.has(buildEventKey(item))),
              onSavedChange,
            )
          : undefined,
    });

    return { removed, skipped, failed, total: items.length, removedKeys };
  } catch (err) {
    console.error("Bulk remove error:", err);
    Toast.show({
      type: "error",
      text1: i18nText("autoI18n.silme_basarisiz", "Silme başarısız"),
      text2: err.message,
    });
    return { removed: 0, skipped: 0, failed: items.length, total: items.length };
  }
}
