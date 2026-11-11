import {
  normalizeProfileBanner,
  pickBannerCandidates,
  profileBannersEqual,
  readProfileBanner,
  toBannerPayload,
} from "../utils/profileBanner";

describe("profil kapağı (banner)", () => {
  const ok = { id: 27205, type: "movie", title: "Inception", path: "/s3TBrRGB1iav7gFOCNx3H31MoES.jpg" };

  it("geçerli kapağı korur, metni kırpar", () => {
    expect(normalizeProfileBanner(ok)).toEqual(ok);
    expect(normalizeProfileBanner({ ...ok, id: "27205", title: "  Inception  " })).toEqual(ok);
    expect(normalizeProfileBanner({ ...ok, title: "x".repeat(400) }).title).toHaveLength(200);
  });

  it("geçersiz biçimi reddeder (tam adres, tür, kimlik)", () => {
    expect(normalizeProfileBanner(null)).toBeNull();
    expect(normalizeProfileBanner({ ...ok, path: "https://evil.example/p.jpg" })).toBeNull();
    expect(normalizeProfileBanner({ ...ok, path: "/../x.jpg" })).toBeNull();
    expect(normalizeProfileBanner({ ...ok, type: "person" })).toBeNull();
    expect(normalizeProfileBanner({ ...ok, id: 0 })).toBeNull();
    expect(normalizeProfileBanner({ ...ok, id: 1.5 })).toBeNull();
  });

  it("profilden okur ve karşılaştırır", () => {
    expect(readProfileBanner({ profileBanner: ok })).toEqual(ok);
    expect(readProfileBanner({})).toBeNull();
    expect(profileBannersEqual(null, undefined)).toBe(true);
    expect(profileBannersEqual(ok, { ...ok, title: "başka" })).toBe(true);
    expect(profileBannersEqual(ok, { ...ok, path: "/b.jpg" })).toBe(false);
    expect(profileBannersEqual(ok, null)).toBe(false);
    expect(toBannerPayload(null)).toBeNull();
  });

  it("adayları sıralar: yazısız önce, sonra puan; yinelenenler atılır", () => {
    const rows = pickBannerCandidates({
      backdrops: [
        { file_path: "/en.jpg", iso_639_1: "en", vote_average: 9 },
        { file_path: "/a.jpg", iso_639_1: null, vote_average: 5 },
        { file_path: "/b.jpg", iso_639_1: null, vote_average: 7 },
        { file_path: "/b.jpg", iso_639_1: null, vote_average: 7 },
        { file_path: "bad", iso_639_1: null, vote_average: 10 },
      ],
    });
    expect(rows.map((r) => r.path)).toEqual(["/b.jpg", "/a.jpg", "/en.jpg"]);
    expect(pickBannerCandidates(null)).toEqual([]);
  });
});
