import * as Calendar from "expo-calendar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from "react-native-toast-message";
import { Platform } from "react-native";

const STORAGE_KEY = "phone_calendar_saved_events_v1";
const CALENDAR_NAME = "Watchify";

async function getSavedMap() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function setSavedMap(map) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {}
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

async function getOrCreateCalendarId() {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const existing = calendars.find((c) => c.title === CALENDAR_NAME);
  if (existing) return existing.id;

  let sourceId;
  let source;
  if (Platform.OS === "ios") {
    const def = await Calendar.getDefaultCalendarAsync();
    sourceId = def?.source?.id;
  } else {
    source = { isLocalAccount: true, name: CALENDAR_NAME };
  }

  return await Calendar.createCalendarAsync({
    title: CALENDAR_NAME,
    color: "#138df0",
    entityType: Calendar.EntityTypes.EVENT,
    sourceId,
    source,
    name: CALENDAR_NAME,
    ownerAccount: "personal",
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
  });
}

function buildEventPayload(item) {
  const dateStr = item.date;
  const start = new Date(dateStr + "T09:00:00");
  const end = new Date(dateStr + "T10:00:00");

  let title = item.title || "Hatırlatma";
  let notes = "";
  if (item.eventType === "note") {
    title = item.title || item.content?.slice(0, 40) || "Not";
    notes = item.content || "";
  } else if (item.eventType === "reminder_movie") {
    title = `🎬 ${item.title}`;
    notes = "Film vizyona giriyor (Watchify hatırlatması)";
  } else if (item.eventType === "reminder_tv") {
    title = `📺 ${item.title}`;
    notes = "Yeni bölüm yayınlanıyor (Watchify hatırlatması)";
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

export async function saveEventToPhoneCalendar(item) {
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== "granted") {
      Toast.show({ type: "error", text1: "Takvim izni reddedildi" });
      return { ok: false };
    }

    const key = buildEventKey(item);
    const map = await getSavedMap();
    if (map[key]) {
      Toast.show({
        type: "info",
        text1: "Zaten telefonun takvimine eklendi",
      });
      return { ok: false, alreadySaved: true };
    }

    const calendarId = await getOrCreateCalendarId();
    const payload = buildEventPayload(item);
    const eventId = await Calendar.createEventAsync(calendarId, payload);

    map[key] = { eventId, savedAt: Date.now() };
    await setSavedMap(map);

    Toast.show({ type: "success", text1: "Telefonun takvimine eklendi" });
    return { ok: true, eventId };
  } catch (err) {
    console.error("Phone calendar save error:", err);
    Toast.show({
      type: "error",
      text1: "Takvime eklenemedi",
      text2: err.message,
    });
    return { ok: false, error: err };
  }
}

export async function saveManyEventsToPhoneCalendar(items) {
  if (!items || items.length === 0) {
    return { added: 0, skipped: 0, failed: 0, total: 0 };
  }

  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== "granted") {
      Toast.show({ type: "error", text1: "Takvim izni reddedildi" });
      return { added: 0, skipped: 0, failed: 0, total: items.length };
    }

    let calendarId;
    try {
      calendarId = await getOrCreateCalendarId();
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Takvim hazırlanamadı",
        text2: err.message,
      });
      return { added: 0, skipped: 0, failed: items.length, total: items.length };
    }

    const map = await getSavedMap();
    let added = 0;
    let skipped = 0;
    let failed = 0;
    const addedKeys = [];

    for (const item of items) {
      const key = buildEventKey(item);
      if (map[key]) {
        skipped++;
        continue;
      }
      try {
        const payload = buildEventPayload(item);
        const eventId = await Calendar.createEventAsync(calendarId, payload);
        map[key] = { eventId, savedAt: Date.now() };
        addedKeys.push(key);
        added++;
      } catch (err) {
        console.warn("Bulk save failed for item:", item, err);
        failed++;
      }
    }

    await setSavedMap(map);

    const parts = [];
    if (added > 0)   parts.push(`${added} eklendi`);
    if (skipped > 0) parts.push(`${skipped} zaten vardı`);
    if (failed > 0)  parts.push(`${failed} başarısız`);

    Toast.show({
      type: added > 0 ? "success" : "info",
      text1:
        added > 0
          ? "Telefonun takvimine aktarıldı"
          : skipped === items.length
            ? "Hepsi zaten ekliydi"
            : "Aktarım tamamlandı",
      text2: parts.join(" • "),
    });

    return { added, skipped, failed, total: items.length, addedKeys };
  } catch (err) {
    console.error("Bulk save error:", err);
    Toast.show({
      type: "error",
      text1: "Aktarım başarısız",
      text2: err.message,
    });
    return { added: 0, skipped: 0, failed: items.length, total: items.length };
  }
}

export async function removeEventFromPhoneCalendar(item) {
  try {
    const key = buildEventKey(item);
    const map = await getSavedMap();
    if (!map[key]) return { ok: false };
    try {
      await Calendar.deleteEventAsync(map[key].eventId);
    } catch (err) {
      console.warn("Phone calendar delete error:", err);
    }
    delete map[key];
    await setSavedMap(map);
    Toast.show({ type: "info", text1: "Telefonun takviminden kaldırıldı" });
    return { ok: true };
  } catch (err) {
    console.error("Phone calendar remove error:", err);
    return { ok: false, error: err };
  }
}

export async function removeManyEventsFromPhoneCalendar(items) {
  if (!items || items.length === 0) {
    return { removed: 0, skipped: 0, failed: 0, total: 0 };
  }

  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== "granted") {
      Toast.show({ type: "error", text1: "Takvim izni reddedildi" });
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
        await Calendar.deleteEventAsync(map[key].eventId);
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
    if (removed > 0) parts.push(`${removed} silindi`);
    if (skipped > 0) parts.push(`${skipped} zaten yoktu`);

    Toast.show({
      type: removed > 0 ? "success" : "info",
      text1:
        removed > 0
          ? "Telefon takviminden silindi"
          : "Silinecek kayıt yok",
      text2: parts.join(" • ") || undefined,
    });

    return { removed, skipped, failed, total: items.length, removedKeys };
  } catch (err) {
    console.error("Bulk remove error:", err);
    Toast.show({
      type: "error",
      text1: "Silme başarısız",
      text2: err.message,
    });
    return { removed: 0, skipped: 0, failed: items.length, total: items.length };
  }
}
