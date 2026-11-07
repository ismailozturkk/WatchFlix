import {
  balancedEpisodesPerRow,
  balancedLineSize,
  buildTvGraphShare,
  graphRating,
  graphYears,
  MAX_TVGRAPH_CELLS,
  planTvGraphLayout,
  postTvGraphOf,
  sanitizeTvGraphShare,
} from "../utils/tvGraphShare";
import { buildShareMessage, readShare, shareThumb } from "../utils/chatShare";

const seasonsOf = (lengths) => lengths.map((n, i) => ({ s: i + 1, r: Array(n).fill(8.2) }));

const SHAPES = {
  breakingBad: [7, 13, 13, 13, 16],
  miniseries: [5],
  got: [10, 10, 10, 10, 10, 10, 7, 6],
  office: [6, 22, 25, 19, 28, 26, 26, 24, 25],
  simpsons: Array.from({ length: 36 }, (_, i) => 13 + ((i * 7) % 13)),
  anime: [60, 58],
  greys: Array.from({ length: 21 }, () => 24),
};
const CHAT = { width: 236, maxHeight: 320 };
const FEED = { width: 340, maxHeight: 480 };

describe("tvGraphShare gövdesi", () => {
  const show = {
    id: 1396,
    name: "Breaking Bad",
    poster_path: "/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
    first_air_date: "2008-01-20",
    last_air_date: "2013-09-29",
    status: "Ended",
    vote_average: 9.47,
  };
  const seasons = [
    { season_number: 0, episodes: [{ vote_average: 7 }] },
    { season_number: 1, episodes: [{ vote_average: 8.04 }, { vote_average: 0 }, { vote_average: "x" }] },
    { season_number: 2, episodes: [{ vote_average: 9.1 }] },
    { season_number: 3, episodes: [{ vote_average: 0 }, { vote_average: 0 }] },
  ];

  it("ekran verisinden gövde kurar: özel bölümler ve puansız sezon düşer, puanlar tek ondalık", () => {
    const share = buildTvGraphShare({ show, seasons, host: "İsmail" });
    expect(share).toMatchObject({
      type: "tvGraph",
      id: 1396,
      title: "Breaking Bad",
      years: "2008–2013",
      rating: 9.5,
      host: "İsmail",
      seasons: [
        { s: 1, r: [8, 0, 0] },
        { s: 2, r: [9.1] },
      ],
    });
    expect(share.totalSeasons).toBe(3);
    expect(share.totalEpisodes).toBe(6);
  });

  it("gönderenin özel afişi gövdeye yazılır; seçim yoksa TMDB afişi kalır", () => {
    const resolvePoster = jest.fn((type, id, path) => (type === "tv" && id === 1396 ? "/ozel-afis.jpg" : path));
    const chosen = buildTvGraphShare({ show, seasons, resolvePoster });
    expect(resolvePoster).toHaveBeenCalledWith("tv", 1396, show.poster_path);
    expect(chosen.poster_path).toBe("/ozel-afis.jpg");
    expect(shareThumb(buildShareMessage(chosen).share)).toBe("/ozel-afis.jpg");
    expect(postTvGraphOf(chosen).poster_path).toBe("/ozel-afis.jpg");
    // Çözücü seçim döndürmezse (Premium bitti / seçim yok) TMDB afişi.
    expect(buildTvGraphShare({ show, seasons, resolvePoster: () => null }).poster_path).toBe(show.poster_path);
    expect(buildTvGraphShare({ show, seasons }).poster_path).toBe(show.poster_path);
  });

  it("sohbet mesajına dönüşür ve geri okunur", () => {
    const message = buildShareMessage(buildTvGraphShare({ show, seasons }));
    expect(message.kind).toBe("tvGraphShare");
    expect(message.text).toContain("Breaking Bad");
    expect(readShare(message)).toEqual(message.share);
    expect(shareThumb(message.share)).toBe(show.poster_path);
    expect(readShare({ ...message, kind: "tierListShare" })).toBeNull();
  });

  it("bozuk gövdeyi reddeder, sınırları uygular", () => {
    expect(sanitizeTvGraphShare({ id: 1, title: "A", seasons: [] })).toBeNull();
    expect(sanitizeTvGraphShare({ id: 0, title: "A", seasons: seasonsOf([3]) })).toBeNull();
    expect(sanitizeTvGraphShare({ id: 1, title: "", seasons: seasonsOf([3]) })).toBeNull();
    const huge = sanitizeTvGraphShare({ id: 1, title: "Pembe dizi", seasons: seasonsOf(Array(40).fill(150)) });
    const cells = huge.seasons.reduce((sum, season) => sum + season.r.length, 0);
    expect(cells).toBeLessThanOrEqual(MAX_TVGRAPH_CELLS);
    expect(huge.totalSeasons).toBe(huge.seasons.length);
    expect(sanitizeTvGraphShare({ id: 1, title: "A", poster_path: "javascript:x", seasons: seasonsOf([2]) }).poster_path).toBeUndefined();
  });

  it("gönderi alanı v/type/host taşımaz", () => {
    const post = postTvGraphOf(buildTvGraphShare({ show, seasons, host: "İsmail" }));
    expect(post).not.toHaveProperty("v");
    expect(post).not.toHaveProperty("type");
    expect(post).not.toHaveProperty("host");
    expect(post.id).toBe(1396);
  });

  it("yardımcılar", () => {
    expect(graphRating(10.4)).toBe(10);
    expect(graphRating(-1)).toBe(0);
    expect(graphYears({ first_air_date: "2019-05-01", status: "Returning Series" })).toBe("2019–");
    expect(graphYears({ first_air_date: "2019-05-01", last_air_date: "2019-06-01", status: "Ended" })).toBe("2019");
  });
});

describe("planTvGraphLayout — farklı sezon uzunlukları", () => {
  it.each(Object.entries(SHAPES))("%s sohbet ve akış kutusuna sığar", (_name, lengths) => {
    [CHAT, FEED].forEach((box) => {
      const plan = planTvGraphLayout(seasonsOf(lengths), box);
      expect(plan.width).toBeLessThanOrEqual(box.width + 0.5);
      expect(plan.cell).toBeGreaterThanOrEqual(5);
      if (!plan.overflow) expect(plan.height).toBeLessThanOrEqual(box.maxHeight + 0.5);
    });
  });

  it("az sezonlu dizide klasik sütun düzeni ve puan yazısı", () => {
    const plan = planTvGraphLayout(seasonsOf(SHAPES.got), FEED);
    expect(plan.mode).toBe("columns");
    expect(plan.groups).toHaveLength(1);
    expect(plan.showText).toBe(true);
  });

  it("klasik görünüm puan yazısını taşıyabiliyorsa öncelikli", () => {
    expect(planTvGraphLayout(seasonsOf(SHAPES.breakingBad), FEED).mode).toBe("columns");
  });

  it("sohbet tercihi kısa dizileri de yatay yapar ve satırı en çok 10 bölümde kırar", () => {
    const short = planTvGraphLayout(seasonsOf([4, 3]), {
      ...CHAT,
      layoutMode: "rows",
      episodesPerRow: 10,
    });
    expect(short.mode).toBe("rows");
    expect(short.lines).toEqual([1, 1]);
    expect(short.perLine).toBe(4);

    const plan = planTvGraphLayout(seasonsOf([18, 14]), {
      ...CHAT,
      layoutMode: "rows",
      episodesPerRow: 10,
    });
    expect(plan.mode).toBe("rows");
    expect(plan.perLine).toBe(10);
    expect(plan.lines).toEqual([2, 2]);
  });

  it("yoğun sohbet grafiğinde 10 kare yatay alanı doldurur, fazla sezon yükseklikte kesilir", () => {
    const plan = planTvGraphLayout(seasonsOf(Array(14).fill(20)), {
      width: 282,
      maxHeight: 320,
      layoutMode: "rows",
      episodesPerRow: 10,
      fillRowsWidth: true,
    });
    expect(plan.mode).toBe("rows");
    expect(plan.perLine).toBe(10);
    expect(plan.width).toBeGreaterThan(275);
    expect(plan.cell).toBeGreaterThan(20);
    expect(plan.overflow).toBe(true);
  });

  it("tek kısa sezon uzun bir sütun değil tek şerit", () => {
    const plan = planTvGraphLayout(seasonsOf(SHAPES.miniseries), CHAT);
    expect(plan.mode).toBe("rows");
    expect(plan.perLine).toBe(5);
    expect(plan.height).toBe(plan.cell);
  });

  it("uzun sezonlar sütunda ezilmez: şeritler alta kayar, kareler okunur kalır", () => {
    const plan = planTvGraphLayout(seasonsOf(SHAPES.anime), CHAT);
    expect(plan.mode).toBe("rows");
    expect(plan.perLine).toBeLessThan(60);
    expect(plan.cell).toBeGreaterThanOrEqual(18);
  });

  it("çok sezonlu dizi kutuyu taşırmadan yoğun düzene geçer", () => {
    const plan = planTvGraphLayout(seasonsOf(SHAPES.simpsons), CHAT);
    expect(plan.overflow).toBe(false);
    expect(plan.showText).toBe(false);
    expect(plan.labelStep).toBeGreaterThanOrEqual(1);
  });

  it("hiçbir düzen sığmıyorsa en küçük kareyle çizip kesilir", () => {
    const plan = planTvGraphLayout(seasonsOf(Array(60).fill(30)), { width: 236, maxHeight: 200 });
    expect(plan.mode).toBe("rows");
    expect(plan.cell).toBe(5);
    expect(plan.overflow).toBe(true);
    expect(plan.width).toBeLessThanOrEqual(236.5);
  });

  it("boş veri / genişlik → null", () => {
    expect(planTvGraphLayout([], CHAT)).toBeNull();
    expect(planTvGraphLayout(seasonsOf([3]), { width: 0 })).toBeNull();
  });
});

describe("bölüm grafiği gönderisi", () => {
  const { validatePost, postTypeBadge, POST_TYPES } = require("../utils/postComposer");
  const tvGraph = sanitizeTvGraphShare({ id: 7, title: "Dark", seasons: seasonsOf([10, 8, 8]) });

  it("tür kayıtlı, grafik olmadan paylaşılmaz, açıklama isteğe bağlı", () => {
    expect(POST_TYPES).toContain("tvgraph");
    expect(validatePost({ type: "tvgraph", title: "Dark", content: "", tvGraph: null })).toEqual({ ok: false, error: "tvGraph" });
    expect(validatePost({ type: "tvgraph", title: "Dark", content: "", tvGraph })).toEqual({ ok: true, error: null });
    expect(postTypeBadge("tvgraph").fallback).toBe("BÖLÜM GRAFİĞİ");
  });
});

describe("sohbet grafiğinde dengeli satırlar", () => {
  test("bölünen sezon satırlara eşit dağıtılır, tek satırlık sezon kendi boyunda kalır", () => {
    expect(balancedLineSize(13, 10, 2)).toBe(7); // 10 + 3 değil 7 + 6
    expect(balancedLineSize(22, 10, 3)).toBe(8); // 8 + 8 + 6
    expect(balancedLineSize(20, 10, 2)).toBe(10);
    expect(balancedLineSize(7, 10, 1)).toBe(7);
    expect(balancedLineSize(12, 10, 1)).toBe(10);
  });

  test("satır boyu en uzun dengeli satırdır; satır sayıları değişmez, yetim satır oluşmaz", () => {
    const seasonsOf = (lens) => lens.map((n, i) => ({ s: i + 1, r: Array.from({ length: n }, () => 8) }));
    const cases = [[7, 13, 13, 13, 16], [6], [10, 22, 13], Array.from({ length: 12 }, () => 22), [11]];
    cases.forEach((lens) => {
      const per = balancedEpisodesPerRow(seasonsOf(lens), 10);
      expect(per).toBeLessThanOrEqual(10);
      lens.forEach((n) => {
        const lines = Math.ceil(n / 10);
        expect(Math.ceil(n / per)).toBe(lines);
        const size = balancedLineSize(n, per, Math.ceil(n / per));
        const last = n - size * (lines - 1);
        // Son satır ilk satırın yarısından kısa kalmaz (13 → 7 + 6, 11 → 6 + 5).
        if (lines > 1) expect(last).toBeGreaterThanOrEqual(Math.floor(size / 2));
      });
    });
    expect(balancedEpisodesPerRow(seasonsOf([7, 13, 13, 13, 16]), 10)).toBe(8);
  });

  test("ızgara genişliği verilen iç genişliği aşmaz", () => {
    const seasons = [7, 13, 13, 13, 16].map((n, i) => ({ s: i + 1, r: Array.from({ length: n }, () => 8) }));
    [222, 254, 280].forEach((width) => {
      const plan = planTvGraphLayout(seasons, {
        width,
        maxHeight: 320,
        layoutMode: "rows",
        episodesPerRow: balancedEpisodesPerRow(seasons, 10),
        fillRowsWidth: true,
      });
      expect(plan.width).toBeLessThanOrEqual(width);
      expect(plan.width).toBeGreaterThan(width - 12);
    });
  });
});
