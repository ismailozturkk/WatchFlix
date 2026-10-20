// utils/screenTopSpacing.js — sekme sayfa başlığının güvenli alana bağlı üst boşluğu.
// Ayarlar başlığı iPhone'da Dynamic Island'ın dibinde kalıyordu (sabit marginTop 36).
import {
  TAB_TITLE_INSET_GAP,
  TAB_TITLE_MIN_TOP,
  tabTitleTopSpacing,
} from "../utils/screenTopSpacing";

describe("tabTitleTopSpacing", () => {
  it("Dynamic Island'lı iPhone: başlık güvenli alanın altında, nefes payıyla başlar", () => {
    // iPhone 14 Pro / 15 / 16 ailesi: güvenli alan üstte 59–62 pt.
    expect(tabTitleTopSpacing(59)).toBe(59 + TAB_TITLE_INSET_GAP);
    expect(tabTitleTopSpacing(62)).toBe(62 + TAB_TITLE_INSET_GAP);
  });

  it("çentikli iPhone (X–13): güvenli alan ~44–50 pt, boşluk onunla büyür", () => {
    expect(tabTitleTopSpacing(47)).toBe(47 + TAB_TITLE_INSET_GAP);
    expect(tabTitleTopSpacing(50)).toBe(50 + TAB_TITLE_INSET_GAP);
  });

  it("çentiksiz iPhone (SE, güvenli alan 20 pt): eski sabit değer aynen kalır", () => {
    expect(tabTitleTopSpacing(20)).toBe(TAB_TITLE_MIN_TOP);
  });

  it("Android edge-to-edge: durum çubuğu / kamera deliği yüksekliğiyle birlikte büyür", () => {
    expect(tabTitleTopSpacing(24)).toBe(24 + TAB_TITLE_INSET_GAP); // düz durum çubuğu
    expect(tabTitleTopSpacing(36)).toBe(36 + TAB_TITLE_INSET_GAP); // kamera deliği
    expect(tabTitleTopSpacing(48)).toBe(48 + TAB_TITLE_INSET_GAP); // yüksek çentik
  });

  it("güvenli alan 0 / eksik / geçersiz: alt sınırın altına inmez", () => {
    expect(tabTitleTopSpacing(0)).toBe(TAB_TITLE_MIN_TOP);
    expect(tabTitleTopSpacing(undefined)).toBe(TAB_TITLE_MIN_TOP);
    expect(tabTitleTopSpacing(null)).toBe(TAB_TITLE_MIN_TOP);
    expect(tabTitleTopSpacing(NaN)).toBe(TAB_TITLE_MIN_TOP);
    expect(tabTitleTopSpacing(-12)).toBe(TAB_TITLE_MIN_TOP);
    expect(tabTitleTopSpacing("59")).toBe(TAB_TITLE_MIN_TOP);
  });

  it("kesirli güvenli alan tam piksele yuvarlanır", () => {
    expect(tabTitleTopSpacing(47.6)).toBe(64); // 63.6 → 64
    expect(Number.isInteger(tabTitleTopSpacing(33.3))).toBe(true);
  });

  it("alt sınır ve pay çağıran tarafından değiştirilebilir", () => {
    expect(tabTitleTopSpacing(59, { gap: 8 })).toBe(67);
    expect(tabTitleTopSpacing(0, { min: 50 })).toBe(50);
  });

  it("Film / Dizi sekmelerinin arama çubuğuyla aynı pay (hizalı kalsın)", () => {
    expect(TAB_TITLE_INSET_GAP).toBe(16);
  });
});
