// Gizli replikler (utils/universeQuotes.js): arama kutusuna yazılan meşhur replik evreni açar.
import { UNIVERSE_QUOTES, matchUniverseQuote } from "../utils/universeQuotes";
import { isUniverseId } from "../utils/universeUnlocks";

describe("gizli replikler", () => {
  it("her replik kendi evrenini açar; kimlikler bilinen evrenler", () => {
    for (const [id, quotes] of Object.entries(UNIVERSE_QUOTES)) {
      expect([id, isUniverseId(id)]).toEqual([id, true]);
      for (const q of quotes) expect([q, matchUniverseQuote(q)]).toEqual([q, id]);
    }
  });

  it("büyük/küçük harf, noktalama, kesme ve Türkçe harf yok sayılır", () => {
    expect(matchUniverseQuote("WINTER IS COMING!")).toBe("got");
    expect(matchUniverseQuote("Here's Johnny!")).toBe("shining");
    expect(matchUniverseQuote("Güç seninle olsun.")).toBe("starWars");
    expect(matchUniverseQuote("Kış geliyor")).toBe("got");
    expect(matchUniverseQuote("I'm the king of the world!")).toBe("titanic");
  });

  it("yazarken yalnız tam eşleşme; arama tuşunda uzun replikte harf hatası", () => {
    expect(matchUniverseQuote("may the forse be with you")).toBe(null);
    expect(matchUniverseQuote("may the forse be with you", { lenient: true })).toBe("starWars");
  });

  it("replik parçası, yapım adı ve boş metin açmaz", () => {
    expect(matchUniverseQuote("winter")).toBe(null);
    expect(matchUniverseQuote("game of thrones")).toBe(null);
    expect(matchUniverseQuote("star wars", { lenient: true })).toBe(null);
    expect(matchUniverseQuote("")).toBe(null);
    expect(matchUniverseQuote("the matrix", { lenient: true })).toBe(null);
  });
});
