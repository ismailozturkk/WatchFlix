// utils/photoRevalidation.js (saf kararlar) + services/photoRevalidation.js
// (indir → md5 karşılaştır → yeni anahtara yaz). expo-image, dosya sistemi ve
// MMKV taklit.

const mockDownloads = [];
let mockNextMd5 = "md5-a";
let mockDownloadError = null;
const mockDeleted = [];

jest.mock("expo-file-system", () => {
  class Directory {
    constructor(base, name) {
      this.uri = `${base?.uri ?? base}/${name}`;
      this.exists = false;
    }
    create() {
      this.exists = true;
    }
  }
  class File {
    constructor(dir, name) {
      this.uri = `${dir.uri}/${name}`;
      this.exists = false;
    }
    info() {
      return { exists: this.exists, md5: this.md5 };
    }
    delete() {
      this.exists = false;
      mockDeleted.push(this.uri);
    }
  }
  File.downloadFileAsync = jest.fn(async (url, target, options) => {
    mockDownloads.push({ url, options });
    if (mockDownloadError) throw mockDownloadError;
    target.exists = true;
    target.md5 = mockNextMd5;
    return target;
  });
  return { Directory, File, Paths: { cache: { uri: "file:///cache" } } };
});

const mockWriteToCache = jest.fn(() => Promise.resolve());
jest.mock("expo-image", () => ({
  Image: { writeToCacheAsync: (...a) => mockWriteToCache(...a) },
}));

const mockStore = new Map();
jest.mock("../services/storage", () => ({
  Keys: { photoVersions: "photoVersions" },
  get: (key) => (mockStore.has(key) ? mockStore.get(key) : null),
  set: (key, value) => {
    mockStore.set(key, value);
    return true;
  },
}));

const {
  OWN_PHOTO_CHECK_TTL_MS,
  PHOTO_CHECK_RETRY_MS,
  PHOTO_CHECK_TTL_MS,
  isPhotoCheckDue,
  photoCacheKey,
  planPhotoCheck,
  prunePhotoEntries,
  revalidatedUriOf,
  withPhotoVersion,
} = require("../utils/photoRevalidation");
const {
  __resetPhotoRevalidationForTests,
  getPhotoVersion,
  requestPhotoCheck,
  subscribePhotoVersions,
} = require("../services/photoRevalidation");

const G = "https://lh3.googleusercontent.com/a/ACg8ocABC=s500-c";
const STORAGE_URL = "https://firebasestorage.googleapis.com/v0/b/x/o/a.jpg?alt=media&token=t";

let now = 1_800_000_000_000;
const flush = async () => {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
};

beforeEach(() => {
  __resetPhotoRevalidationForTests();
  mockDownloads.length = 0;
  mockDeleted.length = 0;
  mockNextMd5 = "md5-a";
  mockDownloadError = null;
  mockWriteToCache.mockClear();
  mockStore.clear();
  now = 1_800_000_000_000;
  jest.spyOn(Date, "now").mockImplementation(() => now);
});

afterEach(() => {
  Date.now.mockRestore();
});

describe("pure decisions", () => {
  it("only Google photo sources without their own cacheKey are revalidated", () => {
    expect(revalidatedUriOf({ uri: G })).toBe(G);
    expect(revalidatedUriOf({ uri: STORAGE_URL })).toBeNull();
    expect(revalidatedUriOf({ uri: G, cacheKey: "x" })).toBeNull();
    expect(revalidatedUriOf(12)).toBeNull(); // hazır avatar (require)
    expect(revalidatedUriOf(null)).toBeNull();
  });

  it("binds a source to its version's cache key and leaves others untouched", () => {
    const src = { uri: G };
    expect(withPhotoVersion(src, 0)).toBe(src);
    expect(withPhotoVersion(src, 5)).toEqual({ uri: G, cacheKey: photoCacheKey(G, 5) });
    expect(photoCacheKey(G, 5)).not.toBe(G);
    const storage = { uri: STORAGE_URL };
    expect(withPhotoVersion(storage, 5)).toBe(storage);
  });

  it("a check is due without a record or after the TTL", () => {
    expect(isPhotoCheckDue(undefined, now)).toBe(true);
    expect(isPhotoCheckDue({ at: now - 1000 }, now)).toBe(false);
    expect(isPhotoCheckDue({ at: now - PHOTO_CHECK_TTL_MS }, now)).toBe(true);
    expect(isPhotoCheckDue({ at: now - OWN_PHOTO_CHECK_TTL_MS }, now, OWN_PHOTO_CHECK_TTL_MS)).toBe(true);
  });

  it("first check always moves to a new version (the cached copy may be stale)", () => {
    const plan = planPhotoCheck(undefined, "md5-a", now);
    expect(plan.changed).toBe(true);
    expect(plan.entry).toEqual({ v: now, h: "md5-a", at: now });
  });

  it("same content only refreshes the check time; new content bumps the version", () => {
    const entry = { v: 100, h: "md5-a", at: 1 };
    expect(planPhotoCheck(entry, "md5-a", now)).toEqual({
      changed: false,
      entry: { v: 100, h: "md5-a", at: now },
    });
    const changed = planPhotoCheck(entry, "md5-b", now);
    expect(changed.changed).toBe(true);
    expect(changed.entry.h).toBe("md5-b");
    expect(changed.entry.v).toBeGreaterThan(100);
    // Saat geri gitse bile sürüm büyür (yeni anahtar eskisiyle çakışmaz).
    expect(planPhotoCheck({ v: now + 50, h: "x", at: 1 }, "y", now).entry.v).toBe(now + 51);
  });

  it("keeps only the most recently checked entries", () => {
    const entries = { a: { at: 1 }, b: { at: 3 }, c: { at: 2 } };
    expect(Object.keys(prunePhotoEntries(entries, 2)).sort()).toEqual(["b", "c"]);
    expect(prunePhotoEntries(entries, 5)).toBe(entries);
  });
});

describe("background check", () => {
  it("re-downloads a cached Google photo, seeds the image cache under a new key and notifies", async () => {
    const listener = jest.fn();
    subscribePhotoVersions(listener);
    expect(getPhotoVersion(G)).toBe(0);

    requestPhotoCheck(G);
    await flush();

    expect(mockDownloads).toHaveLength(1);
    expect(mockDownloads[0].url).toBe(G);
    // Ara HTTP önbelleği eski yanıtı vermesin.
    expect(mockDownloads[0].options.headers["Cache-Control"]).toBe("no-cache");
    const version = getPhotoVersion(G);
    expect(version).toBeGreaterThan(0);
    expect(mockWriteToCache).toHaveBeenCalledWith(expect.stringContaining("/photo-check/"), photoCacheKey(G, version));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(mockStore.get("photoVersions")[G]).toEqual({ v: version, h: "md5-a", at: now });
    // Geçici dosya silinir.
    expect(mockDeleted).toHaveLength(1);
  });

  it("does not touch the network again before the TTL", async () => {
    requestPhotoCheck(G);
    await flush();
    now += 60 * 1000;
    requestPhotoCheck(G);
    await flush();
    expect(mockDownloads).toHaveLength(1);
  });

  it("unchanged content after the TTL keeps the version and does not rewrite the cache", async () => {
    requestPhotoCheck(G);
    await flush();
    const version = getPhotoVersion(G);
    const listener = jest.fn();
    subscribePhotoVersions(listener);

    now += PHOTO_CHECK_TTL_MS;
    requestPhotoCheck(G);
    await flush();

    expect(mockDownloads).toHaveLength(2);
    expect(mockWriteToCache).toHaveBeenCalledTimes(1);
    expect(getPhotoVersion(G)).toBe(version);
    expect(listener).not.toHaveBeenCalled();
    expect(mockStore.get("photoVersions")[G].at).toBe(now);
  });

  it("a photo changed on Google (same address) gets a new version", async () => {
    requestPhotoCheck(G);
    await flush();
    const first = getPhotoVersion(G);

    now += OWN_PHOTO_CHECK_TTL_MS;
    mockNextMd5 = "md5-new-face";
    requestPhotoCheck(G, { maxAgeMs: OWN_PHOTO_CHECK_TTL_MS, priority: true });
    await flush();

    const second = getPhotoVersion(G);
    expect(second).toBeGreaterThan(first);
    expect(mockWriteToCache).toHaveBeenLastCalledWith(expect.any(String), photoCacheKey(G, second));
  });

  it("versions survive a restart (read back from storage)", async () => {
    requestPhotoCheck(G);
    await flush();
    const version = getPhotoVersion(G);
    const saved = mockStore.get("photoVersions");

    __resetPhotoRevalidationForTests();
    mockStore.set("photoVersions", saved);
    expect(getPhotoVersion(G)).toBe(version);
  });

  it("an offline failure keeps the old version and waits before retrying", async () => {
    mockDownloadError = new Error("offline");
    requestPhotoCheck(G);
    await flush();
    expect(getPhotoVersion(G)).toBe(0);
    expect(mockWriteToCache).not.toHaveBeenCalled();

    mockDownloadError = null;
    now += 1000;
    requestPhotoCheck(G);
    await flush();
    expect(mockDownloads).toHaveLength(1);

    now += PHOTO_CHECK_RETRY_MS;
    requestPhotoCheck(G);
    await flush();
    expect(mockDownloads).toHaveLength(2);
    expect(getPhotoVersion(G)).toBeGreaterThan(0);
  });

  it("still moves to the new version when seeding the image cache fails", async () => {
    mockWriteToCache.mockImplementationOnce(() => Promise.reject(new Error("seed failed")));
    const listener = jest.fn();
    subscribePhotoVersions(listener);
    requestPhotoCheck(G);
    await flush();
    expect(getPhotoVersion(G)).toBeGreaterThan(0);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("ignores addresses whose content cannot change behind the same URL", async () => {
    requestPhotoCheck(STORAGE_URL);
    requestPhotoCheck("not a url");
    await flush();
    expect(mockDownloads).toHaveLength(0);
  });

  it("caps background checks per session but never the user's own photo", async () => {
    for (let i = 0; i < 100; i += 1) {
      requestPhotoCheck(`https://lh3.googleusercontent.com/a/user${i}=s500-c`);
    }
    await flush();
    await flush();
    await flush();
    const background = mockDownloads.length;
    expect(background).toBeLessThan(100);

    requestPhotoCheck(G, { maxAgeMs: OWN_PHOTO_CHECK_TTL_MS, priority: true });
    for (let i = 0; i < 20; i += 1) await flush();
    expect(mockDownloads.map((d) => d.url)).toContain(G);
  });
});
