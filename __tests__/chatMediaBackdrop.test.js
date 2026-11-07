import { chatBackdropUrl, withSenderBackdrop } from "../utils/chatMediaBackdrop";

const movie = { id: 27205, media_type: "movie", title: "Inception", backdrop_path: "/default.jpg" };

describe("withSenderBackdrop", () => {
  test("seçim yoksa TMDB varsayılanı + w780 tam URL", () => {
    const out = withSenderBackdrop(movie, (type, id, fallback) => fallback);
    expect(out.backdrop_path).toBe("/default.jpg");
    expect(out.backdrop_url).toBe("https://image.tmdb.org/t/p/w780/default.jpg");
  });

  test("gönderenin özel seçimi yazılır (çözücüye doğru tür/id gider)", () => {
    const resolve = jest.fn(() => "/chosen.jpg");
    const out = withSenderBackdrop({ ...movie, media_type: "tv", id: 1399 }, resolve);
    expect(resolve).toHaveBeenCalledWith("tv", 1399, "/default.jpg");
    expect(out.backdrop_path).toBe("/chosen.jpg");
    expect(out.backdrop_url).toBe("https://image.tmdb.org/t/p/w780/chosen.jpg");
  });

  test("arka plan yoksa iki alan da null (Firestore undefined almaz)", () => {
    const out = withSenderBackdrop({ id: 1, media_type: "movie", title: "X" }, () => null);
    expect(out.backdrop_path).toBeNull();
    expect(out.backdrop_url).toBeNull();
    expect(Object.values(out)).not.toContain(undefined);
  });

  test("çözücü verilmezse mesajdaki yol kullanılır; girdi değişmez", () => {
    const input = { ...movie };
    const out = withSenderBackdrop(input);
    expect(out.backdrop_url).toBe("https://image.tmdb.org/t/p/w780/default.jpg");
    expect(input).toEqual(movie);
  });

  test("kişi mesajına arka plan eklenmez", () => {
    const person = { id: 6193, media_type: "person", title: "Leonardo DiCaprio", poster_path: "/p.jpg" };
    expect(withSenderBackdrop(person, () => "/x.jpg")).toBe(person);
  });
});

test("chatBackdropUrl yalnız TMDB yolunu kabul eder", () => {
  expect(chatBackdropUrl("/a.jpg")).toBe("https://image.tmdb.org/t/p/w780/a.jpg");
  expect(chatBackdropUrl("https://evil.example/a.jpg")).toBeNull();
  expect(chatBackdropUrl(null)).toBeNull();
});
