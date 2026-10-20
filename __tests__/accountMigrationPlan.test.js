// functions/scripts/accountMigrationPlan.js — toplu göçün saf planlayıcısı.

const { planUserMigration } = require("../functions/scripts/accountMigrationPlan");

describe("planUserMigration", () => {
  it("temiz hesapta iş yok", () => {
    expect(planUserMigration({ root: { username: "ali" } })).toEqual({
      accountPatch: null,
      pushPatch: null,
      rootDelete: [],
      conflicts: [],
    });
  });

  it("e-posta + tarihi gizli belgeye taşır ve kökten siler", () => {
    const plan = planUserMigration({
      root: { email: "a@b.co", birthDate: "1998-03-05", username: "ali" },
      account: null,
    });
    expect(plan.accountPatch).toEqual({ email: "a@b.co", birthDate: "1998-03-05" });
    expect(plan.rootDelete.sort()).toEqual(["birthDate", "email"]);
  });

  it("gizli belgedeki değer KAZANIR; kök yine de silinir", () => {
    const plan = planUserMigration({
      root: { email: "eski@b.co", birthDate: "1998-03-05" },
      account: { email: "yeni@b.co", birthDate: "1998-03-05" },
    });
    expect(plan.accountPatch).toBeNull();
    expect(plan.rootDelete.sort()).toEqual(["birthDate", "email"]);
  });

  it("doğum tarihi çelişirse kökten silmez, çelişki bildirir", () => {
    const plan = planUserMigration({
      root: { birthDate: "1998-03-05", email: "a@b.co" },
      account: { birthDate: "2010-01-01" },
    });
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.rootDelete).toEqual(["email"]);
    expect(plan.accountPatch).toEqual({ email: "a@b.co" });
  });

  it("geçersiz değer kopyalanmaz ama kökten temizlenir", () => {
    const plan = planUserMigration({ root: { email: "", birthDate: null } });
    expect(plan.accountPatch).toBeNull();
    expect(plan.rootDelete.sort()).toEqual(["birthDate", "email"]);
  });

  it("push jetonları private/push ile BİRLEŞTİRİLİR (kayıp yok), kök alanlar silinir", () => {
    const plan = planUserMigration({
      root: {
        expoPushToken: "T3",
        expoPushTokens: ["T1", "T3", "T3"],
        pushTokenUpdatedAt: 1,
      },
      push: { expoPushToken: "T2", expoPushTokens: ["T1", "T2"] },
    });
    // T1 zaten var, T3 yeni (tekrarsız); tek `expoPushToken` private'ınkinde kalır.
    expect(plan.pushPatch).toEqual({ tokens: ["T3"], token: null });
    expect(plan.rootDelete.sort()).toEqual([
      "expoPushToken",
      "expoPushTokens",
      "pushTokenUpdatedAt",
    ]);
  });

  it("private/push hiç yoksa kökteki son jeton tek jeton olur", () => {
    const plan = planUserMigration({
      root: { expoPushToken: "T1", expoPushTokens: ["T1"] },
      push: null,
    });
    expect(plan.pushPatch).toEqual({ tokens: ["T1"], token: "T1" });
  });

  it("kökteki jetonların hepsi zaten private'taysa yalnız kök temizlenir", () => {
    const plan = planUserMigration({
      root: { expoPushTokens: ["T1"] },
      push: { expoPushToken: "T1", expoPushTokens: ["T1"] },
    });
    expect(plan.pushPatch).toBeNull();
    expect(plan.rootDelete).toEqual(["expoPushTokens"]);
  });
});
