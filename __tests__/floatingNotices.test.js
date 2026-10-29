// Yüzen bildirimlerin saf kararları (utils/floatingNotices.js) ve metinleri (utils/floatingNoticeCopy.js).
//
// Kilitlenenler:
//   • yalnız yanıt bekleyen davet bildirim olur, en yenisi önde; davet her zaman özel anlardan önce
//   • turnuvada yalnız dört an duyurulur (açılış, Son 32, final, sonuçlar); ara turlar sessiz
//   • her bildirim bir kez toast olur; kapatılan an geri gelmez; eski kayıtlar budanır
//   • simge kenara oturur (yarı + fırlatma), dikeyde güvenli alana sığar; kart ↔ simge dönüşüm hesabı
//   • kabul edilen davetin açtığı ekranlar katmanın gizli rotalarında (oyun açılınca simge çekilir)
const {
  BUBBLE_SIZE,
  DOCK_BOTTOM_RESERVE,
  DOCK_EDGE,
  DOCK_TOP_RESERVE,
  FLOATING_NOTICE_HIDDEN_ROUTES,
  NOTICE_KIND,
  NOTICE_STATE_TTL_MS,
  NOTICE_TOAST_MS,
  dockBounds,
  dockOrigin,
  eventDestination,
  floatingNoticesAllowed,
  inviteNotices,
  markNoticeDismissed,
  markNoticesAnnounced,
  morphToDock,
  nextAnnouncement,
  nextNoticeId,
  noticeAppearance,
  resolveDock,
  snapDock,
  tournamentNotice,
  tournamentStepAt,
  visibleNotices,
} = require("../utils/floatingNotices");
const { FLOATING_NOTICE_COPY, floatingNoticeCopy, floatingNoticeText } = require("../utils/floatingNoticeCopy");
const { invitationDestination } = require("../utils/importantInvites");
const { dayKeyOf } = require("../utils/dailyChallenge");

const NOW = new Date(2026, 9, 22, 12, 0, 0).getTime();
const DAY = 24 * 60 * 60 * 1000;
const room = { id: "room", type: "cineswipe_invite", inviteCode: "123456", fromName: "Ada", createdAt: NOW - 60_000 };
const duel = { id: "duel", type: "game_challenge", dayKey: dayKeyOf(NOW), fromName: "Can", createdAt: NOW - 1_000 };

describe("katman nerede görünür", () => {
  test("oturum yoksa ya da gizli rotadaysa görünmez", () => {
    expect(floatingNoticesAllowed({ signedIn: false, routeName: "ProfileScreen" })).toBe(false);
    expect(floatingNoticesAllowed({ signedIn: true, routeName: "ChatScreen" })).toBe(false);
    expect(floatingNoticesAllowed({ signedIn: true, routeName: "ProfileScreen" })).toBe(true);
    expect(floatingNoticesAllowed({ signedIn: true, routeName: null })).toBe(true);
  });

  test("kabul edilen davetin açtığı ekran gizli rota: oyun/CineSwipe açılınca katman çekilir", () => {
    const cine = invitationDestination({ ...room, fromUid: "u1" });
    // Düello rotası yalnız bugünün daveti için kurulur (gerçek saat).
    const game = invitationDestination({ ...duel, dayKey: dayKeyOf(), fromUid: "u2" });
    expect(FLOATING_NOTICE_HIDDEN_ROUTES.has(cine.name)).toBe(true);
    expect(FLOATING_NOTICE_HIDDEN_ROUTES.has(game.name)).toBe(true);
  });
});

describe("davet bildirimleri", () => {
  test("yalnız bekleyenler, en yeni önde, kimlik bildirim kaydına bağlı", () => {
    const answered = { ...room, id: "old", response: "accepted" };
    const expired = { ...room, id: "expired", createdAt: NOW - 2 * DAY };
    const list = inviteNotices([room, answered, expired, duel], NOW);
    expect(list.map((n) => n.id)).toEqual(["invite:duel", "invite:room"]);
    expect(list[0]).toMatchObject({ kind: NOTICE_KIND.invite, sourceId: "duel", type: "game_challenge", item: duel });
  });

  test("bozuk girdi boş liste", () => {
    expect(inviteNotices(null, NOW)).toEqual([]);
  });
});

describe("turnuva anları", () => {
  const at = (day, hour = 12) => new Date(2026, 10, day, hour).getTime(); // Kasım 2026

  test("açılış, Son 32, final ve sonuçlar duyurulur; ara turlar sessiz", () => {
    expect(tournamentStepAt(at(1))).toMatchObject({ periodId: "2026-11", step: "selection", monthIndex: 10 });
    expect(tournamentStepAt(at(8))).toMatchObject({ step: "r32" });
    expect(tournamentStepAt(at(10))).toBeNull(); // Son 16
    expect(tournamentStepAt(at(12))).toBeNull(); // Çeyrek final
    expect(tournamentStepAt(at(14))).toBeNull(); // Yarı final
    expect(tournamentStepAt(at(18))).toMatchObject({ step: "final" });
    expect(tournamentStepAt(at(27))).toMatchObject({ step: "results" });
  });

  test("anın başlangıcı ve bitişi takvimden", () => {
    const step = tournamentStepAt(at(8));
    expect(step.startsAt).toBe(new Date(2026, 10, 8, 0).getTime());
    expect(step.endsAt).toBe(new Date(2026, 10, 10, 0).getTime());
    const results = tournamentStepAt(at(27));
    expect(results.endsAt).toBe(new Date(2026, 11, 1, 0).getTime());
  });

  test("bildirim kimliği ay + an; gittiği ekran turnuva", () => {
    const notice = tournamentNotice(tournamentStepAt(at(2)));
    expect(notice).toMatchObject({ id: "event:tournament:2026-11:selection", kind: NOTICE_KIND.event, step: "selection" });
    expect(eventDestination(notice)).toEqual({ name: "TournamentScreen" });
    expect(tournamentNotice(null)).toBeNull();
  });
});

describe("sıra, duyuru ve kapatma", () => {
  const invites = inviteNotices([room, duel], NOW);
  const event = tournamentNotice(tournamentStepAt(new Date(2026, 10, 2).getTime()));

  test("davetler önce; kapatılan an listede yok", () => {
    expect(visibleNotices({ invites, events: [event] }).map((n) => n.kind)).toEqual(["invite", "invite", "event"]);
    expect(visibleNotices({ invites: [], events: [event], dismissed: { [event.id]: NOW } })).toEqual([]);
  });

  test("toast olacak: en yeni davet; hepsi duyurulmuş sayılır", () => {
    const all = visibleNotices({ invites, events: [event] });
    const { target, fresh } = nextAnnouncement(all, {});
    expect(target.id).toBe("invite:duel");
    expect(fresh).toEqual(["invite:duel", "invite:room", event.id]);
    expect(nextAnnouncement(all, { "invite:duel": NOW, "invite:room": NOW }).target.id).toBe(event.id);
    expect(nextAnnouncement(all, Object.fromEntries(fresh.map((id) => [id, NOW])))).toEqual({ target: null, fresh: [] });
  });

  test("durum kaydı: işaretler, eski girdileri budar, bozuk kaydı onarır", () => {
    const old = NOW - NOTICE_STATE_TTL_MS - 1;
    const state = markNoticesAnnounced({ announced: { stale: old, keep: NOW - DAY }, dismissed: { gone: old } }, ["a"], NOW);
    expect(state).toEqual({ announced: { keep: NOW - DAY, a: NOW }, dismissed: {} });
    expect(markNoticeDismissed("bozuk", "e", NOW)).toEqual({ announced: {}, dismissed: { e: NOW } });
  });

  test("sayfalayıcı sona gelince başa döner", () => {
    expect(nextNoticeId(invites, "invite:duel")).toBe("invite:room");
    expect(nextNoticeId(invites, "invite:room")).toBe("invite:duel");
    expect(nextNoticeId([], "x")).toBeNull();
  });

  test("toast süresi: davet daha uzun (seçim zorunlu)", () => {
    expect(NOTICE_TOAST_MS.invite).toBeGreaterThan(NOTICE_TOAST_MS.event);
  });
});

describe("görünüm", () => {
  test("davet ve an türüne göre simge + koyu geçiş", () => {
    expect(noticeAppearance({ kind: "invite", type: "cineswipe_invite" }).icon).toBe("film");
    expect(noticeAppearance({ kind: "invite", type: "game_challenge" }).icon).toBe("flash");
    expect(noticeAppearance({ kind: "event", step: "results" })).toMatchObject({ icon: "medal", accent: "#D97706" });
    expect(noticeAppearance({ kind: "event", step: "bilinmeyen" }).icon).toBe("notifications");
  });
});

describe("kenar yuvası", () => {
  const bounds = dockBounds({ width: 390, height: 844, insetTop: 47, insetBottom: 34 });

  test("alan güvenli alan + başlık/sekme payı kadar daralır", () => {
    expect(bounds.minY).toBe(47 + DOCK_TOP_RESERVE);
    expect(bounds.maxY).toBe(844 - 34 - DOCK_BOTTOM_RESERVE - BUBBLE_SIZE);
    expect(bounds.leftX).toBe(DOCK_EDGE);
    expect(bounds.rightX).toBe(390 - BUBBLE_SIZE - DOCK_EDGE);
  });

  test("kayıt yoksa sağ kenar; kayıtlı yer alana sığdırılır", () => {
    const fallback = resolveDock(null, bounds);
    expect(fallback.side).toBe("right");
    expect(fallback.y).toBeGreaterThan(bounds.minY);
    expect(fallback.y).toBeLessThan(bounds.maxY);
    expect(resolveDock({ side: "left", y: 5 }, bounds)).toEqual({ side: "left", y: bounds.minY });
    expect(resolveDock({ side: "yan", y: 99999 }, bounds)).toEqual({ side: "right", y: bounds.maxY });
    expect(dockOrigin({ side: "left", y: 300 }, bounds)).toEqual({ x: bounds.leftX, y: 300 });
  });

  test("bırakınca en yakın kenar; hızlı fırlatma karşı kenara taşır", () => {
    expect(snapDock({ x: 60, y: 400 }, bounds)).toEqual({ side: "left", y: 400 });
    expect(snapDock({ x: 250, y: 400 }, bounds).side).toBe("right");
    expect(snapDock({ x: 120, y: 400, velocityX: 1400 }, bounds).side).toBe("right");
    expect(snapDock({ x: 300, y: 2000 }, bounds).y).toBe(bounds.maxY);
  });

  test("kart ↔ simge: merkezden merkeze kayma, simge genişliğine ölçek", () => {
    const morph = morphToDock({ screenWidth: 390, cardTop: 55, cardWidth: 362, cardHeight: 150, dockX: 324, dockY: 500 });
    expect(morph.dx).toBe(324 + BUBBLE_SIZE / 2 - 195);
    expect(morph.dy).toBe(500 + BUBBLE_SIZE / 2 - (55 + 75));
    expect(morph.scale).toBeCloseTo(BUBBLE_SIZE / 362);
  });
});

describe("metinler", () => {
  test("her dilde aynı anahtarlar ve dört turnuva anı", () => {
    const keys = (copy) => Object.keys(copy).sort();
    const tr = FLOATING_NOTICE_COPY.tr;
    Object.entries(FLOATING_NOTICE_COPY).forEach(([language, copy]) => {
      expect([language, keys(copy)]).toEqual([language, keys(tr)]);
      expect(Object.keys(copy.tournament).sort()).toEqual(["final", "r32", "results", "selection"]);
      Object.values(copy.tournament).forEach((step) => {
        expect(step.title).toBeTruthy();
        expect(step.cta).toBeTruthy();
        expect(step.detail("X")).toContain("X");
      });
      expect(copy.bubble(2)).toContain("2");
    });
    expect(floatingNoticeCopy("fr")).toBe(FLOATING_NOTICE_COPY.en);
  });

  test("davet kartı: gönderen + eylem, grup adı + zaman; Kabul / Reddet", () => {
    const text = floatingNoticeText(inviteNotices([{ ...room, groupName: "Film Gecesi" }], NOW)[0], { language: "tr", now: NOW });
    expect(text).toMatchObject({
      eyebrow: "Davet",
      title: "Ada seni CineSwipe odasına davet etti",
      primary: "Kabul et",
      secondary: "Reddet",
    });
    expect(text.meta.startsWith("Film Gecesi · ")).toBe(true);
    const nameless = floatingNoticeText(inviteNotices([{ ...duel, fromName: "" }], NOW)[0], { language: "en", someone: "Someone", now: NOW });
    expect(nameless.title).toBe("Someone challenged you to a daily duel");
  });

  test("turnuva kartı: ay + tema + ana uygun düğme", () => {
    const notice = tournamentNotice(tournamentStepAt(new Date(2026, 10, 2).getTime()));
    const text = floatingNoticeText(notice, { language: "tr" });
    expect(text.eyebrow).toMatch(/^Turnuva · /);
    expect(text.title).toBe("Yeni turnuva başladı");
    expect(text.detail).toMatch(/^Bu ayın teması: .+\. Adaylar belirleniyor\.$/);
    expect(text).toMatchObject({ primary: "Turnuvaya git", secondary: "Tamam" });
  });
});
