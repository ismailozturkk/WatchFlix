// cachedRead gerçekte expo-file-system'e dokunur (node ortamında yok); fabrika
// verilerek mock'landığı için asıl modül hiç yüklenmez.
jest.mock("../utils/cachedRead", () => ({ cachedTmdb: jest.fn() }));

import { cachedTmdb } from "../utils/cachedRead";
import {
  clearUpNextResolutionCache,
  resolveUpNextEpisode,
  resolveUpNextEpisodeCached,
} from "../services/upNextService";

const NOW = new Date("2026-08-01T12:00:00");

const show = {
  id: 42,
  name: "Test Dizisi",
  watchedEpisodeCount: 2,
  seasons: [
    {
      seasonNumber: 1,
      episodes: [
        { episodeNumber: 1, episodeWatchTime: "2026-07-01" },
        { episodeNumber: 2, episodeWatchTime: "2026-07-02" },
      ],
    },
  ],
};

const details = {
  name: "Test Dizisi",
  number_of_episodes: 12,
  number_of_seasons: 2,
  seasons: [{ season_number: 1 }, { season_number: 2 }],
};

const seasonOne = {
  poster_path: "/s1.jpg",
  episodes: [
    { episode_number: 1, air_date: "2026-01-01" },
    { episode_number: 2, air_date: "2026-01-08" },
    { episode_number: 3, air_date: "2026-01-15", name: "Üç" },
    { episode_number: 4, air_date: "2026-01-22", name: "Dört" },
    { episode_number: 5, air_date: "2026-01-29", name: "Beş" },
    { episode_number: 6, air_date: "2026-02-05", name: "Altı" },
  ],
};

const seasonTwo = {
  poster_path: "/s2.jpg",
  episodes: [{ episode_number: 1, air_date: "2026-03-01", name: "İki-Bir" }],
};

const mockTmdb = ({ seasons = { 1: seasonOne, 2: seasonTwo } } = {}) => {
  cachedTmdb.mockImplementation((url) => {
    const seasonMatch = url.match(/\/season\/(\d+)/);
    if (seasonMatch) {
      return Promise.resolve({ data: seasons[seasonMatch[1]] || {} });
    }
    return Promise.resolve({ data: details });
  });
};

const options = { apiKey: "Bearer test", language: "tr-TR", now: NOW };

describe("resolveUpNextEpisode", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearUpNextResolutionCache();
  });

  test("sıradaki bölümü ve ardından gelenleri hazırda tutar", async () => {
    mockTmdb();

    const resolved = await resolveUpNextEpisode(show, options);

    expect(resolved).toMatchObject({
      id: "42:1:3",
      seasonNumber: 1,
      episodeNumber: 3,
      episodeName: "Üç",
      isAired: true,
    });
    expect(resolved.nextUp).toMatchObject({ id: "42:1:4", episodeNumber: 4 });
    expect(resolved.nextUp.nextUp).toMatchObject({
      id: "42:1:5",
      episodeNumber: 5,
    });
    // Zincir sonrasında ön yükleme durur; sınırsız ilerlemez.
    expect(resolved.nextUp.nextUp.nextUp).toBeNull();
  });

  test("aynı sezonda kalırken ek istek atmaz", async () => {
    mockTmdb();

    await resolveUpNextEpisode(show, options);

    // 1 dizi detayı + 1 sezon isteği; ön yükleme önbellekten okur.
    expect(cachedTmdb).toHaveBeenCalledTimes(2);
    expect(
      cachedTmdb.mock.calls.filter(([url]) => url.includes("/season/")).length
    ).toBe(1);
  });

  test("dil URL'in parçasıdır (tr/en aynı cache kaydını ezmesin)", async () => {
    mockTmdb();

    await resolveUpNextEpisode(show, options);

    expect(cachedTmdb.mock.calls[0][0]).toContain("language=tr-TR");
  });

  test("sezon biterken sonraki sezonu önden çeker", async () => {
    mockTmdb({
      seasons: {
        1: {
          ...seasonOne,
          episodes: seasonOne.episodes.slice(0, 3),
        },
        2: seasonTwo,
      },
    });

    const resolved = await resolveUpNextEpisode(show, options);

    expect(resolved).toMatchObject({ id: "42:1:3" });
    expect(resolved.nextUp).toMatchObject({
      id: "42:2:1",
      seasonNumber: 2,
      episodeNumber: 1,
      episodeName: "İki-Bir",
    });
  });

  test("yayınlanmamış bölümde ön yükleme yapmaz", async () => {
    mockTmdb({
      seasons: {
        1: {
          episodes: [
            { episode_number: 1, air_date: "2026-01-01" },
            { episode_number: 2, air_date: "2026-01-08" },
            { episode_number: 3, air_date: "2027-01-01", name: "Üç" },
          ],
        },
        2: {},
      },
    });

    const resolved = await resolveUpNextEpisode(show, options);

    expect(resolved).toMatchObject({ id: "42:1:3", isAired: false });
    expect(resolved.nextUp).toBeNull();
  });

  test("ön yükleme isteği patlarsa sıradaki bölüm yine döner", async () => {
    let seasonCalls = 0;
    cachedTmdb.mockImplementation((url) => {
      if (!url.includes("/season/")) return Promise.resolve({ data: details });
      seasonCalls += 1;
      // İlk sezon isteği yalnızca izlenenleri döner; ön yükleme adımı
      // ikinci sezonu isteyince ağ hatası alır.
      if (seasonCalls === 1) {
        return Promise.resolve({
          data: {
            episodes: [
              { episode_number: 1, air_date: "2026-01-01" },
              { episode_number: 2, air_date: "2026-01-08" },
              { episode_number: 3, air_date: "2026-01-15", name: "Üç" },
            ],
          },
        });
      }
      return Promise.reject(new Error("network"));
    });

    const resolved = await resolveUpNextEpisode(show, options);

    expect(resolved).toMatchObject({ id: "42:1:3", isAired: true });
    expect(resolved.nextUp).toBeNull();
  });

  test("dizi detayı alınamazsa hata yukarı taşınır", async () => {
    cachedTmdb.mockRejectedValue(new Error("offline"));

    await expect(resolveUpNextEpisode(show, options)).rejects.toThrow("offline");
  });

  test("çevrimdışıyken cache boşsa hata verir (sessizce boş dönmez)", async () => {
    cachedTmdb.mockResolvedValue({ data: null, fromCache: true, stale: true });

    await expect(resolveUpNextEpisode(show, options)).rejects.toThrow(
      /veri alınamadı/
    );
  });
});

describe("resolveUpNextEpisodeCached", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearUpNextResolutionCache();
  });

  test("aynı ilerleme için ikinci tüketici ağa çıkmaz", async () => {
    mockTmdb();

    const first = await resolveUpNextEpisodeCached(show, options);
    const second = await resolveUpNextEpisodeCached(show, options);

    expect(second).toBe(first);
    expect(cachedTmdb).toHaveBeenCalledTimes(2); // 1 detay + 1 sezon
  });

  test("bölüm işaretlenince önbellek kendiliğinden geçersizleşir", async () => {
    mockTmdb();

    await resolveUpNextEpisodeCached(show, options);
    const advanced = {
      ...show,
      watchedEpisodeCount: 3,
      seasons: [
        {
          seasonNumber: 1,
          episodes: [
            ...show.seasons[0].episodes,
            { episodeNumber: 3, episodeWatchTime: "2026-07-03" },
          ],
        },
      ],
    };
    const next = await resolveUpNextEpisodeCached(advanced, options);

    expect(next).toMatchObject({ id: "42:1:4" });
    expect(cachedTmdb.mock.calls.length).toBeGreaterThan(2);
  });

  test("refresh önbelleği atlar", async () => {
    mockTmdb();

    await resolveUpNextEpisodeCached(show, options);
    await resolveUpNextEpisodeCached(show, { ...options, refresh: true });

    expect(cachedTmdb).toHaveBeenCalledTimes(4);
    expect(cachedTmdb.mock.calls.at(-1)[2]).toMatchObject({
      forceRefresh: true,
    });
  });

  test("hata sonucu saklanmaz", async () => {
    cachedTmdb.mockRejectedValue(new Error("offline"));
    await expect(resolveUpNextEpisodeCached(show, options)).rejects.toThrow(
      "offline"
    );

    mockTmdb();
    await expect(resolveUpNextEpisodeCached(show, options)).resolves.toMatchObject(
      { id: "42:1:3" }
    );
  });
});
