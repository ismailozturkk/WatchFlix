// __tests__/phoneCalendar.test.js
//
// expo-calendar 57'de eski `...Async` fonksiyonları bilerek hata fırlatır
// ("Method requestCalendarPermissionsAsync imported from expo-calendar is
// deprecated"). phoneCalendar yalnız nesne tabanlı API'yi çağırmalı; bu test
// gerçek modülün davranışını taklit eden bir sahte ile bunu ve akışı doğrular.

const mockPlatform = { OS: "android" };
const mockState = {
  permissionGranted: true,
  failCreateCalendar: false,
  calendars: [],
  events: new Map(),
  nextId: 1,
  createCalendarCalls: [],
  legacyCalls: [],
};

// Fabrika import'lar çalışırken (const başlatılmadan) tetiklenir; Platform
// bu yüzden çağrı anında okunan bir getter.
jest.mock("react-native", () => ({
  get Platform() {
    return mockPlatform;
  },
}));
jest.mock("react-native-toast-message", () => ({
  __esModule: true,
  default: { show: jest.fn() },
}));
jest.mock("../utils/i18nText", () => ({
  i18nText: (_key, fallback, options) =>
    options?.count != null ? fallback.replace("{{count}}", options.count) : fallback,
}));
jest.mock("expo-calendar", () => {
  const legacy = (name) => async () => {
    mockState.legacyCalls.push(name);
    throw new Error(`Method ${name} imported from "expo-calendar" is deprecated.`);
  };

  const makeCalendar = (data) => ({
    allowsModifications: true,
    ...data,
    async createEvent(details) {
      const id = String(mockState.nextId++);
      mockState.events.set(id, { id, calendarId: data.id, ...details });
      return {
        id,
        async delete() {
          mockState.events.delete(id);
        },
      };
    },
  });

  return {
    EntityTypes: { EVENT: "event", REMINDER: "reminder" },
    CalendarAccessLevel: { OWNER: "owner" },
    // Eski API: çağrılırsa gerçek paketteki gibi patlar.
    requestCalendarPermissionsAsync: legacy("requestCalendarPermissionsAsync"),
    getCalendarsAsync: legacy("getCalendarsAsync"),
    createCalendarAsync: legacy("createCalendarAsync"),
    createEventAsync: legacy("createEventAsync"),
    deleteEventAsync: legacy("deleteEventAsync"),
    getDefaultCalendarAsync: legacy("getDefaultCalendarAsync"),

    async requestCalendarPermissions() {
      return mockState.permissionGranted
        ? { granted: true, status: "granted" }
        : { granted: false, status: "denied" };
    },
    async getCalendars() {
      return mockState.calendars.map(makeCalendar);
    },
    async createCalendar(details) {
      mockState.createCalendarCalls.push(details);
      if (mockState.failCreateCalendar) throw new Error("source does not allow calendars");
      const data = { id: `cal-${mockState.nextId++}`, title: details.title };
      mockState.calendars.push(data);
      return makeCalendar(data);
    },
    getDefaultCalendarSync() {
      return makeCalendar({ id: "default", title: "Calendar" });
    },
    ExpoCalendarEvent: {
      async get(id) {
        const found = mockState.events.get(id);
        if (!found) throw new Error("Event not found");
        return {
          id,
          async delete() {
            mockState.events.delete(id);
          },
        };
      },
    },
  };
});

import Toast from "react-native-toast-message";
import { __resetAllMMKV } from "react-native-mmkv";
import { __resetStores } from "../services/storage/instances";
import { __resetStoreCaches } from "../services/storage/store";
import {
  buildEventKey,
  loadSavedKeysSet,
  removeEventFromPhoneCalendar,
  removeManyEventsFromPhoneCalendar,
  saveEventToPhoneCalendar,
  saveManyEventsToPhoneCalendar,
} from "../utils/phoneCalendar";

const movie = { id: 7, eventType: "reminder_movie", title: "Dune", date: "2026-11-20" };
const episode = {
  id: 9,
  eventType: "reminder_tv",
  title: "Severance",
  date: "2026-11-21",
  seasonNumber: 2,
  episodeNumber: 3,
};
const note = { id: "n1", eventType: "note", title: "", content: "Bilet al", date: "2026-11-22" };

beforeEach(() => {
  __resetStores();
  __resetAllMMKV();
  __resetStoreCaches();
  mockPlatform.OS = "android";
  mockState.permissionGranted = true;
  mockState.failCreateCalendar = false;
  mockState.calendars = [];
  mockState.events = new Map();
  mockState.nextId = 1;
  mockState.createCalendarCalls = [];
  mockState.legacyCalls = [];
  Toast.show.mockClear();
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("saveEventToPhoneCalendar", () => {
  it("eski (deprecated) Async API'lerini hiç çağırmadan etkinliği ekler", async () => {
    const res = await saveEventToPhoneCalendar(movie);

    expect(res.ok).toBe(true);
    expect(mockState.legacyCalls).toEqual([]);
    expect(mockState.events.size).toBe(1);
    const created = [...mockState.events.values()][0];
    expect(created.title).toBe("🎬 Dune");
    expect(created.alarms).toEqual([{ relativeOffset: -60 }]);
    expect(created.startDate.getHours()).toBe(9);
    expect(created.endDate.getHours()).toBe(10);
    expect((await loadSavedKeysSet()).has(buildEventKey(movie))).toBe(true);
  });

  it("Android'de Seelogd takvimini yerel hesapla oluşturur", async () => {
    await saveEventToPhoneCalendar(movie);

    expect(mockState.createCalendarCalls).toHaveLength(1);
    expect(mockState.createCalendarCalls[0]).toMatchObject({
      title: "Seelogd",
      entityType: "event",
      source: { isLocalAccount: true, name: "Seelogd" },
    });
  });

  it("iOS'ta kaynak vermez (yerel taraf varsayılan kaynağı seçer)", async () => {
    mockPlatform.OS = "ios";
    await saveEventToPhoneCalendar(movie);

    expect(mockState.createCalendarCalls[0].source).toBeUndefined();
  });

  it("varolan Seelogd takvimini yeniden kullanır", async () => {
    await saveEventToPhoneCalendar(movie);
    await saveEventToPhoneCalendar(episode);

    expect(mockState.createCalendarCalls).toHaveLength(1);
    expect(mockState.events.size).toBe(2);
  });

  it("aynı etkinliği ikinci kez eklemez", async () => {
    await saveEventToPhoneCalendar(movie);
    const again = await saveEventToPhoneCalendar(movie);

    expect(again).toEqual({ ok: false, alreadySaved: true });
    expect(mockState.events.size).toBe(1);
  });

  it("izin verilmezse hiçbir takvime dokunmaz", async () => {
    mockState.permissionGranted = false;
    const res = await saveEventToPhoneCalendar(movie);

    expect(res).toEqual({ ok: false });
    expect(mockState.createCalendarCalls).toHaveLength(0);
    expect(mockState.events.size).toBe(0);
    expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
  });

  it("Seelogd takvimi oluşturulamazsa yazılabilir takvime düşer", async () => {
    mockPlatform.OS = "ios";
    mockState.failCreateCalendar = true;
    const res = await saveEventToPhoneCalendar(movie);

    expect(res.ok).toBe(true);
    expect([...mockState.events.values()][0].calendarId).toBe("default");
  });
});

describe("saveManyEventsToPhoneCalendar", () => {
  it("ekleneni, zaten olanı ve boş girdiyi doğru sayar", async () => {
    expect(await saveManyEventsToPhoneCalendar([])).toEqual({
      added: 0,
      skipped: 0,
      failed: 0,
      total: 0,
    });

    await saveEventToPhoneCalendar(movie);
    const res = await saveManyEventsToPhoneCalendar([movie, episode, note]);

    expect(res).toMatchObject({ added: 2, skipped: 1, failed: 0, total: 3 });
    expect(res.addedKeys).toEqual([buildEventKey(episode), buildEventKey(note)]);
    expect(mockState.legacyCalls).toEqual([]);
  });

  it("izin yokken hiçbirini eklemez", async () => {
    mockState.permissionGranted = false;
    const res = await saveManyEventsToPhoneCalendar([movie, episode]);

    expect(res).toEqual({ added: 0, skipped: 0, failed: 0, total: 2 });
    expect(mockState.events.size).toBe(0);
  });
});

describe("silme", () => {
  it("tek etkinliği telefondan ve kayıttan kaldırır", async () => {
    await saveEventToPhoneCalendar(movie);
    const res = await removeEventFromPhoneCalendar(movie);

    expect(res).toEqual({ ok: true });
    expect(mockState.events.size).toBe(0);
    expect(mockState.legacyCalls).toEqual([]);
    expect((await loadSavedKeysSet()).size).toBe(0);
  });

  it("kaydı olmayan etkinlik için bir şey yapmaz", async () => {
    expect(await removeEventFromPhoneCalendar(movie)).toEqual({ ok: false });
  });

  it("toplu silmede telefonda artık olmayan etkinlik de kayıttan temizlenir", async () => {
    await saveManyEventsToPhoneCalendar([movie, episode]);
    // Kullanıcı etkinliklerden birini takvim uygulamasından kendisi silmiş.
    mockState.events.delete([...mockState.events.keys()][0]);

    const res = await removeManyEventsFromPhoneCalendar([movie, episode, note]);

    expect(res).toMatchObject({ removed: 2, skipped: 1, failed: 1, total: 3 });
    expect(mockState.events.size).toBe(0);
    expect((await loadSavedKeysSet()).size).toBe(0);
    expect(mockState.legacyCalls).toEqual([]);
  });
});
