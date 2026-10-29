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
  requestCalls: 0,
};

// Fabrika import'lar çalışırken (const başlatılmadan) tetiklenir; Platform
// bu yüzden çağrı anında okunan bir getter.
jest.mock("react-native", () => ({
  get Platform() {
    return mockPlatform;
  },
}));
jest.mock("../components/AppToast", () => {
  const mockApi = {
    show: jest.fn(), hide: jest.fn(), success: jest.fn(), error: jest.fn(), warning: jest.fn(),
    info: jest.fn(), loading: jest.fn(), badge: jest.fn(), premium: jest.fn(), undo: jest.fn(),
    update: jest.fn(), promise: jest.fn(), clear: jest.fn(),
  };
  return { __esModule: true, default: mockApi, toast: mockApi, showToast: mockApi.show };
});
// Plan (services/premiumState): not hatırlatmasını telefona eklemek Premium'a özel.
const mockPremium = { plan: "premium" };
jest.mock("../services/premiumState", () => ({ getPremiumPlanSnapshot: () => mockPremium.plan }));
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

    async getCalendarPermissions() {
      return mockState.permissionGranted
        ? { granted: true, status: "granted", canAskAgain: true }
        : { granted: false, status: "denied", canAskAgain: false };
    },
    async requestCalendarPermissions() {
      mockState.requestCalls++;
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

import Toast from "../components/AppToast";
import { __resetAllMMKV } from "react-native-mmkv";
import { __resetStores } from "../services/storage/instances";
import { __resetStoreCaches } from "../services/storage/store";
import {
  buildEventKey,
  countSavedPhoneEvents,
  getCalendarPermissionState,
  loadSavedKeysSet,
  removeAllEventsFromPhoneCalendar,
  removeEventFromPhoneCalendar,
  removeManyEventsFromPhoneCalendar,
  isPhoneCalendarItemLocked,
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
  mockState.requestCalls = 0;
  mockPremium.plan = "premium";
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

describe("geri al (Takvim ekranı)", () => {
  // Toast.show'un son çağrısındaki "Geri Al" eylemi.
  const lastUndo = () => {
    const calls = Toast.show.mock.calls;
    return calls[calls.length - 1][0].props?.action;
  };

  it("tek eklemede toast'a Geri Al koyar; basınca etkinliği kaldırır ve kümeyi günceller", async () => {
    const onSavedChange = jest.fn();
    await saveEventToPhoneCalendar(movie, { onSavedChange });

    const toast = Toast.show.mock.calls[0][0];
    expect(toast.type).toBe("success");
    // Varsayılan 3 sn düğmeye basmaya yetmez.
    expect(toast.visibilityTime).toBeGreaterThan(3000);
    expect(toast.props.action.label).toBe("Geri Al");

    await toast.props.action.onPress();

    expect(mockState.events.size).toBe(0);
    expect((await loadSavedKeysSet()).size).toBe(0);
    expect(onSavedChange).toHaveBeenCalledWith(buildEventKey(movie), false);
    // Geri almanın kendisi tekrar geri alınmaz: yalnız bilgi toast'ı.
    expect(lastUndo()).toBeUndefined();
    expect(Toast.show).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "info", text1: "Geri alındı" }),
    );
  });

  it("onSavedChange verilmezse eskisi gibi düz toast gösterir (Geri Al yok)", async () => {
    await saveEventToPhoneCalendar(movie);
    expect(Toast.show.mock.calls[0][0].props).toBeUndefined();
  });

  it("tek silmede toast'a Geri Al koyar; basınca etkinliği yeniden ekler", async () => {
    await saveEventToPhoneCalendar(movie);
    Toast.show.mockClear();
    const onSavedChange = jest.fn();

    expect(await removeEventFromPhoneCalendar(movie, { onSavedChange })).toEqual({ ok: true });
    expect(mockState.events.size).toBe(0);

    await lastUndo().onPress();

    expect(mockState.events.size).toBe(1);
    expect((await loadSavedKeysSet()).has(buildEventKey(movie))).toBe(true);
    expect(onSavedChange).toHaveBeenCalledWith(buildEventKey(movie), true);
    expect(lastUndo()).toBeUndefined();
  });

  it("izin kapalıyken tek silme kayda ve takvime dokunmaz (sahipsiz etkinlik bırakmaz)", async () => {
    await saveEventToPhoneCalendar(movie);
    mockState.permissionGranted = false;
    Toast.show.mockClear();

    const res = await removeEventFromPhoneCalendar(movie, { onSavedChange: jest.fn() });

    expect(res).toEqual({ ok: false });
    expect(mockState.events.size).toBe(1);
    expect(await countSavedPhoneEvents()).toBe(1);
    expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
  });

  it("toplu eklemeyi geri alır: yalnız bu çağrıda eklenenleri kaldırır", async () => {
    await saveEventToPhoneCalendar(movie); // önceden vardı → geri alma dokunmamalı
    Toast.show.mockClear();
    const onSavedChange = jest.fn();

    const res = await saveManyEventsToPhoneCalendar([movie, episode, note], { onSavedChange });
    expect(res).toMatchObject({ added: 2, skipped: 1 });

    await lastUndo().onPress();

    expect(mockState.events.size).toBe(1);
    expect([...(await loadSavedKeysSet())]).toEqual([buildEventKey(movie)]);
    expect(onSavedChange).toHaveBeenCalledTimes(2);
    expect(onSavedChange).toHaveBeenCalledWith(buildEventKey(episode), false);
    expect(onSavedChange).toHaveBeenCalledWith(buildEventKey(note), false);
  });

  it("hiçbir şey eklenmediyse toplu toast'ta Geri Al yok", async () => {
    await saveManyEventsToPhoneCalendar([movie]);
    Toast.show.mockClear();

    await saveManyEventsToPhoneCalendar([movie], { onSavedChange: jest.fn() });

    expect(lastUndo()).toBeUndefined();
  });

  it("toplu silmeyi geri alır: silinenleri yeniden ekler", async () => {
    await saveManyEventsToPhoneCalendar([movie, episode, note]);
    Toast.show.mockClear();
    const onSavedChange = jest.fn();

    const res = await removeManyEventsFromPhoneCalendar([movie, episode], { onSavedChange });
    expect(res.removedKeys).toEqual([buildEventKey(movie), buildEventKey(episode)]);
    expect(mockState.events.size).toBe(1);

    await lastUndo().onPress();

    expect(mockState.events.size).toBe(3);
    expect((await loadSavedKeysSet()).size).toBe(3);
    expect(onSavedChange).toHaveBeenCalledWith(buildEventKey(movie), true);
    expect(onSavedChange).toHaveBeenCalledWith(buildEventKey(episode), true);
    expect(mockState.legacyCalls).toEqual([]);
  });

  it("silent: başarı toast'ını susturur", async () => {
    await saveEventToPhoneCalendar(movie, { silent: true });
    await removeEventFromPhoneCalendar(movie, { silent: true });
    await saveManyEventsToPhoneCalendar([movie], { silent: true });
    await removeManyEventsFromPhoneCalendar([movie], { silent: true });

    expect(Toast.show).not.toHaveBeenCalled();
  });
});

describe("Ayarlar > İzinlerim > Takvim", () => {
  it("izin durumunu okur ve sistem diyaloğu AÇMAZ", async () => {
    expect(await getCalendarPermissionState()).toEqual({
      status: "granted",
      canAskAgain: true,
    });

    mockState.permissionGranted = false;
    expect(await getCalendarPermissionState()).toEqual({
      status: "denied",
      canAskAgain: false,
    });
    expect(mockState.requestCalls).toBe(0);
  });

  it("Seelogd'un eklediği etkinlikleri sayar", async () => {
    expect(await countSavedPhoneEvents()).toBe(0);
    await saveManyEventsToPhoneCalendar([movie, episode, note]);
    expect(await countSavedPhoneEvents()).toBe(3);
  });

  it("hepsini kaldırır: telefondan siler, kaydı sıfırlar, eski API'ye dokunmaz", async () => {
    await saveManyEventsToPhoneCalendar([movie, episode, note]);
    expect(mockState.events.size).toBe(3);
    Toast.show.mockClear(); // yukarıdaki ekleme toast'ı sayılmasın

    const res = await removeAllEventsFromPhoneCalendar();

    expect(res).toEqual({ removed: 3, missing: 0, total: 3 });
    expect(mockState.events.size).toBe(0);
    expect(await countSavedPhoneEvents()).toBe(0);
    expect(mockState.legacyCalls).toEqual([]);
    // Toplu kaldırma sonucu kendi sayfasında anlatılır; toast çıkmaz.
    expect(Toast.show).not.toHaveBeenCalled();
  });

  it("telefonda artık bulunamayan etkinliği ayrı sayar ve kayıttan da temizler", async () => {
    await saveManyEventsToPhoneCalendar([movie, episode]);
    // Kullanıcı etkinliklerden birini takvim uygulamasından kendisi silmiş.
    mockState.events.delete([...mockState.events.keys()][0]);

    const res = await removeAllEventsFromPhoneCalendar();

    expect(res).toEqual({ removed: 1, missing: 1, total: 2 });
    expect(await countSavedPhoneEvents()).toBe(0);
  });

  it("izin kapalıyken kayda ve takvime dokunmaz (sahipsiz etkinlik bırakmaz)", async () => {
    await saveManyEventsToPhoneCalendar([movie, episode]);
    mockState.permissionGranted = false;
    const requestsBefore = mockState.requestCalls;

    const res = await removeAllEventsFromPhoneCalendar();

    expect(res).toEqual({ blocked: "no-permission", removed: 0, missing: 0, total: 2 });
    expect(mockState.events.size).toBe(2);
    expect(await countSavedPhoneEvents()).toBe(2);
    // İzin kapalıyken izin DİYALOĞU da açılmamalı (yalnız durum okunur).
    expect(mockState.requestCalls).toBe(requestsBefore);
  });

  it("kayıt boşsa izne bakmadan sıfır döner", async () => {
    mockState.permissionGranted = false;
    expect(await removeAllEventsFromPhoneCalendar()).toEqual({
      removed: 0,
      missing: 0,
      total: 0,
    });
  });
});

describe("not hatırlatması Premium'a özel (Free'de telefona yeni ekleme yok)", () => {
  it("yalnız not öğesi kilitli; film/dizi her planda serbest", () => {
    mockPremium.plan = "free";
    expect(isPhoneCalendarItemLocked(note)).toBe(true);
    expect(isPhoneCalendarItemLocked(movie)).toBe(false);
    expect(isPhoneCalendarItemLocked(episode)).toBe(false);
    mockPremium.plan = "premium";
    expect(isPhoneCalendarItemLocked(note)).toBe(false);
  });

  it("Free'de tek not: izin istenmez, takvim açılmaz, etkinlik yazılmaz", async () => {
    mockPremium.plan = "free";
    expect(await saveEventToPhoneCalendar(note)).toEqual({ ok: false, locked: true });
    expect(mockState.requestCalls).toBe(0);
    expect(mockState.createCalendarCalls).toHaveLength(0);
    expect(mockState.events.size).toBe(0);
    expect(Toast.show).not.toHaveBeenCalled();
    // Film aynı planda eklenir.
    expect((await saveEventToPhoneCalendar(movie)).ok).toBe(true);
  });

  it("Free'de toplu aktarım notları atlar, diğerlerini ekler; atlananı geri bildirir", async () => {
    mockPremium.plan = "free";
    const res = await saveManyEventsToPhoneCalendar([movie, note, episode]);
    expect(res).toMatchObject({ added: 2, skipped: 0, failed: 0, total: 3 });
    expect(res.lockedItems).toEqual([note]);
    expect((await loadSavedKeysSet()).has(buildEventKey(note))).toBe(false);
  });

  it("Free'de yalnız not varsa telefona hiç dokunulmaz", async () => {
    mockPremium.plan = "free";
    const res = await saveManyEventsToPhoneCalendar([note]);
    expect(res).toEqual({ added: 0, skipped: 0, failed: 0, total: 1, addedKeys: [], lockedItems: [note] });
    expect(mockState.createCalendarCalls).toHaveLength(0);
    expect(Toast.show).not.toHaveBeenCalled();
  });

  it("Premium'dayken eklenmiş not Free'de kalır: 'zaten vardı', kaldırılabilir, kaldırmanın Geri Al'ı geri koyar", async () => {
    await saveEventToPhoneCalendar(note);
    mockPremium.plan = "free";
    const res = await saveManyEventsToPhoneCalendar([note]);
    expect(res).toMatchObject({ added: 0, skipped: 1, lockedItems: [] });

    Toast.show.mockClear();
    const onSavedChange = jest.fn();
    expect(await removeEventFromPhoneCalendar(note, { onSavedChange })).toEqual({ ok: true });
    expect(mockState.events.size).toBe(0);
    const calls = Toast.show.mock.calls;
    await calls[calls.length - 1][0].props.action.onPress();
    expect(mockState.events.size).toBe(1);
    expect(onSavedChange).toHaveBeenCalledWith(buildEventKey(note), true);

    // Ama kaldırılmış bir notu sonradan yeniden eklemek yeni eklemedir: kapalı.
    await removeEventFromPhoneCalendar(note);
    expect(await saveEventToPhoneCalendar(note)).toEqual({ ok: false, locked: true });
  });
});
