// __tests__/rnScreensGammaPlugin.test.js
//
// plugins/withRNScreensGamma.js Podfile düzenlemesinin sözleşmesi.
//
// NEDEN: `ScrollViewMarker` yalnız RNS_GAMMA_ENABLED=1 ile gerçek yerel koda
// sahip; bayrak yoksa boş taslak gelir ve iOS'ta ilk render
// `Exception in HostFunction: <unknown>` ile patlar (JS testleri bunu göremez).
// Bu test bayrağın sessizce kaybolmasını engeller.

const fs = require("fs");
const path = require("path");
const {
  enableRNScreensGamma,
  GAMMA_LINE,
} = require("../plugins/withRNScreensGamma");

const PODFILE = [
  "require File.join(File.dirname(`node --print \"require.resolve('expo/package.json')\"`), \"scripts/autolinking\")",
  "",
  "prepare_react_native_project!",
  "",
  "target 'Seelogd' do",
  "end",
  "",
].join("\n");

describe("withRNScreensGamma", () => {
  it("bayrağı prepare_react_native_project!'ten ÖNCE ekler", () => {
    const out = enableRNScreensGamma(PODFILE);
    const flag = out.indexOf(GAMMA_LINE);
    expect(flag).toBeGreaterThan(-1);
    expect(flag).toBeLessThan(out.indexOf("prepare_react_native_project!"));
  });

  it("idempotent: ikinci çalıştırma Podfile'ı değiştirmez", () => {
    const once = enableRNScreensGamma(PODFILE);
    expect(enableRNScreensGamma(once)).toBe(once);
  });

  it("çıpa yoksa sessizce geçmek yerine hata verir", () => {
    expect(() => enableRNScreensGamma("target 'X' do\nend\n")).toThrow(
      /prepare_react_native_project!/,
    );
  });

  it("eklenti app.json'da kayıtlı (kaydı silinirse iOS'ta sekmeler çöker)", () => {
    const app = JSON.parse(
      fs.readFileSync(path.join(__dirname, "..", "app.json"), "utf8"),
    );
    const plugins = (app.expo || app).plugins.map((p) =>
      Array.isArray(p) ? p[0] : p,
    );
    expect(plugins).toContain("./plugins/withRNScreensGamma.js");
  });
});
