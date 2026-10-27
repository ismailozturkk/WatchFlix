jest.mock("../services/pushNotificationsService", () => ({
  REMINDER_PREFIX: "reminder_",
  scheduleLocalNotification: jest.fn(),
  cancelScheduledNotification: jest.fn(),
  getAllScheduled: jest.fn(async () => []),
}));

import {
  dueNoteReminders,
  isReminderPast,
  markRemindersSeen,
  noteReminderAt,
  noteReminderDateValue,
  snoozedSchedule,
  suggestedReminderTime,
} from "../utils/noteReminders";
import { computeReminderSchedule } from "../services/reminderNotificationScheduler";
import { notificationContent, notificationDestination } from "../utils/notificationInbox";
import { notificationInboxCopy } from "../utils/notificationInboxCopy";

const at = (y, m, d, h = 0, min = 0) => new Date(y, m - 1, d, h, min).getTime();

describe("noteReminderAt", () => {
  test("gün + saat yerel saatle birleşir", () => {
    expect(noteReminderAt({ scheduledDate: "2026-10-28", scheduledTime: "14:30" })).toBe(at(2026, 10, 28, 14, 30));
  });
  test("saatsiz eski not 09:00", () => {
    expect(noteReminderAt({ scheduledDate: "2026-10-28" })).toBe(at(2026, 10, 28, 9));
  });
  test("geçersiz saat varsayılana düşer, tarih yoksa null", () => {
    expect(noteReminderAt({ scheduledDate: "2026-10-28", scheduledTime: "25:00" })).toBe(at(2026, 10, 28, 9));
    expect(noteReminderAt({ scheduledTime: "10:00" })).toBeNull();
  });
});

describe("cihaz bildirimi zamanı", () => {
  const now = at(2026, 10, 27, 12);
  test("seçilen saatte çalar", () => {
    const value = noteReminderDateValue({ scheduledDate: "2026-10-28", scheduledTime: "14:30" });
    expect(value).toBe("2026-10-28T14:30");
    expect(computeReminderSchedule(value, { now })?.fireMs).toBe(at(2026, 10, 28, 14, 30));
  });
  test("00:00 açık saat olarak kalır (09:00'a kaydırılmaz)", () => {
    const value = noteReminderDateValue({ scheduledDate: "2026-10-28", scheduledTime: "00:00" });
    expect(computeReminderSchedule(value, { now })?.fireMs).toBe(at(2026, 10, 28, 0, 0));
  });
  test("bugün geçmiş açık saat başka saate kaydırılmaz", () => {
    const value = noteReminderDateValue({ scheduledDate: "2026-10-27", scheduledTime: "10:00" });
    expect(computeReminderSchedule(value, { now })).toBeNull();
  });
  test("saatsiz not eski davranışı korur", () => {
    expect(noteReminderDateValue({ scheduledDate: "2026-10-28" })).toBe("2026-10-28");
  });
});

describe("saat önerisi ve geçmiş denetimi", () => {
  const now = new Date(2026, 9, 27, 13, 20);
  test("bugün → bir sonraki tam saat; başka gün → 09:00", () => {
    expect(suggestedReminderTime("2026-10-27", now)).toBe("14:00");
    expect(suggestedReminderTime("2026-10-28", now)).toBe("09:00");
    expect(suggestedReminderTime("2026-10-27", new Date(2026, 9, 27, 23, 10))).toBe("23:59");
  });
  test("isReminderPast", () => {
    expect(isReminderPast("2026-10-27", "13:00", now.getTime())).toBe(true);
    expect(isReminderPast("2026-10-27", "13:30", now.getTime())).toBe(false);
  });
  test("erteleme dakikayı yukarı yuvarlar ve gün atlar", () => {
    expect(snoozedSchedule(60, new Date(2026, 9, 27, 13, 20, 30))).toEqual({ scheduledDate: "2026-10-27", scheduledTime: "14:21" });
    expect(snoozedSchedule(60, new Date(2026, 9, 27, 23, 30))).toEqual({ scheduledDate: "2026-10-28", scheduledTime: "00:30" });
  });
});

describe("dueNoteReminders", () => {
  const now = at(2026, 10, 27, 12);
  const notes = [
    { id: "a", type: "note", title: "Film gecesi", content: "Patlamış mısır al", scheduledDate: "2026-10-27", scheduledTime: "11:00" },
    { id: "b", type: "note", scheduledDate: "2026-10-27", scheduledTime: "18:00" }, // henüz çalmadı
    { id: "c", type: "todo", title: "Liste", todos: [{ id: "1", text: "x", done: false }], scheduledDate: "2026-10-26" },
    { id: "d", type: "todo", todos: [{ id: "1", text: "x", done: true }], scheduledDate: "2026-10-26" }, // tamamlanmış
    { id: "e", type: "note", scheduledDate: "2026-09-01" }, // pencere dışında
    { id: "f", type: "note" },
  ];
  test("yalnız vadesi gelenler, en yeni başta", () => {
    const items = dueNoteReminders(notes, {}, now);
    expect(items.map((item) => item.noteId)).toEqual(["a", "c", "d"]);
    expect(items[0]).toMatchObject({ type: "note_reminder", local: true, title: "Film gecesi", text: "Patlamış mısır al", read: false, createdAt: at(2026, 10, 27, 11) });
    expect(items[1].text).toBe("• x");
    expect(items[2].read).toBe(true);
  });
  test("okundu haritası aynı anı eşler; yeniden kurulan hatırlatma yeniden okunmamış olur", () => {
    const seen = markRemindersSeen({}, dueNoteReminders(notes, {}, now).slice(0, 1), notes);
    expect(seen).toEqual({ a: at(2026, 10, 27, 11) });
    expect(dueNoteReminders(notes, seen, now)[0].read).toBe(true);
    const moved = notes.map((n) => (n.id === "a" ? { ...n, scheduledTime: "11:30" } : n));
    expect(dueNoteReminders(moved, seen, now)[0].read).toBe(false);
  });
  test("silinen notun izi temizlenir", () => {
    expect(markRemindersSeen({ gone: 1, a: 2 }, [], notes)).toEqual({ a: 2 });
  });
});

test("bildirim kutusu içeriği ve hedefi", () => {
  const copy = notificationInboxCopy("tr");
  const [item] = dueNoteReminders([{ id: "a", type: "todo", todos: [], scheduledDate: "2026-10-27" }], {}, at(2026, 10, 27, 12));
  expect(notificationContent(item, {}, copy)).toMatchObject({ icon: "alarm-outline", title: "Başlıksız liste", action: "Liste hatırlatması" });
  expect(notificationDestination(item)).toEqual({ name: "NotesScreen", params: { openNoteId: "a" } });
});
