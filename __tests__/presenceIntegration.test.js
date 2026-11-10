// Bağlantı kaydı + "sohbet açık" bayrağı + sunucu push kararı — UÇTAN UCA.
//
// Gerçek presenceService/chatRtdb/presenceSession/chatSignals modülleri,
// bellek içi sahte RTDB üzerinde çalışır (bkz. helpers/fakeRtdb.js). Asıl hedef
// kullanıcı şikâyeti: "sohbetteyken uygulamayı doğrudan kapatınca sürekli
// çevrimiçi kalıyor". Çevrimiçi durumu özelliği 10 Kas 2026'da tümüyle kaldırıldı:
// kayıt artık YALNIZ sunucunun push kararını besler, kimse okuyamaz. Bu yüzden
// gözlem noktası "karşı tarafın gördüğü" değil, sunucunun gördüğüdür
// (isRecipientViewingChat) ve ham veridir.

global.__DEV__ = false;

jest.mock("react-native", () => ({
  AppState: require("./helpers/fakeRtdb").appState,
}));
jest.mock("firebase/database", () => require("./helpers/fakeRtdb").databaseModule);
jest.mock("../firebase", () => ({
  rtdb: {},
  auth: require("./helpers/fakeRtdb").fakeAuth,
}));
jest.mock("../utils/i18nText", () => ({
  i18nText: (_key, fallback) => fallback,
}));

const { isRecipientViewingChat } = require("../functions/chatPresence");

const flush = async () => {
  for (let i = 0; i < 60; i += 1) await Promise.resolve();
};

const CHAT = "me_friend"; // pairChatId("me","friend"): büyük uid başta

function boot() {
  jest.resetModules();
  const fake = require("./helpers/fakeRtdb");
  fake.reset();
  const presence = require("../services/presenceService");
  const chat = require("../services/chatRtdb");
  // Sunucunun kararı: "alıcı bu sohbeti şu an ekranda tutuyor mu?"
  const viewing = () => isRecipientViewingChat(fake.adminRtdb, CHAT, "me");
  return { fake, presence, chat, viewing };
}

async function goOnlineInChat(env) {
  env.presence.startPresence("me");
  env.fake.connect();
  await flush();
  env.chat.enterChat(CHAT, "me");
  await flush();
}

const connIds = (fake) => Object.keys(fake.read("presence/me/conns") || {});

describe("çevrimiçi olma", () => {
  test("bağlanınca kayıt yazılır ve onDisconnect kuruludur", async () => {
    const env = boot();
    env.presence.startPresence("me");
    env.fake.connect();
    await flush();

    expect(connIds(env.fake)).toHaveLength(1);
    expect(env.fake.pendingDisconnectOps().length).toBeGreaterThan(0);
  });

  test("sohbete girince sunucu 'ekranda' görür; yalnız inChat bayrağı yazılır", async () => {
    const env = boot();
    await goOnlineInChat(env);
    expect(await env.viewing()).toBe(true);
    expect(Object.keys(env.fake.read(`chatMeta/${CHAT}`))).toEqual(["inChat"]);
  });

  test("SON GÖRÜLME TUTULMAZ: hiçbir yolda yazılmaz, eski değer ilk bağlantıda silinir", async () => {
    const env = boot();
    env.fake.seed("presence/me", { lastSeen: 12345 });
    await goOnlineInChat(env);
    expect(env.fake.read("presence/me/lastSeen") ?? null).toBeNull();
    expect(env.fake.pendingDisconnectOps().every((op) => !op.path.includes("lastSeen"))).toBe(true);

    env.fake.emitAppState("background"); // arka plan
    await flush();
    expect(env.fake.read("presence/me/lastSeen") ?? null).toBeNull();

    env.fake.emitAppState("active");
    await flush();
    env.fake.kill(); // ani kapanış
    await flush();
    expect(env.fake.read("presence/me") ?? null).toBeNull();
  });

  test("eski şemanın takılı isOnline kalıntısı ilk çevrimiçi yazımda temizlenir", async () => {
    const env = boot();
    env.fake.seed("presence/me", { isOnline: true, lastActiveAt: 5 });

    env.presence.startPresence("me");
    env.fake.connect();
    await flush();
    const node = env.fake.read("presence/me");
    expect(node.isOnline).toBeUndefined();
    expect(node.lastActiveAt).toBeUndefined();
    expect(Object.keys(node.conns)).toHaveLength(1);
  });
});

describe("KÖK HATA: sohbetteyken uygulama kapatılınca", () => {
  test("süreç öldürülür (AppState olayı YOK): kayıt düşer, takılı bayrak geçersiz", async () => {
    const env = boot();
    await goOnlineInChat(env);
    expect(await env.viewing()).toBe(true);

    env.fake.kill(); // swipe-kill: istemci kodu çalışmaz, yalnız sunucu temizler
    await flush();

    expect(connIds(env.fake)).toEqual([]);
    // Ham bayrak hâlâ yazılı (temizlenememiş olabilir) — ama GEÇERSİZ sayılır:
    expect(env.fake.read(`chatMeta/${CHAT}/inChat/me`)).not.toBeNull();
    expect(await env.viewing()).toBe(false);
  });

  test("sunucu push'u: sohbetteyken susar, kapatınca (bayrak takılı olsa da) GİDER", async () => {
    const env = boot();
    await goOnlineInChat(env);
    expect(await isRecipientViewingChat(env.fake.adminRtdb, CHAT, "me")).toBe(true);

    env.fake.kill();
    await flush();
    expect(env.fake.read(`chatMeta/${CHAT}/inChat/me`)).not.toBeNull();
    expect(await isRecipientViewingChat(env.fake.adminRtdb, CHAT, "me")).toBe(false);
  });

  test("yeniden bağlanma sonrası ani kapanış: onDisconnect yeniden kurulduğu için temizlenir", async () => {
    const env = boot();
    await goOnlineInChat(env);

    env.fake.disconnect(); // ağ kesildi: tüm onDisconnect'ler tükendi
    await flush();
    env.fake.connect(); // yeniden bağlandı
    await flush();
    expect(connIds(env.fake)).toHaveLength(1);
    expect(env.fake.pendingDisconnectOps().length).toBeGreaterThan(0); // yeniden kuruldu
    expect(await env.viewing()).toBe(true);

    env.fake.kill(); // şimdi uygulama kapandı
    await flush();
    expect(connIds(env.fake)).toEqual([]);
    expect(await env.viewing()).toBe(false);
  });

  test("yeni soket yeni kimlik alır: ölen eski soketin gecikmeli temizliği yeni oturumu EZMEZ", async () => {
    const env = boot();
    await goOnlineInChat(env);
    const firstId = connIds(env.fake)[0];

    // Ağ değişti: yeni soket açıldı, eski soketin onDisconnect'i henüz çalışmadı.
    const staleOps = env.fake.pendingDisconnectOps();
    env.fake.disconnect();
    await flush();
    env.fake.connect();
    await flush();
    const secondId = connIds(env.fake)[0];
    expect(secondId).toBeDefined();
    expect(secondId).not.toBe(firstId);

    // Gecikmeli eski temizlik şimdi çalışsa bile yalnız ESKİ kimliği hedefler.
    staleOps.forEach((op) => {
      if (op.path.endsWith(firstId)) env.fake.seed(op.path, null);
    });
    expect(connIds(env.fake)).toEqual([secondId]);
  });
});

describe("arka plan", () => {
  test("arka plana geçince kayıt silinir, onDisconnect iptal edilir, sunucu 'ekranda değil' görür", async () => {
    const env = boot();
    await goOnlineInChat(env);

    env.fake.emitAppState("background");
    await flush();
    expect(connIds(env.fake)).toEqual([]);
    expect(env.fake.pendingDisconnectOps()).toEqual([]);
    expect(await env.viewing()).toBe(false);

    env.fake.kill(); // süreç sonradan öldürüldü: geride hiçbir şey kalmaz
    await flush();
    expect(env.fake.read("presence/me") ?? null).toBeNull();
  });

  test("arka plandayken bağlantı yenilenirse çevrimiçi YAZILMAZ", async () => {
    const env = boot();
    await goOnlineInChat(env);
    env.fake.emitAppState("background");
    await flush();

    env.fake.disconnect();
    env.fake.connect();
    await flush();
    expect(connIds(env.fake)).toEqual([]);
    expect(env.fake.pendingDisconnectOps()).toEqual([]);
  });

  test("ön plana dönünce çevrimiçi + sohbette yeniden yazılır ve onDisconnect yeniden kurulur", async () => {
    const env = boot();
    await goOnlineInChat(env);
    env.fake.emitAppState("background");
    await flush();

    env.fake.emitAppState("active");
    await flush();
    expect(connIds(env.fake)).toHaveLength(1);
    expect(env.fake.pendingDisconnectOps().length).toBeGreaterThan(0);
    expect(await env.viewing()).toBe(true);
  });

  test("arka planda başlayan süreç çevrimiçi yazmaz", async () => {
    jest.resetModules();
    const fake = require("./helpers/fakeRtdb");
    fake.reset();
    fake.appState.currentState = "background";
    const presence = require("../services/presenceService");
    presence.startPresence("me");
    fake.connect();
    await flush();
    expect(Object.keys(fake.read("presence/me/conns") || {})).toEqual([]);
  });
});

describe("çıkış", () => {
  test("auth düşmeden ÖNCE kayıt silinir (beforeAuthStateChanged kancası)", async () => {
    const env = boot();
    await goOnlineInChat(env);
    expect(typeof env.fake.fakeAuth.guard).toBe("function");

    await env.fake.fakeAuth.guard(null); // auth.signOut() bunu çağırır
    expect(connIds(env.fake)).toEqual([]);
    expect(env.fake.read("presence/me") ?? null).toBeNull();
    expect(env.fake.pendingDisconnectOps()).toEqual([]);
  });

  test("kanca aynı kullanıcı için (token yenileme) hiçbir şey yapmaz", async () => {
    const env = boot();
    await goOnlineInChat(env);
    await env.fake.fakeAuth.guard({ uid: "me" });
    expect(connIds(env.fake)).toHaveLength(1);
  });

  test("hesap değişimi: eski kullanıcı çevrimdışı, yenisi çevrimiçi", async () => {
    const env = boot();
    await goOnlineInChat(env);

    await env.fake.fakeAuth.guard({ uid: "other" });
    env.presence.startPresence("other");
    await flush();
    expect(connIds(env.fake)).toEqual([]);
    expect(Object.keys(env.fake.read("presence/other/conns") || {})).toHaveLength(1);
  });
});

describe("sohbetten ayrılma", () => {
  test("ayrılınca bayrak silinir, sunucu 'ekranda değil' görür", async () => {
    const env = boot();
    await goOnlineInChat(env);
    env.chat.leaveChat(CHAT, "me");
    await flush();
    expect(env.fake.read(`chatMeta/${CHAT}`) ?? null).toBeNull();
    expect(await env.viewing()).toBe(false);
  });
});

test("okuyucu ve 'yazıyor' API'si yok (çevrimiçi durumu özelliği kaldırıldı)", () => {
  const env = boot();
  expect(Object.keys(env.chat).sort()).toEqual(["enterChat", "leaveChat"]);
  expect(Object.keys(env.presence).sort()).toEqual([
    "getPresenceSession",
    "startPresence",
    "stopPresence",
  ]);
});
