// __tests__/storage.test.js
//
// Depolama katmanının sözleşmesi: tipli okuma, bozuk kayıtta varsayılana düşüp
// kendini onarma, kullanıcı kapsamı ve AsyncStorage → MMKV göçü.

// AsyncStorage ve MMKV taklitleri kök __mocks__ klasöründen otomatik gelir.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { __resetAllMMKV } from "react-native-mmkv";
import { Keys, get, set, remove, has, subscribe, getStore } from "../services/storage";
import { clearUserScope, clearAllCacheStorage } from "../services/storage/scope";
import { createNamespace } from "../services/storage/namespace";
import { Namespaces } from "../services/storage/registry";
import { isMigrated, runStorageMigration } from "../services/storage/migration";
import { __resetStoreCaches } from "../services/storage/store";
import { __resetStores } from "../services/storage/instances";

beforeEach(() => {
  AsyncStorage.__reset();
  __resetStores();
  __resetAllMMKV();
  __resetStoreCaches();
});

describe("tipli okuma/yazma", () => {
  it("kayıt yoksa registry varsayılanını döner", () => {
    expect(get(Keys.theme)).toBe("blue");
    expect(get(Keys.listsGridColumns)).toBe(3);
    expect(get(Keys.adultContent)).toBe(false);
    expect(get(Keys.streamingProviderIds)).toEqual([]);
  });

  it("yazılan değeri aynı tiple geri verir", () => {
    set(Keys.theme, "dark");
    set(Keys.listsGridColumns, 4);
    set(Keys.adultContent, true);
    set(Keys.streamingProviderIds, [8, 337]);

    expect(get(Keys.theme)).toBe("dark");
    expect(get(Keys.listsGridColumns)).toBe(4);
    expect(get(Keys.adultContent)).toBe(true);
    expect(get(Keys.streamingProviderIds)).toEqual([8, 337]);
  });

  it("tip uyuşmazlığında yazmaz", () => {
    expect(set(Keys.listsGridColumns, "4")).toBe(false);
    expect(get(Keys.listsGridColumns)).toBe(3);
  });

  it("doğrulamayı geçmeyen değeri yazmaz", () => {
    expect(set(Keys.railPosterRadius, 7)).toBe(false);
    expect(set(Keys.railPosterRadius, 15)).toBe(true);
    expect(get(Keys.railPosterRadius)).toBe(15);
  });

  it("null yazmak anahtarı siler", () => {
    set(Keys.theme, "dark");
    set(Keys.theme, null);
    expect(has(Keys.theme)).toBe(false);
    expect(get(Keys.theme)).toBe("blue");
  });

  it("bozuk JSON'da varsayılana döner ve kaydı temizler", () => {
    // Registry dışından, doğrudan bozuk veri enjekte et.
    getStore("settings").set(Keys.customThemes.key, "{bozuk json");
    expect(get(Keys.customThemes)).toEqual([]);
  });

  it("doğrulamayı geçmeyen DİSKTEKİ kaydı siler (kendini onarma)", () => {
    getStore("settings").set(Keys.railPosterRadius.key, 999);
    expect(get(Keys.railPosterRadius)).toBe(15);
    expect(has(Keys.railPosterRadius)).toBe(false);
  });
});

describe("kullanıcı kapsamı", () => {
  it("aynı anahtar farklı uid'lerde birbirinden bağımsız", () => {
    set(Keys.postDrafts, [{ id: "a" }], { uid: "user-1" });
    set(Keys.postDrafts, [{ id: "b" }], { uid: "user-2" });

    expect(get(Keys.postDrafts, { uid: "user-1" })).toEqual([{ id: "a" }]);
    expect(get(Keys.postDrafts, { uid: "user-2" })).toEqual([{ id: "b" }]);
    expect(get(Keys.postDrafts, { uid: "user-3" })).toEqual([]);
  });

  it("clearUserScope yalnız o kullanıcının korunmayan anahtarlarını siler", () => {
    set(Keys.postDrafts, [{ id: "a" }], { uid: "user-1" });
    set(Keys.avatarIndex, 5, { uid: "user-1" });
    set(Keys.watchLedger, { earned: {} }, { uid: "user-1" });
    set(Keys.postDrafts, [{ id: "b" }], { uid: "user-2" });

    clearUserScope("user-1");

    expect(get(Keys.postDrafts, { uid: "user-1" })).toEqual([]);
    expect(get(Keys.avatarIndex, { uid: "user-1" })).toBe(0);
    // keepOnLogout: seri geçmişi korunur
    expect(get(Keys.watchLedger, { uid: "user-1" })).toEqual({ earned: {} });
    // başka kullanıcıya dokunulmaz
    expect(get(Keys.postDrafts, { uid: "user-2" })).toEqual([{ id: "b" }]);
  });

  it("çıkışta oturum deposu boşalır ama ayarlar kalır", () => {
    set(Keys.theme, "dark");
    set(Keys.cachedUserId, "user-1");
    clearUserScope("user-1");
    expect(get(Keys.cachedUserId)).toBe(null);
    expect(get(Keys.theme)).toBe("dark");
  });

  it("çıkış CİHAZ düzeyi kayıtlara dokunmaz", () => {
    // Regresyon kilidi: bu ikisi bir ara `session` deposundaydı ve çıkışta
    // siliniyordu — kullanıcı onboarding'i baştan görüyor, hızlı giriş
    // çiplerini kaybediyordu.
    set(Keys.hasSeenOnboarding, true);
    set(Keys.recentUsers, [{ email: "a@b.c" }]);
    set(Keys.cachedUserId, "user-1");

    clearUserScope("user-1");

    expect(get(Keys.hasSeenOnboarding)).toBe(true);
    expect(get(Keys.recentUsers)).toEqual([{ email: "a@b.c" }]);
  });
});

describe("önbellek deposu", () => {
  it("clearAllCacheStorage önbelleği siler, ayar ve veriye dokunmaz", () => {
    const apiCache = createNamespace(Namespaces.apiCache);
    apiCache.setJSON("movie_trend", { data: [1], ts: 1 });
    set(Keys.feed, { posts: [] });
    set(Keys.theme, "dark");
    set(Keys.postDrafts, [{ id: "a" }], { uid: "u1" });

    clearAllCacheStorage();

    expect(apiCache.getJSON("movie_trend")).toBeUndefined();
    expect(get(Keys.feed)).toBe(null);
    expect(get(Keys.theme)).toBe("dark");
    expect(get(Keys.postDrafts, { uid: "u1" })).toEqual([{ id: "a" }]);
  });

  it("namespace önek bazlı silme yapar", () => {
    const apiCache = createNamespace(Namespaces.apiCache);
    apiCache.setJSON("movie_a", 1);
    apiCache.setJSON("movie_b", 2);
    apiCache.setJSON("tv_a", 3);

    expect(apiCache.clear("movie_")).toBe(2);
    expect(apiCache.getJSON("tv_a")).toBe(3);
    expect(apiCache.keys()).toEqual(["tv_a"]);
  });
});

describe("abonelik", () => {
  it("değişimde dinleyiciyi çağırır", () => {
    const seen = jest.fn();
    const unsubscribe = subscribe(Keys.theme, seen);
    set(Keys.theme, "dark");
    expect(seen).toHaveBeenCalledTimes(1);
    unsubscribe();
    set(Keys.theme, "blue");
    expect(seen).toHaveBeenCalledTimes(1);
  });
});

describe("AsyncStorage → MMKV göçü", () => {
  it("ayarları tipleriyle birlikte taşır", async () => {
    AsyncStorage.__store.set("selectedTheme", "dark");
    AsyncStorage.__store.set("adultContent", "true");
    AsyncStorage.__store.set("listsGridColumns", "4");
    AsyncStorage.__store.set("iconBackgroundOpacity", "0.5");
    AsyncStorage.__store.set("streamingProviderIds", "[8,337]");

    await runStorageMigration();

    expect(get(Keys.theme)).toBe("dark");
    expect(get(Keys.adultContent)).toBe(true);
    expect(get(Keys.listsGridColumns)).toBe(4);
    expect(get(Keys.iconBackgroundOpacity)).toBe(0.5);
    expect(get(Keys.streamingProviderIds)).toEqual([8, 337]);
  });

  it("eski anahtarları yeni biçime çevirir", async () => {
    AsyncStorage.__store.set("imageQuality", "w780");
    AsyncStorage.__store.set("listGridStyle", "false");

    await runStorageMigration();

    expect(get(Keys.imageQualityLevel)).toBe("high");
    expect(get(Keys.listGridStyle)).toBe(2);
  });

  it("global taslakları son oturum açan kullanıcının kapsamına taşır", async () => {
    AsyncStorage.__store.set("cachedUserId", "user-42");
    AsyncStorage.__store.set("post_drafts", '[{"id":"taslak"}]');
    AsyncStorage.__store.set("@seelogd/ai_conversations", '[{"id":"sohbet"}]');

    await runStorageMigration();

    expect(get(Keys.postDrafts, { uid: "user-42" })).toEqual([{ id: "taslak" }]);
    expect(get(Keys.aiConversations, { uid: "user-42" })).toEqual([{ id: "sohbet" }]);
    // Başka bir kullanıcı bunları GÖREMEZ — geçiş öncesi asıl sorun buydu.
    expect(get(Keys.postDrafts, { uid: "baska-user" })).toEqual([]);
  });

  it("uid'li anahtarları her kullanıcı için ayrı ayrı taşır", async () => {
    AsyncStorage.__store.set("avatar_user-1", "3");
    AsyncStorage.__store.set("avatar_user-2", "7");

    await runStorageMigration();

    expect(get(Keys.avatarIndex, { uid: "user-1" })).toBe(3);
    expect(get(Keys.avatarIndex, { uid: "user-2" })).toBe(7);
  });

  it("apicache girdilerini taşır ve AsyncStorage'dan siler", async () => {
    AsyncStorage.__store.set("apicache_movie_trend", '{"data":[1],"ts":123}');
    AsyncStorage.__store.set("selectedTheme", "dark");

    await runStorageMigration();

    const apiCache = createNamespace(Namespaces.apiCache);
    expect(apiCache.getJSON("movie_trend")).toEqual({ data: [1], ts: 123 });
    // Önbellek çift yer kaplamasın diye eski kopya silinir...
    expect(AsyncStorage.__store.has("apicache_movie_trend")).toBe(false);
    // ...ama ayarlar geri dönüş ağı olarak bırakılır.
    expect(AsyncStorage.__store.has("selectedTheme")).toBe(true);
  });

  it("sızmış düz metin parolaları siler", async () => {
    AsyncStorage.__store.set("password_test@example.com", "gizli");
    await runStorageMigration();
    expect(AsyncStorage.__store.has("password_test@example.com")).toBe(false);
  });

  it("fikirdeştir: ikinci çağrı iş yapmaz", async () => {
    AsyncStorage.__store.set("selectedTheme", "dark");
    await runStorageMigration();
    expect(isMigrated()).toBe(true);

    // Göç sonrası kullanıcı temayı değiştirsin; ikinci göç bunu EZMEMELİ.
    set(Keys.theme, "blue");
    await runStorageMigration();
    expect(get(Keys.theme)).toBe("blue");
  });

  it("göç öncesi yapılan kapsamlı okuma aktif kullanıcıyı bayat bırakmaz", async () => {
    AsyncStorage.__store.set("cachedUserId", "user-42");
    AsyncStorage.__store.set("post_drafts", '[{"id":"taslak"}]');

    // Göçten ÖNCE kullanıcı kapsamlı bir okuma: aktif uid o an boş depodan
    // `null` diye önbelleklenir.
    expect(get(Keys.postDrafts)).toEqual([]);

    await runStorageMigration();

    // Göç `cachedUserId`yi yazdı; aynı okuma artık gerçek sahibi görmeli.
    expect(get(Keys.postDrafts)).toEqual([{ id: "taslak" }]);
  });

  it("bozuk eski kayıt göçü durdurmaz", async () => {
    AsyncStorage.__store.set("customThemes", "{bozuk");
    AsyncStorage.__store.set("selectedTheme", "dark");

    await runStorageMigration();

    expect(get(Keys.customThemes)).toEqual([]);
    expect(get(Keys.theme)).toBe("dark");
  });
});
