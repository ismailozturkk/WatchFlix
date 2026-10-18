// __tests__/followedUpcomingService.test.js
//
// services/followedUpcoming.js: kişi başına combined_credits çekimi, hata yalıtımı, gruplama.
const mockReadTmdb = jest.fn();
jest.mock("../services/favoriteRecommendations", () => ({ readTmdb: (...args) => mockReadTmdb(...args) }));

const { fetchFollowedUpcoming } = require("../services/followedUpcoming");

const NOW = new Date(2026, 9, 18, 12);
const credit = (id, date, extra = {}) => ({
  id, media_type: "movie", poster_path: `/m${id}.jpg`, release_date: date, character: "Rol", genre_ids: [18], ...extra,
});
const people = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `K${i + 1}` }));

beforeEach(() => mockReadTmdb.mockReset());

it("her kişi için combined_credits okur ve yaklaşanları tarihe göre birleştirir", async () => {
  mockReadTmdb.mockImplementation(async (path) => {
    if (path === "/person/1/combined_credits") return { cast: [credit(10, "2027-03-01"), credit(11, "2020-01-01")] };
    if (path === "/person/2/combined_credits") return { cast: [credit(10, "2027-03-01"), credit(12, "2027-01-01")] };
    throw new Error("beklenmeyen " + path);
  });
  const items = await fetchFollowedUpcoming({ people: people(2), mediaType: "movie", apiKey: "k", language: "tr", now: NOW });
  expect(items.map((i) => i.id)).toEqual([12, 10]);
  expect(items[1]._people).toEqual(["K1", "K2"]);
  expect(mockReadTmdb).toHaveBeenCalledWith("/person/1/combined_credits", expect.objectContaining({ apiKey: "k", language: "tr", type: "movie" }));
});

it("tek kişinin hatası listeyi düşürmez; hepsi düşerse hata yukarı çıkar", async () => {
  mockReadTmdb.mockImplementation(async (path) => {
    if (path === "/person/1/combined_credits") throw new Error("ağ");
    return { cast: [credit(20, "2027-02-02")] };
  });
  const items = await fetchFollowedUpcoming({ people: people(2), mediaType: "movie", apiKey: "k", language: "tr", now: NOW });
  expect(items.map((i) => i.id)).toEqual([20]);

  mockReadTmdb.mockRejectedValue(new Error("hepsi düştü"));
  await expect(
    fetchFollowedUpcoming({ people: people(2), mediaType: "movie", apiKey: "k", language: "tr", now: NOW }),
  ).rejects.toThrow("hepsi düştü");
});

it("anahtar ya da kişi yoksa ağa çıkmaz", async () => {
  expect(await fetchFollowedUpcoming({ people: people(2), mediaType: "movie", apiKey: "", language: "tr" })).toEqual([]);
  expect(await fetchFollowedUpcoming({ people: [], mediaType: "movie", apiKey: "k", language: "tr" })).toEqual([]);
  expect(mockReadTmdb).not.toHaveBeenCalled();
});

it("60 kişiyi 6'şarlı gruplarla çeker (aynı anda 6'dan fazla istek yok)", async () => {
  let running = 0;
  let peak = 0;
  mockReadTmdb.mockImplementation(async () => {
    running += 1;
    peak = Math.max(peak, running);
    await Promise.resolve();
    running -= 1;
    return { cast: [] };
  });
  await fetchFollowedUpcoming({ people: people(60), mediaType: "tv", apiKey: "k", language: "tr", now: NOW });
  expect(mockReadTmdb).toHaveBeenCalledTimes(60);
  expect(peak).toBeLessThanOrEqual(6);
});
