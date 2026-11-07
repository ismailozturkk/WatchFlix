// Grup mesaj yetkileri: utils/groupRoles.js. firestore.rules'taki
// canDeleteGroupMessageOf / canSendGroupMessageNow AYNI tabloyu uygular
// (emülatör testi: __tests__/rules/firestore.rules.test.js "grup mesaj yetkileri").
import {
  canDeleteGroupMessage,
  canSendGroupMessage,
  isAdminsOnlyGroup,
} from "../utils/groupRoles";

const GROUP = {
  createdBy: "kurucu",
  admins: ["yonetici", "yonetici2"],
  members: ["kurucu", "yonetici", "yonetici2", "uye", "uye2"],
};

describe("canDeleteGroupMessage", () => {
  test.each([
    // [silen, gönderen, beklenen]
    ["uye", "uye", true],
    ["uye", "uye2", false],
    ["uye", "yonetici", false],
    ["uye", "kurucu", false],
    ["yonetici", "uye", true],
    ["yonetici", "yonetici", true],
    ["yonetici", "yonetici2", false],
    ["yonetici", "kurucu", false],
    ["kurucu", "uye", true],
    ["kurucu", "yonetici", true],
    ["kurucu", "kurucu", true],
  ])("%s → %s mesajı: %s", (actor, sender, expected) => {
    expect(canDeleteGroupMessage(GROUP, actor, sender)).toBe(expected);
  });

  test("kurucu admins listesine yazılmış eski grupta da yönetici sayılmaz", () => {
    const legacy = { ...GROUP, admins: ["kurucu", "yonetici"] };
    expect(canDeleteGroupMessage(legacy, "yonetici", "kurucu")).toBe(false);
  });

  test("eksik kimlikte silme yok", () => {
    expect(canDeleteGroupMessage(GROUP, "", "uye")).toBe(false);
    expect(canDeleteGroupMessage(GROUP, "kurucu", undefined)).toBe(false);
  });
});

describe("canSendGroupMessage", () => {
  test("ayar yoksa ya da kapalıysa herkes yazar", () => {
    expect(isAdminsOnlyGroup(GROUP)).toBe(false);
    expect(canSendGroupMessage(GROUP, "uye")).toBe(true);
    expect(canSendGroupMessage({ ...GROUP, adminsOnlyMessages: false }, "uye")).toBe(true);
  });

  test("ayar açıkken yalnız kurucu ve yöneticiler yazar", () => {
    const locked = { ...GROUP, adminsOnlyMessages: true };
    expect(isAdminsOnlyGroup(locked)).toBe(true);
    expect(canSendGroupMessage(locked, "uye")).toBe(false);
    expect(canSendGroupMessage(locked, "yonetici")).toBe(true);
    expect(canSendGroupMessage(locked, "kurucu")).toBe(true);
    expect(canSendGroupMessage(locked, "")).toBe(false);
  });
});
