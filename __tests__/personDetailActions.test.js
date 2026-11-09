// Oyuncu / yönetmen sayfasındaki "Yapay Zeka" ve "Sohbete gönder" düğmelerinin
// saf çekirdeği (utils/personDetailActions.js).
import i18n from "../translations";
import {
  buildPersonAiRequest,
  buildPersonChatMedia,
  personKnownFor,
} from "../utils/personDetailActions";

jest.mock("../translations", () => ({ __esModule: true, default: require("i18next").createInstance() }));

const LANGS = ["tr", "en", "es", "pt", "de"];

beforeAll(async () => {
  await i18n.init({
    lng: "tr",
    fallbackLng: "tr",
    resources: Object.fromEntries(
      LANGS.map((code) => [code, { translation: require(`../translations/${code}.json`) }]),
    ),
  });
});

const actor = {
  id: 287,
  name: "Brad Pitt",
  profile_path: "/brad.jpg",
  known_for_department: "Acting",
  movie_credits: {
    cast: [
      { title: "Troy", vote_count: 9000 },
      { title: "Fight Club", vote_count: 30000 },
      { title: "Se7en", vote_count: 21000 },
      { title: "Fight Club", vote_count: 10 }, // aynı ad iki kez sayılmaz
    ],
    crew: [{ title: "Moneyball", department: "Production", vote_count: 99999 }],
  },
  tv_credits: { cast: [{ name: "Friends", vote_count: 8000 }] },
};

describe("personKnownFor", () => {
  it("oyuncuda rolleri oy sayısına göre sıralar, yinelenen adı atar", () => {
    expect(personKnownFor(actor)).toEqual(["Fight Club", "Se7en", "Troy", "Friends"]);
    expect(personKnownFor(actor, 2)).toEqual(["Fight Club", "Se7en"]);
  });

  it("yönetmende kendi bölümündeki işleri alır, yoksa rollere düşer", () => {
    const director = {
      name: "Christopher Nolan",
      known_for_department: "Directing",
      movie_credits: {
        cast: [{ title: "Cameo", vote_count: 999999 }],
        crew: [
          { title: "Inception", department: "Directing", vote_count: 36000 },
          { title: "Inception", department: "Writing", vote_count: 36000 },
          { title: "Memento", department: "Directing", vote_count: 10000 },
        ],
      },
    };
    expect(personKnownFor(director)).toEqual(["Inception", "Memento"]);
    expect(personKnownFor({ ...director, movie_credits: { cast: director.movie_credits.cast } })).toEqual(["Cameo"]);
    expect(personKnownFor(null)).toEqual([]);
  });
});

describe("buildPersonAiRequest", () => {
  it("her dilde çevrilmiş istek; ada en bilinen üç yapım eklenir, balonda yalnız ad", async () => {
    for (const language of LANGS) {
      await i18n.changeLanguage(language);
      const request = buildPersonAiRequest(actor);
      const named = "Brad Pitt (Fight Club, Se7en, Troy)";
      expect(request.prompt).toBe(i18n.t("autoI18n.kisi_ai_prompt", { name: named }));
      expect(request.prompt).toContain(named);
      expect(request.prompt).not.toContain("{{");
      expect(request.display).toBe(i18n.t("autoI18n.kisi_ai_display", { name: "Brad Pitt" }));
      expect(request.display).not.toContain("Fight Club");
    }
    await i18n.changeLanguage("tr");
  });

  it("adı olmayan kişide boş istek (düğme çizilmez)", () => {
    expect(buildPersonAiRequest({ id: 1 })).toEqual({ prompt: "", display: "" });
    expect(buildPersonAiRequest(null)).toEqual({ prompt: "", display: "" });
    expect(buildPersonAiRequest({ name: "Ada" }).prompt).toContain("Ada");
  });
});

describe("buildPersonChatMedia", () => {
  it("sohbet aramasındaki kişi kartıyla aynı şema", () => {
    expect(buildPersonChatMedia(actor)).toEqual({
      id: 287,
      media_type: "person",
      title: "Brad Pitt",
      poster_path: "/brad.jpg",
      overview: "Fight Club, Se7en, Troy, Friends",
      known_for_department: "Acting",
    });
  });

  it("fotoğraf / yapım yoksa alanlar null, kimlik veya ad yoksa kart yok", () => {
    expect(buildPersonChatMedia({ id: 5, name: "Ada" })).toEqual({
      id: 5,
      media_type: "person",
      title: "Ada",
      poster_path: null,
      overview: null,
      known_for_department: null,
    });
    expect(buildPersonChatMedia({ name: "Ada" })).toBeNull();
    expect(buildPersonChatMedia({ id: 5, name: "  " })).toBeNull();
  });
});
