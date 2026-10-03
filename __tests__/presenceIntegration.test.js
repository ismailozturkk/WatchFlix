// Presence + sohbet sinyalleri + sunucu push kararı — UÇTAN UCA.
//
// Gerçek presenceService/chatRtdb/presenceSession/chatSignals modülleri,
// bellek içi sahte RTDB üzerinde çalışır (bkz. helpers/fakeRtdb.js). Asıl hedef
// kullanıcı şikâyeti: "sohbetteyken uygulamayı doğrudan kapatınca sürekli
// çevrimiçi kalıyor". Karşı tarafın gördüğü durum ve sunucunun push kararı da
// aynı veriden okunur.

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
  // Arkadaşın gözünden "me"yi izle.
  const seen = [];
  const stop = chat.subscribeChatMeta(CHAT, "me", (s) => seen.push(s));
  return { fake, presence, chat, seen, last: () => seen[seen.length - 1], stop };
}

async function goOnlineInChat(env, { typing = false } = {}) {
  env.presence.startPresence("me");
  env.fake.connect();
  await flush();
  env.chat.enterChat(CHAT, "me");
  if (typing) env.chat.setTyping(CHAT, "me", true);
  await flush();
}

const connIds = (fake) => Object.keys(fake.read("presence/me/conns") || {});

describe("çevrimiçi olma", () => {
  test("bağlanınca kayıt yazılır, onDisconnect kuruludur, karşı taraf çevrimiçi görür", async () => {
    const env = boot();
    env.presence.startPresence("me");
    env.fake.connect();
    await flush();

    expect(connIds(env.fake)).toHaveLength(1);
    expect(env.fake.pendingDisconnectOps().length).toBeGreaterThan(0);
    expect(env.presence.isOnlineEffective(env.last().presence)).toBe(true);
  });

  test("sohbete girince karşı taraf 'Sohbette' ve 'yazıyor' görür", async () => {
    const env = boot();
    await goOnlineInChat(env, { typing: true });
    expect(env.last()).toMatchObject({ inChat: true, typing: true });
  });

  test("eski şemanın takılı isOnline kalıntısı ilk çevrimiçi yazımda temizlenir", async () => {
    const env = boot();
    env.fake.seed("presence/me", { isOnline: true, lastActiveAt: 5 });
    expect(env.presence.isOnlineEffective(env.fake.read("presence/me"))).toBe(false);

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
  test("süreç öldürülür (AppState olayı YOK): çevrimiçi/Sohbette/yazıyor düşer, takılı bayrak geçersiz", async () => {
    const env = boot();
    await goOnlineInChat(env, { typing: true });
    expect(env.last()).toMatchObject({ inChat: true, typing: true });

    env.fake.kill(); // swipe-kill: istemci kodu çalışmaz, yalnız sunucu temizler
    await flush();

    expect(connIds(env.fake)).toEqual([]);
    expect(typeof env.fake.read("presence/me/lastSeen")).toBe("number");
    expect(env.presence.isOnlineEffective(env.last().presence)).toBe(false);
    // Ham bayraklar hâlâ yazılı (temizlenememiş olabilir) — ama GEÇERSİZ sayılır:
    expect(env.fake.read(`chatMeta/${CHAT}/inChat/me`)).not.toBeNull();
    expect(env.last()).toMatchObject({ inChat: false, typing: false });
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
    expect(env.last()).toMatchObject({ inChat: true });

    env.fake.kill(); // şimdi uygulama kapandı
    await flush();
    expect(connIds(env.fake)).toEqual([]);
    expect(env.last()).toMatchObject({ inChat: false });
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
  test("arka plana geçince kayıt silinir, onDisconnect iptal edilir; sonraki ölüm son görülmeyi EZMEZ", async () => {
    const env = boot();
    await goOnlineInChat(env);

    env.fake.emitAppState("background");
    await flush();
    expect(connIds(env.fake)).toEqual([]);
    expect(env.fake.pendingDisconnectOps()).toEqual([]);
    expect(env.last()).toMatchObject({ inChat: false });

    const lastSeenAtBackground = env.fake.read("presence/me/lastSeen");
    env.fake.kill(); // süreç sonradan öldürüldü
    await flush();
    expect(env.fake.read("presence/me/lastSeen")).toBe(lastSeenAtBackground);
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
    expect(env.last()).toMatchObject({ inChat: true });
    expect(await isRecipientViewingChat(env.fake.adminRtdb, CHAT, "me")).toBe(true);
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
    expect(typeof env.fake.read("presence/me/lastSeen")).toBe("number");
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

describe("yazıyor", () => {
  test("sohbetten ayrılınca bayraklar silinir", async () => {
    const env = boot();
    await goOnlineInChat(env, { typing: true });
    env.chat.leaveChat(CHAT, "me");
    await flush();
    expect(env.fake.read(`chatMeta/${CHAT}`)).toBeNull();
    expect(env.last()).toMatchObject({ inChat: false, typing: false });
  });

  test("uzun süre boşta kalan 'yazıyor' denetleyici ile kapanır", async () => {
    jest.useFakeTimers();
    try {
      const env = boot();
      await goOnlineInChat(env);
      const ctrl = env.chat.createTypingController({
        send: (v) => env.chat.setTyping(CHAT, "me", v),
      });
      ctrl.input(true);
      await flush();
      expect(env.last().typing).toBe(true);

      jest.advanceTimersByTime(5000);
      await flush();
      expect(env.last().typing).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });
});
