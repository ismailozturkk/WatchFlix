// database.rules.json (Realtime Database) yapı sözleşmesi.
//
// RTDB emülatörü kurulu değil (yalnız Firestore emülatörü var, bkz. test:rules);
// bu yüzden kuralların ANLAMI burada değil, YAPISI doğrulanır: yanlışlıkla
// gevşetilmesi (başkasının presence'ine yazma, başkası adına inChat/typing
// yazma, rastgele alan yazma) bu testte kırmızı olur. Kuralları değiştirirken
// gerçek davranışı `firebase emulators:start --only database` ile ayrıca dene.

const rules = require("../database.rules.json").rules;

describe("presence", () => {
  const node = rules.presence.$uid;

  test("yalnız sahibi yazar, giriş yapan herkes okur", () => {
    expect(node[".write"]).toBe("auth != null && auth.uid === $uid");
    expect(node[".read"]).toBe("auth != null");
  });

  test("yalnız bilinen alanlar yazılabilir (bağlantılar + son görülme)", () => {
    expect(node.conns.$connId[".validate"]).toContain("newData.isNumber()");
    expect(node.lastSeen[".validate"]).toBe("newData.isNumber()");
    // Eski şemanın isOnline/lastActiveAt'i ve her türlü yabancı alan reddedilir.
    expect(node.$other[".validate"]).toBe(false);
  });

  test("bağlantı kimliği uzunluğu sınırlı", () => {
    // RTDB kurallarında alt düğüm sayısı sınırlanamaz (numChildren yok).
    expect(node.conns.$connId[".validate"]).toMatch(/length <= \d+/);
  });

  test("alt düğümlerde başkasına yazma izni açılmamış", () => {
    expect(node.conns[".write"]).toBeUndefined();
    expect(node.lastSeen[".write"]).toBeUndefined();
  });
});

describe("chatMeta", () => {
  const node = rules.chatMeta.$chatId;
  const memberOnly =
    "auth != null && ($chatId.beginsWith(auth.uid + '_') || $chatId.endsWith('_' + auth.uid))";

  test("yalnız sohbetin iki üyesi okur ve yazar", () => {
    expect(node[".read"]).toBe(memberOnly);
    expect(node[".write"]).toBe(memberOnly);
  });

  test.each(["typing", "inChat"])(
    "%s: yalnız KENDİ yuvana, bağlantı kimliği (string) olarak yazılır",
    (kind) => {
      const validate = node[kind].$uid[".validate"];
      expect(validate).toContain("$uid === auth.uid");
      expect(validate).toContain("newData.isString()");
      expect(validate).toMatch(/length <= \d+/);
    },
  );

  test("tanımsız alanlar reddedilir", () => {
    expect(node.$other[".validate"]).toBe(false);
  });
});

test("beklenmeyen üst düzey düğüm yok (yeni düğüm bilinçli eklenmeli)", () => {
  expect(Object.keys(rules).sort()).toEqual(["chatMeta", "presence"]);
});
