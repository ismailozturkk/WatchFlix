// "Sohbete gönder" paylaşım gövdesi — saf çekirdek (utils/chatShare.js) ve AI
// cevabının mesaja çevrilmesi (services/aiCineInsights.buildChatShare).

import {
  MAX_AI_SHARE_PICKS,
  MAX_LIST_SHARE_ITEMS,
  SHARE_KIND,
  buildAiShare,
  buildListShare,
  buildShareMessage,
  chatParamsForShare,
  readShare,
  sanitizeShare,
  sharePreview,
  shareThumb,
  toShareMedia,
} from "../utils/chatShare";
import { buildChatShare } from "../services/aiCineInsights";
import { posterKey } from "../services/aiCineService";
import { replyGlyph, replyKind, replyThumb } from "../utils/chatReply";

const profileItem = (id, extra = {}) => ({
  id,
  type: "movie",
  name: `Film ${id}`,
  imagePath: `/p${id}.jpg`,
  genres: ["Dram"],
  ...extra,
});

describe("toShareMedia", () => {
  it("profil listesi öğesini paylaşım medyasına çevirir", () => {
    expect(toShareMedia(profileItem(7, { minutes: 128 }))).toEqual({
      id: 7,
      media_type: "movie",
      title: "Film 7",
      poster_path: "/p7.jpg",
      genres: ["Dram"],
      minutes: 128,
    });
  });

  it("kimliksiz öğeyi reddeder", () => {
    expect(toShareMedia({ name: "x" })).toBeNull();
    expect(toShareMedia(null)).toBeNull();
  });

  it("tür alanı yoksa verilen yedek türü kullanır", () => {
    expect(toShareMedia({ id: 1, name: "Dizi" }, { fallbackType: "tv" }).media_type).toBe("tv");
  });

  it("undefined değer sızdırmaz (Firestore reddeder)", () => {
    const media = toShareMedia({ id: 1, name: "A", imagePath: null, minutes: NaN });
    expect(Object.values(media)).not.toContain(undefined);
    expect(media).toEqual({ id: 1, media_type: "movie", title: "A" });
  });

  it("tam poster URL'sinden TMDB yolunu çıkarır", () => {
    const media = toShareMedia({
      id: 1,
      title: "A",
      poster: "https://image.tmdb.org/t/p/w500/abc.jpg",
    });
    expect(media.poster_path).toBe("/abc.jpg");
  });
});

describe("buildListShare", () => {
  it("öğeleri tekilleştirir, toplamı sayar", () => {
    const share = buildListShare({
      title: "Hafta sonu",
      items: [profileItem(1), profileItem(1), profileItem(2)],
    });
    expect(share.total).toBe(2);
    expect(share.items.map((item) => item.id)).toEqual([1, 2]);
    expect(share.title).toBe("Hafta sonu");
  });

  it("boş veya geçersiz listede null döner", () => {
    expect(buildListShare({ title: "x", items: [] })).toBeNull();
    expect(buildListShare({ title: "x", items: [{ name: "kimliksiz" }] })).toBeNull();
    expect(buildListShare({})).toBeNull();
  });

  it("öğe tavanını uygular ama gerçek toplamı korur", () => {
    const items = Array.from({ length: MAX_LIST_SHARE_ITEMS + 25 }, (_, i) => profileItem(i + 1));
    const share = buildListShare({ title: "Büyük", items });
    expect(share.items).toHaveLength(MAX_LIST_SHARE_ITEMS);
    expect(share.total).toBe(MAX_LIST_SHARE_ITEMS + 25);
  });

  it("yalnız öntanımlı liste anahtarını saklar", () => {
    expect(buildListShare({ title: "t", items: [profileItem(1)], listKey: "favorites" }).listKey).toBe(
      "favorites",
    );
    expect(buildListShare({ title: "t", items: [profileItem(1)], listKey: "Benim Listem" }).listKey).toBeUndefined();
  });

  it("dizi listesinde tür alanı olmayan öğeyi dizi sayar", () => {
    const share = buildListShare({
      title: "Diziler",
      items: [{ id: 5, name: "Dizi", imagePath: "/d.jpg" }],
      fallbackType: "tv",
    });
    expect(share.items[0].media_type).toBe("tv");
  });

  it("uzun başlığı kırpar", () => {
    const share = buildListShare({ title: "a".repeat(200), items: [profileItem(1)] });
    expect(share.title).toHaveLength(60);
  });
});

describe("mesaj kurma ve okuma", () => {
  const listShare = buildListShare({ title: "Favoriler", items: [profileItem(1), profileItem(2)], listKey: "favorites" });

  it("liste paylaşımı kind + text + share üretir", () => {
    const message = buildShareMessage(listShare);
    expect(message.kind).toBe(SHARE_KIND.LIST);
    expect(message.text).toBe("📋 Favoriler");
    expect(message.share.items).toHaveLength(2);
  });

  it("başlıksız listede adet önizlemesi kullanır", () => {
    const share = buildListShare({ title: "", items: [profileItem(1), profileItem(2)] });
    expect(sharePreview(share)).toMatch(/2/);
  });

  it("geçersiz gövdeden mesaj üretmez", () => {
    expect(buildShareMessage(null)).toBeNull();
    expect(buildShareMessage({ type: "bilinmeyen" })).toBeNull();
    expect(buildShareMessage({ type: "list", items: [] })).toBeNull();
  });

  it("readShare yalnız paylaşım türü ile gövde tutarlıysa döner", () => {
    const message = { ...buildShareMessage(listShare), senderId: "u1" };
    expect(readShare(message).type).toBe("list");
    expect(readShare({ ...message, kind: SHARE_KIND.AI })).toBeNull();
    expect(readShare({ ...message, kind: "text" })).toBeNull();
    expect(readShare({ kind: SHARE_KIND.LIST, share: "bozuk" })).toBeNull();
    expect(readShare(null)).toBeNull();
  });

  it("bozuk kayıtlar çökertmez", () => {
    expect(sanitizeShare({ type: "list", items: "yok" })).toBeNull();
    expect(sanitizeShare({ type: "ai", sections: [null, 4, { picks: "x" }] })).toBeNull();
    expect(sanitizeShare([])).toBeNull();
  });
});

describe("buildAiShare", () => {
  const pick = (title, extra = {}) => ({ media_type: "movie", title, ...extra });

  it("öğesiz ve metinsiz içerik göndermez", () => {
    expect(buildAiShare({ variant: "general", sections: [{ picks: [] }] })).toBeNull();
    expect(buildAiShare({})).toBeNull();
  });

  it("yalnız metin içeren (genel) cevabı kabul eder", () => {
    const share = buildAiShare({ variant: "general", summary: "Kısa bir cevap", sections: [] });
    expect(share.summary).toBe("Kısa bir cevap");
    expect(share.sections).toEqual([]);
  });

  it("öğe tavanını bölümler arasında uygular, toplamı korur", () => {
    const sections = [
      { picks: Array.from({ length: 20 }, (_, i) => pick(`A${i}`)) },
      { picks: Array.from({ length: 20 }, (_, i) => pick(`B${i}`)) },
    ];
    const share = buildAiShare({ variant: "watchlist", sections });
    const kept = share.sections.reduce((n, s) => n + s.picks.length, 0);
    expect(kept).toBe(MAX_AI_SHARE_PICKS);
    expect(share.total).toBe(40);
  });

  it("bilinmeyen türü genel yapar", () => {
    expect(buildAiShare({ variant: "x", summary: "a" }).variant).toBe("general");
  });

  it("karşılaştırma yan yana yalnız tam iki başlıkla", () => {
    const two = buildAiShare({ variant: "comparison", versus: true, sections: [{ picks: [pick("A"), pick("B")] }] });
    const three = buildAiShare({
      variant: "comparison",
      versus: true,
      sections: [{ picks: [pick("A"), pick("B"), pick("C")] }],
    });
    expect(two.versus).toBe(true);
    expect(three.versus).toBeUndefined();
  });

  it("özeti kırpar, satır sonlarını korur", () => {
    const share = buildAiShare({
      variant: "general",
      summary: `birinci\n\n\n\nikinci ${"x".repeat(900)}`,
    });
    expect(share.summary.startsWith("birinci\n\nikinci")).toBe(true);
    expect(share.summary.length).toBeLessThanOrEqual(700);
  });

  it("bulunamayan başlık kimliksiz kalır, undefined sızdırmaz", () => {
    const share = buildAiShare({ variant: "recommendations", sections: [{ picks: [pick("Bilinmeyen")] }] });
    const saved = share.sections[0].picks[0];
    expect(saved.id).toBeUndefined();
    expect(Object.values(saved)).not.toContain(undefined);
  });
});

describe("buildChatShare (CineMatch cevabı → mesaj)", () => {
  const card = (mediaType, title, extra = {}) => ({
    [posterKey(mediaType, title)]: {
      found: true,
      id: title.length * 10,
      mediaType,
      title,
      posterPath: `/${title}.jpg`,
      year: "2016",
      rating: 7.84,
      ...extra,
    },
  });

  it("öneriler: bulunan başlık kimlik ve poster taşır, nedeni nota yazar", () => {
    const posterMap = { ...card("movie", "Arrival") };
    const share = buildChatShare(
      {
        type: "recommendations",
        items: [
          { title: "Arrival", mediaType: "movie", reason: "Sakin bir bilim kurgu" },
          { title: "Yok Böyle Film", mediaType: "movie" },
        ],
      },
      posterMap,
      { question: "Bu akşam ne izlesem?" },
    );
    expect(share.variant).toBe("recommendations");
    expect(share.question).toBe("Bu akşam ne izlesem?");
    const [found, missing] = share.sections[0].picks;
    expect(found).toMatchObject({ id: 70, poster_path: "/Arrival.jpg", year: "2016", rating: 7.8 });
    expect(found.note).toBe("Sakin bir bilim kurgu");
    expect(missing.id).toBeUndefined();
  });

  it("karşılaştırma: iki başlık + karar özeti + yan yana işareti", () => {
    const posterMap = { ...card("movie", "Dune"), ...card("movie", "Arrival") };
    const share = buildChatShare(
      {
        type: "comparison",
        left: { title: "Dune", mediaType: "movie" },
        right: { title: "Arrival", mediaType: "movie" },
        verdict: "Arrival daha sakin",
      },
      posterMap,
    );
    expect(share.versus).toBe(true);
    expect(share.summary).toBe("Arrival daha sakin");
    expect(share.sections[0].picks.map((p) => p.title)).toEqual(["Dune", "Arrival"]);
  });

  it("izleme planı: her oturum ayrı bölüm, etiket ve not korunur", () => {
    const share = buildChatShare(
      {
        type: "watch_plan",
        sessions: [
          { label: "Gün 1", note: "Erken yat", items: [{ title: "Dune", mediaType: "movie" }] },
          { label: "Gün 2", items: [{ title: "Severance", mediaType: "tv" }] },
        ],
      },
      {},
    );
    expect(share.sections.map((s) => s.label)).toEqual(["Gün 1", "Gün 2"]);
    expect(share.sections[0].note).toBe("Erken yat");
    expect(share.sections[1].picks[0].media_type).toBe("tv");
  });

  it("izleme listesi: bölüm anahtarı alıcı dilinde etiket için saklanır, 'mutlaka' işareti taşınır", () => {
    const share = buildChatShare(
      {
        type: "watchlist",
        sections: [{ key: "Essential", items: [{ title: "Dune", mediaType: "movie", mustWatch: true }] }],
      },
      {},
    );
    expect(share.sections[0].labelKey).toBe("essential");
    expect(share.sections[0].picks[0].must).toBe(true);
  });

  it("yapım detayı: tek başlık + görüş metni", () => {
    const share = buildChatShare(
      { type: "title_spotlight", title: "Dune", mediaType: "movie", take: "Görsel şölen" },
      card("movie", "Dune"),
    );
    expect(share.summary).toBe("Görsel şölen");
    expect(share.sections[0].picks).toHaveLength(1);
  });

  it("genel cevap: yalnız metin yeterli", () => {
    const share = buildChatShare({ type: "general", content: "Merhaba, nasıl yardımcı olayım?" }, {});
    expect(share.variant).toBe("general");
    expect(share.sections).toEqual([]);
  });

  it("içeriksiz cevapta null", () => {
    expect(buildChatShare({ type: "recommendations", items: [] }, {})).toBeNull();
    expect(buildChatShare(null, {})).toBeNull();
  });

  it("üretilen gövde mesaj olarak geri okunabilir", () => {
    const share = buildChatShare(
      { type: "recommendations", items: [{ title: "Arrival", mediaType: "movie" }] },
      card("movie", "Arrival"),
    );
    const message = buildShareMessage(share);
    expect(message.kind).toBe(SHARE_KIND.AI);
    expect(message.text).toBe("✨ CineMatch · Arrival");
    expect(readShare(message).sections[0].picks[0].title).toBe("Arrival");
  });
});

describe("alıntı (reply) entegrasyonu", () => {
  const listMessage = {
    id: "m1",
    ...buildShareMessage(buildListShare({ title: "Favoriler", items: [profileItem(1)] })),
  };

  it("paylaşım mesajı kendi türüyle tanınır", () => {
    expect(replyKind(listMessage)).toBe("list");
    expect(replyGlyph("list")).toBe("list");
    expect(replyGlyph("ai")).toBe("sparkles");
  });

  it("küçük resim ilk posterden gelir", () => {
    expect(replyThumb(listMessage)).toBe("/p1.jpg");
    expect(shareThumb(listMessage.share)).toBe("/p1.jpg");
  });

  it("bozuk paylaşım mesajı düz metne düşer", () => {
    expect(replyKind({ id: "x", kind: SHARE_KIND.AI, share: null, text: "?" })).toBe("text");
  });
});

describe("chatParamsForShare", () => {
  const share = buildListShare({ title: "t", items: [profileItem(1)] });

  it("arkadaş için friendUid parametreleri kurar", () => {
    const params = chatParamsForShare({ recipientType: "friend", uid: "u9", name: "Ayşe", avatarIndex: 2 }, share, 100);
    expect(params).toMatchObject({ friendUid: "u9", friendName: "Ayşe", initialShareKey: "list-100" });
    expect(params.initialShare).toBe(share);
    expect(params.groupId).toBeUndefined();
  });

  it("grup için groupId parametreleri kurar", () => {
    const params = chatParamsForShare({ recipientType: "group", id: "g1", name: "Sinema", avatarIndex: 3 }, share, 5);
    expect(params).toMatchObject({ groupId: "g1", groupName: "Sinema" });
    expect(params.friendUid).toBeUndefined();
  });

  it("alıcı kimliği yoksa null", () => {
    expect(chatParamsForShare({ recipientType: "group" }, share)).toBeNull();
    expect(chatParamsForShare({ recipientType: "friend" }, share)).toBeNull();
    expect(chatParamsForShare(null, share)).toBeNull();
  });
});

// ─── Hub içerikleri: gönderi, turnuva, CineSwipe daveti ──────────────────────

import {
  buildCineRoomShare,
  buildPostShare,
  buildTournamentShare,
  shareMessageText,
  shareRoute,
} from "../utils/chatShare";

const feedPost = (extra = {}) => ({
  id: "p1",
  type: "review",
  title: "Dune 2 incelemesi",
  content: "Görsel olarak muhteşem.\n\nMüzikler de çok iyi.",
  userRating: 4,
  visibility: "public",
  authorName: "Ayşe",
  authorAvatarIndex: 7,
  mediaList: [
    { id: 693134, type: "movie", title: "Dune: Part Two", poster: "https://image.tmdb.org/t/p/w500/dune2.jpg", year: "2024" },
  ],
  ...extra,
});

describe("buildPostShare", () => {
  it("feed gönderisini paylaşım gövdesine çevirir", () => {
    const share = buildPostShare(feedPost());
    expect(share).toMatchObject({
      type: "post",
      postId: "p1",
      postType: "review",
      title: "Dune 2 incelemesi",
      rating: 4,
      author: { name: "Ayşe", avatarIndex: 7 },
    });
    expect(share.items[0]).toMatchObject({ id: 693134, media_type: "movie", poster_path: "/dune2.jpg", year: "2024" });
    expect(share.excerpt).toBe("Görsel olarak muhteşem.\n\nMüzikler de çok iyi.");
    expect(share.total).toBe(1);
  });

  it("herkese açık OLMAYAN gönderiyi sohbete gömmez (içerik sızmasın)", () => {
    expect(buildPostShare(feedPost({ visibility: "followers" }))).toBeNull();
  });

  it("görünürlük alanı yoksa (eski kayıt) herkese açık sayılır", () => {
    expect(buildPostShare(feedPost({ visibility: undefined }))).not.toBeNull();
  });

  it("kimliksiz / boş gönderi → null", () => {
    expect(buildPostShare(null)).toBeNull();
    expect(buildPostShare({ type: "text", title: "x" })).toBeNull();
    expect(buildPostShare({ id: "p2", type: "text" })).toBeNull();
  });

  it("spoiler bayrağını taşır, bilinmeyen türü incelemeye düşürür", () => {
    expect(buildPostShare(feedPost({ hasSpoiler: true })).spoiler).toBe(true);
    expect(buildPostShare(feedPost({ type: "garip" })).postType).toBe("review");
  });

  it("derecelendirmeyi 1–5 aralığıyla sınırlar", () => {
    expect(buildPostShare(feedPost({ userRating: 9 })).rating).toBeUndefined();
    expect(buildPostShare(feedPost({ userRating: 0 })).rating).toBeUndefined();
  });

  it("anket: soru, en çok 4 seçenek etiketi ve oy sayısı", () => {
    const share = buildPostShare({
      id: "p3",
      type: "poll",
      title: "Hangisi?",
      visibility: "public",
      poll: {
        type: "text",
        question: "Hangisi?",
        options: ["A", "B", "C", "D", "E"].map((label, i) => ({ id: `o${i}`, label })),
        votes: { u1: "o0", u2: "o1", u3: null },
      },
    });
    expect(share.poll).toEqual({ question: "Hangisi?", kind: "text", options: ["A", "B", "C", "D"], votes: 2 });
  });

  it("uzun metni kırpar, öğe tavanını uygular ama gerçek sayıyı korur", () => {
    const mediaList = Array.from({ length: 30 }, (_, i) => ({
      id: i + 1,
      type: "movie",
      title: `F${i}`,
      poster: `https://image.tmdb.org/t/p/w500/${i}.jpg`,
    }));
    const share = buildPostShare(feedPost({ content: "x".repeat(900), mediaList }));
    expect(share.excerpt.length).toBeLessThanOrEqual(280);
    expect(share.items).toHaveLength(12);
    expect(share.total).toBe(30);
  });

  it("undefined değer sızdırmaz (Firestore reddeder)", () => {
    const share = buildPostShare({ id: "p4", type: "text", title: "Selam", authorName: undefined, mediaList: undefined });
    const flat = JSON.stringify(share, (_k, v) => (v === undefined ? "__undef__" : v));
    expect(flat).not.toContain("__undef__");
  });

  it("yazar fotoğrafı yalnız http(s) URL ise saklanır", () => {
    expect(buildPostShare(feedPost({ authorPhotoURL: "https://x.test/a.jpg" })).author.photoURL).toBe("https://x.test/a.jpg");
    expect(buildPostShare(feedPost({ authorPhotoURL: "javascript:alert(1)" })).author.photoURL).toBeUndefined();
  });
});

describe("buildTournamentShare", () => {
  it("ay + faz + şampiyon + katılımcı sayısını taşır", () => {
    const share = buildTournamentShare({
      periodId: "2026-10",
      phase: "results",
      champion: { id: 5, title: "Hereditary", posterPath: "/h.jpg", mediaType: "movie" },
      voters: 128,
    });
    expect(share).toMatchObject({
      type: "tournament",
      periodId: "2026-10",
      phase: "results",
      voters: 128,
      champion: { id: 5, title: "Hereditary", poster_path: "/h.jpg", media_type: "movie" },
    });
  });

  it("geçersiz ay kimliğinde null", () => {
    expect(buildTournamentShare({ periodId: "2026-13", phase: "voting" })).toBeNull();
    expect(buildTournamentShare({ periodId: "ekim", phase: "voting" })).toBeNull();
    expect(buildTournamentShare({})).toBeNull();
  });

  it("bilinmeyen fazı seçim fazına düşürür, başlıksız şampiyonu atar", () => {
    const share = buildTournamentShare({ periodId: "2026-03", phase: "x", champion: { id: 1 } });
    expect(share.phase).toBe("selection");
    expect(share.champion).toBeUndefined();
  });
});

describe("buildCineRoomShare", () => {
  it("boşluklu kodu normalleştirir", () => {
    expect(buildCineRoomShare({ code: "749 215", host: "Ali", count: 20 })).toEqual({
      v: 1,
      type: "cineRoom",
      code: "749215",
      host: "Ali",
      count: 20,
    });
  });

  it("6 haneli rakam olmayan kodu reddeder", () => {
    expect(buildCineRoomShare({ code: "12345" })).toBeNull();
    expect(buildCineRoomShare({ code: "abc123" })).toBeNull();
    expect(buildCineRoomShare({ code: "1234567" })).toBeNull();
    expect(buildCineRoomShare({})).toBeNull();
  });

  it("makul olmayan kart sayısını atar", () => {
    expect(buildCineRoomShare({ code: "123456", count: 100000 }).count).toBeUndefined();
  });
});

describe("hub paylaşımları: mesaj, önizleme, rota", () => {
  const post = buildPostShare(feedPost());
  const tournament = buildTournamentShare({ periodId: "2026-10", phase: "voting" });
  const room = buildCineRoomShare({ code: "749215" });

  it("her tür kendi kind'ı ve emoji önekiyle mesaj olur", () => {
    expect(buildShareMessage(post)).toMatchObject({ kind: "postShare", text: "⭐ Dune 2 incelemesi" });
    // Metin dile göre çözülür (jest ortamı İngilizce): önek ve doluluk sınanır.
    expect(buildShareMessage(tournament)).toMatchObject({ kind: "tournamentShare", text: expect.stringMatching(/^🏆 \S/u) });
    expect(buildShareMessage(room)).toMatchObject({ kind: "cineRoomShare", text: expect.stringMatching(/^🎬 \S/u) });
  });

  it("gönderi önekini türe göre seçer", () => {
    const list = buildPostShare(feedPost({ type: "list", title: "Hafta sonu" }));
    const poll = buildPostShare({
      id: "p9",
      type: "poll",
      title: "Hangisi?",
      poll: { question: "Hangisi?", options: [{ label: "A" }, { label: "B" }] },
    });
    expect(shareMessageText(list).startsWith("📋 ")).toBe(true);
    expect(shareMessageText(poll).startsWith("📊 ")).toBe(true);
  });

  it("başlıksız gönderi metnin ilk satırını önizleme yapar", () => {
    const share = buildPostShare({ id: "p5", type: "text", content: "İlk satır\nİkinci satır" });
    expect(sharePreview(share)).toBe("İlk satır");
  });

  it("readShare yeni türleri okur, kind uyuşmazlığını reddeder", () => {
    const message = { id: "m", ...buildShareMessage(post) };
    expect(readShare(message).type).toBe("post");
    expect(readShare({ ...message, kind: "tournamentShare" })).toBeNull();
    expect(readShare({ id: "m", ...buildShareMessage(room) }).code).toBe("749215");
  });

  it("alıntı küçük resmi: gönderide ilk afiş, turnuvada şampiyon, davette yok", () => {
    expect(shareThumb(post)).toBe("/dune2.jpg");
    const champ = buildTournamentShare({
      periodId: "2026-10",
      phase: "results",
      champion: { id: 5, title: "H", posterPath: "/h.jpg" },
    });
    expect(shareThumb(champ)).toBe("/h.jpg");
    expect(shareThumb(room)).toBeNull();
    expect(replyKind({ id: "m", ...buildShareMessage(post) })).toBe("post");
    expect(replyThumb({ id: "m", ...buildShareMessage(champ) })).toBe("/h.jpg");
    expect(replyGlyph("post")).toBe("newspaper");
    expect(replyGlyph("tournament")).toBe("trophy");
    expect(replyGlyph("cineRoom")).toBe("film");
  });

  it("rota: gönderi, turnuva ve davetin hedef ekranı; liste/AI için yok", () => {
    expect(shareRoute(post)).toEqual({ name: "PostDetailScreen", params: { postId: "p1" } });
    expect(shareRoute(tournament)).toEqual({ name: "TournamentScreen", params: undefined });
    expect(shareRoute(room)).toEqual({
      name: "CineSwipeScreen",
      params: { initialMode: "duo", inviteCode: "749215" },
    });
    expect(shareRoute(buildListShare({ title: "t", items: [profileItem(1)] }))).toBeNull();
    expect(shareRoute(null)).toBeNull();
  });
});
