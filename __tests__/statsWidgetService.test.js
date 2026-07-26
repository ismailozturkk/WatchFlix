jest.mock("react-native", () => ({
  NativeModules: {},
  Platform: { OS: "android" },
}));

import { buildStatsWidgetPayload } from "../services/statsWidgetService";

const STATS = {
  movieCount: 184,
  movieMinutes: 21360, // 356 saat
  movieTime: { years: 0, months: 4, days: 11, hours: 6, minutes: 30 },
  movieAccent: "#4fc3f7",
  movieRankName: "3 hafta",
  tvShowCount: 37,
  episodeCount: 912,
  tvMinutes: 55680, // 928 saat
  tvTime: { years: 0, months: 1, days: 8, hours: 16, minutes: 45 },
  tvAccent: "#a78bfa",
  tvRankName: "5 hafta",
  labels: {
    movies: "Filmler",
    tvShows: "Diziler",
    movieWatched: "İzlenen Film",
    tvShowCount: "Dizi",
    tvShowEpisodeCount: "Bölüm",
    totalDuration: "Toplam Süre",
    years: "Yıl",
    months: "Ay",
    days: "Gün",
    hours: "Saat",
    minutes: "Dakika",
  },
};

describe("buildStatsWidgetPayload", () => {
  test("film ve dizi kartlarını profildeki değerlerle doldurur", () => {
    const payload = buildStatsWidgetPayload(STATS, "tr");

    expect(payload.movie).toMatchObject({
      countLabel: "İzlenen Film",
      time: { years: 0, months: 4, days: 11, hours: 6, minutes: 30 },
    });
    expect(payload.tv).toMatchObject({
      showCountLabel: "Dizi",
      episodeCountLabel: "Bölüm",
      time: { years: 0, months: 1, days: 8, hours: 16, minutes: 45 },
    });
  });

  test("süreler saate çevrilir; toplam film + dizidir", () => {
    const { duration } = buildStatsWidgetPayload(STATS, "tr");
    // 21.360 + 55.680 = 77.040 dk = 1.284 saat
    expect(duration.totalText).toBe("1.284 Saat");
    expect(duration.movieText).toBe("356 Saat");
    expect(duration.tvText).toBe("928 Saat");
  });

  test("süre etiketleri profildeki `tür + hafta` biçimini korur", () => {
    const { duration } = buildStatsWidgetPayload(STATS, "tr");
    expect(duration.movieLabel).toBe("Filmler 3 hafta");
    expect(duration.tvLabel).toBe("Diziler 5 hafta");
    expect(duration.totalLabel).toBe("Toplam Süre");
  });

  test("aksan renkleri payload'dan taşınır", () => {
    const { duration } = buildStatsWidgetPayload(STATS, "tr");
    expect(duration.movieAccent).toBe("#4fc3f7");
    expect(duration.tvAccent).toBe("#a78bfa");
  });

  test("dil sayı biçimini ve başlığı değiştirir", () => {
    const tr = buildStatsWidgetPayload(STATS, "tr");
    const en = buildStatsWidgetPayload(STATS, "en");
    expect(tr.title).toBe("İstatistikler");
    expect(en.title).toBe("Statistics");
    // tr-TR binlik ayırıcı nokta, en-US virgül.
    expect(tr.duration.totalText).toBe("1.284 Saat");
    expect(en.duration.totalText).toBe("1,284 Saat");
  });

  test("boş girdide sıfırlanmış ama yapısı bozulmamış payload döner", () => {
    const payload = buildStatsWidgetPayload({}, "tr");
    expect(payload.movie.count).toBe("0");
    expect(payload.movie.time).toEqual({
      years: 0, months: 0, days: 0, hours: 0, minutes: 0,
    });
    expect(payload.duration.totalText).toBe("0 Saat");
    // Aksanlar eksikse profildeki varsayılan renklere düşer.
    expect(payload.duration.movieAccent).toBe("#4fc3f7");
    expect(payload.duration.tvAccent).toBe("#a78bfa");
  });

  test("rank adı yoksa etiket sondaki boşlukla kalmaz", () => {
    const { duration } = buildStatsWidgetPayload(
      { ...STATS, movieRankName: undefined },
      "tr",
    );
    expect(duration.movieLabel).toBe("Filmler");
  });
});
