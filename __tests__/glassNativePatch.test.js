// patches/expo-glass-effect+<sürüm>.patch — iOS camının "dokunana kadar görünmez"
// hatasının native düzeltmesi. UIKit (iOS 26.1+) neredeyse saydamken çizilen camı
// düşürür ve kendiliğinden yeniden çizmez; giriş animasyonu opaklıkla açılan
// ekranlarda (AuthKit Reveal, AI sohbet modalı, kademeli listeler) alan/kart/düğme
// camı ancak dokunuş ya da ton değişimi efekti yeniden atayınca görünüyordu.
// Yama GlassView'a (a) Core Animation sunum katmanı opaklığını ve (b) opaklık
// yükselip oturunca efekti yeniden atayan ortak bir izleyici ekler.
//
// Bu test yamanın SESSİZCE kaybolmasını yakalar: expo-glass-effect sürümü değişip
// yama dosyası eski sürüm adıyla kalırsa patch-package yamayı uygulamaz ve hata
// geri gelir. Swift'in kendisi yalnız iOS build'inde derlenir (Windows'ta değil).
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const pkgDir = path.join(root, "node_modules", "expo-glass-effect");
const { version } = require(path.join(pkgDir, "package.json"));
const swiftSource = fs.readFileSync(path.join(pkgDir, "ios", "GlassView.swift"), "utf8");

describe("expo-glass-effect native yaması", () => {
  it("kurulu sürüm için yama dosyası var", () => {
    expect(fs.existsSync(path.join(root, "patches", `expo-glass-effect+${version}.patch`))).toBe(true);
  });

  it("yama node_modules'a uygulanmış (postinstall: patch-package)", () => {
    expect(swiftSource).toContain("final class GlassVisibilityMonitor");
    expect(swiftSource).toContain("GlassVisibilityMonitor.shared.track(self)");
    expect(swiftSource).toContain("GlassVisibilityMonitor.shared.untrack(self)");
    expect(swiftSource).toContain("fileprivate func sampleOpacity()");
  });

  it("opaklık sunum katmanını da okur (UIKit fade geçişleri)", () => {
    expect(swiftSource).toMatch(/layer\.presentation\(\)/);
    expect(swiftSource).toMatch(/return effectiveOpacity > 0\.02/);
  });
});
