// TMDB anahtar sağlığı: 401 hemen, 429 ard arda gelirse bildirilir (utils/tmdbKeyHealth.js).
// Seçilen yol "a" (anahtar uygulamada kalır) ancak sızıntı sessiz kalmasın diye.
const mockCapture = jest.fn();
jest.mock("../services/crashReporting", () => ({ captureError: (...a) => mockCapture(...a) }));
jest.mock("axios", () => ({ __esModule: true, default: { interceptors: { response: { use: jest.fn() } } } }));

const {
  RATE_LIMIT_STREAK,
  __resetTmdbKeyHealth,
  classifyTmdbStatus,
} = require("../utils/tmdbKeyHealth");

beforeEach(() => {
  mockCapture.mockClear();
  __resetTmdbKeyHealth();
});

test("401/403 anında bildirilir (jeton iptal ya da geçersiz)", () => {
  expect(classifyTmdbStatus(401)).toEqual({ reason: "unauthorized", streak: 0 });
  expect(classifyTmdbStatus(403)).toEqual({ reason: "unauthorized", streak: 0 });
});

test("tek tük 429 bildirilmez; ard arda gelince bildirilir", () => {
  for (let i = 1; i < RATE_LIMIT_STREAK; i += 1) {
    expect(classifyTmdbStatus(429)).toBeNull();
  }
  expect(classifyTmdbStatus(429)).toEqual({ reason: "rate_limited", streak: RATE_LIMIT_STREAK });
});

test("başarılı yanıt seriyi sıfırlar", () => {
  for (let i = 1; i < RATE_LIMIT_STREAK; i += 1) classifyTmdbStatus(429);
  expect(classifyTmdbStatus(200)).toBeNull();
  // Seri sıfırlandığı için tek 429 yine sessiz.
  expect(classifyTmdbStatus(429)).toBeNull();
});

test("sıradan hatalar (404/500) sessiz", () => {
  expect(classifyTmdbStatus(404)).toBeNull();
  expect(classifyTmdbStatus(500)).toBeNull();
  expect(classifyTmdbStatus(undefined)).toBeNull();
});
