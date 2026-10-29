// CineMatch istek sağlamlığı: istemci ↔ sunucu (functions/aiProxy.js) tavan aynası,
// istem bütçesi, callable hata eşlemesi ve yanıt ayrıştırma.
import {
  AI_REQUEST_LIMITS,
  MAX_HISTORY_MESSAGES,
  mapCallableError,
  parseResponse,
  sanitizeHistory,
} from "../services/geminiService";
import { buildCineSystemInstruction, clampBlock, fitCineSystemInstruction } from "../services/aiCineService";
import { buildLibraryContext } from "../services/aiUserContext";

const server = require("../functions/aiProxy");

const ALL_ON = { watchList: true, favorites: true, custom: true, watched: true };

/** Gerçekçi uzunlukta öğeler; dateAdded büyüdükçe daha yeni. */
const items = (n, prefix) =>
  Array.from({ length: n }, (_, i) => ({
    id: `${prefix}${i}`,
    name: `${prefix} Başlık Numarası ${i} Uzatılmış`,
    type: i % 2 ? "tv" : "movie",
    genres: ["Dram", "Bilim Kurgu", "Gerilim"],
    dateAdded: new Date(Date.UTC(2026, 0, 1) + i * 3600000).toISOString(),
  }));

const heavyLibrary = () => ({
  watchList: items(300, "W"),
  favorites: items(150, "F"),
  watchedMovies: items(900, "M"),
  watchedTv: items(200, "T"),
  "Hafta sonu": items(120, "C1"),
  Korku: items(80, "C2"),
  Klasikler: items(60, "C3"),
});

describe("istemci ↔ sunucu tavan aynası", () => {
  test("mesaj, geçmiş ve sistem talimatı tavanları aynı", () => {
    expect(AI_REQUEST_LIMITS.maxMessageChars).toBe(server.AI_LIMITS.maxMessageChars);
    expect(AI_REQUEST_LIMITS.maxHistoryMessageChars).toBe(server.AI_LIMITS.maxHistoryMessageChars);
    expect(AI_REQUEST_LIMITS.maxSystemChars).toBe(server.AI_LIMITS.maxSystemChars);
    expect(MAX_HISTORY_MESSAGES).toBe(server.AI_LIMITS.maxHistory);
  });
});

describe("istem bütçesi (büyük kütüphane sunucuda reddedilmez)", () => {
  test("kütüphane özeti bütçeye sığar; en yeni öğeler ve izlenenler bloğu kalır", () => {
    const { librarySummary, hasAny } = buildLibraryContext(heavyLibrary(), ALL_ON, { capPerList: 100 });
    expect(hasAny).toBe(true);
    expect(librarySummary.length).toBeLessThanOrEqual(12000);
    expect(librarySummary).toContain("WATCHED HISTORY");
    expect(librarySummary).toContain("do NOT recommend these again");
    // En yeni öğe (en büyük dateAdded) korunur, en eskisi düşer.
    expect(librarySummary).toContain("W Başlık Numarası 299 Uzatılmış");
    expect(librarySummary).not.toContain("W Başlık Numarası 0 Uzatılmış");
    expect(librarySummary).toMatch(/\[showing \d+ of 300, most recent\]/);
    // Satır yarıda kesilmez.
    librarySummary
      .split("\n")
      .filter((line) => line.startsWith("- "))
      .forEach((line) => expect(line).toMatch(/\)$/));
  });

  test("çok sayıda özel liste: en az öğede bile taşarsa satır sınırında kırpılır, izlenenler kalır", () => {
    const lists = { watchedMovies: items(10, "M") };
    for (let i = 0; i < 40; i += 1) lists[`Liste ${i}`] = items(30, `L${i}-`);
    const { librarySummary } = buildLibraryContext(lists, ALL_ON);
    expect(librarySummary.length).toBeLessThanOrEqual(12000);
    expect(librarySummary).toContain("[… truncated to fit]");
    expect(librarySummary.trimEnd().endsWith(".")).toBe(true); // izlenenler bloğu sonda
    expect(librarySummary).toContain("WATCHED HISTORY");
  });

  test("küçük kütüphane eskisi gibi: kırpma notu yok, tüm öğeler var", () => {
    const { librarySummary } = buildLibraryContext(
      { watchList: items(5, "W"), favorites: items(3, "F") },
      ALL_ON,
    );
    expect(librarySummary).not.toContain("[showing");
    expect(librarySummary).not.toContain("truncated");
    for (let i = 0; i < 5; i += 1) expect(librarySummary).toContain(`W Başlık Numarası ${i} Uzatılmış`);
  });

  test("büyük kütüphaneyle kurulan cine istemi sunucu doğrulamasından geçer", () => {
    const { librarySummary } = buildLibraryContext(heavyLibrary(), ALL_ON, { capPerList: 100 });
    const systemInstruction = fitCineSystemInstruction({ language: "tr", userLibrary: librarySummary });
    expect(() =>
      server.parseAiRequest({ mode: "cine", userMessage: "öner", systemInstruction }),
    ).not.toThrow();
  });

  test("fitCineSystemInstruction: tavanı aşan kütüphane kırpılır, şema ve kurallar korunur", () => {
    const huge = `USER LIBRARY:\n${Array.from({ length: 2000 }, (_, i) => `- Film ${i} (Movie, Dram)`).join("\n")}`;
    const fitted = fitCineSystemInstruction({ language: "en", userLibrary: huge, avoidBlock: "AVOID: x" });
    expect(fitted.length).toBeLessThanOrEqual(AI_REQUEST_LIMITS.maxSystemChars);
    expect(fitted).toContain("COMPACT SCHEMAS");
    expect(fitted).toContain("Output JSON ONLY.");
    expect(fitted).toContain("AVOID: x");
    expect(fitted).toContain("[… truncated to fit]");
  });

  test("fitCineSystemInstruction: sığan istem birebir aynı kalır", () => {
    const opts = { language: "tr", userLibrary: "USER LIBRARY:\n- Heat (Movie)", avoidBlock: "AVOID: Heat" };
    expect(fitCineSystemInstruction(opts)).toBe(buildCineSystemInstruction(opts));
  });

  test("clampBlock: satır sınırında keser, sığan metne dokunmaz", () => {
    expect(clampBlock("a\nb", 10)).toBe("a\nb");
    const text = ["satır bir uzun uzun", "satır iki uzun uzun", "satır üç uzun uzun"].join("\n");
    const out = clampBlock(text, 45);
    expect(out.length).toBeLessThanOrEqual(45);
    expect(out).toBe("satır bir uzun uzun\n[… truncated to fit]");
    expect(clampBlock("uzun bir satır", 3)).toBe("");
  });
});

describe("sanitizeHistory", () => {
  test("uzun geçmiş mesajı kırpılır (eski sunucu reddederdi)", () => {
    const [m] = sanitizeHistory([{ role: "assistant", text: "x".repeat(9000) }]);
    expect(m.role).toBe("model");
    expect(m.text.length).toBe(AI_REQUEST_LIMITS.maxHistoryMessageChars);
  });
});

describe("mapCallableError", () => {
  const fe = (code, message, details) => ({ code: `functions/${code}`, message, details });

  test("istek sunucuya ulaşmadıysa (SDK: internal/'internal') bağlantı hatası", () => {
    expect(mapCallableError(fe("internal", "internal")).code).toBe("NETWORK");
    expect(mapCallableError(new TypeError("Network request failed")).code).toBe("NETWORK");
  });

  test("sunucunun kendi internal hatası genel hata kalır", () => {
    expect(mapCallableError(fe("internal", "AI request failed")).code).toBe("API_ERROR");
  });

  test("kota, patlama freni, boş yanıt, kesinti", () => {
    const daily = mapCallableError(fe("resource-exhausted", "x", { reason: "DAILY_QUOTA", daily: { used: 3, limit: 3 } }));
    expect(daily.code).toBe("QUOTA");
    expect(daily.quota.reason).toBe("DAILY_QUOTA");
    expect(mapCallableError(fe("resource-exhausted", "x", { reason: "MONTHLY_QUOTA" })).code).toBe("MONTHLY_QUOTA");
    expect(mapCallableError(fe("resource-exhausted", "x", { reason: "BURST_LIMIT" })).code).toBe("RATE_LIMIT");
    expect(mapCallableError(fe("resource-exhausted", "x", { reason: "UPSTREAM_RATE_LIMIT" })).code).toBe("RATE_LIMIT");
    expect(mapCallableError(fe("unavailable", "Empty model response", { reason: "EMPTY_RESPONSE" })).code).toBe("EMPTY");
    expect(mapCallableError(fe("unavailable", "Upstream unavailable")).code).toBe("API_ERROR");
    expect(mapCallableError(fe("deadline-exceeded", "deadline-exceeded")).code).toBe("TIMEOUT");
    expect(mapCallableError(fe("unauthenticated", "x")).code).toBe("AUTH");
  });
});

describe("parseResponse", () => {
  test("yeni güvenlik bitiş nedenleri de BLOCKED", () => {
    expect(() => parseResponse({ candidates: [{ finishReason: "PROHIBITED_CONTENT", content: { parts: [] } }] })).toThrow(
      expect.objectContaining({ code: "BLOCKED" }),
    );
  });

  test("düşünce parçaları metne karışmaz", () => {
    const { text } = parseResponse({
      candidates: [{ content: { parts: [{ text: "plan", thought: true }, { text: '{"type":"general"}' }] }, finishReason: "STOP" }],
    });
    expect(text).toBe('{"type":"general"}');
  });

  test("sunucunun sade gövdesi ayrıştırılır", () => {
    const slim = server.slimResponse(
      { candidates: [{ content: { parts: [{ text: "merhaba" }] }, finishReason: "STOP" }] },
      server.AI_MODEL,
    );
    expect(parseResponse(slim)).toEqual({ text: "merhaba", truncated: false });
  });
});
