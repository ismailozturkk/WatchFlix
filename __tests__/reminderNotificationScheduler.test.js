// Hatırlatma bildirimlerinin zamanlama mantığı. pushNotificationsService
// (expo-notifications + firebase) tamamen mocklanır — bkz. jest.config.js notu:
// bu repoda yalnız saf JS modülleri test edilir.
jest.mock("../services/pushNotificationsService", () => ({
  REMINDER_PREFIX: "reminder_",
  scheduleLocalNotification: jest.fn(async ({ identifier }) => identifier),
  cancelScheduledNotification: jest.fn(async () => {}),
  getAllScheduled: jest.fn(async () => []),
}));

import {
  computeReminderSchedule,
  syncReminderNotifications,
} from "../services/reminderNotificationScheduler";
import {
  scheduleLocalNotification,
  cancelScheduledNotification,
  getAllScheduled,
} from "../services/pushNotificationsService";

// Yerel saatle epoch ms (ay 1-tabanlı) — tetik saatleri yerel saate göre kurulur.
const at = (y, m, d, h = 0, min = 0) => new Date(y, m - 1, d, h, min, 0, 0).getTime();

describe("computeReminderSchedule", () => {
  test("gelecekteki yayın: seçilen lead-time aynen uygulanır", () => {
    expect(
      computeReminderSchedule("2030-05-10", {
        leadTimeDays: 3,
        now: at(2030, 5, 1, 10),
      }),
    ).toEqual({ fireMs: at(2030, 5, 7, 9), leadDays: 3 });
  });

  test("saat verilmemiş tarihte varsayılan saat (09:00) kullanılır", () => {
    expect(
      computeReminderSchedule("2030-05-10", { now: at(2030, 5, 1, 10) }),
    ).toEqual({ fireMs: at(2030, 5, 10, 9), leadDays: 0 });
  });

  test("lead-time penceresi kaçmışsa yayın anına düşer ve leadDays sıfırlanır", () => {
    // "1 hafta önce" seçili ama film 3 gün sonra: eskiden HİÇ bildirim yoktu.
    expect(
      computeReminderSchedule("2030-05-10", {
        leadTimeDays: 7,
        now: at(2030, 5, 7, 10),
      }),
    ).toEqual({ fireMs: at(2030, 5, 10, 9), leadDays: 0 });
  });

  test("yayın anı geçmiş ama gün bugünse aynı gün geç slota kurulur", () => {
    expect(
      computeReminderSchedule("2030-05-10", { now: at(2030, 5, 10, 14) }),
    ).toEqual({ fireMs: at(2030, 5, 10, 20), leadDays: 0 });
  });

  test("tam saat seçilmiş hatırlatma kaçınca başka saate kaydırılmaz", () => {
    // Not hatırlatması: kullanıcı 10:00'ı seçti, saat 14:00. Geç slot (20:00)
    // uygulanmaz — kaydırılan saat kullanıcının seçtiği şey değil.
    expect(
      computeReminderSchedule(at(2030, 5, 10, 10), { now: at(2030, 5, 10, 14) }),
    ).toBeNull();
  });

  test("geç slot da geçtiyse zamanlanmaz", () => {
    expect(
      computeReminderSchedule("2030-05-10", { now: at(2030, 5, 10, 21) }),
    ).toBeNull();
  });

  test("geçmiş yapım ve geçersiz tarihler zamanlanmaz", () => {
    const now = at(2030, 5, 10, 12);
    expect(computeReminderSchedule("2020-01-01", { now })).toBeNull();
    expect(computeReminderSchedule("-", { now })).toBeNull();
    expect(computeReminderSchedule("", { now })).toBeNull();
    expect(computeReminderSchedule(null, { now })).toBeNull();
  });

  test("Firestore Timestamp ve epoch ms kabul edilir", () => {
    const now = at(2030, 5, 1, 10);
    const target = at(2030, 5, 10, 18);
    expect(computeReminderSchedule(target, { now })).toEqual({
      fireMs: target,
      leadDays: 0,
    });
    expect(
      computeReminderSchedule({ toMillis: () => target }, { now }),
    ).toEqual({ fireMs: target, leadDays: 0 });
  });
});

describe("syncReminderNotifications", () => {
  const future = (mins) => Date.now() + mins * 60 * 1000;
  const job = (id, fireMs, body = "gövde") => ({
    identifier: `reminder_${id}`,
    title: id,
    body,
    fireMs,
    channelId: "reminders",
    data: { kind: "reminder" },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    getAllScheduled.mockResolvedValue([]);
  });

  test("yeni işleri zamanlar, geçmiş tetikli olanları atar", async () => {
    const res = await syncReminderNotifications([
      job("a", future(60)),
      job("b", Date.now() - 1000),
    ]);
    expect(res).toMatchObject({ scheduled: 1, cancelled: 0, kept: 0 });
    expect(scheduleLocalNotification).toHaveBeenCalledTimes(1);
    expect(scheduleLocalNotification.mock.calls[0][0].identifier).toBe("reminder_a");
  });

  test("imza aynıysa bırakır, metin değişince yeniden zamanlar", async () => {
    const fireMs = future(60);
    getAllScheduled.mockResolvedValue([
      {
        identifier: "reminder_a",
        content: { data: { sig: `${fireMs}|a|gövde` } },
      },
    ]);

    expect(await syncReminderNotifications([job("a", fireMs)])).toMatchObject({
      scheduled: 0,
      kept: 1,
    });
    expect(scheduleLocalNotification).not.toHaveBeenCalled();

    expect(
      await syncReminderNotifications([job("a", fireMs, "yeni gövde")]),
    ).toMatchObject({ scheduled: 1, kept: 0 });
    expect(cancelScheduledNotification).toHaveBeenCalledWith("reminder_a");
  });

  test("artık istenmeyen reminder_* bildirimleri iptal edilir", async () => {
    getAllScheduled.mockResolvedValue([
      { identifier: "reminder_eski", content: { data: { sig: "x" } } },
      { identifier: "social_dokunma", content: { data: {} } },
    ]);
    const res = await syncReminderNotifications([]);
    expect(res).toMatchObject({ scheduled: 0, cancelled: 1 });
    expect(cancelScheduledNotification).toHaveBeenCalledTimes(1);
    expect(cancelScheduledNotification).toHaveBeenCalledWith("reminder_eski");
  });

  test("limit verilince en yakın tarihliler zamanlanır, gerisi atlanır", async () => {
    const res = await syncReminderNotifications(
      [job("uzak", future(300)), job("yakin", future(10)), job("orta", future(60))],
      { limit: 2 },
    );
    expect(res).toMatchObject({ scheduled: 2, skipped: 1 });
    const ids = scheduleLocalNotification.mock.calls.map((c) => c[0].identifier);
    expect(ids).toEqual(["reminder_yakin", "reminder_orta"]);
  });
});
