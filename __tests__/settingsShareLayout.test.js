// "Görünümümü paylaş" yerleşimi: sayfa durum çubuğuna değmez, tablette ortalanır,
// önizleme ekran genişliğiyle büyümez, balon dar telefonda taşmaz.
import {
  MOCK_INNER_PADDING,
  MOCK_POSTER_GAP,
  SHEET_MAX_WIDTH,
  SHEET_TOP_GAP,
  mockPosterCount,
  settingsBubbleWidth,
  settingsScreenPreview,
  settingsSheetLayout,
} from "../utils/settingsShareLayout";

const PHONES = [
  { name: "iPhone SE", width: 375, height: 667, insetTop: 20, insetBottom: 0 },
  { name: "iPhone 15", width: 393, height: 852, insetTop: 59, insetBottom: 34 },
  { name: "iPhone 15 Pro Max", width: 430, height: 932, insetTop: 59, insetBottom: 34 },
  { name: "Android küçük", width: 360, height: 640, insetTop: 24, insetBottom: 0 },
  { name: "Pixel 8a", width: 412, height: 915, insetTop: 52, insetBottom: 24 },
  { name: "iPad", width: 820, height: 1180, insetTop: 24, insetBottom: 20 },
];

test.each(PHONES)("$name: sayfanın tepesi durum çubuğunun altına girmez", (screen) => {
  const layout = settingsSheetLayout(screen);
  const sheetTop = screen.height - layout.maxHeight;
  expect(sheetTop).toBeGreaterThanOrEqual(screen.insetTop + SHEET_TOP_GAP);
  expect(layout.width).toBeLessThanOrEqual(Math.min(screen.width, SHEET_MAX_WIDTH));
  expect(layout.paddingBottom).toBeGreaterThanOrEqual(screen.insetBottom);
});

test("tablet / geniş ekranda sayfa ortalanır ve 560 dp'yi aşmaz; telefonda tam genişlik", () => {
  expect(settingsSheetLayout({ width: 820, height: 1180 })).toMatchObject({ width: 560, centered: true });
  expect(settingsSheetLayout({ width: 393, height: 852 })).toMatchObject({ width: 393, centered: false });
});

test("büyük önizleme yalnız uzun ekranda", () => {
  expect(settingsSheetLayout({ width: 375, height: 667 }).largeMock).toBe(false);
  expect(settingsSheetLayout({ width: 393, height: 852 }).largeMock).toBe(false);
  expect(settingsSheetLayout({ width: 430, height: 932 }).largeMock).toBe(true);
});

test("önizlemede afiş ~44 dp kalır: genişlik artınca sayı artar (5–9)", () => {
  expect(mockPosterCount(200)).toBe(5);
  expect(mockPosterCount(337)).toBe(6);
  expect(mockPosterCount(357)).toBe(7);
  expect(mockPosterCount(524)).toBe(9);
  expect(mockPosterCount(2000)).toBe(9);
  for (const width of [300, 357, 400, 524]) {
    const count = mockPosterCount(width);
    const poster = (width - MOCK_INNER_PADDING - (count - 1) * MOCK_POSTER_GAP) / count;
    expect(poster).toBeLessThanOrEqual(56);
    expect(poster).toBeGreaterThanOrEqual(30);
  }
});

test("bozuk ölçü güvenli varsayılana düşer, çok kısa ekranda bile tepe güvenli alanın altında", () => {
  expect(settingsSheetLayout({ width: NaN, height: undefined })).toMatchObject({ width: 390, centered: false });
  const tiny = settingsSheetLayout({ width: 360, height: 300, insetTop: 24 });
  expect(tiny.maxHeight).toBeLessThanOrEqual(300 - 24);
});

test("balon zengin balonun %90 sınırına sığar (dar telefonda taşmaz, geniş ekranda büyümez)", () => {
  // Zengin balon: satırın %90'ı, 10 dp iç boşluk (MessageBubble richMessage); grup avatarı ~32 dp.
  for (const width of [320, 360, 375, 393, 430]) {
    const room = (width - 16 - 32) * 0.9 - 20;
    expect(settingsBubbleWidth(width)).toBeLessThanOrEqual(room);
  }
  expect(settingsBubbleWidth(1024)).toBe(288);
});

test("ayar alt sayfası önizleme kartı: telefonda kenardan kenara (16 dp boşluk), tablette 560 dp", () => {
  expect(settingsScreenPreview(393)).toEqual({ cardWidth: 361, posterCount: 6 });
  expect(settingsScreenPreview(320).cardWidth).toBe(288);
  expect(settingsScreenPreview(820)).toEqual({ cardWidth: 560, posterCount: 9 });
});
